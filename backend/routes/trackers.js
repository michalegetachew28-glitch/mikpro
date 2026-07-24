const express = require('express');
const router = express.Router();
const prisma = require('../db');
const { authenticate } = require('../middleware/auth');
const { handleRouteError } = require('../middleware/errorHandler');

// GET active trackers matching role/scope
router.get('/active', authenticate, async (req, res) => {
  try {
    const role = req.user.role.toLowerCase();
    const userId = req.user.id;
    let whereClause = {
      status: { notIn: ['completed', 'cancelled'] }
    };

    if (['admin', 'manager', 'receptionist', 'cashier', 'storekeeper', 'inventorymanager'].includes(role)) {
      if (role !== 'coder') {
        whereClause.garageId = req.user.garageId;
      }
    } else if (role === 'mechanic') {
      whereClause.mechanicId = userId;
    } else if (role === 'customer') {
      whereClause.customerId = userId;
    } else {
      return res.status(403).json({ error: 'Access denied: Unknown role' });
    }

    const trackers = await prisma.tracker.findMany({
      where: whereClause,
      include: {
        repair: {
          include: {
            vehicle: true
          }
        }
      },
      orderBy: { timestamp: 'desc' }
    });

    res.json(trackers);
  } catch (err) {
    handleRouteError(err, 'GET /trackers/active', res);
  }
});

// GET tracker history (completed/cancelled)
router.get('/history', authenticate, async (req, res) => {
  try {
    const role = req.user.role.toLowerCase();
    const userId = req.user.id;
    let whereClause = {
      status: { in: ['completed', 'cancelled'] }
    };

    if (['admin', 'manager', 'receptionist', 'cashier'].includes(role)) {
      if (role !== 'coder') {
        whereClause.garageId = req.user.garageId;
      }
    } else if (role === 'mechanic') {
      whereClause.mechanicId = userId;
    } else if (role === 'customer') {
      whereClause.customerId = userId;
    }

    const trackers = await prisma.tracker.findMany({
      where: whereClause,
      include: {
        repair: {
          include: {
            vehicle: true
          }
        }
      },
      orderBy: { timestamp: 'desc' }
    });

    res.json(trackers);
  } catch (err) {
    handleRouteError(err, 'GET /trackers/history', res);
  }
});

