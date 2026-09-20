const LoyaltyProgram = require('../Models/LoyaltyProgram');
const CustomerLoyalty = require('../Models/CustomerLoyalty');
const LoyaltyTransaction = require('../Models/LoyaltyTransaction');
const { getSubscriptionForBusiness, isFeatureEnabledForPlan } = require('../utils/subscriptionHelper');
const logger = require('../utils/logger');

/**
 * Canjear puntos por una recompensa. La única función que lo hace.
 *
 * Hay dos puertas por las que entra un canje —el cliente desde el menú web y
 * el cajero desde la terminal— y **una sola** que descuenta. La razón es
 * aburrida y es la correcta: si cada puerta tuviera su copia, la primera vez
 * que alguien arregle una condición de carrera en una, la otra se queda con el
 * hueco abierto y nadie se entera hasta que un cliente redime dos veces.
 *
 * Lo que cambia entre las dos puertas no es cómo se descuenta sino **qué se
 * exige antes**: desde una caja hay un empleado con las manos en el dinero, y
 * eso pide venta y firma. Eso vive en las rutas, no aquí.
 */

/**
 * @param {object} opts
 * @param {*} opts.businessId       ya resuelto
 * @param {string} opts.telefono
 * @param {string} opts.rewardId
 * @param {'pos'|'menu'|'panel'} opts.origen
 * @param {string} [opts.posSaleId]   la venta contra la que se redime (caja)
 * @param {string} [opts.autorizadoPor] el cajero (caja)
 * @param {string} [opts.cajaTokenId]
 * @param {string} [opts.cajaNombre]
 * @returns {Promise<{ok: boolean, estado: number, cuerpo: object}>}
 */
async function redimir(opts) {
  const {
    businessId, telefono, rewardId,
    origen = 'menu', posSaleId = '', autorizadoPor = '',
    cajaTokenId = '', cajaNombre = '',
  } = opts;

  const program = await LoyaltyProgram.findOne({ businessId, isActive: true });
  if (!program) {
    return { ok: false, estado: 404, cuerpo: { message: 'Programa de fidelidad no disponible' } };
  }

  /* El plan se revisa también para la caja: si el negocio no paga recompensas
     canjeables, no las paga por ninguna puerta. Un candado que solo cierra la
     puerta de adelante no es un candado. */
  const { planConfig, commercialPlan } = await getSubscriptionForBusiness(businessId);
  if (!isFeatureEnabledForPlan(planConfig, 'loyaltyRewards')) {
    return {
      ok: false,
      estado: 403,
      cuerpo: {
        message: 'Tu plan actual no incluye recompensas canjeables.',
        code: 'PLAN_FEATURE_NOT_AVAILABLE',
        feature: 'loyaltyRewards',
        plan: commercialPlan,
      },
    };
  }

  const reward = program.rewards.id(rewardId);
  if (!reward || !reward.isActive) {
    return { ok: false, estado: 404, cuerpo: { message: 'Recompensa no encontrada o inactiva' } };
  }

  /* Descuento atómico: la condición `points >= costo` va **dentro** de la
     consulta, no antes. Dos terminales redimiendo la misma recompensa del
     mismo cliente en el mismo segundo es un caso real en un mostrador con dos
     cajas, y un `if` previo lo deja pasar dos veces. */
  const loyalty = await CustomerLoyalty.findOneAndUpdate(
    { businessId, phone: telefono, points: { $gte: reward.pointsCost } },
    {
      $inc: { points: -reward.pointsCost, totalRedeemed: reward.pointsCost },
      $set: { lastActivityAt: new Date() },
      $push: {
        transactions: {
          type: 'redeem',
          points: -reward.pointsCost,
          description: `Canjeo: ${reward.name}`,
          rewardId: reward._id,
          rewardName: reward.name,
          createdAt: new Date(),
        },
      },
    },
    { new: true },
  );

  if (!loyalty) {
    const existe = await CustomerLoyalty.findOne({ businessId, phone: telefono });
    if (!existe) {
      return { ok: false, estado: 404, cuerpo: { message: 'No tienes puntos acumulados' } };
    }
    return {
      ok: false,
      estado: 400,
      cuerpo: { message: 'Puntos insuficientes', required: reward.pointsCost, available: existe.points },
    };
  }

  /* El registro de que esto pasó, con firma.

     Va **después** del descuento y no antes: si se escribiera primero, quedaría
     constancia de un canje que pudo no ocurrir. Y su fallo no revierte nada
     —los puntos ya salieron y el cliente ya se llevó lo suyo—, así que se anota
     el error y se sigue: negarle la recompensa a un cliente porque falló una
     escritura de auditoría sería castigarlo por un problema nuestro.

     El índice único sobre (negocio, venta, recompensa) es lo que hace que un
     reintento de la caja no cuente dos veces en el informe. */
  let duplicado = false;
  try {
    await LoyaltyTransaction.create({
      businessId,
      tipo: 'REDENCION',
      clienteId: loyalty.customerId || null,
      telefono,
      puntos: -reward.pointsCost,
      rewardId: reward._id,
      rewardNombre: reward.name,
      origen,
      cajaTokenId: String(cajaTokenId).slice(0, 64),
      cajaNombre: String(cajaNombre).slice(0, 80),
      autorizadoPor: String(autorizadoPor).slice(0, 80),
      posSaleId: String(posSaleId).slice(0, 64),
      saldoResultante: loyalty.points,
    });
  } catch (e) {
    if (e.code === 11000) {
      duplicado = true;
    } else {
      logger.error('No se pudo registrar el canje de puntos', e);
    }
  }

  if (program.tiersEnabled && program.tiers.length) {
    loyalty.computeTier(program.tiers);
    await loyalty.save();
  }

  reward.timesRedeemed = (reward.timesRedeemed || 0) + 1;
  await program.save();

  return {
    ok: true,
    estado: 200,
    duplicado,
    cuerpo: {
      success: true,
      pointsSpent: reward.pointsCost,
      remainingPoints: loyalty.points,
      reward: {
        name: reward.name,
        type: reward.type,
        discountValue: reward.discountValue,
        maxDiscount: reward.maxDiscount,
        productId: reward.productId,
        productName: reward.productName,
      },
    },
  };
}

module.exports = { redimir };
