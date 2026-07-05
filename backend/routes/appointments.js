const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const router = express.Router();
const prisma = new PrismaClient();

router.get('/', authenticate, async (req, res) => {
  try {
    const appts = await prisma.appointment.findMany({
      where: { garageId: req.user.garageId },
      include: { vehicle: true, customer: true }
    });
    res.json(appts);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const appt = await prisma.appointment.create({ data: { garageId: req.user.garageId, ...req.body } });
    res.status(201).json(appt);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const appt = await prisma.appointment.update({ where: { id: req.params.id }, data: req.body });
    res.json(appt);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    await prisma.appointment.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
