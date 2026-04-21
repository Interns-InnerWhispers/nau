// Settings Controller
const pool = require('../config/database');

// GET /api/v1/settings
async function getUserSettings(req, res) {
  try {
    const userId = req.user.user_id;
    const [settings] = await pool.query(`SELECT * FROM user_settings WHERE user_id = ?`, [userId]);
    res.json({
      success: true,
      data: settings[0] || {
        user_id: userId, theme: 'light',
        email_notifications: true, activity_updates: true,
        budget_alerts: true, event_reminders: true,
        report_notifications: true, language: 'en', timezone: 'Asia/Kolkata'
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// PUT /api/v1/settings
async function updateUserSettings(req, res) {
  try {
    const userId = req.user.user_id;
    const {
      theme, email_notifications, activity_updates,
      budget_alerts, event_reminders, report_notifications, language, timezone
    } = req.body;

    await pool.query(
      `INSERT INTO user_settings
         (user_id, theme, email_notifications, activity_updates, budget_alerts, event_reminders, report_notifications, language, timezone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         theme = COALESCE(VALUES(theme), theme),
         email_notifications   = COALESCE(VALUES(email_notifications), email_notifications),
         activity_updates      = COALESCE(VALUES(activity_updates), activity_updates),
         budget_alerts         = COALESCE(VALUES(budget_alerts), budget_alerts),
         event_reminders       = COALESCE(VALUES(event_reminders), event_reminders),
         report_notifications  = COALESCE(VALUES(report_notifications), report_notifications),
         language              = COALESCE(VALUES(language), language),
         timezone              = COALESCE(VALUES(timezone), timezone)`,
      [userId, theme, email_notifications, activity_updates, budget_alerts, event_reminders, report_notifications, language, timezone]
    );

    res.json({ success: true, message: 'Settings updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// GET /api/v1/settings/college
async function getCollegeSettings(req, res) {
  try {
    const collegeId = req.user.college_id;
    const [colleges] = await pool.query(
      `SELECT college_id, college_name, college_code, founded_year, location, domain, logo_url, admin_email, settings_json
       FROM colleges WHERE college_id = ?`,
      [collegeId]
    );
    res.json({ success: true, data: colleges[0] || {} });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// PUT /api/v1/settings/college
async function updateCollegeSettings(req, res) {
  try {
    const collegeId = req.user.college_id;
    const { college_name, domain, logo_url, admin_email, settings } = req.body;

    await pool.query(
      `UPDATE colleges
       SET college_name = COALESCE(?, college_name),
           domain       = COALESCE(?, domain),
           logo_url     = COALESCE(?, logo_url),
           admin_email  = COALESCE(?, admin_email),
           settings_json = COALESCE(?, settings_json),
           updated_at   = NOW()
       WHERE college_id = ?`,
      [college_name, domain, logo_url, admin_email, settings ? JSON.stringify(settings) : null, collegeId]
    );

    res.json({ success: true, message: 'College settings updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { getUserSettings, updateUserSettings, getCollegeSettings, updateCollegeSettings };
