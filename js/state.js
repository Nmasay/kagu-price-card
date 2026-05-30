// --- アプリケーションの状態管理 ---

export const state = {
    // 印刷待ちキュー (localStorageから復元、または空配列)
    printQueue: JSON.parse(localStorage.getItem('kagu-price-card-queue')) || [],
    
    // ドラッグ中のアイテムのインデックス
    draggedItemIndex: null,
    
    // 現在選択されているスタンプテキスト
    currentStamp: '',
    
    // 現在選択されているスタンプ色（デフォルト: 赤）
    currentStampColor: '#e60000',
    
    // 現在編集中の商品コード (IndexedDBのID)
    editingProductCode: null,
    
    // 現在選択されているダメージマップ (デフォルトはなし)
    currentDamageMap: ''
};

// 状態をlocalStorageに保存するヘルパー関数
export function saveQueueToLocalStorage() {
    localStorage.setItem('kagu-price-card-queue', JSON.stringify(state.printQueue));
}