// Create new tracker (customers create roadside assistance requests here)
router.post('/', authenticate, async (req, res) => {
  try {
    const { id, customerId, customerLocation, status, mechanicId, mechanicLocation } = req.body;
    let { repairId } = req.body;

    if (!customerLocation || !Array.isArray(customerLocation) || customerLocation.length < 2) {
      return res.status(400).json({ error: 'customerLocation [lat, lng] is required' });
    }

    const userRole = req.user.role.toLowerCase();
    if (!['customer', 'coder', 'receptionist', 'admin'].includes(userRole)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // ── Resolve garageId ─────────────────────────────────────────────────────
    // Customers are in the Customer model and may not have garageId in their JWT
    let garageId = req.user.garageId || null;

    if (!garageId && userRole === 'customer') {
      const customerRecord = await prisma.customer.findFirst({
        where: { id: req.user.id }
      });
      garageId = customerRecord?.garageId || null;
    }

    if (!garageId && repairId) {
      const existingRepair = await prisma.repair.findUnique({ where: { id: repairId } });
      garageId = existingRepair?.garageId || null;
    }

    if (!garageId) {
      // Last resort: find any active garage
      const firstGarage = await prisma.garage.findFirst({ where: { status: 'active' } });
      garageId = firstGarage?.id;
    }

    // ── Auto-create roadside repair if not provided ──────────────────────────
    if (!repairId) {
      // Find a placeholder vehicle or skip – roadside repair won't have vehicleId
      // We use a workaround: find any vehicle belonging to this customer
      let vehicleId = null;
      if (userRole === 'customer') {
        const vehicle = await prisma.vehicle.findFirst({
          where: { garageId }
        });
        vehicleId = vehicle?.id || null;
      }

      if (!vehicleId) {
        // still no vehicle; we must have vehicleId for Repair — find any in garage
        const anyVehicle = await prisma.vehicle.findFirst({ where: { garageId } });
        vehicleId = anyVehicle?.id;
      }

      if (!vehicleId) {
        return res.status(400).json({ error: 'No vehicles found in this garage to create a roadside repair' });
      }

      const newRepair = await prisma.repair.create({
        data: {
          garageId,
          vehicleId,
          description: 'Roadside Assistance Request',
          status: 'pending',
          laborCost: 0,
          partsCost: 0,
          totalAmount: 0
        }
      });
      repairId = newRepair.id;
    } else {
      // Verify the repair exists
      const repair = await prisma.repair.findUnique({ where: { id: repairId } });
      if (!repair) return res.status(400).json({ error: 'Referenced repair not found' });
    }

    const trackerId = id || `tr_${repairId}`;

    const tracker = await prisma.tracker.create({
      data: {
        id: trackerId,
        repairId,
        customerId: customerId || req.user.id,
        garageId,
        customerLat: parseFloat(customerLocation[0]),
        customerLng: parseFloat(customerLocation[1]),
        mechanicLat: mechanicLocation ? parseFloat(mechanicLocation[0]) : null,
        mechanicLng: mechanicLocation ? parseFloat(mechanicLocation[1]) : null,
        status: status || 'pending',
        mechanicId: mechanicId || null
      },
      include: {
        repair: { include: { vehicle: true } }
      }
    });

    // ── Notify all admins/managers in this garage via WebSocket ──────────────
    const broadcastFn = req.app.get('broadcastNewTracker');
    if (broadcastFn) broadcastFn(tracker);

    res.status(201).json(tracker);
  } catch (err) {
    handleRouteError(err, 'POST /trackers', res);
  }
});


// Update tracker status or assigned mechanic
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { status, mechanicId, customerLocation, mechanicLocation } = req.body;
    const trackerId = req.params.id;

    const existing = await prisma.tracker.findUnique({
      where: { id: trackerId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Tracker not found' });
    }

    // Access control:
    const role = req.user.role.toLowerCase();
    const isStaff = ['admin', 'manager', 'coder', 'receptionist'].includes(role);
    if (!isStaff && role !== 'mechanic' && role !== 'customer') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updateData = {};
    if (status !== undefined) updateData.status = status;
    if (mechanicId !== undefined) {
      updateData.mechanicId = mechanicId === '' ? null : mechanicId;
      if (updateData.mechanicId && !existing.mechanicLat) {
        // Set default mechanic starting location
        updateData.mechanicLat = 9.03;
        updateData.mechanicLng = 38.74;
      }
    }
    if (customerLocation && Array.isArray(customerLocation) && customerLocation.length >= 2) {
      updateData.customerLat = parseFloat(customerLocation[0]);
      updateData.customerLng = parseFloat(customerLocation[1]);
    }
    if (mechanicLocation && Array.isArray(mechanicLocation) && mechanicLocation.length >= 2) {
      updateData.mechanicLat = parseFloat(mechanicLocation[0]);
      updateData.mechanicLng = parseFloat(mechanicLocation[1]);
    }

    // Save update in DB
    const updated = await prisma.tracker.update({
      where: { id: trackerId },
      data: updateData,
      include: {
        repair: {
          include: {
            vehicle: true
          }
        }
      }
    });

    // Notify WebSocket room
    const broadcastFn = req.app.get('broadcastTrackerUpdate');
    if (broadcastFn) broadcastFn(updated.id, updated);

    // Sync repair status automatically if tracker is completed/cancelled
    if (status === 'completed' || status === 'cancelled') {
      await prisma.repair.update({
        where: { id: existing.repairId },
        data: { status: status }
      });
    }

    res.json(updated);
  } catch (err) {
    handleRouteError(err, 'PUT /trackers/:id', res);
  }
});

// Delete active tracker
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const trackerId = req.params.id;

    // Verify item
    const tracker = await prisma.tracker.findUnique({
      where: { id: trackerId }
    });

    if (!tracker) {
      return res.status(404).json({ error: 'Tracker not found' });
    }

    // Delete tracker
    await prisma.tracker.delete({
      where: { id: trackerId }
    });

    res.json({ success: true, message: 'Tracker deleted successfully' });
  } catch (err) {
    handleRouteError(err, 'DELETE /trackers/:id', res);
  }
});

module.exports = router;
