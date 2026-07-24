const express = require('express');
const { authenticate } = require('../middleware/auth');
const { handleRouteError } = require('../middleware/errorHandler');
const router = express.Router();
const prisma = require('../db');

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

// ── GET /api/salary-payments  (history list) ────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    const { employeeId } = req.query;
    const where = { garageId: req.user.garageId };
    if (employeeId) where.employeeId = employeeId;
    const records = await prisma.salaryPayment.findMany({
      where,
      include: {
        employee: { select: { fullName: true, employeeNumber: true, department: true } },
        salaryCalculation: {
          select: { netSalary: true, status: true, salaryPeriod: { select: { periodName: true } } }
        }
      },
      orderBy: { paymentDate: 'desc' }
    });
    res.json(records);
  } catch (err) { handleRouteError(err, 'GET /salary-payments', res); }
});

// ── GET /api/salary-payments/payable  (enriched employee card list) ──────────
router.get('/payable', authenticate, async (req, res) => {
  try {
    const garageId = req.user.garageId;

    const employees = await prisma.employee.findMany({
      where: { garageId, isDeleted: false },
      include: {
        salaryStructures: { where: { active: true, isDeleted: false }, take: 1 },
        salaryCalculations: {
          where: { isDeleted: false },
          orderBy: { calculatedAt: 'desc' },
          take: 1,
          include: {
            salaryPeriod: { select: { periodName: true, startDate: true, endDate: true, salaryType: true } },
            payments: {
              orderBy: { paymentDate: 'desc' },
              take: 1
            }
          }
        }
      },
      orderBy: { fullName: 'asc' }
    });

    const result = employees.map(e => {
      const latestCalc = e.salaryCalculations[0] || null;
      const latestPayment = latestCalc?.payments?.[0] || null;
      const structureBase = e.salaryStructures[0]?.baseSalary || 0;

      // Determine display status
      let paymentStatus = 'No Calculation';
      let cardStatus = 'idle'; // idle | payable | processing | waiting_approval | paid | rejected
      if (latestCalc) {
        if (latestPayment) {
          if (latestPayment.status === 'Processing') {
            paymentStatus = 'Processing';
            cardStatus = 'processing';
          } else if (latestPayment.status === 'Waiting for Employee Approval') {
            paymentStatus = 'Waiting for Employee Approval';
            cardStatus = 'waiting_approval';
          } else if (latestPayment.status === 'Paid') {
            paymentStatus = 'Paid';
            cardStatus = 'paid';
          } else if (latestPayment.status === 'Rejected') {
            paymentStatus = 'Rejected';
            cardStatus = 'rejected';
          }
        } else if (latestCalc.status === 'Approved') {
          paymentStatus = 'Payable';
          cardStatus = 'payable';
        } else if (latestCalc.status === 'Paid') {
          paymentStatus = 'Paid';
          cardStatus = 'paid';
        } else {
          paymentStatus = latestCalc.status;
          cardStatus = 'idle';
        }
      }

      return {
        id: e.id,
        employeeNumber: e.employeeNumber,
        fullName: e.fullName,
        phone: e.phone,
        email: e.email,
        department: e.department,
        status: e.status,
        bankName: e.bankName || null,
        bankAccount: e.bankAccount || null,
        accountHolderName: e.fullName,
        mobileBank: e.mobileBank || null,
        mobileAccount: e.mobileAccount || null,
        baseSalary: structureBase,
        cardStatus,
        paymentStatus,
        latestCalculation: latestCalc ? {
          id: latestCalc.id,
          netSalary: latestCalc.netSalary,
          grossSalary: latestCalc.grossSalary,
          status: latestCalc.status,
          periodName: latestCalc.salaryPeriod?.periodName,
          periodId: latestCalc.salaryPeriodId,
          calculatedAt: latestCalc.calculatedAt,
          latestPayment: latestPayment ? {
            id: latestPayment.id,
            status: latestPayment.status,
            paymentMethod: latestPayment.paymentMethod,
            paymentDate: latestPayment.paymentDate,
            receiptNumber: latestPayment.receiptNumber,
            amount: latestPayment.amount,
            notes: latestPayment.notes,
            issueReason: latestPayment.issueReason || null
          } : null
        } : null
      };
    });

    res.json(result);
  } catch (err) { handleRouteError(err, 'GET /salary-payments/payable', res); }
});

