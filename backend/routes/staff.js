const express = require('express');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const router = express.Router();
const prisma = new PrismaClient();

// Role-based default permissions
const ROLE_DEFAULTS = {
  admin:            ['all'],
  manager:          ['repairs_view', 'repairs_manage', 'customers_manage', 'vehicles_manage', 'appointments_manage', 'billing_manage', 'inventory_manage', 'staff_manage', 'activity_view'],
  cashier:          ['repairs_view', 'billing_manage', 'customers_manage', 'appointments_manage'],
  mechanic:         ['repairs_view'],
  receptionist:     ['repairs_view', 'customers_manage', 'vehicles_manage', 'appointments_manage'],
  storekeeper:      ['inventory_manage'],
  inventoryManager: ['inventory_manage', 'repairs_view'],
  customer:         ['my_data_view']
};

// GET /api/staff - Get all staff for the garage
router.get('/', authenticate, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: {
        garageId: req.user.garageId,
        id: { not: req.user.id }, // Exclude themselves
        role: { in: ['admin', 'mechanic', 'receptionist', 'cashier', 'storekeeper', 'manager', 'inventoryManager'] }
      },
      select: {
        id: true, name: true, email: true, phone: true, role: true,
        status: true, address: true, permissions: true, createdAt: true, garageId: true
      }
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/staff - Create a new staff User account linked to this garage
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, phone, email, role, address, password } = req.body;

    if (!name || !phone || !password) {
      return res.status(400).json({ error: 'Name, phone, and password are required' });
    }

    const finalPhone = phone.trim();
    const finalEmail = (email && email.trim() !== '') ? email.trim() : `${finalPhone}@mechpro.staff`;

    // Check for existing user
    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ phone: finalPhone }, { email: finalEmail }] }
    });
    if (existingUser) {
      return res.status(400).json({ error: 'A user with this phone or email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const staffRole = role || 'mechanic';
    const permissions = ROLE_DEFAULTS[staffRole] || [];

    // Get garage info for ownerId linkage
    const garage = await prisma.garage.findUnique({ where: { id: req.user.garageId } });

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create User
      const user = await tx.user.create({
        data: {
          ownerId: garage?.ownerId || req.user.ownerId || req.user.id,
          name: name.trim(),
          email: finalEmail,
          phone: finalPhone,
          password: hashedPassword,
          role: staffRole,
          garageName: garage?.name || null,
          address: address ? address.trim() : null,
          status: 'active',
          permissions,
          garageId: req.user.garageId
        }
      });

      // 2. Create Staff record
      const staff = await tx.staff.create({
        data: {
          userId: user.id,
          garageId: req.user.garageId,
          name: name.trim(),
          role: staffRole,
          phone: finalPhone,
          status: 'active'
        }
      });

      return { ...user, password: undefined, staffId: staff.id };
    });

    res.status(201).json(result);
  } catch (err) {
    console.error('[Staff Create Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/staff/:id - Update staff User and Staff record
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, role, address, password, status, permissions } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) return res.status(404).json({ error: 'Staff member not found' });
    if (existingUser.garageId !== req.user.garageId) return res.status(403).json({ error: 'Unauthorized' });

    const finalPhone = phone ? phone.trim() : undefined;
    const finalEmail = (email && email.trim() !== '') ? email.trim() : undefined;

    const result = await prisma.$transaction(async (tx) => {
      const userUpdates = {
        name: name ? name.trim() : undefined,
        phone: finalPhone,
        email: finalEmail,
        role: role || undefined,
        address: address ? address.trim() : (address === '' ? null : undefined),
        status: status || undefined,
        permissions: permissions || undefined
      };

      if (password && password.trim() !== '') {
        userUpdates.password = await bcrypt.hash(password, 10);
      }

      const updatedUser = await tx.user.update({
        where: { id },
        data: userUpdates,
        select: {
          id: true, name: true, email: true, phone: true, role: true,
          status: true, address: true, permissions: true, garageId: true
        }
      });

      // Also update the Staff record if it exists
      const staffRecord = await tx.staff.findUnique({ where: { userId: id } });
      if (staffRecord) {
        await tx.staff.update({
          where: { userId: id },
          data: {
            name: name ? name.trim() : undefined,
            role: role || undefined,
            phone: finalPhone,
            status: status || undefined
          }
        });
      }

      return updatedUser;
    });

    res.json(result);
  } catch (err) {
    console.error('[Staff Update Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/staff/:id - Delete staff User and Staff record
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) return res.status(404).json({ error: 'Staff member not found' });
    if (existingUser.garageId !== req.user.garageId) return res.status(403).json({ error: 'Unauthorized' });
    if (id === req.user.id) return res.status(400).json({ error: 'You cannot delete yourself' });

    await prisma.$transaction(async (tx) => {
      // Remove dependencies first
      await tx.bonus.deleteMany({ where: { userId: id } });
      await tx.materialRequest.deleteMany({ where: { userId: id } });
      // Unassign from repairs
      await tx.repair.updateMany({ where: { mechanicId: id }, data: { mechanicId: null } });

      // Delete Staff record if it exists
      const staffRecord = await tx.staff.findUnique({ where: { userId: id } });
      if (staffRecord) {
        await tx.staff.delete({ where: { userId: id } });
      }

      // Finally delete User
      await tx.user.delete({ where: { id } });
    });

    res.json({ success: true });
  } catch (err) {
    console.error('[Staff Delete Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/staff/:id/status - Toggle active/inactive status
router.patch('/:id/status', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const updated = await prisma.user.update({
      where: { id },
      data: { status },
      select: { id: true, status: true }
    });

    // Update staff record too
    const staffRecord = await prisma.staff.findUnique({ where: { userId: id } });
    if (staffRecord) {
      await prisma.staff.update({ where: { userId: id }, data: { status } });
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/staff/:id/permissions - Update permissions
router.patch('/:id/permissions', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { permissions } = req.body;

    const updated = await prisma.user.update({
      where: { id },
      data: { permissions },
      select: { id: true, permissions: true }
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

