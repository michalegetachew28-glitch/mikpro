const express = require('express');
const { authenticate } = require('../middleware/auth');
const router = express.Router();
const prisma = require('../db');
const { handleRouteError } = require('../middleware/errorHandler');

// Helper: build date range from filter param
function buildFilterRange(filter, from, to) {
  const now = new Date();
  if (filter === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start.getTime() + 86400000);
    return { gte: start, lt: end };
  }
  if (filter === 'yesterday') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const end = new Date(start.getTime() + 86400000);
    return { gte: start, lt: end };
  }
  if (filter === 'this_week') {
    const day = now.getDay();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
    const end = new Date(start.getTime() + 7 * 86400000);
    return { gte: start, lt: end };
  }
  if (filter === 'this_month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { gte: start, lt: end };
  }
  if (filter === 'this_year') {
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear() + 1, 0, 1);
    return { gte: start, lt: end };
  }
  if (filter === 'custom' && from) {
    const range = {};
    if (from) range.gte = new Date(from);
    if (to) range.lte = new Date(to + 'T23:59:59.999Z');
    return range;
  }
  // Default to all-time
  return null;
}

// GET /api/financial-reports/summary
router.get('/summary', authenticate, async (req, res) => {
  try {
    const garageId = req.user.garageId;
    if (!garageId) {
      return res.status(400).json({ error: 'No garage associated with this account' });
    }

    const { filter, from, to } = req.query;
    const dateRange = buildFilterRange(filter, from, to);

    // Filter condition for invoice payments
    const invoiceWhere = {
      garageId,
      status: 'paid',
      ...(dateRange ? { verifiedAt: dateRange } : {})
    };

    // Filter condition for salary expenses
    const salaryWhere = {
      garageId,
      status: 'Paid',
      isDeleted: false,
      ...(dateRange ? { paymentDate: dateRange } : {})
    };

    // Parallel aggregates
    const [invoiceAgg, salaryAgg, invoiceCount, unpaidCount] = await Promise.all([
      prisma.invoice.aggregate({
        where: invoiceWhere,
        _sum: { total: true }
      }),
      prisma.salaryPayment.aggregate({
        where: salaryWhere,
        _sum: { amount: true }
      }),
      prisma.invoice.count({
        where: { garageId, status: 'paid' }
      }),
      prisma.invoice.count({
        where: { garageId, status: 'unpaid' }
      })
    ]);

    const income = invoiceAgg._sum.total || 0;
    const expenses = salaryAgg._sum.amount || 0;
    const profit = income - expenses;

    res.json({
      filterPeriod: filter || 'all',
      income,
      expenses,
      profit,
      paidInvoices: invoiceCount,
      unpaidInvoices: unpaidCount
    });
  } catch (err) {
    handleRouteError(err, 'GET /financial-reports/summary', res);
  }
});

module.exports = router;
