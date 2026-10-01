/**
 * MenuBy Go: con la app nueva el pedido llega como LLAMADA (mensaje solo de
 * datos, alta prioridad); las versiones viejas siguen con la notificación.
 */
const enviados = [];
jest.mock('firebase-admin/app', () => ({ initializeApp: () => ({}), cert: () => ({}), applicationDefault: () => ({}), getApps: () => [] }));
jest.mock('firebase-admin/messaging', () => ({ getMessaging: () => ({ send: async (m) => { enviados.push(m); return 'ok'; } }) }));
jest.mock('../Models/DeliveryPerson', () => ({
  exists: jest.fn(async () => null),
  updateOne: jest.fn(async () => ({})),
  find: jest.fn(() => ({ select: () => ({ lean: async () => [{ _id: 'd1', fcmToken: 'tok-go-12345678901234567890', fcmLlamadas: true }] }) })),
  findById: jest.fn(() => ({ select: () => ({ lean: async () => ({ _id: 'd1', fcmToken: 'tok-go-12345678901234567890', fcmLlamadas: true }) }) })),
}));

process.env.FIREBASE_SERVICE_ACCOUNT = '{}';
const fcm = require('../services/fcmService');

const go = { _id: 'd1', fcmToken: 'tok-go-12345678901234567890', fcmLlamadas: true };
const viejo = { _id: 'd2', fcmToken: 'tok-viejo-1234567890123456', fcmLlamadas: false };

beforeEach(() => { enviados.length = 0; });

test('oferta a MenuBy Go: solo datos, alta prioridad, con clave y vencimiento', async () => {
  await fcm.notifyOffer(go, { offerId: 'o1', orderId: 'p1', businessName: 'Go Burger', address: 'Calle 1', ganancia: 5000, timeoutSec: 30 });
  const m = enviados[0];
  expect(m.notification).toBeUndefined();
  expect(m.android.notification).toBeUndefined();
  expect(m.android.priority).toBe('high');
  expect(m.android.ttl).toBe(30000);
  expect(m.data).toMatchObject({ llamada: 'oferta', clave: 'oferta:o1', venceEnSeg: '30', titulo: 'Nuevo pedido · Go Burger' });
  expect(m.data.cuerpo).toContain('Calle 1');
});

test('la app vieja sigue recibiendo la notificación de siempre', async () => {
  await fcm.notifyOffer(viejo, { offerId: 'o1', address: 'Calle 1', timeoutSec: 30 });
  expect(enviados[0].notification).toBeDefined();
  expect(enviados[0].data.llamada).toBeUndefined();
});

test('asignado directo: llamada con la clave del pedido', async () => {
  await fcm.notifyAssigned(go, { orderId: 'p9', orderNumber: 85, address: 'Carrera 6A' });
  expect(enviados[0].notification).toBeUndefined();
  expect(enviados[0].data).toMatchObject({ llamada: 'asignado', clave: 'pedido:p9', titulo: 'Te asignaron el pedido #85' });
});

test('colgar: las ofertas que ya no aplican cuelgan su llamada', async () => {
  await fcm.colgarOfertas([{ _id: 'o1', driverId: 'd1' }, { _id: 'o2', driverId: 'otro' }]);
  expect(enviados).toHaveLength(1);
  expect(enviados[0].data).toEqual({ llamada: 'colgar', clave: 'oferta:o1' });
  enviados.length = 0;
  await fcm.colgarAsignado('d1', 'p9');
  expect(enviados[0].data).toEqual({ llamada: 'colgar', clave: 'pedido:p9' });
});
