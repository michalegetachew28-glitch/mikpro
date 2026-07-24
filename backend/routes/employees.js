const express = require('express');
const { authenticate } = require('../middleware/auth');
const { handleRouteError } = require('../middleware/errorHandler');
const router = express.Router();
const prisma = require('../db');

// GET /api/employees - Returns Employee records merged with Staff/Users
router.get('/', authenticate, async (req, res) => {
  try {
    const garageId = req.user.garageId;

    // 1. Get all Employee records
    const employees = await prisma.employee.findMany({
      where: { garageId, isDeleted: false },
      include: {
        salaryStructures: { where: { active: true, isDeleted: false }, take: 1 }
      },
      orderBy: { createdAt: 'desc' }
    });

    // 2. Get all Staff/User records that DON'T have a linked Employee record yet
    const linkedUserIds = employees.map(e => e.userId).filter(Boolean);
    const staffUsers = await prisma.user.findMany({
      where: {
        garageId,
        role: { in: ['admin', 'mechanic', 'receptionist', 'cashier', 'storekeeper', 'manager', 'inventoryManager'] },
        NOT: { role: 'customer' },
        id: { notIn: linkedUserIds }
      },
      select: { id: true, name: true, email: true, phone: true, role: true, status: true, createdAt: true }
    });

    // 3. Map Staff/Users into a compatible Employee shape (virtual employees)
    const virtualEmployees = staffUsers.map((u) => ({
      id: `staff_${u.id}`,
      garageId,
      employeeNumber: `STAFF-${u.id.slice(-4).toUpperCase()}`,
      fullName: u.name,
      phone: u.phone,
      email: u.email,
      department: u.role,
      status: u.status || 'active',
      employmentType: 'Full-time',
      hireDate: u.createdAt,
      userId: u.id,
      isVirtual: true,
      salaryStructures: []
    }));

    res.json([...employees, ...virtualEmployees]);
  } catch (err) {
    handleRouteError(err, 'GET /employees', res);
  }
});
router.post('/sync-from-staff', authenticate, async (req, res) => {
  try {
    const garageId = req.user.garageId;

    const staffUsers = await prisma.user.findMany({
      where: {
        garageId,
        role: { in: ['admin', 'mechanic', 'receptionist', 'cashier', 'storekeeper', 'manager', 'inventoryManager'] }
      }
    });

    const existing = await prisma.employee.findMany({
      where: { garageId, userId: { not: null } },
      select: { userId: true }
    });
    const existingUserIds = new Set(existing.map(e => e.userId));

    const toCreate = staffUsers.filter(u => !existingUserIds.has(u.id));
    const count = await prisma.employee.count({ where: { garageId } });

    let created = 0;
    for (let i = 0; i < toCreate.length; i++) {
      const u = toCreate[i];
      const employeeNumber = `EMP-${garageId.slice(-4).toUpperCase()}-${String(count + i + 1).padStart(4, '0')}`;
      await prisma.employee.create({
        data: {
          garageId,
          employeeNumber,
          fullName: u.name,
          phone: u.phone,
          email: u.email,
          department: u.role,
          hireDate: u.createdAt,
          employmentType: 'Full-time',
          userId: u.id
        }
      });
      created++;
    }

    res.json({ success: true, synced: created, message: `${created} staff member(s) synced as employees` });
  } catch (err) {
    handleRouteError(err, 'POST /employees/sync-from-staff', res);
  }
});

