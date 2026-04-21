// Finance Controller — Full CRUD
const pool = require('../config/database');

function normalizeTransactionType(type) {
  if (!type) return type;
  const lower = String(type).toLowerCase();
  if (lower === 'income') return 'Income';
  if (lower === 'expense') return 'Expense';
  return type;
}

// ── GET /api/v1/finance/stats ─────────────────────────────────
async function getFinanceStats(req, res) {
  try {
    const collegeId = req.user.college_id;

    const [income] = await pool.query(
      `SELECT COALESCE(SUM(amount),0) as total FROM transactions
       WHERE college_id = ? AND type = 'Income' AND status = 'approved'`,
      [collegeId]
    );
    const [expense] = await pool.query(
      `SELECT COALESCE(SUM(amount),0) as total FROM transactions
       WHERE college_id = ? AND type = 'Expense' AND status = 'approved'`,
      [collegeId]
    );
    const [allocated] = await pool.query(
      `SELECT COALESCE(SUM(allocated_amount),0) as total FROM budget_allocation
       WHERE college_id = ?`,
      [collegeId]
    );
    const [pending] = await pool.query(
      `SELECT COUNT(*) as count FROM transactions
       WHERE college_id = ? AND status = 'submitted'`,
      [collegeId]
    );

    const totalIncome  = parseFloat(income[0].total);
    const totalExpense = parseFloat(expense[0].total);
    const totalBudget  = parseFloat(allocated[0].total);

    res.json({
      success: true,
      data: {
        totalBudget,
        totalExpense,
        totalIncome,
        balance: totalIncome - totalExpense,
        pendingApprovals: pending[0].count,
      }
    });
  } catch (err) {
    console.error('Finance stats error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch finance stats' });
  }
}

