// Celebrations Controller
const pool = require('../config/database');

async function getAll(req, res) {
  try {
    const collegeId = req.user.college_id;
    const { status, type, search, limit = 50, offset = 0 } = req.query;

    let where = 'WHERE c.college_id = ?';
    const params = [collegeId];
    if (status) { where += ' AND c.status = ?'; params.push(status); }
    if (type)   { where += ' AND c.type = ?';   params.push(type); }
    if (search) { where += ' AND c.name LIKE ?'; params.push(`%${search}%`); }

    const [countRes] = await pool.query(`SELECT COUNT(*) as total FROM celebrations c ${where}`, params);
    const [rows] = await pool.query(
      `SELECT c.*, u.full_name AS coordinator_name
       FROM celebrations c
       LEFT JOIN users u ON c.assigned_coordinator = u.user_id
       ${where}
       ORDER BY c.celebration_date ASC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    res.json({ success: true, data: { items: rows, total: countRes[0].total } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch celebrations' });
  }
}

async function getOne(req, res) {
  try {
    const collegeId = req.user.college_id;
    const [rows] = await pool.query(
      `SELECT c.*, u.full_name AS coordinator_name
       FROM celebrations c
       LEFT JOIN users u ON c.assigned_coordinator = u.user_id
       WHERE c.celebration_id = ? AND c.college_id = ?`,
      [req.params.id, collegeId]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch celebration' });
  }
}

async function create(req, res) {
  try {
    const collegeId = req.user.college_id;
    const {
      name, type, celebration_date, frequency, budget, theme,
      assigned_coordinator, event_team, notes, content_status, linked_proposal_id, preset
    } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'name is required' });

    const [result] = await pool.query(
      `INSERT INTO celebrations (
         college_id, name, type, celebration_date, frequency, budget, theme,
         assigned_coordinator, event_team, notes, content_status, linked_proposal_id, preset, status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'planned')`,
      [
        collegeId, name, type, celebration_date, frequency, budget, theme,
        assigned_coordinator || null, event_team || null, notes || null, content_status || 'not-started',
        linked_proposal_id || null, Boolean(preset)
      ]
    );

    res.status(201).json({ success: true, message: 'Celebration created', data: { celebration_id: result.insertId } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create celebration' });
  }
}

async function update(req, res) {
  try {
    const collegeId = req.user.college_id;
    const { id } = req.params;
    const {
      name, type, celebration_date, frequency, budget, theme, status, assigned_coordinator,
      event_team, notes, content_status, linked_proposal_id, preset
    } = req.body;

    await pool.query(
      `UPDATE celebrations
       SET name = COALESCE(?, name),
           type = COALESCE(?, type),
           celebration_date = COALESCE(?, celebration_date),
           frequency = COALESCE(?, frequency),
           budget = COALESCE(?, budget),
           theme  = COALESCE(?, theme),
           status = COALESCE(?, status),
           assigned_coordinator = COALESCE(?, assigned_coordinator),
           event_team = COALESCE(?, event_team),
           notes = COALESCE(?, notes),
           content_status = COALESCE(?, content_status),
           linked_proposal_id = COALESCE(?, linked_proposal_id),
           preset = COALESCE(?, preset),
           updated_at = NOW()
       WHERE celebration_id = ? AND college_id = ?`,
      [name, type, celebration_date, frequency, budget, theme, status, assigned_coordinator, event_team, notes, content_status, linked_proposal_id, preset, id, collegeId]
    );

    res.json({ success: true, message: 'Celebration updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update celebration' });
  }
}

async function remove(req, res) {
  try {
    const collegeId = req.user.college_id;
    const [result] = await pool.query(
      `DELETE FROM celebrations WHERE celebration_id = ? AND college_id = ?`,
      [req.params.id, collegeId]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Celebration deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete celebration' });
  }
}

module.exports = { getAll, getOne, create, update, remove };
