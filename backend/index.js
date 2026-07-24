const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const subscriptionRoutes = require('./routes/subscriptions');
const vehicleRoutes = require('./routes/vehicles');
const customerRoutes = require('./routes/customers');
const repairRoutes = require('./routes/repairs');
const inventoryRoutes = require('./routes/inventory');
const staffRoutes = require('./routes/staff');
const appointmentRoutes = require('./routes/appointments');
const settingsRoutes = require('./routes/settings');
const superAdminRoutes = require('./routes/superAdmin');
const materialRequestRoutes = require('./routes/materialRequests');
// const trackerRoutes = require('./routes/trackers');
const employeeRoutes = require('./routes/employees');
const attendanceRoutes = require('./routes/attendances');
const leaveRequestRoutes = require('./routes/leaveRequests');
const salaryStructureRoutes = require('./routes/salaryStructures');
const salaryPeriodRoutes = require('./routes/salaryPeriods');
const salaryCalculationRoutes = require('./routes/salaryCalculations');
const salaryPaymentRoutes = require('./routes/salaryPayments');
const payrollAnalyticsRoutes = require('./routes/payrollAnalytics');
const revenueRoutes = require('./routes/revenue');
const invoiceRoutes = require('./routes/invoices');
const paymentAccountRoutes = require('./routes/paymentAccounts');
const bonusRoutes = require('./routes/bonuses');
const financialReportRoutes = require('./routes/financialReports');

const { globalErrorHandler } = require('./middleware/errorHandler');

const app = express();

const frontendUrl = process.env.FRONTEND_URL;
const allowedOrigins = ['http://localhost:5173', 'http://localhost:3000'];
if (frontendUrl) {
  allowedOrigins.push(frontendUrl);
  if (!frontendUrl.startsWith('http')) {
    allowedOrigins.push(`https://${frontendUrl}`);
  }
}

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

app.use(express.json({ limit: '50mb' })); // Allow large payloads for image receipts

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/repairs', repairRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/material-requests', materialRequestRoutes);
// app.use('/api/trackers', trackerRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/attendances', attendanceRoutes);
app.use('/api/leave-requests', leaveRequestRoutes);
app.use('/api/salary-structures', salaryStructureRoutes);
app.use('/api/salary-periods', salaryPeriodRoutes);
app.use('/api/salary-calculations', salaryCalculationRoutes);
app.use('/api/salary-payments', salaryPaymentRoutes);
app.use('/api/payroll-analytics', payrollAnalyticsRoutes);
app.use('/api/revenue', revenueRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/payment-accounts', paymentAccountRoutes);
app.use('/api/bonuses', bonusRoutes);
app.use('/api/financial-reports', financialReportRoutes);

// Global error handler — logs full error server-side, returns safe generic message to client
app.use(globalErrorHandler);

const http = require('http');
const server = http.createServer(app);

// Initialize WebSockets
const initWebsocket = require('./websocket');
initWebsocket(server);

// Share broadcast methods
app.set('broadcastTrackerUpdate', server.broadcastTrackerUpdate);
app.set('broadcastNewTracker', server.broadcastNewTracker);

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Garage API Server running on http://0.0.0.0:${PORT}`);
});
