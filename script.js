document.addEventListener('DOMContentLoaded', () => {
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
    
    stampButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            stampButtons.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            currentStamp = btn.dataset.stamp;
            if (customStampInput) customStampInput.value = ''; // プリセット選択時は自由入力をクリア
            updatePreview();
        });
    });

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
        previewPrice.style.fontSize = '70px'; // adjustPriceFontSize 代わり

        const barcodeVal = generateBarcodeValue(priceInput.value, conditionSelect.value);
        renderBarcode(barcodeSvg, barcodeVal);

        timestampDiv.textContent = getFormattedTimestamp();

        if (previewStamp) {
            if (currentStamp) {
                previewStamp.textContent = currentStamp;
                previewStamp.classList.add('active');
            } else {
                previewStamp.classList.remove('active');
            }
        }
        
        if (isAutoFittingTitle) {
            isAutoFittingTitle = false;
            autoFitText(previewTitle, titleFontSizeInput, titleFontSizeValueSpan, titleFontSizeInput.value, 20, false);
        }
        
        if (isAutoFittingNotes) {
            isAutoFittingNotes = false;
            autoFitText(previewNotes, notesFontSizeInput, notesFontSizeValueSpan, notesFontSizeInput.value, 15, true);
        }
    }

    // --- 印刷待ちキュー管理 ---
    function syncQueueHeight() {
        const form = document.getElementById('input-form');
        const queueSection = document.getElementById('print-queue-section');
        if (form && queueSection) {
            queueSection.style.height = form.offsetHeight + 'px';
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

                // プレビューの更新
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
        
        syncQueueHeight();
    }

    addToListButton.addEventListener('click', () => {
        const item = {
            title: titleInput.value.trim(),
            titleFontSize: titleFontSizeInput.value,
            condition: conditionSelect.value,
            notes: notesTextarea.value,
            notesFontSize: notesFontSizeInput.value,
            deliveryOptionText: deliveryOptionsSelect ? deliveryOptionsSelect.options[deliveryOptionsSelect.selectedIndex].text : '',
            price: parseInt(priceInput.value, 10),
            stampText: currentStamp,
            selected: true // 追加時はデフォルトで選択状態
        };
        printQueue.unshift(item); // 先頭に追加する
        updateQueueUI();
        
        // 追加後、入力フォームをクリア
        titleInput.value = '';
        notesTextarea.value = '';
        priceInput.value = '';
        currentStamp = '';
        stampButtons.forEach(b => b.classList.remove('selected'));
        if (clearStampBtn) clearStampBtn.classList.add('selected');
        if (customStampInput) customStampInput.value = '';
        
        updatePreview();
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
            stampButtons.forEach(b => b.classList.remove('selected'));
            if (clearStampBtn) clearStampBtn.classList.add('selected');
            if (customStampInput) customStampInput.value = '';
            
            updatePreview();
        });
    }

    if (customStampInput) {
        customStampInput.addEventListener('input', (e) => {
            currentStamp = e.target.value;
            stampButtons.forEach(b => b.classList.remove('selected'));
            if (clearStampBtn) clearStampBtn.classList.remove('selected');
            updatePreview();
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
                const rows = parseCSV(text);
                
                if (rows.length < 2) {
                    alert('データが見つかりません。');
                    return;
                }

                // 1行目からヘッダーのインデックスを特定
                const headers = rows[0].map(h => h.trim());
                const titleIdx = headers.indexOf('商品名');
                const priceIdx = headers.indexOf('金額');
                const conditionIdx = headers.indexOf('状態');
                const notesIdx = headers.indexOf('備考');

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

                    // 配列オプションは常にフォームの先頭の選択肢をデフォルトとする
                    let deliveryOptionText = '';
                    if (deliveryOptionsSelect && deliveryOptionsSelect.options.length > 0) {
                        deliveryOptionText = deliveryOptionsSelect.options[0].text;
                    }

                    newItems.push({
                        title: title,
                        titleFontSize: 50, // ユーザー指定のデフォルト値
                        condition: condition,
                        notes: notes,
                        notesFontSize: 30, // ユーザー指定のデフォルト値
                        deliveryOptionText: deliveryOptionText,
                        price: isNaN(price) ? NaN : price,
                        selected: true // デフォルトでチェックオン
                    });
                }

                if (newItems.length > 0) {
                    // Excelの上の行をリストの上部に配置（そのまま結合）
                    printQueue = [...newItems, ...printQueue];
                    updateQueueUI();
                } else {
                    alert('有効なデータがありませんでした。');
                }
                
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

        const isTitleMultiLine = (data.title || '').includes('\n');
        const titleFontSize = isTitleMultiLine ? 45 : data.titleFontSize;
        const minHeight = calculateTitleMinHeight(titleFontSizeInput) + 'px';

        const formattedPrice = !isNaN(data.price) ? `¥${data.price.toLocaleString()}` : '¥---';

        // 動的なHTMLを構築
        cardDiv.innerHTML = `
            ${stampHTML}
            <div class="card-row title-row" style="font-size: ${titleFontSize}px; min-height: ${minHeight};">${data.title || '商品タイトル'}</div>
            <div class="card-row condition-row">${data.condition || '中古'}</div>
            <div class="card-row notes-row" style="font-size: ${data.notesFontSize}px;">${data.notes || ''}</div>
            <div class="card-row preview-delivery-options">${data.deliveryOptionText || ''}</div>
            <div class="card-row price-row" style="font-size: 70px;">${formattedPrice}</div>
            <svg id="batch-barcode-${index}" class="barcode-svg"></svg>
    
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
        updatePreview();
        // 通常の印刷は body.is-batch-printing が付与されていない状態で行う
        window.onafterprint = () => {
            window.onafterprint = null;
        };
        window.print();
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
