const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { handleRouteError } = require('../middleware/errorHandler');
const router = express.Router();
const prisma = require('../db');

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
  } catch (err) { handleRouteError(err, 'GET /settings', res); }
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
  } catch (err) { handleRouteError(err, 'PATCH /settings', res); }
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
    handleRouteError(err, 'GET /settings/garage', res);
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
    if (name) {
      await prisma.user.updateMany({
        where: { garageId: req.user.garageId },
        data: { garageName: name }
      });
    }
    res.json(updated);
  } catch (err) {
    handleRouteError(err, 'PATCH /settings/garage', res);
  }
});

// GET /api/settings/billing - Retrieve per-garage taxRate & currency settings
router.get('/billing', authenticate, async (req, res) => {
  try {
    const garageId = req.user.garageId;
    if (!garageId) return res.status(400).json({ error: 'No garage associated with account' });

    let settings = await prisma.garageBillingSettings.findUnique({
      where: { garageId }
    });

    if (!settings) {
      settings = await prisma.garageBillingSettings.create({
        data: {
          garageId,
          taxRate: 15.0,
          currency: 'ETB'
        }
      });
    }

    res.json({
      taxRate: settings.taxRate,
      currency: settings.currency
    });
  } catch (err) {
    handleRouteError(err, 'GET /settings/billing', res);
  }
});

// PATCH /api/settings/billing - Update per-garage taxRate & currency settings
router.patch('/billing', authenticate, requireRole('admin', 'coder'), async (req, res) => {
  try {
    const garageId = req.user.garageId;
    if (!garageId) return res.status(400).json({ error: 'No garage associated with account' });

    const { taxRate, currency } = req.body;
    const finalCurrency = currency || 'ETB';

    const settings = await prisma.garageBillingSettings.upsert({
      where: { garageId },
      update: {
        ...(taxRate !== undefined && { taxRate: parseFloat(taxRate) }),
        currency: finalCurrency
      },
      create: {
        garageId,
        taxRate: taxRate !== undefined ? parseFloat(taxRate) : 15.0,
        currency: finalCurrency
      }
    });

    res.json({
      taxRate: settings.taxRate,
      currency: settings.currency
    });
  } catch (err) {
    handleRouteError(err, 'PATCH /settings/billing', res);
  }
});

module.exports = router;
