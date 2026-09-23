/**
 * Sondea la API de datáfonos de Bold antes de construir sobre ella.
 *
 * Existe por una razón concreta: la documentación de Bold se contradice consigo
 * misma. La tabla de campos dice `amount.total` y `amount.tip`; el ejemplo de
 * JSON, en la misma página, dice `total_amount` y `tip_amount`. Uno de los dos
 * está mal, y descubrir cuál escribiendo la integración completa cuesta una
 * tarde de errores 400 sin entender por qué.
 *
 * Así que esto manda las dos formas y deja que el servidor decida. Lo que
 * conteste es la verdad; lo que diga la documentación es una opinión.
 *
 * **La llave nunca se escribe acá ni en el repo.** Se lee del entorno y solo se
 * imprimen sus últimos cuatro caracteres, lo justo para saber cuál se está
 * usando cuando uno tiene la de pruebas y la de producción abiertas.
 *
 * Uso, en PowerShell (que es lo que hay en las máquinas de MenuBy):
 *   $env:BOLD_API_KEY="..."; node scripts/probar-bold.js            (solo consulta)
 *   $env:BOLD_API_KEY="..."; node scripts/probar-bold.js --cobrar   (cobro real)
 *
 * En bash el prefijo `BOLD_API_KEY=... node ...` funciona; en PowerShell no,
 * y el error que da no dice por qué.
 *
 * Con `--cobrar` el datáfono suena. Úsalo con la llave de PRUEBAS.
 */
const BASE = 'https://integrations.api.bold.co';

const LLAVE = process.env.BOLD_API_KEY;
const COBRAR = process.argv.includes('--cobrar');

/* Mil pesos. Es un cobro de prueba: si por accidente corre contra la llave de
   producción, que la sorpresa sea barata. */
const MONTO = 1000;

if (!LLAVE) {
  console.error('Falta BOLD_API_KEY en el entorno.');
  console.error('  PowerShell:  $env:BOLD_API_KEY="tu_llave"; node scripts/probar-bold.js');
  console.error('  bash:        BOLD_API_KEY=tu_llave node scripts/probar-bold.js');
  process.exit(1);
}

const cabeceras = {
  Authorization: `x-api-key ${LLAVE}`,
  'Content-Type': 'application/json',
};

async function pedir(metodo, ruta, cuerpo) {
  const res = await fetch(`${BASE}${ruta}`, {
    method: metodo,
    headers: cabeceras,
    ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}),
  });
  const texto = await res.text();
  let datos = null;
  try { datos = JSON.parse(texto); } catch { /* algunos errores no vienen en JSON */ }
  return { estado: res.status, datos, texto };
}

/**
 * Saca un campo venga o no envuelto en `payload`.
 *
 * La documentación promete `{ payload: {...}, errors: [] }` para todo. En la
 * práctica `/payment-methods` contesta el objeto pelado y `/binded-terminals`
 * sí lo envuelve. Leer solo `payload` hacía ver como "ninguno" una cuenta que
 * tiene los cuatro métodos activos.
 */
function sacar(datos, campo) {
  return datos?.payload?.[campo] ?? datos?.[campo];
}

/** Las dos formas que la documentación propone para el monto. */
const FORMAS = {
  'como el EJEMPLO (total_amount / tip_amount)': {
    currency: 'COP',
    taxes: [{ type: 'CONSUMPTION', value: Math.round(MONTO * 0.08 / 1.08) }],
    tip_amount: 0,
    total_amount: MONTO,
  },
  'como la TABLA (total / tip)': {
    currency: 'COP',
    taxes: [{ type: 'CONSUMPTION', value: Math.round(MONTO * 0.08 / 1.08) }],
    tip: 0,
    total: MONTO,
  },
};

