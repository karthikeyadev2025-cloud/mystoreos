// IndexedDB-backed offline write queue.
// Writes made while !navigator.onLine are stored here and replayed by useOfflineSync on reconnect.
// Each entry has a stable UUID so Supabase upsert is idempotent on retry.
const DB_NAME = 'mystore_offline_queue';
const STORE = 'writes';

let _db = null;

async function openDB() {
  if (_db) return _db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
      }
    };
    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function enqueue(op) {
  const db = await openDB();
  const entry = { id: crypto.randomUUID(), createdAt: Date.now(), ...op };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).add(entry);
    tx.oncomplete = resolve;
    tx.onerror = (e) => reject(e.target.error);
  });
}

async function dequeue(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = resolve;
    tx.onerror = (e) => reject(e.target.error);
  });
}

export async function getPending() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result.sort((a, b) => a.createdAt - b.createdAt));
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function getPendingCount() {
  return (await getPending()).length;
}

// Replays all queued ops against supabaseClient in chronological order.
// Each successfully flushed op is removed from the queue.
// Failed ops stay for the next flush attempt.
export async function flush(supabaseClient) {
  const pending = await getPending();
  const results = { flushed: 0, failed: 0 };
  for (const op of pending) {
    try {
      if (op.action === 'insert') {
        const { error } = await supabaseClient.from(op.table).upsert(op.data);
        if (error) throw error;
      } else if (op.action === 'update') {
        let q = supabaseClient.from(op.table).update(op.data);
        for (const [k, v] of Object.entries(op.match || {})) q = q.eq(k, v);
        const { error } = await q;
        if (error) throw error;
      } else if (op.action === 'delete') {
        let q = supabaseClient.from(op.table).delete();
        for (const [k, v] of Object.entries(op.match || {})) q = q.eq(k, v);
        const { error } = await q;
        if (error) throw error;
      }
      await dequeue(op.id);
      results.flushed++;
    } catch (_err) {
      results.failed++;
    }
  }
  return results;
}

export async function clearAll() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = resolve;
    tx.onerror = (e) => reject(e.target.error);
  });
}
