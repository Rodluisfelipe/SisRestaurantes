/**
 * La configuración de una terminal, saneada.
 *
 * Todo lo que llega de aquí termina dentro de una caja registradora que cobra
 * dinero, habla con una impresora térmica y calcula impuestos. Un número fuera
 * de rango no es un detalle estético: un tiempo de auto-bloqueo de cero segundos
 * deja la caja pidiendo PIN cada instante, y un régimen fiscal inventado deja al
 * negocio declarando mal.
 *
 * Por eso aquí no se confía en nada de lo que manda el panel. Cada campo se
 * acota a lo que tiene sentido en un mostrador, y lo que no se entiende se
 * reemplaza por el valor por defecto en vez de rechazar el guardado entero:
 * que el dueño no pueda guardar nada porque se equivocó en un campo sería peor
 * que ignorar ese campo.
 */

/** Lo que trae una caja recién vinculada. Funciona sin configurar nada. */
const POR_DEFECTO = {
  autoBloqueoSegundos: 90,
  sonidoActivo: true,
  propinaEnMesas: true,
  propinaSugerida: 10,
  fiscal: {
    impuestosActivos: true,
    regimenPrincipal: 'INC_8',
    categoriasIva: [],
    categoriasExentas: [],
    textoPieFactura: '',
  },
  hardware: {
    impresoraCaja: { tipo: 'NINGUNA', host: '', puerto: 9100, com: '', baudios: 9600, anchoMm: 80 },
    impresoraCocina: { tipo: 'NINGUNA', host: '', puerto: 9100, com: '', baudios: 9600, anchoMm: 80 },
    datafono: { tipo: 'MANUAL', host: '', puerto: 9100, esperaSegundos: 60 },
    cajon: { abrirAlCobrarEfectivo: true },
    pantallaCliente: { mostrarQr: false, plantillaQr: '' },
  },
};

const REGIMENES = ['INC_8', 'IVA_19', 'NO_RESPONSABLE'];
const CONEXIONES = ['NINGUNA', 'RED', 'SERIAL'];

const entero = (valor, defecto, min, max) => {
  const n = Math.round(Number(valor));
  if (!Number.isFinite(n)) return defecto;
  return Math.min(max, Math.max(min, n));
};

const booleano = (valor, defecto) => (typeof valor === 'boolean' ? valor : defecto);

const texto = (valor, defecto, largo) =>
  typeof valor === 'string' ? valor.trim().slice(0, largo) : defecto;

/** Una lista de categorías, sin vacíos ni repetidas. */
const categorias = (valor) => {
  if (!Array.isArray(valor)) return [];
  const limpias = valor
    .map((c) => String(c || '').trim().toLowerCase().slice(0, 60))
    .filter(Boolean);
  return [...new Set(limpias)].slice(0, 40);
};

function impresora(dada, defecto) {
  const d = dada && typeof dada === 'object' ? dada : {};
  const tipo = CONEXIONES.includes(d.tipo) ? d.tipo : defecto.tipo;

  return {
    tipo,
    host: texto(d.host, defecto.host, 60),
    puerto: entero(d.puerto, defecto.puerto, 1, 65535),
    com: texto(d.com, defecto.com, 20),
    baudios: entero(d.baudios, defecto.baudios, 1200, 921600),
    // 58 u 80 y nada más: son los dos anchos de papel que existen.
    anchoMm: d.anchoMm === 58 ? 58 : 80,
  };
}

/**
 * Completa lo que falte con los valores por defecto.
 *
 * Una caja vinculada antes de que existiera este bloque no tiene `config`, y
 * el panel se encontraría con `undefined` en cada campo.
 */
function conDefectos(config) {
  return validarConfig(config).config;
}

/**
 * Sanea la configuración que manda el panel.
 *
 * Devuelve siempre algo usable. El único caso que se rechaza es que el cuerpo
 * no sea un objeto: ahí no hay nada que sanear y es señal de una petición mal
 * formada, no de un campo mal puesto.
 */
function validarConfig(config) {
  if (config !== undefined && config !== null && typeof config !== 'object') {
    return { ok: false, error: 'La configuración no es válida' };
  }

  const c = config || {};
  const fiscal = c.fiscal && typeof c.fiscal === 'object' ? c.fiscal : {};
  const hw = c.hardware && typeof c.hardware === 'object' ? c.hardware : {};
  const datafono = hw.datafono && typeof hw.datafono === 'object' ? hw.datafono : {};
  const cajon = hw.cajon && typeof hw.cajon === 'object' ? hw.cajon : {};
  const pantalla = hw.pantallaCliente && typeof hw.pantallaCliente === 'object' ? hw.pantallaCliente : {};

  return {
    ok: true,
    config: {
      /* Entre 30 y 300 segundos. Menos de 30 sería pedir el PIN mientras el
         cajero cobra; más de 300 es dejar la caja abierta media hora con el
         usuario de alguien que se fue a almorzar. */
      autoBloqueoSegundos: entero(c.autoBloqueoSegundos, 90, 30, 300),
      sonidoActivo: booleano(c.sonidoActivo, true),
      propinaEnMesas: booleano(c.propinaEnMesas, true),
      propinaSugerida: entero(c.propinaSugerida, 10, 0, 50),

      fiscal: {
        impuestosActivos: booleano(fiscal.impuestosActivos, true),
        regimenPrincipal: REGIMENES.includes(fiscal.regimenPrincipal)
          ? fiscal.regimenPrincipal
          : 'INC_8',
        categoriasIva: categorias(fiscal.categoriasIva),
        categoriasExentas: categorias(fiscal.categoriasExentas),
        textoPieFactura: texto(fiscal.textoPieFactura, '', 300),
      },

      hardware: {
        impresoraCaja: impresora(hw.impresoraCaja, POR_DEFECTO.hardware.impresoraCaja),
        impresoraCocina: impresora(hw.impresoraCocina, POR_DEFECTO.hardware.impresoraCocina),
        datafono: {
          tipo: datafono.tipo === 'RED' ? 'RED' : 'MANUAL',
          host: texto(datafono.host, '', 60),
          puerto: entero(datafono.puerto, 9100, 1, 65535),
          /* 5 a 180 segundos: menos no le alcanza a nadie para pasar la
             tarjeta y digitar la clave; más deja la caja esperando un aparato
             que ya se colgó, sin poder cobrarle al siguiente. */
          esperaSegundos: entero(datafono.esperaSegundos, 60, 5, 180),
        },
        cajon: {
          abrirAlCobrarEfectivo: booleano(cajon.abrirAlCobrarEfectivo, true),
        },
        pantallaCliente: {
          mostrarQr: booleano(pantalla.mostrarQr, false),
          plantillaQr: texto(pantalla.plantillaQr, '', 500),
        },
      },
    },
  };
}

module.exports = { conDefectos, validarConfig, POR_DEFECTO };
