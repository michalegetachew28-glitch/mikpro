const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

const prisma = require('../db');

// ──────────────────────────────────────────────────────────────
//  Auth + Role Middleware
// ──────────────────────────────────────────────────────────────
const ALLOWED_ROLES = ['admin', 'manager', 'coder'];

const authenticate = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const decoded = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const authorizeRevenue = (req, res, next) => {
  if (!ALLOWED_ROLES.includes(req.user?.role)) {
    return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
  }
  next();
};

// ──────────────────────────────────────────────────────────────
//  Helper: build date range from filter param
// ──────────────────────────────────────────────────────────────
function buildDateRange(filter, from, to, exact) {
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
  if (filter === 'exact' && exact) {
    const start = new Date(exact);
    const end = new Date(start.getTime() + 86400000);
    return { gte: start, lt: end };
  }
  if (filter === 'custom' && from) {
    const range = {};
    if (from) range.gte = new Date(from);
    if (to) range.lte = new Date(to + 'T23:59:59.999Z');
    return range;
  }
  return null;
}

// ──────────────────────────────────────────────────────────────
//  GET /api/revenue/summary
// ──────────────────────────────────────────────────────────────
router.get('/summary', authenticate, authorizeRevenue, async (req, res, next) => {
  try {
    const garageId = req.user.garageId;
    if (!garageId) return res.status(400).json({ error: 'No garage associated with account' });

    const now = new Date();

    // Helper to sum totalAmount for paid invoices in a range
    const sumRevenue = async (dateRange) => {
      const result = await prisma.invoice.aggregate({
        where: {
          garageId,
          status: 'paid',
          date: dateRange
        },
        _sum: { total: true },
        _count: { id: true }
      });
      return result._sum.total || 0;
    };

    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const [todayRev, weekRev, monthRev, yearRev, totalAll, paidCount, unpaidCount] = await Promise.all([
      sumRevenue({ gte: todayStart }),
      sumRevenue({ gte: weekStart }),
      sumRevenue({ gte: monthStart }),
      sumRevenue({ gte: yearStart }),
      prisma.invoice.aggregate({
        where: { garageId, status: 'paid' },
        _sum: { total: true }
      }),
      prisma.invoice.count({ where: { garageId, status: 'paid' } }),
      prisma.invoice.count({ where: { garageId, status: { not: 'paid' } } })
    ]);

    res.json({
      today: todayRev,
      week: weekRev,
      month: monthRev,
      year: yearRev,
      total: totalAll._sum.total || 0,
      paidInvoices: paidCount,
      unpaidInvoices: unpaidCount
    });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────────────────────
//  GET /api/revenue/list
// ──────────────────────────────────────────────────────────────
router.get('/list', authenticate, authorizeRevenue, async (req, res, next) => {
  try {
    const garageId = req.user.garageId;
    if (!garageId) return res.status(400).json({ error: 'No garage associated with account' });

    const {
      filter, from, to, exact,
      search = '',
      page = '1',
      limit = '20',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const dateRange = buildDateRange(filter, from, to, exact);

    // Build search conditions
    const searchConditions = search
      ? {
          OR: [
            { orderId: { contains: search, mode: 'insensitive' } },
            { customerName: { contains: search, mode: 'insensitive' } }
          ]
        }
      : {};

    const where = {
      garageId,
      status: 'paid',
      ...(dateRange ? { createdAt: dateRange } : {}),
      ...searchConditions
    };

    // Validate sortBy to prevent injection
    const allowedSortFields = ['date', 'total', 'customerName', 'orderId'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'date';
    const safeSortOrder = sortOrder === 'asc' ? 'asc' : 'desc';

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where: {
          garageId,
          status: 'paid',
          ...(dateRange ? { date: dateRange } : {}),
          ...searchConditions
        },
        orderBy: { [safeSortBy]: safeSortOrder },
        skip,
        take: limitNum,
        include: {
          garage: { select: { name: true } }
        }
      }),
      prisma.invoice.count({ where: {
        garageId,
        status: 'paid',
        ...(dateRange ? { date: dateRange } : {}),
        ...searchConditions
      }})
    ]);

    // Enrich invoices with repair data
    const enriched = await Promise.all(
      invoices.map(async (inv) => {
        let repairData = null;
        if (inv.orderId) {
          repairData = await prisma.repair.findFirst({
            where: { id: inv.orderId },
            include: {
              vehicle: { select: { plateNumber: true, model: true, make: true } }
            }
          });
        }

        return {
          id: inv.id,
          invoiceNumber: inv.orderId,
          repairOrderNumber: inv.repairId || '—',
          customerName: inv.customerName,
          vehiclePlate: inv.vehiclePlate || repairData?.vehicle?.plateNumber || '—',
          vehicleModel: inv.vehicleInfo || (repairData?.vehicle
            ? `${repairData.vehicle.make || ''} ${repairData.vehicle.model || ''}`.trim()
            : '—'),
          paymentMethod: inv.paymentMethod || 'cash',
          amount: inv.total,
          status: inv.status,
          paymentDate: inv.verifiedAt || inv.date,
          cashier: req.user.name || 'Staff'
        };
      })
    );

    res.json({
      data: enriched,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────────────────────
//  GET /api/revenue/analytics
// ──────────────────────────────────────────────────────────────
router.get('/analytics', authenticate, authorizeRevenue, async (req, res, next) => {
  try {
    const garageId = req.user.garageId;
    if (!garageId) return res.status(400).json({ error: 'No garage associated with account' });

    // Fetch all paid invoices in last 365 days
    const yearStart = new Date();
    yearStart.setFullYear(yearStart.getFullYear() - 1);

    const paidInvoices = await prisma.invoice.findMany({
      where: { garageId, status: 'paid', date: { gte: yearStart } },
      select: { total: true, date: true, paymentMethod: true }
    });

    const allInvoices = await prisma.invoice.findMany({
      where: { garageId, date: { gte: yearStart } },
      select: { total: true, status: true, date: true }
    });

    // Daily revenue — last 30 days
    const dailyMap = {};
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dailyMap[key] = 0;
    }
    paidInvoices.forEach(inv => {
      const key = new Date(inv.date).toISOString().slice(0, 10);
      if (dailyMap[key] !== undefined) dailyMap[key] += inv.total;
    });

    // Weekly revenue — last 12 weeks
    const weeklyMap = {};
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 7 * 86400000);
      const weekStart = new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());
      const key = weekStart.toISOString().slice(0, 10);
      weeklyMap[key] = 0;
    }
    paidInvoices.forEach(inv => {
      const d = new Date(inv.date);
      const ws = new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());
      const key = ws.toISOString().slice(0, 10);
      if (weeklyMap[key] !== undefined) weeklyMap[key] += inv.total;
    });

    // Monthly revenue — last 12 months
    const monthlyMap = {};
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyMap[key] = 0;
    }
    paidInvoices.forEach(inv => {
      const d = new Date(inv.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyMap[key] !== undefined) monthlyMap[key] += inv.total;
    });

    // Yearly revenue — last 5 years
    const yearlyMap = {};
    for (let i = 4; i >= 0; i--) {
      const y = now.getFullYear() - i;
      yearlyMap[y] = 0;
    }
    paidInvoices.forEach(inv => {
      const y = new Date(inv.date).getFullYear();
      if (yearlyMap[y] !== undefined) yearlyMap[y] += inv.total;
    });

    // Paid vs Unpaid totals
    const paidTotal = allInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0);
    const unpaidTotal = allInvoices.filter(i => i.status !== 'paid').reduce((s, i) => s + i.total, 0);

    // Payment method distribution from actual paymentMethod field
    const paymentMethods = { cash: 0, bank: 0, mobile: 0 };
    paidInvoices.forEach(inv => {
      const method = (inv.paymentMethod || 'cash').toLowerCase();
      if (paymentMethods[method] !== undefined) {
        paymentMethods[method] += inv.total;
      } else {
        paymentMethods['cash'] += inv.total;
      }
    });

    res.json({
      daily: Object.entries(dailyMap).map(([date, amount]) => ({ date, amount })),
      weekly: Object.entries(weeklyMap).map(([date, amount]) => ({ date, amount })),
      monthly: Object.entries(monthlyMap).map(([date, amount]) => ({ date, amount })),
      yearly: Object.entries(yearlyMap).map(([year, amount]) => ({ year, amount })),
      paidVsUnpaid: { paid: paidTotal, unpaid: unpaidTotal },
      paymentMethods: Object.entries(paymentMethods).map(([method, amount]) => ({ method, amount }))
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