// ── POST /api/salary-payments  (Admin processes → status: Processing) ────────
router.post('/', authenticate, requireRole('admin', 'coder', 'cashier'), async (req, res) => {
  try {
    const { salaryCalculationId, paymentMethod, paymentReference, amount, notes } = req.body;
    if (!paymentMethod || !amount)
      return res.status(400).json({ error: 'paymentMethod and amount are required' });

    let finalCalculationId = salaryCalculationId;
    let calc;

    if (!finalCalculationId) {
      const { employeeId } = req.body;
      if (!employeeId) {
        return res.status(400).json({ error: 'salaryCalculationId or employeeId required' });
      }

      // Find active period or latest period
      let period = await prisma.salaryPeriod.findFirst({
        where: { garageId: req.user.garageId, isDeleted: false },
        orderBy: { startDate: 'desc' }
      });
      if (!period) {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        const monthName = now.toLocaleString('default', { month: 'long', year: 'numeric' });
        period = await prisma.salaryPeriod.create({
          data: {
            garageId: req.user.garageId,
            periodName: `Payroll ${monthName}`,
            salaryType: 'Monthly',
            startDate: start,
            endDate: end,
            status: 'Open'
          }
        });
      }

      // Check if calculation already exists (e.g. pending or approved)
      calc = await prisma.salaryCalculation.findFirst({
        where: { employeeId, salaryPeriodId: period.id, garageId: req.user.garageId, isDeleted: false }
      });

      if (!calc) {
        // Fetch employee's active structure
        const structure = await prisma.salaryStructure.findFirst({
          where: { employeeId, garageId: req.user.garageId, active: true, isDeleted: false }
        });
        const baseVal = structure ? structure.baseSalary : parseFloat(amount);

        calc = await prisma.salaryCalculation.create({
          data: {
            garageId: req.user.garageId,
            employeeId,
            salaryPeriodId: period.id,
            baseSalary: baseVal,
            workingDays: 22,
            presentDays: 22,
            absentDays: 0,
            halfDays: 0,
            leaveDays: 0,
            overtimeHours: 0,
            lateHours: 0,
            overtimeAmount: 0,
            bonus: 0,
            commission: 0,
            allowances: 0,
            tax: 0,
            pension: 0,
            absenceDeduction: 0,
            lateDeduction: 0,
            otherDeduction: 0,
            grossSalary: baseVal,
            totalDeduction: 0,
            netSalary: parseFloat(amount),
            status: 'Approved'
          }
        });
      } else {
        if (calc.status === 'Pending') {
          calc = await prisma.salaryCalculation.update({
            where: { id: calc.id },
            data: { status: 'Approved' }
          });
        }
      }
      finalCalculationId = calc.id;
    } else {
      calc = await prisma.salaryCalculation.findFirst({
        where: { id: finalCalculationId, garageId: req.user.garageId, isDeleted: false }
      });
      if (!calc) return res.status(404).json({ error: 'Salary calculation not found' });
    }

    if (calc.status === 'Paid') return res.status(400).json({ error: 'Already paid' });
    if (calc.status === 'Pending') return res.status(400).json({ error: 'Salary must be Approved before payment' });

    // Prevent duplicate payment for the same period (only if no rejected payment)
    const existingActive = await prisma.salaryPayment.findFirst({
      where: {
        employeeId: calc.employeeId,
        salaryCalculationId: finalCalculationId,
        isDeleted: false,
        status: { in: ['Processing', 'Waiting for Employee Approval', 'Paid'] }
      }
    });
    if (existingActive) {
      return res.status(400).json({ error: 'An active payment already exists for this salary period' });
    }

    const count = await prisma.salaryPayment.count({ where: { garageId: req.user.garageId } });
    const receiptNumber = `PAY-${Date.now().toString().slice(-6)}-${String(count + 1).padStart(4, '0')}`;

    const payment = await prisma.$transaction(async (tx) => {
      const p = await tx.salaryPayment.create({
        data: {
          garageId: req.user.garageId,
          employeeId: calc.employeeId,
          salaryCalculationId,
          paymentMethod,
          paymentReference: paymentReference || null,
          amount: parseFloat(amount),
          paidBy: req.user.id,
          notes: notes || null,
          receiptNumber,
          status: 'Processing'   // Waits for employee to approve
        }
      });

      await tx.salaryLog.create({
        data: {
          salaryCalculationId,
          oldValue: { status: calc.status },
          newValue: { paymentStatus: 'Processing', receiptNumber },
          updatedBy: req.user.id,
          reason: `Payment initiated by ${req.user.name || req.user.role}`
        }
      });

      await tx.activityLog.create({
        data: {
          garageId: req.user.garageId,
          userId: req.user.id,
          action: 'PROCESS_SALARY_PAYMENT',
          details: `Initiated salary payment of ETB ${amount} via ${paymentMethod} to employee ID ${calc.employeeId} (Receipt: ${receiptNumber}). Status: Processing — awaiting employee confirmation.`
        }
      });

      return p;
    });

    res.status(201).json(payment);
  } catch (err) { handleRouteError(err, 'POST /salary-payments', res); }
});

