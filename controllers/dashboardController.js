const pool = require('../config/database');

// GET /api/v1/dashboard/statistics
async function getStatistics(req, res) {
  try {
    const collegeId = req.user.college_id;

    // Total activities
    const [activities] = await pool.query(
      'SELECT COUNT(*) as total, COALESCE(SUM(participant_count), 0) as total_participants FROM activities WHERE college_id = ?',
      [collegeId]
    );

    // Total budget
    const [budgets] = await pool.query(
      'SELECT COALESCE(SUM(allocated_amount), 0) as total_allocated, COALESCE(SUM(used_amount), 0) as total_used FROM budget_allocation WHERE college_id = ?',
      [collegeId]
    );

    // Completed events this month
    const [completed] = await pool.query(
      'SELECT COUNT(*) as count FROM activities WHERE college_id = ? AND status = "completed" AND MONTH(start_date) = MONTH(NOW()) AND YEAR(start_date) = YEAR(NOW())',
      [collegeId]
    );

    const stats = {
      totalActivities: activities[0]?.total || 0,
      totalParticipants: activities[0]?.total_participants || 0,
      totalBudget: parseFloat(budgets[0]?.total_allocated) || 0,
      budgetUsed: parseFloat(budgets[0]?.total_used) || 0,
      budgetRemaining: (parseFloat(budgets[0]?.total_allocated) || 0) - (parseFloat(budgets[0]?.total_used) || 0),
      completedThisMonth: completed[0]?.count || 0
    };

    res.json({
      success: true,
      code: 200,
      message: 'Statistics retrieved successfully',
      data: stats
    });
  } catch (error) {
    console.error('Dashboard statistics error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Failed to retrieve statistics'
    });
  }
}

// GET /api/v1/dashboard/overview
async function getOverview(req, res) {
  try {
    const collegeId = req.user.college_id;

    const [overview] = await pool.query(
      `SELECT 
        (SELECT COUNT(*) FROM users WHERE college_id = ?) as total_users,
        (SELECT COUNT(*) FROM activities WHERE college_id = ?) as total_activities,
        (SELECT COUNT(*) FROM activities WHERE college_id = ? AND status = 'completed') as completed,
        (SELECT COUNT(*) FROM activities WHERE college_id = ? AND status IN ('scheduled', 'ongoing')) as active,
        (SELECT COUNT(*) FROM events_proposed WHERE college_id = ?) as proposed,
        (SELECT COALESCE(SUM(allocated_amount), 0) FROM budget_allocation WHERE college_id = ?) as total_budget,
        (SELECT COUNT(*) FROM events_proposed WHERE college_id = ? AND status = 'approved') as approved,
        (SELECT COUNT(*) FROM events_proposed WHERE college_id = ? AND status = 'submitted') as under_review`,
      [collegeId, collegeId, collegeId, collegeId, collegeId, collegeId, collegeId, collegeId]
    );

    res.json({
      success: true,
      code: 200,
      message: 'Overview retrieved',
      data: overview[0] || {}
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve overview',
      error: error.message
    });
  }
}

// GET /api/v1/dashboard/recent-activities
async function getRecentActivities(req, res) {
  try {
    const collegeId = req.user.college_id;
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);

    const [activities] = await pool.query(
      `SELECT activity_id, name, category, start_date, participant_count, budget, status
       FROM activities
       WHERE college_id = ?
       ORDER BY start_date DESC
       LIMIT ?`,
      [collegeId, limit]
    );

    res.json({
      success: true,
      code: 200,
      message: 'Recent activities retrieved',
      data: {
        items: activities,
        total: activities.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Failed to retrieve activities'
    });
  }
}

// GET /api/v1/dashboard/charts/activity-trend
async function getActivityTrend(req, res) {
  try {
    const collegeId = req.user.college_id;
    const months = parseInt(req.query.months) || 12;

    const [data] = await pool.query(
      `SELECT DATE_FORMAT(start_date, '%Y-%m') as month, COUNT(*) as count
       FROM activities
       WHERE college_id = ? AND start_date >= DATE_SUB(NOW(), INTERVAL ? MONTH)
       GROUP BY DATE_FORMAT(start_date, '%Y-%m')
       ORDER BY month DESC`,
      [collegeId, months]
    );

    res.json({
      success: true,
      code: 200,
      message: 'Activity trend retrieved',
      data: data.reverse()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Failed to retrieve activity trend'
    });
  }
}

