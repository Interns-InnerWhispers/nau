const { verifyToken } = require('../utils/jwt');
const pool = require('../config/database');

// Authentication middleware - Verify JWT token
async function authenticate(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: 'No authorization token provided'
      });
    }

    const decoded = verifyToken(token);
    
    // Check if user still exists and is active
    const [users] = await pool.query(
      'SELECT user_id, college_id, role, status FROM users WHERE user_id = ? AND college_id = ?',
      [decoded.user_id, decoded.college_id]
    );

    if (!users.length || users[0].status !== 'active') {
      return res.status(401).json({
        success: false,
        code: 401,
        message: 'User no longer exists or is inactive'
      });
    }

    // Attach user info to request
    req.user = {
      user_id: decoded.user_id,
      college_id: decoded.college_id,
      role: users[0].role
    };

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      code: 401,
      message: 'Invalid or expired token'
    });
  }
}

// Multi-tenancy middleware - Ensure college_id is passed
function multiTenancy(req, res, next) {
  if (!req.user || !req.user.college_id) {
    return res.status(403).json({
      success: false,
      code: 403,
      message: 'College ID not found'
    });
  }
  next();
}

// Role-based authorization
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        code: 403,
        message: 'Insufficient permissions'
      });
    }
    next();
  };
}

// Global error handler
function errorHandler(err, req, res, next) {
  console.error('Error:', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  res.status(statusCode).json({
    success: false,
    code: statusCode,
    message: message,
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
}

// Request logging middleware
function requestLogger(req, res, next) {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
}

module.exports = {
  authenticate,
  multiTenancy,
  authorize,
  errorHandler,
  requestLogger
};
