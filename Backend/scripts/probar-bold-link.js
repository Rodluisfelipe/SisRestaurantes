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
const fs = require('fs');
const path = require('path');

const IDENTIDAD = process.env.BOLD_IDENTITY;
const SECRETA = process.env.BOLD_SECRET;

/* Mil pesos. Con llaves de pruebas no se mueve dinero, pero si alguien corre
   esto con las de producción por accidente, que la sorpresa sea barata. */
const MONTO = 1000;
const MONEDA = 'COP';

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
function firmar({ orderId, amount, currency, secret }) {
  const cadena = `${orderId}${amount}${currency}${secret}`;
  return crypto.createHash('sha256').update(cadena).digest('hex');
}

const orderId = `MENUBY-PRUEBA-${Date.now()}`;
const hash = firmar({ orderId, amount: MONTO, currency: MONEDA, secret: SECRETA });

/* Se imprime qué se firmó, con la secreta tapada: sin esto, depurar una firma
   rechazada es adivinar. */
console.log('Datos de la venta');
console.log(`  orderId   ${orderId}`);
console.log(`  amount    ${MONTO}`);
console.log(`  currency  ${MONEDA}`);
console.log(`  cadena    ${orderId}${MONTO}${MONEDA}<secreta …${SECRETA.slice(-4)}>`);
console.log(`  sha256    ${hash}`);

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
    button { width: 100%; height: 48px; border: 0; border-radius: 12px; background: #0f172a;
             color: #fff; font-size: 15px; font-weight: 800; cursor: pointer; }
    #estado { margin-top: 12px; font-size: 13px; font-weight: 600; min-height: 20px; }
  </style>
</head>
<body>
  <div class="caja">
    <h1>Prueba del Botón de Pagos</h1>
    <p>Cobro de $${MONTO.toLocaleString('es-CO')} con las llaves de pruebas.
       No uses datos reales de tarjeta.</p>

    <dl>
      <dt>orderId</dt><dd>${orderId}</dd>
      <dt>hash</dt><dd>${hash}</dd>
    </dl>

    <button id="pagar">Pagar $${MONTO.toLocaleString('es-CO')}</button>
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

    document.getElementById('pagar').addEventListener('click', () => {
      if (typeof BoldCheckout === 'undefined') return;
      try {
        const checkout = new BoldCheckout({
          orderId: ${JSON.stringify(orderId)},
          currency: ${JSON.stringify(MONEDA)},
          amount: ${JSON.stringify(String(MONTO))},
          apiKey: ${JSON.stringify(IDENTIDAD)},
          integritySignature: ${JSON.stringify(hash)},
          description: 'Prueba de integración MenuBy',
          renderMode: 'embedded',
        });
        decir('Abriendo la pasarela…', '#0f172a');
        checkout.open();
      } catch (e) {
        decir('Error al abrir: ' + e.message, '#dc2626');
      }
    });
  </script>
</body>
</html>`;

const destino = path.join(process.cwd(), 'bold-prueba.html');
fs.writeFileSync(destino, html, 'utf8');

console.log(`\nGenerado: ${destino}`);
console.log('Ábrelo en el navegador y dale a "Pagar".');
console.log('\nQué mirar:');
console.log('  · Si abre la pasarela → la firma sirve, y con eso se puede armar el endpoint real.');
console.log('  · Si reclama la firma → hay que cambiar el orden en firmar(), nada más.');
console.log('  · Si reclama la llave → es la de "Botón de pagos", no la de "API datáfono".');
