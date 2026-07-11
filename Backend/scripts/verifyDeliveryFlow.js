/**
 * verifyDeliveryFlow — prueba de integración del módulo de domicilios contra un MongoDB real.
 *
 * SEGURO: usa una base de datos AISLADA (`delivery_itest_temp`) vía la opción dbName,
 * sin importar qué DB nombre tu connection string, y la BORRA al terminar.
 * Nunca toca tus colecciones reales.
 *
 * USO (en tu servidor, donde Mongo es alcanzable):
 *   cd Backend
 *   TEST_MONGO_URI="mongodb+srv://user:pass@cluster/loquesea" node scripts/verifyDeliveryFlow.js
 *
 * (También toma MONGODB_URI / MONGO_URI del entorno si TEST_MONGO_URI no está.)
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'itest-secret';

const path = require('path');
const mongoose = require('mongoose');

const ROOT = path.join(__dirname, '..');
const BusinessConfig = require(path.join(ROOT, 'Models/BusinessConfig'));
const DeliveryPerson = require(path.join(ROOT, 'Models/DeliveryPerson'));
const Order = require(path.join(ROOT, 'Models/Order'));
const Delivery = require(path.join(ROOT, 'Models/Delivery'));
const DeliveryEvent = require(path.join(ROOT, 'Models/DeliveryEvent'));
const DeliveryOffer = require(path.join(ROOT, 'Models/DeliveryOffer'));
const assignment = require(path.join(ROOT, 'services/assignmentService'));

const TEST_DB = 'delivery_itest_temp';
let pass = 0, fail = 0;
const check = (name, cond) => { if (cond) { pass++; console.log('  ✅', name); } else { fail++; console.log('  ❌', name); } };

async function connect() {
  const uri = process.env.TEST_MONGO_URI || process.env.MONGODB_URI || process.env.MONGO_URI;
  if (uri) {
    // dbName aísla la prueba en una base separada, sin importar la del URI
    await mongoose.connect(uri, { dbName: TEST_DB });
    console.log(`Conectado a Mongo (base aislada: ${TEST_DB})\n`);
    return null;
  }
  // fallback a mongo en memoria (requiere mongodb-memory-server + vc_redist en Windows)
  const { MongoMemoryServer } = require('mongodb-memory-server');
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri(), { dbName: TEST_DB });
  console.log('Conectado a Mongo en memoria\n');
  return mongod;
}

(async () => {
  let mongod;
  try {
    mongod = await connect();

    const biz = await BusinessConfig.create({
      businessName: 'ITEST Rest', slug: 'itest-rest-' + Date.now(), ownerEmail: 'itest@x.com',
      deliverySettings: { assignmentMode: 'auto_nearest', usePartners: false, maxAssignRadiusKm: 10, offerTimeoutSec: 30 },
    });
    const now = new Date();
    const A = await DeliveryPerson.create({ businessId: biz._id, name: 'Ana', code: '1111', active: true, isOnline: true, status: 'available', lastSeenAt: now, lastLocation: { type: 'Point', coordinates: [-74.081, 4.652] } });
    const B = await DeliveryPerson.create({ businessId: biz._id, name: 'Beto', code: '2222', active: true, isOnline: true, status: 'available', lastSeenAt: now, lastLocation: { type: 'Point', coordinates: [-74.095, 4.665] } });
    const order = await Order.create({
      businessId: biz._id, orderNumber: 'D-001', customerName: 'Cliente X', phone: '3001234567',
      orderType: 'delivery', status: 'ready', paymentMethod: 'cash', address: 'Calle 100',
      deliveryCoordinates: { lat: 4.65, lon: -74.08 }, totalAmount: 40000, finalAmount: 40000,
      items: [{ name: 'Pizza', price: 40000, quantity: 1 }],
    });
    const bizObj = biz.toObject();

    console.log('CASO 1 — pickAndOffer ofrece al más cercano (Ana):');
    let r = await assignment.pickAndOffer(order, bizObj);
    check('resultado ok+offered', r.ok && r.offered);
    check('ofrecido a Ana (más cercana)', String(r.driver?._id) === String(A._id));
    let delivery = await Delivery.findOne({ orderId: order._id });
    check('delivery en estado offered', delivery?.state === 'offered');
    let offerA = await DeliveryOffer.findOne({ orderId: order._id, driverId: A._id, state: 'pending' });
    check('existe oferta pending para Ana', !!offerA);

    console.log('\nCASO 2 — Ana rechaza → reofrece a Beto:');
    await assignment.rejectOffer(offerA);
    offerA = await DeliveryOffer.findById(offerA._id);
    check('oferta de Ana quedó rejected', offerA.state === 'rejected');
    let offerB = await DeliveryOffer.findOne({ orderId: order._id, driverId: B._id, state: 'pending' });
    check('nueva oferta pending para Beto', !!offerB);
    check('attempt=2 (excluye a Ana)', offerB?.attempt === 2);

    console.log('\nCASO 3 — Beto acepta → se asigna:');
    const betoDoc = await DeliveryPerson.findById(B._id);
    r = await assignment.acceptOffer(offerB, betoDoc);
    check('acceptOffer ok', r.ok === true);
    const orderAfter = await Order.findById(order._id);
    check('order.deliveryPersonId = Beto', String(orderAfter.deliveryPersonId) === String(B._id));
    check('order.status = inProgress', orderAfter.status === 'inProgress');
    check('order tiene confirmationCode', !!orderAfter.confirmationCode);
    delivery = await Delivery.findOne({ orderId: order._id });
    check('delivery en estado accepted', delivery.state === 'accepted');
    const betoAfter = await DeliveryPerson.findById(B._id);
    check('Beto status on_delivery', betoAfter.status === 'on_delivery');
    check('Beto activeDeliveries = 1', betoAfter.activeDeliveries === 1);
    offerB = await DeliveryOffer.findById(offerB._id);
    check('oferta de Beto quedó accepted', offerB.state === 'accepted');

    console.log('\nCASO 4 — log de eventos (auditoría):');
    const events = await DeliveryEvent.find({ deliveryId: delivery._id }).sort({ createdAt: 1 }).lean();
    const evNames = events.map(e => e.event);
    console.log('   eventos:', evNames.join(' → '));
    check('registró create', evNames.includes('create'));
    check('registró offer (x2)', evNames.filter(e => e === 'offer').length >= 2);
    check('registró accept', evNames.includes('accept'));

    console.log('\nCASO 5 — cuentas con contraseña (Fase B):');
    const C = new DeliveryPerson({ businessId: biz._id, name: 'Caro', code: '3333', phone: '3009998888' });
    await C.setPassword('secreta123');
    await C.save();
    const loaded = await DeliveryPerson.findById(C._id);
    check('verifyPassword correcta', await loaded.verifyPassword('secreta123'));
    check('verifyPassword incorrecta rechaza', !(await loaded.verifyPassword('mala')));
    check('passwordHash no es texto plano', loaded.passwordHash !== 'secreta123');

    console.log('\nCASO 6 — sin domis disponibles → no_courier:');
    await DeliveryPerson.updateMany({ businessId: biz._id }, { $set: { isOnline: false } });
    const order2 = await Order.create({
      businessId: biz._id, orderNumber: 'D-002', customerName: 'Cliente Y',
      orderType: 'delivery', status: 'ready', deliveryCoordinates: { lat: 4.65, lon: -74.08 },
      totalAmount: 20000, finalAmount: 20000, items: [{ name: 'Burger', price: 20000, quantity: 1 }],
    });
    r = await assignment.pickAndOffer(order2, bizObj);
    check('sin domis → ok:false reason no_courier', !r.ok && r.reason === 'no_courier');
    const d2 = await Delivery.findOne({ orderId: order2._id });
    check('delivery2 en estado no_courier', d2?.state === 'no_courier');

    console.log(`\n═══ RESULTADO: ${pass} pasaron, ${fail} fallaron ═══`);
  } catch (e) {
    console.error('\nERROR FATAL:', e);
    fail++;
  } finally {
    // Limpieza: borrar SOLO la base de prueba aislada
    try { await mongoose.connection.dropDatabase(); console.log(`\nBase de prueba ${TEST_DB} eliminada.`); } catch { /* noop */ }
    await mongoose.disconnect().catch(() => {});
    if (mongod) await mongod.stop().catch(() => {});
  }
  process.exit(fail === 0 ? 0 : 1);
})();
