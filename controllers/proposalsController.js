// Proposals Controller — Full CRUD
const pool = require('../config/database');

function normalizeProposalStatus(status) {
  if (!status) return status;
  const map = {
    under_review: 'under-review',
    underReview: 'under-review',
    resubmitted: 'submitted'
  };
  return map[status] || status;
}

// ── GET /api/v1/proposals ────────────────────────────────────
async function getAll(req, res) {
  try {
    const collegeId = req.user.college_id;
    const { status, category, search, limit = 50, offset = 0 } = req.query;

    let where = 'WHERE ep.college_id = ?';
    const params = [collegeId];

    if (status)   { where += ' AND ep.status = ?';   params.push(status); }
    if (category) { where += ' AND ep.category = ?'; params.push(category); }
    if (search)   { where += ' AND ep.event_name LIKE ?'; params.push(`%${search}%`); }

    const [countRes] = await pool.query(
      `SELECT COUNT(*) as total FROM events_proposed ep ${where}`, params
    );
    const [rows] = await pool.query(
      `SELECT ep.*, u.full_name AS proposer_name, r.full_name AS reviewer_name
       FROM events_proposed ep
       LEFT JOIN users u ON ep.proposer_id = u.user_id
       LEFT JOIN users r ON ep.reviewed_by = r.user_id
       ${where}
       ORDER BY ep.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    res.json({
      success: true,
      data: { items: rows, total: countRes[0].total }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch proposals' });
  }
}

// ── GET /api/v1/proposals/:id ────────────────────────────────
async function getOne(req, res) {
  try {
    const collegeId = req.user.college_id;
    const [rows] = await pool.query(
      `SELECT ep.*, u.full_name AS proposer_name, r.full_name AS reviewer_name
       FROM events_proposed ep
       LEFT JOIN users u ON ep.proposer_id = u.user_id
       LEFT JOIN users r ON ep.reviewed_by = r.user_id
       WHERE ep.proposal_id = ? AND ep.college_id = ?`,
      [req.params.id, collegeId]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Proposal not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch proposal' });
  }
}

// ── POST /api/v1/proposals ───────────────────────────────────
async function create(req, res) {
  try {
    const collegeId = req.user.college_id;
    const userId    = req.user.user_id;
    const {
      event_name, category, team, proposed_date, duration_hours,
      location, expected_participants, budget_estimate, objectives, risk_assessment,
      notes, document_url, status
    } = req.body;

    if (!event_name) return res.status(400).json({ success: false, message: 'event_name is required' });

    const [result] = await pool.query(
      `INSERT INTO events_proposed
         (college_id, event_name, proposer_id, category, team, proposed_date, duration_hours,
          location, expected_participants, budget_estimate, objectives, risk_assessment, notes, document_url, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [collegeId, event_name, userId, category, team || null, proposed_date, duration_hours,
       location, expected_participants, budget_estimate, objectives, risk_assessment, notes || null, document_url || null, normalizeProposalStatus(status) || 'draft']
    );

    res.status(201).json({
      success: true, message: 'Proposal created',
      data: { proposal_id: result.insertId }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create proposal' });
  }
}

// ── PUT /api/v1/proposals/:id ────────────────────────────────
async function update(req, res) {
  try {
    const collegeId = req.user.college_id;
    const { id } = req.params;

    const [existing] = await pool.query(
      'SELECT status FROM events_proposed WHERE proposal_id = ? AND college_id = ?',
      [id, collegeId]
    );
    if (!existing.length) return res.status(404).json({ success: false, message: 'Not found' });
    if (!['draft', 'rejected'].includes(existing[0].status)) {
      return res.status(403).json({ success: false, message: 'Cannot edit a submitted/approved proposal' });
    }

    const {
      event_name, category, team, proposed_date, duration_hours,
      location, expected_participants, budget_estimate, objectives, risk_assessment,
      notes, document_url, status
    } = req.body;

    await pool.query(
      `UPDATE events_proposed
       SET event_name = COALESCE(?, event_name),
           category   = COALESCE(?, category),
           team = COALESCE(?, team),
           proposed_date = COALESCE(?, proposed_date),
           duration_hours = COALESCE(?, duration_hours),
           location   = COALESCE(?, location),
           expected_participants = COALESCE(?, expected_participants),
           budget_estimate = COALESCE(?, budget_estimate),
           objectives  = COALESCE(?, objectives),
           risk_assessment = COALESCE(?, risk_assessment),
           notes = COALESCE(?, notes),
           document_url = COALESCE(?, document_url),
           status = COALESCE(?, status)
       WHERE proposal_id = ? AND college_id = ?`,
      [event_name, category, team, proposed_date, duration_hours,
       location, expected_participants, budget_estimate, objectives, risk_assessment, notes, document_url, normalizeProposalStatus(status), id, collegeId]
    );

    res.json({ success: true, message: 'Proposal updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update proposal' });
  }
}

// ── PATCH /api/v1/proposals/:id/submit ──────────────────────
async function submit(req, res) {
  try {
    const collegeId = req.user.college_id;
    const [result] = await pool.query(
      `UPDATE events_proposed SET status = 'submitted'
       WHERE proposal_id = ? AND college_id = ? AND status IN ('draft','rejected')`,
      [req.params.id, collegeId]
    );
    if (!result.affectedRows) return res.status(400).json({ success: false, message: 'Cannot submit' });
    res.json({ success: true, message: 'Proposal submitted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to submit proposal' });
  }
}

// ── PATCH /api/v1/proposals/:id/review ─────────────────────
async function review(req, res) {
  try {
    const collegeId = req.user.college_id;
    const userId    = req.user.user_id;
    const { status, review_comments } = req.body;
    const normalizedStatus = normalizeProposalStatus(status);

    await pool.query(
      `UPDATE events_proposed
       SET status = ?, reviewed_by = ?, review_date = NOW(), review_comments = ?
       WHERE proposal_id = ? AND college_id = ?`,
      [normalizedStatus, userId, review_comments, req.params.id, collegeId]
    );

    res.json({ success: true, message: `Proposal ${normalizedStatus}` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to review proposal' });
  }
}

// ── DELETE /api/v1/proposals/:id ────────────────────────────
async function remove(req, res) {
  try {
    const collegeId = req.user.college_id;
    const [result] = await pool.query(
      `DELETE FROM events_proposed
       WHERE proposal_id = ? AND college_id = ? AND status IN ('draft','rejected')`,
      [req.params.id, collegeId]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Not found or cannot delete' });
    res.json({ success: true, message: 'Proposal deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete proposal' });
  }
}

module.exports = { getAll, getOne, create, update, submit, review, remove };
