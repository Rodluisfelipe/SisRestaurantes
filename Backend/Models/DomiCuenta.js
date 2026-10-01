const mongoose = require('mongoose');

/**
 * La cuenta del domiciliario en la app v2: una por celular.
 *
 * Cada negocio registra a sus domis en DeliveryPerson (y una empresa aliada a
 * los suyos). La misma persona puede estar en varios; aquí se junta todo lo
 * que es de la persona y no de un negocio: la sesión, el candado contra
 * intentos de PIN y sus preferencias.
 */
const domiCuentaSchema = new mongoose.Schema({
  // Celular en 10 dígitos (sin 57)
  telefono: { type: String, required: true, unique: true, trim: true },
  // El PIN de la persona (uno solo, para todos sus negocios). Ver utils/pinDomi.js
  pinHash: { type: String, default: null },
  // Sesión larga: hash del token de renovación vigente (rota en cada uso)
  refreshHash: { type: String, default: null },
  // Candado: un PIN de 4 dígitos se adivina en minutos sin esto
  fallos: { type: Number, default: 0 },
  bloqueadaHasta: { type: Date, default: null },
  ultimoIngreso: { type: Date, default: null },
  // Plataforma y versión de la app, para soporte
  dispositivo: {
    plataforma: { type: String, default: '' },
    version: { type: String, default: '' },
  },
  // Contra trampas: el último reporte de la app y las veces que se pilló GPS falso
  seguridad: {
    alterada: { type: Boolean, default: false },
    motivos: { type: [String], default: [] },
    avisos: { type: [String], default: [] },
    revisadaAt: { type: Date, default: null },
    simuladas: { type: Number, default: 0 },
    saltos: { type: Number, default: 0 },
    ultimaTrampaAt: { type: Date, default: null },
    // Último punto de GPS bueno: ancla para pillar saltos imposibles
    ultimoPunto: { lat: Number, lng: Number, at: Date },
  },
  // Código único del domi (MB-XXXXXX): con él canjea beneficios fuera de la app
  codigo: { type: String, trim: true, uppercase: true },
  // Correo para confirmar canjes (los de la Red lo traen del registro)
  email: { type: String, lowercase: true, trim: true, maxlength: 120, default: null },
  emailVerificadoAt: { type: Date, default: null },
  // Nivel (Go → MenuBy Black). Ver utils/nivelesDomi.js
  nivel: {
    actual: { type: Number, default: 0 },
    desde: { type: Date, default: null },
    // Escudo: recién subido no baja hasta esta fecha
    protegidoHasta: { type: Date, default: null },
    // Última vez que se recalcularon las métricas
    calculadoAt: { type: Date, default: null },
    // La última revisión mensual (bajar de nivel solo se decide en ella)
    revisadoAt: { type: Date, default: null },
  },
  // Aceptación automática de ofertas (el domi la activa; ver services/autoAceptar.js)
  autoAcepta: {
    activo: { type: Boolean, default: false },
    kmMax: { type: Number, default: 3 },
    gananciaMin: { type: Number, default: 0 },
    maxPedidos: { type: Number, default: 1 },
    // Pedidos auto-aceptados que no atendió (se reinicia con cada entrega buena)
    fallos: { type: Number, default: 0 },
    // Por qué se apagó sola, para explicárselo
    apagadaPor: { type: String, default: null },
    apagadaAt: { type: Date, default: null },
  },
}, { timestamps: true });

domiCuentaSchema.index({ codigo: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('DomiCuenta', domiCuentaSchema);
