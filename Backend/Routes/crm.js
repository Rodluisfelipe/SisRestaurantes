const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const authSuperAdmin = require('../middleware/authSuperAdmin');
const { Lead, LeadActividad, ETAPAS, FUENTES } = require('../Models/Lead');
const WhatsAppAccount = require('../Models/WhatsAppAccount');
const WhatsAppMessage = require('../Models/WhatsAppMessage');
const SuperAdmin = require('../Models/SuperAdmin');
const BusinessConfig = require('../Models/BusinessConfig');
const whatsappCloud = require('../services/whatsappCloud');
const { PLATAFORMA_ID, normalizarTelefono, actividad, registrarMensaje } = require('../services/leads');
const logger = require('../utils/logger');

/**
 * CRM de leads del superadmin (/api/superadmin/crm).
 *
 * Leer: cualquiera del equipo. Escribir: soporte hacia arriba (el auditor solo
 * mira). Borrar leads: admin hacia arriba.
 */
router.use(authSuperAdmin.protectSuperAdmin);
const { requireRole } = authSuperAdmin;

/* Express 4 no atrapa los errores de las funciones async: se envuelven todas
   para que un fallo devuelva 500 en vez de dejar la petición colgada. */
const asyncHandler = require('../utils/asyncHandler');
for (const metodo of ['get', 'post', 'put', 'delete']) {
  const original = router[metodo].bind(router);
  router[metodo] = (ruta, ...fns) => original(ruta, ...fns.map((f) => (f.constructor.name === 'AsyncFunction' ? asyncHandler(f) : f)));
}
const escribe = requireRole('support');

const quien = (req) => ({ id: req.user?.id || null, nombre: req.user?.name || '' });
const escapar = (t) => String(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const limpio = (v, max = 120) => String(v ?? '').trim().slice(0, max);

const cuentaPlataforma = () => WhatsAppAccount.findOne({ businessId: PLATAFORMA_ID });

/* ───────────── Resumen para la cabecera y el embudo ───────────── */
router.get('/resumen', async (req, res) => {
  const hace30 = new Date(Date.now() - 30 * 86400000);
  const ahora = new Date();
  const [porEtapa, porFuente, nuevos30, ganados30, vencidas, sinLeer] = await Promise.all([
    Lead.aggregate([{ $group: { _id: '$etapa', n: { $sum: 1 }, valor: { $sum: '$valorEstimado' } } }]),
    Lead.aggregate([{ $match: { createdAt: { $gte: hace30 } } }, { $group: { _id: '$fuente', n: { $sum: 1 }, ganados: { $sum: { $cond: [{ $eq: ['$etapa', 'ganado'] }, 1, 0] } } } }]),
    Lead.countDocuments({ createdAt: { $gte: hace30 } }),
    Lead.countDocuments({ etapa: 'ganado', ganadoEn: { $gte: hace30 } }),
    Lead.countDocuments({ etapa: { $nin: ['ganado', 'perdido'] }, 'proximaAccion.fecha': { $lte: ahora } }),
    Lead.countDocuments({ noLeidos: { $gt: 0 } }),
  ]);
  res.json({
    etapas: ETAPAS.map((e) => ({ etapa: e, n: porEtapa.find((x) => x._id === e)?.n || 0, valor: porEtapa.find((x) => x._id === e)?.valor || 0 })),
    fuentes: porFuente.map((f) => ({ fuente: f._id, n: f.n, ganados: f.ganados })).sort((a, b) => b.n - a.n),
    nuevos30,
    ganados30,
    vencidas,
    sinLeer,
  });
});

/* ───────────── Lista de leads ───────────── */
router.get('/leads', async (req, res) => {
  const filtro = {};
  if (ETAPAS.includes(req.query.etapa)) filtro.etapa = req.query.etapa;
  if (FUENTES.includes(req.query.fuente)) filtro.fuente = req.query.fuente;
  if (req.query.responsable === 'yo') filtro['responsable.id'] = req.user.id;
  if (req.query.pendientes === '1') {
    filtro.etapa = { $nin: ['ganado', 'perdido'] };
    filtro['proximaAccion.fecha'] = { $lte: new Date() };
  }
  if (req.query.sinLeer === '1') filtro.noLeidos = { $gt: 0 };
  const q = limpio(req.query.q, 60);
  if (q) {
    const re = new RegExp(escapar(q), 'i');
    const tel = q.replace(/\D/g, '');
    filtro.$or = [{ nombre: re }, { negocio: re }, { email: re }, { ciudad: re }, ...(tel.length >= 4 ? [{ telefono: new RegExp(escapar(tel)) }] : [])];
  }
  const leads = await Lead.find(filtro).sort({ noLeidos: -1, updatedAt: -1 }).limit(Math.min(Number(req.query.limite) || 500, 1000)).lean();
  res.json({ leads });
});

router.post('/leads', escribe, async (req, res) => {
  const b = req.body || {};
  const telefono = normalizarTelefono(b.telefono);
  if (!limpio(b.nombre) && !limpio(b.negocio) && !telefono) return res.status(400).json({ message: 'Escribe al menos el nombre, el negocio o el teléfono.' });
  if (b.telefono && !telefono) return res.status(400).json({ message: 'El teléfono no es válido.' });
  try {
    const lead = await Lead.create({
      nombre: limpio(b.nombre), negocio: limpio(b.negocio), telefono, email: limpio(b.email, 160), ciudad: limpio(b.ciudad, 80),
      tipoNegocio: limpio(b.tipoNegocio, 60), fuente: FUENTES.includes(b.fuente) ? b.fuente : 'manual', origen: limpio(b.origen),
      etapa: ETAPAS.includes(b.etapa) ? b.etapa : 'nuevo', valorEstimado: Math.max(0, Math.round(Number(b.valorEstimado) || 0)),
      planInteres: limpio(b.planInteres, 40), responsable: { id: req.user.id, nombre: req.user.name || '' },
    });
    await actividad(lead._id, 'sistema', 'Lead creado a mano', quien(req));
    res.status(201).json({ lead });
  } catch (e) {
    if (e.code === 11000) {
      const existe = await Lead.findOne({ telefono }).select('_id nombre negocio').lean();
      return res.status(409).json({ message: `Ese teléfono ya es un lead: ${existe?.negocio || existe?.nombre || ''}`.trim(), leadId: existe?._id });
    }
    logger.error('[CRM] crear lead', e);
    res.status(500).json({ message: 'No se pudo crear el lead' });
  }
});

/* ───────────── Un lead: datos, actividad y conversación ───────────── */
async function cargarLead(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) { res.status(404).json({ message: 'Lead no encontrado' }); return null; }
  const lead = await Lead.findById(req.params.id);
  if (!lead) { res.status(404).json({ message: 'Lead no encontrado' }); return null; }
  return lead;
}

