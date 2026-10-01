/**
 * Beneficios para los domiciliarios.
 *
 * El superadmin los publica (título, descripción, enlace e imagen). El domi
 * los ve en la app y los canjea con su CÓDIGO ÚNICO (MB-XXXXXX): desde la app
 * o desde la página del beneficio (que solo tiene que pedir el código). El
 * canje queda en firme cuando el domi lo confirma con el enlace que le llega
 * al correo: así nadie canjea con el código de otro.
 */
const crypto = require('crypto');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const reglas = require('../utils/domiApp');

const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sin 0/O ni 1/I/L: se dictan sin confusión
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const VENCE_ENLACE_MS = 24 * 60 * 60 * 1000;
const ESPERA_REENVIO_MS = 60 * 1000;

class ErrorBeneficio extends Error {
  constructor(status, mensaje, codigo) {
    super(mensaje);
    this.status = status;
    this.codigo = codigo;
  }
}

const hash = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
const azar = (n) => Array.from(crypto.randomBytes(n), (b) => ALFABETO[b % ALFABETO.length]).join('');
const tel10 = (t) => reglas.variantesTelefono(t).find((x) => x.length === 10) || reglas.variantesTelefono(t)[0] || '';
const baseApi = () => (process.env.API_PUBLIC_URL || 'https://api.menuby.tech').replace(/\/$/, '');

/** "MB-7K3P9Q" → "MB7K3P9Q" para comparar como sea que lo escriban. */
const normalizarCodigo = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const formatoCodigo = (c) => (c ? `${c.slice(0, 2)}-${c.slice(2)}` : null);

function ocultarCorreo(email) {
  const [u, d] = String(email || '').split('@');
  if (!u || !d) return '';
  return `${u.slice(0, 2)}${'•'.repeat(Math.max(1, u.length - 2))}@${d}`;
}

/** El código único de la persona; se crea la primera vez que se pide. */
async function asegurarCodigo(cuenta) {
  if (cuenta.codigo) return cuenta.codigo;
  const DomiCuenta = require('../Models/DomiCuenta');
  for (let i = 0; i < 6; i += 1) {
    const codigo = `MB${azar(6)}`;
    try {
      const r = await DomiCuenta.updateOne({ _id: cuenta._id, codigo: null }, { $set: { codigo } });
      if (r.modifiedCount) {
        cuenta.codigo = codigo;
        return codigo;
      }
      const ya = await DomiCuenta.findById(cuenta._id).select('codigo').lean();
      if (ya?.codigo) {
        cuenta.codigo = ya.codigo;
        return ya.codigo;
      }
    } catch (e) {
      if (e.code !== 11000) throw e; // otro tiene ese código: se intenta con otro
    }
  }
  throw new ErrorBeneficio(500, 'No pudimos crear tu código. Intenta de nuevo.');
}

/** El correo de la persona: el que guardó en la app o el verificado en el registro de la Red. */
async function correoDe(cuenta) {
  if (cuenta.email) return cuenta.email;
  const DeliveryPerson = require('../Models/DeliveryPerson');
  const d = await DeliveryPerson.findOne({ phone: { $in: reglas.variantesTelefono(cuenta.telefono) }, 'independiente.email': { $nin: [null, ''] } })
    .select('independiente.email').lean();
  return d?.independiente?.email || null;
}

const conCodigo = (enlace, codigo) => {
  if (!enlace) return '';
  try {
    const u = new URL(enlace);
    u.searchParams.set('codigo', formatoCodigo(codigo));
    return u.toString();
  } catch {
    return enlace;
  }
};

/* ═══════════════════════ App del domi ═══════════════════════ */

async function cuentaDe(telefono) {
  const DomiCuenta = require('../Models/DomiCuenta');
  const cuenta = await DomiCuenta.findOne({ telefono: tel10(telefono) });
  if (!cuenta) throw new ErrorBeneficio(404, 'No encontramos tu cuenta.');
  return cuenta;
}

async function paraDomi(domi) {
  const Beneficio = require('../Models/Beneficio');
  const CanjeBeneficio = require('../Models/CanjeBeneficio');
  const cuenta = await cuentaDe(domi.telefono);
  const [codigo, correo, lista, canjes] = await Promise.all([
    asegurarCodigo(cuenta),
    correoDe(cuenta),
    Beneficio.find({ activo: true }).sort({ createdAt: -1 }).lean(),
    CanjeBeneficio.find({ telefono: cuenta.telefono }).sort({ createdAt: -1 }).lean(),
  ]);
  return {
    codigo: formatoCodigo(codigo),
    correo,
    beneficios: lista.map((b) => {
      const mios = canjes.filter((c) => String(c.beneficioId) === String(b._id));
      const confirmado = mios.find((c) => c.estado === 'confirmado');
      const pendiente = mios.find((c) => c.estado === 'pendiente' && c.venceAt > new Date());
      return {
        id: String(b._id),
        titulo: b.titulo,
        descripcion: b.descripcion,
        enlace: conCodigo(b.enlace, codigo),
        imagen: b.imagen,
        canje: confirmado
          ? { estado: 'confirmado', comprobante: confirmado.comprobante, at: confirmado.confirmadoAt }
          : pendiente ? { estado: 'pendiente', at: pendiente.createdAt } : null,
      };
    }),
  };
}

