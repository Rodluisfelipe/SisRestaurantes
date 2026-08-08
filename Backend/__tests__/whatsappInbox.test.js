/**
 * Bandeja de WhatsApp multi-tenant.
 *
 * Se prueban las cuatro cosas cuyo fallo no se vería a simple vista y costaría
 * caro: el cifrado del token, la firma del webhook, la deduplicación de
 * mensajes y el aislamiento entre negocios.
 */
const crypto = require('crypto');

// La llave tiene que existir antes de cargar el módulo que la usa.
process.env.SECRET_BOX_KEY = crypto.randomBytes(32).toString('hex');

const secretBox = require('../utils/secretBox');
const {
  ADDONS, getAddonConfig, getActiveAddonKeys, getEffectiveFeatures, getAddonPrice, getPlanConfig,
} = require('../utils/commercialPlans');
const WhatsAppAccount = require('../Models/WhatsAppAccount');
const WhatsAppMessage = require('../Models/WhatsAppMessage');

describe('secretBox — el token de Meta no queda en claro', () => {
  it('cifra y descifra', () => {
    const token = 'EAAG' + 'x'.repeat(180);
    const sellado = secretBox.seal(token);
    expect(sellado).not.toContain(token);
    expect(sellado.startsWith('v1:')).toBe(true);
    expect(secretBox.open(sellado)).toBe(token);
  });

  it('dos cifrados del mismo texto se ven distintos', () => {
    // Si el IV no fuera aleatorio, se podría deducir qué negocios comparten token.
    expect(secretBox.seal('igual')).not.toBe(secretBox.seal('igual'));
  });

  it('rechaza un texto alterado en vez de devolver basura', () => {
    const sellado = secretBox.seal('token-real');
    const partes = sellado.split(':');
    const datos = Buffer.from(partes[3], 'base64url');
    datos[0] ^= 0xff;
    partes[3] = datos.toString('base64url');
    expect(() => secretBox.open(partes.join(':'))).toThrow();
  });

  it('la pista no revela el secreto', () => {
    const pista = secretBox.hint('EAAGsecretoLargo1234');
    expect(pista).toBe('••••1234');
    expect(pista).not.toContain('secreto');
  });
});

describe('complementos — se venden aparte del plan', () => {
  it('el negocio en plan gratis puede tener la bandeja como complemento', () => {
    const gratis = getPlanConfig('free');
    expect(gratis.features.whatsappInbox).toBeUndefined();

    const conAddon = getEffectiveFeatures(gratis, {
      addons: [{ key: 'whatsapp_inbox', status: 'active', periodEnd: null }],
    });
    expect(conAddon.whatsappInbox).toBe(true);
    // No le regala nada más de un plan superior.
    expect(conAddon.pos).toBe(false);
  });

  it('un complemento vencido no cuenta', () => {
    const ayer = new Date(Date.now() - 86400000);
    const features = getEffectiveFeatures(getPlanConfig('free'), {
      addons: [{ key: 'whatsapp_inbox', status: 'active', periodEnd: ayer }],
    });
    expect(features.whatsappInbox).toBeFalsy();
  });

  it('un complemento cancelado no cuenta', () => {
    const features = getEffectiveFeatures(getPlanConfig('free'), {
      addons: [{ key: 'whatsapp_inbox', status: 'cancelled', periodEnd: null }],
    });
    expect(features.whatsappInbox).toBeFalsy();
  });

  it('una llave inventada no activa nada', () => {
    expect(getAddonConfig('regalame_todo')).toBeNull();
    const features = getEffectiveFeatures(getPlanConfig('free'), {
      addons: [{ key: 'regalame_todo', status: 'active', periodEnd: null }],
    });
    expect(Object.values(features).filter(Boolean).length).toBe(1); // solo inAppOrdering
  });

  it('el complemento nunca apaga algo que el plan ya daba', () => {
    const pro = getPlanConfig('pro');
    const features = getEffectiveFeatures(pro, { addons: [] });
    expect(features.pos).toBe(true);
    expect(features.aiTools).toBe(true);
  });

  it('el precio anual sale más barato por mes que el mensual', () => {
    const mensual = getAddonPrice('whatsapp_inbox', 'monthly');
    const anual = getAddonPrice('whatsapp_inbox', 'annual');
    expect(anual).toBeLessThan(mensual * 12);
  });

  it('cada complemento declara la capacidad que activa', () => {
    for (const addon of Object.values(ADDONS)) {
      expect(typeof addon.feature).toBe('string');
      expect(addon.feature.length).toBeGreaterThan(0);
    }
  });

  it('ignora una suscripción sin complementos', () => {
    expect(getActiveAddonKeys(null)).toEqual([]);
    expect(getActiveAddonKeys({})).toEqual([]);
  });
});

