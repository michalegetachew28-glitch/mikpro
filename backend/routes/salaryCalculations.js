const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { handleRouteError } = require('../middleware/errorHandler');
const router = express.Router();
const prisma = require('../db');

// Helper: calculate payroll for a single employee in a period
async function calculatePayrollForEmployee(garageId, employeeId, periodId, actorId) {
  const [employee, period, structure] = await Promise.all([
    prisma.employee.findFirst({ where: { id: employeeId, garageId, isDeleted: false } }),
    prisma.salaryPeriod.findFirst({ where: { id: periodId, garageId, isDeleted: false } }),
    prisma.salaryStructure.findFirst({ where: { employeeId, garageId, active: true, isDeleted: false } })
  ]);
  if (!employee) throw new Error(`Employee ${employeeId} not found`);
  if (!period) throw new Error('Period not found');
  if (!structure) throw new Error(`No active salary structure for employee ${employee.fullName}`);

  const start = new Date(period.startDate); start.setHours(0, 0, 0, 0);
  const end = new Date(period.endDate); end.setHours(23, 59, 59, 999);

  const attendances = await prisma.attendance.findMany({
    where: { employeeId, garageId, isDeleted: false, attendanceDate: { gte: start, lte: end } }
  });

  // Tally attendance
  let presentDays = 0, absentDays = 0, halfDays = 0, leaveDays = 0, overtimeHours = 0, lateHours = 0, lateOccurrences = 0;
  for (const a of attendances) {
    if (a.status === 'Present') presentDays += 1;
    else if (a.status === 'Absent') absentDays += 1;
    else if (a.status === 'Half Day') { halfDays += 1; presentDays += 0.5; }
    else if (a.status === 'Leave') leaveDays += 1;
    overtimeHours += a.overtimeHours || 0;
    lateHours += (a.lateMinutes || 0) / 60;
    if (a.lateMinutes > 0) {
      lateOccurrences += 1;
    }
  }

  // Working days in the period (Mon-Fri)
  let workingDays = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) workingDays++;
  }

  // Calculations
  const dailyRate = structure.baseSalary / (workingDays || 1);
  const overtimeAmount = 0;
  const absenceDeduction = absentDays * structure.absencePenaltyPerDay;
  const lateDeduction = lateOccurrences * structure.latePenaltyPerOccurrence;
  const allowances = 0;
  const grossSalary = structure.baseSalary;
  const taxAmount = 0;
  const pensionAmount = 0;
  const totalDeduction = taxAmount + pensionAmount + absenceDeduction + lateDeduction;
  const netSalary = Math.max(0, grossSalary - totalDeduction);

  return {
    garageId, employeeId, salaryPeriodId: periodId,
    baseSalary: structure.baseSalary,
    workingDays, presentDays, absentDays, halfDays, leaveDays,
    overtimeHours: 0,
    lateHours: parseFloat(lateHours.toFixed(2)),
    overtimeAmount: 0,
    bonus: 0,
    commission: 0,
    allowances: 0,
    tax: 0,
    pension: 0,
    absenceDeduction: parseFloat(absenceDeduction.toFixed(2)),
    lateDeduction: parseFloat(lateDeduction.toFixed(2)),
    otherDeduction: 0,
    grossSalary: parseFloat(grossSalary.toFixed(2)),
    totalDeduction: parseFloat(totalDeduction.toFixed(2)),
    netSalary: parseFloat(netSalary.toFixed(2)),
    status: 'Pending'
  };
}