// GET /api/v1/dashboard/charts/activities-by-category
async function getActivitiesByCategory(req, res) {
  try {
    const collegeId = req.user.college_id;

    const [data] = await pool.query(
      `SELECT category, COUNT(*) as count
       FROM activities
       WHERE college_id = ?
       GROUP BY category`,
      [collegeId]
    );

    res.json({
      success: true,
      code: 200,
      message: 'Activities by category retrieved',
      data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Failed to retrieve category breakdown'
    });
  }
}

// GET /api/v1/dashboard/charts/budget-distribution
async function getBudgetDistribution(req, res) {
  try {
    const collegeId = req.user.college_id;

    const [data] = await pool.query(
      `SELECT category, COALESCE(SUM(used_amount), 0) as amount
       FROM budget_allocation
       WHERE college_id = ?
       GROUP BY category`,
      [collegeId]
    );

    res.json({
      success: true,
      code: 200,
      message: 'Budget distribution retrieved',
      data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Failed to retrieve budget distribution'
    });
  }
}

// GET /api/v1/dashboard/charts/participation-rate
async function getParticipationRate(req, res) {
  try {
    const collegeId = req.user.college_id;

    const [stats] = await pool.query(
      `SELECT 
        COUNT(DISTINCT ap.activity_id) as total_activities,
        COUNT(DISTINCT CASE WHEN ap.rsvp_status = 'attended' THEN ap.activity_id END) as participated,
        ROUND(100 * COUNT(DISTINCT CASE WHEN ap.rsvp_status = 'attended' THEN ap.activity_id END) / 
              COUNT(DISTINCT ap.activity_id), 2) as participation_rate
       FROM activity_participants ap
       JOIN activities a ON ap.activity_id = a.activity_id
       WHERE a.college_id = ?`,
      [collegeId]
    );

    res.json({
      success: true,
      code: 200,
      message: 'Participation rate retrieved',
      data: {
        totalActivities: stats[0].total_activities || 0,
        participated: stats[0].participated || 0,
        participationRate: stats[0].participation_rate || 0
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Failed to retrieve participation rate'
    });
  }
}

// GET /api/v1/dashboard/notifications
async function getNotifications(req, res) {
  try {
    const userId = req.user.user_id;
    const collegeId = req.user.college_id;
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);

    const [notifications] = await pool.query(
      `SELECT notification_id, title, message, type, read_status, created_at
       FROM notifications
       WHERE user_id = ? AND college_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [userId, collegeId, limit]
    );

    res.json({
      success: true,
      code: 200,
      message: 'Notifications retrieved',
      data: {
        items: notifications,
        total: notifications.length,
        unread: notifications.filter(n => !n.read_status).length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Failed to retrieve notifications'
    });
  }
}

// GET /api/v1/dashboard/tasks
async function getTasks(req, res) {
  try {
    const collegeId = req.user.college_id;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const status = req.query.status;
    const params = [collegeId];

    let where = 'WHERE t.college_id = ?';
    if (status) {
      where += ' AND t.status = ?';
      params.push(status);
    }

    const [rows] = await pool.query(
      `SELECT t.task_id, t.title, t.due_date, t.priority, t.status, t.notes, t.completed_at,
              t.assigned_to, t.created_by, t.created_at, t.updated_at,
              assignee.full_name AS assigned_to_name,
              creator.full_name AS created_by_name
       FROM dashboard_tasks t
       LEFT JOIN users assignee ON assignee.user_id = t.assigned_to
       LEFT JOIN users creator ON creator.user_id = t.created_by
       ${where}
       ORDER BY FIELD(t.status, 'Pending', 'Completed'), t.due_date ASC, t.created_at DESC
       LIMIT ?`,
      [...params, limit]
    );

    res.json({
      success: true,
      code: 200,
      message: 'Dashboard tasks retrieved',
      data: {
        items: rows,
        total: rows.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Failed to retrieve dashboard tasks'
    });
  }
}

// GET /api/v1/dashboard/schedule - Combines upcoming activities and meetings
async function getSchedule(req, res) {
  try {
    console.log('🔍 getSchedule called. req.user:', req.user);
    const collegeId = req.user?.college_id;
    if (!collegeId) {
      console.warn('⚠️ No collegeId found in req.user');
      return res.status(401).json({
        success: false,
        code: 401,
        message: 'Unauthorized - user not authenticated'
      });
    }
    console.log('✓ collegeId:', collegeId);

    const days = parseInt(req.query.days) || 7;

    const warnings = [];
    let activities = [];
    let meetings = [];

    // Get upcoming activities (events)
    try {
      const [rows] = await pool.query(
        `SELECT 
          a.activity_id as id,
          a.name as title,
          'Activity' as type,
          a.start_date as date,
          a.start_time as time,
          a.coordinator as assigned,
          a.status,
          'activity' as entity_type
         FROM activities
         WHERE college_id = ?
         ORDER BY start_date ASC, start_time ASC
         LIMIT 50`,
        [collegeId]
      );
      activities = rows;
    } catch (error) {
      console.error('Schedule activities query error:', error);
      warnings.push('activities');
    }

    // Get upcoming meetings
    try {
      const [rows] = await pool.query(
        `SELECT 
          m.meeting_id as id,
          m.title as title,
          'Meeting' as type,
          m.meeting_date as date,
          m.meeting_time as time,
          u.full_name as assigned,
          m.status,
          'meeting' as entity_type
         FROM meetings m
         LEFT JOIN users u ON m.created_by = u.user_id
         WHERE m.org_id IN (
           SELECT org_id FROM organizations WHERE college_id = ?
         )
         ORDER BY m.meeting_date ASC, m.meeting_time ASC
         LIMIT 50`,
        [collegeId]
      );
      meetings = rows;
    } catch (error) {
      console.error('Schedule meetings query error:', error);
      warnings.push('meetings');
    }

    if (warnings.length === 2) {
      throw new Error('Failed to load schedule data');
    }

    const toIsoDate = (value) => {
      if (!value) return null;
      const dt = new Date(value);
      if (Number.isNaN(dt.getTime())) return null;
      return dt.toISOString().split('T')[0];
    };
    const toTime = (value) => {
      if (!value) return '00:00';
      if (typeof value === 'string') return value.substring(0, 5);
      if (value instanceof Date) return value.toISOString().substring(11, 16);
      return String(value).substring(0, 5);
    };

    const combined = [
      ...activities.map(a => ({
        ...a,
        date: toIsoDate(a.date),
        time: toTime(a.time)
      })),
      ...meetings.map(m => ({
        ...m,
        date: toIsoDate(m.date),
        time: toTime(m.time)
      }))
    ].sort((a, b) => {
      const aDate = `${a.date}T${a.time}`;
      const bDate = `${b.date}T${b.time}`;
      return new Date(aDate) - new Date(bDate);
    });

    res.json({
      success: true,
      code: 200,
      message: 'Schedule retrieved',
      data: combined.slice(0, 50), // Limit to 50 items
      warnings
    });
  } catch (error) {
    console.error('Schedule error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Failed to retrieve schedule'
    });
  }
}

// GET /api/v1/dashboard/alerts - Get alerts and notifications
async function getAlerts(req, res) {
  try {
    const collegeId = req.user.college_id;
    const userId = req.user.user_id;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);

    const [alerts] = await pool.query(
      `SELECT 
        notification_id as id,
        title,
        message,
        type,
        read_status as dismissed,
        created_at
       FROM notifications
       WHERE college_id = ? AND user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [collegeId, userId, limit]
    );

    res.json({
      success: true,
      code: 200,
      message: 'Alerts retrieved',
      data: alerts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Failed to retrieve alerts'
    });
  }
}

