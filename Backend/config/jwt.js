const jwt = require('jsonwebtoken');

// Cargar secretos desde variables de entorno (obligatorios)
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const JWT_EXPIRE = '24h';
const JWT_REFRESH_EXPIRE = '7d';

if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error('JWT secrets missing: set JWT_SECRET and JWT_REFRESH_SECRET in environment variables.');
}

const generateToken = (userId, businessId = null, role = 'admin', brandId = null) => {
  const payload = { id: userId };
  if (businessId) payload.businessId = businessId;
  if (role) payload.role = role;
  if (brandId) payload.brandId = brandId;
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRE });
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