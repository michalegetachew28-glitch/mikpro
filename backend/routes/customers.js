const express = require('express');
const bcrypt = require('bcryptjs');
const { authenticate } = require('../middleware/auth');
const { handleRouteError } = require('../middleware/errorHandler');

const router = express.Router();
const prisma = require('../db');

// ─── Helper ──────────────────────────────────────────────────────────────────

/**
 * Always resolve garageId from the DB — never trust a stale JWT.
 */
async function resolveGarageId(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { garageId: true, ownerId: true, garageName: true }
  });
  return user || null;
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// GET /api/customers
router.get('/', authenticate, async (req, res) => {
  try {
    const userInfo = await resolveGarageId(req.user.id);
    if (!userInfo?.garageId) {
      return res.status(400).json({ error: 'No garage linked to your account. Please log out and log back in.' });
    }

    const customers = await prisma.customer.findMany({
      where: { garageId: userInfo.garageId },
      include: { vehicles: true }
    });
    res.json(customers);
  } catch (err) {
    handleRouteError(err, 'GET /customers', res);
  }
});

// POST /api/customers
router.post('/', authenticate, async (req, res) => {
  console.log(`[POST /customers] User: ${req.user.id} | role: ${req.user.role}`);
  try {
    const { name, phone, email, address, password } = req.body;

    // 1. Validate required fields
    if (!name || !name.trim()) return res.status(400).json({ error: 'Customer name is required.' });
    if (!phone || !phone.trim()) return res.status(400).json({ error: 'Customer phone is required.' });

    // 2. Resolve garageId from DB
    const userInfo = await resolveGarageId(req.user.id);
    console.log(`[POST /customers] Resolved garageId: ${userInfo?.garageId}`);

    if (!userInfo?.garageId) {
      return res.status(400).json({
        error: 'Your account has no linked garage. Please log out and log back in to refresh your session.'
      });
    }

    // 3. Verify garage exists
    const garage = await prisma.garage.findUnique({ where: { id: userInfo.garageId } });
    if (!garage) {
      return res.status(400).json({ error: `Garage (${userInfo.garageId}) not found. Contact support.` });
    }

    const finalPhone = phone.trim();
    const finalEmail = (email && email.trim()) ? email.trim() : `${finalPhone}@mechpro.tmp`;

    // 4. Check for duplicate phone/email ONLY — not name
    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ phone: finalPhone }, { email: finalEmail }] }
    });

    if (existingUser) {
      // Check if it's just a temp email collision (same phone, different garage)
      if (existingUser.phone === finalPhone) {
        return res.status(400).json({ error: `Phone number ${finalPhone} is already registered.` });
      }
      if (email && email.trim() && existingUser.email === finalEmail) {
        return res.status(400).json({ error: `Email ${finalEmail} is already registered.` });
      }
    }

    // 5. Hash password
    const hashedPassword = await bcrypt.hash(password || 'cust123', 10);

    // 6. Create User + Customer in a single atomic transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create User record
      const user = await tx.user.create({
        data: {
          ownerId:     userInfo.ownerId || req.user.id,
          name:        name.trim(),
          email:       finalEmail,
          phone:       finalPhone,
          password:    hashedPassword,
          role:        'customer',
          garageName:  garage.name,
          address:     address ? address.trim() : null,
          status:      'active',
          permissions: ['my_data_view'],
          garageId:    userInfo.garageId
        }
      });

      // Create Customer record with same ID as User
      const customer = await tx.customer.create({
        data: {
          id:       user.id,
          garageId: userInfo.garageId,
          name:     name.trim(),
          phone:    finalPhone,
          email:    (email && email.trim()) ? email.trim() : null,
          address:  address ? address.trim() : null
        },
        include: { vehicles: true }
      });

      return customer;
    });

    console.log(`[POST /customers] Created customer: ${result.id} in garage: ${userInfo.garageId}`);
    res.status(201).json(result);

  } catch (err) {
    if (err.code === 'P2002') {
      const field = err.meta?.target?.join(', ') || 'phone or email';
      return res.status(400).json({ error: `A customer with this ${field} already exists.` });
    }
    if (err.code === 'P2003') {
      return res.status(400).json({
        error: 'Database relationship error. Ensure the garage exists and try again.'
      });
    }
    handleRouteError(err, 'POST /customers', res);
  }
});

// PUT /api/customers/:id
router.put('/:id', authenticate, async (req, res) => {
  console.log(`[PUT /customers/${req.params.id}] User: ${req.user.id}`);
  try {
    const { id } = req.params;
    const { name, phone, email, address, password } = req.body;

    const userInfo = await resolveGarageId(req.user.id);
    if (!userInfo?.garageId) return res.status(400).json({ error: 'No garage linked. Please log back in.' });

    const existingCustomer = await prisma.customer.findUnique({ where: { id } });
    if (!existingCustomer) return res.status(404).json({ error: 'Customer not found.' });
    if (existingCustomer.garageId !== userInfo.garageId) return res.status(403).json({ error: 'Unauthorized.' });

    const finalPhone = phone ? phone.trim() : undefined;
    const finalEmail = (email && email.trim()) ? email.trim() : (finalPhone ? `${finalPhone}@mechpro.tmp` : undefined);

    const result = await prisma.$transaction(async (tx) => {
      const updatedCustomer = await tx.customer.update({
        where: { id },
        data: {
          name:    name ? name.trim() : undefined,
          phone:   finalPhone,
          email:   (email && email.trim()) ? email.trim() : (email === '' ? null : undefined),
          address: address ? address.trim() : (address === '' ? null : undefined)
        },
        include: { vehicles: true }
      });

      const userUpdates = {
        name:    name ? name.trim() : undefined,
        phone:   finalPhone,
        email:   finalEmail,
        address: address ? address.trim() : (address === '' ? null : undefined)
      };

      if (password && password.trim()) {
        userUpdates.password = await bcrypt.hash(password, 10);
      }

      const userExists = await tx.user.findUnique({ where: { id } });
      if (userExists) {
        await tx.user.update({ where: { id }, data: userUpdates });
      }

      return updatedCustomer;
    });

    res.json(result);
  } catch (err) {
    if (err.code === 'P2002') {
      const field = err.meta?.target?.join(', ') || 'phone or email';
      return res.status(400).json({ error: `A customer with this ${field} already exists.` });
    }
    handleRouteError(err, 'PUT /customers/:id', res);
  }
});

// DELETE /api/customers/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const userInfo = await resolveGarageId(req.user.id);
    if (!userInfo?.garageId) return res.status(400).json({ error: 'No garage linked. Please log back in.' });

    const existingCustomer = await prisma.customer.findUnique({ where: { id } });
    if (!existingCustomer) return res.status(404).json({ error: 'Customer not found.' });
    if (existingCustomer.garageId !== userInfo.garageId) return res.status(403).json({ error: 'Unauthorized.' });

    await prisma.$transaction(async (tx) => {
      await tx.appointment.deleteMany({ where: { customerId: id } });
      await tx.vehicle.deleteMany({ where: { customerId: id } });
      await tx.customer.delete({ where: { id } });

      const userExists = await tx.user.findUnique({ where: { id } });
      if (userExists) await tx.user.delete({ where: { id } });
    });

    res.json({ success: true });
  } catch (err) {
    handleRouteError(err, 'DELETE /customers/:id', res);
  }
});

module.exports = router;
