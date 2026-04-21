// Reports Controller — Full CRUD + submit workflow
const pool = require('../config/database');

async function getAll(req, res) {
  try {
    const collegeId = req.user.college_id;
    const { status, report_type, search, limit = 50, offset = 0 } = req.query;

    let where = 'WHERE r.college_id = ?';
    const params = [collegeId];
    if (status)      { where += ' AND r.status = ?';      params.push(status); }
    if (report_type) { where += ' AND r.report_type = ?'; params.push(report_type); }
    if (search)      { where += ' AND r.title LIKE ?';    params.push(`%${search}%`); }

    const [countRes] = await pool.query(`SELECT COUNT(*) as total FROM reports r ${where}`, params);
    const [rows] = await pool.query(
      `SELECT r.*, u.full_name AS submitter_name, rv.full_name AS reviewer_name,
              rc.summary, rc.highlights, rc.challenges, rc.key_metrics, rc.recommendations
       FROM reports r
       LEFT JOIN users u  ON r.submitted_by = u.user_id
       LEFT JOIN users rv ON r.reviewer_id  = rv.user_id
       LEFT JOIN report_content rc ON rc.report_id = r.report_id
       ${where}
       ORDER BY r.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    res.json({ success: true, data: { items: rows, total: countRes[0].total } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch reports' });
  }
}

async function getOne(req, res) {
  try {
    const collegeId = req.user.college_id;
    const [rows] = await pool.query(
      `SELECT r.*, rc.summary, rc.highlights, rc.challenges, rc.key_metrics,
              rc.findings, rc.recommendations, u.full_name AS submitter_name
       FROM reports r
       LEFT JOIN report_content rc ON rc.report_id = r.report_id
       LEFT JOIN users u ON r.submitted_by = u.user_id
       WHERE r.report_id = ? AND r.college_id = ?`,
      [req.params.id, collegeId]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Report not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch report' });
  }
}

async function create(req, res) {
  try {
    const collegeId = req.user.college_id;
    const userId    = req.user.user_id;
    const {
      title, report_type, period_start, period_end,
      file_url, actual_participants, version,
      summary, highlights, challenges, key_metrics, findings, recommendations
    } = req.body;

    if (!title) return res.status(400).json({ success: false, message: 'title is required' });

    const [result] = await pool.query(
      `INSERT INTO reports (
         college_id, title, report_type, period_start, period_end, file_url, actual_participants, version, submitted_by, status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
      [collegeId, title, report_type, period_start, period_end, file_url || null, actual_participants || null, version || 1, userId]
    );

    // Insert content
    if (summary || highlights || challenges || key_metrics) {
      await pool.query(
        `INSERT INTO report_content (report_id, summary, highlights, challenges, key_metrics, findings, recommendations)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [result.insertId, summary, highlights, challenges, key_metrics, findings, recommendations]
      );
    }

    res.status(201).json({
      success: true, message: 'Report created',
      data: { report_id: result.insertId }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create report' });
  }
}

async function update(req, res) {
  try {
    const collegeId = req.user.college_id;
    const { id } = req.params;
    const {
      title, report_type, period_start, period_end,
      file_url, actual_participants, version,
      summary, highlights, challenges, key_metrics, findings, recommendations
    } = req.body;

    await pool.query(
      `UPDATE reports
       SET title = COALESCE(?, title),
           report_type   = COALESCE(?, report_type),
           period_start  = COALESCE(?, period_start),
           period_end    = COALESCE(?, period_end),
           file_url = COALESCE(?, file_url),
           actual_participants = COALESCE(?, actual_participants),
           version = COALESCE(?, version),
           updated_at = NOW()
       WHERE report_id = ? AND college_id = ? AND status IN ('draft', 'resubmission-required')`,
      [title, report_type, period_start, period_end, file_url, actual_participants, version, id, collegeId]
    );

    await pool.query(
      `INSERT INTO report_content (report_id, summary, highlights, challenges, key_metrics, findings, recommendations)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         summary = COALESCE(VALUES(summary), summary),
         highlights = COALESCE(VALUES(highlights), highlights),
         challenges = COALESCE(VALUES(challenges), challenges),
         key_metrics = COALESCE(VALUES(key_metrics), key_metrics),
         findings = COALESCE(VALUES(findings), findings),
         recommendations = COALESCE(VALUES(recommendations), recommendations)`,
      [id, summary, highlights, challenges, key_metrics, findings, recommendations]
    );

    res.json({ success: true, message: 'Report updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update report' });
  }
}

async function submit(req, res) {
  try {
    const collegeId = req.user.college_id;
    const [result] = await pool.query(
      `UPDATE reports SET status = 'submitted', submitted_date = NOW()
       WHERE report_id = ? AND college_id = ? AND status IN ('draft', 'resubmission-required')`,
      [req.params.id, collegeId]
    );
    if (!result.affectedRows) return res.status(400).json({ success: false, message: 'Cannot submit' });
    res.json({ success: true, message: 'Report submitted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to submit report' });
  }
}

async function remove(req, res) {
  try {
    const collegeId = req.user.college_id;
    const [result] = await pool.query(
      `DELETE FROM reports WHERE report_id = ? AND college_id = ? AND status = 'draft'`,
      [req.params.id, collegeId]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Not found or cannot delete' });
    res.json({ success: true, message: 'Report deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete report' });
  }
}

module.exports = { getAll, getOne, create, update, submit, remove };
