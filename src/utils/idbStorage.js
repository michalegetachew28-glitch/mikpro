const DB_NAME = 'garage_media_db';
const DB_VERSION = 2; 
const STORE_NAME = 'media_store';

let dbPromise = null;

export const initDB = () => {
  if (typeof indexedDB === 'undefined' || !indexedDB) {
    console.warn("IndexedDB is not supported in this environment.");
    return null;
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
          console.error("IndexedDB Open Error:", request.error);
          reject(request.error);
        };

        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        };
      } catch (err) {
        console.error("Critical failure opening IndexedDB:", err);
        reject(err);
      }
    });
  }
  return dbPromise;
};

export const storeMedia = async (id, blob, metadata = {}) => {
  try {
    const db = await initDB();
    if (!db) throw new Error("IndexedDB not initialized");

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        const data = {
          blob,
          type: metadata.type || blob.type,
          size: metadata.size || blob.size,
          name: metadata.name || '',
          timestamp: Date.now()
        };

        const request = store.put(data, id);
        request.onsuccess = () => resolve(id);
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  } catch (err) {
    console.error("storeMedia error:", err);
    throw err;
  }
};

export const getMedia = async (id) => {
  try {
    const db = await initDB();
    if (!db) return null;

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  } catch (err) {
    console.error("getMedia error:", err);
    return null;
  }
};