async function guardarCorreo(domi, email) {
  const correo = String(email || '').trim().toLowerCase();
  if (!CORREO.test(correo) || correo.length > 120) throw new ErrorBeneficio(400, 'Escribe un correo válido.');
  const cuenta = await cuentaDe(domi.telefono);
  if (cuenta.email !== correo) {
    cuenta.email = correo;
    cuenta.emailVerificadoAt = null;
    await cuenta.save();
  }
  return { correo };
}

/* ═══════════════════════ Canje ═══════════════════════ */

async function enviarCorreoConfirmacion({ to, beneficio, enlace, nombre }) {
  const { sendSystemEmail } = require('./emailService');
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f172a">
      <h2 style="margin:0 0 8px;font-size:20px">Confirma tu canje</h2>
      <p style="color:#475569;font-size:14px;line-height:1.5;margin:0 0 16px">Hola${nombre ? ` ${nombre.split(' ')[0]}` : ''}, pediste canjear <strong>${beneficio.titulo}</strong> con tu código de MenuBy Go. Para que quede en firme, confírmalo:</p>
      <p style="text-align:center;margin:0 0 18px"><a href="${enlace}" style="display:inline-block;background:#D30310;color:#fff;text-decoration:none;font-weight:700;padding:14px 26px;border-radius:12px">Confirmar canje</a></p>
      <p style="color:#94a3b8;font-size:12px;line-height:1.5;margin:0">El enlace vence en 24 horas. Si no fuiste tú, ignora este correo: sin confirmar, nadie puede usar tu código.</p>
    </div>`;
  return sendSystemEmail({ to, subject: `Confirma tu canje: ${beneficio.titulo}`, html });
}

/**
 * Pide un canje. Desde la app (`telefono`) o desde la página del beneficio (`codigo`).
 * @returns {{ enviado:boolean, correo:string, codigoPrueba?:string }}
 */
async function pedirCanje(beneficioId, { telefono, codigo, origen = 'app' }) {
  const Beneficio = require('../Models/Beneficio');
  const CanjeBeneficio = require('../Models/CanjeBeneficio');
  const DomiCuenta = require('../Models/DomiCuenta');
  const DeliveryPerson = require('../Models/DeliveryPerson');
  if (!mongoose.isValidObjectId(beneficioId)) throw new ErrorBeneficio(404, 'Ese beneficio ya no está.');
  const beneficio = await Beneficio.findOne({ _id: beneficioId, activo: true }).lean();
  if (!beneficio) throw new ErrorBeneficio(404, 'Ese beneficio ya no está.');

  let cuenta;
  if (telefono) cuenta = await DomiCuenta.findOne({ telefono: tel10(telefono) });
  else {
    const c = normalizarCodigo(codigo);
    if (!/^MB[A-Z0-9]{6}$/.test(c)) throw new ErrorBeneficio(400, 'Escribe tu código de MenuBy Go (MB-XXXXXX).', 'codigo_invalido');
    cuenta = await DomiCuenta.findOne({ codigo: c });
  }
  if (!cuenta) throw new ErrorBeneficio(404, 'Ese código no es de ningún domiciliario.', 'codigo_invalido');
  const codigoDomi = await asegurarCodigo(cuenta);
  const email = await correoDe(cuenta);
  if (!email) throw new ErrorBeneficio(409, 'Agrega tu correo en la app (Yo → Beneficios) para poder canjear.', 'sin_correo');

  const ya = await CanjeBeneficio.findOne({ beneficioId, telefono: cuenta.telefono, estado: 'confirmado' }).lean();
  if (ya) throw new ErrorBeneficio(409, 'Ya canjeaste este beneficio.', 'ya_canjeado');
  const reciente = await CanjeBeneficio.findOne({ beneficioId, telefono: cuenta.telefono, estado: 'pendiente', createdAt: { $gt: new Date(Date.now() - ESPERA_REENVIO_MS) } }).lean();
  if (reciente) throw new ErrorBeneficio(429, 'Ya te enviamos el correo. Revisa tu bandeja (y spam) o espera un minuto.', 'espera');

  const token = crypto.randomBytes(24).toString('hex');
  await CanjeBeneficio.create({
    beneficioId, telefono: cuenta.telefono, codigoDomi, email, origen,
    tokenHash: hash(token), venceAt: new Date(Date.now() + VENCE_ENLACE_MS),
  });
  const perfil = await DeliveryPerson.findOne({ phone: { $in: reglas.variantesTelefono(cuenta.telefono) } }).select('name').lean();
  const enlace = `${baseApi()}/api/beneficios/confirmar?t=${token}`;
  const r = await enviarCorreoConfirmacion({ to: email, beneficio, enlace, nombre: perfil?.name }).catch((e) => ({ sent: false, reason: e.message }));
  if (!r?.sent) {
    if (process.env.NODE_ENV !== 'production') {
      logger.warn('Sin correo configurado: enlace de canje solo para desarrollo', { telefono: cuenta.telefono });
      return { enviado: false, correo: ocultarCorreo(email), enlacePrueba: enlace };
    }
    throw new ErrorBeneficio(502, 'No pudimos enviarte el correo. Intenta de nuevo en un rato.');
  }
  return { enviado: true, correo: ocultarCorreo(email) };
}

/** El domi tocó el enlace del correo. Responde lo que muestra la página de confirmación. */
async function confirmar(token) {
  const CanjeBeneficio = require('../Models/CanjeBeneficio');
  const Beneficio = require('../Models/Beneficio');
  const DomiCuenta = require('../Models/DomiCuenta');
  if (!/^[a-f0-9]{48}$/.test(String(token || ''))) throw new ErrorBeneficio(400, 'Este enlace no es válido.');
  const canje = await CanjeBeneficio.findOne({ tokenHash: hash(token) });
  if (!canje) throw new ErrorBeneficio(404, 'Este enlace no es válido.');
  const beneficio = await Beneficio.findById(canje.beneficioId).lean();
  if (canje.estado !== 'confirmado') {
    if (canje.venceAt < new Date()) throw new ErrorBeneficio(410, 'Este enlace venció. Pide el canje otra vez desde la app.');
    const ya = await CanjeBeneficio.findOne({ beneficioId: canje.beneficioId, telefono: canje.telefono, estado: 'confirmado' }).lean();
    if (ya) throw new ErrorBeneficio(409, 'Ya habías canjeado este beneficio.');
    canje.estado = 'confirmado';
    canje.confirmadoAt = new Date();
    canje.comprobante = azar(6);
    await canje.save();
    await DomiCuenta.updateOne({ telefono: canje.telefono, email: canje.email }, { $set: { emailVerificadoAt: new Date() } });
  }
  return {
    beneficio: beneficio ? { titulo: beneficio.titulo, enlace: conCodigo(beneficio.enlace, canje.codigoDomi), imagen: beneficio.imagen } : null,
    comprobante: canje.comprobante,
    codigo: formatoCodigo(canje.codigoDomi),
    confirmadoAt: canje.confirmadoAt,
  };
}

/** Para la página del beneficio: ¿este código ya lo canjeó? (no revela datos de la persona) */
async function estadoPorCodigo(beneficioId, codigo) {
  const CanjeBeneficio = require('../Models/CanjeBeneficio');
  if (!mongoose.isValidObjectId(beneficioId)) throw new ErrorBeneficio(404, 'Ese beneficio ya no está.');
  const c = normalizarCodigo(codigo);
  if (!/^MB[A-Z0-9]{6}$/.test(c)) throw new ErrorBeneficio(400, 'Código inválido.', 'codigo_invalido');
  const canje = await CanjeBeneficio.findOne({ beneficioId, codigoDomi: c }).sort({ createdAt: -1 }).lean();
  if (!canje) return { estado: 'sin_canje' };
  return { estado: canje.estado, comprobante: canje.estado === 'confirmado' ? canje.comprobante : null };
}

/** Lista pública de beneficios activos (para la página que los muestre). */
async function publicos() {
  const Beneficio = require('../Models/Beneficio');
  const lista = await Beneficio.find({ activo: true }).sort({ createdAt: -1 }).lean();
  return lista.map((b) => ({ id: String(b._id), titulo: b.titulo, descripcion: b.descripcion, enlace: b.enlace, imagen: b.imagen }));
}

/* ═══════════════════════ Superadmin ═══════════════════════ */

function validar(datos, parcial = false) {
  const out = {};
  if (!parcial || datos.titulo != null) {
    const t = String(datos.titulo || '').trim();
    if (t.length < 3 || t.length > 80) throw new ErrorBeneficio(400, 'El título debe tener entre 3 y 80 letras.');
    out.titulo = t;
  }
  if (datos.descripcion != null) out.descripcion = String(datos.descripcion).trim().slice(0, 600);
  if (datos.enlace != null) {
    const e = String(datos.enlace).trim();
    if (e && !/^https?:\/\/\S+$/i.test(e)) throw new ErrorBeneficio(400, 'El enlace debe empezar por https://');
    out.enlace = e;
  }
  if (datos.activo != null) out.activo = datos.activo === true || datos.activo === 'true';
  return out;
}

async function subirImagen(archivo) {
  if (!archivo) return undefined;
  const { uploadImage, isSpacesConfigured } = require('./imageUploadService');
  if (!isSpacesConfigured()) throw new ErrorBeneficio(503, 'La subida de imágenes no está disponible.');
  const r = await uploadImage(archivo.buffer, 'beneficios', { maxWidth: 600, quality: 80 });
  return r?.url || r;
}

async function listarAdmin() {
  const Beneficio = require('../Models/Beneficio');
  const CanjeBeneficio = require('../Models/CanjeBeneficio');
  const [lista, conteos] = await Promise.all([
    Beneficio.find().sort({ createdAt: -1 }).lean(),
    CanjeBeneficio.aggregate([{ $group: { _id: { b: '$beneficioId', e: '$estado' }, n: { $sum: 1 } } }]),
  ]);
  const cuenta = (id, e) => conteos.find((c) => String(c._id.b) === String(id) && c._id.e === e)?.n || 0;
  return lista.map((b) => ({
    id: String(b._id), titulo: b.titulo, descripcion: b.descripcion, enlace: b.enlace, imagen: b.imagen, activo: b.activo,
    creadoAt: b.createdAt, canjes: { confirmados: cuenta(b._id, 'confirmado'), pendientes: cuenta(b._id, 'pendiente') },
  }));
}

async function crear(datos, archivo, quien) {
  const Beneficio = require('../Models/Beneficio');
  const campos = validar(datos);
  const imagen = await subirImagen(archivo);
  const b = await Beneficio.create({ ...campos, imagen: imagen || null, creadoPor: quien });
  return { id: String(b._id) };
}

async function editar(id, datos, archivo) {
  const Beneficio = require('../Models/Beneficio');
  if (!mongoose.isValidObjectId(id)) throw new ErrorBeneficio(404, 'Beneficio no encontrado.');
  const campos = validar(datos, true);
  const imagen = await subirImagen(archivo);
  if (imagen) campos.imagen = imagen;
  if (datos.quitarImagen === true || datos.quitarImagen === 'true') campos.imagen = null;
  const b = await Beneficio.findByIdAndUpdate(id, { $set: campos }, { new: true });
  if (!b) throw new ErrorBeneficio(404, 'Beneficio no encontrado.');
  return { ok: true };
}

async function eliminar(id) {
  const Beneficio = require('../Models/Beneficio');
  if (!mongoose.isValidObjectId(id)) throw new ErrorBeneficio(404, 'Beneficio no encontrado.');
  const r = await Beneficio.deleteOne({ _id: id });
  if (!r.deletedCount) throw new ErrorBeneficio(404, 'Beneficio no encontrado.');
  return { ok: true };
}

async function canjesAdmin(beneficioId) {
  const CanjeBeneficio = require('../Models/CanjeBeneficio');
  const DeliveryPerson = require('../Models/DeliveryPerson');
  if (!mongoose.isValidObjectId(beneficioId)) throw new ErrorBeneficio(404, 'Beneficio no encontrado.');
  const lista = await CanjeBeneficio.find({ beneficioId }).sort({ createdAt: -1 }).limit(500).lean();
  const tels = [...new Set(lista.map((c) => c.telefono))];
  const perfiles = await DeliveryPerson.find({ phone: { $in: tels.flatMap((t) => reglas.variantesTelefono(t)) } }).select('name phone').lean();
  const nombre = (t) => perfiles.find((p) => reglas.variantesTelefono(t).includes(p.phone))?.name || 'Domiciliario';
  return lista.map((c) => ({
    id: String(c._id), nombre: nombre(c.telefono), telefono: c.telefono, codigo: formatoCodigo(c.codigoDomi),
    correo: c.email, origen: c.origen, estado: c.estado, comprobante: c.comprobante, pedidoAt: c.createdAt, confirmadoAt: c.confirmadoAt,
  }));
}

module.exports = {
  ErrorBeneficio,
  normalizarCodigo,
  formatoCodigo,
  ocultarCorreo,
  asegurarCodigo,
  paraDomi,
  guardarCorreo,
  pedirCanje,
  confirmar,
  estadoPorCodigo,
  publicos,
  listarAdmin,
  crear,
  editar,
  eliminar,
  canjesAdmin,
};
