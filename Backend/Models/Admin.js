const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const adminSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: function() { return this.authProvider === 'local'; }
  },
  name: {
    type: String,
    default: null
  },
  avatar: {
    type: String,
    default: null
  },
  googleId: {
    type: String,
    default: null
  },
  authProvider: {
    type: String,
    enum: ['local', 'google'],
    default: 'local'
  },
  lastLogin: {
    type: Date,
    default: null
  },
  refreshTokens: [{
    token: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  }],
  mustChangePassword: {
    type: Boolean,
    default: false
  },
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessConfig',
    required: true
  },
  role: {
    type: String,
    enum: ['admin', 'manager', 'staff'],
    default: 'admin'
  }
}, { timestamps: true });

// Método para hashear la contraseña antes de guardar
adminSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to add a refresh token (hashed) and enforce max device limit
adminSchema.methods.addRefreshToken = function(plainToken, maxDevices = 10) {
  const hashed = crypto.createHash('sha256').update(plainToken).digest('hex');
  this.refreshTokens.push({ token: hashed, createdAt: new Date() });
  // Keep only the most recent tokens if over limit
  if (this.refreshTokens.length > maxDevices) {
    this.refreshTokens = this.refreshTokens.slice(-maxDevices);
  }
};

// Method to remove a specific refresh token (on logout)
adminSchema.methods.removeRefreshToken = function(plainToken) {
  const hashed = crypto.createHash('sha256').update(plainToken).digest('hex');
  this.refreshTokens = this.refreshTokens.filter(rt => rt.token !== hashed);
};

// Método para comparar contraseñas
adminSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Static: find admin by ID and verify refresh token (searches in array)
adminSchema.statics.findByRefreshToken = async function(adminId, plainToken) {
  const hashed = crypto.createHash('sha256').update(plainToken).digest('hex');
  return this.findOne({ _id: adminId, 'refreshTokens.token': hashed });
};

adminSchema.index({ businessId: 1 });
adminSchema.index({ googleId: 1 }, { sparse: true });

const Admin = mongoose.model('Admin', adminSchema);

module.exports = Admin; 