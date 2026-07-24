const express = require('express');
const { authenticate } = require('../middleware/auth');
const router = express.Router();
const prisma = require('../db');
const { handleRouteError } = require('../middleware/errorHandler');

// Helper to log audit activity
async function logAudit(garageId, userId, action, details) {
  try {
    await prisma.activityLog.create({
      data: { garageId, userId, action, details }
    });
  } catch (err) {
    console.error('Audit logging failed:', err);
  }
}

// GET /api/payment-accounts
router.get('/', authenticate, async (req, res) => {
  try {
    const garageId = req.user.garageId;
    if (!garageId) {
      return res.status(400).json({ error: 'No garage associated with this account' });
    }

    const accounts = await prisma.paymentAccount.findMany({
      where: { garageId },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    res.json(accounts);
  } catch (err) {
    handleRouteError(err, 'GET /payment-accounts', res);
  }
});

// POST /api/payment-accounts
router.post('/', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'customer' || req.user.role === 'mechanic') {
      return res.status(403).json({ error: 'Access denied: Insufficient permissions to create accounts' });
    }

    const garageId = req.user.garageId;
    if (!garageId) {
      return res.status(400).json({ error: 'Garage is required' });
    }

    const { type, provider, accountName, accountNumber, branch, qrCode, isDefault } = req.body;
    if (!type || !provider || !accountName || !accountNumber) {
      return res.status(400).json({ error: 'Missing required account details.' });
    }

    const shouldBeDefault = isDefault === true;

    const saved = await prisma.$transaction(async (tx) => {
      // If we are setting this account as default, clear others of the same type
      if (shouldBeDefault) {
        await tx.paymentAccount.updateMany({
          where: { garageId, type, isDefault: true },
          data: { isDefault: false }
        });
      }

      // Check if this is the first payment account of this type. If so, default it
      const count = await tx.paymentAccount.count({
        where: { garageId, type }
      });

      return tx.paymentAccount.create({
        data: {
          garageId,
          type,
          provider,
          accountName,
          accountNumber,
          branch: branch || null,
          qrCode: qrCode || null,
          status: 'active',
          isDefault: count === 0 ? true : shouldBeDefault,
          managerId: req.user.id,
          managerRole: req.user.role
        }
      });
    });

    await logAudit(garageId, req.user.id, 'Create Payment Account', `Created payment account: ${provider} - ${accountNumber} (${type})`);

    res.status(201).json(saved);
  } catch (err) {
    handleRouteError(err, 'POST /payment-accounts', res);
  }
});

// PUT /api/payment-accounts/:id
router.put('/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'customer' || req.user.role === 'mechanic') {
      return res.status(403).json({ error: 'Access denied: Insufficient permissions to modify accounts' });
    }

    const garageId = req.user.garageId;
    const account = await prisma.paymentAccount.findUnique({
      where: { id: req.params.id }
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    if (account.garageId !== garageId) {
      return res.status(403).json({ error: 'Access denied: Garage mismatch' });
    }

    const { provider, accountName, accountNumber, branch, qrCode, status, isDefault } = req.body;
    const shouldBeDefault = isDefault === true;

    const updated = await prisma.$transaction(async (tx) => {
      if (shouldBeDefault && !account.isDefault) {
        await tx.paymentAccount.updateMany({
          where: { garageId, type: account.type, isDefault: true },
          data: { isDefault: false }
        });
      }

      return tx.paymentAccount.update({
        where: { id: req.params.id },
        data: {
          ...(provider && { provider }),
          ...(accountName && { accountName }),
          ...(accountNumber && { accountNumber }),
          ...(branch !== undefined && { branch }),
          ...(qrCode !== undefined && { qrCode }),
          ...(status && { status }),
          ...(isDefault !== undefined && { isDefault: shouldBeDefault })
        }
      });
    });

    await logAudit(garageId, req.user.id, 'Update Payment Account', `Updated payment account ID ${account.id} (${account.type}).`);

    res.json(updated);
  } catch (err) {
    handleRouteError(err, 'PUT /payment-accounts/:id', res);
  }
});

// DELETE /api/payment-accounts/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'coder') {
      return res.status(403).json({ error: 'Access denied: Only Admin can delete payment accounts' });
    }

    const garageId = req.user.garageId;
    const account = await prisma.paymentAccount.findUnique({
      where: { id: req.params.id }
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    if (account.garageId !== garageId) {
      return res.status(403).json({ error: 'Access denied: Garage mismatch' });
    }

    await prisma.paymentAccount.delete({
      where: { id: req.params.id }
    });

    await logAudit(garageId, req.user.id, 'Delete Payment Account', `Deleted payment account: ${account.provider} - ${account.accountNumber}`);

    res.json({ success: true });
  } catch (err) {
    handleRouteError(err, 'DELETE /payment-accounts/:id', res);
  }
});

module.exports = router;
