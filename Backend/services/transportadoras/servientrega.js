/**
 * Rastreo de Servientrega.
 *
 * Servientrega no publica una API de rastreo. Lo que hay son tres endpoints
 * internos que consumen su propia app y su propio sitio, sin autenticación:
 *
 *   A · GET  mobile …/api/envio/{guia}/1/es          (app móvil)
 *   B · POST mobile …/ControlRastreovalidaciones     (app móvil, validaciones)
 *   C · POST web    …/RastreoEnviosAjax.asmx         (sitio web, ASP.NET)
 *
 * Se consultan los tres en paralelo porque cada uno falla distinto y en
 * momentos distintos. No son contractuales: pueden cambiar de forma o
 * desaparecer sin aviso, así que este módulo nunca lanza — degrada a "no
 * disponible" y el pedido sigue mostrando su guía igual.
 *
 * Solo servidor: desde el navegador fallan por CORS.
 *
 * Verificado el 19/09/2026 con una guía real:
 *   · A y B responden JSON y contestan en camelCase (numeroGuia, estadoActual,
 *     movimientos[].movimiento). El sobre de B sí es PascalCase (Results, Code).
 *   · C devuelve HTML con status 200 — la página de rastreo, no el servicio.
 *     Falla limpio y el combinador la ignora. Se deja porque puede volver, y
 *     mientras tanto no cuesta: revienta antes de parsear.
 * Exactamente por esto se consultan los tres: hoy dos de tres alcanzan.
 */

const EP_A = 'https://mobile.servientrega.com/Services/ShipmentTracking/api/envio';
const EP_B = 'https://mobile.servientrega.com/Services/ShipmentTracking/api/ControlRastreovalidaciones';
const EP_C = 'https://web.servientrega.com/RastreoEnvios/RastreoEnviosAjax.asmx/RastreoEnvio';

const REF_MOBILE = 'https://mobile.servientrega.com/WebSitePortal/RastreoEnvioDetalle.html';
const ORG_MOBILE = 'https://mobile.servientrega.com';
const REF_WEB = 'https://web.servientrega.com/RastreoEnvios/RastreoEnvioDetalle.html';
const ORG_WEB = 'https://web.servientrega.com';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const SIN_ESTADO = 'Sin información';
const TIMEOUT_MS = 14000;

/** Guías de Servientrega: numéricas. El rango es ancho a propósito. */
const RE_GUIA = /^\d{6,30}$/;

/**
 * Quita espacios, guiones y puntos de lo que escribió el usuario.
 * Devuelve null si no queda una guía con formato válido.
 */
function normalizarGuia(entrada) {
  const limpia = String(entrada || '').replace(/[\s.\-]/g, '');
  return RE_GUIA.test(limpia) ? limpia : null;
}

/* ──────────────────────────────  Consulta  ───────────────────────────── */

/**
 * Consulta una guía. Nunca lanza: todo fallo vuelve como
 * { encontrado: false, motivo, mensaje }, así quien llama solo ramifica en
 * `encontrado`.
 */
async function rastrear(guiaCruda, opciones = {}) {
  const guia = normalizarGuia(guiaCruda);
  if (!guia) {
    return {
      encontrado: false,
      motivo: 'guia_invalida',
      mensaje: 'El número de guía debe tener entre 6 y 30 dígitos.',
    };
  }

  const ac = new AbortController();
  const abortar = () => ac.abort();
  if (opciones.signal) opciones.signal.addEventListener('abort', abortar, { once: true });

  let expiro = false;
  const reloj = setTimeout(() => { expiro = true; ac.abort(); }, opciones.timeoutMs || TIMEOUT_MS);

  try {
    const envio = await mejorDe([
      estrategiaA(guia, ac.signal),
      estrategiaB(guia, ac.signal),
      estrategiaC(guia, ac.signal),
    ]);

    if (envio) return envio;

    return expiro
      ? { encontrado: false, motivo: 'timeout', mensaje: 'La consulta tardó demasiado. Intenta de nuevo en un momento.' }
      : { encontrado: false, motivo: 'no_encontrada', mensaje: 'No encontramos esa guía. Verifica el número e intenta de nuevo.' };
  } catch {
    return {
      encontrado: false,
      motivo: 'upstream_error',
      mensaje: 'El rastreo de Servientrega no está disponible. Intenta más tarde.',
    };
  } finally {
    clearTimeout(reloj);
    /* Cancela las estrategias perdedoras: sin esto queda una conexión colgando
       por cada consulta. */
    ac.abort();
    if (opciones.signal) opciones.signal.removeEventListener('abort', abortar);
  }
}

/**
 * Corre las tres y devuelve la MEJOR, no la primera.
 *
 * `Promise.any` resolvería con la primera que cumple, y B puede contestar
 * rápido con un sobre válido pero sin datos: sería un "éxito" vacío. Aquí, si
 * llega un resultado con movimientos se corta de una vez; si no, se espera a
 * todas y gana la de mayor puntaje.
 */