// ── PATCH /api/salary-payments/:id/approve  (Employee confirms receipt) ──────
router.patch('/:id/approve', authenticate, async (req, res) => {
  try {
    const payment = await prisma.salaryPayment.findFirst({
      where: { id: req.params.id, garageId: req.user.garageId, isDeleted: false },
      include: { salaryCalculation: true }
    });
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    if (payment.status !== 'Processing' && payment.status !== 'Waiting for Employee Approval') {
      return res.status(400).json({ error: 'Only Processing or Waiting for Employee Approval payments can be approved' });
    }

    // Employee can only approve their own payment
    const isEmployee = req.user.role === 'mechanic' || req.user.role === 'manager';
    if (isEmployee) {
      const emp = await prisma.employee.findFirst({ where: { userId: req.user.id, garageId: req.user.garageId } });
      if (!emp || emp.id !== payment.employeeId) {
        return res.status(403).json({ error: 'You can only approve your own salary payment' });
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.salaryPayment.update({
        where: { id: payment.id },
        data: {
          status: 'Paid',
          approvedBy: req.user.id,
          approvedAt: new Date()
        }
      });

      await tx.salaryCalculation.update({
        where: { id: payment.salaryCalculationId },
        data: { status: 'Paid' }
      });

      await tx.salaryLog.create({
        data: {
          salaryCalculationId: payment.salaryCalculationId,
          oldValue: { paymentStatus: 'Processing' },
          newValue: { paymentStatus: 'Paid', approvedBy: req.user.id },
          updatedBy: req.user.id,
          reason: 'Employee approved salary payment receipt'
        }
      });

      await tx.activityLog.create({
        data: {
          garageId: req.user.garageId,
          userId: req.user.id,
          action: 'EMPLOYEE_APPROVE_PAYMENT',
          details: `Employee confirmed receipt of salary payment (Receipt: ${payment.receiptNumber}). Status changed: Processing → Paid.`
        }
      });
    });

    res.json({ success: true, message: 'Payment approved successfully' });
  } catch (err) { handleRouteError(err, 'PATCH /salary-payments/:id/approve', res); }
});

