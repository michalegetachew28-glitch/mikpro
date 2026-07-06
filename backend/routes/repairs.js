const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const router = express.Router();
const prisma = new PrismaClient();

router.get('/', authenticate, async (req, res) => {
  try {
    const whereClause = { garageId: req.user.garageId };
    
    // Role-based scoping
    if (req.user.role === 'mechanic') {
      whereClause.mechanicId = req.user.id;
    } else if (req.user.role === 'customer') {
      whereClause.vehicle = { customerId: req.user.id };
    }
    
    const repairs = await prisma.repair.findMany({
      where: whereClause,
      include: { vehicle: { include: { customer: true } }, mechanic: true, parts: true }
    });
    res.json(repairs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const repair = await prisma.repair.findUnique({
      where: { id: req.params.id },
      include: { vehicle: { include: { customer: true } }, mechanic: true, parts: true }
    });
    
    if (!repair) {
      return res.status(404).json({ error: 'Repair order not found' });
    }
    
    // Access control
    if (req.user.role === 'mechanic' && repair.mechanicId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied: You are not the assigned mechanic' });
    }
    if (req.user.role === 'customer' && repair.vehicle?.customerId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json(repair);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { vehicleId, mechanicId, description, laborCost, mileage, parts = [] } = req.body;
    
    // Map empty string mechanicId to null
    const finalMechanicId = mechanicId === "" || !mechanicId ? null : mechanicId;
    
    if (finalMechanicId) {
      const mechanic = await prisma.user.findFirst({
        where: { id: finalMechanicId, garageId: req.user.garageId }
      });
      if (!mechanic) {
        return res.status(400).json({ error: 'Invalid mechanic selected for this garage' });
      }
    }
    
    const partsCost = parts.reduce((sum, p) => sum + parseFloat(p.price || 0) * parseInt(p.quantity || 0), 0);
    const parsedLaborCost = parseFloat(laborCost || 0);
    const totalAmount = parsedLaborCost + partsCost;

    const repair = await prisma.repair.create({
      data: {
        garageId: req.user.garageId,
        vehicleId,
        mechanicId: finalMechanicId,
        description,
        mileage,
        laborCost: parsedLaborCost,
        partsCost,
        totalAmount,
        status: 'pending',
        parts: {
          create: parts.map(p => ({
            partName: p.partName,
            quantity: parseInt(p.quantity || 0),
            price: parseFloat(p.price || 0)
          }))
        }
      },
      include: { parts: true, vehicle: { include: { customer: true } }, mechanic: true }
    });
    res.status(201).json(repair);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const { parts, ...data } = req.body;
    const repairId = req.params.id;

    // Check if repair exists
    const existingRepair = await prisma.repair.findUnique({
      where: { id: repairId }
    });
    
    if (!existingRepair) {
      return res.status(404).json({ error: 'Repair order not found' });
    }
    
    // Role-based authorization
    if (req.user.role === 'mechanic' && existingRepair.mechanicId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied: You are not the assigned mechanic' });
    }

    // Clean mechanic assignment
    if (data.mechanicId === '') {
      data.mechanicId = null;
    } else if (data.mechanicId) {
      const mechanic = await prisma.user.findFirst({
        where: { id: data.mechanicId, garageId: req.user.garageId }
      });
      if (!mechanic) {
        return res.status(400).json({ error: 'Invalid mechanic selected' });
      }
    }

    let partsCost = existingRepair.partsCost;
    const laborCost = data.laborCost !== undefined ? parseFloat(data.laborCost || 0) : existingRepair.laborCost;

    const updated = await prisma.$transaction(async (tx) => {
      if (parts && Array.isArray(parts)) {
        // Delete old parts
        await tx.repairPart.deleteMany({ where: { repairId } });
        // Create new parts
        if (parts.length > 0) {
          await tx.repairPart.createMany({
            data: parts.map(p => ({
              repairId,
              partName: p.partName,
              quantity: parseInt(p.quantity || 0),
              price: parseFloat(p.price || 0)
            }))
          });
        }
        partsCost = parts.reduce((sum, p) => sum + parseFloat(p.price || 0) * parseInt(p.quantity || 0), 0);
      }

      const totalAmount = laborCost + partsCost;

      return await tx.repair.update({
        where: { id: repairId },
        data: {
          ...data,
          laborCost,
          partsCost,
          totalAmount,
          exitDate: data.status === 'completed' ? new Date() : existingRepair.exitDate
        },
        include: { parts: true }
      });
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const existingRepair = await prisma.repair.findUnique({
      where: { id: req.params.id }
    });
    
    if (!existingRepair) {
      return res.status(404).json({ error: 'Repair order not found' });
    }
    
    if (req.user.role !== 'admin' && req.user.role !== 'coder') {
      return res.status(403).json({ error: 'Access denied: Only administrators can delete repair orders' });
    }

    await prisma.$transaction([
      prisma.repairPart.deleteMany({ where: { repairId: req.params.id } }),
      prisma.repair.delete({ where: { id: req.params.id } })
    ]);
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
