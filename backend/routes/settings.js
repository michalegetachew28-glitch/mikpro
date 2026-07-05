const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireRole } = require('../middleware/auth');
const router = express.Router();
const prisma = new PrismaClient();

const DEFAULT_SETTINGS = {
  plans: [
    { id: 'monthly', name: '1-Month Plan', price: 1500, duration: 30, status: 'active' },
    { id: '3month', name: '3-Month Plan', price: 4000, duration: 90, status: 'active' },
    { id: '6month', name: '6-Month Plan', price: 7500, duration: 180, status: 'active' },
    { id: 'yearly', name: '1-Year Plan', price: 14000, duration: 365, status: 'active' }
  ],
  paymentMethods: [],
  taxRate: 15.0,
  platformFees: 0.0,
  trialDays: 7
};

// GET /api/settings
router.get('/', async (req, res) => {
  try {
    let settings = await prisma.platformSettings.findUnique({ where: { id: 'singleton' } });
    if (!settings) {
      settings = await prisma.platformSettings.create({
        data: { 
          id: 'singleton', 
          plans: DEFAULT_SETTINGS.plans, 
          paymentMethods: DEFAULT_SETTINGS.paymentMethods,
          taxRate: DEFAULT_SETTINGS.taxRate,
          platformFees: DEFAULT_SETTINGS.platformFees,
          trialDays: DEFAULT_SETTINGS.trialDays
        }
      });
    }
    res.json(settings);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/settings - Super Admin only
router.patch('/', authenticate, requireRole('superadmin', 'coder'), async (req, res) => {
  try {
    const { id, ...data } = req.body;
    const settings = await prisma.platformSettings.upsert({
      where: { id: 'singleton' },
      update: data,
      create: { id: 'singleton', ...DEFAULT_SETTINGS, ...data }
    });
    res.json(settings);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/settings/garage - Get garage profile for authenticated admin
router.get('/garage', authenticate, async (req, res) => {
  try {
    if (!req.user.garageId) return res.status(400).json({ error: 'No garage associated with this account' });
    const garage = await prisma.garage.findUnique({
      where: { id: req.user.garageId },
      select: {
        id: true, name: true, address: true, phone: true, email: true,
        ownerName: true, logoUrl: true, description: true, services: true, status: true
      }
    });
    if (!garage) return res.status(404).json({ error: 'Garage not found' });
    res.json(garage);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/settings/garage - Admin updates their garage profile
router.patch('/garage', authenticate, requireRole('admin', 'coder'), async (req, res) => {
  try {
    if (!req.user.garageId) return res.status(400).json({ error: 'No garage associated with this account' });
    const { name, address, phone, logoUrl, description, services } = req.body;
    const updated = await prisma.garage.update({
      where: { id: req.user.garageId },
      data: {
        ...(name && { name }),
        ...(address !== undefined && { address }),
        ...(phone !== undefined && { phone }),
        ...(logoUrl !== undefined && { logoUrl }),
        ...(description !== undefined && { description }),
        ...(services !== undefined && { services })
      }
    });
    // Also keep User.garageName in sync if name changed
    if (name) {
      await prisma.user.updateMany({
        where: { garageId: req.user.garageId },
        data: { garageName: name }
      });
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
