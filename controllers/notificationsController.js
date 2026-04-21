const pool = require('../config/database');

async function markRead(req, res) {
  try {
    const collegeId = req.user.college_id;
    const userId = req.user.user_id;

    await pool.query(
      `UPDATE notifications
       SET read_status = TRUE, read_at = NOW()
       WHERE notification_id = ? AND user_id = ? AND college_id = ?`,
      [req.params.id, userId, collegeId]
    );

    res.json({ success: true, message: 'Notification marked as read' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function markAllRead(req, res) {
  try {
    const collegeId = req.user.college_id;
    const userId = req.user.user_id;

    await pool.query(
      `UPDATE notifications
       SET read_status = TRUE, read_at = NOW()
       WHERE user_id = ? AND college_id = ? AND read_status = FALSE`,
      [userId, collegeId]
    );

    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  markRead,
  markAllRead
};
