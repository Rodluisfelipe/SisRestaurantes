const mongoose = require('mongoose');
const { seal, open, hint } = require('../utils/secretBox');

/**
 * Cuenta de Spotify de un local, para mostrar en el menú qué está sonando.
 *
 * Cada negocio trae SU PROPIA app de Spotify (client id + secret). Es más
 * fricción para el dueño —tiene que crearla en el dashboard de developers—
 * pero es lo que hace que esto escale: una app compartida de MenuBy nace en
 * modo desarrollo, limitada a 25 usuarios que hay que autorizar a mano uno por
 * uno, y salir de ahí depende de que Spotify apruebe una solicitud. Con una app
 * por local, cada una necesita un solo usuario: el dueño.
 *
 * Nada sensible se guarda en claro: el secret y los tokens van cifrados con el
 * mismo secretBox que usa la cuenta de WhatsApp.
 */
const spotifyAccountSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessConfig',
    required: true,
    unique: true,
    index: true
  },

  // Credenciales de la app del local
  clientId: { type: String, trim: true, default: '' },
  clientSecretEnc: { type: String, default: '' },

  // Tokens de la cuenta conectada
  refreshTokenEnc: { type: String, default: '' },
  accessTokenEnc: { type: String, default: '' },
  /* El access token de Spotify dura una hora. Se guarda cuándo vence para
     renovarlo antes de pedir la canción, en vez de descubrirlo con un 401. */
  accessTokenExpiresAt: { type: Date, default: null },

  displayName: { type: String, trim: true, default: '' },

  // El dueño puede apagar el banner sin desconectar la cuenta.
  activo: { type: Boolean, default: true },

  status: {
    type: String,
    enum: ['sin_conectar', 'conectado', 'error'],
    default: 'sin_conectar'
  },
  lastError: { type: String, default: '' },
  lastPlayingAt: { type: Date, default: null }
}, { timestamps: true });

spotifyAccountSchema.methods.setClientSecret = function (valor) {
  this.clientSecretEnc = seal(valor);
  return this;
};
spotifyAccountSchema.methods.getClientSecret = function () {
  return this.clientSecretEnc ? open(this.clientSecretEnc) : '';
};

spotifyAccountSchema.methods.setRefreshToken = function (valor) {
  this.refreshTokenEnc = seal(valor);
  return this;
};
spotifyAccountSchema.methods.getRefreshToken = function () {
  return this.refreshTokenEnc ? open(this.refreshTokenEnc) : '';
};

spotifyAccountSchema.methods.setAccessToken = function (valor, expiraEnSegundos) {
  this.accessTokenEnc = seal(valor);
  // Un minuto de margen: si el token vence mientras viaja la petición a
  // Spotify, la respuesta sería un 401 y el banner quedaría en blanco.
  this.accessTokenExpiresAt = new Date(Date.now() + (Number(expiraEnSegundos || 3600) - 60) * 1000);
  return this;
};
spotifyAccountSchema.methods.getAccessToken = function () {
  return this.accessTokenEnc ? open(this.accessTokenEnc) : '';
};

spotifyAccountSchema.methods.accessTokenVigente = function () {
  return !!this.accessTokenEnc && this.accessTokenExpiresAt && this.accessTokenExpiresAt > new Date();
};

/** Vista para el panel: nunca sale el secret ni los tokens, ni cifrados. */
spotifyAccountSchema.methods.toPanel = function () {
  return {
    _id: this._id,
    businessId: this.businessId,
    clientId: this.clientId,
    clientSecretPista: this.clientSecretEnc ? hint(this.getClientSecret()) : '',
    conectado: !!this.refreshTokenEnc,
    displayName: this.displayName,
    activo: this.activo,
    status: this.status,
    lastError: this.lastError,
    lastPlayingAt: this.lastPlayingAt,
  };
};

module.exports = mongoose.models.SpotifyAccount || mongoose.model('SpotifyAccount', spotifyAccountSchema);
