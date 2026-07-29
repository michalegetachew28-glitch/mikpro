// Central API service layer - connects frontend to the Node.js/Express backend
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const getToken = () => localStorage.getItem('garage_token');

let activeRequests = 0;
let onRequestStart = null;
let onRequestEnd = null;

const request = async (method, path, body = null, options = {}) => {
  const isBackground = options.silent || (method === 'GET' && !options.showLoader);
  if (!isBackground) {
    activeRequests++;
    if (onRequestStart) onRequestStart(activeRequests);
  }

  try {
    const token = getToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30-second timeout

    let res;
    try {
      res = await fetch(`${API_BASE}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  } finally {
    if (!isBackground) {
      activeRequests--;
      if (onRequestEnd) onRequestEnd(activeRequests);
    }
  }
};

export const api = {
  registerLoadingHandlers: (startCb, endCb) => {
    onRequestStart = startCb;
    onRequestEnd = endCb;
  },
  // AUTH
  register: (payload) => request('POST', '/auth/register', payload),
  login: (payload) => request('POST', '/auth/login', payload),
  getMe: () => request('GET', '/auth/me'),
  getActiveGarages: () => request('GET', '/auth/garages'),

  // SUBSCRIPTIONS
  getMySubscription: () => request('GET', '/subscriptions/my'),
  submitPayment: (payload) => request('POST', '/subscriptions/submit', payload),

  // SETTINGS (platform plans & bank accounts)
  getSettings: () => request('GET', '/settings'),
  updateSettings: (data) => request('PATCH', '/settings', data),

  // GARAGE PROFILE (admin)
  getGarageProfile: () => request('GET', '/settings/garage'),
  updateGarageProfile: (data) => request('PATCH', '/settings/garage', data),

  // SUPER ADMIN
  getAllPaymentRequests: () => request('GET', '/super-admin/payment-requests'),
  approvePayment: (id) => request('PATCH', `/super-admin/payment-requests/${id}/approve`),
  rejectPayment: (id, rejectionReason) => request('PATCH', `/super-admin/payment-requests/${id}/reject`, { rejectionReason }),
  getAllUsers: () => request('GET', '/super-admin/users'),
  suspendUser: (id) => request('PATCH', `/super-admin/users/${id}/suspend`),
  reinstateUser: (id) => request('PATCH', `/super-admin/users/${id}/reinstate`),
  getClients: () => request('GET', '/super-admin/clients'),
  getPlatformStats: () => request('GET', '/super-admin/platform-stats'),
  grantUnlimited: (id) => request('PATCH', `/super-admin/users/${id}/grant-unlimited`),
  revokeUnlimited: (id) => request('PATCH', `/super-admin/users/${id}/revoke-unlimited`),
  deleteClient: (garageId) => request('DELETE', `/super-admin/clients/${garageId}`),
  platformPurge: () => request('DELETE', '/super-admin/platform-purge'),

  // CORE DATA (per garage)
  getVehicles: () => request('GET', '/vehicles'),
  createVehicle: (data) => request('POST', '/vehicles', data),
  updateVehicle: (id, data) => request('PUT', `/vehicles/${id}`, data),
  deleteVehicle: (id) => request('DELETE', `/vehicles/${id}`),

  getCustomers: () => request('GET', '/customers'),
  createCustomer: (data) => request('POST', '/customers', data),
  updateCustomer: (id, data) => request('PUT', `/customers/${id}`, data),
  deleteCustomer: (id) => request('DELETE', `/customers/${id}`),

  getRepairs: () => request('GET', '/repairs'),
  createRepair: (data) => request('POST', '/repairs', data),
  updateRepair: (id, data) => request('PUT', `/repairs/${id}`, data),
  deleteRepair: (id) => request('DELETE', `/repairs/${id}`),

  getInventory: () => request('GET', '/inventory'),
  createInventoryItem: (data) => request('POST', '/inventory', data),
  updateInventoryItem: (id, data) => request('PUT', `/inventory/${id}`, data),
  deleteInventoryItem: (id) => request('DELETE', `/inventory/${id}`),

  getStaff: () => request('GET', '/staff'),
  createStaff: (data) => request('POST', '/staff', data),
  updateStaff: (id, data) => request('PUT', `/staff/${id}`, data),
  deleteStaff: (id) => request('DELETE', `/staff/${id}`),
  updateStaffStatus: (id, status) => request('PATCH', `/staff/${id}/status`, { status }),
  updateStaffPermissions: (id, permissions) => request('PATCH', `/staff/${id}/permissions`, { permissions }),

  getAppointments: () => request('GET', '/appointments'),
  createAppointment: (data) => request('POST', '/appointments', data),
  updateAppointment: (id, data) => request('PUT', `/appointments/${id}`, data),
  deleteAppointment: (id) => request('DELETE', `/appointments/${id}`),

  getMaterialRequests: () => request('GET', '/material-requests'),
  createMaterialRequest: (data) => request('POST', '/material-requests', data),
  updateMaterialRequest: (id, data) => request('PUT', `/material-requests/${id}`, data),
  deleteMaterialRequest: (id) => request('DELETE', `/material-requests/${id}`),

  // CUSTOMER PORTAL
  getCustomerRepairs: () => request('GET', '/repairs/customer'),

  getTrackers: () => request('GET', '/trackers/active'),
  getTrackerHistory: () => request('GET', '/trackers/history'),
  createTracker: (data) => request('POST', '/trackers', data),
  updateTracker: (id, data) => request('PUT', `/trackers/${id}`, data),
  deleteTracker: (id) => request('DELETE', `/trackers/${id}`),

  // EMPLOYEES
  getEmployees: () => request('GET', '/employees'),
  getEmployee: (id) => request('GET', `/employees/${id}`),
  createEmployee: (data) => request('POST', '/employees', data),
  updateEmployee: (id, data) => request('PUT', `/employees/${id}`, data),
  deleteEmployee: (id) => request('DELETE', `/employees/${id}`),
  syncEmployeesFromStaff: () => request('POST', '/employees/sync-from-staff'),
  getPersonalSalaryDashboard: () => request('GET', '/employees/me/salary-dashboard'),
  updatePersonalBankInfo: (data) => request('PUT', '/employees/me/bank-info', data),

  // ATTENDANCE
  getAttendances: (params = {}) => request('GET', `/attendances?${new URLSearchParams(params)}`),
  getAttendanceSummary: () => request('GET', '/attendances/today-summary'),
  getAttendanceTrend: (days = 30) => request('GET', `/attendances/trend?days=${days}`),
  createAttendance: (data) => request('POST', '/attendances', data),
  bulkAttendance: (records) => request('POST', '/attendances/bulk', { records }),
  updateAttendance: (id, data) => request('PUT', `/attendances/${id}`, data),
  deleteAttendance: (id) => request('DELETE', `/attendances/${id}`),

  // LEAVE REQUESTS
  getLeaveRequests: (params = {}) => request('GET', `/leave-requests?${new URLSearchParams(params)}`),
  createLeaveRequest: (data) => request('POST', '/leave-requests', data),
  approveLeave: (id) => request('PATCH', `/leave-requests/${id}/approve`),
  rejectLeave: (id) => request('PATCH', `/leave-requests/${id}/reject`),

  // SALARY STRUCTURES
  getSalaryStructures: (params = {}) => request('GET', `/salary-structures?${new URLSearchParams(params)}`),
  createSalaryStructure: (data) => request('POST', '/salary-structures', data),
  updateSalaryStructure: (id, data) => request('PUT', `/salary-structures/${id}`, data),
  deleteSalaryStructure: (id) => request('DELETE', `/salary-structures/${id}`),

  // SALARY PERIODS
  getSalaryPeriods: () => request('GET', '/salary-periods'),
  createSalaryPeriod: (data) => request('POST', '/salary-periods', data),
  lockSalaryPeriod: (id) => request('PATCH', `/salary-periods/${id}/lock`),
  unlockSalaryPeriod: (id) => request('PATCH', `/salary-periods/${id}/unlock`),
  markSalaryPeriodPaid: (id) => request('PATCH', `/salary-periods/${id}/mark-paid`),

  // SALARY CALCULATIONS
  getSalaryCalculations: (params = {}) => request('GET', `/salary-calculations?${new URLSearchParams(params)}`),
  generatePayroll: (periodId) => request('POST', '/salary-calculations/generate', { periodId }),
  approveSalaryCalc: (id) => request('PATCH', `/salary-calculations/${id}/approve`),
  rejectSalaryCalc: (id, reason) => request('PATCH', `/salary-calculations/${id}/reject`, { reason }),
  getSalarySlip: (id) => request('GET', `/salary-calculations/${id}/slip`),

  // SALARY PAYMENTS
  getSalaryPayments: (params = {}) => request('GET', `/salary-payments?${new URLSearchParams(params)}`),
  createSalaryPayment: (data) => request('POST', '/salary-payments', data),
  getPayableEmployees: () => request('GET', '/salary-payments/payable'),
  approveSalaryPayment: (id) => request('PATCH', `/salary-payments/${id}/approve`),
  reportSalaryPaymentIssue: (id, reason) => request('PATCH', `/salary-payments/${id}/report-issue`, { reason }),
  transitionSalaryPaymentStatus: (id, status) => request('PATCH', `/salary-payments/${id}/transition-status`, { status }),

  // PAYROLL ANALYTICS
  getPayrollDashboard: () => request('GET', '/payroll-analytics/dashboard'),
  getPayrollTrend: (months = 6) => request('GET', `/payroll-analytics/payroll-trend?months=${months}`),
  getDepartmentCosts: (params = {}) => request('GET', `/payroll-analytics/department-costs?${new URLSearchParams(params)}`),
  getPayrollReports: (params = {}) => request('GET', `/payroll-analytics/reports?${new URLSearchParams(params)}`),

  // REVENUE
  getRevenueSummary: () => request('GET', '/revenue/summary'),
  getRevenueList: (params = {}) => request('GET', `/revenue/list?${new URLSearchParams(params)}`),
  getRevenueAnalytics: () => request('GET', '/revenue/analytics'),

  // BILLING & INVOICES
  getInvoices: () => request('GET', '/invoices'),
  createInvoice: (data) => request('POST', '/invoices', data),
  updateInvoiceStatus: (id, status, paymentMethod) => request('PATCH', `/invoices/${id}/status`, { status, paymentMethod }),
  submitInvoiceProof: (id, data) => request('POST', `/invoices/${id}/proof`, data),
  deleteInvoice: (id) => request('DELETE', `/invoices/${id}`),

  // PAYMENT ACCOUNTS
  getPaymentAccounts: () => request('GET', '/payment-accounts'),
  createPaymentAccount: (data) => request('POST', '/payment-accounts', data),
  updatePaymentAccount: (id, data) => request('PUT', `/payment-accounts/${id}`, data),
  deletePaymentAccount: (id) => request('DELETE', `/payment-accounts/${id}`),

  // BILLING SETTINGS
  getBillingSettings: () => request('GET', '/settings/billing'),
  updateBillingSettings: (data) => request('PATCH', '/settings/billing', data),

  // BONUSES
  getBonuses: () => request('GET', '/bonuses'),
  createBonus: (data) => request('POST', '/bonuses', data),

  // FINANCIAL REPORTS
  getFinancialReportSummary: (params = {}) => request('GET', `/financial-reports/summary?${new URLSearchParams(params)}`),

  // MESSAGING CONTACTS
  getGarageContacts: () => request('GET', '/users/garage-contacts')
};

