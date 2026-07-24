const express = require('express');
const { authenticate } = require('../middleware/auth');
const { handleRouteError } = require('../middleware/errorHandler');
const router = express.Router();
const prisma = require('../db');

router.get('/', authenticate, async (req, res) => {
  try {
    const items = await prisma.inventory.findMany({ where: { garageId: req.user.garageId } });
    res.json(items);
  } catch (err) { handleRouteError(err, 'GET /inventory', res); }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const item = await prisma.inventory.create({ data: { garageId: req.user.garageId, ...req.body } });
    res.status(201).json(item);
  } catch (err) { handleRouteError(err, 'POST /inventory', res); }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const item = await prisma.inventory.update({ where: { id: req.params.id }, data: req.body });
    res.json(item);
  } catch (err) { handleRouteError(err, 'PUT /inventory/:id', res); }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    await prisma.inventory.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { handleRouteError(err, 'DELETE /inventory/:id', res); }
});

module.exports = router;
