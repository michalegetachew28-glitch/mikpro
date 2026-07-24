const express = require('express');
const { authenticate } = require('../middleware/auth');
const router = express.Router();
const prisma = require('../db');
const { handleRouteError } = require('../middleware/errorHandler');

// Helper to check user name
async function getUserName(userId) {
  if (!userId) return 'System';
  if (userId === 'devroot') return 'System Developer';
  const u = await prisma.user.findUnique({ where: { id: userId } });
  return u ? u.name : 'Unknown User';
}

// GET /repairs/customer — dedicated customer endpoint with full nested data
router.get('/customer', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'customer' && req.user.role !== 'coder') {
      return res.status(403).json({ error: 'Access denied: Customers only' });
    }

    // Find all vehicles owned by this customer
    const allRepairs = await prisma.repair.findMany({
      where: {
        garageId: req.user.garageId,
        vehicle: { customerId: req.user.id }
      },
      include: {
        vehicle: { include: { customer: true } },
        mechanic: true,
        parts: true,
        statusHistory: { orderBy: { createdAt: 'asc' } },
        materialRequests: {
          include: { part: true },
          orderBy: { timestamp: 'desc' }
        }
      },
      orderBy: { entryDate: 'desc' }
    });

    const invoices = await prisma.invoice.findMany({
      where: {
        garageId: req.user.garageId,
        customerId: req.user.id
      }
    });
    const invoiceRepairIds = new Set(invoices.map(inv => inv.repairId).filter(Boolean));

    // Map to a rich frontend structure
    const mapped = allRepairs.map(r => ({
      id: r.id,
      garageId: r.garageId,
      vehicleId: r.vehicleId,
      mechanicId: r.mechanicId,
      status: r.status,
      entryDate: r.entryDate,
      exitDate: r.exitDate,
      description: r.description,
      laborCost: r.laborCost,
      partsCost: r.partsCost,
      totalAmount: r.totalAmount,
      assignmentStatus: r.assignmentStatus,
      completionNotes: r.completionNotes,
      vehicle: r.vehicle,
      mechanic: r.mechanic ? {
        id: r.mechanic.id,
        name: r.mechanic.name,
        phone: r.mechanic.phone,
        email: r.mechanic.email
      } : null,
      parts: r.parts,
      statusHistory: r.statusHistory,
      hasInvoice: invoiceRepairIds.has(r.id),
      invoiceId: invoices.find(inv => inv.repairId === r.id)?.orderId || null,
      materialRequests: r.materialRequests.map(mr => ({
        id: mr.id,
        partId: mr.partId,
        partName: mr.part?.partName || 'Unknown Part',
        requestedQty: mr.requestedQty,
        approvedQty: mr.approvedQty,
        issuedQty: mr.status === 'picked-up' ? mr.approvedQty : 0,
        status: mr.status,
        notes: mr.notes || '',
        timestamp: mr.timestamp,
        reviewedAt: mr.reviewedAt,
        pickedUpAt: mr.pickedUpAt
      }))
    }));

    res.json(mapped);
  } catch (err) {
    handleRouteError(err, 'GET /repairs/customer', res);
  }
});

