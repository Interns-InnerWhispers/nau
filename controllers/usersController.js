// Users Controller
const pool = require('../config/database');
const bcrypt = require('bcryptjs');

// Get user profile
async function getUserProfile(req, res) {
  try {
    const userId = req.user.user_id;
    const collegeId = req.user.college_id;

    const [users] = await pool.query(
      `SELECT user_id, email, full_name, phone, alt_email, alt_phone, course, department, role, avatar_url, bio, status, created_at FROM users 
       WHERE user_id = ? AND college_id = ?`,
      [userId, collegeId]
    );

    if (!users.length) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      data: users[0]
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// Update user profile
async function updateUserProfile(req, res) {
  try {
    const userId = req.user.user_id;
    const { full_name, phone, alt_email, alt_phone, course, department, bio, avatar_url } = req.body;

    await pool.query(
      `UPDATE users SET
         full_name = COALESCE(?, full_name),
         phone = COALESCE(?, phone),
         alt_email = COALESCE(?, alt_email),
         alt_phone = COALESCE(?, alt_phone),
         course = COALESCE(?, course),
         department = COALESCE(?, department),
         bio = COALESCE(?, bio),
         avatar_url = COALESCE(?, avatar_url),
         updated_at = NOW()
       WHERE user_id = ?`,
      [full_name, phone, alt_email, alt_phone, course, department, bio, avatar_url, userId]
    );

    res.json({ success: true, message: 'Profile updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// Get all users (admin)
async function getAllUsers(req, res) {
  try {
    const collegeId = req.user.college_id;
    const { limit = 10, offset = 0 } = req.pagination || {};
    const { search, role, status } = req.query;

    let whereClause = 'WHERE college_id = ?';
    const params = [collegeId];

    if (search) {
      whereClause += ' AND (full_name LIKE ? OR email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    if (role) {
      whereClause += ' AND role = ?';
      params.push(role);
    }
    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    const [count] = await pool.query(`SELECT COUNT(*) as total FROM users ${whereClause}`, params);
    const [users] = await pool.query(
      `SELECT user_id, email, full_name, role, department, status, last_login, created_at FROM users ${whereClause} LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: {
        users,
        total: count[0].total,
        page: Math.floor(offset / limit) + 1
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// Change password
async function changePassword(req, res) {
  try {
    const userId = req.user.user_id;
    const currentPassword = req.body.currentPassword || req.body.old_password;
    const newPassword = req.body.newPassword || req.body.new_password;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current password and new password are required' });
    }

    const [users] = await pool.query('SELECT password_hash FROM users WHERE user_id = ?', [userId]);
    if (!users.length) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const passwordMatch = await bcrypt.compare(currentPassword, users[0].password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = ? WHERE user_id = ?', [hashedPassword, userId]);

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// Get one user
async function getUserById(req, res) {
  try {
    const collegeId = req.user.college_id;
    const [users] = await pool.query(
      `SELECT user_id, email, full_name, phone, alt_email, alt_phone, course, department, role, avatar_url, bio, status, created_at
       FROM users
       WHERE user_id = ? AND college_id = ?`,
      [req.params.id, collegeId]
    );

    if (!users.length) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, data: users[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getUserProfile,
  updateUserProfile,
  getAllUsers,
  getUserById,
  changePassword
};
