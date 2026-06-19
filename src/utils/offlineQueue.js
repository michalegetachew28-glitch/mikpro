/**
 * offlineQueue.js
 * ------------------------------------------------------------------
 * IndexedDB-backed queue for actions taken while offline.
 * Since GarageSys uses localStorage (not a remote API) all data is
 * already persisted locally. This queue tracks mutations made offline
 * so the UI can show "X pending changes" and provide a sync indicator.
 *
 * Stores: offline_actions  { id, type, collection, itemId, payload, timestamp }
 * ------------------------------------------------------------------
 */

const OQ_DB_NAME    = 'garage_offline_db';
const OQ_DB_VERSION = 1;
const OQ_STORE      = 'offline_actions';

let _db = null;

/* ── Open (or reuse) the DB ─────────────────────────────────────── */
function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const req = indexedDB.open(OQ_DB_NAME, OQ_DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(OQ_STORE)) {
        const store = db.createObjectStore(OQ_STORE, {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('collection', 'collection', { unique: false });
        store.createIndex('timestamp',  'timestamp',  { unique: false });
      }
    };
  });
}

/* ── Enqueue a pending action ───────────────────────────────────── */
export async function enqueueAction({ type, collection, itemId, payload }) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(OQ_STORE, 'readwrite');
      const store = tx.objectStore(OQ_STORE);
      const record = {
        type,          // 'ADD' | 'UPDATE' | 'DELETE'
        collection,    // e.g. 'repairs'
        itemId,        // the item's id string
        payload,       // the data object
        timestamp: Date.now(),
      };
      const req = store.add(record);
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[OfflineQueue] enqueueAction failed:', err);
  }
}

/* ── Get all pending actions ────────────────────────────────────── */
export async function getPendingActions() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(OQ_STORE, 'readonly');
      const store = tx.objectStore(OQ_STORE);
      const req   = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror   = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[OfflineQueue] getPendingActions failed:', err);
    return [];
  }
}

/* ── Count pending actions ──────────────────────────────────────── */
export async function getPendingCount() {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx    = db.transaction(OQ_STORE, 'readonly');
      const store = tx.objectStore(OQ_STORE);
      const req   = store.count();
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror   = () => resolve(0);
    });
  } catch { return 0; }
}

/* ── Remove a single action by IDB key ─────────────────────────── */
export async function removeAction(id) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(OQ_STORE, 'readwrite');
      const store = tx.objectStore(OQ_STORE);
      const req   = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[OfflineQueue] removeAction failed:', err);
  }
}

/* ── Clear all pending actions ──────────────────────────────────── */
export async function clearAllActions() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(OQ_STORE, 'readwrite');
      const store = tx.objectStore(OQ_STORE);
      const req   = store.clear();
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[OfflineQueue] clearAllActions failed:', err);
  }
}

/**
 * drainQueue
 * ------------------------------------------------------------------
 * Called when connectivity is restored.
 * Since the app uses localStorage (no remote API), data is already
 * persisted. We just clear the queue and return the count of items
 * that were "synced" so the UI can show confirmation.
 * If a real API is ever added, replay logic goes here.
 * ------------------------------------------------------------------
 */
export async function drainQueue(onProgress) {
  const actions = await getPendingActions();
  if (!actions.length) return 0;

  let synced = 0;
  for (const action of actions) {
    // Data is already in localStorage – nothing to replay against a server.
    // Remove from queue to signal it's been "synced".
    await removeAction(action.id);
    synced++;
    if (onProgress) onProgress(synced, actions.length);
    // Small yield to avoid blocking UI
    await new Promise(r => setTimeout(r, 20));
  }
  return synced;
}
