const pool = require('../config/database');
const { generateToken } = require('../utils/jwt');
const { hashPassword, verifyPassword } = require('../utils/crypto');

// POST /api/v1/auth/register
async function register(req, res) {
  return res.status(403).json({
    success: false,
    code: 403,
    message: 'Public registration is disabled. Users must be created by an administrator.'
  });
}

// POST /api/v1/auth/login
async function login(req, res) {
  try {
    const { email, password, college_code } = req.body;

    console.log('Login attempt:', { email, password: password ? '[REDACTED]' : undefined, college_code });

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Email and password are required'
      });
    }

    const params = [email];
    let query = `
      SELECT u.user_id, u.password_hash, u.role, u.full_name, u.status, u.college_id
      FROM users u
      JOIN colleges c ON c.college_id = u.college_id
      WHERE u.email = ?
    `;

    if (college_code) {
      query += ' AND c.college_code = ?';
      params.push(college_code);
    }

    const [users] = await pool.query(query, params);

    console.log('Query result:', { usersFound: users.length, query, params });

    if (!users.length) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: 'Invalid credentials'
      });
    }

    if (users.length > 1 && !college_code) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Multiple colleges use this email. Please contact your administrator for the correct login account.'
      });
    }

    const user = users[0];
    const collegeId = user.college_id;

    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        code: 403,
        message: 'Your account is inactive or suspended'
      });
    }

    // Verify password
    console.log('Verifying password for user:', email);
    console.log('Received password length:', password.length);
    console.log('Received password characters:', password.split('').map(c => `${c}(${c.charCodeAt(0)})`));
    console.log('Stored hash:', user.password_hash);
    const isPasswordValid = await verifyPassword(password, user.password_hash);
    console.log('Password verification result:', isPasswordValid);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: 'Invalid credentials'
      });
    }

    // Update last login
    await pool.query(
      'UPDATE users SET last_login = NOW() WHERE user_id = ?',
      [user.user_id]
    );

    // Generate token
    const token = generateToken(user.user_id, collegeId, user.role);

    res.json({
      success: true,
      code: 200,
      message: 'Login successful',
      data: {
        token,
        user: {
          user_id: user.user_id,
          email,
          full_name: user.full_name,
          role: user.role,
          college_id: collegeId
        }
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Login failed',
      error: error.message
    });
  }
}

// POST /api/v1/auth/logout
async function logout(req, res) {
  res.json({
    success: true,
    code: 200,
    message: 'Logout successful'
  });
}

// POST /api/v1/auth/refresh-token
async function refreshToken(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: 'User not authenticated'
      });
    }

    const token = generateToken(req.user.user_id, req.user.college_id, req.user.role);

    res.json({
      success: true,
      code: 200,
      message: 'Token refreshed',
      data: { token }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Token refresh failed'
    });
  }
}

// GET /api/v1/auth/me
async function me(req, res) {
  try {
    const [users] = await pool.query(
      `SELECT user_id, college_id, email, full_name, phone, department, role, avatar_url, bio, status, last_login, created_at
       FROM users
       WHERE user_id = ? AND college_id = ?`,
      [req.user.user_id, req.user.college_id]
    );

    if (!users.length) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      code: 200,
      data: users[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Failed to load authenticated user'
    });
  }
}

module.exports = {
  register,
  login,
  logout,
  refreshToken,
  me
};
