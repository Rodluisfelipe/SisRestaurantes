/**
 * Repara el saldo que se perdió por el enum incompleto de `performedBy.kind`.
 *
 * Cada intento de publicar una vacante como empleador externo descontaba el fee
 * y después reventaba al escribir el asiento, así que la plata desaparecía sin
 * vacante ni registro. Este script busca esa diferencia comparando el saldo real
 * contra el último asiento del ledger, devuelve lo que falta y escribe un
 * movimiento `adjustment` para que la billetera vuelva a cuadrar.
 *
 * Idempotente: el asiento lleva idempotencyKey por dueño, así que correrlo dos
 * veces no devuelve la plata dos veces.
 *
 *   node scripts/fix-crew-lost-fee.js          # solo reporta
 *   node scripts/fix-crew-lost-fee.js --apply  # repara
 */
require('dotenv').config();
const mongoose = require('mongoose');
const CrewWalletTxn = require('../Models/CrewWalletTxn');
const CrewEmployer = require('../Models/CrewEmployer');
const BusinessConfig = require('../Models/BusinessConfig');

const APPLY = process.argv.includes('--apply');
const money = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CO');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(APPLY ? '=== REPARANDO ===' : '=== SOLO REPORTE (usa --apply para reparar) ===');

  const dueños = [
    { tipo: 'crew_employer', Model: CrewEmployer },
    { tipo: 'business', Model: BusinessConfig },
  ];

  let reparados = 0;
  let totalDevuelto = 0;

  for (const { tipo, Model } of dueños) {
    const docs = await Model.find({ 'crewWallet.balance': { $exists: true } })
      .select('crewWallet name businessName').lean();

    for (const d of docs) {
      const ultimo = await CrewWalletTxn.findOne({ actorType: tipo, actorId: d._id })
        .sort({ createdAt: -1 }).lean();
      if (!ultimo) continue; // billetera sin historial: no hay contra qué comparar

      const saldo = Number(d.crewWallet?.balance) || 0;
      const segunLedger = Number(ultimo.balanceAfter) || 0;
      const falta = segunLedger - saldo;

      // Solo interesa el caso "falta plata": sobrar sería otro problema distinto.
      if (falta <= 0) continue;

      const nombre = d.name || d.businessName || String(d._id);
      console.log(`\n  ${tipo} ${nombre}`);
      console.log(`    saldo real ${money(saldo)} · ledger dice ${money(segunLedger)} · faltan ${money(falta)}`);

      if (!APPLY) { reparados++; totalDevuelto += falta; continue; }

      const clave = `fix_lost_vacancy_fee:${d._id}`;
      if (await CrewWalletTxn.findOne({ idempotencyKey: clave })) {
        console.log('    ya reparado antes, se omite');
        continue;
      }

      const actualizado = await Model.findByIdAndUpdate(
        d._id,
        {
          $inc: {
            'crewWallet.balance': falta,
            'crewWallet.totalCommissionPaid': -falta,
          },
        },
        { new: true, select: 'crewWallet' },
      );

      await CrewWalletTxn.create({
        actorType: tipo, actorId: d._id,
        counterpartType: 'platform',
        kind: 'adjustment', direction: 'in', amount: falta,
        balanceAfter: actualizado.crewWallet.balance,
        pendingAfter: actualizado.crewWallet.pendingBalance,
        idempotencyKey: clave,
        note: 'Devolución de fee cobrado sin publicar la vacante',
        metadata: { motivo: 'performedBy.kind no aceptaba crew_employer', saldoAntes: saldo },
        performedBy: { kind: 'system' },
      });

      console.log(`    devuelto ${money(falta)} · saldo ahora ${money(actualizado.crewWallet.balance)}`);
      reparados++;
      totalDevuelto += falta;
    }
  }

  console.log(`\n${reparados} billetera(s) · ${money(totalDevuelto)}`);
  if (!APPLY && reparados) console.log('Corre con --apply para devolver la plata.');
  await mongoose.disconnect();
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
