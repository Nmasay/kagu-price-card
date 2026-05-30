import { state } from './state.js';

let db = null;

// --- IndexedDB 初期化 ---
export function initDB(callback) {
    const dbRequest = indexedDB.open('kaguPriceCardDB', 1);
    dbRequest.onupgradeneeded = (e) => {
        const database = e.target.result;
        if (!database.objectStoreNames.contains('products')) {
            database.createObjectStore('products', { keyPath: 'id', autoIncrement: true });
        }
    };
    dbRequest.onsuccess = (e) => {
        db = e.target.result;
        console.log('IndexedDB initialized successfully.');
        if (callback) callback(db);
    };
    dbRequest.onerror = (e) => {
        console.error('IndexedDB open error:', e.target.error);
    };
}

// --- 商品データの保存 (新規追加または上書き保存) ---
export function saveProductToDB(productData, callback, existingProductCode) {
    if (!db) {
        console.warn('Database not ready. Callback with fallback.');
        if (callback) callback(null);
        return;
    }
    const transaction = db.transaction(['products'], 'readwrite');
    const store = transaction.objectStore('products');
    
    // 引数がない場合は現在編集中のグローバル変数をフォールバックして使用する
    const codeToUse = existingProductCode || state.editingProductCode;

    let request;
    if (codeToUse) {
        const id = parseInt(codeToUse, 10);
        productData.id = id;
        request = store.put(productData);
        console.log(`[IndexedDB] 上書き保存実行 ID: ${id}`);
    } else {
        request = store.add(productData);
        console.log(`[IndexedDB] 新規追加実行`);
    }

    request.onsuccess = (e) => {
        const id = e.target.result;
        const productCode = String(id).padStart(5, '0');
        if (callback) callback(productCode);
    };
    request.onerror = (e) => {
        console.error('Failed to save product to DB:', e.target.error);
        if (callback) callback(null);
    };
}

// --- 商品データの取得 ---
export function getProductFromDB(id, callback) {
    if (!db) {
        if (callback) callback(null);
        return;
    }
    const transaction = db.transaction(['products'], 'readonly');
    const store = transaction.objectStore('products');
    const request = store.get(id);
    request.onsuccess = (e) => {
        if (callback) callback(e.target.result);
    };
    request.onerror = (e) => {
        console.error('Failed to get product from DB:', e.target.error);
        if (callback) callback(null);
    };
}
