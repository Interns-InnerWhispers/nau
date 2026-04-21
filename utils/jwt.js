const jwt = require('jsonwebtoken');

// Generate JWT token
function generateToken(userId, collegeId, role) {
  return jwt.sign(
    { 
      user_id: userId, 
      college_id: collegeId,
      role: role 
    },
    process.env.JWT_SECRET || 'nau_dashboard_secret_key_2026_supersecure',
    { expiresIn: process.env.JWT_EXPIRY || '24h' }
  );
}

// Verify JWT token
function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'nau_dashboard_secret_key_2026_supersecure');
  } catch (error) {
    throw new Error('Invalid token');
  }
}

module.exports = {
  generateToken,
  verifyToken
};