describe('firma del webhook', () => {
  /* Reproduce el cálculo de Routes/whatsappInbox: HMAC sobre el cuerpo crudo.
     Si esto no se verificara, cualquiera podría inyectar mensajes en el panel
     de cualquier negocio con un POST. */
  const APP_SECRET = 'secreto-de-la-app';
  const firmar = (buf) => 'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(buf).digest('hex');

  it('la firma de Meta se calcula sobre los bytes originales, no sobre el JSON reserializado', () => {
    const crudo = Buffer.from('{"a":1,  "b":2}');           // con espacios
    const reserializado = Buffer.from(JSON.stringify({ a: 1, b: 2 })); // sin ellos
    expect(firmar(crudo)).not.toBe(firmar(reserializado));
  });

  it('un cuerpo alterado no valida', () => {
    const original = Buffer.from('{"mensaje":"hola"}');
    const alterado = Buffer.from('{"mensaje":"adios"}');
    expect(firmar(original)).not.toBe(firmar(alterado));
  });

  /* Meta verifica el webhook con parámetros que llevan punto. El saneador de
     Mongo borra toda clave que contenga uno, así que el token llegaba vacío y
     la verificación devolvía 403 aunque estuviera bien configurada. No se ve
     leyendo la ruta: hay que mirar el orden de los middleware. */
  it('el saneador de Mongo no se come los parámetros de verificación de Meta', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
    expect(src).toMatch(/whatsapp-inbox\/webhook[\s\S]{0,80}return next\(\)/);
  });

  it('el saneador sí protege al resto de las rutas', () => {
    const mongoSanitize = require('express-mongo-sanitize');
    const req = { query: { 'hub.verify_token': 'x', 'campo.malo': 'y' }, body: {}, params: {} };
    mongoSanitize()(req, {}, () => {});
    // Confirma el comportamiento que nos mordió: borra las claves con punto.
    expect(req.query['hub.verify_token']).toBeUndefined();
  });

  it('server.js guarda el cuerpo crudo solo para el webhook', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
    expect(src).toMatch(/verify:\s*\(req, res, buf\)/);
    expect(src).toMatch(/whatsapp-inbox\/webhook/);
    expect(src).toMatch(/req\.rawBody = buf/);
  });
});

describe('modelos — lo que impide duplicados y filtraciones', () => {
  const indices = (Model) => Model.schema.indexes();
  const tieneUnicoEn = (Model, campo) => indices(Model)
    .some(([def, opts]) => def[campo] === 1 && opts?.unique);

  it('un mismo mensaje de Meta no se puede guardar dos veces', () => {
    // Meta reintenta el webhook; sin esto el chat se llenaría de copias.
    expect(tieneUnicoEn(WhatsAppMessage, 'wamid')).toBe(true);
  });

  it('un número no puede pertenecer a dos negocios', () => {
    // Es la llave del enrutador: si se repitiera, los chats de un negocio
    // aparecerían en el panel de otro.
    expect(tieneUnicoEn(WhatsAppAccount, 'phoneNumberId')).toBe(true);
  });

  it('la vista del panel nunca incluye el token', () => {
    const cuenta = new WhatsAppAccount({ businessId: '507f1f77bcf86cd799439011', phoneNumberId: '123' });
    cuenta.setAccessToken('EAAGtoken-secreto');

    const vista = cuenta.toPanel();
    const serializado = JSON.stringify(vista);
    expect(serializado).not.toContain('EAAGtoken-secreto');
    expect(serializado).not.toContain(cuenta.accessTokenEnc);
    expect(vista.tokenHint).toBe('••••reto');
  });

  it('el token viaja cifrado y vuelve intacto', () => {
    const cuenta = new WhatsAppAccount({ businessId: '507f1f77bcf86cd799439011', phoneNumberId: '123' });
    cuenta.setAccessToken('EAAGmi-token');
    expect(cuenta.accessTokenEnc).not.toContain('EAAGmi-token');
    expect(cuenta.getAccessToken()).toBe('EAAGmi-token');
  });

  it('toda consulta a la bandeja se puede acotar por negocio', () => {
    const porNegocio = indices(WhatsAppMessage).some(([def]) => def.businessId === 1);
    expect(porNegocio).toBe(true);
  });
});

