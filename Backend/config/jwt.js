const jwt = require('jsonwebtoken');

// En producción, esta clave debería estar en variables de entorno
const JWT_SECRET = process.env.JWT_SECRET || 'tu_clave_secreta_muy_segura';
const JWT_EXPIRE = '24h';

const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh_token_secreto_super_seguro';
const JWT_REFRESH_EXPIRE = '7d';

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, JWT_SECRET, {
    expiresIn: JWT_EXPIRE
  });
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

const generateRefreshToken = (userId) => {
  return jwt.sign({ id: userId }, JWT_REFRESH_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRE
  });
};

const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET);
  } catch (error) {
    return null;
  }
};

module.exports = {
  generateToken,
  verifyToken,
  JWT_SECRET,
  generateRefreshToken,
  verifyRefreshToken,
  JWT_REFRESH_SECRET
}; 