function mejorDe(tareas) {
  return new Promise((resolver) => {
    const logrados = [];
    let pendientes = tareas.length;
    let listo = false;

    const cerrar = (v) => {
      if (listo) return;
      listo = true;
      resolver(v);
    };

    if (pendientes === 0) return cerrar(null);

    for (const tarea of tareas) {
      tarea.then(
        (r) => {
          if (r) {
            logrados.push(r);
            if (r.movimientos.length > 0) cerrar(r);   // ya no hay nada mejor que esperar
          }
        },
        () => { /* una estrategia caída no invalida a las otras */ },
      ).then(() => {
        if (--pendientes === 0) {
          logrados.sort((a, b) => puntaje(b) - puntaje(a));
          cerrar(logrados[0] || null);
        }
      });
    }
  });
}

/** Más movimientos gana; a igualdad, el que trae estado y ruta. */
function puntaje(r) {
  return r.movimientos.length * 10
    + (r.estado !== SIN_ESTADO ? 5 : 0)
    + (r.origen ? 2 : 0)
    + (r.destino ? 2 : 0)
    + (r.fechaEnvio ? 1 : 0);
}

/* ────────────────────────────  Estrategias  ──────────────────────────── */

async function estrategiaA(guia, signal) {
  const r = await fetch(`${EP_A}/${guia}/1/es`, {
    headers: {
      'User-Agent': UA,
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'es-CO,es;q=0.9',
      Referer: REF_MOBILE,
    },
    signal,
  });
  if (!r.ok) throw new Error(`A ${r.status}`);
  return normalizar(await r.json(), guia, 'A');
}

async function estrategiaB(guia, signal) {
  const r = await fetch(EP_B, {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'es-CO,es;q=0.9',
      'Content-Type': 'application/json',
      Origin: ORG_MOBILE,
      Referer: REF_MOBILE,
    },
    /* Los tipos son los que manda la app: idpais numérico y los tres campos de
       validación como string "0" ("sin validación de identidad"). */
    body: JSON.stringify({
      numeroGuia: guia,
      idValidacionUsuario: '0',
      tipoDatoValidar: '0',
      datoRespuestaUsuario: '0',
      idpais: 1,
      lenguaje: 'es',
    }),
    signal,
  });
  if (!r.ok) throw new Error(`B ${r.status}`);

  // El sobre puede venir OK y traer un payload inútil: se valida el contenido.
  return normalizar(desenvolver(await r.json()), guia, 'B');
}

async function estrategiaC(guia, signal) {
  const r = await fetch(EP_C, {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      Accept: 'application/json, text/javascript, */*; q=0.01',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Origin: ORG_WEB,
      Referer: REF_WEB,
      'X-Requested-With': 'XMLHttpRequest',
    },
    // Aquí el parámetro se llama `guia`, no `numeroGuia`, y todo va como string.
    body: new URLSearchParams({
      guia,
      idValidacionUsuario: '0',
      tipoDatoValidar: '0',
      datoRespuestaUsuario: '0',
      idpais: '1',
      lenguaje: 'es',
    }).toString(),
    signal,
  });
  if (!r.ok) throw new Error(`C ${r.status}`);

  /* Hoy este endpoint contesta la página de rastreo en HTML con status 200. Se
     detecta antes de parsear para que el log diga "C devolvió HTML" y no un
     SyntaxError que parezca un error nuestro. */
  const cuerpo = await r.text();
  if (/^\s*</.test(cuerpo)) throw new Error('C devolvió HTML, no JSON');

  /* ASMX envuelve la respuesta en `d`, que a veces trae el JSON doblemente
     serializado (un string con JSON adentro). */
  const sobre = JSON.parse(cuerpo);
  const d = sobre && sobre.d !== undefined ? sobre.d : sobre;
  const payload = typeof d === 'string' ? JSON.parse(d) : d;
  return normalizar(desenvolver(payload), guia, 'C');
}

/** Si el payload trae Results[], el envío está en el primer elemento. */
function desenvolver(payload) {
  const results = pick(payload, 'Results');
  return Array.isArray(results) && results.length > 0 ? results[0] : payload;
}

/* ───────────────────────────  Normalización  ─────────────────────────── */

/**
 * Lleva cualquiera de las tres formas al mismo objeto.
 * Devuelve null si el payload no trae nada aprovechable, que es la defensa
 * central contra los "éxitos vacíos".
 */
