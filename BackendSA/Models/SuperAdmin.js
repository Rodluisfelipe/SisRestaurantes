const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

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

// Método para comparar contraseñas
SuperAdminSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.models.SuperAdmin || mongoose.model('SuperAdmin', SuperAdminSchema); 