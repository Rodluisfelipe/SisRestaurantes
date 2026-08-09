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

describe('la sección del panel está cableada', () => {
  /* Una entrada de menú que no renderiza nada deja la pantalla en blanco sin
     ningún error: el `activeTab` simplemente no coincide con ningún bloque. */
  const fs = require('fs');
  const path = require('path');
  const front = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', 'Frontend', 'src', ...p), 'utf8');

  const ID = 'whatsapp-inbox';

  it('el menú lateral ofrece la sección', () => {
    expect(front('Components', 'ModernAdminSidebar.jsx')).toContain(`id: '${ID}'`);
  });

  it('Admin.jsx renderiza algo para ese id', () => {
    const src = front('Pages', 'Admin.jsx');
    expect(src).toContain(`activeTab === '${ID}'`);
    expect(src).toContain('<WhatsAppInbox />');
    expect(src).toMatch(/const WhatsAppInbox = lazy\(/);
  });

  it('la cabecera móvil sabe cómo se llama', () => {
    expect(front('Components', 'Admin', 'MobileHeader.jsx')).toContain(`'${ID}'`);
  });

  it('la pantalla contempla no tener el complemento contratado', () => {
    // Sin esto, un negocio sin el add-on veria un error crudo en vez de la oferta.
    const src = front('Components', 'Admin', 'WhatsAppInbox.jsx');
    expect(src).toMatch(/status === 402|status \? \.402/);
    expect(src).toContain('OfertaComplemento');
  });

  it('la pantalla bloquea el envío fuera de la ventana de 24 horas', () => {
    const src = front('Components', 'Admin', 'WhatsAppInbox.jsx');
    expect(src).toContain('puedeResponder');
    expect(src).toContain('OUTSIDE_WINDOW');
  });

  /* El backend resuelve el negocio de `req.user.businessId` y, si no viene,
     responde error. La pantalla se lo tragaba y mostraba el formulario de
     conectar: al negocio que ya tenía su número puesto le parecía que se había
     perdido la configuración. */
  it('toda petición manda el negocio, como el resto del panel', () => {
    const src = front('Components', 'Admin', 'WhatsAppInbox.jsx');
    expect(src).toContain('useBusinessConfig');

    const llamadas = src.match(/api\.(get|post)\(`?\/whatsapp-inbox[^)]*\)/g) || [];
    expect(llamadas.length).toBeGreaterThan(0);
    const sinNegocio = llamadas.filter((l) => !l.includes('businessId'));
    expect(sinNegocio).toEqual([]);
  });

  it('un fallo de carga se muestra en vez de pedir conectar de nuevo', () => {
    const src = front('Components', 'Admin', 'WhatsAppInbox.jsx');
    expect(src).toContain('falloCarga');
    // El corte tiene que ir ANTES de caer en el formulario de conexión.
    expect(src.indexOf('if (falloCarga)')).toBeLessThan(src.indexOf('<ConectarNumero'));
  });

  /* Chrome rellenaba el correo del usuario y una contraseña guardada en estos
     campos porque veía un formulario con un input de tipo password. */
  it('el navegador no autocompleta credenciales en el formulario', () => {
    const src = front('Components', 'Admin', 'WhatsAppInbox.jsx');
    expect(src).toMatch(/<form[^>]*autoComplete="off"/);
    expect(src).toContain('autoComplete="new-password"');
    // Nombres que no suenan a credenciales, para no darle pistas al gestor.
    expect(src).toContain('name="wa-access-token"');
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

describe('tomar el pedido desde el chat', () => {
  const fs = require('fs');
  const path = require('path');
  const front = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', 'Frontend', 'src', ...p), 'utf8');
  const srcOrders = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'orders.js'), 'utf8');

  /* El salto de los límites dependía de `orderChannel` del cuerpo, un dato que
     escribe quien llama, y POST /orders es público: bastaba mandar
     `orderChannel: 'admin'` para crear pedidos sin tope. */
  it('el salto de límites depende del token, no de un campo del cuerpo', () => {
    expect(srcOrders).toContain('function esPersonalDelNegocio');
    expect(srcOrders).toMatch(/if \(esPersonalDelNegocio\(req\)\) return next\(\);[\s\S]{0,80}createOrderLimiter/);
    expect(srcOrders).toMatch(/if \(esPersonalDelNegocio\(req\)\) return next\(\);[\s\S]{0,80}orderPhoneLimiter/);
  });

  it('ya no se puede saltar el límite diciendo que eres el panel', () => {
    const bloque = srcOrders.slice(
      srcOrders.indexOf('router.post("/"'),
      srcOrders.indexOf('validateCreateOrder, async'),
    );
    expect(bloque).not.toContain("orderChannel === 'admin'");
    expect(bloque).not.toContain("orderChannel === 'pos'");
  });

  it('el pedido rápido acepta datos prellenados y canal', () => {
    const src = front('Components', 'QuickOrderModal.jsx');
    expect(src).toMatch(/function QuickOrderModal\(\{[^}]*prefill/);
    expect(src).toMatch(/channel = 'admin'/);
    expect(src).toContain('orderChannel: channel');
  });

  it('la bandeja abre el pedido rápido con el cliente del chat', () => {
    const src = front('Components', 'Admin', 'WhatsAppInbox.jsx');
    expect(src).toContain('QuickOrderModal');
    expect(src).toContain('channel="whatsapp"');
    expect(src).toMatch(/prefill=\{\{[\s\S]{0,300}phone: chatActivo/);
  });

  it('reutiliza el pedido rápido en vez de recalcular precios aparte', () => {
    // Duplicar el calculo de totales es como aparecieron las diferencias de precio.
    const src = front('Components', 'Admin', 'WhatsAppInbox.jsx');
    expect(src).toMatch(/import QuickOrderModal from/);
    expect(src).not.toMatch(/deliveryFee\s*=\s*calcul/i);
  });
});

describe('un mismo teléfono escrito de varias formas', () => {
  /* En producción conviven tres formatos: customers guarda "(310) 645-3205" y
     también "3105657653", los pedidos guardan 10 dígitos planos, y WhatsApp
     manda "573138178003". Si no se reconocen todos, la ficha del cliente dice
     "nuevo" para alguien con treinta pedidos, y el fallo es mudo. */
  const { variantesDeTelefono, nacional, telefonoLegible, mismoTelefono } = require('../utils/phoneVariants');

  it('reduce cualquier formato al número nacional', () => {
    for (const entrada of ['573138178003', '+57 313 817 8003', '(313) 817-8003', '3138178003', '03138178003']) {
      expect(nacional(entrada)).toBe('3138178003');
    }
  });

  it('genera las formas que existen hoy en la base', () => {
    const v = variantesDeTelefono('573138178003');
    expect(v).toContain('3138178003');        // orders y completedorders
    expect(v).toContain('(313) 817-8003');    // customers con formato
    expect(v).toContain('573138178003');      // como llega de WhatsApp
    expect(v).toContain('+573138178003');
  });

  it('el número de WhatsApp encuentra al cliente guardado con paréntesis', () => {
    // El caso exacto que rompía el enlace entre chat y pedidos.
    expect(variantesDeTelefono('573106453205')).toContain('(310) 645-3205');
  });

  it('no devuelve repetidos', () => {
    const v = variantesDeTelefono('3138178003');
    expect(v.length).toBe(new Set(v).size);
  });

  it('con un valor irreconocible busca al menos lo que llegó', () => {
    expect(variantesDeTelefono('00000000')).toEqual(['00000000']);
    expect(variantesDeTelefono('')).toEqual([]);
    expect(variantesDeTelefono(null)).toEqual([]);
  });

  it('compara dos números sin importar cómo estén escritos', () => {
    expect(mismoTelefono('573138178003', '(313) 817-8003')).toBe(true);
    expect(mismoTelefono('3138178003', '+57 313 817 8003')).toBe(true);
    expect(mismoTelefono('3138178003', '3138178004')).toBe(false);
    expect(mismoTelefono('', '')).toBe(false);
  });

  it('lo muestra legible', () => {
    expect(telefonoLegible('573138178003')).toBe('313 817 8003');
    expect(telefonoLegible('(313) 817-8003')).toBe('313 817 8003');
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

describe('plantillas de Meta', () => {
  /* Son la única forma de escribirle a alguien fuera de la ventana de 24 horas,
     y demostrar que se saben crear es requisito para que Meta apruebe el
     permiso whatsapp_business_management. */
  const fs2 = require('fs');
  const path2 = require('path');
  const cloud = fs2.readFileSync(path2.join(__dirname, '..', 'services', 'whatsappCloud.js'), 'utf8');
  const ruta = fs2.readFileSync(path2.join(__dirname, '..', 'Routes', 'whatsappInbox.js'), 'utf8');

  it('se crean contra la API de Meta, no en nuestra base', () => {
    expect(cloud).toMatch(/message_templates/);
    expect(cloud).toMatch(/async function crearPlantilla/);
  });

  it('el nombre se limpia como Meta exige', () => {
    // Solo minúsculas, números y guion bajo; el error de Meta no lo explica.
    expect(cloud).toMatch(/toLowerCase\(\)\.replace\(\/\[\^a-z0-9_\]\/g, '_'\)/);
  });

  it('no se confunden con las plantillas del enlace wa.me', () => {
    expect(cloud).toMatch(/no tiene nada que ver con esto/);
  });

  it('sin WABA se dice qué falta, en vez de fallar contra Meta', () => {
    expect(ruta).toMatch(/Falta el identificador de la cuenta de WhatsApp Business/);
  });

  it('el motivo de rechazo de Meta llega tal cual al negocio', () => {
    // "nombre inválido" o "faltan ejemplos" es la única pista que tiene.
    expect(ruta).toMatch(/Meta rechazó la plantilla: \$\{e\.message\}/);
  });

  it('lo enviado por plantilla queda en la bandeja', () => {
    // Si no, el negocio ve una conversación donde escribió algo invisible.
    const fn = cloud.slice(cloud.indexOf('async function enviarPlantilla'));
    expect(fn).toMatch(/WhatsAppMessage\.create/);
  });
});

describe('la pantalla de plantillas', () => {
  /* Se hace pantalla y no solo endpoint por dos razones: el revisor de Meta ve
     un producto en vez de una terminal —y el permiso que se pide es
     justamente el de administrar cuentas de terceros—, y el negocio va a
     necesitar crear las suyas sin depender de nosotros. */
  const fs2 = require('fs');
  const path2 = require('path');
  const ui = fs2.readFileSync(
    path2.join(__dirname, '..', '..', 'Frontend', 'src', 'Components', 'Admin', 'WhatsAppInbox.jsx'), 'utf8',
  );

  it('está dentro de la bandeja, no escondida en otra sección', () => {
    expect(ui).toContain('Plantillas');
    expect(ui).toMatch(/vista === 'plantillas'/);
  });

  it('el nombre se corrige mientras se escribe', () => {
    // Meta solo acepta minúsculas, números y guion bajo, y su error no lo dice.
    expect(ui).toMatch(/toLowerCase\(\)\.replace\(\/\[\^a-z0-9_\]\/g, '_'\)/);
  });

  it('las variables se detectan solas y se les manda un ejemplo', () => {
    // Sin ejemplos Meta la rechaza sin explicar por qué.
    expect(ui).toContain('const variables = ');
    expect(ui).toContain('cuerpo.match(');
    expect(ui).toMatch(/ejemplos: variables\.map/);
  });

  it('se explica para qué sirven, porque el negocio no lo sabe', () => {
    expect(ui).toMatch(/24 horas/);
  });

  it('el motivo de rechazo de Meta se muestra tal cual', () => {
    expect(ui).toMatch(/motivoRechazo/);
  });
});
