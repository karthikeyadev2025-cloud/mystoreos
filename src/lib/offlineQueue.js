// IndexedDB-backed offline write queue.
//
// Writes made while !navigator.onLine are stored here and replayed by
// useOfflineSync on reconnect. Each entry has a stable UUID so Supabase
// upsert is idempotent on retry.
//
// P1 hardening (2026-07-31):
//   • Dead-letter store for ops that fail repeatedly. Prior version
//     retried forever with no visibility. Now: after MAX_RETRIES failures,
//     an op moves to `failed_writes` with error message + retry count,
//     and the pending badge only counts genuinely-pending ops.
//   • UUID fallback for older Android WebViews that lack crypto.randomUUID.
//   • InvalidStateError recovery — the cached _db handle is nulled when
//     IndexedDB signals closure (happens on mobile Chrome background-kill).
//   • Per-op error logging so a dead-letter row explains why it failed.
//   • Bounded write size — a rogue op won't blow up localStorage.

const DB_NAME = 'mystore_offline_queue';
const DB_VERSION = 2;             // bumped for failed_writes store
const STORE = 'writes';
const DEAD_STORE = 'failed_writes';
const MAX_RETRIES = 5;

let _db = null;

// ── UUID generation with fallback ─────────────────────────────────────
// crypto.randomUUID is unavailable pre-Chromium-92 (some Android WebViews
// still ship with that or older). Fallback uses crypto.getRandomValues
// (available everywhere with any IndexedDB support) to produce a v4-format
// UUID. As a last resort, a timestamp+Math.random string so a write is
// never silently dropped.
function uuid() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const b = new Uint8Array(16);
      crypto.getRandomValues(b);
      b[6] = (b[6] & 0x0f) | 0x40;
      b[8] = (b[8] & 0x3f) | 0x80;
      const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
      return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;
    }
  } catch (_e) { /* fall through */ }
  return `fb-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ── DB open with resilience against invalid handle ────────────────────
async function openDB() {
  if (_db) {
    // Test the cached handle. If IndexedDB was closed by the browser
    // (mobile background kill, private-mode eviction), any transaction
    // start throws InvalidStateError. Detect and re-open.
    try {
      _db.transaction(STORE, 'readonly');
      return _db;
    } catch (_e) {
      _db = null; // fall through to reopen
    }
  }
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable — offline queue disabled'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
      }
      if (!db.objectStoreNames.contains(DEAD_STORE)) {
        const dead = db.createObjectStore(DEAD_STORE, { keyPath: 'id' });
        dead.createIndex('failedAt', 'failedAt');
      }
    };
    req.onsuccess = (e) => {
      _db = e.target.result;
      // Clear cached handle if the DB closes for any reason.
      _db.onclose = () => { _db = null; };
      _db.onerror = (evt) => console.warn('offlineQueue: db error', evt);
      resolve(_db);
    };
    req.onerror = (e) => reject(e.target.error || new Error('IndexedDB open failed'));
    req.onblocked = () => reject(new Error('IndexedDB blocked by another tab — refresh required'));
  });
}

// ── Enqueue with bounded size and richer metadata ─────────────────────
const MAX_OP_BYTES = 100_000; // 100 KB per queued op; a bill is ~2-5 KB

export async function enqueue(op) {
  const size = JSON.stringify(op).length;
  if (size > MAX_OP_BYTES) {
    throw new Error(`Offline op too large (${size} bytes); refusing to queue`);
  }
  const db = await openDB();
  const entry = {
    id: uuid(),
    createdAt: Date.now(),
    retries: 0,
    lastError: null,
    lastAttemptAt: null,
    ...op,
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).add(entry);
    tx.oncomplete = () => resolve(entry.id);
    tx.onerror = (e) => reject(e.target.error);
  });
}

async function updateEntry(op) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(op);
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

async function moveToDeadLetter(op, errorMessage) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE, DEAD_STORE], 'readwrite');
    const dead = {
      ...op,
      failedAt: Date.now(),
      finalError: String(errorMessage).slice(0, 500),
    };
    tx.objectStore(DEAD_STORE).put(dead);
    tx.objectStore(STORE).delete(op.id);
    tx.oncomplete = resolve;
    tx.onerror = (e) => reject(e.target.error);
  });
}

// ── Read helpers ──────────────────────────────────────────────────────
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
  try { return (await getPending()).length; } catch (_e) { return 0; }
}

// The dead-letter list — for a UI that shows failed writes so the shop
// owner can review them and decide to retry (move back to pending) or
// purge (drop entirely). Not exposed yet in any dashboard but ready
// for one.
export async function getFailedWrites() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DEAD_STORE, 'readonly');
    const req = tx.objectStore(DEAD_STORE).getAll();
    req.onsuccess = () => resolve(req.result.sort((a, b) => b.failedAt - a.failedAt));
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function getFailedCount() {
  try { return (await getFailedWrites()).length; } catch (_e) { return 0; }
}

export async function retryFailed(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE, DEAD_STORE], 'readwrite');
    const getReq = tx.objectStore(DEAD_STORE).get(id);
    getReq.onsuccess = () => {
      const op = getReq.result;
      if (!op) { resolve(false); return; }
      // Reset retry counter and move back to writes store
      const revived = { ...op, retries: 0, lastError: null, lastAttemptAt: null };
      delete revived.failedAt;
      delete revived.finalError;
      tx.objectStore(STORE).put(revived);
      tx.objectStore(DEAD_STORE).delete(id);
    };
    tx.oncomplete = () => resolve(true);
    tx.onerror = (e) => reject(e.target.error);
  });
}

export async function discardFailed(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DEAD_STORE, 'readwrite');
    tx.objectStore(DEAD_STORE).delete(id);
    tx.oncomplete = resolve;
    tx.onerror = (e) => reject(e.target.error);
  });
}

// ── Flush with per-op error surface and retry limits ─────────────────
export async function flush(supabaseClient) {
  let pending;
  try {
    pending = await getPending();
  } catch (e) {
    console.error('offlineQueue: getPending failed', e);
    return { flushed: 0, failed: 0, dead: 0 };
  }

  const results = { flushed: 0, failed: 0, dead: 0 };

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
      } else {
        throw new Error(`Unknown action: ${op.action}`);
      }
      await dequeue(op.id);
      results.flushed++;
    } catch (err) {
      const errMsg = err?.message || String(err);
      const retries = (op.retries || 0) + 1;
      console.warn('offlineQueue: op failed', {
        id: op.id, table: op.table, action: op.action, retries, error: errMsg,
      });

      if (retries >= MAX_RETRIES) {
        // Give up. Move to dead-letter so the pending badge stops lying
        // about a queue that will never drain, and the owner can review.
        try {
          await moveToDeadLetter(op, errMsg);
          results.dead++;
        } catch (moveErr) {
          console.error('offlineQueue: failed to move op to dead-letter', moveErr);
          results.failed++;
        }
      } else {
        try {
          await updateEntry({
            ...op, retries, lastError: errMsg.slice(0, 500), lastAttemptAt: Date.now(),
          });
          results.failed++;
        } catch (updErr) {
          console.error('offlineQueue: failed to update retry counter', updErr);
          results.failed++;
        }
      }
    }
  }

  if (results.dead > 0) {
    console.warn(`offlineQueue: ${results.dead} op(s) moved to dead-letter after ${MAX_RETRIES} retries`);
  }

  return results;
}

export async function clearAll() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE, DEAD_STORE], 'readwrite');
    tx.objectStore(STORE).clear();
    tx.objectStore(DEAD_STORE).clear();
    tx.oncomplete = resolve;
    tx.onerror = (e) => reject(e.target.error);
  });
}
