// Admin Controller
const pool = require('../config/database');
const { hashPassword } = require('../utils/crypto');

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
      `SELECT user_id, email, full_name, role, department, status, last_login, created_at
       FROM users ${whereClause} LIMIT ? OFFSET ?`,
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

// Create user
async function createUser(req, res) {
  try {
    const collegeId = req.user.college_id;
    const { email, full_name, password, role = 'member', department, phone, status = 'active' } = req.body;

    if (!email || !full_name || !password) {
      return res.status(400).json({ success: false, message: 'email, full_name, and password are required' });
    }

    const passwordHash = await hashPassword(password);
    const [result] = await pool.query(
      `INSERT INTO users (college_id, email, password_hash, full_name, role, department, phone, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [collegeId, email, passwordHash, full_name, role, department || null, phone || null, status]
    );

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: { user_id: result.insertId }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// Update user
async function updateUser(req, res) {
  try {
    const collegeId = req.user.college_id;
    const { user_id } = req.params;
    const { full_name, role, department, phone, status } = req.body;

    await pool.query(
      `UPDATE users
       SET full_name = COALESCE(?, full_name),
           role = COALESCE(?, role),
           department = COALESCE(?, department),
           phone = COALESCE(?, phone),
           status = COALESCE(?, status),
           updated_at = NOW()
       WHERE user_id = ? AND college_id = ?`,
      [full_name, role, department, phone, status, user_id, collegeId]
    );

    res.json({ success: true, message: 'User updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// Update user role
async function updateUserRole(req, res) {
  try {
    const { user_id } = req.params;
    const { role } = req.body;
    const collegeId = req.user.college_id;

    await pool.query(
      `UPDATE users SET role = ? WHERE user_id = ? AND college_id = ?`,
      [role, user_id, collegeId]
    );

    res.json({ success: true, message: 'User role updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// Update user status
async function updateUserStatus(req, res) {
  try {
    const { user_id } = req.params;
    const { status } = req.body;
    const collegeId = req.user.college_id;

    await pool.query(
      `UPDATE users SET status = ? WHERE user_id = ? AND college_id = ?`,
      [status, user_id, collegeId]
    );

    res.json({ success: true, message: 'User status updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// Delete user
async function deleteUser(req, res) {
  try {
    const { user_id } = req.params;
    const collegeId = req.user.college_id;

    await pool.query(
      `DELETE FROM users WHERE user_id = ? AND college_id = ?`,
      [user_id, collegeId]
    );

    res.json({ success: true, message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// Get system statistics
async function getSystemStats(req, res) {
  try {
    const collegeId = req.user.college_id;

    const [userStats] = await pool.query(
      `SELECT COUNT(*) as total, 
              SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
              SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive
       FROM users WHERE college_id = ?`,
      [collegeId]
    );

    const [activityStats] = await pool.query(
      `SELECT COUNT(*) as total,
              SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
              SUM(participant_count) as total_participants
       FROM activities WHERE college_id = ?`,
      [collegeId]
    );

    const [financeStats] = await pool.query(
      `SELECT SUM(CASE WHEN type = 'Income' THEN amount ELSE 0 END) as total_income,
              SUM(CASE WHEN type = 'Expense' THEN amount ELSE 0 END) as total_expenses
       FROM transactions WHERE college_id = ?`,
      [collegeId]
    );

    res.json({
      success: true,
      data: {
        users: userStats[0],
        activities: activityStats[0],
        finance: financeStats[0]
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// Get audit logs
async function getLogs(req, res) {
  try {
    const collegeId = req.user.college_id;
    const { limit = 20, offset = 0 } = req.pagination || {};

    const [rows] = await pool.query(
      `SELECT al.*, u.full_name
       FROM activity_logs al
       LEFT JOIN users u ON u.user_id = al.user_id
       WHERE al.college_id = ?
       ORDER BY al.timestamp DESC
       LIMIT ? OFFSET ?`,
      [collegeId, limit, offset]
    );

    res.json({ success: true, data: { items: rows } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getAllUsers,
  createUser,
  updateUser,
  updateUserRole,
  updateUserStatus,
  deleteUser,
  getSystemStats,
  getLogs
};
