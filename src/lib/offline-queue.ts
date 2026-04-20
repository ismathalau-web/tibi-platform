'use client';

/**
 * Minimal IndexedDB-backed offline queue for POS sales.
 * Keys are ms timestamps; values are the serialised createSale input.
 * Consumer calls `flush()` whenever the app detects online state.
 */

const DB_NAME = 'tibi-offline';
const STORE = 'pending-sales';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export interface QueuedSale<T = unknown> {
  id: number;
  payload: T;
  queued_at: string;
}

export async function enqueueSale<T>(payload: T): Promise<QueuedSale<T>> {
  const db = await open();
  const entry: QueuedSale<T> = { id: Date.now(), payload, queued_at: new Date().toISOString() };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return entry;
}

export async function allSales<T>(): Promise<QueuedSale<T>[]> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as QueuedSale<T>[]);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteSale(id: number): Promise<void> {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function flush<T>(send: (payload: T) => Promise<{ ok: boolean }>): Promise<{ sent: number; failed: number }> {
  const pending = await allSales<T>();
  let sent = 0, failed = 0;
  for (const row of pending) {
    try {
      const res = await send(row.payload);
      if (res.ok) {
        await deleteSale(row.id);
        sent += 1;
      } else {
        failed += 1;
      }
    } catch {
      failed += 1;
    }
  }
  return { sent, failed };
}
