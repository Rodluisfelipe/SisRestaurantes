/**
 * Conector MenuBy ↔ Activos (BORRADOR de referencia — no conectar a producción
 * hasta confirmar con Activos el contrato de creación y tener credenciales de
 * servicio; ver ESQUEMA_ACTIVOS.md §5).
 *
 * Qué hace hoy, sin riesgo:
 *   - iniciar sesión y refrescar el token (Firebase Auth correo/clave)
 *   - LEER el estado de una entrega y traducirlo al lenguaje de MenuBy
 *   - traer las entregas en curso / finalizadas de la tienda
 *
 * Qué NO hace todavía (a propósito):
 *   - crear una entrega: crearla despacha un repartidor real. La función queda
 *     como plantilla marcada, para activar solo con el visto bueno de Activos.
 */

const API_KEY = 'AIzaSyDqPIV52Sy9_uIg_qBnMtdizw1MfNtWyTo';
const DB = 'https://allco-uo9n52-default-rtdb.firebaseio.com';

// ── Sesión (token que se refresca solo) ─────────────────────────────────────
export function crearSesionActivos({ email, password }) {
  let idToken = null, refreshToken = null, venceEn = 0;

  async function login() {
    const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error('Activos login: ' + (d.error?.message || r.status));
    idToken = d.idToken; refreshToken = d.refreshToken; venceEn = Date.now() + (Number(d.expiresIn) - 60) * 1000;
    const claims = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64').toString('utf8'));
    return { uid: d.localId, tiendaId: claims.id_tienda, role: claims.role };
  }

  async function refrescar() {
    const r = await fetch(`https://securetoken.googleapis.com/v1/token?key=${API_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=refresh_token&refresh_token=${refreshToken}`,
    });
    const d = await r.json();
    if (!r.ok) throw new Error('Activos refresh: ' + (d.error?.message || r.status));
    idToken = d.id_token; refreshToken = d.refresh_token; venceEn = Date.now() + (Number(d.expires_in) - 60) * 1000;
  }

  async function token() {
    if (!idToken) return (await login(), idToken);
    if (Date.now() >= venceEn) await refrescar();
    return idToken;
  }

  return { login, token };
}

// ── Lectura de la base ───────────────────────────────────────────────────────
async function rtdbGet(sesion, path) {
  const r = await fetch(`${DB}/${path}.json?auth=${await sesion.token()}`);
  if (!r.ok) throw new Error(`Activos GET ${path}: ${r.status}`);
  return r.json();
}

/** Traduce las banderas de Activos a un estado único para MenuBy. */
export function estadoMenuBy(e) {
  if (!e) return 'desconocido';
  if (e.hora_finalizacion) return 'entregado';
  if (e.asignacion_fallida) return 'sin_repartidor';
  if (e.entrega_lista || e.pedido_listo_notificado) return 'recogido';   // salió del local
  if (e.llegada_tienda_at) return 'repartidor_en_local';
  if (e.comenzar_ruta) return 'repartidor_en_camino';
  if (e.esta_asignado_entrega && e.id_repartidor) return 'asignado';
  return 'buscando_repartidor';
}

/** Estado + datos útiles de una entrega concreta. */
export async function estadoDeEntrega(sesion, tiendaId, entregaId) {
  const activa = await rtdbGet(sesion, `pedidos_activos/tiendas/${tiendaId}/${entregaId}`);
  const e = activa || await rtdbGet(sesion, `pedidos_finalizados_hoy/tiendas/${tiendaId}/${entregaId}`);
  if (!e) return { estado: 'desconocido' };
  return {
    estado: estadoMenuBy(e),
    repartidor: e.nombre_repartidor || null,
    ubicacionRepartidor: e.ubicacion_repartidor || null,
    fotoEvidencia: e.foto_evidencia || null,
    distanciaKm: e.distancia_km ?? null,
    idEntrega: e.ID_entrega ?? null,
  };
}

/** Sondea el estado cada `ms` y avisa cuando cambia. Devuelve una función para parar. */
export function escucharEntrega(sesion, tiendaId, entregaId, onCambio, ms = 8000) {
  let anterior = null, vivo = true;
  (async function bucle() {
    while (vivo) {
      try {
        const s = await estadoDeEntrega(sesion, tiendaId, entregaId);
        if (s.estado !== anterior) { anterior = s.estado; onCambio(s); }
        if (s.estado === 'entregado' || s.estado === 'sin_repartidor') break;
      } catch (err) { /* reintentar en el próximo ciclo */ }
      await new Promise((r) => setTimeout(r, ms));
    }
  })();
  return () => { vivo = false; };
}

// ── Crear entrega (PLANTILLA — NO ACTIVAR sin Activos) ───────────────────────
/**
 * Construye el cuerpo de una entrega desde un pedido de MenuBy.
 * OJO: el registro que conocemos es uno TERMINADO; los campos mínimos de
 * creación los debe confirmar Activos. Esto es un borrador para revisar CON
 * ellos, no para escribir en su base todavía.
 */
export function construirEntregaDesdePedido(pedido, tienda) {
  return {
    // Identidad de la tienda (de la ficha de Go Burger en Activos)
    id_tienda: Number(tienda.id),             // 115
    ID_restaurante: Number(tienda.id),
    id_restaurante: String(tienda.id),
    nombre_tienda: tienda.nombre,
    nombre_restaurante: tienda.nombre,
    telefono_tienda: String(tienda.telefono || ''),
    ubicacion_restaurante: tienda.ubicacion,  // { lat, lng }
    owner_uid: tienda.uid,
    id_cuenta_firebase_app: tienda.uid,

    // Lo del formulario "Solicitar Entrega", desde el pedido de MenuBy
    nombre_cliene: pedido.customerName,        // (sic) typo de su base
    telefono_cliente: Number(String(pedido.phone).replace(/\D/g, '')),
    descripcion_direccion: (pedido.address || '').slice(0, 70),
    descripcion_cliente: pedido.addressDetail || '',
    ubicacion_cliente: pedido.address || '',
    destino_ubicacion: pedido.coords,          // { lat, lng }
    ciudad: pedido.city || '',
    estado_pago: pedido.pagado ? 'No cobrar al cliente' : 'Cobrar al cliente',
    tiempo_preparacion: String(pedido.minutosPreparacion ?? 15),
    metodo_pago: '',
  };
  // NOTA: Activos completa el resto (ID_entrega, repartidor, comisión, tiempos).
  // Confirmar con ellos si el "motor" exige algún campo más al crear.
}

/**
 * Crea la entrega en Activos (escribe en pedidos_activos/tiendas/<id>).
 *
 * ⚠️ Esto DESPACHA UN REPARTIDOR REAL. No llamar en pruebas contra la tienda
 * de producción: pedir a Activos una TIENDA DE PRUEBA. Va con una traba: solo
 * escribe si se pasa { confirmar: true }, para no dispararlo por accidente.
 */
export async function crearEntrega(sesion, tiendaId, cuerpo, { confirmar = false } = {}) {
  if (!confirmar) throw new Error('crearEntrega: falta { confirmar: true } (esto despacha un repartidor real)');
  const r = await fetch(`${DB}/pedidos_activos/tiendas/${tiendaId}.json?auth=${await sesion.token()}`, {
    method: 'POST',                             // POST = push con id automático
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...cuerpo, creado_por: 'menuby', last_updated: Date.now() }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error('Activos crearEntrega: ' + (d.error || r.status));
  return d.name;                               // pushId = entrega_id
}
