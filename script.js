document.addEventListener('DOMContentLoaded', () => {
    // --- IndexedDB 初期化 (永久商品台帳データベース) ---
    let db;
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
    };
    dbRequest.onerror = (e) => {
        console.error('IndexedDB open error:', e.target.error);
    };

    function saveProductToDB(productData, callback) {
        if (!db) {
            console.warn('Database not ready. Callback with fallback.');
            if (callback) callback(null);
            return;
        }
        const transaction = db.transaction(['products'], 'readwrite');
        const store = transaction.objectStore('products');
        const request = store.add(productData);
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

    function getProductFromDB(id, callback) {
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

    // --- 定数 (Constants) ---
    const BARCODE_PREFIX_USED = 20438000000n;
    const BARCODE_PREFIX_NEW = 20451000000n;
    const HISTORY_MAX_ITEMS = 100;

    // --- DOM要素 ---
    const titleInput = document.getElementById('product-title');
    const titleFontSizeInput = document.getElementById('title-font-size');
    const titleFontSizeValueSpan = document.getElementById('title-font-size-value');
    const conditionSelect = document.getElementById('condition');
    const notesTextarea = document.getElementById('notes');
    const notesFontSizeInput = document.getElementById('notes-font-size');
    const notesFontSizeValueSpan = document.getElementById('notes-font-size-value');
    const priceInput = document.getElementById('price');
    const deliveryOptionsSelect = document.getElementById('delivery-options');
    
    // ボタン・コンテナ群
    const printButton = document.getElementById('print-button');
    const addToListButton = document.getElementById('add-to-list-button');
    const clearFormButton = document.getElementById('clear-form-button');
    const batchPrintButton = document.getElementById('batch-print-button');
    const clearQueueButton = document.getElementById('clear-queue-button');
    const exportCsvButton = document.getElementById('export-csv-button');
    const restoreBarcodeInput = document.getElementById('restore-barcode-input');
    const printQueueList = document.getElementById('print-queue-list');
    const queueCountSpan = document.getElementById('queue-count');
    const printBatchContainer = document.getElementById('print-batch-container');

    const previewTitle = document.getElementById('preview-title');
    const previewCondition = document.getElementById('preview-condition');
    const previewNotes = document.getElementById('preview-notes');
    const previewPrice = document.getElementById('preview-price');
    const barcodeSvg = document.getElementById('barcode');
    const previewDeliveryOptions = document.getElementById('preview-delivery-options');
    const timestampDiv = document.getElementById('timestamp');

    const titleHistoryListDiv = document.getElementById('title-history-list');
    const notesHistoryListDiv = document.getElementById('notes-history-list');

    // --- 印刷待ちキュー ---
    // localStorageから保存済みのキューを取得、なければ空配列
    let printQueue = JSON.parse(localStorage.getItem('kagu-price-card-queue')) || [];
    let draggedItemIndex = null; // ドラッグ中のアイテムインデックスを保持
    let currentStamp = ''; // 現在選択されているスタンプ

    // --- スタンプボタンの初期化 ---
    const stampButtons = document.querySelectorAll('.stamp-btn');
    const previewStamp = document.getElementById('preview-stamp');
    const customStampInput = document.getElementById('custom-stamp-input');
    const clearStampBtn = document.querySelector('.clear-stamp-btn');
    
    // --- ダメージマップ要素の取得 ---
    const damageMapSelect = document.getElementById('damage-map-select');
    const previewDamageMap = document.getElementById('preview-damage-map');
    let currentDamageMap = ''; // デフォルトはなし

    // --- ダメージマップのSVG定義 ---
    const damageMapSVGs = {
        'sofa': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M10,35 C10,25 20,20 50,20 C80,20 90,25 90,35 L90,75 L10,75 Z M10,45 C10,40 18,40 18,45 L18,75 L10,75 Z M90,45 C90,40 82,40 82,45 L82,75 L90,75 Z"/><line x1="50" y1="20" x2="50" y2="55"/><path d="M18,55 L82,55 C82,55 82,75 82,75 L18,75 Z"/><line x1="50" y1="55" x2="50" y2="75"/><line x1="15" y1="75" x2="15" y2="85"/><line x1="85" y1="75" x2="85" y2="85"/></svg>',
        'chair': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M30,15 L70,15 L65,45 L35,45 Z"/><line x1="40" y1="15" x2="42" y2="45"/><line x1="50" y1="15" x2="50" y2="45"/><line x1="60" y1="15" x2="58" y2="45"/><polygon points="30,45 70,45 75,55 25,55"/><line x1="27" y1="55" x2="27" y2="90"/><line x1="73" y1="55" x2="73" y2="90"/><line x1="35" y1="45" x2="38" y2="85"/><line x1="65" y1="45" x2="62" y2="85"/><line x1="31" y1="70" x2="69" y2="70"/></svg>',
        'table': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><polygon points="10,35 70,35 90,20 30,20"/><polygon points="10,35 70,35 70,39 10,39"/><polygon points="70,35 90,20 90,24 70,39"/><rect x="12" y="39" width="6" height="45"/><rect x="64" y="39" width="6" height="45"/><rect x="84" y="24" width="5" height="45"/><rect x="32" y="24" width="5" height="42"/></svg>',
        'cabinet_tall': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="25" y="10" width="50" height="80" rx="3"/><rect x="29" y="14" width="20" height="36"/><rect x="51" y="14" width="20" height="36"/><line x1="29" y1="26" x2="49" y2="26"/><line x1="29" y1="38" x2="49" y2="38"/><line x1="51" y1="26" x2="71" y2="26"/><line x1="51" y1="38" x2="71" y2="38"/><line x1="46" y1="30" x2="46" y2="34"/><line x1="54" y1="30" x2="54" y2="34"/><rect x="29" y="54" width="42" height="10"/><rect x="29" y="66" width="42" height="10"/><rect x="29" y="78" width="42" height="10"/><line x1="45" y1="59" x2="55" y2="59"/><line x1="45" y1="71" x2="55" y2="71"/><line x1="45" y1="83" x2="55" y2="83"/></svg>',
        'cabinet_wide': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="10" y="30" width="80" height="40" rx="2"/><rect x="38" y="34" width="24" height="32"/><line x1="38" y1="50" x2="62" y2="50"/><rect x="14" y="34" width="20" height="32"/><rect x="66" y="34" width="20" height="32"/><circle cx="30" cy="50" r="2"/><circle cx="70" cy="50" r="2"/><line x1="15" y1="70" x2="12" y2="82"/><line x1="25" y1="70" x2="25" y2="82"/><line x1="75" y1="70" x2="75" y2="82"/><line x1="85" y1="70" x2="88" y2="82"/></svg>',
        'cupboard': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="25" y="10" width="50" height="80" rx="3"/><rect x="29" y="14" width="42" height="26"/><line x1="50" y1="14" x2="50" y2="40"/><line x1="29" y1="22" x2="71" y2="22"/><line x1="29" y1="31" x2="71" y2="31"/><circle cx="47" cy="27" r="1"/><circle cx="53" cy="27" r="1"/><rect x="29" y="44" width="42" height="12"/><rect x="33" y="47" width="16" height="9"/><rect x="35" y="49" width="10" height="5"/><rect x="29" y="60" width="20" height="26"/><rect x="51" y="60" width="20" height="26"/><line x1="45" y1="70" x2="45" y2="76"/><line x1="55" y1="70" x2="55" y2="76"/></svg>',
        'bed': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="10" y="30" width="6" height="50" rx="1"/><rect x="16" y="68" width="74" height="6" rx="1"/><rect x="18" y="74" width="5" height="10"/><rect x="78" y="74" width="5" height="10"/><rect x="16" y="52" width="74" height="16" rx="1"/><rect x="20" y="44" width="16" height="8" rx="2"/><path d="M40,50 L86,50 C88,50 90,52 90,54 L90,64 C90,66 88,68 86,68 L76,68"/><line x1="56" y1="50" x2="56" y2="68"/><line x1="72" y1="50" x2="72" y2="68"/></svg>',
        'color_box': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="25" y="10" width="50" height="80" rx="3"/><rect x="29" y="14" width="42" height="22"/><line x1="29" y1="36" x2="71" y2="36"/><rect x="29" y="39" width="42" height="22"/><line x1="29" y1="61" x2="71" y2="61"/><rect x="29" y="64" width="42" height="22"/><line x1="29" y1="14" x2="35" y2="20"/><line x1="71" y1="14" x2="65" y2="20"/><line x1="35" y1="20" x2="65" y2="20"/><line x1="35" y1="20" x2="35" y2="36"/><line x1="65" y1="20" x2="65" y2="36"/><line x1="29" y1="39" x2="35" y2="45"/><line x1="71" y1="39" x2="65" y2="45"/><line x1="35" y1="45" x2="65" y2="45"/><line x1="35" y1="45" x2="35" y2="61"/><line x1="65" y1="45" x2="65" y2="61"/><line x1="29" y1="64" x2="35" y2="70"/><line x1="71" y1="64" x2="65" y2="70"/><line x1="35" y1="70" x2="65" y2="70"/><line x1="35" y1="70" x2="35" y2="86"/><line x1="65" y1="70" x2="65" y2="86"/></svg>',
        'circle': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="30"/></svg>',
        'rect_vertical': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="30" y="15" width="40" height="70" rx="4"/></svg>',
        'rect_horizontal': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="15" y="30" width="70" height="40" rx="4"/></svg>',
        'square': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="20" y="20" width="60" height="60" rx="4"/></svg>'
    };

    stampButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            stampButtons.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            currentStamp = btn.dataset.stamp;
            if (customStampInput) customStampInput.value = ''; // プリセット選択時は自由入力をクリア
            updatePreview();
        });
    });

    // ダメージマップセレクトボックスのイベント
    if (damageMapSelect) {
        damageMapSelect.addEventListener('change', (e) => {
            currentDamageMap = e.target.value;
            updatePreview();
        });
    }

    if (customStampInput) {
        customStampInput.addEventListener('input', (e) => {
            currentStamp = e.target.value.trim();
            // プリセットボタンの選択状態を解除
            stampButtons.forEach(b => b.classList.remove('selected'));
            if (currentStamp === '' && clearStampBtn) {
                clearStampBtn.classList.add('selected');
            }
            updatePreview();
        });
    }
    
    // 初期状態で「なし」を選択
    if (clearStampBtn) clearStampBtn.classList.add('selected');

    // --- 履歴管理用クラス ---
    class HistoryManager {
        constructor(storageKey, inputElement, listElement, updateCallback) {
            this.storageKey = storageKey;
            this.inputElement = inputElement;
            this.listElement = listElement;
            this.updateCallback = updateCallback;

            this.initEvents();
        }

        getHistory() {
            return JSON.parse(localStorage.getItem(this.storageKey)) || [];
        }

        setHistory(history) {
            localStorage.setItem(this.storageKey, JSON.stringify(history));
        }

        add(item) {
            if (!item) return;
            let history = this.getHistory();
            if (!history.includes(item)) {
                history.unshift(item);
                if (history.length > HISTORY_MAX_ITEMS) {
                    history = history.slice(0, HISTORY_MAX_ITEMS);
                }
                this.setHistory(history);
            }
        }

        remove(item) {
            let history = this.getHistory();
            history = history.filter(h => h !== item);
            this.setHistory(history);
            this.renderList();
        }

        renderList() {
            if (!this.listElement) return;
            const history = this.getHistory();
            this.listElement.innerHTML = '';

            const filterText = this.inputElement.value.trim().toLowerCase();
            const filteredHistory = history.filter(item => item.toLowerCase().includes(filterText));

            filteredHistory.forEach(item => {
                const itemDiv = document.createElement('div');
                itemDiv.classList.add('history-item');

                const textSpan = document.createElement('span');
                textSpan.textContent = item;
                textSpan.addEventListener('mousedown', (event) => {
                    event.preventDefault(); // フォーカス外れを防ぐ
                    this.inputElement.value = item;
                    this.listElement.style.display = 'none';
                    if (this.updateCallback) this.updateCallback();
                });

                const deleteButton = document.createElement('button');
                deleteButton.innerHTML = '&times;';
                deleteButton.title = '履歴から削除';
                deleteButton.addEventListener('mousedown', (event) => {
                    event.preventDefault(); // フォーカス外れを防ぐ
                    event.stopPropagation();
                    this.remove(item);
                });

                itemDiv.appendChild(textSpan);
                itemDiv.appendChild(deleteButton);
                this.listElement.appendChild(itemDiv);
            });

            this.listElement.style.display = filteredHistory.length > 0 ? 'block' : 'none';
        }

        initEvents() {
            this.inputElement.addEventListener('input', () => {
                this.renderList();
                if (this.updateCallback) this.updateCallback();
            });

            this.inputElement.addEventListener('focus', () => {
                this.renderList();
            });

            this.inputElement.addEventListener('blur', () => {
                this.add(this.inputElement.value.trim());
                if (this.listElement) {
                    this.listElement.style.display = 'none';
                }
            });
        }
    }

    // 履歴マネージャーのインスタンス化
    const titleHistory = new HistoryManager('productTitleHistory', titleInput, titleHistoryListDiv, updatePreview);
    const notesHistory = new HistoryManager('productNotesHistory', notesTextarea, notesHistoryListDiv, updatePreview);

    // --- ユーティリティ ---
    function calculateEan13CheckDigit(digits) {
        if (digits.length !== 12) return null;
        let sum = 0;
        for (let i = 0; i < 12; i++) {
            const digit = parseInt(digits[i], 10);
            sum += (i % 2 === 0) ? digit : digit * 3;
        }
        return ((10 - (sum % 10)) % 10).toString();
    }

    function generateBarcodeValue(price, condition) {
        price = parseInt(price, 10) || 0;
        const baseNumber = condition === '中古' ? BARCODE_PREFIX_USED : BARCODE_PREFIX_NEW;
        try {
            const totalNumber = baseNumber + BigInt(price);
            let barcodeDigits = totalNumber.toString().slice(-12).padStart(12, '0');
            const checkDigit = calculateEan13CheckDigit(barcodeDigits);
            if (checkDigit !== null) {
                return barcodeDigits + checkDigit;
            }
        } catch (e) {
            console.error("Barcode generation error:", e);
        }
        return null;
    }

    function renderBarcode(svgElement, finalBarcodeValue) {
        if (finalBarcodeValue) {
            JsBarcode(svgElement, finalBarcodeValue, {
                format: "EAN13",
                width: 1.5,
                height: 25,
                displayValue: true,
                fontSize: 12,
                margin: 5,
                background: "transparent",
                textPosition: "bottom",
                textMargin: 2,
                font: "Arial"
            });
            svgElement.style.display = 'block';
        } else {
            svgElement.style.display = 'none';
        }
    }

    function getFormattedTimestamp() {
        const now = new Date();
        const year = now.getFullYear();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        return `作成日時: ${year}/${month}/${day} ${hours}:${minutes}`;
    }

    function calculateTitleMinHeight(fontSizeInput) {
        const maxAttr = fontSizeInput.getAttribute('max');
        const maxSingleLineFontSize = maxAttr ? parseFloat(maxAttr) : 60;
        const assumedLineHeightRatio = 1.2;
        const singleLineMaxHeight = maxSingleLineFontSize * assumedLineHeightRatio;
        const multiLineMaxHeight = 40 * assumedLineHeightRatio * 2;
        return Math.max(singleLineMaxHeight, multiLineMaxHeight);
    }

    function autoFitText(element, sliderInput, sliderValueSpan, startSize, minSize, checkCardOverflow = false) {
        let currentSize = parseInt(startSize, 10);
        element.style.fontSize = currentSize + 'px';
        const card = element.closest('.price-card-template');
        
        while (currentSize > minSize) {
            let isOverflowing = false;
            if (element.scrollWidth > element.clientWidth) {
                isOverflowing = true;
            } else if (element.scrollHeight > element.clientHeight) {
                isOverflowing = true;
            } else if (checkCardOverflow && card && card.scrollHeight > card.clientHeight) {
                isOverflowing = true;
            }
            
            if (!isOverflowing) break;
            
            currentSize--;
            element.style.fontSize = currentSize + 'px';
        }
        
        sliderInput.value = currentSize;
        if (sliderValueSpan) {
            sliderValueSpan.textContent = currentSize;
        }
    }

    let isAutoFittingTitle = false;
    let isAutoFittingNotes = false;

    // --- プレビュー更新関数 ---
    function updatePreview() {
        const isTitleMultiLine = titleInput.value.includes('\n');
        const titleFontSize = isTitleMultiLine ? 45 : parseInt(titleFontSizeInput.value, 10);

        titleFontSizeInput.value = titleFontSize;
        titleFontSizeValueSpan.textContent = titleFontSize;
        previewTitle.textContent = titleInput.value || '商品タイトル';
        previewTitle.style.fontSize = titleFontSize + 'px';
        previewTitle.style.minHeight = calculateTitleMinHeight(titleFontSizeInput) + 'px';

        const selectedOption = conditionSelect.options[conditionSelect.selectedIndex];
        previewCondition.textContent = selectedOption ? selectedOption.text : '中古';

        previewNotes.textContent = notesTextarea.value || '';
        previewNotes.style.fontSize = notesFontSizeInput.value + 'px';

        if (deliveryOptionsSelect && previewDeliveryOptions) {
            const selectedDeliveryOption = deliveryOptionsSelect.options[deliveryOptionsSelect.selectedIndex];
            previewDeliveryOptions.textContent = selectedDeliveryOption ? selectedDeliveryOption.text : '';
        }

        const priceValue = parseInt(priceInput.value, 10);
        previewPrice.textContent = !isNaN(priceValue) ? `¥${priceValue.toLocaleString()}` : '¥---';
        previewPrice.style.fontSize = '60px'; // 70pxから60pxへ縮小

        const barcodeVal = generateBarcodeValue(priceInput.value, conditionSelect.value);
        renderBarcode(barcodeSvg, barcodeVal);

        timestampDiv.textContent = getFormattedTimestamp();

        // スタンプの反映
        if (currentStamp) {
            previewStamp.textContent = currentStamp;
            previewStamp.classList.add('active');
        } else {
            previewStamp.classList.remove('active');
        }

        // ダメージマップの反映
        if (currentDamageMap && damageMapSVGs[currentDamageMap]) {
            previewDamageMap.innerHTML = damageMapSVGs[currentDamageMap];
        } else {
            previewDamageMap.innerHTML = '';
        }
        
        if (isAutoFittingTitle) {
            isAutoFittingTitle = false;
            autoFitText(previewTitle, titleFontSizeInput, titleFontSizeValueSpan, titleFontSizeInput.value, 20, false);
        }
        
        if (isAutoFittingNotes) {
            isAutoFittingNotes = false;
            autoFitText(previewNotes, notesFontSizeInput, notesFontSizeValueSpan, notesFontSizeInput.value, 15, true);
        }
        
        // プレビューの高さ変化に合わせて3カラムのボトムラインを瞬時に同期
        syncQueueHeight();
    }

    // --- 印刷待ちキュー管理 ---
    function syncQueueHeight() {
        const form = document.getElementById('input-form');
        const previewColumn = document.querySelector('.preview-column');
        const queueSection = document.getElementById('print-queue-section');
        
        if (form && previewColumn && queueSection) {
            // リセットして正確な元の高さを測る
            form.style.minHeight = 'auto';
            previewColumn.style.minHeight = 'auto';
            queueSection.style.height = 'auto';
            
            // 画面下のラインを完璧に揃えるため、入力フォームと中央プレビューのうち背が高い方に高さを合わせる
            const maxHeight = Math.max(form.offsetHeight, previewColumn.offsetHeight);
            
            form.style.minHeight = maxHeight + 'px';
            previewColumn.style.minHeight = maxHeight + 'px';
            queueSection.style.height = maxHeight + 'px';
        }
    }

    function updateQueueUI() {
        // 現在のキュー状態をlocalStorageに保存
        localStorage.setItem('kagu-price-card-queue', JSON.stringify(printQueue));

        queueCountSpan.textContent = printQueue.length;
        printQueueList.innerHTML = '';
        
        const selectAllCheckbox = document.getElementById('select-all-checkbox');
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = printQueue.length > 0 && printQueue.every(item => item.selected !== false);
            selectAllCheckbox.onchange = (e) => {
                const isChecked = e.target.checked;
                printQueue.forEach(item => item.selected = isChecked);
                updateQueueUI();
            };
        }

        printQueue.forEach((item, index) => {
            const li = document.createElement('li');
            li.draggable = true;

            // ドラッグ＆ドロップのイベント設定
            li.addEventListener('dragstart', (e) => {
                draggedItemIndex = index;
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', index); // Firefox等で必要
                setTimeout(() => li.style.opacity = '0.5', 0);
            });

            li.addEventListener('dragend', () => {
                li.style.opacity = '1';
                draggedItemIndex = null;
            });

            li.addEventListener('dragover', (e) => {
                e.preventDefault(); // ドロップを許可するために必須
                e.dataTransfer.dropEffect = 'move';
            });

            li.addEventListener('dragenter', (e) => {
                e.preventDefault();
                if (draggedItemIndex !== null && draggedItemIndex !== index) {
                    li.classList.add('drag-over');
                }
            });

            li.addEventListener('dragleave', () => {
                li.classList.remove('drag-over');
            });

            li.addEventListener('drop', (e) => {
                e.preventDefault();
                li.classList.remove('drag-over');
                if (draggedItemIndex === null || draggedItemIndex === index) return;

                // 配列内の順序を入れ替える
                const draggedItem = printQueue.splice(draggedItemIndex, 1)[0];
                printQueue.splice(index, 0, draggedItem);
                updateQueueUI();
            });

            // 左側：ドラッグハンドルとチェックボックス
            const checkboxDiv = document.createElement('div');
            checkboxDiv.classList.add('queue-item-controls');
            
            const dragHandle = document.createElement('span');
            dragHandle.innerHTML = '&#9776;'; // ☰ アイコン
            dragHandle.classList.add('drag-handle');
            dragHandle.title = 'ドラッグして移動';
            checkboxDiv.appendChild(dragHandle);

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.classList.add('queue-item-checkbox');
            checkbox.checked = item.selected !== false;
            checkbox.onchange = (e) => {
                item.selected = e.target.checked;
                updateQueueUI();
            };
            checkboxDiv.appendChild(checkbox);
            
            // 中央：情報 (プレビュー風の3行レイアウト)
            const infoDiv = document.createElement('div');
            infoDiv.classList.add('queue-item-info');
            infoDiv.style.display = 'flex';
            infoDiv.style.flexDirection = 'column';
            infoDiv.style.gap = '6px';
            infoDiv.style.margin = '0 10px';
            
            // 行1: スタンプ、状態
            const row1 = document.createElement('div');
            row1.style.display = 'flex';
            row1.style.justifyContent = 'flex-start';
            row1.style.gap = '8px';
            row1.style.alignItems = 'center';
            row1.style.fontSize = '0.75em';
            row1.style.fontWeight = 'bold';
            
            const stampSpan = document.createElement('span');
            stampSpan.style.color = 'white';
            stampSpan.style.backgroundColor = '#e60000';
            stampSpan.style.padding = '2px 6px';
            stampSpan.style.borderRadius = '4px';
            stampSpan.style.fontSize = '0.7em';
            stampSpan.textContent = item.stampText ? item.stampText : '';
            if (!item.stampText) stampSpan.style.visibility = 'hidden';

            const conditionSpan = document.createElement('span');
            conditionSpan.textContent = item.condition || '中古';
            conditionSpan.style.color = item.condition === '中古' ? '#d9534f' : '#5cb85c';
            
            row1.appendChild(stampSpan);
            row1.appendChild(conditionSpan);

            // 行2: 商品名
            const row2 = document.createElement('div');
            row2.style.display = 'block';
            
            const titleSpan = document.createElement('div');
            titleSpan.style.fontWeight = 'bold';
            titleSpan.style.fontSize = '0.8em';
            titleSpan.style.overflow = 'hidden';
            titleSpan.style.textOverflow = 'ellipsis';
            titleSpan.style.whiteSpace = 'nowrap';
            titleSpan.textContent = item.title || '(名称未入力)';
            
            row2.appendChild(titleSpan);

            // 行3: 金額
            const priceRow = document.createElement('div');
            priceRow.style.textAlign = 'right';
            
            const priceSpan = document.createElement('span');
            priceSpan.style.fontWeight = 'bold';
            priceSpan.style.fontSize = '1.1em';
            priceSpan.style.color = '#333';
            priceSpan.textContent = !isNaN(item.price) ? `¥${item.price.toLocaleString()}` : '¥---';
            
            priceRow.appendChild(priceSpan);

            // 行4: 備考
            const row3 = document.createElement('div');
            row3.style.fontSize = '0.75em';
            row3.style.color = '#555';
            row3.textContent = item.notes ? item.notes.replace(/\n/g, ' ') : '';
            if (!item.notes) row3.style.display = 'none';

            infoDiv.appendChild(row1);
            infoDiv.appendChild(row2);
            infoDiv.appendChild(priceRow);
            infoDiv.appendChild(row3);

            // 右側：アクションボタン（編集、上、下、削除）
            const actionsDiv = document.createElement('div');
            actionsDiv.classList.add('queue-item-controls');

            const editBtn = document.createElement('button');
            editBtn.innerHTML = '✎';
            editBtn.classList.add('move-btn');
            editBtn.title = 'フォームに読み込む（再編集）';
            editBtn.onclick = () => {
                // フォームに値を復元
                titleInput.value = item.title;
                titleFontSizeInput.value = item.titleFontSize;
                conditionSelect.value = item.condition;
                notesTextarea.value = item.notes;
                notesFontSizeInput.value = item.notesFontSize;
                priceInput.value = isNaN(item.price) ? '' : item.price;
                
                if (deliveryOptionsSelect && item.deliveryOptionText) {
                    for (let i = 0; i < deliveryOptionsSelect.options.length; i++) {
                        if (deliveryOptionsSelect.options[i].text === item.deliveryOptionText) {
                            deliveryOptionsSelect.selectedIndex = i;
                            break;
                        }
                    }
                }

                // スライダーの表示値を更新
                if (titleFontSizeValueSpan) titleFontSizeValueSpan.textContent = item.titleFontSize;
                if (notesFontSizeValueSpan) notesFontSizeValueSpan.textContent = item.notesFontSize;

                // スタンプの復元
                currentStamp = item.stampText || '';
                let matchedPreset = false;
                stampButtons.forEach(b => {
                    b.classList.remove('selected');
                    if (currentStamp && b.dataset.stamp === currentStamp) {
                        b.classList.add('selected');
                        matchedPreset = true;
                    }
                });

                if (!currentStamp) {
                    if (clearStampBtn) clearStampBtn.classList.add('selected');
                    if (customStampInput) customStampInput.value = '';
                } else if (!matchedPreset) {
                    // プリセットにない文字なら自由入力欄に入れる
                    if (customStampInput) customStampInput.value = currentStamp;
                } else {
                    if (customStampInput) customStampInput.value = '';
                }

                // ダメージマップの復元
                currentDamageMap = item.damageMap || '';
                if (damageMapSelect) {
                    damageMapSelect.value = currentDamageMap;
                }

                updatePreview();
                
                // 画面上部へスクロール
                window.scrollTo({ top: 0, behavior: 'smooth' });
            };
            actionsDiv.appendChild(editBtn);

            const removeBtn = document.createElement('button');
            removeBtn.innerHTML = '&times;';
            removeBtn.classList.add('danger-button');
            removeBtn.title = '削除';
            removeBtn.style.padding = '3px 8px'; // 少し小さめに
            removeBtn.onclick = () => {
                printQueue.splice(index, 1);
                updateQueueUI();
            };
            actionsDiv.appendChild(removeBtn);

            li.appendChild(checkboxDiv);
            li.appendChild(infoDiv);
            li.appendChild(actionsDiv);
            printQueueList.appendChild(li);
        });

        const hasItems = printQueue.length > 0;
        const hasSelectedItems = printQueue.some(item => item.selected !== false);
        batchPrintButton.disabled = !hasSelectedItems;
        clearQueueButton.disabled = !hasItems;
        if (exportCsvButton) {
            exportCsvButton.disabled = !hasItems;
        }
        
        syncQueueHeight();
    }

    addToListButton.addEventListener('click', () => {
        const itemData = {
            title: titleInput.value.trim(),
            titleFontSize: titleFontSizeInput.value,
            condition: conditionSelect.value,
            notes: notesTextarea.value,
            notesFontSize: notesFontSizeInput.value,
            deliveryOptionText: deliveryOptionsSelect ? deliveryOptionsSelect.options[deliveryOptionsSelect.selectedIndex].text : '',
            price: parseInt(priceInput.value, 10),
            stampText: currentStamp,
            damageMap: currentDamageMap
        };

        // リスト追加前に IndexedDB 永久台帳に自動保存し、一意の商品コードを取得
        saveProductToDB(itemData, (productCode) => {
            const item = {
                ...itemData,
                productCode: productCode,
                selected: true // 追加時はデフォルトで選択状態
            };
            printQueue.unshift(item); // 先頭に追加する
            updateQueueUI();
            
            // 追加後、入力フォームをクリア
            titleInput.value = '';
            notesTextarea.value = '';
            priceInput.value = '';
            currentStamp = '';
            currentDamageMap = '';
            stampButtons.forEach(b => b.classList.remove('selected'));
            if (clearStampBtn) clearStampBtn.classList.add('selected');
            if (customStampInput) customStampInput.value = '';
            if (damageMapSelect) damageMapSelect.value = '';
            
            updatePreview();
        });
    });

    if (clearFormButton) {
        clearFormButton.addEventListener('click', () => {
            titleInput.value = '';
            titleFontSizeInput.value = '55'; // 初期値
            conditionSelect.selectedIndex = 0; // 中古
            notesTextarea.value = '';
            notesFontSizeInput.value = '30'; // 初期値
            if (deliveryOptionsSelect) deliveryOptionsSelect.selectedIndex = 0;
            priceInput.value = '';
            
            // スライダー横のテキストを更新
            if (titleFontSizeValueSpan) titleFontSizeValueSpan.textContent = '55';
            if (notesFontSizeValueSpan) notesFontSizeValueSpan.textContent = '30';
            
            // スタンプのクリア
            currentStamp = '';
            currentDamageMap = '';
            stampButtons.forEach(b => b.classList.remove('selected'));
            if (clearStampBtn) clearStampBtn.classList.add('selected');
            if (customStampInput) customStampInput.value = '';
            if (damageMapSelect) damageMapSelect.value = '';
            
            updatePreview();
            
            // ユーザー指定: クリアした後にページをリロードする
            location.reload();
        });
    }

    clearQueueButton.addEventListener('click', () => {
        if (confirm('印刷待ちリストをすべてクリアしますか？')) {
            printQueue = [];
            updateQueueUI();
        }
        // リスト更新後に高さを同期
        syncQueueHeight();
    });

    // ウィンドウリサイズ時にも高さを同期
    window.addEventListener('resize', syncQueueHeight);

    // --- CSV一括書き出し処理 ---
    function exportToCSV() {
        if (printQueue.length === 0) return;

        const headers = ['商品名', '金額', '状態', '備考', 'タイトルフォントサイズ', '備考フォントサイズ', '配送オプション', 'スタンプ', 'ダメージマップ'];
        
        function escapeCSVField(field) {
            if (field === null || field === undefined) return '';
            const str = String(field);
            if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
                return '"' + str.replace(/"/g, '""') + '"';
            }
            return str;
        }

        const csvRows = [headers.map(escapeCSVField).join(',')];

        printQueue.forEach(item => {
            const row = [
                item.title || '',
                isNaN(item.price) ? '' : item.price,
                item.condition || '中古',
                item.notes || '',
                item.titleFontSize || 50,
                item.notesFontSize || 30,
                item.deliveryOptionText || '',
                item.stampText || '',
                item.damageMap || ''
            ];
            csvRows.push(row.map(escapeCSVField).join(','));
        });

        // Excelの文字化けを防ぐため、UTF-8 BOM (\uFEFF) を付与
        const csvContent = '\uFEFF' + csvRows.join('\n');
        window.lastExportedCSV = csvContent; // デバッグ用

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', 'price_cards.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    if (exportCsvButton) {
        exportCsvButton.addEventListener('click', exportToCSV);
    }

    // --- 復元用バーコード生成・描画ロジック ---
    function getStampCode(stamp) {
        if (!stamp) return '0';
        if (stamp === 'NEW') return '1';
        if (stamp === '値下げ!') return '2';
        if (stamp === '美品') return '3';
        if (stamp === '現品限り') return '4';
        return '5'; // 自由入力
    }

    function getStampTextByCode(code) {
        const map = {
            '0': '',
            '1': 'NEW',
            '2': '値下げ!',
            '3': '美品',
            '4': '現品限り'
        };
        return map[code] !== undefined ? map[code] : null; // 5は自由入力のためnull(対応表にない)とし、台帳DBから取得
    }

    function getDamageMapCode(map) {
        const maps = ['', 'sofa', 'chair', 'table', 'cabinet_tall', 'cabinet_wide', 'cupboard', 'bed', 'color_box', 'circle', 'rect_vertical', 'rect_horizontal', 'square'];
        const idx = maps.indexOf(map);
        return idx !== -1 ? String(idx).padStart(2, '0') : '00';
    }

    function getDamageMapByCode(code) {
        const maps = ['', 'sofa', 'chair', 'table', 'cabinet_tall', 'cabinet_wide', 'cupboard', 'bed', 'color_box', 'circle', 'rect_vertical', 'rect_horizontal', 'square'];
        const idx = parseInt(code, 10);
        return (idx >= 0 && idx < maps.length) ? maps[idx] : '';
    }

    function generateRestoreBarcodeValue(productCode, condition, stamp, damageMap) {
        const prefix = '209';
        const conditionCode = condition === '中古' ? '1' : '2';
        const stampCode = getStampCode(stamp);
        const damageCode = getDamageMapCode(damageMap);
        const pCode = String(productCode).padStart(5, '0');
        
        const base12 = prefix + conditionCode + stampCode + damageCode + pCode;
        const checkDigit = calculateEan13CheckDigit(base12);
        return checkDigit !== null ? base12 + checkDigit : null;
    }

    function drawRestoreBarcode(svgElement, codeValue) {
        if (codeValue && svgElement) {
            JsBarcode(svgElement, codeValue, {
                format: "EAN13",
                width: 1.1,          // ユーザー指定: 線の太さを少し広げて読みやすく調整
                height: 22,          // ユーザー指定: バーの長さを広げてスキャン性を向上
                displayValue: true,  // ユーザー指定: 手動復元のために数値も表示！
                fontSize: 8,         // カード上で綺麗に読める極小フォント
                textMargin: 1,       // バーと数値の隙間を最小化
                margin: 0,
                background: "transparent"
            });
            svgElement.style.display = 'block';
        } else if (svgElement) {
            svgElement.style.display = 'none';
        }
    }

    // --- バーコードスキャンによるフォーム完全復元ロジック ---
    function restoreProductFromBarcode(barcodeValue) {
        // 13桁の復元用コード: 209 (0-2) + condition(3) + stamp(4) + damage(5-6) + productCode(7-11) + checkDigit(12)
        const productCodeStr = barcodeValue.slice(7, 12);
        const productId = parseInt(productCodeStr, 10);

        getProductFromDB(productId, (product) => {
            if (!product) {
                // 台帳DBに見つからない場合、コード情報から最低限のパラメータを復元（フォールバック）
                console.warn('Product ID not found in database. Restoring from barcode value attributes.');
                const condition = barcodeValue[3] === '1' ? '中古' : '新品';
                const stampCode = barcodeValue[4];
                const stampText = getStampTextByCode(stampCode) || '';
                const damageMapCode = barcodeValue.slice(5, 7);
                const damageMap = getDamageMapByCode(damageMapCode);

                conditionSelect.value = condition;
                currentStamp = stampText;
                currentDamageMap = damageMap;
                
                // プリセットスタンプのUI選択状態を反映
                stampButtons.forEach(b => {
                    b.classList.remove('selected');
                    if (stampText && b.dataset.stamp === stampText) {
                        b.classList.add('selected');
                    }
                });
                if (!stampText && clearStampBtn) clearStampBtn.classList.add('selected');
                if (customStampInput) customStampInput.value = '';
                if (damageMapSelect) damageMapSelect.value = damageMap;

                updatePreview();
                alert(`台帳DBに商品コード ${productCodeStr} の詳細が見つかりませんでした。バーコードから基本パラメータのみを復元しました。`);
                return;
            }

            // IndexedDB 永久台帳から日本語を含む全パラメータを100%完全復元
            titleInput.value = product.title || '';
            titleFontSizeInput.value = product.titleFontSize || 50;
            conditionSelect.value = product.condition || '中古';
            notesTextarea.value = product.notes || '';
            notesFontSizeInput.value = product.notesFontSize || 30;
            priceInput.value = isNaN(product.price) ? '' : product.price;

            if (deliveryOptionsSelect && product.deliveryOptionText) {
                for (let i = 0; i < deliveryOptionsSelect.options.length; i++) {
                    if (deliveryOptionsSelect.options[i].text === product.deliveryOptionText) {
                        deliveryOptionsSelect.selectedIndex = i;
                        break;
                    }
                }
            }

            if (titleFontSizeValueSpan) titleFontSizeValueSpan.textContent = product.titleFontSize || 50;
            if (notesFontSizeValueSpan) notesFontSizeValueSpan.textContent = product.notesFontSize || 30;

            // スタンプの復元
            currentStamp = product.stampText || '';
            let matchedPreset = false;
            stampButtons.forEach(b => {
                b.classList.remove('selected');
                if (currentStamp && b.dataset.stamp === currentStamp) {
                    b.classList.add('selected');
                    matchedPreset = true;
                }
            });
            if (!currentStamp) {
                if (clearStampBtn) clearStampBtn.classList.add('selected');
                if (customStampInput) customStampInput.value = '';
            } else if (!matchedPreset) {
                if (customStampInput) customStampInput.value = currentStamp;
            } else {
                if (customStampInput) customStampInput.value = '';
            }

            // ダメージマップの復元
            currentDamageMap = product.damageMap || '';
            if (damageMapSelect) {
                damageMapSelect.value = currentDamageMap;
            }

            updatePreview();
            
            // 復元完了を知らせる微細なエフェクト
            const formEl = document.getElementById('input-form');
            if (formEl) {
                formEl.style.transition = 'background-color 0.3s';
                formEl.style.backgroundColor = 'rgba(23, 162, 184, 0.15)';
                setTimeout(() => {
                    formEl.style.backgroundColor = '';
                }, 400);
            }
        });
    }

    // スキャン入力欄イベント監視
    if (restoreBarcodeInput) {
        restoreBarcodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const barcodeVal = restoreBarcodeInput.value.trim();
                restoreBarcodeInput.value = ''; // スキャン完了後、即座に次の待機状態にするためにクリア
                
                if (barcodeVal.length === 13 && barcodeVal.startsWith('209')) {
                    restoreProductFromBarcode(barcodeVal);
                } else {
                    alert('有効なデータ復元用バーコードではありません。\n（209から始まる13桁の復元コードをスキャンしてください）');
                }
            }
        });
    }

    // --- CSV一括読み込み処理 ---
    const importCsvButton = document.getElementById('import-csv-button');
    const csvFileInput = document.getElementById('csv-file-input');

    // 簡易CSVパーサー
    function parseCSV(str) {
        const arr = [];
        let quote = false;
        let col = '', row = [];
        for (let c = 0; c < str.length; c++) {
            let cc = str[c], nc = str[c+1];
            if (cc === '"' && quote && nc === '"') { col += cc; ++c; continue; }
            if (cc === '"') { quote = !quote; continue; }
            if (cc === ',' && !quote) { row.push(col); col = ''; continue; }
            if (cc === '\n' && !quote) {
                if (col.endsWith('\r')) col = col.slice(0, -1);
                row.push(col); arr.push(row);
                col = ''; row = [];
                continue;
            }
            col += cc;
        }
        if (col.endsWith('\r')) col = col.slice(0, -1);
        row.push(col); arr.push(row);
        return arr;
    }

    function importCSVText(text) {
        const rows = parseCSV(text);
        
        if (rows.length < 2) {
            alert('データが見つかりません。');
            return;
        }

        // 1行目からヘッダーのインデックスを特定
        // BOMを除去しておく
        const headers = rows[0].map(h => h.trim().replace(/^\uFEFF/, ''));
        const titleIdx = headers.indexOf('商品名');
        const priceIdx = headers.indexOf('金額');
        const conditionIdx = headers.indexOf('状態');
        const notesIdx = headers.indexOf('備考');
        const titleFontSizeIdx = headers.indexOf('タイトルフォントサイズ');
        const notesFontSizeIdx = headers.indexOf('備考フォントサイズ');
        const deliveryOptionTextIdx = headers.indexOf('配送オプション');
        const stampTextIdx = headers.indexOf('スタンプ');
        const damageMapIdx = headers.indexOf('ダメージマップ');

        if (titleIdx === -1 || priceIdx === -1) {
            alert('CSVの1行目に「商品名」と「金額」の見出しが必要です。');
            return;
        }

        const newItems = [];
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (row.length === 1 && row[0].trim() === '') continue; // 空行スキップ

            const title = row[titleIdx] ? row[titleIdx].trim() : '';
            const priceStr = row[priceIdx] ? row[priceIdx].replace(/[^0-9]/g, '') : '';
            const price = parseInt(priceStr, 10);
            
            if (!title) continue; // 商品名がない行はスキップ

            let condition = '中古';
            if (conditionIdx !== -1 && row[conditionIdx]) {
                condition = row[conditionIdx].trim();
                if (!condition) condition = '中古';
            }

            let notes = '';
            if (notesIdx !== -1 && row[notesIdx]) {
                notes = row[notesIdx].trim();
            }

            // 保存時のフォントサイズや配送オプション、スタンプ、ダメージマップがあれば読み込む
            let titleFontSize = 50;
            if (titleFontSizeIdx !== -1 && row[titleFontSizeIdx]) {
                const fs = parseInt(row[titleFontSizeIdx], 10);
                if (!isNaN(fs)) titleFontSize = fs;
            }

            let notesFontSize = 30;
            if (notesFontSizeIdx !== -1 && row[notesFontSizeIdx]) {
                const fs = parseInt(row[notesFontSizeIdx], 10);
                if (!isNaN(fs)) notesFontSize = fs;
            }

            let deliveryOptionText = '';
            if (deliveryOptionTextIdx !== -1 && row[deliveryOptionTextIdx]) {
                deliveryOptionText = row[deliveryOptionTextIdx].trim();
            }
            if (!deliveryOptionText && deliveryOptionsSelect && deliveryOptionsSelect.options.length > 0) {
                deliveryOptionText = deliveryOptionsSelect.options[0].text;
            }

            let stampText = '';
            if (stampTextIdx !== -1 && row[stampTextIdx]) {
                stampText = row[stampTextIdx].trim();
            }

            let damageMap = '';
            if (damageMapIdx !== -1 && row[damageMapIdx]) {
                damageMap = row[damageMapIdx].trim();
            }

            newItems.push({
                title: title,
                titleFontSize: titleFontSize,
                condition: condition,
                notes: notes,
                notesFontSize: notesFontSize,
                deliveryOptionText: deliveryOptionText,
                price: isNaN(price) ? NaN : price,
                stampText: stampText,
                damageMap: damageMap,
                selected: true // デフォルトでチェックオン
            });
        }

        if (newItems.length > 0) {
            printQueue = [...newItems, ...printQueue];
            updateQueueUI();
        } else {
            alert('有効なデータがありませんでした。');
        }
    }

    // デバッグ・テスト用の窓口
    window.importCSVDirectly = importCSVText;

    if (importCsvButton && csvFileInput) {
        importCsvButton.addEventListener('click', () => {
            csvFileInput.click();
        });

        csvFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (ev) => {
                const text = ev.target.result;
                importCSVText(text);
                // リセットして同じファイルを再度選べるようにする
                csvFileInput.value = '';
            };
            reader.readAsText(file);
        });
    }

    // --- 印刷処理 ---
    function buildPrintCardElement(data, index) {
        const cardDiv = document.createElement('div');
        cardDiv.classList.add('price-card-template');

        const stampHTML = data.stampText ? `<div class="card-stamp active">${data.stampText}</div>` : '';
        const damageMapHTML = (data.damageMap && damageMapSVGs[data.damageMap]) 
            ? `<div class="damage-map-container">${damageMapSVGs[data.damageMap]}</div>` 
            : '<div class="damage-map-container"></div>';

        const isTitleMultiLine = (data.title || '').includes('\n');
        const titleFontSize = isTitleMultiLine ? 45 : data.titleFontSize;
        const minHeight = calculateTitleMinHeight(titleFontSizeInput) + 'px';

        const formattedPrice = !isNaN(data.price) ? `¥${data.price.toLocaleString()}` : '¥---';

        // 動的なHTMLを構築 (復元用バーコードSVGも右端に埋め込み)
        cardDiv.innerHTML = `
            ${stampHTML}
            <div class="card-row title-row" style="font-size: ${titleFontSize}px; min-height: ${minHeight};">${data.title || '商品タイトル'}</div>
            <div class="card-row condition-row">${data.condition || '中古'}</div>
            <div class="card-row notes-row" style="font-size: ${data.notesFontSize}px;">${data.notes || ''}</div>
            <div class="card-row preview-delivery-options">${data.deliveryOptionText || ''}</div>
            <div class="card-row price-row" style="font-size: 60px;">${formattedPrice}</div>
            <svg id="batch-barcode-${index}" class="barcode-svg"></svg>
            <div class="restore-barcode-wrapper">
                <svg id="batch-restore-barcode-${index}"></svg>
            </div>
            
            ${damageMapHTML}
    
            <div class="check-section">
                <div class="check-item">接客者: ＿＿＿＿＿</div>
                <div class="check-item">売約:　　 □</div>
                <div class="check-item">持ち帰り: □</div>
                <div class="check-item">配達: 　　□</div>
                <div class="check-item">日付: 　　/　　</div>
            </div>

            <div class="timestamp-div">${getFormattedTimestamp()}</div>
        `;

        return cardDiv;
    }

    batchPrintButton.addEventListener('click', () => {
        const selectedItems = printQueue.filter(item => item.selected !== false);
        if (selectedItems.length === 0) return;

        printBatchContainer.innerHTML = '';
        document.body.classList.add('is-batch-printing');

        // カードの生成とDOM追加
        selectedItems.forEach((item, index) => {
            const cardEl = buildPrintCardElement(item, index);
            printBatchContainer.appendChild(cardEl);

            // 追加後、バーコードを描画
            const barcodeSvgEl = document.getElementById(`batch-barcode-${index}`);
            const barcodeVal = generateBarcodeValue(item.price, item.condition);
            renderBarcode(barcodeSvgEl, barcodeVal);

            // 復元用バーコードの描画
            if (item.productCode) {
                const restoreSvgEl = document.getElementById(`batch-restore-barcode-${index}`);
                const restoreVal = generateRestoreBarcodeValue(item.productCode, item.condition, item.stampText, item.damageMap);
                drawRestoreBarcode(restoreSvgEl, restoreVal);
            }
        });

        // 印刷ダイアログ表示
        setTimeout(() => {
            window.onafterprint = () => {
                document.body.classList.remove('is-batch-printing');
                printBatchContainer.innerHTML = ''; // 掃除
                window.onafterprint = null;
                
                // 印刷が完了したアイテムのチェックを外す
                selectedItems.forEach(item => item.selected = false);
                updateQueueUI();
            };
            window.print();
        }, 300); // 描画を確実にするため少し待つ
    });

    printButton.addEventListener('click', () => {
        // 通常の個別印刷時にも、直前に IndexedDB 永久台帳へ保存して復元用バーコードを描画する
        const itemData = {
            title: titleInput.value.trim(),
            titleFontSize: titleFontSizeInput.value,
            condition: conditionSelect.value,
            notes: notesTextarea.value,
            notesFontSize: notesFontSizeInput.value,
            deliveryOptionText: deliveryOptionsSelect ? deliveryOptionsSelect.options[deliveryOptionsSelect.selectedIndex].text : '',
            price: parseInt(priceInput.value, 10),
            stampText: currentStamp,
            damageMap: currentDamageMap
        };

        saveProductToDB(itemData, (productCode) => {
            if (productCode) {
                const previewRestoreSvg = document.getElementById('restore-barcode');
                const restoreVal = generateRestoreBarcodeValue(productCode, itemData.condition, itemData.stampText, itemData.damageMap);
                drawRestoreBarcode(previewRestoreSvg, restoreVal);
            }

            updatePreview();

            // 描画が確実に適用されるよう微小なディレイを挟んで印刷ダイアログを表示
            setTimeout(() => {
                window.onafterprint = () => {
                    window.onafterprint = null;
                };
                window.print();
            }, 100);
        });
    });

    // --- イベントリスナーの設定 ---
    titleInput.addEventListener('input', () => {
        isAutoFittingTitle = true;
        titleFontSizeInput.value = titleInput.value.includes('\n') ? 45 : 60;
        updatePreview();
    });
    
    notesTextarea.addEventListener('input', () => {
        isAutoFittingNotes = true;
        notesFontSizeInput.value = 50;
        updatePreview();
    });

    titleFontSizeInput.addEventListener('input', () => {
        titleFontSizeValueSpan.textContent = titleFontSizeInput.value;
        updatePreview();
    });
    notesFontSizeInput.addEventListener('input', () => {
        notesFontSizeValueSpan.textContent = notesFontSizeInput.value;
        updatePreview();
    });
    conditionSelect.addEventListener('change', updatePreview);
    priceInput.addEventListener('input', updatePreview);
    if (deliveryOptionsSelect) {
        deliveryOptionsSelect.addEventListener('change', updatePreview);
    }

    // --- 初期表示 ---
    notesFontSizeInput.value = '30';
    if (notesFontSizeValueSpan) {
        notesFontSizeValueSpan.textContent = '30';
    }
    updatePreview();
    updateQueueUI();
});