router.get('/', authenticate, async (req, res) => {
  try {
    const whereClause = {};
    if (req.user.role !== 'coder') {
      whereClause.garageId = req.user.garageId;
    }

    // Role-based scoping
    if (req.user.role === 'mechanic') {
      whereClause.mechanicId = req.user.id;
    } else if (req.user.role === 'customer') {
      whereClause.vehicle = { customerId: req.user.id };
    } else if (req.user.role === 'cashier') {
      whereClause.status = { in: ['completed', 'delivered'] };
    }

    const repairs = await prisma.repair.findMany({
      where: whereClause,
      include: {
        vehicle: { include: { customer: true } },
        mechanic: true,
        parts: true,
        statusHistory: { orderBy: { createdAt: 'asc' } }
      },
      orderBy: { entryDate: 'desc' }
    });

    const invoices = await prisma.invoice.findMany({
      where: {
        garageId: req.user.role === 'coder' ? undefined : req.user.garageId
      }
    });
    const invoiceRepairIds = new Set(invoices.map(inv => inv.repairId).filter(Boolean));

    const enrichedRepairs = repairs.map(r => ({
      ...r,
      hasInvoice: invoiceRepairIds.has(r.id),
      invoiceId: invoices.find(inv => inv.repairId === r.id)?.orderId || null
    }));

    res.json(enrichedRepairs);
  } catch (err) {
    handleRouteError(err, 'GET /repairs', res);
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const repair = await prisma.repair.findUnique({
      where: { id: req.params.id },
      include: {
        vehicle: { include: { customer: true } },
        mechanic: true,
        parts: true,
        statusHistory: { orderBy: { createdAt: 'asc' } }
      }
    });

    if (!repair) {
      return res.status(404).json({ error: 'Repair order not found' });
    }

    // Access control
    if (req.user.role !== 'coder' && repair.garageId !== req.user.garageId) {
      return res.status(403).json({ error: 'Access denied: Garage mismatch' });
    }
    if (req.user.role === 'mechanic' && repair.mechanicId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied: You are not the assigned mechanic' });
    }
    if (req.user.role === 'customer' && repair.vehicle?.customerId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied: You do not own this vehicle' });
    }
    if (req.user.role === 'cashier' && repair.status !== 'completed' && repair.status !== 'delivered') {
      return res.status(403).json({ error: 'Access denied: Cashiers can only view completed repair orders' });
    }

    const invoice = await prisma.invoice.findFirst({
      where: { repairId: repair.id }
    });

    res.json({
      ...repair,
      hasInvoice: !!invoice,
      invoiceId: invoice?.orderId || null
    });
  } catch (err) {
    handleRouteError(err, 'GET /repairs/:id', res);
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { vehicleId, mechanicId, description, laborCost, mileage, parts = [] } = req.body;

    // Role validation: cashier/customer/mechanic cannot create
    if (['customer', 'cashier', 'mechanic'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied: Edit permissions required to create repair orders' });
    }

    if (!vehicleId) {
      return res.status(400).json({ error: 'Vehicle ID is required' });
    }

    // Prevent duplicate repair orders for the same vehicle
    const activeRepair = await prisma.repair.findFirst({
      where: {
        vehicleId,
        status: { in: ['pending', 'accepted', 'in-progress', 'waiting-for-parts'] }
      }
    });

    if (activeRepair) {
      return res.status(400).json({ error: 'An active repair order already exists for this vehicle' });
    }

    // Map empty string mechanicId to null
    const finalMechanicId = mechanicId === "" || !mechanicId ? null : mechanicId;

    if (finalMechanicId) {
      const mechanic = await prisma.user.findFirst({
        where: { id: finalMechanicId, garageId: req.user.garageId, status: { not: 'inactive' } }
      });
      if (!mechanic) {
        return res.status(400).json({ error: 'Invalid or inactive mechanic selected for this garage' });
      }
    }

    const partsCost = parts.reduce((sum, p) => sum + parseFloat(p.price || 0) * parseInt(p.quantity || 0), 0);
    const parsedLaborCost = parseFloat(laborCost || 0);
    const totalAmount = parsedLaborCost + partsCost;
    const userName = await getUserName(req.user.id);

    const repair = await prisma.repair.create({
      data: {
        garageId: req.user.garageId,
        vehicleId,
        mechanicId: finalMechanicId,
        description,
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
        },
        statusHistory: {
          create: {
            status: 'pending',
            notes: 'Repair order created',
            changedById: req.user.id,
            changedBy: userName
          }
        }
      },
      include: {
        parts: true,
        vehicle: { include: { customer: true } },
        mechanic: true,
        statusHistory: true
      }
    });

    res.status(201).json(repair);
  } catch (err) {
    handleRouteError(err, 'POST /repairs', res);
  }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const { parts, mileage, ...data } = req.body;
    const repairId = req.params.id;

    // Check if repair exists
    const existingRepair = await prisma.repair.findUnique({
      where: { id: repairId }
    });

    if (!existingRepair) {
      return res.status(404).json({ error: 'Repair order not found' });
    }

    // Scope check: restrict other garage modifications
    if (req.user.role !== 'coder' && existingRepair.garageId !== req.user.garageId) {
      return res.status(403).json({ error: 'Access denied: Garage mismatch' });
    }

    // Role-based editing restrictions
    const allowedRolesToEdit = ['admin', 'coder', 'receptionist', 'mechanic'];
    if (!allowedRolesToEdit.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied: You do not have permission to edit repair orders' });
    }

    if (req.user.role === 'mechanic') {
      if (existingRepair.mechanicId !== req.user.id) {
        return res.status(403).json({ error: 'Access denied: You are not the assigned mechanic' });
      }
      // Mechanics can only modify status-related mechanics parameters
      const allowedKeysForMechanic = ['status', 'assignmentStatus', 'declineReason', 'declineVoice', 'completionNotes'];
      const clientKeys = Object.keys(data);
      for (const key of clientKeys) {
        if (!allowedKeysForMechanic.includes(key)) {
          return res.status(403).json({ error: `Access denied: Mechanics cannot edit ${key}` });
        }
      }
      if (parts !== undefined) {
        return res.status(403).json({ error: 'Access denied: Mechanics cannot edit parts pricing/quantity details' });
      }
    }

    // Prevent editing completed repair unless authorized
    const isAuthorizedReopener = ['admin', 'receptionist', 'coder'].includes(req.user.role);
    if (existingRepair.status === 'completed' && !isAuthorizedReopener) {
      return res.status(403).json({ error: 'Access denied: Completed repair orders cannot be reopened or edited by mechanics' });
    }

    // Clean mechanic assignment
    if (data.mechanicId === '') {
      data.mechanicId = null;
    } else if (data.mechanicId) {
      const mechanic = await prisma.user.findFirst({
        where: { id: data.mechanicId, garageId: req.user.garageId, status: { not: 'inactive' } }
      });
      if (!mechanic) {
        return res.status(400).json({ error: 'Invalid or inactive mechanic selected' });
      }
    }

    let partsCost = existingRepair.partsCost;
    const laborCost = data.laborCost !== undefined ? parseFloat(data.laborCost || 0) : existingRepair.laborCost;
    const userName = await getUserName(req.user.id);
    const isStatusChanging = data.status && data.status !== existingRepair.status;
    const isAssignmentChanging = data.assignmentStatus && data.assignmentStatus !== existingRepair.assignmentStatus;

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Manage Parts Updates if provided
      if (parts && Array.isArray(parts)) {
        await tx.repairPart.deleteMany({ where: { repairId } });
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

      // 2. If status is changing to 'completed', finish material requests
      if (data.status === 'completed') {
        await tx.materialRequest.updateMany({
          where: { repairId, status: { in: ['picked-up', 'approved', 'pending'] } },
          data: { status: 'completed' }
        });
      }

      const totalAmount = laborCost + partsCost;

      const updatedRepair = await tx.repair.update({
        where: { id: repairId },
        data: {
          ...data,
          laborCost,
          partsCost,
          totalAmount,
          exitDate: data.status === 'completed' ? new Date() : (data.status === 'delivered' ? existingRepair.exitDate || new Date() : existingRepair.exitDate)
        },
        include: { parts: true, vehicle: { include: { customer: true } }, mechanic: true }
      });

      // 3. Log Status / Assignment changes to Audit/Status Timeline History
      if (isStatusChanging || isAssignmentChanging) {
        let historyNote = '';
        if (isStatusChanging) {
          historyNote = `Status changed to ${data.status}`;
          if (data.status === 'completed' && data.completionNotes) {
            historyNote += `. Notes: ${data.completionNotes}`;
          }
        } else if (isAssignmentChanging) {
          historyNote = `Assignment status changed to ${data.assignmentStatus}`;
          if (data.assignmentStatus === 'declined' && data.declineReason) {
            historyNote += `. Reason: ${data.declineReason}`;
          }
        }

        await tx.repairStatusHistory.create({
          data: {
            repairId,
            status: data.status || existingRepair.status,
            notes: historyNote || data.notes || null,
            changedById: req.user.id,
            changedBy: userName
          }
        });
      }

      return updatedRepair;
    });

    res.json(updated);
  } catch (err) {
    handleRouteError(err, 'PUT /repairs/:id', res);
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
      prisma.repairStatusHistory.deleteMany({ where: { repairId: req.params.id } }),
      prisma.repairPart.deleteMany({ where: { repairId: req.params.id } }),
      prisma.repair.delete({ where: { id: req.params.id } })
    ]);

    res.json({ success: true });
  } catch (err) {
    handleRouteError(err, 'DELETE /repairs/:id', res);
  }
});

module.exports = router;
