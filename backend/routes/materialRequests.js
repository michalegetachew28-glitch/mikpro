const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const router = express.Router();
const prisma = new PrismaClient();

// GET all material requests (with role scoping)
router.get('/', authenticate, async (req, res) => {
  try {
    const whereClause = { garageId: req.user.garageId };

    // Mechanics only see their own requests
    if (req.user.role === 'mechanic') {
      whereClause.mechanicId = req.user.id;
    }

    const requests = await prisma.materialRequest.findMany({
      where: whereClause,
      include: {
        part: true,
        repair: {
          include: {
            vehicle: true
          }
        },
        mechanic: true
      },
      orderBy: { timestamp: 'desc' }
    });

    // Map backend relational properties to match the frontend expected structure
    const mapped = requests.map(reqItem => ({
      id: reqItem.id,
      garageId: reqItem.garageId,
      partId: reqItem.partId,
      repairId: reqItem.repairId,
      mechanicId: reqItem.mechanicId,
      managerId: reqItem.managerId,
      requestedQty: reqItem.requestedQty,
      approvedQty: reqItem.approvedQty,
      status: reqItem.status,
      notes: reqItem.notes || '',
      timestamp: reqItem.timestamp.toISOString(),
      reviewedBy: reqItem.reviewedBy,
      reviewedAt: reqItem.reviewedAt ? reqItem.reviewedAt.toISOString() : null,
      pickedUpAt: reqItem.pickedUpAt ? reqItem.pickedUpAt.toISOString() : null,
      pickedUpBy: reqItem.pickedUpBy,
      partName: reqItem.part ? reqItem.part.partName : 'Unknown Part',
      partPrice: reqItem.part ? reqItem.part.price : 0
    }));

    res.json(mapped);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create material request
router.post('/', authenticate, async (req, res) => {
  try {
    const { partId, repairId, requestedQty, notes } = req.body;

    const mechanicId = req.user.role === 'mechanic' ? req.user.id : (req.body.mechanicId || req.user.id);

    // Verify part exists
    const part = await prisma.inventory.findFirst({
      where: { id: partId, garageId: req.user.garageId }
    });
    if (!part) {
      return res.status(404).json({ error: 'Selected part not found in inventory' });
    }

    // Verify repair exists
    const repair = await prisma.repair.findFirst({
      where: { id: repairId, garageId: req.user.garageId }
    });
    if (!repair) {
      return res.status(404).json({ error: 'Repair order not found' });
    }

    const mr = await prisma.materialRequest.create({
      data: {
        garageId: req.user.garageId,
        partId,
        repairId,
        mechanicId,
        requestedQty: parseInt(requestedQty || 1, 10),
        approvedQty: 0,
        status: 'pending',
        notes: notes || ''
      },
      include: { part: true }
    });

    const mapped = {
      id: mr.id,
      garageId: mr.garageId,
      partId: mr.partId,
      repairId: mr.repairId,
      mechanicId: mr.mechanicId,
      requestedQty: mr.requestedQty,
      approvedQty: mr.approvedQty,
      status: mr.status,
      notes: mr.notes,
      timestamp: mr.timestamp.toISOString(),
      partName: mr.part ? mr.part.partName : 'Unknown Part'
    };

    res.status(201).json(mapped);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update material request
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { status, approvedQty, notes } = req.body;
    const requestId = req.params.id;

    // Check existing request
    const existing = await prisma.materialRequest.findUnique({
      where: { id: requestId },
      include: { part: true, repair: true }
    });

    if (!existing || existing.garageId !== req.user.garageId) {
      return res.status(404).json({ error: 'Material request not found' });
    }

    const newStatus = status || existing.status;
    const finalQty = parseInt(approvedQty !== undefined ? approvedQty : existing.approvedQty, 10);

    const isIssuingNow = newStatus === 'picked-up' && existing.status !== 'picked-up';

    const updated = await prisma.$transaction(async (tx) => {
      if (isIssuingNow) {
        // Fetch inventory item inside transaction to prevent race conditions
        const part = await tx.inventory.findUnique({ where: { id: existing.partId } });
        if (!part) {
          throw new Error('Part not found in inventory');
        }

        if (part.quantity < finalQty) {
          throw new Error(`Insufficient stock. Available: ${part.quantity}, requested: ${finalQty}`);
        }

        // Deduct stock
        await tx.inventory.update({
          where: { id: existing.partId },
          data: { quantity: part.quantity - finalQty }
        });

        // Add to repair parts for billing
        await tx.repairPart.create({
          data: {
            repairId: existing.repairId,
            partName: part.partName,
            quantity: finalQty,
            price: part.price
          }
        });

        // Recalculating repair costs
        const repairParts = await tx.repairPart.findMany({
          where: { repairId: existing.repairId }
        });
        const partsCost = repairParts.reduce((sum, p) => sum + p.price * p.quantity, 0);

        await tx.repair.update({
          where: { id: existing.repairId },
          data: {
            partsCost,
            totalAmount: existing.repair.laborCost + partsCost
          }
        });
      }

      // Update material request status
      const extUpdate = {
        status: newStatus,
        approvedQty: finalQty,
        notes: notes !== undefined ? notes : existing.notes,
        reviewedBy: req.user.id,
        reviewedAt: new Date()
      };

      if (newStatus === 'picked-up' && !existing.pickedUpAt) {
        extUpdate.pickedUpAt = new Date();
        extUpdate.pickedUpBy = req.user.id;
      }

      return await tx.materialRequest.update({
        where: { id: requestId },
        data: extUpdate,
        include: { part: true }
      });
    });

    const mapped = {
      id: updated.id,
      garageId: updated.garageId,
      partId: updated.partId,
      repairId: updated.repairId,
      mechanicId: updated.mechanicId,
      managerId: updated.managerId,
      requestedQty: updated.requestedQty,
      approvedQty: updated.approvedQty,
      status: updated.status,
      notes: updated.notes || '',
      timestamp: updated.timestamp.toISOString(),
      reviewedBy: updated.reviewedBy,
      reviewedAt: updated.reviewedAt ? updated.reviewedAt.toISOString() : null,
      pickedUpAt: updated.pickedUpAt ? updated.pickedUpAt.toISOString() : null,
      pickedUpBy: updated.pickedUpBy,
      partName: updated.part ? updated.part.partName : 'Unknown Part',
      partPrice: updated.part ? updated.part.price : 0
    };

    res.json(mapped);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE material request
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const existing = await prisma.materialRequest.findUnique({
      where: { id: req.params.id }
    });

    if (!existing || existing.garageId !== req.user.garageId) {
      return res.status(404).json({ error: 'Material request not found' });
    }

    await prisma.materialRequest.delete({
      where: { id: req.params.id }
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
