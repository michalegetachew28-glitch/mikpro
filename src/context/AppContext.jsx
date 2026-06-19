import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { translations } from '../data/translations';
import { formatEthiopianDate } from '../utils/ethiopianDate';

const AppContext = createContext();
const DIAG = '[AppContext]';

export const useAppContext = () => useContext(AppContext);

// ── IndexedDB Media Store ──────────────────────────────────────────────────
const DB_NAME = 'GarageMediaDB';
const DB_VERSION = 1;
const STORE_NAME = 'media';

const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
};

const saveMedia = async (id, data) => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(data, id);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error("IndexedDB Save Failed", err);
  }
};

const getMedia = async (id) => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(id);
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn("IndexedDB Get Failed", id, err);
    return null;
  }
};

/** Keeps list collections as arrays of plain objects; logs and repairs corruption. */
function ensureEntityArray(data, label = 'collection') {
  if (!Array.isArray(data)) {
    console.error(`${DIAG} Invalid ${label}: expected array, got`, typeof data, data);
    return [];
  }
  const cleaned = [];
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    if (item != null && typeof item === 'object' && !Array.isArray(item)) {
      cleaned.push(item);
    } else if (item != null) {
      console.warn(`${DIAG} Dropped invalid entry in ${label} at index ${i}`);
    }
  }
  return cleaned;
}