router.get('/leads/:id', async (req, res) => {
  const lead = await cargarLead(req, res);
  if (!lead) return;
  const [actividades, mensajes, negocio] = await Promise.all([
    LeadActividad.find({ leadId: lead._id }).sort({ fecha: -1 }).limit(200).lean(),
    lead.telefono
      ? WhatsAppMessage.find({ businessId: PLATAFORMA_ID, contactPhone: lead.telefono }).sort({ sentAt: -1 }).limit(200)
        .select('direction type text transcripcion status sentAt errorMessage').lean()
      : [],
    lead.businessId ? BusinessConfig.findById(lead.businessId).select('businessName slug createdAt').lean() : null,
  ]);
  const ultimoEntrante = mensajes.find((m) => m.direction === 'in');
  const ventanaAbierta = !!ultimoEntrante && Date.now() - new Date(ultimoEntrante.sentAt).getTime() < 24 * 3600000;
  res.json({ lead, actividades, mensajes: mensajes.reverse(), negocio, ventanaAbierta });
});

const CAMPOS = ['nombre', 'negocio', 'email', 'ciudad', 'tipoNegocio', 'origen', 'motivoPerdida', 'planInteres'];

router.put('/leads/:id', escribe, async (req, res) => {
  const lead = await cargarLead(req, res);
  if (!lead) return;
  const b = req.body || {};
  const antes = lead.etapa;
  for (const c of CAMPOS) if (b[c] !== undefined) lead[c] = limpio(b[c], c === 'email' ? 160 : c === 'motivoPerdida' ? 200 : 120);
  if (b.telefono !== undefined) {
    const tel = b.telefono ? normalizarTelefono(b.telefono) : '';
    if (b.telefono && !tel) return res.status(400).json({ message: 'El teléfono no es válido.' });
    lead.telefono = tel;
  }
  if (b.fuente !== undefined && FUENTES.includes(b.fuente)) lead.fuente = b.fuente;
  if (b.valorEstimado !== undefined) lead.valorEstimado = Math.max(0, Math.round(Number(b.valorEstimado) || 0));
  if (Array.isArray(b.etiquetas)) lead.etiquetas = b.etiquetas.map((t) => limpio(t, 30)).filter(Boolean).slice(0, 12);
  if (b.proximaAccion !== undefined) {
    lead.proximaAccion = { texto: limpio(b.proximaAccion?.texto, 200), fecha: b.proximaAccion?.fecha ? new Date(b.proximaAccion.fecha) : null };
  }
  if (b.responsableId !== undefined) {
    if (!b.responsableId) lead.responsable = { id: null, nombre: '' };
    else {
      const sa = mongoose.isValidObjectId(b.responsableId) ? await SuperAdmin.findById(b.responsableId).select('name').lean() : null;
      if (!sa) return res.status(400).json({ message: 'Esa persona no está en el equipo.' });
      lead.responsable = { id: sa._id, nombre: sa.name || '' };
    }
  }
  if (b.etapa !== undefined && ETAPAS.includes(b.etapa) && b.etapa !== antes) {
    if (b.etapa === 'perdido' && !limpio(b.motivoPerdida ?? lead.motivoPerdida)) return res.status(400).json({ message: 'Escribe por qué se perdió.' });
    lead.etapa = b.etapa;
    lead.ganadoEn = b.etapa === 'ganado' ? new Date() : lead.ganadoEn;
  }
  try {
    await lead.save();
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ message: 'Ese teléfono ya es de otro lead.' });
    throw e;
  }
  if (lead.etapa !== antes) {
    const nombres = { nuevo: 'Nuevo', contactado: 'Contactado', interesado: 'Interesado', demo: 'Demo', negociacion: 'Negociación', ganado: 'Ganado', perdido: 'Perdido' };
    await actividad(lead._id, 'etapa', `${nombres[antes]} → ${nombres[lead.etapa]}${lead.etapa === 'perdido' && lead.motivoPerdida ? ` (${lead.motivoPerdida})` : ''}`, quien(req));
  }
  res.json({ lead });
});

