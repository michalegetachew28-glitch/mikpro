const express = require('express');
const { authenticate } = require('../middleware/auth');
const { handleRouteError } = require('../middleware/errorHandler');
const router = express.Router();
const prisma = require('../db');

router.get('/', authenticate, async (req, res) => {
  try {
    const appts = await prisma.appointment.findMany({
      where: { garageId: req.user.garageId },
      include: { vehicle: true, customer: true }
    });
    res.json(appts);
  } catch (err) { handleRouteError(err, 'GET /appointments', res); }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const appt = await prisma.appointment.create({ data: { garageId: req.user.garageId, ...req.body } });
    res.status(201).json(appt);
  } catch (err) { handleRouteError(err, 'POST /appointments', res); }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const appt = await prisma.appointment.update({ where: { id: req.params.id }, data: req.body });
    res.json(appt);
  } catch (err) { handleRouteError(err, 'PUT /appointments/:id', res); }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    await prisma.appointment.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { handleRouteError(err, 'DELETE /appointments/:id', res); }
});

module.exports = router;
