const pool = require('../config/database');

// GET /api/v1/activities
async function getAllActivities(req, res) {
  try {
    const collegeId = req.user.college_id;
    const { limit = 10, offset = 0, search = '', status = '', category = '', sort_by = 'start_date', sort_order = 'DESC' } = req.query;
    
    let whereClause = 'WHERE a.college_id = ?';
    const params = [collegeId];

    if (search) {
      whereClause += ' AND a.name LIKE ?';
      params.push(`%${search}%`);
    }
    if (status) {
      whereClause += ' AND a.status = ?';
      params.push(status);
    }
    if (category) {
      whereClause += ' AND a.category = ?';
      params.push(category);
    }

    // Get total count
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM activities a ${whereClause}`,
      params
    );

    // Get paginated results
    const allowedSort = new Set(['start_date', 'created_at', 'updated_at', 'name', 'status']);
    const safeSortBy = allowedSort.has(sort_by) ? sort_by : 'start_date';
    const safeSortOrder = String(sort_order).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const limitNum = Number.parseInt(limit, 10);
    const offsetNum = Number.parseInt(offset, 10);
    const safeLimit = Number.isNaN(limitNum) ? 10 : limitNum;
    const safeOffset = Number.isNaN(offsetNum) ? 0 : offsetNum;

    let activities = [];
    try {
      const [rows] = await pool.query(
        `SELECT a.activity_id, a.name, a.category, a.description, a.objectives, a.strategic_pillar, a.mode,
                a.team, a.coordinator, a.start_date, a.end_date, a.start_time, a.end_time, a.location,
                a.participant_count, a.expected_participants, a.budget, a.status, a.report_url, a.reviewer_comment,
                u.full_name as organizer
         FROM activities a
         LEFT JOIN users u ON a.organizer_id = u.user_id
         ${whereClause}
         ORDER BY a.${safeSortBy} ${safeSortOrder}
         LIMIT ? OFFSET ?`,
        [...params, safeLimit, safeOffset]
      );
      activities = rows;
    } catch (queryError) {
      console.error('Activities query join error:', queryError);
      const [rows] = await pool.query(
        `SELECT a.activity_id, a.name, a.category, a.description, a.objectives, a.strategic_pillar, a.mode,
                a.team, a.coordinator, a.start_date, a.end_date, a.start_time, a.end_time, a.location,
                a.participant_count, a.expected_participants, a.budget, a.status, a.report_url, a.reviewer_comment,
                NULL as organizer
         FROM activities a
         ${whereClause}
         ORDER BY a.${safeSortBy} ${safeSortOrder}
         LIMIT ? OFFSET ?`,
        [...params, safeLimit, safeOffset]
      );
      activities = rows;
    }

    res.json({
      success: true,
      code: 200,
      message: 'Activities retrieved successfully',
      data: {
        items: activities,
        total: countResult[0].total,
        page: Math.floor(safeOffset / safeLimit) + 1,
        page_size: safeLimit
      }
    });
  } catch (error) {
    console.error('Get activities error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Failed to retrieve activities'
    });
  }
}

// POST /api/v1/activities
async function createActivity(req, res) {
  try {
    const collegeId = req.user.college_id;
    const userId = req.user.user_id;
    const {
      name, category, description, objectives, strategic_pillar, mode, team, coordinator,
      start_date, end_date, start_time, end_time, location, organizer_id,
      budget, participant_count, expected_participants, status
    } = req.body;

    if (!name || !start_date) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Name and start_date are required'
      });
    }

    const [result] = await pool.query(
      `INSERT INTO activities (
         college_id, name, category, description, objectives, strategic_pillar, mode, team, coordinator,
         start_date, end_date, start_time, end_time, location, organizer_id, budget,
         participant_count, expected_participants, created_by, status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        collegeId, name, category, description, objectives, strategic_pillar, mode || 'Offline', team || null, coordinator || null,
        start_date, end_date || null, start_time || null, end_time || null, location || null, organizer_id || userId, budget || null,
        participant_count || 0, expected_participants || participant_count || 0, userId, status || 'draft'
      ]
    );

    // Log the action
    await pool.query(
      `INSERT INTO activity_logs (college_id, user_id, action, entity_type, entity_id)
       VALUES (?, ?, 'CREATE', 'Activity', ?)`,
      [collegeId, userId, result.insertId]
    );

    res.status(201).json({
      success: true,
      code: 201,
      message: 'Activity created successfully',
      data: {
        activity_id: result.insertId
      }
    });
  } catch (error) {
    console.error('Create activity error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Failed to create activity'
    });
  }
}

// GET /api/v1/activities/:id
async function getActivityDetails(req, res) {
  try {
    const collegeId = req.user.college_id;
    const activityId = req.params.id;

    const [activity] = await pool.query(
      `SELECT * FROM activities WHERE activity_id = ? AND college_id = ?`,
      [activityId, collegeId]
    );

    if (!activity.length) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Activity not found'
      });
    }

    const [participants] = await pool.query(
      `SELECT u.user_id, u.full_name, ap.rsvp_status, ap.attendance_confirmed
       FROM activity_participants ap
       JOIN users u ON ap.user_id = u.user_id
       WHERE ap.activity_id = ?`,
      [activityId]
    );

    res.json({
      success: true,
      code: 200,
      message: 'Activity details retrieved',
      data: {
        ...activity[0],
        participants
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Failed to retrieve activity details'
    });
  }
}

