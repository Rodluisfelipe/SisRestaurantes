const mongoose = require('mongoose');
const { Lead, LeadActividad } = require('../Models/Lead');
const logger = require('../utils/logger');

/**
 * Cómo entran y se mueven los leads del CRM de Menuby.
 *
 * El WhatsApp de Menuby es una "cuenta de plataforma": usa el mismo webhook
 * que los restaurantes, pero sus mensajes se guardan con este id de negocio
 * que no existe. Así toda la maquinaria de WhatsApp sirve sin cambios y nada
 * de esto aparece en los listados de negocios.
 */
const PLATAFORMA_ID = new mongoose.Types.ObjectId('000000000000000000000001');

const esPlataforma = (businessId) => String(businessId || '') === String(PLATAFORMA_ID);

/** 57 + 10 dígitos para celulares colombianos; el resto, solo dígitos. */
function normalizarTelefono(raw) {
  let t = String(raw || '').replace(/\D/g, '');
  if (/^3\d{9}$/.test(t)) t = `57${t}`;
  else if (t.startsWith('0')) t = `57${t.slice(1)}`;
  return t.length >= 10 && t.length <= 15 ? t : '';
}

async function actividad(leadId, tipo, texto, por = {}) {
  return LeadActividad.create({ leadId, tipo, texto: String(texto || '').slice(0, 2000), por: { id: por.id || null, nombre: por.nombre || '' } });
}

/**
 * Un mensaje del WhatsApp de Menuby: crea el lead si es nuevo y deja
 * actualizado lo último que se habló.
 */
async function registrarMensaje({ telefono, nombre = '', texto = '', direccion = 'in', fecha = new Date() }) {
  const tel = normalizarTelefono(telefono);
  if (!tel) return null;
  const vista = String(texto || '').slice(0, 160);
  const cambios = {
    $set: {
      ultimoMensaje: { texto: vista, direccion, fecha },
      ultimoContacto: fecha,
    },
  };
  if (direccion === 'in') cambios.$inc = { noLeidos: 1 };
  try {
    let lead = await Lead.findOneAndUpdate({ telefono: tel }, cambios, { new: true });
    if (!lead && direccion === 'in') {
      lead = await Lead.create({
        telefono: tel, nombre: String(nombre || '').slice(0, 120), fuente: 'whatsapp',
        ultimoMensaje: { texto: vista, direccion, fecha }, ultimoContacto: fecha, noLeidos: 1,
      });
      await actividad(lead._id, 'sistema', 'Escribió por primera vez al WhatsApp de Menuby');
    } else if (lead && nombre && !lead.nombre) {
      lead.nombre = String(nombre).slice(0, 120);
      await lead.save();
    }
    return lead;
  } catch (e) {
    // Dos mensajes seguidos de un número nuevo: el segundo choca con el índice.
    if (e.code === 11000) return Lead.findOneAndUpdate({ telefono: tel }, cambios, { new: true });
    logger.error('[CRM] No se pudo registrar el mensaje en el lead', { error: e.message });
    return null;
  }
}

/** Un negocio que se registró en Menuby entra (o se une) al CRM. */
async function registrarRegistro({ businessId, negocio, nombre, telefono, email, tipoNegocio }) {
  try {
    const tel = normalizarTelefono(telefono);
    const existente = tel ? await Lead.findOne({ telefono: tel }) : null;
    if (existente) {
      existente.businessId = businessId;
      if (!existente.negocio) existente.negocio = negocio || '';
      if (!existente.email) existente.email = email || '';
      await existente.save();
      await actividad(existente._id, 'sistema', `Se registró en Menuby: ${negocio}`);
      return existente;
    }
    const lead = await Lead.create({
      nombre: nombre || '', negocio: negocio || '', telefono: tel, email: email || '',
      tipoNegocio: tipoNegocio || '', fuente: 'registro', businessId,
    });
    await actividad(lead._id, 'sistema', `Se registró en Menuby: ${negocio}`);
    return lead;
  } catch (e) {
    logger.warn('[CRM] No se pudo crear el lead del registro', { error: e.message });
    return null;
  }
}

module.exports = { PLATAFORMA_ID, esPlataforma, normalizarTelefono, actividad, registrarMensaje, registrarRegistro };
