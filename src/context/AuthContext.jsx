import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../services/api';

const AuthContext = createContext();

// Support standardized Ethiopian mobile format: 2519XXXXXXXX (12 digits)
export const normalizePhone = (num) => {
  if (!num) return null;
  // Strip all non-digits
  let clean = num.toString().replace(/\D/g, '');
  
  // 09XXXXXXXX -> 2519XXXXXXXX
  if (clean.startsWith('0') && clean.length === 10) {
    clean = '251' + clean.substring(1);
  }
  // 9XXXXXXXX -> 2519XXXXXXXX
  else if (clean.startsWith('9') && clean.length === 9) {
    clean = '251' + clean;
  }
  
  // FINAL CHECK: Must be 12 digits starting with 2519
  if (clean.length === 12 && clean.startsWith('2519')) {
    return clean;
  }
  
  return clean; // Fallback for non-standard or email-like identifiers
};

export const useAuth = () => useContext(AuthContext);

// Helper to safely parse local storage
const safeStorageRead = (key, fallback = null) => {
  try {
    if (typeof localStorage === 'undefined' || !localStorage) return fallback;
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (error) {
    console.warn(`[AuthContext] Storage access failed for key: ${key}.`, error);
    // Only attempt to remove if it was a JSON parse error, not a SecurityError/Access error
    if (error.name !== 'SecurityError' && error.name !== 'NotAllowedError') {
      try { localStorage.removeItem(key); } catch (e) {}
    }
    return fallback;
  }
};


// Seed default accounts if none exist
const seedAccounts = () => {
  const accounts = safeStorageRead('garage_accounts', []);
  const existing = accounts.length > 0;
  
  const devroot = { 
    id: 'devroot', 
    ownerId: 'system', 
    name: 'System Developer', 
    email: 'coder@garage.com', 
    phone: '251987360873', 
    password: '987360873', 
    role: 'coder', 
    garageName: 'MECHPRO CORE SYSTEM', 
    status: 'active', 
    permissions: ['all'] 
  };

  if (!existing) {
    const defaults = [
      { id: 'admin01', ownerId: '0001', name: 'Miky (Owner)', email: 'admin@garage.com', phone: '251911001122', password: 'admin123', role: 'admin', garageName: 'Miky Garage', address: 'Bole, Addis Ababa', status: 'active', permissions: ['all'], createdAt: new Date().toISOString() },
      { id: 'mech01',  ownerId: '0001', name: 'Samuel Bekele', email: 'mechanic@garage.com', phone: '251922334455', password: 'mech123', role: 'mechanic', garageName: 'Miky Garage', address: 'Addis Ketema', status: 'active', permissions: ['repairs_view', 'repairs_edit'], createdAt: new Date().toISOString() },
      { id: 'recp01',  ownerId: '0001', name: 'Almaz Tadesse', email: 'receptionist@garage.com', phone: '251944556677', password: 'recp123', role: 'receptionist', garageName: 'Miky Garage', address: 'Stadium', status: 'active', permissions: ['customers_view', 'vehicles_view', 'appointments_view'], createdAt: new Date().toISOString() },
      { id: 'cash01',  ownerId: '0001', name: 'Hirut Belay', email: 'cashier@garage.com', phone: '251955667788', password: 'cash123', role: 'cashier', garageName: 'Miky Garage', address: 'Megenagna', status: 'active', permissions: ['billing_view', 'billing_edit'], createdAt: new Date().toISOString() },
      { id: 'store01', ownerId: '0001', name: 'Tadesse Kassa', email: 'storekeeper@garage.com', phone: '251966778899', password: 'store123', role: 'storekeeper', garageName: 'Miky Garage', address: 'Piassa', status: 'active', permissions: ['inventory_view', 'inventory_edit'], createdAt: new Date().toISOString() },
      { id: 'cust01',  ownerId: '0001', name: 'Dawit Tesfaye', email: 'customer@garage.com', phone: '251933445566', password: 'cust123', role: 'customer', garageName: 'Miky Garage', address: 'Kazanchis', status: 'active', permissions: ['my_data_view'], createdAt: new Date().toISOString() },
      devroot
    ];
    localStorage.setItem('garage_accounts', JSON.stringify(defaults));
    return defaults;
  }

  // Ensure devroot is ALWAYS present and CORRECT in existing storage
  const coderIndex = accounts.findIndex(a => a.id === 'devroot' || a.role === 'coder');
  if (coderIndex === -1) {
    accounts.push(devroot);
    localStorage.setItem('garage_accounts', JSON.stringify(accounts));
  } else {
    // Force update credentials if they changed
    if (accounts[coderIndex].phone !== devroot.phone || accounts[coderIndex].password !== devroot.password) {
      accounts[coderIndex] = { ...accounts[coderIndex], ...devroot };
      localStorage.setItem('garage_accounts', JSON.stringify(accounts));
    }
  }

  return accounts;
};

// INITIALIZE PLATFORM SETTINGS
const seedPlatformSettings = () => {
  const settings = safeStorageRead('garage_platform_settings', null);
  if (!settings) {
    const defaultSettings = {
      plans: [
        { id: 'monthly', name: 'Monthly', price: 1500, duration: 30 },
        { id: '3month', name: '3 Months', price: 4000, duration: 90 },
        { id: '6month', name: '6 Months', price: 7500, duration: 180 },
        { id: 'yearly', name: 'Yearly', price: 14000, duration: 365 }
      ],
      trialDays: 14,
      paymentMethods: [
        { id: 'p1', type: 'bank', provider: 'Commercial Bank of Ethiopia', accountName: 'MECHPRO TECHNOLOGY', accountNumber: '1000123456789', status: 'active' }
      ]
    };
    localStorage.setItem('garage_platform_settings', JSON.stringify(defaultSettings));
    return defaultSettings;
  }
  return settings;
};

export const AuthProvider = ({ children }) => {
  const enrichUser = useCallback((user) => {
    if (!user || user.role !== 'admin') return user;
    
    const now = new Date();
    const expiryDate = user.expiryDate ? new Date(user.expiryDate) : null;
    
    // Determine subscription type
    let type = 'monthly'; // default to monthly for now if not trial
    if (expiryDate && expiryDate.getFullYear() > 2090) {
      type = 'unlimited';
    } else if (expiryDate && user.createdAt) {
       const diff = (expiryDate - new Date(user.createdAt)) / (1000 * 60 * 60 * 24);
       if (diff <= 15) type = 'trial';
    }

    const isExpired = expiryDate && expiryDate < now;
    const status = (user.status === 'suspended' || isExpired) ? 'suspended' : 'active';
    
    return {
      ...user,
      subscription: {
        type,
        status,
        startDate: user.createdAt,
        expiryDate: user.expiryDate
      }
    };
  }, []);

  const [currentUser, setCurrentUser] = useState(() => {
    const user = safeStorageRead('garage_current_user', null);
    // Note: can't easily enrich here since enrichUser is inside the component
    return user;
  });
  const [isApiMode] = useState(true); // Toggle to false to use localStorage only
  const [authLoading, setAuthLoading] = useState(false);
  const [apiLoading, setApiLoading] = useState(false);
  const globalLoading = authLoading || apiLoading;

  useEffect(() => {
    api.registerLoadingHandlers(
      (count) => {
        if (count > 0) setApiLoading(true);
      },
      (count) => {
        if (count === 0) setApiLoading(false);
      }
    );
    return () => {
      api.registerLoadingHandlers(null, null);
    };
  }, []);

  // Re-enrich current user on load or when currentUser changes
  useEffect(() => {
    if (currentUser && !currentUser.subscription && currentUser.role === 'admin') {
      const enriched = enrichUser(currentUser);
      setCurrentUser(enriched);
      localStorage.setItem('garage_current_user', JSON.stringify(enriched));
    }
  }, [currentUser, enrichUser]);

  // LIVE STATUS SYNCHRONIZATION
  useEffect(() => {
    const handleStorageChange = (e) => {
      // Monitor changes to both accounts and current user
      if (e.key === 'garage_accounts' && currentUser) {
        try {
          const accounts = JSON.parse(e.newValue);
          const updatedSelf = accounts.find(u => u.id === currentUser.id);
          if (updatedSelf) {
            const { password: _, ...safeUser } = updatedSelf;
            // Only update if something actually changed to avoid infinite loops/re-renders
            if (JSON.stringify(safeUser) !== JSON.stringify(currentUser)) {
              console.log('[AuthContext] Live status sync: Updating session data.');
              setCurrentUser(safeUser);
              localStorage.setItem('garage_current_user', JSON.stringify(safeUser));
            }
          }
        } catch (err) {
          console.error('[AuthContext] Storage sync error:', err);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [currentUser]);

  // Data Migration: Standardize phone and add missing fields
  useEffect(() => {
    const accounts = safeStorageRead('garage_accounts', []);
    let changed = false;
    const migrated = accounts.map(a => {
      let updated = { ...a };
      
      // Force update of coder account locally
      if (updated.id === 'devroot' || updated.role === 'coder') {
        if (updated.phone !== '251987360873' || updated.password !== '987360873') {
          changed = true;
          updated.phone = '251987360873';
          updated.password = '987360873';
        }
      }

      // Phone normalization
      if (a.phone) {
        const normalized = normalizePhone(a.phone);
        if (normalized && normalized !== a.phone) {
          changed = true;
          updated.phone = normalized;
        }
      }

      // Add default status and permissions if missing
      if (!updated.status) {
        changed = true;
        updated.status = 'active';
      }
      if (!updated.permissions) {
        changed = true;
        const rolePermissions = {
          admin: ['all'],
          mechanic: ['repairs_view', 'inventory_view', 'vehicles_view'],
          receptionist: ['customers_manage', 'vehicles_manage', 'appointments_manage', 'repairs_view'],
          cashier: ['customers_manage', 'vehicles_manage'],
          storekeeper: ['inventory_view', 'inventory_manage'],
          inventoryManager: ['inventory_manage', 'inventory_view', 'billing_manage'],
          manager: ['repairs_manage', 'repairs_view', 'appointments_manage', 'customers_manage', 'vehicles_manage', 'material_requests_manage', 'tracker_view', 'attendance_manage', 'billing_manage'],
          customer: ['my_data_view'],
          coder: ['all']
        };
        updated.permissions = rolePermissions[a.role] || [];
      }

      // Ensure inventoryManager and manager always have billing_manage
      if ((updated.role === 'inventoryManager' || updated.role === 'manager') && !updated.permissions.includes('billing_manage')) {
        changed = true;
        updated.permissions = [...updated.permissions, 'billing_manage'];
      }

      // Bio and Username defaults
      if (updated.bio === undefined) {
        changed = true;
        updated.bio = '';
      }
      if (!updated.username) {
        changed = true;
        updated.username = updated.email ? updated.email.split('@')[0] : (updated.phone ? 'user_' + updated.phone.slice(-4) : 'user_' + updated.id.slice(-4));
      }

      return updated;
    });

    if (changed) {
      localStorage.setItem('garage_accounts', JSON.stringify(migrated));
      if (currentUser) {
        const updatedSelf = migrated.find(u => u.id === currentUser.id);
        if (updatedSelf) {
          const { password: _, ...safeUser } = updatedSelf;
          setCurrentUser(safeUser);
          localStorage.setItem('garage_current_user', JSON.stringify(safeUser));
        }
      }
    }
  }, [currentUser]);


  const getAccounts = useCallback(() => {
    return seedAccounts();
  }, []);

  // ── Legacy localStorage login (kept for offline/staff users) ──────────────
  const login = useCallback((identifier, password, selectedOwnerId, selectedRole) => {
    const accounts = getAccounts();
    const normalizedId = normalizePhone(identifier);
    
    // Explicit Coder Bypass
    if ((identifier === '987360873' || normalizedId === '251987360873') && password === '987360873') {
      const devroot = accounts.find(a => a.id === 'devroot' || a.role === 'coder');
      if (devroot) {
        const { password: _, ...safeUser } = devroot;
        setCurrentUser(safeUser);
        localStorage.setItem('garage_current_user', JSON.stringify(safeUser));
        return { success: true, user: safeUser };
      }
    }
    
    const user = accounts.find(
      a => (
        (a.email && a.email.toLowerCase() === identifier.toLowerCase()) || 
        (a.phone && (a.phone === identifier || a.phone === normalizedId))
      )
    );

    if (!user) return { success: false, message: 'Account not found. Please check your email/phone.' };

    if (selectedRole && user.role !== 'coder') {
      const isManagerMatch = selectedRole === 'manager' && ['manager', 'inventoryManager', 'storekeeper'].includes(user.role);
      if (user.role !== selectedRole && !isManagerMatch) {
         return { success: false, message: 'Please select the correct role.' };
      }
    }

    if (user.role !== 'coder' && selectedOwnerId) {
      if (user.ownerId !== selectedOwnerId) return { success: false, message: 'Invalid Garage ID for this account.' };
    }

    if (user.status === 'deleted') return { success: false, message: 'This account no longer exists.' };
    if (user.password !== password) return { success: false, message: 'Invalid password. Please try again.' };
    
    const { password: _, ...safeUser } = user;
    if (safeUser.role === 'coder' && selectedOwnerId) safeUser.ownerId = selectedOwnerId;
    
    const enriched = enrichUser(safeUser);
    
    setCurrentUser(enriched);
    localStorage.setItem('garage_current_user', JSON.stringify(enriched));
    return { success: true, user: enriched };
  }, [getAccounts]);

  // ── API-backed login (async, returns Promise) ─────────────────────────────
  const loginAsync = useCallback(async (identifier, password) => {
    setAuthLoading(true);
    try {
      // 1. Try API if configured and available
      if (isApiMode) {
        try {
          const data = await api.login({ emailOrPhone: identifier, password });
          const enriched = enrichUser(data.user);
          localStorage.setItem('garage_token', data.token);
          localStorage.setItem('garage_current_user', JSON.stringify(enriched));
          setCurrentUser(enriched);
          return { success: true, user: enriched };
        } catch (err) {
          // Handle "Failed to fetch" (server down or network issue) by falling back to local seed data
          if (err.message === 'Failed to fetch') {
            console.warn('[Auth/Async] Backend unreachable. Falling back to local accounts.');
            return login(identifier, password);
          }
          return { success: false, message: err.message };
        }
      }
      // 2. Fallback to localStorage only if API mode is explicitly disabled
      return login(identifier, password);
    } finally {
      setAuthLoading(false);
    }
  }, [isApiMode, login]);

  const logout = useCallback(() => {
    setAuthLoading(true);
    setCurrentUser(null);
    localStorage.removeItem('garage_current_user');
    localStorage.removeItem('garage_token');
    // Brief delay so overlay shows during navigation
    setTimeout(() => setAuthLoading(false), 600);
  }, []);

  const getPlatformSettings = useCallback(() => {
    return seedPlatformSettings();
  }, []);

  // Async version that fetches from the API
  const getPlatformSettingsAsync = useCallback(async () => {
    try {
      const s = await api.getSettings();
      // Cache in localStorage as fallback
      localStorage.setItem('garage_platform_settings', JSON.stringify({
        plans: s.plans,
        paymentMethods: s.paymentMethods,
        taxRate: s.taxRate,
        platformFees: s.platformFees,
        trialDays: s.trialDays
      }));
      return s;
    } catch {
      return seedPlatformSettings();
    }
  }, []);

  const updatePlatformSettings = useCallback((newSettings) => {
    localStorage.setItem('garage_platform_settings', JSON.stringify(newSettings));
    return { success: true };
  }, []);

  const updatePlatformSettingsAsync = useCallback(async (newSettings) => {
    try {
      await api.updateSettings(newSettings);
      localStorage.setItem('garage_platform_settings', JSON.stringify(newSettings));
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }, []);

  const getPaymentRequests = useCallback(() => {
    return safeStorageRead('garage_payment_requests', []);
  }, []);

  // Async API-backed payment requests
  const getPaymentRequestsAsync = useCallback(async () => {
    try {
      const data = await api.getMySubscription();
      return data.requests || [];
    } catch {
      return safeStorageRead('garage_payment_requests', []);
    }
  }, []);

  const submitPaymentRequest = useCallback((req) => {
    const list = getPaymentRequests();
    const newReq = { ...req, id: `pay_${Date.now()}`, status: 'pending', createdAt: new Date().toISOString() };
    localStorage.setItem('garage_payment_requests', JSON.stringify([...list, newReq]));
    return { success: true };
  }, [getPaymentRequests]);

  // Async API-backed payment submission
  const submitPaymentRequestAsync = useCallback(async (req) => {
    try {
      const result = await api.submitPayment(req);
      return { success: true, data: result };
    } catch (err) {
      // Fallback to localStorage if API fails
      const list = getPaymentRequests();
      const newReq = { ...req, id: `pay_${Date.now()}`, status: 'pending', createdAt: new Date().toISOString() };
      localStorage.setItem('garage_payment_requests', JSON.stringify([...list, newReq]));
      return { success: true, fallback: true };
    }
  }, [getPaymentRequests]);

  const generateNextGarageId = useCallback(() => {
    const accounts = getAccounts();
    let maxSeq = 0;
    accounts.forEach(acc => {
      if (acc.ownerId && acc.ownerId.match(/^MP\d+$/)) {
        const seq = parseInt(acc.ownerId.replace('MP', ''), 10);
        if (seq > maxSeq) maxSeq = seq;
      }
    });
    const nextSeq = maxSeq === 0 ? 1 : maxSeq + 1;
    return `MP${String(nextSeq).padStart(4, '0')}`;
  }, [getAccounts]);

  // ── API-backed register (async) ──────────────────────────────────────────
  const registerAsync = useCallback(async (name, email, phone, password, role, garageName, address = null, garageId = null) => {
    setAuthLoading(true);
    try {
      const data = await api.register({ name, email, phone, password, role, garageName, address, garageId });
      const enriched = enrichUser(data.user);
      localStorage.setItem('garage_token', data.token);
      localStorage.setItem('garage_current_user', JSON.stringify(enriched));
      setCurrentUser(enriched);
      return { success: true, user: enriched };
    } catch (err) {
      return { success: false, message: err.message };
    } finally {
      setAuthLoading(false);
    }
  }, []);

  // ── Super Admin async methods ──────────────────────────────────────────
  const getAllUsersAsync = useCallback(async () => {
    try {
      return await api.getAllUsers();
    } catch (err) {
      console.error(err);
      return [];
    }
  }, []);

  const approvePaymentRequestAsync = useCallback(async (id) => {
    try {
      await api.approvePayment(id);
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }, []);

  const rejectPaymentRequestAsync = useCallback(async (id, reason) => {
    try {
      await api.rejectPayment(id, reason);
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }, []);

  const suspendUserAsync = useCallback(async (id) => {
    try {
      await api.suspendUser(id);
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }, []);

  const reinstateUserAsync = useCallback(async (id) => {
    try {
      await api.reinstateUser(id);
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }, []);

  const grantUnlimitedAsync = useCallback(async (userId) => {
    try {
      await api.grantUnlimited(userId);
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }, []);

  const revokeUnlimitedAsync = useCallback(async (userId) => {
    try {
      await api.revokeUnlimited(userId);
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }, []);

  const deleteClientAsync = useCallback(async (garageId) => {
    try {
      await api.deleteClient(garageId);
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }, []);

  const platformPurgeAsync = useCallback(async () => {
    try {
      await api.platformPurge();
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }, []);

  const getAllPaymentRequestsAsync = useCallback(async () => {
    try {
      return await api.getAllPaymentRequests();
    } catch (err) {
      console.error(err);
      return [];
    }
  }, []);

  const getClientsAsync = useCallback(async () => {
    try {
      return await api.getClients();
    } catch (err) {
      console.error(err);
      return [];
    }
  }, []);

  const getPlatformStatsAsync = useCallback(async () => {
    try {
      return await api.getPlatformStats();
    } catch (err) {
      console.error(err);
      return null;
    }
  }, []);

  const register = useCallback((name, email, phone, password, role, garageName, ownerId, autoLogin = true, address = null, profilePic = null, bio = '', username = null) => {
    const accounts = getAccounts();
    const normalizedPhone = normalizePhone(phone);
    
    // Check global uniqueness for phone
    if (normalizedPhone) {
      const existingPhone = accounts.find(a => a.phone === normalizedPhone);
      if (existingPhone) {
        return { success: false, message: 'Phone number is already registered across the platform.' };
      }
    }
    
    // Email check
    if (email) {
      const existingEmail = accounts.find(a => a.email && a.email.toLowerCase() === email.toLowerCase());
      if (existingEmail) {
        return { success: false, message: 'Email is already registered.' };
      }
    }

    // Default permissions based on role
    const rolePermissions = {
      admin: ['all'],
      mechanic: ['repairs_view', 'inventory_view', 'vehicles_view'],
      receptionist: ['customers_manage', 'vehicles_manage', 'appointments_manage', 'repairs_view'],
      cashier: ['customers_manage', 'vehicles_manage'],
      storekeeper: ['inventory_view', 'inventory_manage'],
      inventoryManager: ['inventory_manage', 'inventory_view', 'billing_manage'],
      manager: ['repairs_manage', 'repairs_view', 'appointments_manage', 'customers_manage', 'vehicles_manage', 'material_requests_manage', 'tracker_view', 'attendance_manage', 'billing_manage'],
      customer: ['my_data_view'],
      coder: ['all']
    };

    let finalOwnerId = ownerId;
    if (role === 'admin' && !finalOwnerId) {
      // Auto-generate Garage ID in MPXXXX format
      let maxSeq = 0;
      accounts.forEach(acc => {
        if (acc.ownerId && acc.ownerId.match(/^MP\d+$/)) {
          const seq = parseInt(acc.ownerId.replace('MP', ''), 10);
          if (seq > maxSeq) maxSeq = seq;
        }
      });
      const nextSeq = maxSeq === 0 ? 1 : maxSeq + 1;
      finalOwnerId = `MP${String(nextSeq).padStart(4, '0')}`;
    }

    const newUser = {
      id: `u${Date.now()}`,
      ownerId: finalOwnerId || `g${Date.now()}`, 
      name,
      email,
      phone: normalizedPhone,
      password,
      role,
      garageName,
      address,
      profilePic,
      bio,
      username: username || (email ? email.split('@')[0] : (phone ? 'user_' + normalizePhone(phone).slice(-4) : 'user_' + Date.now().toString().slice(-4))),
      status: 'active',
      permissions: rolePermissions[role] || [],
      createdAt: new Date().toISOString()
    };

    // SUBSCRIPTION INJECTION FOR ADMINS
    if (role === 'admin') {
      const settings = seedPlatformSettings();
      const trialDays = settings.trialDays || 14;
      const start = new Date();
      const expiry = new Date();
      expiry.setDate(start.getDate() + trialDays);
      
      newUser.subscription = {
        type: 'trial',
        startDate: start.toISOString(),
        expiryDate: expiry.toISOString(),
        status: 'active'
      };
    }

    const updatedAccounts = [...accounts, newUser];
    localStorage.setItem('garage_accounts', JSON.stringify(updatedAccounts));

    if (autoLogin) {
      const { password: _, ...safeUser } = newUser;
      setCurrentUser(safeUser);
      localStorage.setItem('garage_current_user', JSON.stringify(safeUser));
    }
    
    return { success: true, user: newUser };
  }, [getAccounts]);

  const updateAccountInfo = useCallback((updates) => {
    if (!currentUser) return;
    const accounts = getAccounts();
    const updatedAccounts = accounts.map(a => 
      a.id === currentUser.id ? { ...a, ...updates } : a
    );
    localStorage.setItem('garage_accounts', JSON.stringify(updatedAccounts));
    
    const updatedUser = { ...currentUser, ...updates };
    setCurrentUser(updatedUser);
    localStorage.setItem('garage_current_user', JSON.stringify(updatedUser));
  }, [currentUser, getAccounts]);

  // Helper for admin to update OTHER accounts
  const updateOtherAccount = useCallback((userId, newData) => {
    const accounts = getAccounts();
    const updatedAccounts = accounts.map(a => a.id === userId ? { ...a, ...newData } : a);
    localStorage.setItem('garage_accounts', JSON.stringify(updatedAccounts));
    return { success: true };
  }, [getAccounts]);

  // Add a photo to the current user's profile gallery
  const addProfilePhoto = useCallback((photoData) => {
    if (!currentUser) return;
    const accounts = getAccounts();
    const user = accounts.find(a => a.id === currentUser.id);
    const gallery = [...(user?.profileGallery || []), { id: `photo_${Date.now()}`, url: photoData, addedAt: new Date().toISOString() }];
    const updatedAccounts = accounts.map(a => a.id === currentUser.id ? { ...a, profileGallery: gallery, profilePic: gallery[0]?.url || a.profilePic } : a);
    localStorage.setItem('garage_accounts', JSON.stringify(updatedAccounts));
    const updatedUser = { ...currentUser, profileGallery: gallery };
    setCurrentUser(updatedUser);
    localStorage.setItem('garage_current_user', JSON.stringify(updatedUser));
    return gallery;
  }, [currentUser, getAccounts]);

  // Remove a photo from the gallery by its id
  const removeProfilePhoto = useCallback((photoId) => {
    if (!currentUser) return;
    const accounts = getAccounts();
    const user = accounts.find(a => a.id === currentUser.id);
    const gallery = (user?.profileGallery || []).filter(p => p.id !== photoId);
    const updatedAccounts = accounts.map(a => a.id === currentUser.id ? { ...a, profileGallery: gallery, profilePic: gallery[0]?.url || null } : a);
    localStorage.setItem('garage_accounts', JSON.stringify(updatedAccounts));
    const updatedUser = { ...currentUser, profileGallery: gallery };
    setCurrentUser(updatedUser);
    localStorage.setItem('garage_current_user', JSON.stringify(updatedUser));
    return gallery;
  }, [currentUser, getAccounts]);

  // Reorder gallery photos
  const reorderProfilePhotos = useCallback((newOrder) => {
    if (!currentUser) return;
    const accounts = getAccounts();
    const updatedAccounts = accounts.map(a => a.id === currentUser.id ? { ...a, profileGallery: newOrder, profilePic: newOrder[0]?.url || null } : a);
    localStorage.setItem('garage_accounts', JSON.stringify(updatedAccounts));
    const updatedUser = { ...currentUser, profileGallery: newOrder };
    setCurrentUser(updatedUser);
    localStorage.setItem('garage_current_user', JSON.stringify(updatedUser));
  }, [currentUser, getAccounts]);

  // Hard-delete an account by ID. Marks as 'deleted' so login is permanently blocked.
  const deleteAccount = useCallback((userId) => {
    const accounts = getAccounts();
    // Mark as deleted rather than actually removing, keeps data integrity
    const updatedAccounts = accounts.map(a =>
      a.id === userId ? { ...a, status: 'deleted', deletedAt: new Date().toISOString() } : a
    );
    localStorage.setItem('garage_accounts', JSON.stringify(updatedAccounts));

    // If the current user is somehow the deleted one, log them out
    if (currentUser?.id === userId) {
      setCurrentUser(null);
      localStorage.removeItem('garage_current_user');
    }
    return { success: true };
  }, [getAccounts, currentUser]);

  const updateGarageInfo = useCallback((ownerId, updates) => {
    const accounts = getAccounts();
    const updatedAccounts = accounts.map(a => 
      a.ownerId === ownerId ? { ...a, ...updates } : a
    );
    localStorage.setItem('garage_accounts', JSON.stringify(updatedAccounts));
    
    // Also update current user if they belong to this garage
    if (currentUser && currentUser.ownerId === ownerId) {
      const updatedUser = { ...currentUser, ...updates };
      setCurrentUser(updatedUser);
      localStorage.setItem('garage_current_user', JSON.stringify(updatedUser));
    }
    return { success: true };
  }, [currentUser, getAccounts]);

  const verifyPassword = useCallback((plainPassword) => {
    if (!currentUser) return false;
    const accounts = getAccounts();
    const user = accounts.find(a => a.id === currentUser.id);
    return user && user.password === plainPassword;
  }, [currentUser, getAccounts]);

  const requestPasswordReset = useCallback((identifier) => {
    const accounts = getAccounts();
    const normalizedId = normalizePhone(identifier);
    const user = accounts.find(a => 
      (a.email && a.email.toLowerCase() === identifier.toLowerCase()) || 
      (a.phone && (a.phone === identifier || a.phone === normalizedId))
    );

    if (!user) {
      return { success: false, message: 'Account not found.' };
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = Date.now() + (5 * 60 * 1000); // 5 minutes
    const resetData = { identifier, code: otp, expiry };
    localStorage.setItem('garage_password_reset_pending', JSON.stringify(resetData));

    console.log(`[MOCK OTP] code: ${otp} for: ${identifier}`);
    return { success: true, code: otp };
  }, [getAccounts]);

  const verifyResetOtp = useCallback((identifier, code) => {
    const saved = safeStorageRead('garage_password_reset_pending', null);
    if (!saved || saved.identifier !== identifier) return { success: false, message: 'No reset requested.' };
    if (Date.now() > saved.expiry) return { success: false, message: 'Code expired.' };
    if (saved.code !== code) return { success: false, message: 'Invalid code.' };
    
    localStorage.setItem('garage_password_reset_pending', JSON.stringify({ ...saved, verified: true }));
    return { success: true };
  }, []);

  const resetPassword = useCallback((identifier, newPassword) => {
    const saved = safeStorageRead('garage_password_reset_pending', null);
    if (!saved || saved.identifier !== identifier || !saved.verified) return { success: false, message: 'Verification required.' };

    const accounts = getAccounts();
    const updatedAccounts = accounts.map(a => {
      if ((a.email && a.email.toLowerCase() === identifier.toLowerCase()) || (a.phone && normalizePhone(a.phone) === normalizePhone(identifier))) {
        return { ...a, password: newPassword };
      }
      return a;
    });

    localStorage.setItem('garage_accounts', JSON.stringify(updatedAccounts));
    localStorage.removeItem('garage_password_reset_pending');
    return { success: true, message: 'Password reset successfully.' };
  }, [getAccounts]);

  // BACKGROUND SUBSCRIPTION ENFORCER
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'admin' || currentUser.subscription?.type === 'unlimited') return;

    const checkExpiry = () => {
      const expiry = new Date(currentUser.subscription?.expiryDate);
      if (!expiry || isNaN(expiry.getTime())) return;

      const now = new Date();
      if (now > expiry && currentUser.subscription.status !== 'suspended') {
        console.log('[Subscription] Expiry detected. Suspending account access.');
        const updates = { 
          subscription: { ...currentUser.subscription, status: 'suspended' } 
        };
        
        // Update both current session and the global accounts list
        updateAccountInfo(updates);
      }
    };

    // Check on mount and then every 5 minutes
    checkExpiry();
    const interval = setInterval(checkExpiry, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [currentUser, updateAccountInfo]);

  const value = useMemo(() => ({
    currentUser, authLoading, globalLoading, login, loginAsync, logout, register, registerAsync, getAccounts,
    updateAccountInfo, updateOtherAccount, deleteAccount, updateGarageInfo, verifyPassword,
    requestPasswordReset, verifyResetOtp, resetPassword, generateNextGarageId,
    addProfilePhoto, removeProfilePhoto, reorderProfilePhotos,
    getPlatformSettings, getPlatformSettingsAsync,
    updatePlatformSettings, updatePlatformSettingsAsync,
    getPaymentRequests, getPaymentRequestsAsync, getAllPaymentRequestsAsync,
    submitPaymentRequest, submitPaymentRequestAsync,
    approvePaymentRequestAsync, rejectPaymentRequestAsync,
    getAllUsersAsync, suspendUserAsync, reinstateUserAsync,
    grantUnlimitedAsync, revokeUnlimitedAsync,
    deleteClientAsync, platformPurgeAsync,
    getClientsAsync, getPlatformStatsAsync
  }), [
    currentUser, authLoading, apiLoading, login, loginAsync, logout, register, getAccounts,
    updateAccountInfo, updateOtherAccount, deleteAccount, updateGarageInfo, verifyPassword,
    requestPasswordReset, verifyResetOtp, resetPassword, generateNextGarageId,
    addProfilePhoto, removeProfilePhoto, reorderProfilePhotos,
    getPlatformSettings, getPlatformSettingsAsync,
    updatePlatformSettings, updatePlatformSettingsAsync,
    getPaymentRequests, getPaymentRequestsAsync, getAllPaymentRequestsAsync,
    submitPaymentRequest, submitPaymentRequestAsync,
    approvePaymentRequestAsync, rejectPaymentRequestAsync,
    getAllUsersAsync, suspendUserAsync, reinstateUserAsync,
    grantUnlimitedAsync, revokeUnlimitedAsync,
    deleteClientAsync, platformPurgeAsync,
    getClientsAsync, getPlatformStatsAsync, registerAsync
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
