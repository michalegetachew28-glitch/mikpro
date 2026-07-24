const express = require('express');
const { authenticate } = require('../middleware/auth');
const { handleRouteError } = require('../middleware/errorHandler');
const router = express.Router();
const prisma = require('../db');

// GET /api/payroll-analytics/dashboard
router.get('/dashboard', authenticate, async (req, res) => {
  try {
    const garageId = req.user.garageId;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [
      totalEmployees,
      totalPaidAggregate,
      pendingSalaryAggregate,
      approvedPayroll,
      paidPayrollCount,
      monthlyPayrollCostAggregate,
      calculationBonusSum,
      externalBonusSum,
      totalDeductionsAggregate,
      approvedUnpaidAggregate
    ] = await Promise.all([
      prisma.employee.count({ where: { garageId, isDeleted: false, status: 'active' } }),
      prisma.salaryPayment.aggregate({ where: { garageId, isDeleted: false }, _sum: { amount: true } }),
      prisma.salaryCalculation.aggregate({ where: { garageId, status: 'Pending', isDeleted: false }, _sum: { netSalary: true } }),
      prisma.salaryCalculation.count({ where: { garageId, status: 'Approved', isDeleted: false } }),
      prisma.salaryCalculation.count({ where: { garageId, status: 'Paid', isDeleted: false } }),
      prisma.salaryPayment.aggregate({ where: { garageId, isDeleted: false, paymentDate: { gte: monthStart, lte: monthEnd } }, _sum: { amount: true } }),
      prisma.salaryCalculation.aggregate({ where: { garageId, isDeleted: false }, _sum: { bonus: true } }),
      prisma.bonus.aggregate({ where: { garageId, status: 'Approved' }, _sum: { amount: true } }),
      prisma.salaryCalculation.aggregate({ where: { garageId, isDeleted: false }, _sum: { totalDeduction: true } }),
      prisma.salaryCalculation.aggregate({ where: { garageId, status: 'Approved', isDeleted: false }, _sum: { netSalary: true } })
    ]);

    res.json({
      totalEmployees,
      totalSalaryPaid: totalPaidAggregate._sum.amount || 0,
      monthlyPayrollCost: monthlyPayrollCostAggregate._sum.amount || 0,
      approvedPayroll,
      paidPayroll: paidPayrollCount,
      pendingSalary: pendingSalaryAggregate._sum.netSalary || 0, // Pending status netSalary
      pendingPayments: approvedUnpaidAggregate._sum.netSalary || 0, // Approved status netSalary waiting for payment
      upcomingPayments: approvedUnpaidAggregate._sum.netSalary || 0, // Same
      totalBonuses: (calculationBonusSum._sum.bonus || 0) + (externalBonusSum._sum.amount || 0),
      totalDeductions: totalDeductionsAggregate._sum.totalDeduction || 0
    });
  } catch (err) {
    handleRouteError(err, 'GET /payroll-analytics/dashboard', res);
  }
});

// GET /api/payroll-analytics/payroll-trend?months=6
router.get('/payroll-trend', authenticate, async (req, res) => {
  try {
    const months = parseInt(req.query.months) || 6;
    const result = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date();
      const start = new Date(d.getFullYear(), d.getMonth() - i, 1);
      const end = new Date(d.getFullYear(), d.getMonth() - i + 1, 0, 23, 59, 59);
      const agg = await prisma.salaryPayment.aggregate({
        where: { garageId: req.user.garageId, paymentDate: { gte: start, lte: end } },
        _sum: { amount: true }
      });
      result.push({ month: start.toLocaleString('en-US', { month: 'short', year: 'numeric' }), total: agg._sum.amount || 0 });
    }
    res.json(result);
  } catch (err) {
    handleRouteError(err, 'GET /payroll-analytics/payroll-trend', res);
  }
});

// GET /api/payroll-analytics/department-costs?periodId=
router.get('/department-costs', authenticate, async (req, res) => {
  try {
    const { periodId } = req.query;
    const calcs = await prisma.salaryCalculation.findMany({
      where: { garageId: req.user.garageId, isDeleted: false, ...(periodId ? { salaryPeriodId: periodId } : {}) },
      include: { employee: { select: { department: true } } }
    });
    const deptMap = {};
    for (const c of calcs) {
      const dept = c.employee.department || 'Unassigned';
      deptMap[dept] = (deptMap[dept] || 0) + c.netSalary;
    }
    res.json(Object.entries(deptMap).map(([department, total]) => ({ department, total: parseFloat(total.toFixed(2)) })));
  } catch (err) {
    handleRouteError(err, 'GET /payroll-analytics/department-costs', res);
  }
});

// GET /api/payroll-analytics/reports — aggregate attendance stats for a period/date range
router.get('/reports', authenticate, async (req, res) => {
  try {
    const { type, startDate, endDate, employeeId, department } = req.query;
    const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate ? new Date(endDate) : new Date();
    const garageId = req.user.garageId;

    const empWhere = { garageId, isDeleted: false };
    if (department) empWhere.department = department;
    if (employeeId) empWhere.id = employeeId;
    const employees = await prisma.employee.findMany({ where: empWhere, select: { id: true, fullName: true, employeeNumber: true, department: true, roleId: true } });
    const empIds = employees.map(e => e.id);

    const attendances = await prisma.attendance.findMany({
      where: { garageId, isDeleted: false, employeeId: { in: empIds }, attendanceDate: { gte: start, lte: end } }
    });

    const report = employees.map(emp => {
      const records = attendances.filter(a => a.employeeId === emp.id);
      return {
        ...emp,
        present: records.filter(a => a.status === 'Present').length,
        absent: records.filter(a => a.status === 'Absent').length,
        halfDay: records.filter(a => a.status === 'Half Day').length,
        leave: records.filter(a => a.status === 'Leave').length,
        late: records.filter(a => a.lateMinutes > 0).length,
        totalOvertimeHours: records.reduce((s, a) => s + (a.overtimeHours || 0), 0).toFixed(2),
        totalLateMinutes: records.reduce((s, a) => s + (a.lateMinutes || 0), 0),
        totalWorkingHours: records.reduce((s, a) => s + (a.workingHours || 0), 0).toFixed(2)
      };
    });
    res.json({ period: { start: start.toISOString(), end: end.toISOString() }, type: type || 'custom', report });
  } catch (err) {
    handleRouteError(err, 'GET /payroll-analytics/reports', res);
  }
});

module.exports = router;