// GET /api/v1/dashboard/kpis - Get Key Performance Indicators
async function getKPIs(req, res) {
  try {
    const collegeId = req.user.college_id;

    // KPIs to calculate
    const [totalActivities] = await pool.query(
      'SELECT COUNT(*) as count FROM activities WHERE college_id = ? AND status IN ("scheduled", "ongoing", "completed")',
      [collegeId]
    );

    const [activeMembers] = await pool.query(
      'SELECT COUNT(*) as count FROM users WHERE college_id = ? AND status = "active"',
      [collegeId]
    );

    const [budgetUsage] = await pool.query(
      `SELECT 
        COALESCE(SUM(allocated_amount), 0) as allocated,
        COALESCE(SUM(used_amount), 0) as used
       FROM budget_allocation WHERE college_id = ? AND fiscal_year = YEAR(NOW())`,
      [collegeId]
    );

    const [completedActivities] = await pool.query(
      'SELECT COUNT(*) as count FROM activities WHERE college_id = ? AND status = "completed"',
      [collegeId]
    );

    const allocated = parseFloat(budgetUsage[0]?.allocated) || 0;
    const used = parseFloat(budgetUsage[0]?.used) || 0;
    const budgetPercentage = allocated > 0 ? ((used / allocated) * 100).toFixed(1) : 0;

    const kpis = [
      {
        name: 'Total Activities',
        value: totalActivities[0]?.count || 0,
        change: 12.5
      },
      {
        name: 'Active Members',
        value: activeMembers[0]?.count || 0,
        change: 8.3
      },
      {
        name: 'Budget Usage',
        value: `${budgetPercentage}%`,
        change: 5.2
      },
      {
        name: 'Completed Activities',
        value: completedActivities[0]?.count || 0,
        change: 15.7
      }
    ];

    res.json({
      success: true,
      code: 200,
      message: 'KPIs retrieved',
      data: kpis
    });
  } catch (error) {
    console.error('KPIs error:', error);
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Failed to retrieve KPIs'
    });
  }
}

