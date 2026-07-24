const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { handleRouteError } = require('../middleware/errorHandler');

const router = express.Router();
const prisma = require('../db');

// GET /api/super-admin/payment-requests - All pending payment requests
router.get('/payment-requests', authenticate, requireRole('superadmin', 'coder'), async (req, res) => {
  try {
    const requests = await prisma.paymentRequest.findMany({
      include: { admin: { select: { name: true, email: true, phone: true, garageName: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(requests);
  } catch (err) {
    handleRouteError(err, 'GET /super-admin/payment-requests', res);
  }
});

// PATCH /api/super-admin/payment-requests/:id/approve
router.patch('/payment-requests/:id/approve', authenticate, requireRole('superadmin', 'coder'), async (req, res) => {
  try {
    const { id } = req.params;
    const payReq = await prisma.paymentRequest.findUnique({ 
      where: { id },
      include: { admin: true }
    });
    if (!payReq) return res.status(404).json({ error: 'Request not found' });

    // Get plan duration from settings
    const settings = await prisma.platformSettings.findUnique({ where: { id: 'singleton' } });
    const plans = settings?.plans || [];
    const plan = plans.find(p => p.id === payReq.planId);
    const durationDays = plan?.duration || 30;

    // Cumulative stacking: add to existing expiry if still active
    const now = new Date();
    const admin = payReq.admin;
    const currentExpiry = admin.expiryDate ? new Date(admin.expiryDate) : now;
    const baseDate = currentExpiry > now ? currentExpiry : now;
    const newExpiry = new Date(baseDate);
    newExpiry.setDate(newExpiry.getDate() + durationDays);

    // Update payment request and user expiry in a transaction
    const [updatedRequest, updatedAdmin] = await prisma.$transaction([
      prisma.paymentRequest.update({
        where: { id },
        data: { status: 'approved', approvedAt: now }
      }),
      prisma.user.update({
        where: { id: payReq.adminId },
        data: { expiryDate: newExpiry, status: 'active' }
      })
    ]);

    res.json({ request: updatedRequest, updatedAdmin });
  } catch (err) {
    handleRouteError(err, 'PATCH /super-admin/payment-requests/:id/approve', res);
  }
});

// PATCH /api/super-admin/payment-requests/:id/reject
router.patch('/payment-requests/:id/reject', authenticate, requireRole('superadmin', 'coder'), async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;

    const updated = await prisma.paymentRequest.update({
      where: { id },
      data: { status: 'rejected', rejectionReason }
    });
    res.json(updated);
  } catch (err) {
    handleRouteError(err, 'PATCH /super-admin/payment-requests/:id/reject', res);
  }
});

// GET /api/super-admin/users - All admin users
router.get('/users', authenticate, requireRole('superadmin', 'coder'), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: { in: ['admin', 'superadmin'] } },
      select: {
        id: true, name: true, email: true, phone: true,
        role: true, status: true, garageName: true,
        expiryDate: true, createdAt: true
      }
    });
    res.json(users);
  } catch (err) {
    handleRouteError(err, 'GET /super-admin/users', res);
  }
});

// PATCH /api/super-admin/users/:id/suspend
router.patch('/users/:id/suspend', authenticate, requireRole('superadmin', 'coder'), async (req, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.update({ where: { id }, data: { status: 'suspended' } });
    const { password: _, ...safe } = user;
    res.json(safe);
  } catch (err) {
    handleRouteError(err, 'PATCH /super-admin/users/:id/suspend', res);
  }
});

// PATCH /api/super-admin/users/:id/reinstate
router.patch('/users/:id/reinstate', authenticate, requireRole('superadmin', 'coder'), async (req, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.update({
      where: { id },
      data: { status: 'active' }
    });
    const { password: _, ...safe } = user;
    res.json(safe);
  } catch (err) {
    handleRouteError(err, 'PATCH /super-admin/users/:id/reinstate', res);
  }
});

// PATCH /api/super-admin/users/:id/grant-unlimited
router.patch('/users/:id/grant-unlimited', authenticate, requireRole('superadmin', 'coder'), async (req, res) => {
  try {
    const { id } = req.params;
    const projectExpiry = new Date('2099-12-31');
    const user = await prisma.user.update({ 
      where: { id }, 
      data: { expiryDate: projectExpiry, status: 'active' } 
    });
    const { password: _, ...safe } = user;
    res.json(safe);
  } catch (err) {
    handleRouteError(err, 'PATCH /super-admin/users/:id/grant-unlimited', res);
  }
});