router.delete('/leads/:id', requireRole('admin'), async (req, res) => {
  const lead = await cargarLead(req, res);
  if (!lead) return;
  await LeadActividad.deleteMany({ leadId: lead._id });
  await lead.deleteOne();
  res.json({ ok: true });
});

router.post('/leads/:id/actividades', escribe, async (req, res) => {
  const lead = await cargarLead(req, res);
  if (!lead) return;
  const tipo = ['nota', 'llamada', 'reunion'].includes(req.body?.tipo) ? req.body.tipo : 'nota';
  const texto = limpio(req.body?.texto, 2000);
  if (!texto) return res.status(400).json({ message: 'Escribe algo.' });
  const a = await actividad(lead._id, tipo, texto, quien(req));
  lead.ultimoContacto = tipo === 'nota' ? lead.ultimoContacto : new Date();
  if (lead.etapa === 'nuevo' && tipo !== 'nota') {
    lead.etapa = 'contactado';
    await actividad(lead._id, 'etapa', 'Nuevo → Contactado', quien(req));
  }
  await lead.save();
  res.status(201).json({ actividad: a, lead });
});

router.post('/leads/:id/leido', async (req, res) => {
  const lead = await cargarLead(req, res);
  if (!lead) return;
  if (lead.noLeidos) { lead.noLeidos = 0; await lead.save(); }
  res.json({ ok: true });
});

/* ───────────── WhatsApp de Menuby ───────────── */
router.post('/leads/:id/whatsapp', escribe, async (req, res) => {
  const lead = await cargarLead(req, res);
  if (!lead) return;
  if (!lead.telefono) return res.status(400).json({ message: 'Este lead no tiene teléfono.' });
  const account = await cuentaPlataforma();
  if (!account || account.status !== 'active') return res.status(503).json({ message: 'El WhatsApp de Menuby todavía no está conectado.' });
  try {
    const plantilla = limpio(req.body?.plantilla, 120);
    const enviado = plantilla
      ? await whatsappCloud.enviarPlantilla({ account, to: lead.telefono, nombre: plantilla, idioma: limpio(req.body?.idioma, 10) || 'es', variables: Array.isArray(req.body?.variables) ? req.body.variables.map((v) => limpio(v, 200)) : [] })
      : await whatsappCloud.sendText({ account, to: lead.telefono, text: limpio(req.body?.texto, 4000), sentBy: req.user.id });
    await registrarMensaje({ telefono: lead.telefono, texto: enviado.text, direccion: 'out' });
    if (lead.etapa === 'nuevo') {
      await Lead.updateOne({ _id: lead._id }, { $set: { etapa: 'contactado' } });
      await actividad(lead._id, 'etapa', 'Nuevo → Contactado', quien(req));
    }
    res.status(201).json({ mensaje: enviado });
  } catch (e) {
    if (e.code === 'OUTSIDE_WINDOW') return res.status(409).json({ message: e.message, fueraDeVentana: true });
    logger.warn('[CRM] No se pudo enviar el WhatsApp', { error: e.message });
    res.status(400).json({ message: e.message || 'No se pudo enviar' });
  }
});

