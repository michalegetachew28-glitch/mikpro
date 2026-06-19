import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import OfflineBanner from './components/OfflineBanner';

// Core components - No lazy loading for these to ensure immediate availability
import Login from './components/Login';
import Layout from './components/Layout';
import LandingPage from './components/LandingPage';

// Page components - Regular imports for maximum stability during debugging
import Dashboard from './components/Dashboard';
import Customers from './components/Customers';
import Vehicles from './components/Vehicles';
import Repairs from './components/Repairs';
import Inventory from './components/Inventory';
import Billing from './components/Billing';
import Staff from './components/Staff';
import Appointments from './components/Appointments';
import Settings from './components/Settings';
import MapTracker from './components/MapTracker';
import Backup from './components/Backup';
import CoderPanel from './components/CoderPanel';
import ActivityLogs from './components/ActivityLogs';
import MaterialRequests from './components/MaterialRequests';
import Bonus from './components/Bonus';
import Attendance from './components/Attendance';
import AttendanceLayout from './components/AttendanceLayout';
import AttendanceHistory from './components/AttendanceHistory';
import AttendanceReports from './components/AttendanceReports';
import AttendanceEmployeeSummary from './components/AttendanceEmployeeSummary';
import Salary from './components/Salary';
import Messaging from './components/Messaging';
import Profile from './components/Profile';
import ErrorBoundary from './components/ErrorBoundary';

// Role-based guard
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { currentUser } = useAuth();
  if (!currentUser) return <Navigate to="/login" replace />;
  const role = currentUser?.role?.toLowerCase() || '';
  if (allowedRoles && !allowedRoles.some(r => r.toLowerCase() === role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

function App() {
  const { currentUser } = useAuth();
  
  return (
    <Suspense fallback={
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f7fe' }}>
        <div className="loader-spinner"></div>
      </div>
    }>
      <OfflineBanner />
      <Routes>
        {/* Auth route */}
        <Route
          path="/login"
          element={currentUser ? <Navigate to="/dashboard" replace /> : <Login />}
        />

        {/* Public Landing Page */}
        <Route path="/" element={<LandingPage />} />

        {/* Protected app routes */}
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          {/* Shared by All Roles */}
          <Route path="dashboard"    element={<Dashboard />} />
          <Route path="messages"     element={<Messaging />} />
          <Route path="messaging"    element={<Messaging />} />
          <Route path="profile"      element={<Profile />} />
          <Route path="profile/:userId" element={<Profile />} />
          <Route path="tracker"      element={<MapTracker />} />
          <Route path="settings"     element={<Settings />} />
          <Route path="bonus"        element={<ProtectedRoute allowedRoles={['mechanic', 'coder']}><Bonus /></ProtectedRoute>} />

          {/* Role-Specific Areas */}
          <Route path="appointments" element={<ProtectedRoute allowedRoles={['admin', 'receptionist', 'customer', 'manager', 'coder']}><Appointments /></ProtectedRoute>} />
          <Route path="billing"      element={<ProtectedRoute allowedRoles={['admin', 'cashier', 'customer', 'manager', 'inventoryManager', 'coder']}><Billing /></ProtectedRoute>} />
          <Route path="vehicles"     element={<ProtectedRoute allowedRoles={['admin', 'mechanic', 'receptionist', 'manager', 'coder']}><Vehicles /></ProtectedRoute>} />
          <Route path="repairs"      element={<ProtectedRoute allowedRoles={['admin', 'mechanic', 'receptionist', 'manager', 'coder']}><Repairs /></ProtectedRoute>} />
          <Route path="attendance" element={<ProtectedRoute allowedRoles={['admin', 'manager', 'coder']}><AttendanceLayout /></ProtectedRoute>}>
            <Route index element={<Attendance />} />
            <Route path="history" element={<AttendanceHistory />} />
            <Route path="reports" element={<AttendanceReports />} />
            <Route path="summary" element={<AttendanceEmployeeSummary />} />
          </Route>
          <Route path="inventory"    element={<ProtectedRoute allowedRoles={['storekeeper', 'mechanic', 'inventoryManager', 'coder']}><Inventory /></ProtectedRoute>} />
          <Route path="material-requests" element={<ProtectedRoute allowedRoles={['storekeeper', 'inventoryManager', 'manager', 'mechanic', 'coder']}><MaterialRequests /></ProtectedRoute>} />
          <Route path="customers"    element={<ProtectedRoute allowedRoles={['admin', 'receptionist', 'manager', 'coder']}><Customers /></ProtectedRoute>} />
          <Route path="salary"       element={<ProtectedRoute allowedRoles={['admin', 'mechanic', 'cashier', 'receptionist', 'storekeeper', 'manager', 'coder']}><Salary /></ProtectedRoute>} />

          {/* Admin/Owner Only */}
          <Route path="staff"        element={<ProtectedRoute allowedRoles={['admin', 'coder']}><ErrorBoundary><Staff /></ErrorBoundary></ProtectedRoute>} />
          <Route path="activity"     element={<ProtectedRoute allowedRoles={['admin', 'coder']}><ActivityLogs /></ProtectedRoute>} />
          <Route path="backup"       element={<ProtectedRoute allowedRoles={['admin', 'coder']}><Backup /></ProtectedRoute>} />

          {/* Coder Only */}
          <Route path="coder-portal" element={<ProtectedRoute allowedRoles={['coder']}><CoderPanel /></ProtectedRoute>} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to={currentUser ? "/dashboard" : "/"} replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;
