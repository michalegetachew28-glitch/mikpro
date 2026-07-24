const express = require('express');
const { authenticate } = require('../middleware/auth');
const { handleRouteError } = require('../middleware/errorHandler');
const router = express.Router();
const prisma = require('../db');

const WORK_START_HOUR = 8; // 8:00 AM
const WORK_END_HOUR = 17;  // 5:00 PM
const WORK_HOURS_FULL = 9;
const WORK_HOURS_HALF = 4.5;

function calcAttendanceStats(checkIn, checkOut) {
  if (!checkIn) return { workingHours: 0, lateMinutes: 0, earlyLeaveMinutes: 0, overtimeHours: 0 };
  const cin = new Date(checkIn);
  const workStart = new Date(cin); workStart.setHours(WORK_START_HOUR, 0, 0, 0);
  const workEnd = new Date(cin); workEnd.setHours(WORK_END_HOUR, 0, 0, 0);

  const lateMinutes = Math.max(0, Math.floor((cin - workStart) / 60000));

  let workingHours = 0, earlyLeaveMinutes = 0, overtimeHours = 0;
  if (checkOut) {
    const cout = new Date(checkOut);
    workingHours = Math.max(0, (cout - cin) / 3600000);
    earlyLeaveMinutes = Math.max(0, Math.floor((workEnd - cout) / 60000));
    overtimeHours = Math.max(0, (cout - workEnd) / 3600000);
  }
  return { workingHours: parseFloat(workingHours.toFixed(2)), lateMinutes, earlyLeaveMinutes, overtimeHours: parseFloat(overtimeHours.toFixed(2)) };
}

// GET /api/attendances?employeeId=&date=&month=&year=
router.get('/', authenticate, async (req, res) => {
  try {
    const { employeeId, date, month, year, status } = req.query;
    const where = { garageId: req.user.garageId, isDeleted: false };
    if (employeeId) where.employeeId = employeeId;
    if (status) where.status = status;
    if (date) {
      const d = new Date(date);
      const next = new Date(d); next.setDate(d.getDate() + 1);
      where.attendanceDate = { gte: d, lt: next };
    } else if (month && year) {
      const start = new Date(parseInt(year), parseInt(month) - 1, 1);
      const end = new Date(parseInt(year), parseInt(month), 1);
      where.attendanceDate = { gte: start, lt: end };
    }
    const records = await prisma.attendance.findMany({
      where,
      include: { employee: { select: { fullName: true, employeeNumber: true, roleId: true, department: true } } },
      orderBy: { attendanceDate: 'desc' }
    });
    res.json(records);
  } catch (err) {
    handleRouteError(err, 'GET /attendances', res);
  }
});

// GET /api/attendances/today-summary?date=YYYY-MM-DD (optional, defaults to today)
router.get('/today-summary', authenticate, async (req, res) => {
  try {
    const base = req.query.date ? new Date(req.query.date) : new Date();
    base.setHours(0,0,0,0);
    const next = new Date(base); next.setDate(base.getDate() + 1);
    const gId = req.user.garageId;
    const dateFilter = { gte: base, lt: next };

    const [present, absent, late, onLeave, excused, total] = await Promise.all([
      prisma.attendance.count({ where: { garageId: gId, isDeleted: false, attendanceDate: dateFilter, status: 'Present' } }),
      prisma.attendance.count({ where: { garageId: gId, isDeleted: false, attendanceDate: dateFilter, status: 'Absent' } }),
      prisma.attendance.count({ where: { garageId: gId, isDeleted: false, attendanceDate: dateFilter, lateMinutes: { gt: 0 }, status: 'Present' } }),
      prisma.attendance.count({ where: { garageId: gId, isDeleted: false, attendanceDate: dateFilter, status: 'Leave' } }),
      prisma.attendance.count({ where: { garageId: gId, isDeleted: false, attendanceDate: dateFilter, status: 'Excused' } }),
      prisma.employee.count({ where: { garageId: gId, isDeleted: false, status: 'active' } })
    ]);
    res.json({ total, present, absent, late, onLeave, excused, attendanceRate: total > 0 ? ((present / total) * 100).toFixed(1) : 0 });
  } catch (err) {
    handleRouteError(err, 'GET /attendances/today-summary', res);
  }
});


// GET /api/attendances/trend?days=30
router.get('/trend', authenticate, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - i);
      const next = new Date(d); next.setDate(d.getDate() + 1);
      const gId = req.user.garageId;
      const [present, absent, late, excused] = await Promise.all([
        prisma.attendance.count({ where: { garageId: gId, isDeleted: false, attendanceDate: { gte: d, lt: next }, status: 'Present' } }),
        prisma.attendance.count({ where: { garageId: gId, isDeleted: false, attendanceDate: { gte: d, lt: next }, status: 'Absent' } }),
        prisma.attendance.count({ where: { garageId: gId, isDeleted: false, attendanceDate: { gte: d, lt: next }, lateMinutes: { gt: 0 }, status: 'Present' } }),
        prisma.attendance.count({ where: { garageId: gId, isDeleted: false, attendanceDate: { gte: d, lt: next }, status: 'Excused' } })
      ]);
      result.push({ date: d.toISOString().split('T')[0], present, absent, late, excused });
    }
    res.json(result);
  } catch (err) {
    handleRouteError(err, 'GET /attendances/trend', res);
  }
});