// ── PATCH /api/salary-payments/:id/report-issue  (Employee reports problem) ──
router.patch('/:id/report-issue', authenticate, async (req, res) => {
  try {
    const { reason } = req.body;
    const payment = await prisma.salaryPayment.findFirst({
      where: { id: req.params.id, garageId: req.user.garageId, isDeleted: false },
      include: { salaryCalculation: true }
    });
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    if (payment.status !== 'Processing' && payment.status !== 'Waiting for Employee Approval') {
      return res.status(400).json({ error: 'Only Processing or Waiting for Employee Approval payments can have issues reported' });
    }

    const isEmployee = req.user.role === 'mechanic' || req.user.role === 'manager';
    if (isEmployee) {
      const emp = await prisma.employee.findFirst({ where: { userId: req.user.id, garageId: req.user.garageId } });
      if (!emp || emp.id !== payment.employeeId) {
        return res.status(403).json({ error: 'You can only report issues on your own payment' });
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.salaryPayment.update({
        where: { id: payment.id },
        data: {
          status: 'Rejected',
          issueReason: reason || 'Issue reported by employee'
        }
      });

      await tx.salaryLog.create({
        data: {
          salaryCalculationId: payment.salaryCalculationId,
          oldValue: { paymentStatus: 'Processing' },
          newValue: { paymentStatus: 'Rejected', reason },
          updatedBy: req.user.id,
          reason: `Employee reported issue: ${reason || 'No reason provided'}`
        }
      });

      await tx.activityLog.create({
        data: {
          garageId: req.user.garageId,
          userId: req.user.id,
          action: 'EMPLOYEE_REPORT_PAYMENT_ISSUE',
          details: `Employee reported issue with payment (Receipt: ${payment.receiptNumber}). Reason: ${reason || 'Not specified'}. Status changed: Processing → Rejected.`
        }
      });
    });

    res.json({ success: true, message: 'Issue reported. Admin has been notified.' });
  } catch (err) { handleRouteError(err, 'PATCH /salary-payments/:id/report-issue', res); }
});

// ── GET /api/salary-payments/:id  (single payment details) ───────────────────
router.get('/:id', authenticate, async (req, res) => {
  try {
    const payment = await prisma.salaryPayment.findFirst({
      where: { id: req.params.id, garageId: req.user.garageId },
      include: {
        employee: { select: { fullName: true, employeeNumber: true, department: true, bankName: true, bankAccount: true, mobileBank: true, mobileAccount: true } },
        salaryCalculation: { include: { salaryPeriod: { select: { periodName: true } } } }
      }
    });
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    res.json(payment);
  } catch (err) { handleRouteError(err, 'GET /salary-payments/:id', res); }
});

// ── PATCH /api/salary-payments/:id/transition-status  (Admin transitions Processing → Waiting for Employee Approval) ──
router.patch('/:id/transition-status', authenticate, requireRole('admin', 'coder', 'cashier'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'Status is required' });

    const allowedStatuses = ['Processing', 'Waiting for Employee Approval', 'Paid', 'Rejected'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status: ${status}. Must be one of ${allowedStatuses.join(', ')}` });
    }

    const payment = await prisma.salaryPayment.findFirst({
      where: { id: req.params.id, garageId: req.user.garageId, isDeleted: false },
      include: { salaryCalculation: true }
    });
    if (!payment) return res.status(404).json({ error: 'Payment not found' });

    const updated = await prisma.$transaction(async (tx) => {
      const p = await tx.salaryPayment.update({
        where: { id: payment.id },
        data: { status }
      });

      await tx.salaryLog.create({
        data: {
          salaryCalculationId: payment.salaryCalculationId,
          oldValue: { paymentStatus: payment.status },
          newValue: { paymentStatus: status },
          updatedBy: req.user.id,
          reason: `Payment status transitioned to ${status} by ${req.user.name || req.user.role}`
        }
      });

      await tx.activityLog.create({
        data: {
          garageId: req.user.garageId,
          userId: req.user.id,
          action: 'TRANSITION_SALARY_PAYMENT_STATUS',
          details: `Transitioned salary payment of ETB ${payment.amount} (Receipt: ${payment.receiptNumber}) status from ${payment.status} to ${status}.`
        }
      });

      return p;
    });

    res.json(updated);
  } catch (err) { handleRouteError(err, 'PATCH /salary-payments/:id/transition-status', res); }
});

module.exports = router;