// GET /api/salary-calculations?periodId=&employeeId=
router.get('/', authenticate, async (req, res) => {
  try {
    const { periodId, employeeId } = req.query;
    // Allow admin, coder, cashier to list all calculations
    if (!['admin', 'coder', 'cashier'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    const where = { garageId: req.user.garageId, isDeleted: false };
    if (periodId) where.salaryPeriodId = periodId;
    if (employeeId) where.employeeId = employeeId;
    const records = await prisma.salaryCalculation.findMany({
      where,
      include: { employee: { select: { fullName: true, employeeNumber: true, department: true } }, salaryPeriod: true },
      orderBy: { calculatedAt: 'desc' }
    });
    res.json(records);
  } catch (err) {
    handleRouteError(err, 'GET /salary-calculations', res);
  }
});

router.post('/generate', authenticate, async (req, res) => {
  try {
    if (!['admin', 'coder', 'cashier'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    const { periodId } = req.body;
    if (!periodId) return res.status(400).json({ error: 'periodId required' });
    const period = await prisma.salaryPeriod.findFirst({ where: { id: periodId, garageId: req.user.garageId, isDeleted: false } });
    if (!period) return res.status(404).json({ error: 'Period not found' });
    if (period.status === 'Locked' || period.status === 'Paid') return res.status(400).json({ error: 'Cannot regenerate a Locked or Paid period' });

    const employees = await prisma.employee.findMany({ where: { garageId: req.user.garageId, isDeleted: false, status: 'active' } });
    const results = { generated: 0, failed: [] };

    for (const emp of employees) {
      try {
        const data = await calculatePayrollForEmployee(req.user.garageId, emp.id, periodId, req.user.id);
        await prisma.salaryCalculation.upsert({
          where: { employeeId_salaryPeriodId: { employeeId: emp.id, salaryPeriodId: periodId } },
          create: data,
          update: { ...data, calculatedAt: new Date() }
        });
        results.generated++;
      } catch (e) {
        results.failed.push({ employeeId: emp.id, name: emp.fullName, error: e.message });
      }
    }
    
    // Audit logging
    await prisma.activityLog.create({
      data: {
        garageId: req.user.garageId,
        userId: req.user.id,
        action: 'GENERATE_PAYROLL_CALCULATIONS',
        details: `Generated payroll calculations for period ID: ${periodId}`
      }
    });

    res.json(results);
  } catch (err) {
    handleRouteError(err, 'POST /salary-calculations/generate', res);
  }
});

// PATCH /api/salary-calculations/:id/approve
router.patch('/:id/approve', authenticate, requireRole('admin', 'coder'), async (req, res) => {
  try {
    const { id } = req.params;
    const calc = await prisma.salaryCalculation.findFirst({ where: { id, garageId: req.user.garageId, isDeleted: false } });
    if (!calc) return res.status(404).json({ error: 'Calculation not found' });
    if (calc.status === 'Paid') return res.status(400).json({ error: 'Paid payroll cannot be modified' });
    await prisma.salaryLog.create({ data: { salaryCalculationId: id, oldValue: calc, newValue: { status: 'Approved' }, updatedBy: req.user.id, reason: 'Approved by manager/admin' } });
    const updated = await prisma.salaryCalculation.update({ where: { id }, data: { status: 'Approved' } });
    
    // Audit logging
    await prisma.activityLog.create({
      data: {
        garageId: req.user.garageId,
        userId: req.user.id,
        action: 'APPROVE_SALARY_CALCULATION',
        details: `Approved salary calculation (${id}) of net: ${calc.netSalary}`
      }
    });

    res.json(updated);
  } catch (err) {
    handleRouteError(err, 'PATCH /salary-calculations/:id/approve', res);
  }
});

// PATCH /api/salary-calculations/:id/reject
router.patch('/:id/reject', authenticate, requireRole('admin', 'coder'), async (req, res) => {
  try {
    const { id } = req.params;
    const calc = await prisma.salaryCalculation.findFirst({ where: { id, garageId: req.user.garageId, isDeleted: false } });
    if (!calc) return res.status(404).json({ error: 'Calculation not found' });
    if (calc.status === 'Paid') return res.status(400).json({ error: 'Paid payroll cannot be modified' });
    await prisma.salaryLog.create({ data: { salaryCalculationId: id, oldValue: calc, newValue: { status: 'Pending' }, updatedBy: req.user.id, reason: req.body.reason || 'Rejected' } });
    const updated = await prisma.salaryCalculation.update({ where: { id }, data: { status: 'Pending' } });

    // Audit logging
    await prisma.activityLog.create({
      data: {
        garageId: req.user.garageId,
        userId: req.user.id,
        action: 'REJECT_SALARY_CALCULATION',
        details: `Rejected salary calculation (${id})`
      }
    });

    res.json(updated);
  } catch (err) {
    handleRouteError(err, 'PATCH /salary-calculations/:id/reject', res);
  }
});

// GET /api/salary-calculations/:id/slip — salary slip data
router.get('/:id/slip', authenticate, async (req, res) => {
  try {
    const calc = await prisma.salaryCalculation.findFirst({
      where: { id: req.params.id, garageId: req.user.garageId },
      include: { employee: true, salaryPeriod: true, payments: true }
    });
    if (!calc) return res.status(404).json({ error: 'Not found' });
    
    // Check permission: Admin, Coder, Cashier can view all slips.
    // Managers & Mechanics can only view their own slip.
    if (!['admin', 'coder', 'cashier'].includes(req.user.role)) {
      if (calc.employee?.userId !== req.user.id) {
        return res.status(403).json({ error: 'Insufficient permissions to view this slip' });
      }
    }

    res.json(calc);
  } catch (err) {
    handleRouteError(err, 'GET /salary-calculations/:id/slip', res);
  }
});

module.exports = router;
