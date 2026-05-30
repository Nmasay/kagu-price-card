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

// --- すべての商品データの取得 (IDの降順、新しい順) ---
export function getAllProductsFromDB(callback) {
    if (!db) {
        if (callback) callback([]);
        return;
    }
    const transaction = db.transaction(['products'], 'readonly');
    const store = transaction.objectStore('products');
    const products = [];
    
    // カーソルを'prev'（逆順）でオープンし、新規登録した商品が上に来るように取得
    const request = store.openCursor(null, 'prev');
    request.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
            products.push(cursor.value);
            cursor.continue();
        } else {
            if (callback) callback(products);
        }
    };
    request.onerror = (e) => {
        console.error('Failed to get all products from DB:', e.target.error);
        if (callback) callback([]);
    };
}

// --- 商品データの削除 ---
export function deleteProductFromDB(id, callback) {
    if (!db) {
        if (callback) callback(false);
        return;
    }
    const transaction = db.transaction(['products'], 'readwrite');
    const store = transaction.objectStore('products');
    const request = store.delete(id);
    
    request.onsuccess = () => {
        console.log(`[IndexedDB] 商品データを削除しました ID: ${id}`);
        if (callback) callback(true);
    };
    request.onerror = (e) => {
        console.error(`Failed to delete product ID: ${id} from DB:`, e.target.error);
        if (callback) callback(false);
    };
}

