/**
 * Observa pedidos_activos/tiendas/<tienda> y, apenas aparece una entrega nueva,
 * imprime sus campos exactos. Sirve para ver QUÉ escribe la app al darle
 * "Solicitar Entrega" (el contrato de creación que necesitamos para MenuBy).
 *
 * SOLO LEE. No crea ni modifica nada — la entrega la creas TÚ desde la app.
 *
 * Uso (Node 18+, PowerShell):
 *   $env:ACTIVOS_PASS='laclave'; node capturar_creacion.mjs correo@ejemplo.com
 *
 * Luego, en la app de Activos, llena "Solicitar Entrega" con datos de PRUEBA
 * (nombre PRUEBA, tu celular, una dirección cualquiera) y dale Solicitar.
 * Apenas aparezca, este script la muestra. Cancélala enseguida en la app.
 * Corta con Ctrl+C cuando termines.
 */

const API_KEY = 'AIzaSyDqPIV52Sy9_uIg_qBnMtdizw1MfNtWyTo';
const DB = 'https://allco-uo9n52-default-rtdb.firebaseio.com';

const email = process.argv[2];
const password = process.env.ACTIVOS_PASS;
if (!email || !password) { console.error('Falta correo o ACTIVOS_PASS'); process.exit(1); }

async function login() {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const d = await r.json();
  if (!r.ok) { console.error('Login falló:', d.error?.message); process.exit(1); }
  const claims = JSON.parse(Buffer.from(d.idToken.split('.')[1], 'base64').toString('utf8'));
  return { idToken: d.idToken, tiendaId: claims.id_tienda };
}

const { idToken, tiendaId } = await login();
const RUTA = `pedidos_activos/tiendas/${tiendaId}`;
console.log(`👀 Observando ${RUTA}`);
console.log('   Ahora crea UNA entrega de prueba en la app (datos falsos) y dale Solicitar.\n');

const vistos = new Set();
let primeraVuelta = true;

async function ciclo() {
  try {
    const r = await fetch(`${DB}/${RUTA}.json?auth=${idToken}`);
    const data = r.ok ? await r.json() : null;
    for (const [k, v] of Object.entries(data || {})) {
      if (vistos.has(k)) continue;
      vistos.add(k);
      if (primeraVuelta) continue; // las que ya existían al arrancar no interesan
      console.log(`\n🆕 ENTREGA NUEVA [${k}] — campos que escribió la app al crear:\n`);
      console.log(JSON.stringify(v, null, 2));
      console.log('\n(recuerda cancelarla en la app; y tacha tus datos de prueba antes de compartir)');
    }
    primeraVuelta = false;
  } catch (e) { /* reintenta */ }
}

setInterval(ciclo, 1500);
ciclo();
