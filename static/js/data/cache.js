const DB_NAME = "GeneCacheDB";
const STORE_NAME = "api_responses";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

let db = null;

function openDB() {
    return new Promise((resolve, reject) => {
        if (db) return resolve(db);
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = (e) => {
            db = e.target.result;
            resolve(db);
        };
        request.onerror = (e) => reject(e.target.error);
    });
}

export async function getCached(key) {
    const db = await openDB();
    return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => {
            const entry = req.result;
            if (entry && (Date.now() - entry.timestamp) < TTL_MS) {
                resolve(entry.data);
            } else {
                resolve(null);
            }
        };
        req.onerror = () => resolve(null);
    });
}

export async function setCached(key, data) {
    const db = await openDB();
    return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.put({ data, timestamp: Date.now() }, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
    });
}