router.get('/whatsapp', async (req, res) => {
  const account = await cuentaPlataforma();
  let plantillas = [];
  if (account?.status === 'active' && account.wabaId) {
    try {
      plantillas = (await whatsappCloud.listarPlantillas({ wabaId: account.wabaId, accessToken: account.getAccessToken() }))
        .filter((p) => p.status === 'APPROVED')
        .map((p) => ({ nombre: p.name, idioma: p.language, cuerpo: (p.components || []).find((c) => c.type === 'BODY')?.text || '' }));
    } catch { /* sin plantillas no pasa nada */ }
  }
  res.json({
    cuenta: account ? { numero: account.displayNumber, nombre: account.verifiedName, estado: account.status, error: account.lastError, conectadaEn: account.connectedAt } : null,
    enlaceDisponible: !!process.env.WHATSAPP_SIGNUP_URL,
    plantillas,
  });
});

// El enlace de Meta (Coexistencia) firmado para la cuenta de plataforma.
router.get('/whatsapp/enlace', requireRole('admin'), (req, res) => {
  const base = process.env.WHATSAPP_SIGNUP_URL;
  if (!base) return res.status(503).json({ message: 'Falta configurar WHATSAPP_SIGNUP_URL en el servidor.' });
  const { firmarNegocio } = require('./whatsappInbox');
  const sep = base.includes('?') ? '&' : '?';
  res.json({ enlace: `${base}${sep}state=${encodeURIComponent(firmarNegocio(PLATAFORMA_ID))}` });
});

// Conexión manual (Phone number ID + WABA ID + token permanente).
router.post('/whatsapp/manual', requireRole('admin'), async (req, res) => {
  const phoneNumberId = limpio(req.body?.phoneNumberId, 40);
  const wabaId = limpio(req.body?.wabaId, 40);
  const accessToken = String(req.body?.accessToken || '').trim();
  if (!phoneNumberId || !accessToken) return res.status(400).json({ message: 'Faltan el Phone number ID y el token.' });
  const ajeno = await WhatsAppAccount.findOne({ phoneNumberId, businessId: { $ne: PLATAFORMA_ID } }).lean();
  if (ajeno) return res.status(409).json({ message: 'Ese número ya está conectado a un negocio.' });
  let datos;
  try {
    datos = await whatsappCloud.verifyCredentials({ phoneNumberId, accessToken });
  } catch (e) {
    return res.status(400).json({ message: `Meta rechazó las credenciales: ${e.message}` });
  }
  let aviso = '';
  try { await whatsappCloud.subscribeAppToWaba({ wabaId, accessToken }); } catch (e) { aviso = `No se pudo autorizar a Menuby a recibir los mensajes (${e.message}).`; }
  const account = (await cuentaPlataforma()) || new WhatsAppAccount({ businessId: PLATAFORMA_ID });
  account.phoneNumberId = phoneNumberId;
  account.wabaId = wabaId;
  account.displayNumber = datos?.displayNumber || datos?.display_phone_number || '';
  account.verifiedName = datos?.verifiedName || datos?.verified_name || '';
  account.setAccessToken(accessToken);
  account.status = 'active';
  account.lastError = '';
  account.connectedVia = 'manual';
  account.connectedAt = new Date();
  await account.save();
  res.json({ ok: true, aviso });
});

router.get('/equipo', async (req, res) => {
  const equipo = await SuperAdmin.find({ active: { $ne: false } }).select('name email').sort({ name: 1 }).lean();
  res.json({ equipo: equipo.map((p) => ({ _id: p._id, nombre: p.name || p.email })) });
});

module.exports = router;