export const AppProvider = ({ children }) => {
  const { currentUser, updateAccountInfo } = useAuth();

  const [customers, setCustomers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [repairs, setRepairs] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [staff, setStaff] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [messages, setMessages] = useState([]);
  const [groups, setGroups] = useState([]);
  const [activeTrackers, setActiveTrackers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [adminPaymentDetails, setAdminPaymentDetails] = useState([]);
  const [mechanicPaymentDetails, setMechanicPaymentDetails] = useState([]);
  const [bonuses, setBonuses] = useState([]);
  const [billingSettings, setBillingSettings] = useState({
    currency: 'ETB',
    taxRate: 15,
    exchangeRate: 55 // ETB per USD (Mock)
  });
  const [activityLogs, setActivityLogs] = useState([]);
  const [materialRequests, setMaterialRequests] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [language, setLanguage] = useState('en');
  const [dataLoaded, setDataLoaded] = useState(false);
  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);
  const [salaryPayments, setSalaryPayments] = useState([]);
  const [salaries, setSalaries] = useState([]);
  const [activeChatContact, setActiveChatContact] = useState(null);
  const [callState, setCallState] = useState('idle'); // idle, calling, incoming, connected
  const [activeCall, setActiveCall] = useState(null); // { contact, startTime, isOutgoing, id, type }
  const [callSubStatus, setCallSubStatus] = useState('idle'); // calling, delivered, ringing
  const [confirmingAction, setConfirmingAction] = useState(null); // { label, onConfirm }
  const [darkMode, setDarkMode] = useState(localStorage.getItem('garage_darkMode') === 'true');
  const [typingStatus, setTypingStatus] = useState({}); // recipientId -> { isTyping, senderName }
  const [userPresence, setUserPresence] = useState({}); // userId -> { online: boolean, lastSeen: timestamp }
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [privacySettings, setPrivacySettings] = useState({
    lastSeen: 'everyone', // everyone, contacts, nobody
    readReceipts: true
  });
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [groupCalls, setGroupCalls] = useState({}); // groupId -> { type, participants: [], startTime, activeSpeakers: [] }
  const [callHistory, setCallHistory] = useState([]);

  // Real-time Broadcast Channel for cross-tab 'socket-like' synchronization
  const syncChannel = useMemo(() => {
    try {
      if (typeof window !== 'undefined' && window.BroadcastChannel) {
        return new window.BroadcastChannel('garage_sync_channel');
      }
    } catch (err) {
      console.warn("BroadcastChannel initialization failed", err);
    }
    return null;
  }, []);

  // Custom wrapper to prevent Channel is closed errors
  const broadcastData = useCallback((payload) => {
    try {
      if (syncChannel) syncChannel.postMessage(payload);
    } catch (e) {
      console.warn("[Sync] Broadcast failed (channel might be closed)", e);
    }
  }, [syncChannel]);

  const showToast = useCallback((message, type = 'info', link = null) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type, link }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);



  // Memoized prefix to ensure stability
  const userPrefix = useMemo(() => {
    if (!currentUser || !currentUser.ownerId) return 'garage_guest_';
    return `garage_${currentUser.ownerId}_`;
  }, [currentUser?.ownerId]);

  // Debug logging system
  const logDataOp = useCallback((op, key, details) => {
    const logs = JSON.parse(localStorage.getItem('garage_debug_logs') || '[]');
    const newLog = {
      time: new Date().toISOString(),
      user: currentUser?.id,
      op,
      key,
      details
    };
    localStorage.setItem('garage_debug_logs', JSON.stringify([newLog, ...logs].slice(0, 50)));
  }, [currentUser?.id]);

  const safeSave = (key, data, force = false) => {
    if (!currentUser || !isInitialLoadComplete) return;

    if (!Array.isArray(data)) {
      logDataOp('SAVE_ERROR', key, `Aborted: Data for ${key} is not an array.`);
      console.error(`SafeSave: Aborted. Data for ${key} must be an array.`);
      return;
    }

    let cleanData = data.filter(item => item && typeof item === 'object');
    if (cleanData.length !== data.length) {
      logDataOp('SAVE_WARNING', key, `Filtered out ${data.length - cleanData.length} invalid items.`);
    }

    // Strip heavy media fileData before saving to localStorage — stored in IndexedDB instead
    if (key === 'messages') {
      cleanData = cleanData.map(m => {
        if (m.type && m.type !== 'text' && m.fileData) {
          const { fileData, ...rest } = m;
          return rest;
        }
        return m;
      });
    }

    const fullKey = userPrefix + key;
    try {
      const existing = localStorage.getItem(fullKey);

      let dataToSave = cleanData;
      if (key === 'notifications' && cleanData.length > 50) {
        dataToSave = cleanData.slice(0, 50);
      }

      if (!force && dataToSave.length === 0 && existing && existing !== '[]' && existing !== 'null') {
        logDataOp('SAVE_REJECTED', key, `Refused to wipe ${fullKey}. Existing data preserved.`);
        console.warn(`SafeSave: Prevented overwriting ${fullKey} with empty array.`);
        return;
      }

      if (existing && existing !== 'null' && existing !== 'undefined' && existing !== '[]') {
        localStorage.setItem(fullKey + '_backup', existing);
      }

      const payload = JSON.stringify(dataToSave);
      localStorage.setItem(fullKey, payload);
      logDataOp('SAVE_SUCCESS', key, `Saved ${dataToSave.length} items to ${fullKey}`);
    } catch (e) {
      logDataOp('SAVE_FAIL_STORAGE', key, `Critical Storage Failure: ${e.message}`);
      console.error(`SafeSave: Failed to write ${fullKey}`, e);
    }
  };

  const safeLoad = (key, defaultValue = []) => {
    const fullKey = userPrefix + key;
    const saved = localStorage.getItem(fullKey);
    const backup = localStorage.getItem(fullKey + '_backup');

    if (!saved) {
      logDataOp('LOAD_MISSING', key, `No data at ${fullKey}`);
      return defaultValue;
    }

    try {
      const parsed = JSON.parse(saved);
      if (parsed === null || parsed === undefined) return defaultValue;
      if (!Array.isArray(parsed) && Array.isArray(defaultValue)) return defaultValue; // enforce array type
      return parsed;
    } catch (e) {
      logDataOp('LOAD_ERROR', key, `Corruption in ${fullKey}. Attempting backup.`);
      // Attempt recovery from backup
      if (backup) {
        try {
          const parsedBackup = JSON.parse(backup);
          logDataOp('RECOVERY_SUCCESS', key, `Recovered ${key} from backup`);
          return parsedBackup;
        } catch (be) {
          logDataOp('RECOVERY_FAILED', key, `Backup for ${key} also corrupted`);
        }
      }
      return defaultValue;
    }
  };

  // Load data whenever user changes
  useEffect(() => {
    setIsInitialLoadComplete(false);
    setDataLoaded(false);

    if (!currentUser) {
      setCustomers([]);
      setVehicles([]);
      setRepairs([]);
      setInventory([]);
      setStaff([]);
      setAppointments([]);
      setNotifications([]);
      setMessages([]);
      setGroups([]);
      setBlockedUsers([]);
      setActiveTrackers([]);
      setInvoices([]);
      setAdminPaymentDetails([]);
      setMechanicPaymentDetails([]);
      setBonuses([]);
      setSalaries([]);
      setSalaryPayments([]);
      setLanguage(localStorage.getItem('garage_language') || 'en');
      return;
    }

    // --- Legacy Data Bridge: 000001 to 0001 migration ---
    if (currentUser.ownerId === '0001' && !localStorage.getItem('garage_0001_customers')) {
      const legacyPrefix = 'garage_000001_';
      const keys = ['customers', 'vehicles', 'repairs', 'inventory', 'staff', 'appointments', 'notifications', 'messages', 'trackers', 'invoices', 'adminPaymentDetails', 'billingSettings', 'metadata', 'materialRequests'];
      keys.forEach(k => {
        const oldVal = localStorage.getItem(legacyPrefix + k);
        if (oldVal) {
          localStorage.setItem('garage_0001_' + k, oldVal);
          localStorage.setItem('garage_0001_' + k + '_backup', oldVal);
          logDataOp('LEGACY_MIGRATION', k, 'Migrated from 000001 to 0001');
        }
      });
    }

    logDataOp('INIT_LOAD_START', 'all', `Loading data for user ${currentUser.id}`);

    // Load everything synchronously to avoid state update races
    const loadedCustomers = safeLoad('customers');
    const loadedVehicles = safeLoad('vehicles');
    const loadedRepairs = safeLoad('repairs');
    const loadedInventory = safeLoad('inventory');
    const loadedStaff = safeLoad('staff');
    const loadedAppointments = safeLoad('appointments');
    const loadedNotifications = safeLoad('notifications');
    const loadedMessages = safeLoad('messages');
    const loadedGroups = safeLoad('groups');
    const loadedBlocked = safeLoad('blockedUsers');
    const loadedTrackers = safeLoad('trackers');
    const loadedInvoices = safeLoad('invoices');
    const loadedPaymentDetails = safeLoad('adminPaymentDetails');
    const loadedMechanicPaymentDetails = safeLoad('mechanicPaymentDetails');
    const loadedBonuses = safeLoad('bonuses');
    const loadedBillingSettingsRaw = safeLoad('billingSettings', [{ currency: 'ETB', taxRate: 15, exchangeRate: 55 }]);
    const loadedBillingSettings = Array.isArray(loadedBillingSettingsRaw) ? loadedBillingSettingsRaw[0] : loadedBillingSettingsRaw;
    const loadedActivityLogs = safeLoad('activityLogs');
    const loadedMaterialRequests = safeLoad('materialRequests');
    const loadedAttendance = safeLoad('attendance');
    const loadedSalaries = safeLoad('salaries');
    const loadedSalaryPayments = safeLoad('salaryPayments');

    setCustomers(ensureEntityArray(loadedCustomers, 'customers'));
    setVehicles(ensureEntityArray(loadedVehicles, 'vehicles'));
    setRepairs(ensureEntityArray(loadedRepairs, 'repairs'));
    setInventory(ensureEntityArray(loadedInventory, 'inventory'));
    setStaff(ensureEntityArray(loadedStaff, 'staff'));
    setAppointments(ensureEntityArray(loadedAppointments, 'appointments'));
    setNotifications(ensureEntityArray(loadedNotifications, 'notifications'));
    // Load messages then asynchronously enrich with IndexedDB media data
    const rawMsgs = ensureEntityArray(loadedMessages, 'messages');
    setMessages(rawMsgs); // Set immediately so UI doesn't wait
    Promise.all(rawMsgs.map(async m => {
      if (m.type && m.type !== 'text' && !m.fileData) {
        const data = await getMedia(m.id);
        if (data) return { ...m, fileData: data };
      }
      return m;
    })).then(enriched => setMessages(enriched)).catch(() => { });
    setGroups(ensureEntityArray(loadedGroups, 'groups'));

    setInvoices(ensureEntityArray(loadedInvoices, 'invoices'));
    setAdminPaymentDetails(ensureEntityArray(loadedPaymentDetails, 'adminPaymentDetails'));
    setMechanicPaymentDetails(ensureEntityArray(loadedMechanicPaymentDetails, 'mechanicPaymentDetails'));
    setBonuses(ensureEntityArray(loadedBonuses, 'bonuses'));
    setBillingSettings(loadedBillingSettings);
    setActivityLogs(ensureEntityArray(loadedActivityLogs, 'activityLogs'));
    setMaterialRequests(ensureEntityArray(loadedMaterialRequests, 'materialRequests'));
    setAttendance(ensureEntityArray(loadedAttendance, 'attendance'));
    setSalaries(ensureEntityArray(loadedSalaries, 'salaries'));
    setSalaryPayments(ensureEntityArray(loadedSalaryPayments, 'salaryPayments'));

    setLanguage(localStorage.getItem('garage_language') || 'en');

    // Recovery Logic: Ensure the Garage Name is preserved from metadata if missing in currentUser
    const metaKey = `garage_${currentUser.ownerId}_metadata`;
    let savedMeta = {};
    try {
      savedMeta = JSON.parse(localStorage.getItem(metaKey) || '{}') || {};
      if (typeof savedMeta !== 'object' || Array.isArray(savedMeta)) {
        console.warn(`${DIAG} Metadata at ${metaKey} was not an object; ignoring.`);
        savedMeta = {};
      }
    } catch (metaErr) {
      console.error(`${DIAG} Corrupt metadata JSON at ${metaKey}; skipping sync.`, metaErr);
    }
    if (savedMeta.garageName && currentUser.garageName !== savedMeta.garageName) {
      try {
        updateAccountInfo({ garageName: savedMeta.garageName });
      } catch (syncErr) {
        console.error(`${DIAG} updateAccountInfo after metadata read failed`, syncErr);
      }
    }

    // Finalize initialization
    setDataLoaded(true);
    setIsInitialLoadComplete(true);
    logDataOp('INIT_LOAD_COMPLETE', 'all', `Session ready for ${userPrefix}`);

    // Proactive Data Recovery: Removed at user request to avoid confusion for new admins
  }, [currentUser?.id, userPrefix]);

  // Unified persistence effect - prevents fragmented saves and race conditions
  useEffect(() => {
    if (isInitialLoadComplete && currentUser) {
      // Debounce logic could go here if needed, but for now we just save
      safeSave('customers', customers);
      safeSave('vehicles', vehicles);
      safeSave('repairs', repairs);
      safeSave('inventory', inventory);
      safeSave('staff', staff);
      safeSave('appointments', appointments);
      safeSave('notifications', notifications);
      safeSave('messages', messages);
      safeSave('groups', groups);
      safeSave('blockedUsers', blockedUsers);
      safeSave('trackers', activeTrackers);
      console.log(`[DEBUG Sync] Saved activeTrackers to localStorage:`, activeTrackers?.length || 0);
      safeSave('invoices', invoices);
      safeSave('adminPaymentDetails', adminPaymentDetails);
      safeSave('mechanicPaymentDetails', mechanicPaymentDetails);
      safeSave('bonuses', bonuses);
      safeSave('billingSettings', [billingSettings]); // Wrap in array for safeSave
      safeSave('activityLogs', activityLogs);
      safeSave('materialRequests', materialRequests);
      safeSave('attendance', attendance);
      safeSave('salaries', salaries);
      safeSave('salaryPayments', salaryPayments);
    }
  }, [
    customers, vehicles, repairs, inventory, staff,
    appointments, notifications, messages, groups, activeTrackers,
    invoices, adminPaymentDetails, mechanicPaymentDetails, bonuses, billingSettings, activityLogs, materialRequests, attendance, salaries, salaryPayments,
    isInitialLoadComplete, currentUser
  ]);

  const t = useCallback((key) => {
    const langDict = translations[language] || translations['en'];
    return langDict[key] || translations['en'][key] || key;
  }, [language]);

  const formatDate = useCallback((dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;

      const options = { day: 'numeric', month: 'long', year: 'numeric' };
      if (language === 'am') {
        return formatEthiopianDate(dateStr, 'am');
      }
      return new Intl.DateTimeFormat('en-US', options).format(date);
    } catch (e) {
      return dateStr;
    }
  }, [language]);

  const formatTime = useCallback((dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleTimeString(language === 'am' ? 'am-ET' : 'en-US', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return dateStr;
    }
  }, [language]);

  const toggleDarkMode = useCallback(() => setDarkMode(prev => !prev), []);

  const getSetterMap = useCallback(() => {
    return {
      customers: setCustomers,
      vehicles: setVehicles,
      repairs: setRepairs,
      inventory: setInventory,
      staff: setStaff,
      appointments: setAppointments,
      notifications: setNotifications,
      messages: setMessages,
      groups: setGroups,
      trackers: setActiveTrackers,
      invoices: setInvoices,
      adminPaymentDetails: setAdminPaymentDetails,
      mechanicPaymentDetails: setMechanicPaymentDetails,
      bonuses: setBonuses,
      billingSettings: setBillingSettings,
      activityLogs: setActivityLogs,
      materialRequests: setMaterialRequests,
      attendance: setAttendance,
      salaries: setSalaries,
      salaryPayments: setSalaryPayments
    };
  }, []);

  // Sync data across tabs (Real-time simulation)
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (!e.key || !currentUser || e.newValue === e.oldValue) return; // Prevent local loop

      const keys = ['customers', 'vehicles', 'repairs', 'inventory', 'staff', 'appointments', 'notifications', 'messages', 'groups', 'trackers', 'invoices', 'adminPaymentDetails', 'mechanicPaymentDetails', 'bonuses', 'billingSettings', 'activityLogs', 'materialRequests', 'attendance', 'salaries', 'salaryPayments'];
      keys.forEach(k => {
        if (e.key === userPrefix + k) {
          const setterMap = getSetterMap();
          if (setterMap[k]) {
            try {
              if (k === 'billingSettings') {
                const val = JSON.parse(e.newValue || '[{}]');
                setterMap[k](Array.isArray(val) ? val[0] : val);
              } else {
                const parsedData = JSON.parse(e.newValue || '[]');
                const normalized = ensureEntityArray(parsedData, k);
                if (normalized.length === 0 && parsedData != null && !Array.isArray(parsedData)) {
                  console.error(`${DIAG} Cross-tab sync rejected non-array for ${k}`);
                }
                if (k === 'trackers') {
                  console.log("[DEBUG Sync] Received storage event for trackers. Updating state to:", normalized);
                }
                setterMap[k](normalized);
              }
            } catch (err) {
              console.warn(`[Sync] Failed to parse cross-tab data for ${k}`);
            }
          }
        }
      });

      if (e.key === 'garage_language') {
        setLanguage(e.newValue || 'en');
      }

      // Real-time Chat Signals (Typing, Seen, Presence)
      if (e.key === 'garage_realtime_signal' && e.newValue) {
        try {
          const signal = JSON.parse(e.newValue);
          if (blockedUsers.includes(String(signal.from))) return; // Ignore blocked users

          if (signal.type === 'TYPING' && signal.to === currentUser?.id) {
            setTypingStatus(prev => ({
              ...prev,
              [signal.from]: { isTyping: signal.value, senderName: signal.senderName, timestamp: Date.now() }
            }));
            if (signal.value) {
              setTimeout(() => {
                setTypingStatus(prev => {
                  const current = prev[signal.from];
                  if (current && Date.now() - current.timestamp >= 4500) {
                    const newState = { ...prev };
                    delete newState[signal.from];
                    return newState;
                  }
                  return prev;
                });
              }, 5000);
            }
          }
          if (signal.type === 'SEEN') {
            console.log(`${DIAG} SEEN Signal Received:`, signal);
            const isTargetedToMe = signal.isGroup 
              ? groups.some(g => String(g.id) === String(signal.to))
              : signal.to === currentUser?.id;

            if (isTargetedToMe) {
              setMessages(prev => {
                let changed = false;
                const newList = prev.map(m => {
                  const belongsToConv = signal.isGroup
                    ? String(m.recipientId) === String(signal.to)
                    : (m.senderId === currentUser.id && m.recipientId === signal.from);
                  
                  const isMyMessageSeenByOther = belongsToConv && m.senderId === currentUser.id && m.status !== 'seen';
                  
                  if (isMyMessageSeenByOther) {
                    changed = true;
                    return { ...m, status: 'seen', read: true, seen_at: signal.time };
                  }
                  return m;
                });
                if (changed) console.log(`${DIAG} Updated messages to SEEN via localStorage signal`);
                return newList;
              });
            }
          }
          if (signal.type === 'MARK_READ_SIGNAL') {
             const { fromId, toId, isGroup } = signal;
             setMessages(prev => prev.map(m => {
                const matchesRecipient = isGroup ? String(m.recipientId) === String(toId) : (String(m.senderId) === String(toId) && String(m.recipientId) === String(fromId));
                if (matchesRecipient && String(m.senderId) !== String(fromId) && m.status !== 'seen') {
                   return { ...m, status: 'seen', read: true, seen_at: new Date().toISOString() };
                }
                return m;
             }));
          }
          if (signal.type === 'PRESENCE') {
            setUserPresence(prev => ({
              ...prev,
              [signal.from]: { online: true, lastSeen: signal.time }
            }));
          }
          if (signal.type === 'OFFLINE') {
            setUserPresence(prev => ({
              ...prev,
              [signal.from]: { online: false, lastSeen: signal.time }
            }));
          }
          if (signal.type === 'NOTIFICATION' && (signal.to === 'ALL' || signal.to === currentUser?.id)) {
            showToast(signal.message, signal.notifType || 'info', signal.link || '/live-tracking');
            // Play a standard alert sound for urgent requests
            if (signal.notifType === 'danger') {
              try {
                const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
                if (!AudioCtxClass) return;
                const audioCtx = new AudioCtxClass();
                const oscillator = audioCtx.createOscillator();
                const gainNode = audioCtx.createGain();
                oscillator.connect(gainNode);
                gainNode.connect(audioCtx.destination);
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
                gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
                oscillator.start();
                oscillator.stop(audioCtx.currentTime + 0.5);
              } catch (e) {
                console.warn("Audio alert failed", e);
              }
            }
          }

          // --- Group Call Signaling ---
          if (signal.type === 'GROUP_CALL_STARTED') {
            setGroupCalls(prev => ({
              ...prev,
              [signal.groupId]: {
                type: signal.callType,
                startTime: signal.startTime,
                participants: signal.participants || [signal.from],
                activeSpeakers: []
              }
            }));
            addNotification(
              `Group Call started in ${signal.groupName}`,
              'info',
              'ALL',
              `/chat/${signal.groupId}`,
              signal.from
            );
          }

          if (signal.type === 'GROUP_CALL_JOINED') {
            setGroupCalls(prev => {
              const call = prev[signal.groupId];
              if (!call) return prev;
              if (call.participants.includes(signal.from)) return prev;
              return {
                ...prev,
                [signal.groupId]: {
                  ...call,
                  participants: [...call.participants, signal.from]
                }
              };
            });
          }

          if (signal.type === 'GROUP_CALL_LEFT') {
            setGroupCalls(prev => {
              const call = prev[signal.groupId];
              if (!call) return prev;
              const newParticipants = call.participants.filter(p => p !== signal.from);
              if (newParticipants.length === 0) {
                const newState = { ...prev };
                delete newState[signal.groupId];
                return newState;
              }
              return {
                ...prev,
                [signal.groupId]: { ...call, participants: newParticipants }
              };
            });
          }

          if (signal.type === 'GROUP_MODERATION' && signal.targetId === currentUser?.id) {
            if (signal.action === 'MUTE') {
              showToast("You have been muted by an admin", "warning");
              // Logic to actually mute local track will be in the hook/overlay
            }
            if (signal.action === 'KICK') {
              showToast("You have been removed from the call", "danger");
              leaveGroupCall(signal.groupId);
            }
          }

        } catch (err) { }
      }

      // Forced Sync Signal from bypassing batching
      if (e.key === 'garage_force_sync' && e.newValue) {
        try {
          const sync = JSON.parse(e.newValue);
          if (sync.collection) {
            const raw = localStorage.getItem(userPrefix + sync.collection);
            const setterMap = getSetterMap();
            if (raw && setterMap[sync.collection]) {
              console.log(`[DEBUG Sync] FORCED SYNC applied to ${sync.collection}`);
              try {
                setterMap[sync.collection](ensureEntityArray(JSON.parse(raw), sync.collection));
              } catch (fe) {
                console.error(`${DIAG} Forced sync failed`, fe);
              }
            }
          }
        } catch (e) {
          console.error('Forced sync parse error', e);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Broadcast Presence
    if (currentUser) {
      localStorage.setItem('garage_realtime_signal', JSON.stringify({ type: 'PRESENCE', from: currentUser.id, time: Date.now() }));

      // Cleanup offline signal
      const handleUnload = () => {
        localStorage.setItem('garage_realtime_signal', JSON.stringify({ type: 'OFFLINE', from: currentUser.id, time: Date.now() }));
      };
      window.addEventListener('beforeunload', handleUnload);
      window.addEventListener('unload', handleUnload); // Fallback
      return () => {
        window.removeEventListener('storage', handleStorageChange);
        window.removeEventListener('beforeunload', handleUnload);
        window.removeEventListener('unload', handleUnload);
      };
    }

    return () => window.removeEventListener('storage', handleStorageChange);
  }, [userPrefix, currentUser]);

  // Broadcast Channel Listener
  useEffect(() => {
    const handleBroadcast = (event) => {
      const { type, collection, data, id, updates, ownerId: senderOwnerId } = event.data;

      // Security: Only sync data from the same garage (ownerId)
      // Exception: Allow trackers to sync even if sender ownerId is missing (Guest requests)
      const isRoadsideSync = collection === 'trackers';
      if (senderOwnerId && currentUser?.ownerId && senderOwnerId !== currentUser.ownerId && !isRoadsideSync) {
        console.log(`[Sync] Ignored ${type} for ${collection} due to ownerId mismatch: ${senderOwnerId} vs ${currentUser.ownerId}`);
        return;
      }

      const setterMap = getSetterMap();
      if (!setterMap[collection]) return;

      if (type === 'ADD') {
        if (!data || typeof data !== 'object') {
          console.error(`${DIAG} Broadcast ADD ignored: invalid payload for ${collection}`, data);
          return;
        }

        if (collection === 'messages' && data.type && data.type !== 'text' && !data.fileData) {
          // Media message received without fileData — fetch from shared IndexedDB
          // Retry logic to handle race condition where message arrives before IDB save completes
          const fetchMediaWithRetry = async (id, retries = 5) => {
            for (let i = 0; i < retries; i++) {
              const mediaData = await getMedia(id);
              if (mediaData) return mediaData;
              await new Promise(r => setTimeout(r, 200 * (i + 1))); // Exponential backoff
            }
            return null;
          };

          fetchMediaWithRetry(data.id).then(mediaData => {
            const msgWithMedia = mediaData ? { ...data, fileData: mediaData } : data;
            setterMap[collection](prev => {
              const list = ensureEntityArray(prev, collection);
              if (list.some(item => String(item?.id) === String(msgWithMedia.id))) {
                // Update existing if found
                return list.map(item => String(item?.id) === String(msgWithMedia.id) ? msgWithMedia : item);
              }
              return [...list, msgWithMedia];
            });
          }).catch(() => {
            setterMap[collection](prev => {
              const list = ensureEntityArray(prev, collection);
              if (list.some(item => String(item?.id) === String(data.id))) return list;
              return [...list, data];
            });
          });
        } else {
          setterMap[collection](prev => {
            const list = ensureEntityArray(prev, collection);
            if (list.some(item => String(item?.id) === String(data.id))) return list;
            return [...list, data];
          });
        }

        // --- NEW: Trigger notification for Recipient ---
        if (collection === 'messages') {
          const isTargetedToMe = String(data?.recipientId) === String(currentUser?.id);
          const isInMyGroup = groups.some(g => String(g.id) === String(data?.recipientId) && g.members?.includes(currentUser?.id));

          if (isTargetedToMe || isInMyGroup) {
            // Only notify if not from me (might happen in groups)
            if (String(data.senderId) !== String(currentUser?.id)) {
              // Send DELIVERED signal back to sender
              syncChannel.postMessage({
                type: 'STATUS_UPDATE',
                collection: 'messages',
                id: data.id,
                updates: { status: 'delivered', time: new Date().toISOString() },
                ownerId: currentUser?.ownerId
              });

              let notifText = '';
              if (data.type === 'audio') notifText = `🎤 ${data.senderName} sent a voice message`;
              else if (data.type === 'image') notifText = `📷 ${data.senderName} sent a photo`;
              else if (data.type === 'video') notifText = `🎥 ${data.senderName} sent a video`;
              else notifText = `${data.senderName}: ${data.text?.substring(0, 30)}${data.text?.length > 30 ? '...' : ''}`;

              // senderId for notification should be the person TO CLEAR (sender or group)
              const clearId = isInMyGroup ? data.recipientId : data.senderId;
              addNotification(notifText, 'message', clearId, '/dashboard', clearId);
            }
          }
        }
      } else if (type === 'UPDATE') {
        setterMap[collection](prev => {
          const list = ensureEntityArray(prev, collection);
          return list.map(item =>
            String(item?.id) === String(id) ? { ...item, ...(updates && typeof updates === 'object' ? updates : {}) } : item
          );
        });
      } else if (type === 'REFRESH') {
        // Full collection refresh
        const raw = localStorage.getItem(userPrefix + collection);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            setterMap[collection](ensureEntityArray(parsed, collection));
          } catch (parseErr) {
            console.error(`${DIAG} Broadcast REFRESH parse failed for ${collection}`, parseErr);
          }
        }
      } else if (type === 'STATUS_UPDATE' && collection === 'messages') {
        const statusOrder = { sending: 0, sent: 1, delivered: 2, seen: 3 };
        setterMap[collection](prev => {
          const list = ensureEntityArray(prev, collection);
          const newStatusVal = statusOrder[updates.status] ?? -1;

          if (id) {
            return list.map(item => {
              if (String(item.id) !== String(id)) return item;
              const currentStatusVal = statusOrder[item.status] ?? -1;
              if (newStatusVal <= currentStatusVal) return item;
              console.log(`${DIAG} Status Transition [${item.id}]: ${item.status} -> ${updates.status}`);
              return { ...item, status: updates.status, read: updates.status === 'seen', seen_at: updates.status === 'seen' ? (updates.time || new Date().toISOString()) : item.seen_at };
            });
          } else if (updates.senderId && updates.recipientId) {
            let updatedCount = 0;
            const newList = list.map(item => {
              const matchesContact = updates.isGroup
                ? String(item.recipientId) === String(updates.senderId)
                : (String(item.senderId) === String(updates.senderId) && String(item.recipientId) === String(updates.recipientId)) ||
                  (String(item.senderId) === String(updates.recipientId) && String(item.recipientId) === String(updates.senderId));

              if (!matchesContact) return item;

              const isTargetOfAction = updates.isGroup
                ? (String(item.senderId) !== String(updates.userId))
                : (String(item.recipientId) === String(updates.userId || updates.senderId));
              
              if (!isTargetOfAction && updates.status === 'seen') return item;

              const currentStatusVal = statusOrder[item.status] ?? -1;
              if (newStatusVal <= currentStatusVal) return item;
              updatedCount++;
              return { ...item, status: updates.status, read: updates.status === 'seen', seen_at: updates.status === 'seen' ? (updates.time || new Date().toISOString()) : item.seen_at };
            });
            if (updatedCount > 0) console.log(`${DIAG} Bulk Status Transition: ${updatedCount} messages to ${updates.status}`);
            return newList;
          }
          return list;
        });
      }

      // Automatically acknowledge delivery for messages sent to me or my groups
      if (type === 'ADD' && collection === 'messages') {
        const isTargetedToMe = String(data?.recipientId) === String(currentUser?.id);
        const isGroupIMemberOf = groups.some(g => String(g.id) === String(data?.recipientId) && g.members?.includes(currentUser?.id));

        if ((isTargetedToMe || isGroupIMemberOf) && String(data.senderId) !== String(currentUser?.id)) {
          setTimeout(() => {
            syncChannel.postMessage({
              type: 'STATUS_UPDATE',
              collection: 'messages',
              id: data.id,
              updates: { status: 'delivered' },
              ownerId: currentUser?.ownerId
            });
          }, 800);
        }
      }
    };

    syncChannel.onmessage = handleBroadcast;
  }, [syncChannel, currentUser?.ownerId, userPrefix, getSetterMap]);

  useEffect(() => { localStorage.setItem('garage_language', language); }, [language]);

  useEffect(() => {
    localStorage.setItem('garage_darkMode', darkMode);
    if (darkMode) {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  }, [darkMode]);

  const logActivity = useCallback((action, details) => {
    if (!currentUser) return;
    const newLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      timestamp: new Date().toISOString(),
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      action,
      details
    };
    setActivityLogs(prev => [newLog, ...prev].slice(0, 500)); // Keep last 500 logs
  }, [currentUser]);

  const addNotification = useCallback((message, type = 'info', recipientId = null, link = null, senderId = null) => {
    setNotifications(prev => {
      // Deduplication: Don't add if same message to same recipient was added in last 5 seconds
      const isDuplicate = prev.some(n =>
        n.message === message &&
        String(n.recipientId) === String(recipientId) &&
        (Date.now() - new Date(n.time).getTime() < 5000)
      );
      if (isDuplicate) return prev;

      const newNotif = {
        id: `n${Date.now()}`,
        message,
        type,
        recipientId: recipientId ? String(recipientId) : null,
        time: new Date().toISOString(),
        read: false,
        link,
        senderId: senderId ? String(senderId) : null
      };

      // Real-time broadcast for notification toast
      if (type !== 'message') {
        localStorage.setItem('garage_realtime_signal', JSON.stringify({
          type: 'NOTIFICATION',
          to: recipientId ? String(recipientId) : 'ALL',
          message,
          notifType: type,
          link,
          time: Date.now()
        }));
      }

      return [newNotif, ...prev];
    });
  }, [showToast]);

  const handleRepairStatusChange = useCallback((repair, newStatus, mId) => {
    if (!repair || typeof repair !== 'object') {
      console.warn(`${DIAG} handleRepairStatusChange: invalid repair`, repair);
      return;
    }
    const vlist = ensureEntityArray(vehicles, 'vehicles');
    const vehicle = vlist.find(v => v && (v.id === repair.id || v.id === repair.vehicleId)); // Robust matching
    const ownerId = vehicle?.customerId;
    const vehicleName = vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : 'Vehicle';
    const link = '/repairs';

    if (mId) {
      if (newStatus !== 'completed') {
        addNotification(`${t('newJobAssigned')}: ${vehicleName}`, 'info', mId, link);
      }
    }

    const staffList = ensureEntityArray(staff, 'staff');

    if (newStatus === 'in-progress') {
      if (ownerId) addNotification(`${t('repairInProgress')}: ${vehicleName}`, 'success', ownerId, link);

      const admins = staffList.filter(s => s.role === 'admin');
      const notifyIds = new Set(
        [...admins.map(a => a?.id).filter(Boolean), currentUser?.ownerId].map(v => (v != null ? String(v) : '')).filter(Boolean)
      );

      notifyIds.forEach(id => {
        if (id && id !== String(mId ?? '')) {
          addNotification(`Job Accepted by Mechanic: ${vehicleName}`, 'info', id, link);
        }
      });
    } else if (newStatus === 'completed') {
      if (ownerId) addNotification(`🎉 ${t('repairCompleted')}: ${vehicleName}`, 'success', ownerId, link);

      const admins = staffList.filter(s => s.role === 'admin');
      const notifyIds = new Set(
        [...admins.map(a => a?.id).filter(Boolean), currentUser?.ownerId].map(v => (v != null ? String(v) : '')).filter(Boolean)
      );

      notifyIds.forEach(id => {
        if (id) addNotification(`✅ Repair Completed: ${vehicleName}`, 'success', id, link);
      });
    }
  }, [vehicles, staff, currentUser?.ownerId, t, addNotification]);

  const updateItem = useCallback((collectionName, id, newData) => {
    const setterMap = getSetterMap();
    if (!setterMap[collectionName]) {
      console.error(`${DIAG} updateItem: unknown collection "${collectionName}"`);
      return;
    }
    if (id == null || id === '') {
      console.error(`${DIAG} updateItem: invalid id for ${collectionName}`);
      return;
    }
    if (!newData || typeof newData !== 'object' || Array.isArray(newData)) {
      console.error(`${DIAG} updateItem: newData must be a plain object`, newData);
      return;
    }

    try {
      // Intercept assignment or status changes for notifications
      if (collectionName === 'repairs') {
        const oldRepair = repairs.find(r => r && String(r.id) === String(id));
        if (oldRepair) {
          const isStatusChange = newData.status && newData.status !== oldRepair.status;
          const isMechanicAssignment = newData.mechanicId && newData.mechanicId !== oldRepair.mechanicId;

          if (isStatusChange || isMechanicAssignment) {
            handleRepairStatusChange(
              { ...oldRepair, ...newData },
              newData.status || oldRepair.status,
              newData.mechanicId || oldRepair.mechanicId
            );
          }

          // Sync with Live Tracker if it's a roadside job
          if (oldRepair.isRoadside || newData.isRoadside) {
            setActiveTrackers(prev => {
              const list = ensureEntityArray(prev, 'trackers');
              return list.map(t => {
                if (t && String(t.repairId) === String(id)) {
                  return {
                    ...t,
                    mechanicId: newData.mechanicId !== undefined ? newData.mechanicId : t.mechanicId,
                    status: (isMechanicAssignment && newData.mechanicId) ? 'assigned' : t.status
                  };
                }
                return t;
              });
            });
          }
        }
      }

      setterMap[collectionName](prev => {
        const list = ensureEntityArray(prev, collectionName);
        const idx = list.findIndex(item => item && String(item.id) === String(id));
        if (idx === -1) {
          console.warn(`${DIAG} updateItem: no row with id "${id}" in ${collectionName}; state unchanged.`);
          return list;
        }
        return list.map(item => (item && String(item.id) === String(id) ? { ...item, ...newData } : item));
      });

      broadcastData({
        type: 'UPDATE',
        collection: collectionName,
        id: id,
        updates: newData,
        ownerId: currentUser?.ownerId
      });

      // Log activity for significant updates
      if (['staff', 'repairs', 'inventory', 'billing'].includes(collectionName)) {
        logActivity(`Updated ${collectionName}`, `ID: ${id}`);
      }
    } catch (err) {
      console.error(`${DIAG} updateItem fatal error (${collectionName}, ${id})`, err);
    }
  }, [getSetterMap, repairs, handleRepairStatusChange, logActivity, syncChannel, currentUser?.ownerId]);

  const generateSequentialId = (collection) => {
    const list = ensureEntityArray(collection, 'idGeneration');
    const maxId = list.reduce((max, item) => {
      if (!item || item.id == null) return max;
      const num = parseInt(String(item.id).replace(/\D/g, '') || '0', 10);
      return Math.max(max, Number.isFinite(num) ? num : 0);
    }, 0);
    return String(maxId + 1).padStart(5, '0');
  };

  const addItem = useCallback((collectionName, item) => {
    const setterMap = getSetterMap();
    if (!setterMap[collectionName]) {
      console.error(`${DIAG} addItem: unknown collection "${collectionName}"`);
      return;
    }
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      console.error(`${DIAG} addItem: item must be a plain object`, item);
      return;
    }

    try {
      const itemWithId = { ...item };

      // Auto-generate sequential ID if not present
      if (!itemWithId.id) {
        // Map collection names to their state variables
        const collectionMap = {
          customers, vehicles, repairs, inventory, staff, appointments,
          notifications, messages, groups, trackers: activeTrackers, invoices,
          adminPaymentDetails, mechanicPaymentDetails, bonuses,
          billingSettings: [billingSettings], activityLogs, materialRequests, attendance
        };

        const currentCollection = collectionMap[collectionName] || [];
        if (['attendance', 'activityLogs', 'messages', 'notifications'].includes(collectionName)) {
          itemWithId.id = `${collectionName.slice(0, 3)}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        } else {
          itemWithId.id = generateSequentialId(ensureEntityArray(currentCollection, collectionName));
        }
      }

      // Intercept initial repair assignment
      if (collectionName === 'repairs' && itemWithId.mechanicId && itemWithId.status === 'pending') {
        handleRepairStatusChange(itemWithId, 'pending', itemWithId.mechanicId);
      }

      setterMap[collectionName](prev => {
        const list = ensureEntityArray(prev, collectionName);
        if (list.some(row => row && String(row.id) === String(itemWithId.id))) {
          console.warn(`${DIAG} addItem: duplicate id "${itemWithId.id}" in ${collectionName}; merge-update instead.`);
          return list.map(row => (row && String(row.id) === String(itemWithId.id) ? { ...row, ...itemWithId } : row));
        }
        return [...list, itemWithId];
      });

      broadcastData({
        type: 'ADD',
        collection: collectionName,
        data: itemWithId,
        ownerId: currentUser?.ownerId
      });

      // URGENT: Roadside Assistance Signal for real-time dashboard notification
      if (collectionName === 'trackers' && itemWithId.status === 'pending') {
        localStorage.setItem('garage_realtime_signal', JSON.stringify({
          type: 'NOTIFICATION',
          to: 'ALL',
          message: `🚨 URGENT: New Roadside Assistance Request!`,
          notifType: 'danger',
          time: Date.now()
        }));
      }

      // Log activity
      if (['staff', 'repairs', 'inventory', 'customers'].includes(collectionName)) {
        logActivity(`Added ${collectionName}`, `ID: ${itemWithId.id}, Name: ${item.name || item.plate || ''}`);
      }
    } catch (err) {
      console.error(`${DIAG} addItem fatal error (${collectionName})`, err);
    }
  }, [
    getSetterMap, repairs, customers, staff, inventory, vehicles, appointments,
    notifications, messages, groups, activeTrackers, invoices, adminPaymentDetails,
    mechanicPaymentDetails, bonuses, billingSettings, activityLogs, materialRequests,
    handleRepairStatusChange, logActivity, syncChannel, currentUser?.ownerId
  ]);

  const deleteItem = useCallback((collectionName, id) => {
    const setterMap = getSetterMap();
    if (!setterMap[collectionName]) {
      console.error(`${DIAG} deleteItem: unknown collection "${collectionName}"`);
      return;
    }
    if (id == null || id === '') {
      console.error(`${DIAG} deleteItem: invalid id`);
      return;
    }
    try {
      setterMap[collectionName](prev => ensureEntityArray(prev, collectionName).filter(item => item && String(item.id) !== String(id)));
      logActivity(`Deleted from ${collectionName}`, `ID: ${id}`);
    } catch (err) {
      console.error(`${DIAG} deleteItem failed`, err);
    }
  }, [getSetterMap, logActivity]);

  const clearAllData = useCallback(() => {
    logDataOp('CLEAR_ALL_DATA', 'all', 'User requested data clear');
    const keys = ['customers', 'vehicles', 'repairs', 'inventory', 'staff', 'appointments', 'notifications', 'messages', 'trackers', 'materialRequests'];

    // Clear state
    setCustomers([]);
    setVehicles([]);
    setRepairs([]);
    setInventory([]);
    setStaff([]);
    setAppointments([]);
    setNotifications([]);
    setMessages([]);
    setActiveTrackers([]);
    setMaterialRequests([]);

    // Force clear from localStorage to bypass safeSave rejection
    keys.forEach(k => {
      localStorage.removeItem(userPrefix + k);
      localStorage.removeItem(userPrefix + k + '_backup');
    });

    // Briefly reset initialization to prevent immediately re-saving empty state if any effect is lingering
    setIsInitialLoadComplete(false);
    setTimeout(() => setIsInitialLoadComplete(true), 100);
  }, [logDataOp, userPrefix]);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    localStorage.setItem(userPrefix + 'notifications', '[]');
  }, [userPrefix]);

  const markNotifRead = useCallback((id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markNotificationsReadForContact = useCallback((contactId) => {
    if (!currentUser || !contactId) return;
    setNotifications(prev => prev.filter(n =>
      !(n.type === 'message' && String(n.senderId) === String(contactId))
    ));
  }, [currentUser]);

  // BACKEND-LEVEL FILTERING (Simulating a secure API response)
  const backendFilteredInvoices = useMemo(() => {
    if (!currentUser) return [];
    const list = ensureEntityArray(invoices, 'invoices');

    return list.filter(inv => {
      // Legacy data migration for invoice_type
      const type = inv.invoice_type || (inv.materialRequestId ? 'inventory' : 'repair');

      if (currentUser.role === 'customer') {
        return inv.customerId === currentUser.id;
      }

      if (currentUser.role === 'admin' || currentUser.role === 'cashier') {
        return type === 'repair';
      }

      if (currentUser.role === 'inventoryManager' || currentUser.role === 'storekeeper') {
        return type === 'inventory' && String(inv.owner_id || inv.managerId) === String(currentUser.id);
      }

      // Default fallback for other roles (e.g. mechanic, coder)
      return true;
    });
  }, [invoices, currentUser]);

  const generateInvoice = useCallback((req, customer, part, vehicle) => {
    if (!currentUser || !req || !customer) return null;

    // STRICTOR IDEMPOTENCY: Prevent duplicate invoices for the same material request
    const existing = invoices.find(inv => String(inv.materialRequestId) === String(req.id));
    if (existing) {
      console.log(`[Billing] Invoice already exists for request ${req.id}. ID: ${existing.id}`);
      return existing;
    }

    const subtotal = (req.approvedQty || req.requestedQty) * (part?.price || 0);
    const tax = subtotal * (billingSettings.taxRate / 100);
    const total = subtotal + tax;

    const newInvoice = {
      id: `INV-${Date.now().toString().slice(-6)}`,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      customerAddress: customer.address || '',
      vehicleInfo: vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : 'N/A',
      vehiclePlate: vehicle ? vehicle.plate : 'N/A',
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 3 days due
      items: [
        { description: part?.name || 'Material', quantity: req.approvedQty || req.requestedQty, price: part?.price || 0 }
      ],
      laborCost: 0,
      subtotal,
      tax,
      discount: 0,
      total,
      status: 'unpaid',
      materialRequestId: req.id,
      repairId: req.repairId,
      mechanicId: req.mechanicId || (repairs.find(r => String(r.id) === String(req.repairId))?.mechanicId),
      mechanicName: ensureEntityArray(staff, 'staff').find(s => String(s.id) === String(req.mechanicId || repairs.find(r => String(r.id) === String(req.repairId))?.mechanicId))?.name || '',
      ownerId: currentUser.ownerId,
      owner_id: currentUser.id, // Explicitly tracking the exact user who created it
      invoice_type: 'inventory',
      managerId: currentUser.id,
      managerName: currentUser.name,
      createdAt: new Date().toISOString()
    };

    setInvoices(prev => [newInvoice, ...prev]);
    addNotification(
      `${t('newInvoice')} #${newInvoice.id}: ${formatCurrency(total)}`,
      'info',
      customer.id,
      '/billing'
    );
    return newInvoice;
  }, [currentUser, billingSettings, setInvoices, addNotification, t, repairs, invoices, staff]);

  const sendMessage = useCallback(async (recipientId, text, type = 'text', fileName = null, replyToId = null, id = null, thumbnail = null, status = null, metadata = null) => {
    if (!currentUser || !recipientId) return;
    if (type === 'text' && (!text || !text.trim())) return;

    if (blockedUsers.includes(String(recipientId))) {
      addNotification("You cannot message a blocked user", "warning");
      return;
    }

    try {
      const msgId = id || String(Date.now()) + Math.random().toString(36).substr(2, 9);
      const fileData = (type !== 'text' && typeof text === 'string' && (text.startsWith('data:') || text.startsWith('blob:'))) ? text : null;

      const newMessage = {
        id: msgId,
        senderId: String(currentUser.id),
        senderName: currentUser.name,
        recipientId: String(recipientId),
        text: fileData ? fileName || type : text, // Don't store base64 as text for media
        type,
        fileName,
        fileData, // Keep in state for this tab so sender sees it immediately
        thumbnail: type === 'video' ? (thumbnail || null) : null,
        replyTo: replyToId,
        time: new Date().toISOString(),
        status: status || 'sending',
        read: false,
        deleted: false,
        edited: false,
        ...metadata
      };

      // Save media to IndexedDB so receiver tab can read it without needing localStorage
      if (fileData) {
        try {
          await saveMedia(msgId, fileData);
        } catch (idbErr) {
          console.warn('IndexedDB save failed, message will still send:', idbErr);
        }
      }

      // Update local state (upsert by id)
      setMessages(prev => {
        const list = ensureEntityArray(prev, 'messages');
        const existingIdx = list.findIndex(m => m.id === msgId);
        if (existingIdx !== -1) {
          const newList = [...list];
          newList[existingIdx] = { ...newList[existingIdx], ...newMessage };
          return newList;
        }
        return [...list, newMessage];
      });

      // Only broadcast when the message is final (status = 'sent' or no status override)
      if (!status || status === 'sent') {
        // Include fileData in broadcast only if small; otherwise let receiver fetch from shared IDB
        broadcastData({
          type: 'ADD',
          collection: 'messages',
          data: { ...newMessage, status: 'sent', fileData: fileData?.length > 500000 ? null : fileData },
          ownerId: currentUser?.ownerId
        });
        // Also update own message status to 'sent'
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: 'sent' } : m));
      }

      if (type === 'text' || status === 'sent') {
        // Sender no longer notifies themselves
      }

      return true;
    } catch (err) {
      console.error("Critical error in sendMessage:", err);
      return false;
    }
  }, [currentUser, addNotification, setMessages, blockedUsers, broadcastData]);

  const createGroup = useCallback((name, memberIds, image = null, description = '') => {
    if (!currentUser) return;
    const newGroup = {
      id: `group_${Date.now()}`,
      name: name.trim(),
      description: description || '',
      members: [...new Set([currentUser.id, ...memberIds])],
      admins: [currentUser.id],
      createdBy: currentUser.id,
      ownerId: currentUser.id,
      createdAt: new Date().toISOString(),
      type: 'group',
      image,
      settings: {
        isPublic: false,
        slowMode: 0, // seconds
        readOnly: false,
        hideMembers: false,
        requireJoinApproval: false,
        blockedWords: []
      },
      permissions: {
        member: {
          sendMessages: true,
          sendMedia: true,
          addMembers: true,
          pinMessages: false,
          changeInfo: false,
          startCalls: true
        }
      },
      pins: [],
      joinRequests: [],
      invitations: [],
      mutedUsers: [],
      bannedUsers: [],
      auditLog: [{
        id: `audit_${Date.now()}`,
        action: 'CREATED_GROUP',
        userId: currentUser.id,
        userName: currentUser.name,
        timestamp: new Date().toISOString()
      }]
    };

    setGroups(prev => [newGroup, ...ensureEntityArray(prev, 'groups')]);

    broadcastData({
      type: 'ADD',
      collection: 'groups',
      data: newGroup,
      ownerId: currentUser?.ownerId
    });

    addNotification(`Group "${name}" created`, 'info');
    return newGroup;
  }, [currentUser, addNotification, setGroups, broadcastData]);

  const updateGroup = useCallback((groupId, updates) => {
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, ...updates } : g));
    broadcastData({ type: 'UPDATE', collection: 'groups', id: groupId, updates, ownerId: currentUser?.ownerId });
  }, [setGroups, broadcastData, currentUser?.ownerId]);

  const addMembersToGroup = useCallback((groupId, memberIds) => {
    setGroups(prev => prev.map(g => {
      if (g.id === groupId) {
        const newMembers = [...new Set([...g.members, ...memberIds])];
        const updates = { members: newMembers };
        broadcastData({ type: 'UPDATE', collection: 'groups', id: groupId, updates, ownerId: currentUser?.ownerId });
        return { ...g, ...updates };
      }
      return g;
    }));
  }, [setGroups, broadcastData, currentUser?.ownerId]);

  const removeMemberFromGroup = useCallback((groupId, memberId) => {
    setGroups(prev => prev.map(g => {
      if (g.id === groupId) {
        const newMembers = g.members.filter(m => String(m) !== String(memberId));
        const newAdmins = (g.admins || []).filter(m => String(m) !== String(memberId));
        const updates = { members: newMembers, admins: newAdmins };
        broadcastData({ type: 'UPDATE', collection: 'groups', id: groupId, updates, ownerId: currentUser?.ownerId });
        return { ...g, ...updates };
      }
      return g;
    }));
  }, [setGroups, broadcastData, currentUser?.ownerId]);

  const promoteMember = useCallback((groupId, memberId) => {
    setGroups(prev => prev.map(g => {
      if (g.id === groupId) {
        const newAdmins = [...new Set([...(g.admins || []), String(memberId)])];
        const updates = { admins: newAdmins };
        broadcastData({ type: 'UPDATE', collection: 'groups', id: groupId, updates, ownerId: currentUser?.ownerId });
        return { ...g, ...updates };
      }
      return g;
    }));
  }, [setGroups, broadcastData, currentUser?.ownerId]);

  const demoteAdmin = useCallback((groupId, memberId) => {
    setGroups(prev => prev.map(g => {
      if (g.id === groupId) {
        const newAdmins = (g.admins || []).filter(m => String(m) !== String(memberId));
        const updates = { admins: newAdmins };
        broadcastData({ type: 'UPDATE', collection: 'groups', id: groupId, updates, ownerId: currentUser?.ownerId });
        return { ...g, ...updates };
      }
      return g;
    }));
  }, [setGroups, broadcastData, currentUser?.ownerId]);

  const leaveGroup = useCallback((groupId) => {
    if (!currentUser) return;
    removeMemberFromGroup(groupId, currentUser.id);
  }, [currentUser, removeMemberFromGroup]);

  const deleteGroup = useCallback((groupId) => {
    setGroups(prev => prev.filter(g => g.id !== groupId));
    broadcastData({ type: 'REFRESH', collection: 'groups', ownerId: currentUser?.ownerId });
  }, [setGroups, broadcastData, currentUser?.ownerId]);

  const deleteMessage = useCallback((id) => {
    // HARD DELETE: Remove it completely from the array. This syncs across tabs automatically.
    setMessages(prev => prev.filter(m => m.id !== id));

    // Attempt to scrub notifications that might expose the message text
    // The safest way is to wipe unread msg notifications from this sender to this receiver
    // if we had the context, but id is enough to know something was removed. 
    // This is clean enough.
  }, []);

  const clearMessages = useCallback((contactId) => {
    if (!contactId) return;
    const contactIdStr = String(contactId);
    setMessages(prev => prev.filter(m => 
      !(String(m.senderId) === contactIdStr && String(m.recipientId) === String(currentUser?.id)) &&
      !(String(m.senderId) === String(currentUser?.id) && String(m.recipientId) === contactIdStr) &&
      !(String(m.recipientId) === contactIdStr) // For groups
    ));
    addNotification(`Chat cleared`, 'info');
  }, [currentUser?.id, addNotification]);

  const pinMessage = useCallback((groupId, messageId) => {
    setGroups(prev => prev.map(g => {
      if (g.id === groupId) {
        const newPins = [...(g.pins || []), messageId];
        const updates = { pins: newPins };
        broadcastData({ type: 'UPDATE', collection: 'groups', id: groupId, updates, ownerId: currentUser?.ownerId });
        return { ...g, ...updates };
      }
      return g;
    }));
  }, [setGroups, broadcastData, currentUser?.ownerId]);

  const unpinMessage = useCallback((groupId, messageId) => {
    setGroups(prev => prev.map(g => {
      if (g.id === groupId) {
        const newPins = (g.pins || []).filter(id => id !== messageId);
        const updates = { pins: newPins };
        broadcastData({ type: 'UPDATE', collection: 'groups', id: groupId, updates, ownerId: currentUser?.ownerId });
        return { ...g, ...updates };
      }
      return g;
    }));
  }, [setGroups, broadcastData, currentUser?.ownerId]);

  const moderateGroupMember = useCallback((groupId, memberId, action) => {
    // action: mute, unmute, ban, unban
    setGroups(prev => prev.map(g => {
      if (g.id === groupId) {
        let updates = {};
        if (action === 'mute') updates.mutedUsers = [...new Set([...(g.mutedUsers || []), String(memberId)])];
        if (action === 'unmute') updates.mutedUsers = (g.mutedUsers || []).filter(id => String(id) !== String(memberId));
        if (action === 'ban') {
          updates.bannedUsers = [...new Set([...(g.bannedUsers || []), String(memberId)])];
          updates.members = g.members.filter(id => String(id) !== String(memberId));
          updates.admins = (g.admins || []).filter(id => String(id) !== String(memberId));
        }
        if (action === 'unban') updates.bannedUsers = (g.bannedUsers || []).filter(id => String(id) !== String(memberId));
        
        broadcastData({ type: 'UPDATE', collection: 'groups', id: groupId, updates, ownerId: currentUser?.ownerId });
        return { ...g, ...updates };
      }
      return g;
    }));
  }, [setGroups, broadcastData, currentUser?.ownerId]);

  const editMessage = useCallback((id, newText) => {
    if (!newText.trim()) return;
    setMessages(prev => prev.map(m => m.id === id ? { ...m, text: newText, edited: true } : m));
  }, []);

  const openChatWith = useCallback((contactId) => {
    if (contactId == null || contactId === '') return;
    const merged = [...ensureEntityArray(staff, 'staff'), ...ensureEntityArray(customers, 'customers')];
    const contact = merged.find(c => c && String(c.id) === String(contactId));
    if (contact) {
      setActiveChatContact(contact);
    } else {
      console.warn(`${DIAG} openChatWith: no contact for id`, contactId);
    }
  }, [staff, customers]);

  const markMessagesRead = useCallback((senderId) => {
    if (!currentUser || !senderId) return;
    const senderIdStr = String(senderId);
    const isGroup = groups.some(g => String(g.id) === senderIdStr);
    console.log(`${DIAG} markMessagesRead:`, { senderIdStr, isGroup });
    
    setMessages(prev => {
      let changed = false;
      const list = ensureEntityArray(prev, 'markMessagesRead');
      const newList = list.map(m => {
        const matchesContact = isGroup 
          ? (String(m.recipientId) === senderIdStr)
          : (String(m.senderId) === senderIdStr && String(m.recipientId) === String(currentUser.id));
          
        const shouldMarkSeen = matchesContact && String(m.senderId) !== String(currentUser.id) && m.status !== 'seen';
        
        if (shouldMarkSeen) {
          changed = true;
          return { ...m, status: 'seen', read: true, seen_at: new Date().toISOString() };
        }
        return m;
      });
      if (changed) console.log(`${DIAG} Local state updated: marked messages as seen`);
      return newList;
    });
    markNotificationsReadForContact(senderIdStr);

    try {
      const now = new Date().toISOString();
      const bulkSignal = {
        type: 'MARK_READ_SIGNAL',
        fromId: String(currentUser.id),
        toId: senderIdStr,
        isGroup: !!isGroup,
        time: now
      };
      
      syncChannel.postMessage(bulkSignal);
      
      localStorage.setItem('garage_realtime_signal', JSON.stringify({
        ...bulkSignal,
        from: String(currentUser.id)
      }));
      // Force change to trigger storage event if same value
      localStorage.removeItem('garage_realtime_signal');
    } catch (err) {
      console.warn(`${DIAG} Broadcast failed`, err);
    }
  }, [currentUser, groups, markNotificationsReadForContact, syncChannel]);

  // Handle window focus to re-sync seen status
  useEffect(() => {
    const handleFocus = () => {
      if (activeChatContact && isChatOpen) {
        console.log(`${DIAG} Window focused, re-syncing seen status for ${activeChatContact.id}`);
        markMessagesRead(activeChatContact.id);
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [activeChatContact, isChatOpen, markMessagesRead]);

  const setTypingSignal = useCallback((recipientId, isTyping) => {
    if (!currentUser || !recipientId) return;
    const signal = {
      type: 'TYPING',
      from: currentUser.id,
      senderName: currentUser.name,
      to: String(recipientId),
      value: isTyping,
      time: Date.now()
    };
    localStorage.setItem('garage_realtime_signal', JSON.stringify(signal));
    // Clear immediately to allow re-triggering same signal
    localStorage.removeItem('garage_realtime_signal');
  }, [currentUser]);

  const reactToMessage = useCallback((messageId, emoji) => {
    if (!currentUser) return;
    setMessages(prev => prev.map(m => {
      if (m.id === messageId) {
        const reactions = { ...(m.reactions || {}) };
        if (reactions[currentUser.id] === emoji) {
          delete reactions[currentUser.id];
        } else {
          reactions[currentUser.id] = emoji;
        }
        const updatedMsg = { ...m, reactions };
        // Sync the reaction
        broadcastData({ type: 'UPDATE', collection: 'messages', id: messageId, updates: { reactions }, ownerId: currentUser.ownerId });
        return updatedMsg;
      }
      return m;
    }));
  }, [currentUser, broadcastData]);

  const leaveGroupCall = useCallback((groupId) => {
    if (!currentUser || !groupId) return;
    
    setGroupCalls(prev => {
      const call = prev[groupId];
      if (!call) return prev;
      const newParticipants = call.participants.filter(p => String(p) !== String(currentUser.id));
      if (newParticipants.length === 0) {
        const newState = { ...prev };
        delete newState[groupId];
        return newState;
      }
      return {
        ...prev,
        [groupId]: { ...call, participants: newParticipants }
      };
    });

    // Broadcast signal
    localStorage.setItem('garage_realtime_signal', JSON.stringify({
      type: 'GROUP_CALL_LEFT',
      from: currentUser.id,
      groupId
    }));
    localStorage.removeItem('garage_realtime_signal');

    setCallState('idle');
    setActiveCall(null);
  }, [currentUser]);

  const joinGroupCall = useCallback((groupId) => {
    if (!currentUser || !groupId) return;
    const call = groupCalls[groupId];
    if (!call) return;

    setCallState('connected');
    setActiveCall({
      id: `group_call_${Date.now()}`,
      groupId,
      groupName: call.groupName || "Group Call",
      type: call.type,
      isOutgoing: false,
      startTime: call.startTime,
      contact: { id: groupId, name: call.groupName || "Group", type: 'group' }
    });

    localStorage.setItem('garage_realtime_signal', JSON.stringify({
      type: 'GROUP_CALL_JOINED',
      from: currentUser.id,
      groupId
    }));
    localStorage.removeItem('garage_realtime_signal');
  }, [currentUser, groupCalls]);

  const startGroupCall = useCallback((groupId, type = 'voice') => {
    if (!currentUser || !groupId) return;
    const group = groups.find(g => String(g.id) === String(groupId));
    if (!group) return;

    const startTime = Date.now();
    setGroupCalls(prev => ({
      ...prev,
      [groupId]: {
        type,
        startTime,
        participants: [currentUser.id],
        activeSpeakers: [],
        groupName: group.name
      }
    }));

    setCallState('connected');
    setActiveCall({
      id: `group_call_${Date.now()}`,
      groupId,
      groupName: group.name,
      type,
      isOutgoing: true,
      startTime,
      contact: { id: groupId, name: group.name, type: 'group' }
    });

    localStorage.setItem('garage_realtime_signal', JSON.stringify({
      type: 'GROUP_CALL_STARTED',
      from: currentUser.id,
      groupId,
      groupName: group.name,
      callType: type,
      startTime,
      participants: [currentUser.id]
    }));
    localStorage.removeItem('garage_realtime_signal');
  }, [currentUser, groups]);

  const endCall = useCallback((reason = 'ended') => {
    if (!currentUser) return;

    const callSnap = activeCall;
    const stateSnap = callState;
    
    // Clear all pending timers immediately
    if (ringingTimerRef.current) {
      clearTimeout(ringingTimerRef.current);
      ringingTimerRef.current = null;
    }
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }

    // Early exit only if we have NO call context at all.
    // We allow logging even if the state is already 'idle' if we have a call snapshot.
    if (!callSnap) {
      setCallState('idle');
      setCallSubStatus('idle');
      setActiveCall(null);
      return;
    }

    if (callSnap.groupId) {
      leaveGroupCall(callSnap.groupId);
      return;
    }

    const currentCallId = callSnap.id;
    if (!currentCallId) {
      setCallState('idle');
      setCallSubStatus('idle');
      setActiveCall(null);
      return;
    }

    // ── Cross-tab Deduplication Helpers ──────────────────────────────────
    const isLogProcessed = (id) => {
      try {
        const processed = JSON.parse(localStorage.getItem('garage_processed_call_logs') || '[]');
        return processed.includes(id);
      } catch (e) { return false; }
    };
    const markLogProcessed = (id) => {
      try {
        const processed = JSON.parse(localStorage.getItem('garage_processed_call_logs') || '[]');
        if (!processed.includes(id)) {
          localStorage.setItem('garage_processed_call_logs', JSON.stringify([...processed, id].slice(-50)));
        }
      } catch (e) { }
    };

    // Determine if we should log a system message for this end event
    // We log for Missed, Declined, or Canceled if not already logged.
    const isActuallyCanceled = (reason === 'ended' && callSnap.isOutgoing && stateSnap === 'calling') || reason === 'canceled_remote';
    const isActuallyMissed = reason === 'timeout' || reason === 'timeout_remote';
    const isActuallyDeclined = reason === 'declined' || reason === 'declined_remote';
    
    console.log('[App] endCall Logic:', { reason, isActuallyMissed, isActuallyDeclined, isActuallyCanceled, currentCallId });

    const shouldLog = (isActuallyMissed || isActuallyCanceled || isActuallyDeclined) && !isLogProcessed(currentCallId);

    if (shouldLog) {
      // Fallback: If contact is missing but we have IDs, we can still log
      const usersList = [...ensureEntityArray(customers, 'customers'), ...ensureEntityArray(staff, 'staff')];
      const targetContact = callSnap.contact || usersList.find(c => String(c.id) === String(callSnap.isOutgoing ? callSnap.recipientId : (callSnap.senderId || callSnap.contact?.id)));
      
      if (!targetContact) {
        console.warn('[App] endCall: Skipping log, no contact found');
        return;
      }
      markLogProcessed(currentCallId);
      
      let logText = '';
      let logType = 'missed_call';
      
      // Attribution: Who is seen as the "sender" of this status update?
      // Use explicit IDs from Snap to avoid race conditions with currentUser
      let logSenderId = callSnap.isOutgoing ? callSnap.senderId : callSnap.contact.id;
      let logSenderName = callSnap.isOutgoing ? (currentUser?.name || 'You') : callSnap.contact.name;

      if (isActuallyMissed) {
        logText = `Missed ${callSnap.type} call`;
        logType = 'missed_call';
      } else if (isActuallyCanceled) {
        logText = `Canceled ${callSnap.type} call`;
        logType = 'missed_call'; // Canceled is still under missed_call category for UI
      } else if (isActuallyDeclined) {
        logText = `Declined ${callSnap.type} call`;
        logType = 'declined_call';
        // Attribution: If I declined it, I am the sender
        if (reason === 'declined') {
          logSenderId = currentUser.id;
          logSenderName = currentUser.name;
        } else {
          // The remote person declined it
          logSenderId = callSnap.contact.id;
          logSenderName = callSnap.contact.name;
        }
      }

      const logMsg = {
        id: `${logType}_${currentCallId}`,
        senderId: String(logSenderId),
        senderName: logSenderName,
        recipientId: String(logSenderId === currentUser.id ? callSnap.contact.id : currentUser.id),
        text: logText,
        type: logType,
        callType: callSnap.type,
        time: new Date().toISOString(),
        read: false,
        status: 'sent'
      };

      setMessages(prev => {
        if (prev.some(m => m.id === logMsg.id)) return prev;
        return [...prev, logMsg];
      });
      syncChannel.postMessage({ type: 'ADD', collection: 'messages', data: logMsg, ownerId: currentUser.ownerId });
    }

    setCallState('idle');
    setCallSubStatus('idle');
    setActiveCall(null);

    // Send RTC signaling cleanup
    try {
      let finalSignalType = 'CALL_ENDED';
      if (reason === 'declined') finalSignalType = 'CALL_REJECTED';
      else if (reason === 'timeout') finalSignalType = 'CALL_MISSED'; // Distinguish timeout
      else if (reason === 'canceled' || (reason === 'ended' && callSnap.isOutgoing)) finalSignalType = 'CALL_CANCELLED';

      const cleanupSignal = {
        id: `end_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        signalType: finalSignalType,
        from: currentUser.id,
        to: callSnap.contact?.id,
        timestamp: Date.now(),
        callId: currentCallId // Reference the original call ID
      };
      const queueKey = 'garage_call_queue';
      const q = JSON.parse(localStorage.getItem(queueKey) || '[]');
      localStorage.setItem(queueKey, JSON.stringify([...q, cleanupSignal].slice(-20)));
      localStorage.setItem('garage_call_signal', JSON.stringify(cleanupSignal));
    } catch (e) { }
  }, [currentUser, activeCall, callState, syncChannel, leaveGroupCall]);
  const initiateCall = useCallback((contact, callType = 'audio') => {
    if (!currentUser || !contact) return;
    
    // Clear any existing timers just in case
    if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
    
    setCallState('calling');
    setCallSubStatus('calling');
    const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const signal = {
      id: callId,
      signalType: 'CALL_INITIATED',
      callType: callType,
      from: currentUser.id,
      fromName: currentUser.name,
      fromPic: currentUser.profilePic || currentUser.image,
      to: contact.id,
      timestamp: Date.now()
    };
    
    setActiveCall({ contact, isOutgoing: true, type: callType, id: callId });
    
    // Use the ref to ensure we can clear this if call is answered/ended early
    callTimeoutRef.current = setTimeout(() => {
      endCall('timeout');
      callTimeoutRef.current = null;
    }, 60 * 1000);
    
    try {
      const queueKey = 'garage_call_queue';
      const queue = JSON.parse(localStorage.getItem(queueKey) || '[]');
      localStorage.setItem(queueKey, JSON.stringify([...queue, signal].slice(-20)));
      localStorage.setItem('garage_call_signal', JSON.stringify(signal));
    } catch (e) { }
  }, [currentUser, endCall]);

  const acceptCall = useCallback(() => {
    if (!currentUser || !activeCall) return;
    
    // CRITICAL: Stop all pending missed call timers when call is answered
    if (ringingTimerRef.current) {
      clearTimeout(ringingTimerRef.current);
      ringingTimerRef.current = null;
    }
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }

    setCallState('connected');
    setActiveCall(prev => ({ ...prev, startTime: Date.now() }));

    const signal = {
      id: `acc_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      signalType: 'CALL_ACCEPTED',
      from: currentUser.id,
      to: activeCall.contact.id,
      timestamp: Date.now()
    };
    
    try {
      const queueKey = 'garage_call_queue';
      const queue = JSON.parse(localStorage.getItem(queueKey) || '[]');
      localStorage.setItem(queueKey, JSON.stringify([...queue, signal].slice(-20)));
      localStorage.setItem('garage_call_signal', JSON.stringify(signal));
    } catch (e) { }
  }, [currentUser, activeCall]);


  const blockUser = useCallback((userId) => {
    if (!userId) return;
    setBlockedUsers(prev => [...new Set([...prev, String(userId)])]);
    addNotification(`User blocked`, 'info');
  }, [addNotification]);

  const unblockUser = useCallback((userId) => {
    if (!userId) return;
    setBlockedUsers(prev => prev.filter(id => id !== String(userId)));
    addNotification(`User unblocked`, 'success');
  }, [addNotification]);

  // Keep activeChatContact in sync with data changes (e.g., profile pic updates)
  useEffect(() => {
    if (!activeChatContact) return;
    const all = [...ensureEntityArray(staff, 'staff'), ...ensureEntityArray(customers, 'customers'), ...ensureEntityArray(groups, 'groups')];
    const latest = all.find(c => String(c.id) === String(activeChatContact.id));
    if (latest) {
      const hasChanged = latest.profilePic !== activeChatContact.profilePic ||
        latest.image !== activeChatContact.image ||
        latest.name !== activeChatContact.name ||
        (latest.type === 'group' && latest.members?.length !== activeChatContact.members?.length);
      if (hasChanged) {
        setActiveChatContact(prev => ({ ...prev, ...latest }));
      }
    }
  }, [staff, customers, groups, activeChatContact?.id]);

  const processedCallSignals = useRef(new Set()); // Fallback for rapid local events
  
  // Shared registry to prevent multi-tab race conditions
  const checkSignalProcessed = (id) => {
    try {
      const processed = JSON.parse(localStorage.getItem('garage_processed_signals') || '[]');
      return processed.includes(id);
    } catch (e) { return false; }
  };
  const markSignalProcessed = (id) => {
    try {
      const processed = JSON.parse(localStorage.getItem('garage_processed_signals') || '[]');
      localStorage.setItem('garage_processed_signals', JSON.stringify([...processed, id].slice(-50)));
    } catch (e) { }
  };
  const ringingTimerRef = useRef(null);
  const callTimeoutRef = useRef(null);

  useEffect(() => {
    if (!currentUser) return;

    const handleCallSignal = (signal) => {
      if (checkSignalProcessed(signal.id)) return;
      if (String(signal.to) !== String(currentUser.id)) return;
      
      // Ignore signals older than 30 seconds (Stale prevention)
      const now = Date.now();
      if (signal.timestamp && (now - signal.timestamp > 30000)) {
        markSignalProcessed(signal.id);
        return;
      }

      markSignalProcessed(signal.id);
      console.log('[App] Processing Signal:', signal.signalType, signal.id);

      if (signal.signalType === 'CALL_INITIATED') {
        // If already in a call, ignore new calls
        if (callState !== 'idle') return;

        const usersList = [...ensureEntityArray(customers, 'customers'), ...ensureEntityArray(staff, 'staff')];
        const sender = usersList.find(u => String(u.id) === String(signal.from)) || {
          id: signal.from,
          name: signal.fromName || 'Unknown Caller',
          profilePic: signal.fromPic,
          isPlaceholder: true
        };

        setCallState('incoming');
        setCallSubStatus('incoming');
        setActiveCall({
          contact: sender,
          isOutgoing: false,
          type: signal.callType || 'audio',
          id: signal.id
        });

        // Auto-terminate incoming call if not answered in 60s
        if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = setTimeout(() => {
          endCall('timeout');
          callTimeoutRef.current = null;
        }, 60 * 1000);

        // Acknowledge delivery immediately
        const ack = {
          id: `ack_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          signalType: 'CALL_DELIVERED',
          from: currentUser.id,
          to: signal.from,
          timestamp: Date.now()
        };
        try {
          const queueKey = 'garage_call_queue';
          const q = JSON.parse(localStorage.getItem(queueKey) || '[]');
          localStorage.setItem(queueKey, JSON.stringify([...q, ack].slice(-20)));
          localStorage.setItem('garage_call_signal', JSON.stringify(ack));
        } catch (e) { }

        // Send RINGING signal after 1 second (Store ref to allow cleanup)
        if (ringingTimerRef.current) clearTimeout(ringingTimerRef.current);
        ringingTimerRef.current = setTimeout(() => {
          const ring = {
            id: `ring_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            signalType: 'CALL_RINGING',
            from: currentUser.id,
            to: signal.from,
            timestamp: Date.now()
          };
          try {
            const queueKey = 'garage_call_queue';
            const q = JSON.parse(localStorage.getItem(queueKey) || '[]');
            localStorage.setItem(queueKey, JSON.stringify([...q, ring].slice(-20)));
            localStorage.setItem('garage_call_signal', JSON.stringify(ring));
          } catch (e) { }
          ringingTimerRef.current = null;
        }, 1000);

      } else if (signal.signalType === 'CALL_DELIVERED') {
        // Caller sees the call reached the receiver
        if (callState === 'calling' && String(signal.to) === String(currentUser.id)) {
          setCallSubStatus('delivered');
        }
      } else if (signal.signalType === 'CALL_RINGING') {
        // Caller sees the receiver's device is ringing
        if (callState === 'calling' && String(signal.to) === String(currentUser.id)) {
          setCallSubStatus('ringing');
        }
      } else if (signal.signalType === 'CALL_ACCEPTED') {
        setCallState('connected');
        setCallSubStatus('connected');
        setActiveCall(prev => prev ? { ...prev, startTime: Date.now() } : null);
      } else if (signal.signalType === 'CALL_ENDED' || signal.signalType === 'CALL_CANCELLED' || signal.signalType === 'CALL_REJECTED' || signal.signalType === 'CALL_MISSED') {
        const currentUserId = currentUser?.id;
        if (!currentUserId) return;

        const isParticipant =
          String(signal.from) === String(currentUserId) ||
          String(signal.to) === String(currentUserId);

        if (isParticipant) {
          const reason = signal.signalType === 'CALL_CANCELLED' ? 'canceled_remote' : 
                         (signal.signalType === 'CALL_REJECTED' ? 'declined_remote' : 
                         (signal.signalType === 'CALL_MISSED' ? 'timeout_remote' : 'ended'));
          endCall(reason);
        }
      }
    };

    const pollQueue = () => {
      try {
        const queue = JSON.parse(localStorage.getItem('garage_call_queue') || '[]');
        queue.forEach(handleCallSignal);
      } catch (e) { }
    };

    const handleStorage = (e) => {
      if (e.key === 'garage_call_signal' || e.key === 'garage_call_queue') {
        pollQueue();
      }
    };

    window.addEventListener('storage', handleStorage);
    pollQueue(); // Initial check

    // Periodic cleanup of stale signals from localStorage (every 1 minute)
    const cleanupInterval = setInterval(() => {
      try {
        const queueKey = 'garage_call_queue';
        const queue = JSON.parse(localStorage.getItem(queueKey) || '[]');
        const now = Date.now();
        const filtered = queue.filter(sig => sig.timestamp && (now - sig.timestamp < 60000));
        if (filtered.length !== queue.length) {
          localStorage.setItem(queueKey, JSON.stringify(filtered));
        }
      } catch (e) { }
    }, 60000);

    return () => {
      window.removeEventListener('storage', handleStorage);
      clearInterval(cleanupInterval);
    };
  }, [currentUser, customers, staff, callState, activeCall, endCall, initiateCall]);

  const requestConfirmation = useCallback((label, onConfirm) => {
    setConfirmingAction({ label, onConfirm });
  }, []);

  const value = useMemo(() => ({
    customers, vehicles, repairs, inventory, staff, appointments, notifications, messages, activeTrackers, language, activeChatContact,
    callState, activeCall, callSubStatus, activityLogs, groupCalls,
    setCustomers, setVehicles, setRepairs, setInventory, setStaff, setAppointments, setNotifications, setMessages, setActiveTrackers, setLanguage, setActiveChatContact, setGroupCalls,
    updateItem, addItem, deleteItem, clearAllData, t, formatDate, formatTime, logActivity, generateInvoice, ensureEntityArray,
    addNotification, sendMessage, deleteMessage, editMessage, clearMessages, markMessagesRead, openChatWith, clearNotifications, markNotifRead, markNotificationsReadForContact, dataLoaded, isInitialLoadComplete,
    invoices: backendFilteredInvoices, adminPaymentDetails, billingSettings, setInvoices, setAdminPaymentDetails, setBillingSettings, setActivityLogs,
    bonuses, mechanicPaymentDetails, setBonuses, setMechanicPaymentDetails,
    materialRequests, setMaterialRequests,
    attendance, setAttendance,
    salaries, setSalaries,
    salaryPayments, setSalaryPayments,
    darkMode, toggleDarkMode,
    isSidebarOpen, setIsSidebarOpen,
    showNotifs, setShowNotifs,
    isChatOpen, setIsChatOpen,
    initiateCall, acceptCall, endCall, handleRepairStatusChange,
    confirmingAction, setConfirmingAction, requestConfirmation,
    typingStatus, setTypingSignal, reactToMessage, userPresence,
    groups, setGroups, createGroup, updateGroup, addMembersToGroup, removeMemberFromGroup, promoteMember, demoteAdmin, leaveGroup, deleteGroup,
    pinMessage, unpinMessage, moderateGroupMember, startGroupCall, joinGroupCall, leaveGroupCall,
    blockedUsers, setBlockedUsers, blockUser, unblockUser,
    privacySettings, setPrivacySettings,
    deferredPrompt, setDeferredPrompt,
    toasts, showToast
  }), [
    customers, vehicles, repairs, inventory, staff, appointments, notifications, messages, activeTrackers, language, activeChatContact,
    callState, activeCall, callSubStatus, activityLogs, groupCalls,
    updateItem, addItem, deleteItem, clearAllData, t, formatDate, formatTime, logActivity, generateInvoice, ensureEntityArray,
    addNotification, sendMessage, deleteMessage, editMessage, markMessagesRead, openChatWith, clearNotifications, markNotifRead, markNotificationsReadForContact, dataLoaded,
    backendFilteredInvoices, adminPaymentDetails, billingSettings, materialRequests, bonuses, mechanicPaymentDetails,
    darkMode, toggleDarkMode,
    isSidebarOpen,
    showNotifs,
    isChatOpen,
    initiateCall, acceptCall, endCall, handleRepairStatusChange,
    confirmingAction, requestConfirmation,
    typingStatus, setTypingSignal, reactToMessage, userPresence, deferredPrompt,
    groups, createGroup, updateGroup, addMembersToGroup, removeMemberFromGroup, promoteMember, demoteAdmin, leaveGroup, deleteGroup,
    pinMessage, unpinMessage, moderateGroupMember, startGroupCall, joinGroupCall, leaveGroupCall,
    blockedUsers, blockUser, unblockUser, privacySettings,
    toasts, showToast,
    salaries, salaryPayments, isInitialLoadComplete,
    attendance
  ]);

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};
