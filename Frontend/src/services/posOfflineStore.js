/**
 * POS Offline Store — IndexedDB-based storage for offline POS operation.
 * 
 * Stores: products, categories, pending orders (queue), and config.
 * Uses a simple promise-based wrapper around IndexedDB.
 */

const DB_NAME = 'menuby_pos_offline';
const DB_VERSION = 1;

const STORES = {
  PRODUCTS: 'products',
  CATEGORIES: 'categories',
  ORDER_QUEUE: 'orderQueue',
  META: 'meta', // key-value for last sync time, order counter, etc.
};

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORES.PRODUCTS)) {
        db.createObjectStore(STORES.PRODUCTS, { keyPath: '_id' });
      }
      if (!db.objectStoreNames.contains(STORES.CATEGORIES)) {
        db.createObjectStore(STORES.CATEGORIES, { keyPath: '_id' });
      }
      if (!db.objectStoreNames.contains(STORES.ORDER_QUEUE)) {
        const store = db.createObjectStore(STORES.ORDER_QUEUE, { keyPath: 'offlineId' });
        store.createIndex('status', 'status', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.META)) {
        db.createObjectStore(STORES.META, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

// Generic helpers
async function getAll(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function putAll(storeName, items) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.clear(); // Replace all
    items.forEach(item => store.put(item));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function put(storeName, item) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.put(item);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function remove(storeName, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function getMeta(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.META, 'readonly');
    const store = tx.objectStore(STORES.META);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result?.value ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function setMeta(key, value) {
  return put(STORES.META, { key, value });
}

// ─── Products & Categories ─────────────────────────────

export async function cacheProducts(products) {
  await putAll(STORES.PRODUCTS, products);
  await setMeta('products_cached_at', Date.now());
}

export async function getCachedProducts() {
  return getAll(STORES.PRODUCTS);
}

export async function cacheCategories(categories) {
  await putAll(STORES.CATEGORIES, categories);
  await setMeta('categories_cached_at', Date.now());
}

export async function getCachedCategories() {
  return getAll(STORES.CATEGORIES);
}

// ─── Offline Order Queue ────────────────────────────────

/**
 * Queue an order for later sync.
 * offlineId = unique local identifier
 * status: 'pending_sync' | 'syncing' | 'synced' | 'error'
 */
export async function queueOfflineOrder(orderData) {
  const offlineId = `offline_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  
  // Generate a local order number
  const lastNum = (await getMeta('offline_order_counter')) || 0;
  const nextNum = lastNum + 1;
  await setMeta('offline_order_counter', nextNum);

  const offlineOrder = {
    offlineId,
    orderData,
    localOrderNumber: `L${nextNum}`,
    status: 'pending_sync',
    createdAt: new Date().toISOString(),
    attempts: 0,
    lastError: null,
  };

  await put(STORES.ORDER_QUEUE, offlineOrder);
  return offlineOrder;
}

export async function getPendingSyncOrders() {
  const all = await getAll(STORES.ORDER_QUEUE);
  return all.filter(o => o.status === 'pending_sync' || o.status === 'error');
}

export async function getAllQueuedOrders() {
  return getAll(STORES.ORDER_QUEUE);
}

export async function updateQueuedOrder(offlineId, updates) {
  const all = await getAll(STORES.ORDER_QUEUE);
  const order = all.find(o => o.offlineId === offlineId);
  if (!order) return null;
  const updated = { ...order, ...updates };
  await put(STORES.ORDER_QUEUE, updated);
  return updated;
}

export async function removeQueuedOrder(offlineId) {
  await remove(STORES.ORDER_QUEUE, offlineId);
}

export async function clearSyncedOrders() {
  const all = await getAll(STORES.ORDER_QUEUE);
  const synced = all.filter(o => o.status === 'synced');
  for (const o of synced) {
    await remove(STORES.ORDER_QUEUE, o.offlineId);
  }
  return synced.length;
}

// ─── Cache status ───────────────────────────────────────

export async function getCacheStatus() {
  const productsCachedAt = await getMeta('products_cached_at');
  const categoriesCachedAt = await getMeta('categories_cached_at');
  const pending = await getPendingSyncOrders();
  return {
    productsCachedAt,
    categoriesCachedAt,
    hasCachedData: !!productsCachedAt,
    pendingSyncCount: pending.length,
  };
}