describe('interpretación del mensaje de Meta', () => {
  /* Esto no estaba cubierto y por eso un fallo trivial —una variable local que
     tapaba a una función homónima— solo se descubrió mandando un WhatsApp real
     y leyendo los logs del servidor. */
  const { interpretarMensaje } = require('../Routes/whatsappInbox');

  it('saca el texto de un mensaje normal', () => {
    const r = interpretarMensaje({
      id: 'wamid.ABC', from: '573138178003', type: 'text',
      text: { body: 'hola, tienen domicilio?' }, timestamp: '1786147931',
    });
    expect(r.wamid).toBe('wamid.ABC');
    expect(r.contactPhone).toBe('573138178003');
    expect(r.type).toBe('text');
    expect(r.text).toBe('hola, tienen domicilio?');
    expect(r.sentAt.getFullYear()).toBeGreaterThan(2020);
  });

  it('guarda la referencia del medio y el pie de una imagen', () => {
    const r = interpretarMensaje({
      id: 'w1', from: '573138178003', type: 'image',
      image: { id: 'media-123', mime_type: 'image/jpeg', caption: 'el comprobante' },
    });
    expect(r.type).toBe('image');
    expect(r.text).toBe('el comprobante');
    expect(r.mediaId).toBe('media-123');
    expect(r.mediaMimeType).toBe('image/jpeg');
  });

  it('arma una dirección legible con la ubicación', () => {
    const r = interpretarMensaje({
      id: 'w2', from: '573138178003', type: 'location',
      location: { name: 'Casa', address: 'Calle 14 #3-20' },
    });
    expect(r.text).toBe('Casa — Calle 14 #3-20');
  });

  it('no se cae con un tipo que no conocemos', () => {
    const r = interpretarMensaje({ id: 'w3', from: '573138178003', type: 'contacts' });
    expect(r.type).toBe('unsupported');
    expect(r.text).toBe('');
  });

  it('convierte a texto lo que venga, para que no entre un operador de Mongo', () => {
    const r = interpretarMensaje({ id: { $ne: null }, from: { $gt: '' }, type: 'text' });
    expect(typeof r.wamid).toBe('string');
    expect(typeof r.contactPhone).toBe('string');
  });

  it('recorta un texto desmedido', () => {
    const r = interpretarMensaje({
      id: 'w4', from: '573138178003', type: 'text', text: { body: 'a'.repeat(9000) },
    });
    expect(r.text.length).toBe(8000);
  });
});

describe('normalización de teléfonos', () => {
  const { normalizePhone } = require('../services/whatsappCloud');

  it('completa el indicativo de Colombia', () => {
    expect(normalizePhone('3218263250')).toBe('573218263250');
    expect(normalizePhone('+57 321 826 3250')).toBe('573218263250');
    expect(normalizePhone('(321) 826-3250')).toBe('573218263250');
  });

  it('respeta un número que ya viene internacional', () => {
    expect(normalizePhone('573218263250')).toBe('573218263250');
  });

  it('descarta lo que no es un número usable', () => {
    expect(normalizePhone('123')).toBeNull();
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });
});