// PUT /api/v1/activities/:id
async function updateActivity(req, res) {
  try {
    const collegeId = req.user.college_id;
    const activityId = req.params.id;
    const {
      name, category, description, objectives, strategic_pillar, mode, team, coordinator,
      start_date, end_date, start_time, end_time, location, status, participant_count,
      expected_participants, budget, report_url, reviewer_comment
    } = req.body;

    const [result] = await pool.query(
      `UPDATE activities 
       SET name = COALESCE(?, name), 
           category = COALESCE(?, category),
           description = COALESCE(?, description),
           objectives = COALESCE(?, objectives),
           strategic_pillar = COALESCE(?, strategic_pillar),
           mode = COALESCE(?, mode),
           team = COALESCE(?, team),
           coordinator = COALESCE(?, coordinator),
           start_date = COALESCE(?, start_date),
           end_date = COALESCE(?, end_date),
           start_time = COALESCE(?, start_time),
           end_time = COALESCE(?, end_time),
           location = COALESCE(?, location),
           status = COALESCE(?, status),
           participant_count = COALESCE(?, participant_count),
           expected_participants = COALESCE(?, expected_participants),
           budget = COALESCE(?, budget),
           report_url = COALESCE(?, report_url),
           reviewer_comment = COALESCE(?, reviewer_comment),
           updated_at = NOW()
       WHERE activity_id = ? AND college_id = ?`,
      [
        name, category, description, objectives, strategic_pillar, mode, team, coordinator,
        start_date, end_date, start_time, end_time, location,
        status, participant_count, expected_participants, budget, report_url, reviewer_comment,
        activityId, collegeId
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Activity not found'
      });
    }

    res.json({
      success: true,
      code: 200,
      message: 'Activity updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Failed to update activity'
    });
  }
}

// DELETE /api/v1/activities/:id
async function deleteActivity(req, res) {
  try {
    const collegeId = req.user.college_id;
    const activityId = req.params.id;

    const [result] = await pool.query(
      `DELETE FROM activities WHERE activity_id = ? AND college_id = ?`,
      [activityId, collegeId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Activity not found'
      });
    }

    res.json({
      success: true,
      code: 200,
      message: 'Activity deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Failed to delete activity'
    });
  }
}

// POST /api/v1/activities/:id/participants
async function addParticipant(req, res) {
  try {
    const collegeId = req.user.college_id;
    const activityId = req.params.id;
    const { user_id, rsvp_status = 'pending' } = req.body;

    const [result] = await pool.query(
      `INSERT INTO activity_participants (activity_id, user_id, rsvp_status)
       VALUES (?, ?, ?)`,
      [activityId, user_id, rsvp_status]
    );

    res.json({
      success: true,
      code: 201,
      message: 'Participant added successfully',
      data: { participant_id: result.insertId }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Failed to add participant'
    });
  }
}

// GET /api/v1/activities/:id/participants
async function getParticipants(req, res) {
  try {
    const activityId = req.params.id;
    const [participants] = await pool.query(
      `SELECT ap.participant_id, ap.user_id, ap.rsvp_status, ap.attendance_confirmed, ap.hours_contributed,
              u.full_name, u.email
       FROM activity_participants ap
       JOIN users u ON u.user_id = ap.user_id
       WHERE ap.activity_id = ?
       ORDER BY u.full_name`,
      [activityId]
    );

    res.json({ success: true, data: { items: participants } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch participants' });
  }
}

// PUT /api/v1/activities/:id/participants/:userId
async function updateParticipant(req, res) {
  try {
    const { id, userId } = req.params;
    const { rsvp_status, attendance_confirmed, hours_contributed } = req.body;

    await pool.query(
      `UPDATE activity_participants
       SET rsvp_status = COALESCE(?, rsvp_status),
           attendance_confirmed = COALESCE(?, attendance_confirmed),
           hours_contributed = COALESCE(?, hours_contributed)
       WHERE activity_id = ? AND user_id = ?`,
      [rsvp_status, attendance_confirmed, hours_contributed, id, userId]
    );

    res.json({ success: true, message: 'Participant updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update participant' });
  }
}

// GET /api/v1/activities/stats
async function getActivityStatistics(req, res) {
  try {
    const collegeId = req.user.college_id;

    const [stats] = await pool.query(
      `SELECT 
        COUNT(*) as total_activities,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'ongoing' THEN 1 ELSE 0 END) as ongoing,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
        SUM(participant_count) as total_participants
       FROM activities
       WHERE college_id = ?`,
      [collegeId]
    );

    res.json({
      success: true,
      code: 200,
      message: 'Activity statistics retrieved',
      data: stats[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Failed to retrieve activity statistics'
    });
  }
}

module.exports = {
  getAllActivities,
  createActivity,
  getActivityDetails,
  updateActivity,
  deleteActivity,
  getParticipants,
  addParticipant,
  updateParticipant,
  getActivityStatistics
};
