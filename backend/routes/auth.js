const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password, role, garageName, address, garageId } = req.body;

    if (!name || !phone || !password) {
      return res.status(400).json({ error: 'Name, phone and password are required' });
    }

    const finalEmail = email ? email.trim() : `user_${phone}@temp.com`;

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: finalEmail }, { phone }] }
    });
    if (existing) {
      return res.status(409).json({ error: 'User with this email or phone already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    let settings = await prisma.platformSettings.findUnique({ where: { id: "singleton" } });
    if (!settings) {
      settings = await prisma.platformSettings.create({
        data: {
          id: "singleton",
          plans: [
            { id: 'monthly', name: '1-Month Plan', price: 1500, duration: 30, status: 'active' },
            { id: '3month', name: '3-Month Plan', price: 4000, duration: 90, status: 'active' },
            { id: '6month', name: '6-Month Plan', price: 7500, duration: 180, status: 'active' },
            { id: 'yearly', name: '1-Year Plan', price: 14000, duration: 365, status: 'active' }
          ],
          paymentMethods: [],
          taxRate: 15.0,
          platformFees: 0.0,
          trialDays: 7,
          garageIdCounter: 0
        }
      });
    }

    const trialDays = settings.trialDays || 7;
    const trialExpiry = new Date();
    trialExpiry.setDate(trialExpiry.getDate() + trialDays);

    let finalGarageId = null;
    let finalGarageName = garageName || '';
    let finalOwnerId = finalEmail;

    if (role === 'admin' || !role) {
      settings = await prisma.platformSettings.update({
        where: { id: "singleton" },
        data: { garageIdCounter: { increment: 1 } }
      });
      const countStr = settings.garageIdCounter.toString().padStart(7, '0');
      const customGarageId = `12-${countStr.slice(0, 4)}-${countStr.slice(4)}`;

      const garage = await prisma.garage.create({
        data: {
          displayId: customGarageId,
          ownerId: finalEmail,
          name: garageName || `${name}'s Garage`,
          address: address || '',
          ownerName: name,
          email: finalEmail,
          phone,
          status: 'active'
        }
      });
      finalGarageId = garage.id;
      finalGarageName = garage.name;
    } else {
      if (!garageId) {
        return res.status(400).json({ error: 'Selected garage is required for standard users' });
      }
      const selectedGarage = await prisma.garage.findUnique({
        where: { id: garageId }
      });
      if (!selectedGarage) {
        return res.status(404).json({ error: 'Selected garage does not exist' });
      }
      if (selectedGarage.status !== 'active') {
        return res.status(400).json({ error: 'Selected garage is currently inactive' });
      }
      finalGarageId = selectedGarage.id;
      finalGarageName = selectedGarage.name;
      finalOwnerId = selectedGarage.ownerId;
    }

    const user = await prisma.$transaction(async (tx) => {
      // 1. Create User
      const u = await tx.user.create({
        data: {
          ownerId: finalOwnerId,
          name,
          email: finalEmail,
          phone,
          password: hashedPassword,
          role: role || 'admin',
          garageName: finalGarageName,
          address: address || '',
          expiryDate: trialExpiry,
          garageId: finalGarageId,
          permissions: role === 'admin' ? ['all'] : (role === 'customer' ? ['my_data_view'] : [])
        },
        include: {
          garage: {
            select: { displayId: true }
          }
        }
      });

      // 2. Create Customer if role is customer
      if (role === 'customer') {
        await tx.customer.create({
          data: {
            id: u.id,
            garageId: finalGarageId,
            name,
            phone,
            email: finalEmail,
            address: address || ''
          }
        });
      }

      return u;
    });

    const token = jwt.sign(
      { id: user.id, role: user.role, garageId: user.garageId },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const { password: _, ...userWithoutPassword } = user;
    res.status(201).json({ user: userWithoutPassword, token });

  } catch (err) {
    console.error('[Auth/Register]', err);
    res.status(500).json({ error: 'Registration failed', message: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { emailOrPhone, password } = req.body;
    if (!emailOrPhone || !password) {
      return res.status(400).json({ error: 'Email/Phone and password are required' });
    }

    // ── Super Admin (Coder) Bypass ─────────────────────────────────────────────
    // The devroot account lives only in localStorage, not in PostgreSQL.
    // We match the exact credentials expected by the frontend.
    const CODER_PHONE = '251987360873';
    const CODER_PASSWORD = '987360873';
    const CODER_EMAIL = 'coder@garage.com';
    const isCoderAttempt =
      (emailOrPhone === CODER_PHONE || emailOrPhone === '987360873' || emailOrPhone === CODER_EMAIL) &&
      password === CODER_PASSWORD;

    if (isCoderAttempt) {
      const coderUser = {
        id: 'devroot',
        ownerId: 'system',
        name: 'System Developer',
        email: CODER_EMAIL,
        phone: CODER_PHONE,
        role: 'coder',
        garageName: 'MECHPRO CORE SYSTEM',
        status: 'active',
        permissions: ['all'],
        garageId: null,
        expiryDate: null,
        createdAt: new Date().toISOString()
      };
      const token = jwt.sign(
        { id: coderUser.id, role: coderUser.role, garageId: null },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      return res.json({ user: coderUser, token });
    }
    // ──────────────────────────────────────────────────────────────────────────

    const user = await prisma.user.findFirst({
      where: { OR: [{ email: emailOrPhone }, { phone: emailOrPhone }] },
      include: {
        garage: {
          select: { displayId: true }
        }
      }
    });

    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Account suspended', user: { ...user, password: undefined } });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, garageId: user.garageId },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const { password: _, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword, token });

  } catch (err) {
    console.error('[Auth/Login]', err);
    res.status(500).json({ error: 'Login failed', message: err.message });
  }
});

// GET /api/auth/me - Get current user
router.get('/me', require('../middleware/auth').authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true, name: true, email: true, phone: true,
        role: true, status: true, garageName: true,
        address: true, expiryDate: true, garageId: true,
        permissions: true, createdAt: true,
        garage: { select: { displayId: true } }
      }
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get user', message: err.message });
  }
});

// GET /api/auth/garages - Public: list all active garages for registration
router.get('/garages', async (req, res) => {
  try {
    const garages = await prisma.garage.findMany({
      where: { status: 'active' },
      select: {
        id: true,
        displayId: true,
        name: true,
        address: true,
        phone: true,
        email: true,
        ownerName: true,
        logoUrl: true,
        description: true,
        services: true,
        createdAt: true
      },
      orderBy: { createdAt: 'asc' }
    });
    res.json(garages);
  } catch (err) {
    console.error('[Auth/Garages]', err);
    res.status(500).json({ error: 'Failed to fetch garages', message: err.message });
  }
});

module.exports = router;
