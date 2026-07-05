const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const router = express.Router();
const prisma = new PrismaClient();

router.get('/', authenticate, async (req, res) => {
  try {
    const repairs = await prisma.repair.findMany({
      where: { garageId: req.user.garageId },
      include: { vehicle: { include: { customer: true } }, mechanic: true, parts: true }
    });
    res.json(repairs);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { vehicleId, mechanicId, description, laborCost, mileage, parts = [] } = req.body;
    const partsCost = parts.reduce((sum, p) => sum + p.price * p.quantity, 0);
    const repair = await prisma.repair.create({
      data: {
        garageId: req.user.garageId,
        vehicleId, mechanicId, description, mileage,
        laborCost: parseFloat(laborCost || 0),
        partsCost,
        totalAmount: parseFloat(laborCost || 0) + partsCost,
        parts: { create: parts.map(p => ({ partName: p.partName, quantity: p.quantity, price: p.price })) }
      },
      include: { parts: true }
    });
    res.status(201).json(repair);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const { parts, ...data } = req.body;
    const repair = await prisma.repair.update({ where: { id: req.params.id }, data });
    res.json(repair);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    await prisma.repairPart.deleteMany({ where: { repairId: req.params.id } });
    await prisma.repair.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