// ── GET /api/v1/finance/transactions ─────────────────────────
async function getTransactions(req, res) {
  try {
    const collegeId = req.user.college_id;
    const {
      limit = 50, offset = 0, type = '', status = '',
      category = '', quarter = '', search = ''
    } = req.query;

    let where = 'WHERE t.college_id = ?';
    const params = [collegeId];

    if (type)     { where += ' AND t.type = ?';     params.push(normalizeTransactionType(type)); }
    if (status)   { where += ' AND t.status = ?';   params.push(status); }
    if (category) { where += ' AND t.category = ?'; params.push(category); }
    if (search)   { where += ' AND t.title LIKE ?'; params.push(`%${search}%`); }
    if (quarter) {
      const qMap = { Q1: [7,9], Q2: [10,12], Q3: [1,3], Q4: [4,6] };
      const [s, e] = qMap[quarter] || [];
      if (s) { where += ' AND MONTH(t.transaction_date) BETWEEN ? AND ?'; params.push(s, e); }
    }

    const [countRes] = await pool.query(
      `SELECT COUNT(*) as total FROM transactions t ${where}`, params
    );

    const [rows] = await pool.query(
      `SELECT t.*,
              u.full_name   AS submitter_name,
              a.full_name   AS approver_name,
              act.name      AS event_name,
              act.category  AS event_type,
              r.file_name   AS bill_file,
              r.uploaded_at AS bill_uploaded
       FROM transactions t
       LEFT JOIN users u   ON t.submitted_by    = u.user_id
       LEFT JOIN users a   ON t.approval_by     = a.user_id
       LEFT JOIN activities act ON t.event_id   = act.activity_id
       LEFT JOIN transaction_receipts r ON r.transaction_id = t.transaction_id
       ${where}
       ORDER BY t.transaction_date DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    res.json({
      success: true,
      data: {
        items: rows,
        total: countRes[0].total,
        page: Math.floor(offset / limit) + 1,
        page_size: parseInt(limit)
      }
    });
  } catch (err) {
    console.error('getTransactions error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch transactions' });
  }
}

// ── GET /api/v1/finance/transactions/:id ─────────────────────
async function getTransaction(req, res) {
  try {
    const collegeId = req.user.college_id;
    const { id } = req.params;

    const [rows] = await pool.query(
      `SELECT t.*,
              u.full_name   AS submitter_name,
              a.full_name   AS approver_name,
              act.name      AS event_name,
              r.file_name   AS bill_file,
              r.uploaded_at AS bill_uploaded
       FROM transactions t
       LEFT JOIN users u   ON t.submitted_by    = u.user_id
       LEFT JOIN users a   ON t.approval_by     = a.user_id
       LEFT JOIN activities act ON t.event_id   = act.activity_id
       LEFT JOIN transaction_receipts r ON r.transaction_id = t.transaction_id
       WHERE t.transaction_id = ? AND t.college_id = ?`,
      [id, collegeId]
    );

    res.status(404).json({
      success: false,
      code: 404,
      message: 'Transaction not found'
    });

    res.json({
      success: true,
      code: 200,
      data: rows[0]
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch transaction' });
  }
}

// ── POST /api/v1/finance/transactions ────────────────────────
async function createTransaction(req, res) {
  try {
    const collegeId = req.user.college_id;
    const userId    = req.user.user_id;
    const {
      title, type, category, amount, transaction_date,
      payment_method, event_id, notes, status = 'draft'
    } = req.body;

    if (!title || !type || !amount || !transaction_date) {
      return res.status(400).json({ success: false, message: 'title, type, amount, date are required' });
    }

    const normalizedType = normalizeTransactionType(type);

    const [result] = await pool.query(
      `INSERT INTO transactions
         (college_id, title, type, category, amount, transaction_date,
          payment_method, event_id, submitted_by, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [collegeId, title, normalizedType, category, amount, transaction_date,
       payment_method, event_id || null, userId, notes || null, status]
    );

    // Audit log
    await pool.query(
      `INSERT INTO activity_logs (college_id, user_id, action, entity_type, entity_id)
       VALUES (?, ?, 'CREATE', 'Transaction', ?)`,
      [collegeId, userId, result.insertId]
    );

    res.status(201).json({
      success: true,
      message: 'Transaction created',
      data: { transaction_id: result.insertId }
    });
  } catch (err) {
    console.error('createTransaction error:', err);
    res.status(500).json({ success: false, message: 'Failed to create transaction' });
  }
}

// ── PUT /api/v1/finance/transactions/:id ─────────────────────
async function updateTransaction(req, res) {
  try {
    const collegeId = req.user.college_id;
    const { id }    = req.params;
    const {
      title, type, category, amount, transaction_date,
      payment_method, event_id, notes, status
    } = req.body;

    const normalizedType = normalizeTransactionType(type);

    // Only allow edits on draft/rejected
    const [existing] = await pool.query(
      'SELECT status FROM transactions WHERE transaction_id = ? AND college_id = ?',
      [id, collegeId]
    );
    if (!existing.length) return res.status(404).json({ success: false, message: 'Not found' });
    if (!['draft', 'rejected'].includes(existing[0].status)) {
      return res.status(403).json({ success: false, message: 'Cannot edit a submitted or approved transaction' });
    }

    await pool.query(
      `UPDATE transactions
       SET title = COALESCE(?, title),
           type  = COALESCE(?, type),
           category = COALESCE(?, category),
           amount = COALESCE(?, amount),
           transaction_date = COALESCE(?, transaction_date),
           payment_method = COALESCE(?, payment_method),
           event_id = COALESCE(?, event_id),
           notes = COALESCE(?, notes),
           status = COALESCE(?, status)
       WHERE transaction_id = ? AND college_id = ?`,
      [title, normalizedType, category, amount, transaction_date,
       payment_method, event_id, notes, status, id, collegeId]
    );

    res.json({ success: true, message: 'Transaction updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update transaction' });
  }
}

// ── DELETE /api/v1/finance/transactions/:id ──────────────────
async function deleteTransaction(req, res) {
  try {
    const collegeId = req.user.college_id;
    const { id }    = req.params;

    const [existing] = await pool.query(
      'SELECT status FROM transactions WHERE transaction_id = ? AND college_id = ?',
      [id, collegeId]
    );
    if (!existing.length) return res.status(404).json({ success: false, message: 'Not found' });
    if (!['draft', 'rejected'].includes(existing[0].status)) {
      return res.status(403).json({ success: false, message: 'Only draft or rejected transactions can be deleted' });
    }

    await pool.query('DELETE FROM transactions WHERE transaction_id = ? AND college_id = ?', [id, collegeId]);
    res.json({ success: true, message: 'Transaction deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete transaction' });
  }
}

// ── PATCH /api/v1/finance/transactions/:id/submit ────────────
async function submitTransaction(req, res) {
  try {
    const collegeId = req.user.college_id;
    const { id }    = req.params;

    const [result] = await pool.query(
      `UPDATE transactions SET status = 'submitted'
       WHERE transaction_id = ? AND college_id = ? AND status IN ('draft','rejected')`,
      [id, collegeId]
    );

    if (!result.affectedRows) {
      return res.status(400).json({ success: false, message: 'Cannot submit this transaction' });
    }
    res.json({ success: true, message: 'Transaction submitted for approval' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to submit transaction' });
  }
}

// ── PATCH /api/v1/finance/transactions/:id/approve ───────────
async function approveTransaction(req, res) {
  try {
    const collegeId = req.user.college_id;
    const userId    = req.user.user_id;
    const { id }    = req.params;
    const { action, comment } = req.body; // action: 'approve' | 'reject'

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    await pool.query(
      `UPDATE transactions
       SET status = ?, approval_by = ?, approval_date = NOW(), approval_comments = ?
       WHERE transaction_id = ? AND college_id = ? AND status = 'submitted'`,
      [newStatus, userId, comment || null, id, collegeId]
    );

    res.json({ success: true, message: `Transaction ${newStatus}` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to process approval' });
  }
}

// ── GET /api/v1/finance/budgets ──────────────────────────────
async function getBudgets(req, res) {
  try {
    const collegeId  = req.user.college_id;
    const fiscalYear = req.query.fiscal_year || new Date().getFullYear();

    const [budgets] = await pool.query(
      `SELECT b.*,
              COALESCE((
                SELECT SUM(t.amount)
                FROM transactions t
                WHERE t.college_id = b.college_id
                  AND t.type = 'Expense' AND t.status = 'approved'
                  AND YEAR(t.transaction_date) = b.fiscal_year
                  AND (t.category = b.category OR b.category = 'Total')
              ), 0) AS actual_used
       FROM budget_allocation b
       WHERE b.college_id = ? AND b.fiscal_year = ?
       ORDER BY b.category`,
      [collegeId, fiscalYear]
    );

    res.json({ success: true, data: { items: budgets, fiscalYear } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch budgets' });
  }
}

// ── POST /api/v1/finance/budgets ─────────────────────────────
async function createBudget(req, res) {
  try {
    const collegeId = req.user.college_id;
    const { fiscal_year, category, allocated_amount } = req.body;

    const [result] = await pool.query(
      `INSERT INTO budget_allocation
         (college_id, fiscal_year, category, allocated_amount, remaining_amount)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE allocated_amount = ?, remaining_amount = ?`,
      [collegeId, fiscal_year, category, allocated_amount, allocated_amount, allocated_amount, allocated_amount]
    );

    res.status(201).json({
      success: true,
      message: 'Budget saved',
      data: { budget_id: result.insertId }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to save budget' });
  }
}

// ── PUT /api/v1/finance/budgets/:id ──────────────────────────
async function updateBudget(req, res) {
  try {
    const collegeId = req.user.college_id;
    const { id }    = req.params;
    const { allocated_amount, category } = req.body;

    await pool.query(
      `UPDATE budget_allocation
       SET allocated_amount = COALESCE(?, allocated_amount),
           category = COALESCE(?, category),
           remaining_amount = COALESCE(?, allocated_amount)
       WHERE budget_id = ? AND college_id = ?`,
      [allocated_amount, category, allocated_amount, id, collegeId]
    );

    res.json({ success: true, message: 'Budget updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update budget' });
  }
}

// ── POST /api/v1/finance/transactions/:id/receipt ────────────
async function uploadReceipt(req, res) {
  try {
    const collegeId = req.user.college_id;
    const userId = req.user.user_id;
    const { id } = req.params;
    const { file_name, file_url, amount_verified = false } = req.body || {};

    if (!file_name && !file_url) {
      return res.status(400).json({
        success: false,
        message: 'file_name or file_url is required'
      });
    }

    const [transactions] = await pool.query(
      'SELECT transaction_id FROM transactions WHERE transaction_id = ? AND college_id = ?',
      [id, collegeId]
    );

    if (!transactions.length) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    await pool.query(
      `INSERT INTO transaction_receipts (transaction_id, file_name, file_url, amount_verified, uploaded_by)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         file_name = VALUES(file_name),
         file_url = VALUES(file_url),
         amount_verified = VALUES(amount_verified),
         uploaded_by = VALUES(uploaded_by),
         uploaded_at = CURRENT_TIMESTAMP`,
      [id, file_name || null, file_url || null, !!amount_verified, userId]
    );

    res.json({
      success: true,
      message: 'Receipt metadata saved successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to save receipt metadata'
    });
  }
}

module.exports = {
  getFinanceStats,
  getTransactions,
  getTransaction,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  submitTransaction,
  approveTransaction,
  getBudgets,
  createBudget,
  updateBudget,
  uploadReceipt,
};
