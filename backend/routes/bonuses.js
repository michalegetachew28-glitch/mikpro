const express = require('express');
const { authenticate } = require('../middleware/auth');
const router = express.Router();
const prisma = require('../db');
const { handleRouteError } = require('../middleware/errorHandler');

// GET /api/bonuses
router.get('/', authenticate, async (req, res) => {
  try {
    const garageId = req.user.garageId;
    if (!garageId) {
      return res.status(400).json({ error: 'No garage associated with this account' });
    }

    let bonuses;
    if (req.user.role === 'mechanic') {
      bonuses = await prisma.bonus.findMany({
        where: {
          garageId,
          userId: req.user.id
        },
        orderBy: { date: 'desc' }
      });
    } else if (req.user.role === 'customer') {
      bonuses = await prisma.bonus.findMany({
        where: {
          garageId,
          customerId: req.user.id
        },
        orderBy: { date: 'desc' }
      });
    } else {
      bonuses = await prisma.bonus.findMany({
        where: { garageId },
        orderBy: { date: 'desc' }
      });
    }

    const mapped = bonuses.map(b => ({
      id: b.id,
      jobId: b.jobId,
      invoiceId: b.invoiceId,
      customerId: b.customerId,
      mechanicId: b.userId,
      amount: b.amount,
      status: b.status,
      screenshot: b.screenshot,
      timestamp: b.date.toISOString()
    }));

    res.json(mapped);
  } catch (err) {
    handleRouteError(err, 'GET /bonuses', res);
  }
});

// POST /api/bonuses
router.post('/', authenticate, async (req, res) => {
  try {
    const garageId = req.user.garageId;
    if (!garageId) {
      return res.status(400).json({ error: 'No garage associated with this account' });
    }

    const { jobId, invoiceId, customerId, mechanicId, amount, status, screenshot } = req.body;
    if (!mechanicId || !amount) {
      return res.status(400).json({ error: 'Mechanic ID and Amount are required.' });
    }

    const created = await prisma.bonus.create({
      data: {
        garageId,
        userId: mechanicId, // mechanic
        amount: parseFloat(amount),
        reason: note => note || `Bonus for repair job ${jobId || invoiceId}`,
        jobId,
        invoiceId,
        customerId: customerId || req.user.id,
        status: status || 'Submitted',
        screenshot: screenshot || null
      }
    });

    res.status(201).json({
      id: created.id,
      jobId: created.jobId,
      invoiceId: created.invoiceId,
      customerId: created.customerId,
      mechanicId: created.userId,
      amount: created.amount,
      status: created.status,
      screenshot: created.screenshot,
      timestamp: created.date.toISOString()
    });
  } catch (err) {
    handleRouteError(err, 'POST /bonuses', res);
  }
});

module.exports = router;
