// Self-Driven Activities Controller
const pool = require('../config/database');

async function getAll(req, res) {
  try {
    const collegeId = req.user.college_id;
    const { status, category, search, limit = 50, offset = 0 } = req.query;

    let where = 'WHERE s.college_id = ?';
    const params = [collegeId];
    if (status)   { where += ' AND s.status = ?';   params.push(status); }
    if (category) { where += ' AND s.category = ?'; params.push(category); }
    if (search)   { where += ' AND s.name LIKE ?';  params.push(`%${search}%`); }

    const [countRes] = await pool.query(`SELECT COUNT(*) as total FROM self_driven_activities s ${where}`, params);
    const [rows] = await pool.query(
      `SELECT s.*, u.full_name AS initiator_name, m.full_name AS mentor_name
       FROM self_driven_activities s
       LEFT JOIN users u ON s.initiator_id = u.user_id
       LEFT JOIN users m ON s.mentor_id    = m.user_id
       ${where}
       ORDER BY s.start_date DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    res.json({ success: true, data: { items: rows, total: countRes[0].total } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch self-driven activities' });
  }
}

async function getOne(req, res) {
  try {
    const collegeId = req.user.college_id;
    const [rows] = await pool.query(
      `SELECT s.*, u.full_name AS initiator_name
       FROM self_driven_activities s
       LEFT JOIN users u ON s.initiator_id = u.user_id
       WHERE s.sda_id = ? AND s.college_id = ?`,
      [req.params.id, collegeId]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch activity' });
  }
}

async function create(req, res) {
  try {
    const collegeId = req.user.college_id;
    const userId    = req.user.user_id;
    const {
      name, category, description, objectives, notes, mode, venue, team, coordinator,
      start_date, end_date, estimated_hours, mentor_id, participant_count, status
    } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'name is required' });

    const [result] = await pool.query(
      `INSERT INTO self_driven_activities
         (college_id, name, category, description, objectives, notes, mode, venue, team, coordinator,
          initiator_id, start_date, end_date, estimated_hours, mentor_id, participant_count, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        collegeId, name, category, description, objectives || null, notes || null, mode || 'Offline', venue || null, team || null, coordinator || null,
        userId, start_date, end_date, estimated_hours, mentor_id || null, participant_count || 0, status || 'initiated'
      ]
    );

    res.status(201).json({ success: true, message: 'Activity created', data: { sda_id: result.insertId } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create activity' });
  }
}

async function update(req, res) {
  try {
    const collegeId = req.user.college_id;
    const { id } = req.params;
    const {
      name, category, description, objectives, notes, mode, venue, team, coordinator,
      start_date, end_date, estimated_hours, mentor_id, participant_count, status, report_url
    } = req.body;

    await pool.query(
      `UPDATE self_driven_activities
       SET name = COALESCE(?, name),
           category = COALESCE(?, category),
           description = COALESCE(?, description),
           objectives = COALESCE(?, objectives),
           notes = COALESCE(?, notes),
           mode = COALESCE(?, mode),
           venue = COALESCE(?, venue),
           team = COALESCE(?, team),
           coordinator = COALESCE(?, coordinator),
           start_date  = COALESCE(?, start_date),
           end_date    = COALESCE(?, end_date),
           estimated_hours = COALESCE(?, estimated_hours),
           mentor_id   = COALESCE(?, mentor_id),
           participant_count = COALESCE(?, participant_count),
           status      = COALESCE(?, status),
           report_url  = COALESCE(?, report_url),
           updated_at  = NOW()
       WHERE sda_id = ? AND college_id = ?`,
      [
        name, category, description, objectives, notes, mode, venue, team, coordinator,
        start_date, end_date, estimated_hours, mentor_id, participant_count, status, report_url,
        id, collegeId
      ]
    );

    res.json({ success: true, message: 'Activity updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update activity' });
  }
}

async function remove(req, res) {
  try {
    const collegeId = req.user.college_id;
    const [result] = await pool.query(
      `DELETE FROM self_driven_activities WHERE sda_id = ? AND college_id = ?`,
      [req.params.id, collegeId]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Activity deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete activity' });
  }
}

module.exports = { getAll, getOne, create, update, remove };
