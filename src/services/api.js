// Central API service layer - connects frontend to the Node.js/Express backend
const API_BASE = 'http://localhost:5000/api';

const getToken = () => localStorage.getItem('garage_token');

let activeRequests = 0;
let onRequestStart = null;
let onRequestEnd = null;

const request = async (method, path, body = null) => {
  activeRequests++;
  if (onRequestStart) onRequestStart(activeRequests);

  try {
    const token = getToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  } finally {
    activeRequests--;
    if (onRequestEnd) onRequestEnd(activeRequests);
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
  deleteAppointment: (id) => request('DELETE', `/appointments/${id}`)
};
