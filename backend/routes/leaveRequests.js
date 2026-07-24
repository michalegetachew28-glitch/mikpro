const express = require('express');
const { authenticate } = require('../middleware/auth');
const { handleRouteError } = require('../middleware/errorHandler');
const router = express.Router();
const prisma = require('../db');

// GET /api/leave-requests
router.get('/', authenticate, async (req, res) => {
  try {
    const { employeeId, status } = req.query;
    const where = { garageId: req.user.garageId, isDeleted: false };
    if (employeeId) where.employeeId = employeeId;
    if (status) where.status = status;
    const records = await prisma.leaveRequest.findMany({
      where,
      include: { employee: { select: { fullName: true, employeeNumber: true, department: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(records);
  } catch (err) {
    handleRouteError(err, 'GET /leave-requests', res);
  }
});

// POST /api/leave-requests
router.post('/', authenticate, async (req, res) => {
  try {
    const { employeeId, leaveType, startDate, endDate, reason } = req.body;
    if (!employeeId || !leaveType || !startDate || !endDate) return res.status(400).json({ error: 'employeeId, leaveType, startDate, endDate required' });
    const emp = await prisma.employee.findFirst({ where: { id: employeeId, garageId: req.user.garageId, isDeleted: false } });
    if (!emp) return res.status(404).json({ error: 'Employee not found' });

    const start = new Date(startDate); const end = new Date(endDate);
    const totalDays = Math.ceil((end - start) / 86400000) + 1;
    const record = await prisma.leaveRequest.create({
      data: { garageId: req.user.garageId, employeeId, leaveType, startDate: start, endDate: end, totalDays, reason: reason || null, status: 'pending' }
    });
    res.status(201).json(record);
  } catch (err) {
    handleRouteError(err, 'POST /leave-requests', res);
  }
});

// PATCH /api/leave-requests/:id/approve
router.patch('/:id/approve', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const leave = await prisma.leaveRequest.findFirst({ where: { id, garageId: req.user.garageId } });
    if (!leave) return res.status(404).json({ error: 'Leave request not found' });
    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: { status: 'approved', approvedBy: req.user.id, approvedAt: new Date() }
    });
    // Auto-create attendance records for leave period
    const start = new Date(leave.startDate);
    const end = new Date(leave.endDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const day = new Date(d); day.setHours(0,0,0,0);
      await prisma.attendance.upsert({
        where: { employeeId_attendanceDate: { employeeId: leave.employeeId, attendanceDate: day } },
        create: { garageId: req.user.garageId, employeeId: leave.employeeId, attendanceDate: day, status: 'Leave', workingHours: 0, lateMinutes: 0, earlyLeaveMinutes: 0, overtimeHours: 0, remarks: `${leave.leaveType} leave`, approvedBy: req.user.id },
        update: { status: 'Leave', remarks: `${leave.leaveType} leave` }
      });
    }
    res.json(updated);
  } catch (err) {
    handleRouteError(err, 'PATCH /leave-requests/:id/approve', res);
  }
});

// PATCH /api/leave-requests/:id/reject
router.patch('/:id/reject', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const leave = await prisma.leaveRequest.findFirst({ where: { id, garageId: req.user.garageId } });
    if (!leave) return res.status(404).json({ error: 'Leave request not found' });
    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: { status: 'rejected', approvedBy: req.user.id, approvedAt: new Date() }
    });
    res.json(updated);
  } catch (err) {
    handleRouteError(err, 'PATCH /leave-requests/:id/reject', res);
  }
});

module.exports = router;
