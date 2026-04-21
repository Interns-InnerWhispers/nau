const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/financeController');

// Stats
router.get('/stats', ctrl.getFinanceStats);

// Transactions
router.get('/transactions',       ctrl.getTransactions);
router.get('/transactions/:id',   ctrl.getTransaction);
router.post('/transactions',      ctrl.createTransaction);
router.put('/transactions/:id',   ctrl.updateTransaction);
router.delete('/transactions/:id',ctrl.deleteTransaction);
router.patch('/transactions/:id/submit',  ctrl.submitTransaction);
router.patch('/transactions/:id/approve', ctrl.approveTransaction);
router.post('/transactions/:id/receipt',  ctrl.uploadReceipt);

// Budgets
router.get('/budgets',     ctrl.getBudgets);
router.post('/budgets',    ctrl.createBudget);
router.put('/budgets/:id', ctrl.updateBudget);

module.exports = router;