function normalizar(data, guia, fuente) {
  if (!data || typeof data !== 'object') return null;

  const brutos = pick(data, 'movimientos');
  const crudos = Array.isArray(brutos) ? brutos : [];
  const estado = txt(pick(data, 'estadoActual', 'estado'));

  // Sin estado NI movimientos no aporta nada: que gane otra estrategia.
  if (!estado && crudos.length === 0) return null;

  const movimientos = crudos.map((m) => {
    const fecha = txt(pick(m, 'fecha', 'fechaMovimiento'));
    return {
      descripcion: txt(pick(m, 'movimiento', 'estado', 'descripcion')),
      fecha,
      fechaISO: aISO(fecha),
      ubicacion: txt(pick(m, 'ubicacion', 'ciudad', 'sede')),
    };
  }).filter((m) => m.descripcion || m.fecha);

  ordenarDescendente(movimientos);

  const estadoFinal = estado || SIN_ESTADO;

  return {
    encontrado: true,
    transportadora: 'servientrega',
    guia: txt(pick(data, 'numeroGuia', 'guia')) || guia,
    estado: estadoFinal,
    fase: clasificarEstado(estadoFinal),
    origen: txt(pick(pick(data, 'remitente'), 'ciudad')) || null,
    destino: txt(pick(pick(data, 'destinatario'), 'ciudad')) || null,
    fechaEnvio: txt(pick(data, 'fechaEnvio')) || null,
    fechaEntrega: txt(pick(data, 'fechaRealEntrega', 'fechaEntrega')) || null,
    movimientos,
    totalMovimientos: movimientos.length,
    fuente,
  };
}

/**
 * Del más reciente al más antiguo.
 *
 * Si ninguna fecha se pudo parsear no se inventa un orden: se invierte, porque
 * Servientrega entrega el historial ascendente. Ordenar por fecha en vez de
 * asumir el orden evita mostrar los cinco movimientos más viejos bajo el
 * rótulo "los últimos".
 */
function ordenarDescendente(movs) {
  const parseables = movs.filter((m) => m.fechaISO).length;
  if (parseables === 0) {
    movs.reverse();
    return;
  }
  movs.sort((a, b) => {
    if (!a.fechaISO) return 1;    // los no parseables, al final
    if (!b.fechaISO) return -1;
    return b.fechaISO.localeCompare(a.fechaISO);
  });
}

/**
 * Agrupa el texto libre del estado en una máquina de estados estable.
 *
 * Servientrega no expone códigos, solo frases en español que cambian de
 * redacción. Toda la fragilidad queda encerrada acá: la interfaz ramifica por
 * `fase`, nunca por `estado`.
 *
 * El orden importa: "entrega fallida" contiene "entrega".
 */
function clasificarEstado(estado) {
  const s = String(estado || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');   // sin tildes: "tránsito" → "transito"

  if (/devolu|rechaz|fallid|novedad|direccion errada|no reclamad|siniestr/.test(s)) return 'novedad';
  if (/entregad|recibid/.test(s)) return 'entregado';
  if (/reparto|distribuci|mensajero|ruta de entrega/.test(s)) return 'en_reparto';
  if (/transito|camino|transporte|despachad/.test(s)) return 'en_transito';
  if (/admitid|recogid|generad|preparacion|alistamiento/.test(s)) return 'admitido';
  return 'desconocido';
}

/* ────────────────────────────  Utilidades  ───────────────────────────── */

/**
 * Lee una propiedad sin importar mayúsculas y probando varios alias.
 *
 * Es la corrección clave: A responde camelCase, pero B y C salen de un
 * servicio .NET que puede serializar en PascalCase. Leer solo camelCase daba
 * resultados vacíos presentados como exitosos.
 */
function pick(obj, ...alias) {
  if (!obj || typeof obj !== 'object') return undefined;
  const mapa = {};
  for (const k of Object.keys(obj)) mapa[k.toLowerCase()] = obj[k];
  for (const a of alias) {
    const v = mapa[a.toLowerCase()];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
}

function txt(v) {
  if (typeof v === 'string') return v.trim();
  return v == null ? '' : String(v).trim();
}

/**
 * Las fechas de Servientrega a ISO-8601.
 *
 * Nunca `new Date(str)` con el formato local: JS lee "05/03/2026" como 3 de
 * mayo (MM/DD), no 5 de marzo. Acá se fuerza dd/MM/yyyy.
 *
 * Se interpreta como UTC a propósito: Servientrega opera en UTC-5 y no lo
 * declara, y fijar el huso hace que el ORDEN sea estable corra donde corra el
 * servidor. Para mostrar se usa siempre el string crudo.
 */
function aISO(crudo) {
  if (!crudo) return null;

  const m = crudo.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    const [, d, mes, a, h = '0', min = '0', seg = '0'] = m;
    const dt = new Date(Date.UTC(+a, +mes - 1, +d, +h, +min, +seg));
    return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
  }

  // El fallback solo cubre ISO-8601 explícito, que no es ambiguo.
  if (/^\d{4}-\d{2}-\d{2}/.test(crudo)) {
    const dt = new Date(crudo);
    return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
  }

  return null;
}

module.exports = {
  id: 'servientrega',
  nombre: 'Servientrega',
  reconoce: (guia) => !!normalizarGuia(guia),
  normalizarGuia,
  rastrear,
  clasificarEstado,
  // Expuestos para las pruebas: son las piezas donde se esconden los errores.
  _internos: { normalizar, ordenarDescendente, aISO, pick, mejorDe, desenvolver },
};