// PATCH /api/super-admin/users/:id/revoke-unlimited
router.patch('/users/:id/revoke-unlimited', authenticate, requireRole('superadmin', 'coder'), async (req, res) => {
  try {
    const { id } = req.params;
    const newExpiry = new Date();
    newExpiry.setDate(newExpiry.getDate() + 30);
    const user = await prisma.user.update({ 
      where: { id }, 
      data: { expiryDate: newExpiry } 
    });
    const { password: _, ...safe } = user;
    res.json(safe);
  } catch (err) {
    handleRouteError(err, 'PATCH /super-admin/users/:id/revoke-unlimited', res);
  }
});

// GET /api/super-admin/clients - All unique garages
router.get('/clients', authenticate, requireRole('superadmin', 'coder'), async (req, res) => {
  try {
    const garages = await prisma.garage.findMany({
      include: {
        users: {
          select: {
            id: true, name: true, email: true, phone: true,
            role: true, status: true, expiryDate: true, createdAt: true
          }
        },
        _count: {
          select: { users: true, repairs: true, customers: true }
        }
      }
    });
    // Expose users as 'accounts' to match frontend expectations
    const result = garages.map(g => ({
      ...g,
      accounts: g.users || [],
      admin: (g.users || []).find(u => u.role === 'admin')?.name || 'N/A'
    }));
    res.json(result);
  } catch (err) {
    handleRouteError(err, 'GET /super-admin/clients', res);
  }
});

// GET /api/super-admin/platform-stats - Aggregated stats for overview
router.get('/platform-stats', authenticate, requireRole('superadmin', 'coder'), async (req, res) => {
  try {
    const now = new Date();
    const [
      garageCount,
      repairCount,
      customerCount,
      vehicleCount,
      inventoryCount,
      userCount,
      adminUsers,
      allPaymentRequests
    ] = await Promise.all([
      prisma.garage.count(),
      prisma.repair.count(),
      prisma.customer.count(),
      prisma.vehicle.count(),
      prisma.inventory.count(),
      prisma.user.count({ where: { role: { not: 'coder' } } }),
      prisma.user.findMany({
        where: { role: 'admin' },
        select: { id: true, status: true, expiryDate: true, createdAt: true }
      }),
      prisma.paymentRequest.findMany({
        select: { id: true, status: true, amount: true, adminId: true }
      })
    ]);

    // --- Client type counts ---
    const stats = {
      totalClients: garageCount,
      active: 0,
      suspended: 0,
      expired: 0,
      trial: 0,
      unlimited: 0
    };

    const pendingAdminIds = new Set(allPaymentRequests.filter(r => r.status === 'pending').map(r => r.adminId));
    const rejectedAdminIds = new Set(allPaymentRequests.filter(r => r.status === 'rejected').map(r => r.adminId));

    adminUsers.forEach(u => {
      const expiry = u.expiryDate ? new Date(u.expiryDate) : null;

      if (expiry && expiry.getFullYear() > 2090) {
        stats.unlimited++;
        stats.active++;
      } else if (u.status === 'suspended' || (expiry && expiry < now)) {
        stats.suspended++;
        stats.expired++;
      } else {
        stats.active++;
        if (expiry && u.createdAt) {
          const diffDays = (expiry - new Date(u.createdAt)) / (1000 * 60 * 60 * 24);
          if (diffDays <= 15) stats.trial++;
        } else if (!expiry) {
          stats.trial++;
        }
      }
    });

    // --- Subscription counts ---
    const pendingSubscriptions = allPaymentRequests.filter(r => r.status === 'pending').length;
    const approvedSubscriptions = allPaymentRequests.filter(r => r.status === 'approved').length;

    // --- Revenue ---
    const approvedRevenue = allPaymentRequests
      .filter(r => r.status === 'approved')
      .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const pendingRevenue = allPaymentRequests
      .filter(r => r.status === 'pending')
      .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const totalRevenue = approvedRevenue + pendingRevenue;

    res.json({
      // Core counts
      users: userCount,
      garages: garageCount,
      repairs: repairCount,
      customers: customerCount,
      vehicles: vehicleCount,
      inventory: inventoryCount,
      // Revenue
      totalRevenue,
      approvedRevenue,
      pendingRevenue,
      // Subscription activity
      pendingSubscriptions,
      approvedSubscriptions,
      // Client type breakdown
      subscriptionStats: {
        totalClients: garageCount,
        active: stats.active,
        suspended: stats.suspended,
        expired: stats.expired,
        trial: stats.trial,
        unlimited: stats.unlimited,
        pending: pendingAdminIds.size,
        rejected: rejectedAdminIds.size
      }
    });
  } catch (err) {
    handleRouteError(err, 'GET /super-admin/platform-stats', res);
  }
});


