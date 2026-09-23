/**
 * Prueba el Botón de Pagos de Bold: el cobro con tarjeta por enlace.
 *
 * Es lo que le faltaría al menú online. Hoy un domicilio se paga en efectivo o
 * por transferencia, y quien quiere pagar con tarjeta no puede.
 *
 * **Ojo con el hash.** La documentación de Bold enlaza a otra página para
 * explicar cómo se calcula y esa página no la tengo, así que la fórmula de
 * abajo es una suposición. No la des por buena: la prueba de verdad es abrir
 * la página que esto genera y ver si Bold acepta o reclama. Si reclama, se
 * cambia `firmar()` y nada más — por eso está aislada.
 *
 * **La llave secreta nunca sale de esta terminal.** El hash se calcula acá y
 * a la página solo le llega el resultado, que es exactamente como tendría que
 * funcionar en producción: el backend firma, el navegador solo muestra.
 *
 * Uso, en PowerShell (que es lo que hay en las máquinas de MenuBy):
 *   $env:BOLD_IDENTITY="..."; $env:BOLD_SECRET="..."; node scripts/probar-bold-link.js
 *
 * En bash sería `BOLD_IDENTITY=... node ...`, pero PowerShell no admite
 * prefijar variables a un comando y responde con un "no se reconoce como
 * nombre de un cmdlet" que no explica nada.
 *
 * Genera `bold-prueba.html`. Ábrelo en el navegador y dale al botón.
 */
const crypto = require('crypto');
const http = require('http');

/* Se sirve por http y no se abre del disco.
   Bold protege su checkout con `frame-ancestors *`, y ese `*` cubre solo
   esquemas de red. Un archivo abierto con doble clic es `file://`, que el
   navegador trata como origen unico: el iframe se bloquea y el boton no hace
   nada. Un servidor de doce lineas en localhost lo resuelve, y ademas se
   parece a como va a correr esto de verdad. */
const PUERTO = 5199;

const IDENTIDAD = process.env.BOLD_IDENTITY;
const SECRETA = process.env.BOLD_SECRET;

/* Mil pesos. Con llaves de pruebas no se mueve dinero, pero si alguien corre
   esto con las de producción por accidente, que la sorpresa sea barata. */
const MONTO = 1000;
const MONEDA = 'COP';

/* Que entorno es.
 *
 * Bold entrega las llaves de pruebas y las de produccion en la misma pantalla
 * del panel, una debajo de la otra, y por fuera se ven iguales: no hay prefijo
 * ni largo que las distinga. Un cobro de prueba con las de produccion es un
 * cobro de verdad contra la cuenta del cliente.
 *
 * Por eso hay que decirlo a mano. No se adivina. */
const ENTORNO = process.env.BOLD_ENTORNO;
const CONFIRMADO = process.argv.includes('--si-es-produccion');

if (ENTORNO !== 'pruebas' && ENTORNO !== 'produccion') {
  console.error('Falta decir que llaves son. No se puede adivinar:');
  console.error('  $env:BOLD_ENTORNO="pruebas"     <- las del ambiente de pruebas');
  console.error('  $env:BOLD_ENTORNO="produccion"  <- las reales, mueven dinero');
  process.exit(1);
}

if (ENTORNO === 'produccion' && !CONFIRMADO) {
  console.error('ALTO: son llaves de PRODUCCION.');
  console.error('');
  console.error('Esta pagina arma un cobro real contra la cuenta del comercio.');
  console.error('Si de verdad es lo que quieres, agrega  --si-es-produccion');
  console.error('');
  console.error('Para probar sin mover dinero, saca las llaves de pruebas del');
  console.error('panel: cada llave tiene su version de pruebas al lado.');
  process.exit(1);
}

if (!IDENTIDAD || !SECRETA) {
  console.error('Faltan llaves en el entorno.');
  console.error('  PowerShell:  $env:BOLD_IDENTITY="..."; $env:BOLD_SECRET="..."; node scripts/probar-bold-link.js');
  console.error('  bash:        BOLD_IDENTITY=... BOLD_SECRET=... node scripts/probar-bold-link.js');
  process.exit(1);
}

/**
 * El hash de integridad.
 *
 * Es lo único que no está verificado de este script. Bold lo usa para
 * comprobar que el monto no fue alterado entre tu servidor y su pasarela: sin
 * él, cualquiera con la consola del navegador abierta cambiaría un pedido de
 * $80.000 por uno de $1.000.
 *
 * Si Bold responde que la firma es inválida, lo que hay que mover es el orden
 * de estos cuatro valores, no el resto del archivo.
 */
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const hmac = (llave, s) => crypto.createHmac('sha256', llave).update(s).digest('hex');

function formulas({ orderId, amount, currency, secret }) {
  const d = `${orderId}${amount}${currency}`;
  return [
    { id: 'A', como: 'sha256(orden+monto+moneda+secreta)', firma: sha(`${d}${secret}`) },
    { id: 'B', como: 'sha256(secreta+orden+monto+moneda)', firma: sha(`${secret}${d}`) },
    { id: 'C', como: 'hmac-sha256(secreta, orden+monto+moneda)', firma: hmac(secret, d) },
    { id: 'D', como: 'sha256(orden+monto+moneda+secreta) en MAYUSCULA', firma: sha(`${d}${secret}`).toUpperCase() },
    { id: 'E', como: 'sha256 con separadores: orden|monto|moneda|secreta',
      firma: sha(`${orderId}|${amount}|${currency}|${secret}`) },
  ];
}

