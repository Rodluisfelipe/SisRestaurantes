/**
 * Descubridor del esquema de la app de Activos (Firebase Realtime Database).
 * v2: apunta a las rutas reales sacadas del código de la app y busca el
 * tienda_id del restaurante.
 *
 * Uso (Node 18+):
 *   PowerShell:  $env:ACTIVOS_PASS='laclave'; node descubrir_activos.mjs correo@ejemplo.com
 *   Git Bash:    ACTIVOS_PASS='laclave' node descubrir_activos.mjs correo@ejemplo.com
 *
 * Solo LEE. No escribe ni crea nada.
 * Antes de compartir la salida: tacha datos reales de clientes (nombre,
 * teléfono, dirección). Solo importan los NOMBRES de los campos.
 */

const API_KEY = 'AIzaSyDqPIV52Sy9_uIg_qBnMtdizw1MfNtWyTo';
const DB = 'https://allco-uo9n52-default-rtdb.firebaseio.com';

const email = process.argv[2];
const password = process.env.ACTIVOS_PASS;
if (!email || !password) {
  console.error('Uso: ACTIVOS_PASS="laclave" node descubrir_activos.mjs correo@ejemplo.com');
  process.exit(1);
}

async function iniciarSesion() {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const d = await r.json();
  if (!r.ok) { console.error('Login falló:', d.error?.message || JSON.stringify(d)); process.exit(1); }
  return { idToken: d.idToken, uid: d.localId };
}

async function leer(path, { shallow = false } = {}) {
  const q = shallow ? '&shallow=true' : '';
  const r = await fetch(`${DB}/${path}.json?auth=${idToken}${q}`);
  if (r.status === 401 || r.status === 403) return { __ok: false, __estado: 'sin permiso' };
  if (!r.ok) return { __ok: false, __estado: `HTTP ${r.status}` };
  return { __ok: true, valor: await r.json() };
}

function resumen(v) {
  if (v === null) return '(vacío)';
  if (typeof v !== 'object') return JSON.stringify(v);
  const t = JSON.stringify(v, null, 2);
  return t.length > 1800 ? t.slice(0, 1800) + '\n    …(recortado)' : t;
}

const { idToken, uid } = await iniciarSesion();
console.log('✅ Sesión iniciada. UID:', uid, '\n');

// ── 0. Datos dentro del token (aquí suele venir el tienda_id / rol) ──
console.log('═══ DATOS DEL TOKEN (claims) ═══');
let claimTienda = null;
try {
  const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64').toString('utf8'));
  const ignorar = new Set(['iss', 'aud', 'auth_time', 'iat', 'exp', 'sub', 'user_id', 'firebase', 'email_verified']);
  for (const [k, v] of Object.entries(payload)) {
    if (ignorar.has(k)) continue;
    console.log(`  ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`);
    if (/tienda|store|local|rest|suc/i.test(k)) claimTienda = claimTienda || v;
  }
  if (claimTienda) console.log('\n🏷️  posible tienda_id en el token:', claimTienda);
} catch (e) { console.log('  (no se pudo leer el token)'); }
console.log('');

// ── 1. Perfil del restaurante (para encontrar su tienda_id) ──
const PERFIL = ['restaurante', 'restaurantes', 'tienda', 'tiendas', 'perfil', 'perfiles', 'usuarios', 'restaurante_app']
  .map((n) => `${n}/${uid}`);
let tiendaId = null;
console.log('═══ PERFIL / IDENTIDAD ═══');
for (const path of PERFIL) {
  const res = await leer(path);
  if (!res.__ok || res.valor == null) continue;
  console.log(`\n▶ ${path}`);
  console.log('   ', resumen(res.valor));
  const v = res.valor;
  tiendaId = tiendaId || v.tienda_id || v.id_tienda || v.idTienda || v.tienda_activa_id || v.sucursal_activa_id || v.tiendaId;
}
tiendaId = tiendaId || claimTienda;
if (tiendaId) console.log('\n🏷️  tienda_id:', tiendaId);
else console.log('\n(sin tienda_id aún; se probará con el UID)');

// ── 2. Entregas / pedidos, con cada id posible ──
const IDS = [...new Set([tiendaId, uid].filter(Boolean))];
const RUTAS = [];
for (const id of IDS) {
  RUTAS.push(
    `pedidos_activos/tiendas/${id}`,
    `pedidos_finalizados_hoy/tiendas/${id}`,
    `Documento_entregas/${id}`,
    `Entregas/${id}`,
    `entregas/${id}`,
    `calificacion_a_repartidores/${id}`,
    `tienda_fcm_token/${id}`,
  );
}
// nodos raíz (por si son legibles superficialmente)
const RAIZ = ['pedidos_activos/tiendas', 'pedidos_finalizados_hoy/tiendas', 'Documento_entregas', 'Entregas', 'entregas_rurales_pendientes', 'admin_config/parametros', 'app_config'];

console.log('\n\n═══ ENTREGAS / PEDIDOS ═══');
for (const path of RUTAS) {
  const res = await leer(path);
  if (!res.__ok) continue;
  if (res.valor == null) { console.log(`\n▶ ${path}  → existe pero vacío`); continue; }
  console.log(`\n▶ ${path}`);
  // si es un mapa de entregas, mostrar solo la primera como ejemplo
  const v = res.valor;
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const k = Object.keys(v)[0];
    const ej = v[k];
    console.log(`   (${Object.keys(v).length} elementos) CAMPOS de una entrega [${k}]:`);
    if (ej && typeof ej === 'object') {
      // Solo los nombres de los campos y su tipo (sin valores → sin datos de clientes)
      for (const [campo, val] of Object.entries(ej)) {
        const tipo = val === null ? 'null' : Array.isArray(val) ? 'lista' : typeof val === 'object' ? `objeto{${Object.keys(val).join(',')}}` : typeof val;
        console.log(`      ${campo}: ${tipo}`);
      }
    } else {
      console.log('   ', resumen(ej));
    }
  } else {
    console.log('   ', resumen(v));
  }
}

console.log('\n\n═══ NODOS RAÍZ (superficial) ═══');
for (const path of RAIZ) {
  const res = await leer(path, { shallow: true });
  console.log(`  ${path}  → ${res.__ok ? (res.valor == null ? 'vacío' : 'LEGIBLE: ' + Object.keys(res.valor).slice(0, 5).join(', ') + '…') : res.__estado}`);
}

console.log('\n\nListo. Tacha datos reales de clientes y compárteme la salida.');