// POST /api/attendances (single record)
router.post('/', authenticate, async (req, res) => {
  try {
    let { employeeId, attendanceDate, checkIn, checkOut, status, remarks } = req.body;
    if (!employeeId || !attendanceDate || !status) return res.status(400).json({ error: 'employeeId, attendanceDate and status required' });

    // Auto-resolve virtual staff_ IDs → create a real Employee record if needed
    if (typeof employeeId === 'string' && employeeId.startsWith('staff_')) {
      const userId = employeeId.replace('staff_', '');
      // Find or create an Employee record for this user
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
    if (!emp) return res.status(404).json({ error: 'Employee not found in your garage' });

    const d = new Date(attendanceDate); d.setHours(0,0,0,0);
    const stats = calcAttendanceStats(checkIn, checkOut);

    // Upsert so re-logging same day just updates the record
    const record = await prisma.attendance.upsert({
      where: { employeeId_attendanceDate: { employeeId, attendanceDate: d } },
      create: {
        garageId: req.user.garageId,
        employeeId,
        attendanceDate: d,
        checkIn: checkIn ? new Date(checkIn) : null,
        checkOut: checkOut ? new Date(checkOut) : null,
        ...stats, status,
        remarks: remarks || null,
        approvedBy: req.user.id
      },
      update: {
        checkIn: checkIn ? new Date(checkIn) : null,
        checkOut: checkOut ? new Date(checkOut) : null,
        ...stats, status,
        remarks: remarks !== undefined ? remarks : undefined
      }
    });
    res.status(201).json(record);
  } catch (err) {
    handleRouteError(err, 'POST /attendances', res);
  }
});

// POST /api/attendances/bulk
router.post('/bulk', authenticate, async (req, res) => {
  try {
    const { records } = req.body; // [{employeeId, attendanceDate, status, checkIn, checkOut, remarks}]
    if (!Array.isArray(records) || records.length === 0) return res.status(400).json({ error: 'records array required' });

    const results = { created: 0, failed: [] };
    for (const r of records) {
      try {
        const d = new Date(r.attendanceDate); d.setHours(0,0,0,0);
        const stats = calcAttendanceStats(r.checkIn, r.checkOut);
        await prisma.attendance.upsert({
          where: { employeeId_attendanceDate: { employeeId: r.employeeId, attendanceDate: d } },
          create: { garageId: req.user.garageId, employeeId: r.employeeId, attendanceDate: d, checkIn: r.checkIn ? new Date(r.checkIn) : null, checkOut: r.checkOut ? new Date(r.checkOut) : null, ...stats, status: r.status, remarks: r.remarks || null, approvedBy: req.user.id },
          update: { status: r.status, checkIn: r.checkIn ? new Date(r.checkIn) : null, checkOut: r.checkOut ? new Date(r.checkOut) : null, ...stats, remarks: r.remarks || null }
        });
        results.created++;
      } catch (e) {
        results.failed.push({ employeeId: r.employeeId, error: e.message });
      }
    }
    res.json(results);
  } catch (err) {
    handleRouteError(err, 'POST /attendances/bulk', res);
  }
});

// PUT /api/attendances/:id
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.attendance.findFirst({ where: { id, garageId: req.user.garageId, isDeleted: false } });
    if (!existing) return res.status(404).json({ error: 'Record not found' });

    const { checkIn, checkOut, status, remarks, reason } = req.body;
    const stats = calcAttendanceStats(checkIn || existing.checkIn, checkOut || existing.checkOut);

    // Audit log
    await prisma.attendanceLog.create({
      data: { attendanceId: id, oldValue: existing, newValue: req.body, updatedBy: req.user.id, reason: reason || null }
    });

    const updated = await prisma.attendance.update({
      where: { id },
      data: {
        checkIn: checkIn ? new Date(checkIn) : existing.checkIn,
        checkOut: checkOut ? new Date(checkOut) : existing.checkOut,
        ...stats,
        status: status || existing.status,
        remarks: remarks !== undefined ? remarks : existing.remarks
      }
    });
    res.json(updated);
  } catch (err) {
    handleRouteError(err, 'PUT /attendances/:id', res);
  }
});

// DELETE /api/attendances/:id (soft delete)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.attendance.findFirst({ where: { id, garageId: req.user.garageId } });
    if (!existing) return res.status(404).json({ error: 'Record not found' });
    await prisma.attendance.update({ where: { id }, data: { isDeleted: true, deletedAt: new Date() } });
    res.json({ success: true });
  } catch (err) {
    handleRouteError(err, 'DELETE /attendances/:id', res);
  }
});

module.exports = router;
