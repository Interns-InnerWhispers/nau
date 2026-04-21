// Social Media Controller
const pool = require('../config/database');

// ==========================================
// ACCOUNTS
// ==========================================
async function getAccounts(req, res) {
  try {
    const collegeId = req.user.college_id;
    const [accounts] = await pool.query(
      'SELECT * FROM social_media_accounts WHERE college_id = ? ORDER BY created_at DESC',
      [collegeId]
    );
    res.json({ success: true, data: accounts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function createAccount(req, res) {
  try {
    const collegeId = req.user.college_id;
    const { platform, handle, profile_link, followers, managed_by } = req.body;
    const [result] = await pool.query(
      `INSERT INTO social_media_accounts 
      (college_id, platform, handle, profile_link, followers, managed_by, status) 
      VALUES (?, ?, ?, ?, ?, ?, 'active')`,
      [collegeId, platform, handle, profile_link, followers || 0, managed_by]
    );
    res.json({ success: true, data: { account_id: result.insertId } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function updateAccount(req, res) {
  try {
    const collegeId = req.user.college_id;
    const { platform, handle, profile_link, followers, managed_by, status } = req.body;
    await pool.query(
      `UPDATE social_media_accounts
       SET platform = COALESCE(?, platform),
           handle = COALESCE(?, handle),
           profile_link = COALESCE(?, profile_link),
           followers = COALESCE(?, followers),
           managed_by = COALESCE(?, managed_by),
           status = COALESCE(?, status),
           updated_at = NOW()
       WHERE account_id = ? AND college_id = ?`,
      [platform, handle, profile_link, followers, managed_by, status, req.params.id, collegeId]
    );
    res.json({ success: true, message: 'Account updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function deleteAccount(req, res) {
  try {
    const collegeId = req.user.college_id;
    await pool.query(
      'DELETE FROM social_media_accounts WHERE account_id = ? AND college_id = ?',
      [req.params.id, collegeId]
    );
    res.json({ success: true, message: 'Account deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ==========================================
// METRICS
// ==========================================
async function getMetrics(req, res) {
  try {
    const collegeId = req.user.college_id;
    const [metrics] = await pool.query(
      `SELECT m.*, a.platform, a.handle 
       FROM social_media_metrics m
       JOIN social_media_accounts a ON m.account_id = a.account_id
       WHERE m.college_id = ? 
       ORDER BY m.date DESC LIMIT 50`,
      [collegeId]
    );
    res.json({ success: true, data: { items: metrics } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function createMetric(req, res) {
  try {
    const collegeId = req.user.college_id;
    const { account_id, date, followers, posts, likes, comments, shares, engagement_rate } = req.body;
    const [result] = await pool.query(
      `INSERT INTO social_media_metrics 
      (college_id, account_id, date, followers, posts, likes, comments, shares, engagement_rate) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [collegeId, account_id, date, followers || 0, posts || 0, likes || 0, comments || 0, shares || 0, engagement_rate || 0.0]
    );
    
    // Auto-update the account followers count to the latest mapping
    await pool.query(
      `UPDATE social_media_accounts SET followers = ? WHERE account_id = ? AND college_id = ?`,
      [followers || 0, account_id, collegeId]
    );

    res.json({ success: true, data: { metric_id: result.insertId } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function deleteMetric(req, res) {
  try {
    const collegeId = req.user.college_id;
    await pool.query(
      'DELETE FROM social_media_metrics WHERE metric_id = ? AND college_id = ?',
      [req.params.id, collegeId]
    );
    res.json({ success: true, message: 'Metric deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ==========================================
// STUBS
// ==========================================
async function getPosts(req, res) {
  try {
    const collegeId = req.user.college_id;
    const [posts] = await pool.query(
      `SELECT p.*, u.full_name AS posted_by_name
       FROM social_media_posts p
       LEFT JOIN users u ON u.user_id = p.posted_by
       WHERE p.college_id = ?
       ORDER BY COALESCE(p.scheduled_date, p.posted_date, p.created_at) DESC`,
      [collegeId]
    );
    res.json({ success: true, data: { items: posts, total: posts.length } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function createPost(req, res) {
  try {
    const collegeId = req.user.college_id;
    const userId = req.user.user_id;
    const { platform, title, content, image_url, video_url, posted_date, scheduled_date, status = 'draft' } = req.body;

    const [result] = await pool.query(
      `INSERT INTO social_media_posts (
         college_id, platform, title, content, image_url, video_url, posted_date, scheduled_date, status, posted_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [collegeId, platform, title || null, content || null, image_url || null, video_url || null, posted_date || null, scheduled_date || null, status, userId]
    );

    res.status(201).json({ success: true, data: { post_id: result.insertId } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function getAnalytics(req, res) {
  try {
    const collegeId = req.user.college_id;
    const [rows] = await pool.query(
      `SELECT a.platform,
              COUNT(DISTINCT a.account_id) AS account_count,
              COALESCE(SUM(a.followers), 0) AS followers,
              COALESCE(SUM(m.posts), 0) AS posts,
              COALESCE(AVG(m.engagement_rate), 0) AS engagement_rate
       FROM social_media_accounts a
       LEFT JOIN social_media_metrics m ON m.account_id = a.account_id
       WHERE a.college_id = ?
       GROUP BY a.platform
       ORDER BY followers DESC`,
      [collegeId]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  getMetrics,
  createMetric,
  deleteMetric,
  getPosts,
  createPost,
  getAnalytics
};
