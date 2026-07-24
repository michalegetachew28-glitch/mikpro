const express = require('express');
const { authenticate } = require('../middleware/auth');
const { handleRouteError } = require('../middleware/errorHandler');

const router = express.Router();
const prisma = require('../db');

// GET /api/subscriptions/my - Get current admin's subscription info
router.get('/my', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const requests = await prisma.paymentRequest.findMany({
      where: { adminId: req.user.id },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ user, requests });
  } catch (err) {
    handleRouteError(err, 'GET /subscriptions/my', res);
  }
});

// POST /api/subscriptions/submit - Submit a payment request
router.post('/submit', authenticate, async (req, res) => {
  try {
    const { planId, planName, amount, receipt, referenceNumber, bankName, notes } = req.body;
    if (!planId || !receipt) return res.status(400).json({ error: 'Plan and receipt are required' });

    const request = await prisma.paymentRequest.create({
      data: {
        adminId: req.user.id,
        garageId: req.user.garageId,
        planId,
        planName,
        amount: parseFloat(amount),
        receipt,
        referenceNumber,
        bankName,
        notes,
        status: 'pending'
      }
    });
    res.status(201).json(request);
  } catch (err) {
    handleRouteError(err, 'POST /subscriptions/submit', res);
  }
});

module.exports = router;
