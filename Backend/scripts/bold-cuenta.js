/**
 * Deja lista —o enciende, o apaga— la cuenta de Bold de un negocio.
 *
 * Existe porque la pantalla del panel todavía no está, y porque encender el
 * cobro con tarjeta en un negocio que está atendiendo cambia su checkout en
 * vivo: aparece un selector de pago que antes no estaba. Eso no es algo que
 * deba pasar de refilón mientras uno configura otra cosa, así que guardar las
 * llaves y encender son dos pasos separados a propósito.
 *
 * La secreta se lee del entorno y nunca se escribe acá ni en el repo.
 *
 * Uso:
 *   node scripts/bold-cuenta.js --negocio go-burger                 (ver como está)
 *   BOLD_SECRET=... node scripts/bold-cuenta.js --negocio go-burger \
 *      --identidad H1BU... --entorno pruebas                        (guardar llaves)
 *   node scripts/bold-cuenta.js --negocio go-burger --encender
 *   node scripts/bold-cuenta.js --negocio go-burger --apagar
 */
require('dotenv').config();
const mongoose = require('mongoose');

const arg = (nombre) => {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 ? process.argv[i + 1] : null;
};
const tiene = (nombre) => process.argv.includes(`--${nombre}`);

const SLUG = arg('negocio');
const IDENTIDAD = arg('identidad');
const ENTORNO = arg('entorno');
const SECRETA = process.env.BOLD_SECRET;

if (!SLUG) {
  console.error('Falta --negocio <slug>');
  process.exit(1);
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const BusinessConfig = require('../Models/BusinessConfig');
  const BoldCuenta = require('../Models/BoldCuenta');

  const negocio = await BusinessConfig.findOne({ slug: SLUG }).select('_id businessName slug').lean();
  if (!negocio) {
    console.error(`No existe un negocio con slug "${SLUG}"`);
    process.exit(1);
  }

  let cuenta = await BoldCuenta.findOne({ businessId: negocio._id });
  if (!cuenta) cuenta = new BoldCuenta({ businessId: negocio._id });

  let cambio = false;

  if (IDENTIDAD) { cuenta.identidad = IDENTIDAD.trim(); cambio = true; }
  if (SECRETA) { cuenta.setSecreta(SECRETA); cambio = true; }
  if (ENTORNO) {
    if (!['pruebas', 'produccion'].includes(ENTORNO)) {
      console.error('El entorno debe ser pruebas o produccion');
      process.exit(1);
    }
    cuenta.entorno = ENTORNO;
    cambio = true;
  }

  if (tiene('encender')) {
    if (!cuenta.identidad || !cuenta.secretaEnc) {
      console.error('No se puede encender sin las dos llaves.');
      process.exit(1);
    }
    /* Avisar, no impedir: quien corre esto sabe lo que hace, pero que no se
       entere después de que el cambio ya salió a la calle. */
    if (cuenta.entorno === 'produccion') {
      console.log('OJO: entorno produccion. Los cobros van a ser reales.');
    } else {
      console.log('Entorno de pruebas: la pasarela abre en "Modo de pruebas"');
      console.log('y un cliente real no va a poder pagar de verdad.');
    }
    cuenta.activa = true;
    cambio = true;
  }

  if (tiene('apagar')) { cuenta.activa = false; cambio = true; }

  if (cambio) await cuenta.save();

  const base = process.env.PUBLIC_URL || 'https://api.menuby.tech';
  console.log('');
  console.log(`Negocio:    ${negocio.businessName} (${negocio.slug})`);
  console.log(`Identidad:  ${cuenta.identidad ? cuenta.identidad.slice(0, 12) + '…' : '(sin poner)'}`);
  console.log(`Secreta:    ${cuenta.secretaEnc ? 'guardada, …' + cuenta.secretaPista : '(sin poner)'}`);
  console.log(`Entorno:    ${cuenta.entorno}`);
  console.log(`Encendida:  ${cuenta.activa ? 'SI — el menu ofrece tarjeta' : 'no'}`);
  console.log('');
  console.log('Webhook para pegar en el panel de Bold:');
  console.log(`  ${base}/api/bold/webhook/${cuenta.webhookToken}`);
  console.log('');
  if (!cuenta.activa && cuenta.identidad && cuenta.secretaEnc) {
    console.log('Listo para encender:');
    console.log(`  node scripts/bold-cuenta.js --negocio ${SLUG} --encender`);
  }

  await mongoose.disconnect();
})().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
