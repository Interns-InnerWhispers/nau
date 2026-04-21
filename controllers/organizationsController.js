// Organizations Controller — uses college-wide org (one org per college)
const pool = require('../config/database');

// GET /api/v1/organizations — get the college's main organization
async function getOrganization(req, res) {
  try {
    const collegeId = req.user.college_id;

    const [orgs] = await pool.query(
      `SELECT o.*, u.full_name AS president_name
       FROM organizations o
       LEFT JOIN users u ON o.president_id = u.user_id
       WHERE o.college_id = ? LIMIT 1`,
      [collegeId]
    );

    if (!orgs.length) {
      return res.json({ success: true, data: null });
    }

    res.json({ success: true, data: orgs[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// PUT /api/v1/organizations — update the organization
async function updateOrganization(req, res) {
  try {
    const collegeId = req.user.college_id;
    const { org_name, description, founded_date, org_type } = req.body;

    await pool.query(
      `UPDATE organizations
       SET org_name = COALESCE(?, org_name),
           description = COALESCE(?, description),
           founded_date = COALESCE(?, founded_date),
           org_type = COALESCE(?, org_type),
           updated_at = NOW()
       WHERE college_id = ?`,
      [org_name, description, founded_date, org_type, collegeId]
    );

    res.json({ success: true, message: 'Organization updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// GET /api/v1/organizations/members
async function getMembers(req, res) {
  try {
    const collegeId = req.user.college_id;
    const { role, status, search, limit = 50, offset = 0 } = req.query;

    let where = `WHERE o.college_id = ?`;
    const params = [collegeId];

    if (role)   { where += ' AND om.role = ?';           params.push(role); }
    if (status) { where += ' AND om.status = ?';         params.push(status); }
    if (search) { where += ' AND u.full_name LIKE ?';    params.push(`%${search}%`); }

    const [countRes] = await pool.query(
      `SELECT COUNT(*) as total FROM org_members om
       JOIN organizations o ON om.org_id = o.org_id
       JOIN users u ON om.user_id = u.user_id
       ${where}`, params
    );
    const [rows] = await pool.query(
      `SELECT om.member_id, u.user_id, u.full_name, u.email, u.department, u.phone,
              om.role, om.join_date, om.status
       FROM org_members om
       JOIN organizations o ON om.org_id = o.org_id
       JOIN users u ON om.user_id = u.user_id
       ${where}
       ORDER BY om.role, u.full_name
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    res.json({ success: true, data: { items: rows, total: countRes[0].total } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// POST /api/v1/organizations/members
async function addMember(req, res) {
  try {
    const collegeId = req.user.college_id;
    const { user_id, role = 'Member' } = req.body;

    // Get org_id for this college
    const [orgs] = await pool.query('SELECT org_id FROM organizations WHERE college_id = ? LIMIT 1', [collegeId]);
    if (!orgs.length) return res.status(404).json({ success: false, message: 'Organization not found' });

    const [result] = await pool.query(
      `INSERT INTO org_members (org_id, user_id, role, status, join_date) VALUES (?, ?, ?, 'active', CURDATE())
       ON DUPLICATE KEY UPDATE role = VALUES(role), status = 'active'`,
      [orgs[0].org_id, user_id, role]
    );

    res.status(201).json({ success: true, message: 'Member added', data: { member_id: result.insertId } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// PUT /api/v1/organizations/members/:id
async function updateMember(req, res) {
  try {
    const { id } = req.params;
    const { role } = req.body;

    await pool.query(`UPDATE org_members SET role = COALESCE(?, role) WHERE member_id = ?`, [role, id]);
    res.json({ success: true, message: 'Member updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// DELETE /api/v1/organizations/members/:id
async function removeMember(req, res) {
  try {
    const { id } = req.params;
    await pool.query(`UPDATE org_members SET status = 'inactive' WHERE member_id = ?`, [id]);
    res.json({ success: true, message: 'Member removed' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// GET /api/v1/organizations/meetings
async function getMeetings(req, res) {
  try {
    const collegeId = req.user.college_id;
    const { limit = 20, offset = 0 } = req.query;

    const [orgs] = await pool.query('SELECT org_id FROM organizations WHERE college_id = ? LIMIT 1', [collegeId]);
    if (!orgs.length) return res.json({ success: true, data: { items: [], total: 0 } });

    const [countRes] = await pool.query('SELECT COUNT(*) as total FROM meetings WHERE org_id = ?', [orgs[0].org_id]);
    const [rows] = await pool.query(
      `SELECT m.*, u.full_name AS created_by_name
       FROM meetings m
       LEFT JOIN users u ON m.created_by = u.user_id
       WHERE m.org_id = ?
       ORDER BY m.meeting_date DESC
       LIMIT ? OFFSET ?`,
      [orgs[0].org_id, parseInt(limit), parseInt(offset)]
    );

    res.json({ success: true, data: { items: rows, total: countRes[0].total } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// POST /api/v1/organizations/meetings
async function createMeeting(req, res) {
  try {
    const collegeId = req.user.college_id;
    const userId    = req.user.user_id;
    const {
      title, meeting_date, meeting_time, location, duration_minutes,
      description, meeting_type, agenda
    } = req.body;

    const [orgs] = await pool.query('SELECT org_id FROM organizations WHERE college_id = ? LIMIT 1', [collegeId]);
    if (!orgs.length) return res.status(404).json({ success: false, message: 'Organization not found' });

    const [result] = await pool.query(
      `INSERT INTO meetings (
         org_id, title, meeting_type, agenda, meeting_date, meeting_time, location, duration_minutes, description, created_by, status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'planned')`,
      [orgs[0].org_id, title, meeting_type || 'General', agenda || null, meeting_date, meeting_time, location, duration_minutes, description, userId]
    );

    res.status(201).json({ success: true, message: 'Meeting created', data: { meeting_id: result.insertId } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// PUT /api/v1/organizations/meetings/:id
async function updateMeeting(req, res) {
  try {
    const collegeId = req.user.college_id;
    const { id } = req.params;
    const {
      title, meeting_date, meeting_time, location, duration_minutes,
      description, meeting_type, agenda, status
    } = req.body;

    await pool.query(
      `UPDATE meetings m
       JOIN organizations o ON o.org_id = m.org_id
       SET m.title = COALESCE(?, m.title),
           m.meeting_date = COALESCE(?, m.meeting_date),
           m.meeting_time = COALESCE(?, m.meeting_time),
           m.location = COALESCE(?, m.location),
           m.duration_minutes = COALESCE(?, m.duration_minutes),
           m.description = COALESCE(?, m.description),
           m.meeting_type = COALESCE(?, m.meeting_type),
           m.agenda = COALESCE(?, m.agenda),
           m.status = COALESCE(?, m.status),
           m.updated_at = NOW()
       WHERE m.meeting_id = ? AND o.college_id = ?`,
      [title, meeting_date, meeting_time, location, duration_minutes, description, meeting_type, agenda, status, id, collegeId]
    );

    res.json({ success: true, message: 'Meeting updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// DELETE /api/v1/organizations/meetings/:id
async function deleteMeeting(req, res) {
  try {
    const collegeId = req.user.college_id;
    const { id } = req.params;

    await pool.query(
      `DELETE m FROM meetings m
       JOIN organizations o ON o.org_id = m.org_id
       WHERE m.meeting_id = ? AND o.college_id = ?`,
      [id, collegeId]
    );

    res.json({ success: true, message: 'Meeting deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getOrganization, updateOrganization,
  getMembers, addMember, updateMember, removeMember,
  getMeetings, createMeeting, updateMeeting, deleteMeeting
};