// GET /api/employees/me/salary-dashboard
router.get('/me/salary-dashboard', authenticate, async (req, res) => {
  try {
    const employee = await prisma.employee.findFirst({
      where: { userId: req.user.id, garageId: req.user.garageId, isDeleted: false },
      include: {
        salaryStructures: { where: { active: true, isDeleted: false }, take: 1 }
      }
    });

    if (!employee) {
      return res.status(404).json({ error: 'Employee record not found for logged-in user' });
    }

    // Tally metrics
    const baseSalary = employee.salaryStructures[0]?.baseSalary || 0;

    const [totalPaidAggregate, pendingSalaryAggregate, lastPayment, nextPayment, calculationBonusSum, externalBonusSum, totalDeductionsAggregate] = await Promise.all([
      // Total Paid
      prisma.salaryPayment.aggregate({
        where: { employeeId: employee.id, isDeleted: false },
        _sum: { amount: true }
      }),
      // Pending Net Salary (both Pending and Approved calculations waiting to be paid)
      prisma.salaryCalculation.aggregate({
        where: { employeeId: employee.id, status: { in: ['Pending', 'Approved'] }, isDeleted: false },
        _sum: { netSalary: true }
      }),
      // Last Payment details
      prisma.salaryPayment.findFirst({
        where: { employeeId: employee.id, isDeleted: false },
        orderBy: { paymentDate: 'desc' },
        include: { salaryCalculation: { include: { salaryPeriod: true } } }
      }),
      // Next Approved payroll calculation
      prisma.salaryCalculation.findFirst({
        where: { employeeId: employee.id, status: 'Approved', isDeleted: false },
        orderBy: { calculatedAt: 'desc' },
        include: { salaryPeriod: true }
      }),
      // Bonuses from Calculations
      prisma.salaryCalculation.aggregate({
        where: { employeeId: employee.id, isDeleted: false },
        _sum: { bonus: true }
      }),
      // Bonuses from the Bonus table
      prisma.bonus.aggregate({
        where: { userId: req.user.id, status: 'Approved' },
        _sum: { amount: true }
      }),
      // Deductions
      prisma.salaryCalculation.aggregate({
        where: { employeeId: employee.id, isDeleted: false },
        _sum: { totalDeduction: true }
      })
    ]);

    const totalPaid = totalPaidAggregate._sum.amount || 0;
    const pendingSalary = pendingSalaryAggregate._sum.netSalary || 0;
    const totalBonuses = (calculationBonusSum._sum.bonus || 0) + (externalBonusSum._sum.amount || 0);
    const totalDeductions = totalDeductionsAggregate._sum.totalDeduction || 0;

    // Fetch history
    const salaryHistory = await prisma.salaryCalculation.findMany({
      where: { employeeId: employee.id, isDeleted: false },
      include: { salaryPeriod: true },
      orderBy: { calculatedAt: 'desc' }
    });

    const paymentHistory = await prisma.salaryPayment.findMany({
      where: { employeeId: employee.id, isDeleted: false },
      include: { salaryCalculation: { include: { salaryPeriod: true } } },
      orderBy: { paymentDate: 'desc' }
    });

    res.json({
      employee: {
        id: employee.id,
        fullName: employee.fullName,
        employeeNumber: employee.employeeNumber,
        phone: employee.phone,
        email: employee.email,
        department: employee.department,
        bankName: employee.bankName,
        bankAccount: employee.bankAccount,
        mobileBank: employee.mobileBank,
        mobileAccount: employee.mobileAccount,
        accountHolderName: employee.fullName
      },
      baseSalary,
      totalPaid,
      pendingSalary,
      lastPayment: lastPayment ? {
        amount: lastPayment.amount,
        paymentDate: lastPayment.paymentDate,
        paymentMethod: lastPayment.paymentMethod,
        receiptNumber: lastPayment.receiptNumber,
        periodName: lastPayment.salaryCalculation?.salaryPeriod?.periodName
      } : null,
      nextPayment: nextPayment ? {
        id: nextPayment.id,
        netSalary: nextPayment.netSalary,
        periodName: nextPayment.salaryPeriod?.periodName,
        calculatedAt: nextPayment.calculatedAt
      } : null,
      totalBonuses,
      totalDeductions,
      salaryHistory,
      paymentHistory
    });
  } catch (err) {
    handleRouteError(err, 'GET /employees/me/salary-dashboard', res);
  }
});

// PUT /api/employees/me/bank-info
router.put('/me/bank-info', authenticate, async (req, res) => {
  try {
    const { bankName, bankAccount, mobileBank, mobileAccount } = req.body;
    const employee = await prisma.employee.findFirst({
      where: { userId: req.user.id, garageId: req.user.garageId, isDeleted: false }
    });
    if (!employee) {
      return res.status(404).json({ error: 'Employee record not found for logged-in user' });
    }

    const updated = await prisma.employee.update({
      where: { id: employee.id },
      data: {
        bankName: bankName !== undefined ? (bankName || null) : undefined,
        bankAccount: bankAccount !== undefined ? (bankAccount || null) : undefined,
        mobileBank: mobileBank !== undefined ? (mobileBank || null) : undefined,
        mobileAccount: mobileAccount !== undefined ? (mobileAccount || null) : undefined
      }
    });

    // Write to activity log
    await prisma.activityLog.create({
      data: {
        garageId: req.user.garageId,
        userId: req.user.id,
        action: 'UPDATE_OWN_BANK_INFO',
        details: `Updated own bank/mobile payment accounts information.`
      }
    });

    res.json(updated);
  } catch (err) {
    handleRouteError(err, 'PUT /employees/me/bank-info', res);
  }
});

