const express = require('express');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const router = express.Router();
const prisma = new PrismaClient();

// GET /api/customers - Get all customers for the garage
router.get('/', authenticate, async (req, res) => {
  try {
    const customers = await prisma.customer.findMany({
      where: { garageId: req.user.garageId },
      include: { vehicles: true }
    });
    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/customers - Create both User (credentials) and Customer records
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, phone, email, address, password } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: 'Name and phone are required' });
    }

    // Standardize phone format if needed, but phone should be passed normalized from UI
    const finalPhone = phone.trim();
    const finalEmail = (email && email.trim() !== '') ? email.trim() : `${finalPhone}@mechpro.tmp`;

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { phone: finalPhone },
          { email: finalEmail }
        ]
      }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'A user with this email or phone number already exists' });
    }

    // Hash password (use default or admin provided)
    const passToHash = password || 'cust123'; // Fallback just in case
    const hashedPassword = await bcrypt.hash(passToHash, 10);

    // Create both records in a transaction to guarantee atomicity and ID alignment
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create User
      const user = await tx.user.create({
        data: {
          ownerId: req.user.ownerId || req.user.id,
          name: name.trim(),
          email: finalEmail,
          phone: finalPhone,
          password: hashedPassword,
          role: 'customer',
          garageName: req.user.garageName || null,
          address: address ? address.trim() : null,
          status: 'active',
          permissions: ['my_data_view'],
          garageId: req.user.garageId
        }
      });

      // 2. Create Customer with the EXACT same ID as the User
      const customer = await tx.customer.create({
        data: {
          id: user.id, // Align IDs!
          garageId: req.user.garageId,
          name: name.trim(),
          phone: finalPhone,
          email: (email && email.trim() !== '') ? email.trim() : null,
          address: address ? address.trim() : null
        },
        include: {
          vehicles: true
        }
      });

      return customer;
    });

    res.status(201).json(result);
  } catch (err) {
    console.error('[Customer Create Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/customers/:id - Update Customer and User credentials
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, address, password } = req.body;

    const existingCustomer = await prisma.customer.findUnique({ where: { id } });
    if (!existingCustomer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Ensure customer belongs to context garage
    if (existingCustomer.garageId !== req.user.garageId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const finalPhone = phone ? phone.trim() : undefined;
    const finalEmail = (email && email.trim() !== '') ? email.trim() : (finalPhone ? `${finalPhone}@mechpro.tmp` : undefined);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Update Customer
      const updatedCustomer = await tx.customer.update({
        where: { id },
        data: {
          name: name ? name.trim() : undefined,
          phone: finalPhone,
          email: (email && email.trim() !== '') ? email.trim() : (email === '' ? null : undefined),
          address: address ? address.trim() : (address === '' ? null : undefined)
        },
        include: {
          vehicles: true
        }
      });

      // 2. Prepare user updates
      const userUpdates = {
        name: name ? name.trim() : undefined,
        phone: finalPhone,
        email: finalEmail,
        address: address ? address.trim() : (address === '' ? null : undefined)
      };

      if (password && password.trim() !== '') {
        userUpdates.password = await bcrypt.hash(password, 10);
      }

      // 3. Update User (if exists)
      const userExists = await tx.user.findUnique({ where: { id } });
      if (userExists) {
        await tx.user.update({
          where: { id },
          data: userUpdates
        });
      }

      return updatedCustomer;
    });

    res.json(result);
  } catch (err) {
    console.error('[Customer Update Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/customers/:id - Delete Customer and User files
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const existingCustomer = await prisma.customer.findUnique({ where: { id } });
    if (!existingCustomer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Ensure customer belongs to context garage
    if (existingCustomer.garageId !== req.user.garageId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await prisma.$transaction(async (tx) => {
      // Clean up appointments referencing customer
      await tx.appointment.deleteMany({ where: { customerId: id } });

      // Clean up vehicles referencing customer
      await tx.vehicle.deleteMany({ where: { customerId: id } });

      // Delete Customer
      await tx.customer.delete({ where: { id } });

      // Delete corresponding User
      const userExists = await tx.user.findUnique({ where: { id } });
      if (userExists) {
        await tx.user.delete({ where: { id } });
      }
    });

    res.json({ success: true });
  } catch (err) {
    console.error('[Customer Delete Error]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

