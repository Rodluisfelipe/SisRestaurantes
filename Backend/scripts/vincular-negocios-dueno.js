/**
 * Asocia varios negocios a un mismo dueño, para que entre a todos con una cuenta.
 *
 * Es lo que hace falta antes de armar un portafolio ("MenuBy Tura"): sin esto,
 * el dueño ve un solo negocio y la vitrina no tiene qué mostrar.
 *
 * **No los convierte en sucursales.** La otra vía que existe —la de marcas—
 * además de dar acceso pone `brandId`, `isMainBranch`, `useSharedMenu` y
 * `mainBranchId`, y eso haría que una hamburguesería y una heladería del mismo
 * dueño se comporten como locales gemelos. Este script solo da acceso.
 *
 * Busca los negocios **por nombre**, parcial y sin importar mayúsculas, porque
 * los ids de Mongo no se los sabe nadie de memoria.
 *
 * Uso:
 *   node scripts/vincular-negocios-dueno.js --dueno <usuario|email> --negocios "doguitos,fraise"
 *
 * Para ver qué haría sin tocar nada:
 *   node scripts/vincular-negocios-dueno.js --dueno felipe --negocios "doguitos,fraise" --simular
 */
require('dotenv').config();
const mongoose = require('mongoose');

/** Los argumentos, sin traer una librería por tres banderas. */
function leerArgumentos(argv) {
  const salida = { simular: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--simular' || a === '--dry-run') { salida.simular = true; continue; }
    if (a === '--dueno' || a === '--dueño') { salida.dueno = argv[++i]; continue; }
    if (a === '--negocios') { salida.negocios = argv[++i]; continue; }
  }
  return salida;
}

/** Escapa lo que el usuario escribió para meterlo en una expresión regular. */
function comoRegex(texto) {
  return texto.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function main() {
  const args = leerArgumentos(process.argv);

  if (!args.dueno || !args.negocios) {
    console.error('\nFalta algo. Así se usa:\n');
    console.error('  node scripts/vincular-negocios-dueno.js --dueno <usuario|email> --negocios "doguitos,fraise"');
    console.error('  (agrega --simular para ver qué haría sin tocar nada)\n');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Conectado a MongoDB\n');

  const Admin = require('../Models/Admin');
  const BusinessConfig = require('../Models/BusinessConfig');

  /* ── El dueño ──────────────────────────────────────────────────────── */
  const dueno = await Admin.findOne({
    $or: [{ username: args.dueno.trim() }, { email: args.dueno.trim().toLowerCase() }],
  });

  if (!dueno) {
    console.error(`No encontré ninguna cuenta con "${args.dueno}".`);
    console.error('Prueba con el usuario exacto o el correo.\n');
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`Dueño:  ${dueno.username}  (${dueno.email || 'sin correo'})`);
  console.log(`        rol actual: ${dueno.role}`);
  console.log(`        negocios hoy: ${(dueno.accessibleBusinessIds || []).length || 1}\n`);

  /* ── Los negocios ──────────────────────────────────────────────────── */
  const buscados = args.negocios.split(',').map((n) => n.trim()).filter(Boolean);
  const encontrados = [];
  let hayProblema = false;

  for (const nombre of buscados) {
    const coincidencias = await BusinessConfig.find(
      { businessName: { $regex: comoRegex(nombre), $options: 'i' } },
      'businessName slug city isActive',
    ).lean();

    if (coincidencias.length === 0) {
      console.error(`  ✗ "${nombre}" — no existe ningún negocio con ese nombre`);
      hayProblema = true;
      continue;
    }

    if (coincidencias.length > 1) {
      /* Varias coincidencias es una ambigüedad, no un detalle: elegir la
         primera podría darle a este dueño acceso al negocio de otro. */
      console.error(`  ✗ "${nombre}" — coincide con ${coincidencias.length} negocios:`);
      coincidencias.forEach((b) => console.error(`       ${b.businessName}  (${b._id})`));
      console.error('       Sé más específico o usa el id.');
      hayProblema = true;
      continue;
    }

    const b = coincidencias[0];
    console.log(`  ✓ ${b.businessName}  (${b._id})  ${b.isActive ? '' : '— OJO: está inactivo'}`);
    encontrados.push(b);
  }

  if (hayProblema) {
    console.error('\nNo se hizo ningún cambio.\n');
    await mongoose.disconnect();
    process.exit(1);
  }

  /* ── Aplicar ───────────────────────────────────────────────────────── */
  const ids = encontrados.map((b) => String(b._id));

  /* El negocio con el que entra por defecto. Se conserva si sigue en la lista;
     si no, pasa a ser el primero, porque un dueño cuyo negocio por defecto ya
     no es suyo no podría iniciar sesión. */
  const sigue = dueno.businessId && ids.includes(String(dueno.businessId));
  const porDefecto = sigue ? String(dueno.businessId) : ids[0];

  console.log('\nQuedaría así:');
  console.log(`  rol:              brand_admin`);
  console.log(`  entra por:        ${encontrados.find((b) => String(b._id) === porDefecto).businessName}`);
  console.log(`  accede a:         ${encontrados.map((b) => b.businessName).join(', ')}`);
  console.log('  sucursales:       NO se tocan (esto no los vuelve locales gemelos)');

  if (args.simular) {
    console.log('\n--simular: no se escribió nada.\n');
    await mongoose.disconnect();
    return;
  }

  dueno.accessibleBusinessIds = ids;
  /* Es la bandera que el login ya mira para ofrecer el cambio de negocio. El
     nombre viene de cuando esto solo servía para marcas con sucursales. */
  dueno.role = 'brand_admin';
  dueno.businessId = porDefecto;

  await dueno.save();

  console.log('\nListo. Que cierre sesión y vuelva a entrar.\n');
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error('\nFalló:', e.message, '\n');
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
