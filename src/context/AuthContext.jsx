import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

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

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(() => {
    return safeStorageRead('garage_current_user', null);
  });

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
          mechanic: ['repairs_view', 'repairs_manage', 'inventory_view', 'vehicles_view'],
          receptionist: ['customers_manage', 'vehicles_manage', 'appointments_manage', 'repairs_view'],
          cashier: ['billing_manage', 'customers_view'],
          storekeeper: ['inventory_view', 'inventory_manage'],
          inventoryManager: ['inventory_manage', 'inventory_view', 'billing_manage'],
          manager: ['repairs_manage', 'appointments_manage', 'customers_manage', 'vehicles_manage', 'material_requests_manage', 'tracker_view', 'attendance_manage'],
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
    
    // 1. Find the user FIRST
    const user = accounts.find(
      a => (
        (a.email && a.email.toLowerCase() === identifier.toLowerCase()) || 
        (a.phone && (a.phone === identifier || a.phone === normalizedId))
      )
    );

    if (!user) {
      return { success: false, message: 'Account not found. Please check your email/phone.' };
    }

    // Role check (if selectedRole is provided from login page)
    if (selectedRole && user.role !== 'coder') {
      // Handle legacy manager mapping
      const isManagerMatch = selectedRole === 'manager' && ['manager', 'inventoryManager', 'storekeeper'].includes(user.role);
      if (user.role !== selectedRole && !isManagerMatch) {
         return { success: false, message: 'Please select the correct role.' };
      }
    }

    // Garage ID check
    if (user.role !== 'coder') {
      if (!selectedOwnerId) {
        return { success: false, message: 'Please select or enter a valid Garage ID.' };
      }
      if (user.ownerId !== selectedOwnerId) {
        return { success: false, message: 'Invalid Garage ID for this account.' };
      }
    }

    // Check account status
    if (user.status === 'inactive') {
      return { success: false, message: 'Your account has been deactivated. Please contact the owner.' };
    }
    if (user.status === 'deleted') {
      return { success: false, message: 'This account no longer exists.' };
    }

    // 2. Check password
    if (user.password !== password) {
      return { success: false, message: 'Invalid password. Please try again.' };
    }

    // 3. Check Garage ID
    if (selectedOwnerId && user.ownerId !== selectedOwnerId && user.role !== 'coder') {
      return { 
        success: false, 
        message: `This account belongs to Garage ID: ${user.ownerId}. Please select the correct garage.` 
      };
    }
    
    const { password: _, ...safeUser } = user;
    
    // Allow coder to act as any garage they select
    if (safeUser.role === 'coder' && selectedOwnerId) {
      safeUser.ownerId = selectedOwnerId;
    }
    
    setCurrentUser(safeUser);
    localStorage.setItem('garage_current_user', JSON.stringify(safeUser));
    return { success: true, user: safeUser };
  }, [getAccounts]);

  const logout = useCallback(() => {
    setCurrentUser(null);
    localStorage.removeItem('garage_current_user');
  }, []);

  const generateNextGarageId = useCallback(() => {
    const accounts = getAccounts();
    let maxSeq = 0;
    accounts.forEach(acc => {
      if (acc.ownerId && acc.ownerId.match(/^\d{2}-\d{4}-\d{2}$/)) {
        const parts = acc.ownerId.split('-');
        const seq = parseInt(parts[1], 10);
        if (seq > maxSeq) maxSeq = seq;
      }
    });
    const nextSeq = maxSeq === 0 ? 1 : maxSeq + 1;
    const year = new Date().getFullYear().toString().slice(-2);
    return `${year}-${String(nextSeq).padStart(4, '0')}-01`;
  }, [getAccounts]);

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
      mechanic: ['repairs_view', 'repairs_manage', 'inventory_view', 'vehicles_view'],
      receptionist: ['customers_manage', 'vehicles_manage', 'appointments_manage', 'repairs_view'],
      cashier: ['billing_manage', 'customers_view'],
      storekeeper: ['inventory_view', 'inventory_manage'],
      inventoryManager: ['inventory_manage', 'inventory_view', 'billing_manage'],
      manager: ['repairs_manage', 'appointments_manage', 'customers_manage', 'vehicles_manage', 'material_requests_manage', 'tracker_view', 'attendance_manage'],
      customer: ['my_data_view'],
      coder: ['all']
    };

    let finalOwnerId = ownerId;
    if (role === 'admin' && !finalOwnerId) {
      // Auto-generate Garage ID using sequence
      let maxSeq = 0;
      accounts.forEach(acc => {
        if (acc.ownerId && acc.ownerId.match(/^\d{2}-\d{4}-\d{2}$/)) {
          const parts = acc.ownerId.split('-');
          const seq = parseInt(parts[1], 10);
          if (seq > maxSeq) maxSeq = seq;
        }
      });
      const nextSeq = maxSeq === 0 ? 1 : maxSeq + 1;
      const year = new Date().getFullYear().toString().slice(-2);
      finalOwnerId = `${year}-${String(nextSeq).padStart(4, '0')}-01`;
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

  const value = useMemo(() => ({
    currentUser, login, logout, register, getAccounts, 
    updateAccountInfo, updateOtherAccount, deleteAccount, updateGarageInfo, verifyPassword,
    requestPasswordReset, verifyResetOtp, resetPassword, generateNextGarageId,
    addProfilePhoto, removeProfilePhoto, reorderProfilePhotos
  }), [
    currentUser, login, logout, register, getAccounts, 
    updateAccountInfo, updateOtherAccount, deleteAccount, updateGarageInfo, verifyPassword,
    requestPasswordReset, verifyResetOtp, resetPassword, generateNextGarageId,
    addProfilePhoto, removeProfilePhoto, reorderProfilePhotos
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