/* Cada formula lleva su propia orden: Bold rechaza una orden repetida, y sin
   esto el segundo boton fallaria por eso y no por la firma. */
const base = Date.now();
const intentos = formulas({ orderId: 'X', amount: MONTO, currency: MONEDA, secret: SECRETA })
  .map((f) => {
    const orderId = `MENUBY-${f.id}-${base}`;
    const [real] = formulas({ orderId, amount: MONTO, currency: MONEDA, secret: SECRETA })
      .filter((x) => x.id === f.id);
    return { ...real, orderId };
  });

/* Se imprime qué se firmó, con la secreta tapada: sin esto, depurar una firma
   rechazada es adivinar. */
console.log(`Monto ${MONTO} ${MONEDA} - secreta ...${SECRETA.slice(-4)}`);
for (const i of intentos) console.log(`  ${i.id}  ${i.como}`);

const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Prueba Bold · MenuBy</title>
  <script src="https://checkout.bold.co/library/boldPaymentButton.js"></script>
  <style>
    body { font-family: system-ui, sans-serif; background: #f8fafc; color: #0f172a;
           display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 16px; }
    .caja { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px;
            padding: 24px; max-width: 420px; width: 100%; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    p { font-size: 13.5px; color: #64748b; line-height: 1.5; margin: 0 0 16px; }
    dl { font-size: 12px; color: #475569; background: #f1f5f9; padding: 12px;
         border-radius: 10px; margin: 0 0 16px; }
    dt { font-weight: 700; } dd { margin: 0 0 8px; word-break: break-all; font-family: ui-monospace, monospace; }
    button { width: 100%; min-height: 44px; margin-bottom: 8px; border: 0; border-radius: 10px;
             background: #0f172a; color: #fff; font-size: 12.5px; font-weight: 700;
             cursor: pointer; padding: 8px 12px; text-align: left; }
    #estado { margin-top: 12px; font-size: 13px; font-weight: 600; min-height: 20px; }
  </style>
</head>
<body>
  <div class="caja">
    <h1>Prueba del Botón de Pagos</h1>
    <p>Cobro de $${MONTO.toLocaleString('es-CO')} con las llaves de pruebas.
       No uses datos reales de tarjeta.</p>

    <p>Cada botón usa una fórmula distinta para el hash de integridad.
       Pruébalos en orden hasta que uno pase de la pantalla de error.</p>

    ${intentos.map((i) => `
      <button class="intento" data-id="${i.id}">
        ${i.id} · ${i.como}
      </button>`).join('')}

    <div id="estado"></div>
  </div>

  <script>
    const estado = document.getElementById('estado');
    const decir = (t, color) => { estado.textContent = t; estado.style.color = color; };

    /* Si el script de Bold no cargó, el botón no hace nada y nadie sabe por
       qué. Mejor decirlo. */
    if (typeof BoldCheckout === 'undefined') {
      decir('No cargó el script de Bold. ¿Hay internet? ¿Algún bloqueador?', '#dc2626');
    }

    const INTENTOS = ${JSON.stringify(intentos.map((i) => ({ id: i.id, como: i.como, firma: i.firma, orderId: i.orderId })))};

    const intentar = (id) => {
      if (typeof BoldCheckout === 'undefined') return;
      const intento = INTENTOS.find((x) => x.id === id);
      try {
        const checkout = new BoldCheckout({
          orderId: intento.orderId,
          currency: ${JSON.stringify(MONEDA)},
          amount: ${JSON.stringify(String(MONTO))},
          apiKey: ${JSON.stringify(IDENTIDAD)},
          integritySignature: intento.firma,
          description: 'Prueba de integración MenuBy',
          // Sin url de retorno: Bold rechaza localhost y devuelve BTN-001,
          // que parece un fallo de firma y no lo es. En produccion va el
          // dominio https real.
          renderMode: 'embedded',
        });
        decir('Probando ' + id + ': ' + intento.como, '#0f172a');
        checkout.open();
      } catch (e) {
        decir('Error al abrir: ' + e.message, '#dc2626');
      }
    };
    for (const b of document.querySelectorAll('.intento')) {
      b.addEventListener('click', () => intentar(b.dataset.id));
    }
  </script>
</body>
</html>`;

http.createServer((req, res) => {
  /* Bold devuelve al cliente aca con el resultado en la URL. Imprimirlo es
     media prueba: dice que campos manda de vuelta, que es lo que el backend
     va a tener que leer. */
  if (req.url.startsWith('/vuelta')) {
    console.log('');
    console.log('<- Bold devolvio: ' + req.url);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end('<h2>Vuelta de Bold</h2><p>Mira la terminal: ahi quedaron los parametros.</p>');
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}).listen(PUERTO, () => {
  console.log('');
  console.log('Abre:  http://localhost:' + PUERTO);
  console.log('');
  console.log('Hay dos botones, y fallan por razones distintas:');
  console.log('  - Embebido    -> iframe. Es como iria en el menu de MenuBy.');
  console.log('  - Redirigido  -> se va a Bold y vuelve aca con el resultado.');
  console.log('');
  console.log('Que mirar:');
  console.log('  - Si abre la pasarela -> la firma sirve y armo el endpoint real.');
  console.log('  - Si reclama la firma -> cambio el orden en firmar(), nada mas.');
  console.log('  - Si reclama la llave -> es la de Boton de pagos, no la de API datafono.');
  console.log('');
  console.log('Ctrl+C para parar el servidor.');
});
