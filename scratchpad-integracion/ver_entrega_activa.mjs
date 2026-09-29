/**
 * Muestra las entregas que están AHORA en pedidos_activos/tiendas/<tienda>.
 * Sirve para ver el registro recién creado por "Solicitar Entrega"
 * (el contrato de creación). Solo LEE.
 *
 * Uso (PowerShell):
 *   $env:ACTIVOS_PASS='laclave'; node ver_entrega_activa.mjs correo@ejemplo.com
 *
 * Antes de compartir: tacha tu celular/dirección de prueba.
 */
const API_KEY = 'AIzaSyDqPIV52Sy9_uIg_qBnMtdizw1MfNtWyTo';
const DB = 'https://allco-uo9n52-default-rtdb.firebaseio.com';
const email = process.argv[2];
const password = process.env.ACTIVOS_PASS;
if (!email || !password) { console.error('Falta correo o ACTIVOS_PASS'); process.exit(1); }

const r0 = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password, returnSecureToken: true }),
});
const s = await r0.json();
if (!r0.ok) { console.error('Login falló:', s.error?.message); process.exit(1); }
const tiendaId = JSON.parse(Buffer.from(s.idToken.split('.')[1], 'base64').toString('utf8')).id_tienda;

const r = await fetch(`${DB}/pedidos_activos/tiendas/${tiendaId}.json?auth=${s.idToken}`);
const data = r.ok ? await r.json() : null;

if (!data || !Object.keys(data).length) {
  console.log('No hay entregas activas ahora (¿ya la tomó un repartidor o la cancelaste?).');
} else {
  for (const [k, v] of Object.entries(data)) {
    console.log(`\n═══ ENTREGA ACTIVA [${k}] (lo que escribió "Solicitar") ═══`);
    console.log(JSON.stringify(v, null, 2));
  }
}