(async () => {
  console.log(`Llave …${LLAVE.slice(-4)}  ·  ${BASE}\n`);

  /* ── 1. Métodos de pago ────────────────────────────────────────────── */
  console.log('1) Métodos de pago habilitados');
  const metodos = await pedir('GET', '/payments/payment-methods');
  if (metodos.estado !== 200) {
    console.error(`   FALLÓ (HTTP ${metodos.estado}): ${metodos.texto.slice(0, 200)}`);
    console.error('   Si es 401/403, la llave no es la de "API datáfono" o no está activa.');
    process.exitCode = 1;
    return;
  }
  const habilitados = sacar(metodos.datos, 'payment_methods') || [];
  if (habilitados.length === 0) {
    /* Distinguir "la llave no sirve" de "la llave sirve pero no hay nada
       configurado" es la mitad del valor de este script. */
    console.log('   NINGUNO. La llave autentica (HTTP 200) pero la cuenta no');
    console.log('   tiene métodos habilitados para API Integrations.');
    console.log(`   Respuesta cruda: ${metodos.texto.slice(0, 200)}`);
  }
  for (const m of habilitados) {
    console.log(`   ${m.enabled ? '✓' : '·'} ${m.name}`);
  }

  /* ── 2. Datáfonos vinculados ───────────────────────────────────────── */
  console.log('\n2) Datáfonos vinculados');
  const terminales = await pedir('GET', '/payments/binded-terminals');
  const lista = sacar(terminales.datos, 'available_terminals') || [];
  /* Un 404 acá no es un error de integración: es Bold diciendo que la cuenta
     no tiene datáfonos vinculados. Tratarlo como fallo manda a buscar un
     problema de código donde lo que falta es configuración. */
  if (terminales.estado !== 200 && terminales.estado !== 404) {
    console.error(`   FALLÓ (HTTP ${terminales.estado}): ${terminales.texto.slice(0, 200)}`);
    process.exitCode = 1;
    return;
  }
  if (lista.length === 0) {
    console.log('   NINGUNO.');
    console.log('   Hay que habilitarlos en la app de Bold:');
    console.log('   Mi perfil › Preferencias de cobro › Conexiones API.');
    console.log('   Sin al menos uno no se puede crear un cobro.');
  }
  for (const t of lista) {
    console.log(`   ${t.terminal_model}  serial ${t.terminal_serial}  ${t.status}  (${t.name})`);
  }

  if (!COBRAR) {
    console.log('\nSolo consulta. Para probar un cobro de $1.000: --cobrar');
    return;
  }
  if (lista.length === 0) {
    console.log('\nNo hay datáfono al que mandarle el cobro.');
    return;
  }

  /* ── 3. Cuál forma del monto acepta ────────────────────────────────── */
  const terminal = lista[0];
  console.log(`\n3) Creando cobro de $${MONTO.toLocaleString('es-CO')} en ${terminal.terminal_serial}`);
  console.log('   Se prueban las dos formas del documento hasta que una pase.\n');

  for (const [nombre, amount] of Object.entries(FORMAS)) {
    /* Referencia única por intento: si la primera forma alcanzó a crear el
       cobro, la segunda no puede colisionar con ella. */
    const reference = `sondeo-${Date.now()}`;

    const r = await pedir('POST', '/payments/app-checkout', {
      amount,
      payment_method: 'POS',
      terminal_model: terminal.terminal_model,
      terminal_serial: terminal.terminal_serial,
      reference,
      user_email: process.env.BOLD_USER_EMAIL || 'pruebas@menuby.tech',
      description: 'Sondeo de integración MenuBy',
    });

    if (r.estado === 201) {
      console.log(`   ✓ ${nombre}`);
      console.log(`     HTTP 201 · integration_id ${sacar(r.datos, 'integration_id')}`);
      console.log(`     reference ${reference}`);
      console.log('\n   ESA es la forma correcta. El datáfono debería estar sonando.');
      console.log('   El resultado del pago llega por webhook, no por acá.');
      return;
    }

    console.log(`   ✗ ${nombre}`);
    console.log(`     HTTP ${r.estado} · ${JSON.stringify(r.datos?.errors || r.texto.slice(0, 160))}`);
  }

  console.log('\n   Ninguna de las dos pasó. Mira los códigos de arriba:');
  console.log('   AP004 = el datáfono no está habilitado para API Integrations');
  console.log('   AP005 = falta un campo obligatorio (dice cuál)');
  console.log('   AP006 = un campo tiene el tipo equivocado');
})().catch((e) => {
  console.error('\nError inesperado:', e.message);
  process.exitCode = 1;
});
