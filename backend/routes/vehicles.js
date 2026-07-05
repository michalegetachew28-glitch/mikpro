const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const router = express.Router();
const prisma = new PrismaClient();

// GET /api/vehicles - All vehicles for the garage
router.get('/', authenticate, async (req, res) => {
  try {
    const vehicles = await prisma.vehicle.findMany({
      where: { garageId: req.user.garageId },
      include: { customer: true }
    });
    res.json(vehicles);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/vehicles
router.post('/', authenticate, async (req, res) => {
  try {
    const { customerId, plateNumber, make, model, year, vin, color, type } = req.body;
    const vehicle = await prisma.vehicle.create({
      data: { garageId: req.user.garageId, customerId, plateNumber, make, model, year: String(year), vin, color, type }
    });
    res.status(201).json(vehicle);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/vehicles/:id
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { customerId, plateNumber, make, model, year, vin, color, type } = req.body;
    const vehicle = await prisma.vehicle.update({
      where: { id: req.params.id },
      data: {
        customerId,
        plateNumber,
        make,
        model,
        year: year ? String(year) : undefined,
        vin,
        color,
        type
      }
    });
    res.json(vehicle);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/vehicles/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    await prisma.vehicle.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
