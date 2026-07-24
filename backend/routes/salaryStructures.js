const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { handleRouteError } = require('../middleware/errorHandler');
const router = express.Router();
const prisma = require('../db');

// GET /api/salary-structures?employeeId=
router.get('/', authenticate, async (req, res) => {
  try {
    const { employeeId } = req.query;
    // Allow admin, coder, cashier to view structures, other block
    if (!['admin', 'coder', 'cashier'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    const where = { garageId: req.user.garageId, isDeleted: false };
    if (employeeId) where.employeeId = employeeId;
    const records = await prisma.salaryStructure.findMany({
      where,
      include: { employee: { select: { fullName: true, employeeNumber: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(records);
  } catch (err) {
    handleRouteError(err, 'GET /salary-structures', res);
  }
});

router.post('/', authenticate, requireRole('admin', 'coder'), async (req, res) => {
  try {
    let { employeeId, salaryType, baseSalary, absencePenaltyPerDay, latePenaltyPerOccurrence, effectiveFrom } = req.body;
    if (!employeeId || baseSalary === undefined) return res.status(400).json({ error: 'employeeId and baseSalary required' });

    // Auto-resolve virtual staff_ IDs → find or create a real Employee record
    if (typeof employeeId === 'string' && employeeId.startsWith('staff_')) {
      const userId = employeeId.replace('staff_', '');
      let emp = await prisma.employee.findFirst({ where: { garageId: req.user.garageId, userId, isDeleted: false } });
      if (!emp) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ error: 'Staff member not found' });
        const count = await prisma.employee.count({ where: { garageId: req.user.garageId } });
        const employeeNumber = `EMP-${req.user.garageId.slice(-4).toUpperCase()}-${String(count + 1).padStart(4, '0')}`;
        emp = await prisma.employee.create({
          data: {
            garageId: req.user.garageId,
            employeeNumber,
            fullName: user.name,
            phone: user.phone,
            email: user.email,
            department: user.role,
            hireDate: user.createdAt,
            employmentType: 'Full-time',
            userId: user.id
          }
        });
      }
      employeeId = emp.id;
    }

    const emp = await prisma.employee.findFirst({ where: { id: employeeId, garageId: req.user.garageId, isDeleted: false } });
    if (!emp) return res.status(404).json({ error: 'Employee not found' });

    // Deactivate existing active structure
    await prisma.salaryStructure.updateMany({ where: { employeeId, garageId: req.user.garageId, active: true, isDeleted: false }, data: { active: false, effectiveTo: new Date() } });

    const record = await prisma.salaryStructure.create({
      data: {
        garageId: req.user.garageId, employeeId, salaryType: salaryType || 'Monthly',
        baseSalary: parseFloat(baseSalary) || 0,
        absencePenaltyPerDay: parseFloat(absencePenaltyPerDay) || 0,
        latePenaltyPerOccurrence: parseFloat(latePenaltyPerOccurrence) || 0,
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
        active: true
      }
    });
    res.status(201).json(record);
  } catch (err) {
    handleRouteError(err, 'POST /salary-structures', res);
  }
});

// PUT /api/salary-structures/:id
router.put('/:id', authenticate, requireRole('admin', 'coder'), async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.salaryStructure.findFirst({ where: { id, garageId: req.user.garageId, isDeleted: false } });
    if (!existing) return res.status(404).json({ error: 'Salary structure not found' });
    const data = {};
    const numFields = ['baseSalary', 'absencePenaltyPerDay', 'latePenaltyPerOccurrence'];
    numFields.forEach(f => { if (req.body[f] !== undefined) data[f] = parseFloat(req.body[f]) || 0; });
    if (req.body.salaryType) data.salaryType = req.body.salaryType;
    const updated = await prisma.salaryStructure.update({ where: { id }, data });
    res.json(updated);
  } catch (err) {
    handleRouteError(err, 'PUT /salary-structures/:id', res);
  }
});

// DELETE /api/salary-structures/:id
router.delete('/:id', authenticate, requireRole('admin', 'coder'), async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.salaryStructure.findFirst({ where: { id, garageId: req.user.garageId, isDeleted: false } });
    if (!existing) return res.status(404).json({ error: 'Salary structure not found' });
    await prisma.salaryStructure.update({
      where: { id },
      data: { isDeleted: true, active: false, deletedAt: new Date() }
    });
    res.json({ success: true, message: 'Salary structure soft-deleted' });
  } catch (err) {
    handleRouteError(err, 'DELETE /salary-structures/:id', res);
  }
});

module.exports = router;
