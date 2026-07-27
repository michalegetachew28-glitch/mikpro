const express = require('express');
const { authenticate } = require('../middleware/auth');
const { handleRouteError } = require('../middleware/errorHandler');
const router = express.Router();
const prisma = require('../db');

router.get('/', authenticate, async (req, res) => {
  try {
    const items = await prisma.inventory.findMany({ where: { garageId: req.user.garageId } });
    const mapped = items.map(item => ({
      ...item,
      name: item.partName || item.name || '',
      threshold: item.minStock !== undefined ? item.minStock : 5
    }));
    res.json(mapped);
  } catch (err) { handleRouteError(err, 'GET /inventory', res); }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { partName, name, quantity, price, minStock, threshold, category, managerId, image } = req.body;
    const item = await prisma.inventory.create({
      data: {
        garageId: req.user.garageId,
        partName: partName || name || 'Unnamed Part',
        quantity: parseInt(quantity || 0, 10),
        price: parseFloat(price || 0),
        minStock: parseInt(minStock !== undefined ? minStock : (threshold || 5), 10),
        category: category || '',
        managerId: (managerId && managerId.trim()) ? managerId.trim() : (req.user.role === 'inventoryManager' || req.user.role === 'storekeeper' ? req.user.id : null),
        image: image || null
      }
    });

    res.status(201).json({
      ...item,
      name: item.partName,
      threshold: item.minStock
    });
  } catch (err) { handleRouteError(err, 'POST /inventory', res); }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const { partName, name, quantity, price, minStock, threshold, category, managerId, image } = req.body;
    const updateData = {};
    if (partName || name) updateData.partName = partName || name;
    if (quantity !== undefined) updateData.quantity = parseInt(quantity, 10);
    if (price !== undefined) updateData.price = parseFloat(price);
    if (minStock !== undefined || threshold !== undefined) updateData.minStock = parseInt(minStock !== undefined ? minStock : threshold, 10);
    if (category !== undefined) updateData.category = category;
    if (managerId !== undefined) updateData.managerId = managerId;
    if (image !== undefined) updateData.image = image;

    const item = await prisma.inventory.update({
      where: { id: req.params.id },
      data: updateData
    });

    res.json({
      ...item,
      name: item.partName,
      threshold: item.minStock
    });
  } catch (err) { handleRouteError(err, 'PUT /inventory/:id', res); }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    await prisma.inventory.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { handleRouteError(err, 'DELETE /inventory/:id', res); }
});

module.exports = router;
