const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const SuperAdminSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  resetPasswordToken: String,
  resetPasswordExpires: Date
}, { timestamps: true });

// Middleware para hashear la contraseña antes de guardar
SuperAdminSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Hash resetPasswordToken before saving (store SHA-256 hash, not plaintext)
SuperAdminSchema.pre('save', function(next) {
  if (!this.isModified('resetPasswordToken') || !this.resetPasswordToken) return next();
  this.resetPasswordToken = crypto.createHash('sha256').update(this.resetPasswordToken).digest('hex');
  next();
});

// Método para comparar contraseñas
SuperAdminSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.models.SuperAdmin || mongoose.model('SuperAdmin', SuperAdminSchema); 