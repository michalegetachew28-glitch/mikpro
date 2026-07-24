const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { handleRouteError } = require('../middleware/errorHandler');
const router = express.Router();
const prisma = require('../db');

// GET /api/salary-periods
router.get('/', authenticate, async (req, res) => {
  try {
    const periods = await prisma.salaryPeriod.findMany({
      where: { garageId: req.user.garageId, isDeleted: false },
      include: { _count: { select: { calculations: true } } },
      orderBy: { startDate: 'desc' }
    });
    res.json(periods);
  } catch (err) {
    handleRouteError(err, 'GET /salary-periods', res);
  }
});

// POST /api/salary-periods
router.post('/', authenticate, requireRole('admin', 'coder'), async (req, res) => {
  try {
    const { periodName, salaryType, startDate, endDate } = req.body;
    if (!periodName || !startDate || !endDate) return res.status(400).json({ error: 'periodName, startDate, endDate required' });
    const period = await prisma.salaryPeriod.create({
      data: { garageId: req.user.garageId, periodName, salaryType: salaryType || 'Monthly', startDate: new Date(startDate), endDate: new Date(endDate), status: 'Open' }
    });
    res.status(201).json(period);
  } catch (err) {
    handleRouteError(err, 'POST /salary-periods', res);
  }
});

// PATCH /api/salary-periods/:id/lock
router.patch('/:id/lock', authenticate, requireRole('admin', 'coder'), async (req, res) => {
  try {
    const { id } = req.params;
    const period = await prisma.salaryPeriod.findFirst({ where: { id, garageId: req.user.garageId, isDeleted: false } });
    if (!period) return res.status(404).json({ error: 'Period not found' });
    if (period.status === 'Paid') return res.status(400).json({ error: 'Paid periods cannot be modified' });
    const updated = await prisma.salaryPeriod.update({ where: { id }, data: { status: 'Locked' } });
    
    // Audit logging
    await prisma.activityLog.create({
      data: {
        garageId: req.user.garageId,
        userId: req.user.id,
        action: 'LOCK_PAYROLL_PERIOD',
        details: `Locked payroll period: ${period.periodName} (${id})`
      }
    });

    res.json(updated);
  } catch (err) {
    handleRouteError(err, 'PATCH /salary-periods/:id/lock', res);
  }
});

// PATCH /api/salary-periods/:id/unlock
router.patch('/:id/unlock', authenticate, requireRole('admin', 'coder'), async (req, res) => {
  try {
    const { id } = req.params;
    const period = await prisma.salaryPeriod.findFirst({ where: { id, garageId: req.user.garageId, isDeleted: false } });
    if (!period) return res.status(404).json({ error: 'Period not found' });
    if (period.status === 'Paid') return res.status(400).json({ error: 'Paid periods cannot be unlocked' });
    const updated = await prisma.salaryPeriod.update({ where: { id }, data: { status: 'Open' } });

    // Audit logging
    await prisma.activityLog.create({
      data: {
        garageId: req.user.garageId,
        userId: req.user.id,
        action: 'UNLOCK_PAYROLL_PERIOD',
        details: `Unlocked payroll period: ${period.periodName} (${id})`
      }
    });

    res.json(updated);
  } catch (err) {
    handleRouteError(err, 'PATCH /salary-periods/:id/unlock', res);
  }
});

// PATCH /api/salary-periods/:id/mark-paid
router.patch('/:id/mark-paid', authenticate, requireRole('admin', 'coder'), async (req, res) => {
  try {
    const { id } = req.params;
    const period = await prisma.salaryPeriod.findFirst({ where: { id, garageId: req.user.garageId, isDeleted: false } });
    if (!period) return res.status(404).json({ error: 'Period not found' });
    const updated = await prisma.salaryPeriod.update({ where: { id }, data: { status: 'Paid' } });

    // Audit logging
    await prisma.activityLog.create({
      data: {
        garageId: req.user.garageId,
        userId: req.user.id,
        action: 'MARK_PAYROLL_PERIOD_PAID',
        details: `Marked payroll period paid: ${period.periodName} (${id})`
      }
    });

    res.json(updated);
  } catch (err) {
    handleRouteError(err, 'PATCH /salary-periods/:id/mark-paid', res);
  }
});

module.exports = router;