// DELETE /api/super-admin/clients/:garageId — Permanently delete a garage + all related data
router.delete('/clients/:garageId', authenticate, requireRole('superadmin', 'coder'), async (req, res) => {
  const { garageId } = req.params;
  try {
    const garage = await prisma.garage.findUnique({ where: { id: garageId } });
    if (!garage) return res.status(404).json({ error: 'Garage not found' });

    // Cascade delete in FK-safe order inside a transaction
    await prisma.$transaction(async (tx) => {
      // 1. Delete repair parts (depends on Repair)
      const repairs = await tx.repair.findMany({ where: { garageId }, select: { id: true } });
      const repairIds = repairs.map(r => r.id);
      if (repairIds.length > 0) {
        await tx.repairPart.deleteMany({ where: { repairId: { in: repairIds } } });
      }

      // 2. Delete appointments (depends on Vehicle, Customer)
      await tx.appointment.deleteMany({ where: { garageId } });

      // 3. Delete repairs
      await tx.repair.deleteMany({ where: { garageId } });

      // 4. Delete vehicles (depends on Customer)
      await tx.vehicle.deleteMany({ where: { garageId } });

      // 5. Delete customers
      await tx.customer.deleteMany({ where: { garageId } });

      // 6. Delete invoices
      await tx.invoice.deleteMany({ where: { garageId } });

      // 7. Delete inventory
      await tx.inventory.deleteMany({ where: { garageId } });

      // 8. Delete payment requests
      await tx.paymentRequest.deleteMany({ where: { garageId } });

      // 9. Delete material requests + bonuses for users in this garage
      const garageUserIds = (await tx.user.findMany({ where: { garageId }, select: { id: true } })).map(u => u.id);
      if (garageUserIds.length > 0) {
        await tx.materialRequest.deleteMany({ where: { userId: { in: garageUserIds } } });
        await tx.bonus.deleteMany({ where: { userId: { in: garageUserIds } } });
      }

      // 10. Delete staff records
      await tx.staff.deleteMany({ where: { garageId } });

      // 11. Delete activity logs for this garage
      await tx.activityLog.deleteMany({ where: { garageId } });

      // 12. Delete users belonging to this garage
      await tx.user.deleteMany({ where: { garageId } });

      // 13. Finally delete the garage itself
      await tx.garage.delete({ where: { id: garageId } });
    });

    res.json({ success: true, message: `Garage "${garage.name}" and all associated data permanently deleted.` });
  } catch (err) {
    handleRouteError(err, 'DELETE /super-admin/clients/:garageId', res);
  }
});

// DELETE /api/super-admin/platform-purge — Wipe ALL platform data except coder account + platform settings
router.delete('/platform-purge', authenticate, requireRole('superadmin', 'coder'), async (req, res) => {
  try {
    await prisma.$transaction(async (tx) => {
      // 1. Delete all repair parts
      await tx.repairPart.deleteMany({});

      // 2. Delete all appointments
      await tx.appointment.deleteMany({});

      // 3. Delete all repairs
      await tx.repair.deleteMany({});

      // 4. Delete all vehicles
      await tx.vehicle.deleteMany({});

      // 5. Delete all customers
      await tx.customer.deleteMany({});

      // 6. Delete all invoices
      await tx.invoice.deleteMany({});

      // 7. Delete all inventory
      await tx.inventory.deleteMany({});

      // 8. Delete all payment requests
      await tx.paymentRequest.deleteMany({});

      // 9. Delete all material requests + bonuses
      await tx.materialRequest.deleteMany({});
      await tx.bonus.deleteMany({});

      // 10. Delete all staff records
      await tx.staff.deleteMany({});

      // 11. Delete all activity logs
      await tx.activityLog.deleteMany({});

      // 12. Delete all non-coder users
      await tx.user.deleteMany({ where: { role: { not: 'coder' } } });

      // 13. Delete all garages
      await tx.garage.deleteMany({});
    });

    res.json({ success: true, message: 'Platform purged. All client data has been permanently deleted. Coder account and platform settings preserved.' });
  } catch (err) {
    handleRouteError(err, 'DELETE /super-admin/platform-purge', res);
  }
});

module.exports = router;
