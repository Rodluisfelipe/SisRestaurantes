const mongoose = require('mongoose');
const crypto = require('crypto');
const { seal, open } = require('../utils/secretBox');

/**
 * Las llaves de Bold de un negocio, para cobrar con tarjeta en el menú.
 *
 * Bold entrega dos llaves y **no son lo mismo**:
 *
 * - La **de identidad** va en el navegador, dentro de la configuración del
 *   botón. Es pública por diseño: cualquiera que abra el menú la ve.
 * - La **secreta** firma el monto para que nadie lo altere entre nuestro
 *   servidor y la pasarela. Si se filtra, alguien puede firmar un cobro de
 *   $1.000 por un pedido de $80.000 y Bold lo va a aceptar. Por eso se guarda
 *   cifrada, igual que el token de WhatsApp.
 *
 * El entorno se declara a mano y no se adivina: Bold entrega las llaves de
 * pruebas y las de producción en la misma pantalla del panel y por fuera se
 * ven iguales. Cobrar de verdad creyendo que se está probando es el error que
 * este campo existe para evitar.
 */
const boldCuentaSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessConfig',
    required: true,
    unique: true,
    index: true,
  },

  /* Pública: va al navegador tal cual. */
  identidad: { type: String, default: '', trim: true },

  /* Cifrada con AES-256-GCM. Nunca sale del servidor en claro. */
  secretaEnc: { type: String, default: '' },
  /* Los últimos cuatro caracteres, para que el dueño reconozca cuál puso sin
     que el panel tenga que mostrarla. */
  secretaPista: { type: String, default: '' },

  entorno: {
    type: String,
    enum: ['pruebas', 'produccion'],
    default: 'pruebas',
  },

  /* Apagado = el menú no ofrece tarjeta, aunque las llaves estén puestas.
     Sirve para dejarlo listo y encenderlo el día que el negocio quiera. */
  activa: { type: Boolean, default: false },

  /**
   * El secreto de la URL del webhook.
   *
   * Bold avisa por webhook cuando un pago se completa, y ese aviso es lo único
   * que dice si un pedido está pagado. La URL lleva este token adentro para
   * que no baste con adivinar la dirección: sin él, cualquiera podría marcar
   * pedidos como pagados con un POST.
   *
   * **No reemplaza la verificación de firma de Bold**, que todavía está
   * pendiente de su documentación. Es lo que se puede hacer mientras tanto.
   */
  webhookToken: {
    type: String,
    default: () => crypto.randomBytes(24).toString('hex'),
  },

  ultimoPagoAt: { type: Date, default: null },
  ultimoError: { type: String, default: '' },
}, { timestamps: true });

boldCuentaSchema.methods.setSecreta = function (valor) {
  const limpia = String(valor || '').trim();
  this.secretaEnc = limpia ? seal(limpia) : '';
  this.secretaPista = limpia ? limpia.slice(-4) : '';
  return this;
};

boldCuentaSchema.methods.getSecreta = function () {
  return this.secretaEnc ? open(this.secretaEnc) : '';
};

/** Vista para el panel: sin la secreta, ni cifrada ni en claro. */
boldCuentaSchema.methods.toPanel = function () {
  return {
    identidad: this.identidad,
    secretaPuesta: !!this.secretaEnc,
    secretaPista: this.secretaPista,
    entorno: this.entorno,
    activa: this.activa,
    /* La URL completa la arma la ruta: acá no se sabe el dominio. */
    webhookToken: this.webhookToken,
    ultimoPagoAt: this.ultimoPagoAt,
    ultimoError: this.ultimoError,
  };
};

/** ¿Puede cobrar? Encendida y con las dos llaves. */
boldCuentaSchema.methods.lista = function () {
  return this.activa && !!this.identidad && !!this.secretaEnc;
};

module.exports =
  mongoose.models.BoldCuenta || mongoose.model('BoldCuenta', boldCuentaSchema);
