const express = require('express');
const { authenticate } = require('../middleware/auth');
const { handleRouteError } = require('../middleware/errorHandler');
const router = express.Router();
const prisma = require('../db');

/**
 * GET /api/users/garage-contacts
 * Returns all active users (staff + customers) for the same garage.
 * Used by the messaging system to populate the contact list cross-device.
 * Safe: returns no passwords, only public profile fields.
 */
router.get('/garage-contacts', authenticate, async (req, res) => {
  try {
    const { garageId } = req.user;

    const users = await prisma.user.findMany({
      where: {
        garageId,
        status: { not: 'deleted' },
        id: { not: req.user.id }
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        address: true,
        garageId: true
      }
    });

    res.json(users);
  } catch (err) {
    handleRouteError(err, 'GET /users/garage-contacts', res);
  }
});

module.exports = router;
