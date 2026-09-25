const mongoose = require('mongoose');

/**
 * Asistencia del equipo: quién entra y quién sale, en qué sede y a qué hora.
 *
 * Cuatro piezas:
 *   - AsistenciaPersona: cada empleado con su PIN. Aparte de las cuentas de
 *     staff (roles del panel): aquí solo se necesita un nombre y un PIN.
 *   - AsistenciaSede: cada local con su link público (`clave`) y el código que
 *     muestra el QR en ese momento. El código cambia con cada escaneo.
 *   - AsistenciaMarca: cada entrada o salida.
 *   - AsistenciaConfig: a qué chats de Telegram se avisa.
 */

const personaSchema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessConfig', required: true, index: true },
  nombre: { type: String, required: true, trim: true, maxlength: 60 },
  // HMAC del PIN (ver utils/asistencia). Permite buscar a la persona por su
  // PIN sin guardarlo en claro, y que dos personas no tengan el mismo.
  pinHash: { type: String, required: true },
  activo: { type: Boolean, default: true },
  // Sedes donde puede marcar. Vacío = cualquiera.
  sedes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'AsistenciaSede' }],
}, { timestamps: true });
personaSchema.index({ businessId: 1, pinHash: 1 }, { unique: true });

const sedeSchema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessConfig', required: true, index: true },
  nombre: { type: String, required: true, trim: true, maxlength: 60 },
  // Va en el link público de la pantalla: /asistencia/:clave
  clave: { type: String, required: true, unique: true },
  // Lo que codifica el QR ahora mismo. Se reemplaza en cada escaneo.
  codigo: { type: String, required: true },
  // Dónde queda el local (del link de Google Maps o del GPS del dueño).
  ubicacion: {
    lat: Number,
    lng: Number,
  },
  mapsUrl: { type: String, default: '' },
}, { timestamps: true });

const marcaSchema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessConfig', required: true },
  personaId: { type: mongoose.Schema.Types.ObjectId, ref: 'AsistenciaPersona', required: true },
  // Copias: el reporte sigue mostrando el nombre aunque la persona se borre
  // o la sede cambie de nombre.
  nombre: { type: String, required: true },
  sedeId: { type: mongoose.Schema.Types.ObjectId, ref: 'AsistenciaSede' },
  sedeNombre: { type: String, default: '' },
  tipo: { type: String, enum: ['entrada', 'salida'], required: true },
  fecha: { type: Date, required: true, default: Date.now },
  ubicacion: {
    lat: Number,
    lng: Number,
    precision: Number, // metros
  },
  // Metros entre el celular y la sede al marcar (si la sede tiene ubicación).
  distancia: Number,
  // Candado contra la doble marca: una por persona por minuto, aunque lleguen
  // dos peticiones al mismo tiempo (dos toques, dos celulares, dos servidores).
  candado: { type: String, required: true },
}, { timestamps: false });
marcaSchema.index({ candado: 1 }, { unique: true });
marcaSchema.index({ businessId: 1, fecha: -1 });
marcaSchema.index({ personaId: 1, fecha: -1 });

const configSchema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessConfig', required: true, unique: true },
  telegram: {
    // Una sola persona recibe todos los avisos (el arreglo queda con 0 o 1).
    chats: [{
      _id: false,
      chatId: { type: String, required: true },
      nombre: { type: String, default: '' },
    }],
    // Código para vincular un chat: el dueño abre t.me/<bot>?start=<codigo>
    vinculo: {
      codigo: { type: String, default: null },
      expira: { type: Date, default: null },
    },
  },
}, { timestamps: true });
configSchema.index({ 'telegram.vinculo.codigo': 1 });

module.exports = {
  AsistenciaPersona: mongoose.model('AsistenciaPersona', personaSchema),
  AsistenciaSede: mongoose.model('AsistenciaSede', sedeSchema),
  AsistenciaMarca: mongoose.model('AsistenciaMarca', marcaSchema),
  AsistenciaConfig: mongoose.model('AsistenciaConfig', configSchema),
};