// POST /api/v1/dashboard/tasks
async function createTask(req, res) {
  try {
    const collegeId = req.user.college_id;
    const userId = req.user.user_id;
    const { title, due_date, priority = 'Medium', notes = null, assigned_to = null } = req.body;

    if (!title || !due_date) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'title and due_date are required'
      });
    }

    const [result] = await pool.query(
      `INSERT INTO dashboard_tasks
         (college_id, title, due_date, priority, status, notes, assigned_to, created_by)
       VALUES (?, ?, ?, ?, 'Pending', ?, ?, ?)`,
      [collegeId, title, due_date, priority, notes, assigned_to, userId]
    );

    await pool.query(
      `INSERT INTO activity_logs (college_id, user_id, action, entity_type, entity_id)
       VALUES (?, ?, 'CREATE', 'DashboardTask', ?)`,
      [collegeId, userId, result.insertId]
    );

    res.status(201).json({
      success: true,
      code: 201,
      message: 'Dashboard task created',
      data: { task_id: result.insertId }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Failed to create dashboard task'
    });
  }
}

// PUT /api/v1/dashboard/tasks/:id
async function updateTask(req, res) {
  try {
    const collegeId = req.user.college_id;
    const { id } = req.params;
    const { title, due_date, priority, status, notes, assigned_to } = req.body;

    const [existing] = await pool.query(
      'SELECT task_id FROM dashboard_tasks WHERE task_id = ? AND college_id = ?',
      [id, collegeId]
    );

    if (!existing.length) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Dashboard task not found'
      });
    }

    await pool.query(
      `UPDATE dashboard_tasks
       SET title = COALESCE(?, title),
           due_date = COALESCE(?, due_date),
           priority = COALESCE(?, priority),
           status = COALESCE(?, status),
           notes = COALESCE(?, notes),
           assigned_to = COALESCE(?, assigned_to),
           completed_at = CASE
             WHEN COALESCE(?, status) = 'Completed' THEN COALESCE(completed_at, NOW())
             ELSE NULL
           END
       WHERE task_id = ? AND college_id = ?`,
      [title, due_date, priority, status, notes, assigned_to, status, id, collegeId]
    );

    res.json({
      success: true,
      code: 200,
      message: 'Dashboard task updated'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Failed to update dashboard task'
    });
  }
}

// DELETE /api/v1/dashboard/tasks/:id
async function deleteTask(req, res) {
  try {
    const collegeId = req.user.college_id;
    const { id } = req.params;

    const [result] = await pool.query(
      'DELETE FROM dashboard_tasks WHERE task_id = ? AND college_id = ?',
      [id, collegeId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Dashboard task not found'
      });
    }

    res.json({
      success: true,
      code: 200,
      message: 'Dashboard task deleted'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Failed to delete dashboard task'
    });
  }
}

module.exports = {
  getStatistics,
  getOverview,
  getRecentActivities,
  getActivityTrend,
  getActivitiesByCategory,
  getBudgetDistribution,
  getParticipationRate,
  getNotifications,
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  getSchedule,
  getAlerts,
  getKPIs
};