// GET /api/employees/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const employee = await prisma.employee.findFirst({
      where: { id: req.params.id, garageId: req.user.garageId, isDeleted: false },
      include: {
        salaryStructures: { where: { isDeleted: false }, orderBy: { createdAt: 'desc' } },
        attendances: { take: 30, orderBy: { attendanceDate: 'desc' } },
        leaveRequests: { where: { isDeleted: false }, orderBy: { createdAt: 'desc' } }
      }
    });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });
    res.json(employee);
  } catch (err) {
    handleRouteError(err, 'GET /employees/:id', res);
  }
});

// POST /api/employees
router.post('/', authenticate, async (req, res) => {
  try {
    const {
      fullName, phone, email, roleId, department, hireDate,
      employmentType, bankName, bankAccount, mobileBank, mobileAccount, userId
    } = req.body;
    if (!fullName || !phone) return res.status(400).json({ error: 'Full name and phone are required' });

    if (userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user && user.role === 'customer') {
        return res.status(400).json({ error: 'Cannot link an employee record to a customer user' });
      }
    }

    // Auto-generate employee number
    const count = await prisma.employee.count({ where: { garageId: req.user.garageId } });
    const employeeNumber = `EMP-${req.user.garageId.slice(-4).toUpperCase()}-${String(count + 1).padStart(4, '0')}`;

    const employee = await prisma.employee.create({
      data: {
        garageId: req.user.garageId,
        employeeNumber,
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email ? email.trim() : null,
        roleId: roleId || null,
        department: department || null,
        hireDate: hireDate ? new Date(hireDate) : new Date(),
        employmentType: employmentType || 'Full-time',
        bankName: bankName || null,
        bankAccount: bankAccount || null,
        mobileBank: mobileBank || null,
        mobileAccount: mobileAccount || null,
        userId: userId || null
      }
    });
    res.status(201).json(employee);
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'Phone or email already in use' });
    handleRouteError(err, 'POST /employees', res);
  }
});

// PUT /api/employees/:id
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.employee.findFirst({ where: { id, garageId: req.user.garageId, isDeleted: false } });
    if (!existing) return res.status(404).json({ error: 'Employee not found' });

    const {
      fullName, phone, email, roleId, department, hireDate,
      employmentType, status, bankName, bankAccount, mobileBank, mobileAccount
    } = req.body;

    const updated = await prisma.employee.update({
      where: { id },
      data: {
        fullName: fullName ? fullName.trim() : undefined,
        phone: phone ? phone.trim() : undefined,
        email: email !== undefined ? (email.trim() || null) : undefined,
        roleId: roleId !== undefined ? (roleId || null) : undefined,
        department: department !== undefined ? (department || null) : undefined,
        hireDate: hireDate ? new Date(hireDate) : undefined,
        employmentType: employmentType || undefined,
        status: status || undefined,
        bankName: bankName !== undefined ? (bankName || null) : undefined,
        bankAccount: bankAccount !== undefined ? (bankAccount || null) : undefined,
        mobileBank: mobileBank !== undefined ? (mobileBank || null) : undefined,
        mobileAccount: mobileAccount !== undefined ? (mobileAccount || null) : undefined
      }
    });
    res.json(updated);
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'Phone or email already in use' });
    handleRouteError(err, 'PUT /employees/:id', res);
  }
});

// DELETE /api/employees/:id (soft delete)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.employee.findFirst({ where: { id, garageId: req.user.garageId, isDeleted: false } });
    if (!existing) return res.status(404).json({ error: 'Employee not found' });

    await prisma.employee.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date(), status: 'inactive' }
    });
    res.json({ success: true });
  } catch (err) {
    handleRouteError(err, 'DELETE /employees/:id', res);
  }
});

module.exports = router;
