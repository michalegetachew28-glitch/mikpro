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

app.use(express.json({ limit: '10mb' })); // Allow large payloads for image receipts

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

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Garage API Server running on port ${PORT}`);
});
