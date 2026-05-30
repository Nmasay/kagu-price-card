import { state, saveQueueToLocalStorage } from './state.js';
import { initDB, saveProductToDB, getProductFromDB, getAllProductsFromDB, deleteProductFromDB } from './db.js';
import { damageMapSVGs } from './config.js';
import { HistoryManager } from './history.js';
import {
    generateBarcodeValue,
    renderBarcode,
    generateRestoreBarcodeValue,
    drawRestoreBarcode,
    getStampTextByCode,
    getDamageMapByCode
} from './barcode.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- IndexedDB 初期化 (永久商品台帳データベース) ---
    initDB(() => {
        // DB初期化完了後に一覧を描画
        renderLedger();
    });

    // --- DOM要素 ---
    const titleInput = document.getElementById('product-title');
    const titleFontSizeInput = document.getElementById('title-font-size');
    const titleFontSizeValueSpan = document.getElementById('title-font-size-value');
    const conditionSelect = document.getElementById('condition');
    const notesTextarea = document.getElementById('notes');
    const notesFontSizeInput = document.getElementById('notes-font-size');
    const notesFontSizeValueSpan = document.getElementById('notes-font-size-value');
    const priceInput = document.getElementById('price');
    const priceBeforeTaxInput = document.getElementById('price-before-tax');
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

    // 商品台帳要素
    const ledgerSearchInput = document.getElementById('ledger-search-input');
    const ledgerSearchClearBtn = document.getElementById('ledger-search-clear-btn');
    const ledgerConditionFilter = document.getElementById('ledger-condition-filter');
    const ledgerTableBody = document.getElementById('ledger-table-body');
    const ledgerCountSpan = document.getElementById('ledger-count');

    const previewTitle = document.getElementById('preview-title');
    const previewCondition = document.getElementById('preview-condition');
    const previewNotes = document.getElementById('preview-notes');
    const previewPrice = document.getElementById('preview-price');
    const barcodeSvg = document.getElementById('barcode');
    const previewDeliveryOptions = document.getElementById('preview-delivery-options');
    const timestampDiv = document.getElementById('timestamp');

    const titleHistoryListDiv = document.getElementById('title-history-list');
    const notesHistoryListDiv = document.getElementById('notes-history-list');

    // --- スタンプボタンの初期化 ---
    const stampButtons = document.querySelectorAll('.stamp-btn');
    const stampColorButtons = document.querySelectorAll('.stamp-color-btn');
    const previewStamp = document.getElementById('preview-stamp');
    const customStampInput = document.getElementById('custom-stamp-input');
    const clearStampBtn = document.querySelector('.clear-stamp-btn');
    
    // --- ダメージマップ要素の取得 ---
    const damageMapSelect = document.getElementById('damage-map-select');
    const previewDamageMap = document.getElementById('preview-damage-map');

    stampButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            stampButtons.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            state.currentStamp = btn.dataset.stamp;
            if (customStampInput) customStampInput.value = ''; // プリセット選択時は自由入力をクリア
            updatePreview();
        });
    });

    stampColorButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            stampColorButtons.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            state.currentStampColor = btn.dataset.color || '#e60000';
            updatePreview();
        });
    });

    // ダメージマップセレクトボックスのイベント
    if (damageMapSelect) {
        damageMapSelect.addEventListener('change', (e) => {
            state.currentDamageMap = e.target.value;
            updatePreview();
        });
    }

    if (customStampInput) {
        customStampInput.addEventListener('input', (e) => {
            state.currentStamp = e.target.value.trim();
            // プリセットボタンの選択状態を解除
            stampButtons.forEach(b => b.classList.remove('selected'));
            if (state.currentStamp === '' && clearStampBtn) {
                clearStampBtn.classList.add('selected');
            }
            updatePreview();
        });
    }
    
    // 初期状態で「なし」を選択
    if (clearStampBtn) clearStampBtn.classList.add('selected');

    // 履歴マネージャーのインスタンス化
    const titleHistory = new HistoryManager('productTitleHistory', titleInput, titleHistoryListDiv, updatePreview);
    const notesHistory = new HistoryManager('productNotesHistory', notesTextarea, notesHistoryListDiv, updatePreview);

    // --- ユーティリティ ---
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

    // 備考欄のテキストを11文字ごとに改行するユーティリティ関数
    function formatNotesText(text) {
        if (!text) return '';
        return text.split('\n').map(line => {
            let formattedLine = '';
            for (let i = 0; i < line.length; i += 11) {
                formattedLine += line.substring(i, i + 11) + (i + 11 < line.length ? '\n' : '');
            }
            return formattedLine;
        }).join('\n');
    }

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

        previewNotes.textContent = formatNotesText(notesTextarea.value || '');
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
        if (state.currentStamp) {
            previewStamp.textContent = state.currentStamp;
            previewStamp.style.setProperty('--stamp-color', state.currentStampColor);
            previewStamp.classList.add('active');
        } else {
            previewStamp.classList.remove('active');
        }

        // ダメージマップの反映
        if (state.currentDamageMap && damageMapSVGs[state.currentDamageMap]) {
            previewDamageMap.innerHTML = damageMapSVGs[state.currentDamageMap];
        } else {
            previewDamageMap.innerHTML = '';
        }

        // 復元用バーコードプレビューの制御
        const previewRestoreSvg = document.getElementById('restore-barcode');
        if (state.editingProductCode) {
            const restoreVal = generateRestoreBarcodeValue(state.editingProductCode, conditionSelect.value, state.currentStamp, state.currentDamageMap);
            drawRestoreBarcode(previewRestoreSvg, restoreVal);
        } else {
            drawRestoreBarcode(previewRestoreSvg, null);
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
        saveQueueToLocalStorage();

        queueCountSpan.textContent = state.printQueue.length;
        printQueueList.innerHTML = '';
        
        const selectAllCheckbox = document.getElementById('select-all-checkbox');
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = state.printQueue.length > 0 && state.printQueue.every(item => item.selected !== false);
            selectAllCheckbox.onchange = (e) => {
                const isChecked = e.target.checked;
                state.printQueue.forEach(item => item.selected = isChecked);
                updateQueueUI();
            };
        }

        state.printQueue.forEach((item, index) => {
            const li = document.createElement('li');
            li.draggable = true;

            // ドラッグ＆ドロップのイベント設定
            li.addEventListener('dragstart', (e) => {
                state.draggedItemIndex = index;
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', index); // Firefox等で必要
                setTimeout(() => li.style.opacity = '0.5', 0);
            });

            li.addEventListener('dragend', () => {
                li.style.opacity = '1';
                state.draggedItemIndex = null;
            });

            li.addEventListener('dragover', (e) => {
                e.preventDefault(); // ドロップを許可するために必須
                e.dataTransfer.dropEffect = 'move';
            });

            li.addEventListener('dragenter', (e) => {
                e.preventDefault();
                if (state.draggedItemIndex !== null && state.draggedItemIndex !== index) {
                    li.classList.add('drag-over');
                }
            });

            li.addEventListener('dragleave', () => {
                li.classList.remove('drag-over');
            });

            li.addEventListener('drop', (e) => {
                e.preventDefault();
                li.classList.remove('drag-over');
                if (state.draggedItemIndex === null || state.draggedItemIndex === index) return;

                // 配列内の順序を入れ替える
                const draggedItem = state.printQueue.splice(state.draggedItemIndex, 1)[0];
                state.printQueue.splice(index, 0, draggedItem);
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
            stampSpan.style.backgroundColor = item.stampColor || '#e60000';
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
                state.editingProductCode = item.productCode || null;
                titleInput.value = item.title;
                titleFontSizeInput.value = item.titleFontSize;
                conditionSelect.value = item.condition;
                notesTextarea.value = item.notes;
                notesFontSizeInput.value = item.notesFontSize;
                priceInput.value = isNaN(item.price) ? '' : item.price;
                if (priceBeforeTaxInput) {
                    priceBeforeTaxInput.value = isNaN(item.price) ? '' : Math.round(item.price / 1.1);
                }
                
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
                state.currentStamp = item.stampText || '';
                let matchedPreset = false;
                stampButtons.forEach(b => {
                    b.classList.remove('selected');
                    if (state.currentStamp && b.dataset.stamp === state.currentStamp) {
                        b.classList.add('selected');
                        matchedPreset = true;
                    }
                });

                if (!state.currentStamp) {
                    if (clearStampBtn) clearStampBtn.classList.add('selected');
                    if (customStampInput) customStampInput.value = '';
                } else if (!matchedPreset) {
                    // プリセットにない文字なら自由入力欄に入れる
                    if (customStampInput) customStampInput.value = state.currentStamp;
                } else {
                    if (customStampInput) customStampInput.value = '';
                }

                // スタンプ色の復元
                state.currentStampColor = item.stampColor || '#e60000';
                stampColorButtons.forEach(b => {
                    b.classList.remove('selected');
                    if (b.dataset.color === state.currentStampColor) {
                        b.classList.add('selected');
                    }
                });

                // ダメージマップの復元
                state.currentDamageMap = item.damageMap || '';
                if (damageMapSelect) {
                    damageMapSelect.value = state.currentDamageMap;
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
                state.printQueue.splice(index, 1);
                updateQueueUI();
            };
            actionsDiv.appendChild(removeBtn);

            li.appendChild(checkboxDiv);
            li.appendChild(infoDiv);
            li.appendChild(actionsDiv);
            printQueueList.appendChild(li);
        });

        const hasItems = state.printQueue.length > 0;
        const hasSelectedItems = state.printQueue.some(item => item.selected !== false);
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
            stampText: state.currentStamp,
            stampColor: state.currentStampColor,
            damageMap: state.currentDamageMap
        };

        // リスト追加前に IndexedDB 永久台帳に自動保存し、一意の商品コードを取得
        saveProductToDB(itemData, (productCode) => {
            const item = {
                ...itemData,
                productCode: productCode,
                selected: true // 追加・更新時はデフォルトで選択状態
            };

            if (state.editingProductCode) {
                const idx = state.printQueue.findIndex(q => q.productCode === state.editingProductCode);
                if (idx !== -1) {
                    state.printQueue[idx] = item;
                } else {
                    state.printQueue.unshift(item);
                }
                state.editingProductCode = null; // 編集完了したのでクリア
            } else {
                state.printQueue.unshift(item); // 先頭に追加する
            }

            updateQueueUI();
            
            // 追加後、入力フォームをクリア
            titleInput.value = '';
            notesTextarea.value = '';
            priceInput.value = '';
            if (priceBeforeTaxInput) priceBeforeTaxInput.value = '';
            state.currentStamp = '';
            state.currentStampColor = '#e60000';
            state.currentDamageMap = '';
            stampButtons.forEach(b => b.classList.remove('selected'));
            if (clearStampBtn) clearStampBtn.classList.add('selected');
            if (customStampInput) customStampInput.value = '';
            stampColorButtons.forEach(b => b.classList.remove('selected'));
            if (stampColorButtons[0]) stampColorButtons[0].classList.add('selected');
            if (damageMapSelect) damageMapSelect.value = '';
            
            updatePreview();
            renderLedger();
        });
    });

    if (clearFormButton) {
        clearFormButton.addEventListener('click', () => {
            state.editingProductCode = null;
            titleInput.value = '';
            titleFontSizeInput.value = '55'; // 初期値
            conditionSelect.selectedIndex = 0; // 中古
            notesTextarea.value = '';
            notesFontSizeInput.value = '30'; // 初期値
            if (deliveryOptionsSelect) deliveryOptionsSelect.selectedIndex = 0;
            priceInput.value = '';
            if (priceBeforeTaxInput) priceBeforeTaxInput.value = '';
            
            // スライダー横のテキストを更新
            if (titleFontSizeValueSpan) titleFontSizeValueSpan.textContent = '55';
            if (notesFontSizeValueSpan) notesFontSizeValueSpan.textContent = '30';
            
            // スタンプのクリア
            state.currentStamp = '';
            state.currentStampColor = '#e60000';
            state.currentDamageMap = '';
            stampButtons.forEach(b => b.classList.remove('selected'));
            if (clearStampBtn) clearStampBtn.classList.add('selected');
            if (customStampInput) customStampInput.value = '';
            stampColorButtons.forEach(b => b.classList.remove('selected'));
            if (stampColorButtons[0]) stampColorButtons[0].classList.add('selected');
            if (damageMapSelect) damageMapSelect.value = '';
            
            updatePreview();
            
            // ユーザー指定: クリアした後にページをリロードする
            location.reload();
        });
    }

    clearQueueButton.addEventListener('click', () => {
        if (confirm('印刷待ちリストをすべてクリアしますか？')) {
            state.printQueue = [];
            updateQueueUI();
        }
        // リスト更新後に高さを同期
        syncQueueHeight();
    });

    // ウィンドウリサイズ時にも高さを同期
    window.addEventListener('resize', syncQueueHeight);

    // --- CSV一括書き出し処理 ---
    function exportToCSV() {
        if (state.printQueue.length === 0) return;

        const headers = ['商品コード', '商品名', '金額', '状態', '備考', 'タイトルフォントサイズ', '備考フォントサイズ', '配送オプション', 'スタンプ', 'ダメージマップ', 'スタンプ色'];
        
        function escapeCSVField(field) {
            if (field === null || field === undefined) return '';
            const str = String(field);
            if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
                return '"' + str.replace(/"/g, '""') + '"';
            }
            return str;
        }

        const csvRows = [headers.map(escapeCSVField).join(',')];

        state.printQueue.forEach(item => {
            const row = [
                item.productCode || '',
                item.title || '',
                isNaN(item.price) ? '' : item.price,
                item.condition || '中古',
                item.notes || '',
                item.titleFontSize || 50,
                item.notesFontSize || 30,
                item.deliveryOptionText || '',
                item.stampText || '',
                item.damageMap || '',
                item.stampColor || '#e60000'
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
                state.currentStamp = stampText;
                state.currentDamageMap = damageMap;
                state.editingProductCode = productCodeStr;
                
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
            state.editingProductCode = productCodeStr;
            titleInput.value = product.title || '';
            titleFontSizeInput.value = product.titleFontSize || 50;
            conditionSelect.value = product.condition || '中古';
            notesTextarea.value = product.notes || '';
            notesFontSizeInput.value = product.notesFontSize || 30;
            priceInput.value = isNaN(product.price) ? '' : product.price;
            if (priceBeforeTaxInput) {
                priceBeforeTaxInput.value = isNaN(product.price) ? '' : Math.round(product.price / 1.1);
            }

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
            state.currentStamp = product.stampText || '';
            let matchedPreset = false;
            stampButtons.forEach(b => {
                b.classList.remove('selected');
                if (state.currentStamp && b.dataset.stamp === state.currentStamp) {
                    b.classList.add('selected');
                    matchedPreset = true;
                }
            });
            if (!state.currentStamp) {
                if (clearStampBtn) clearStampBtn.classList.add('selected');
                if (customStampInput) customStampInput.value = '';
            } else if (!matchedPreset) {
                if (customStampInput) customStampInput.value = state.currentStamp;
            } else {
                if (customStampInput) customStampInput.value = '';
            }

            // スタンプ色の復元
            state.currentStampColor = product.stampColor || '#e60000';
            stampColorButtons.forEach(b => {
                b.classList.remove('selected');
                if (b.dataset.color === state.currentStampColor) {
                    b.classList.add('selected');
                }
            });

            // ダメージマップの復元
            state.currentDamageMap = product.damageMap || '';
            if (damageMapSelect) {
                damageMapSelect.value = state.currentDamageMap;
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
        const headers = rows[0].map(h => h.trim().replace(/^\uFEFF/, ''));
        const productCodeIdx = headers.indexOf('商品コード');
        const titleIdx = headers.indexOf('商品名');
        const priceIdx = headers.indexOf('金額');
        const conditionIdx = headers.indexOf('状態');
        const notesIdx = headers.indexOf('備考');
        const titleFontSizeIdx = headers.indexOf('タイトルフォントサイズ');
        const notesFontSizeIdx = headers.indexOf('備考フォントサイズ');
        const deliveryOptionTextIdx = headers.indexOf('配送オプション');
        const stampTextIdx = headers.indexOf('スタンプ');
        const stampColorIdx = headers.indexOf('スタンプ色');
        const damageMapIdx = headers.indexOf('ダメージマップ');

        if (titleIdx === -1 || priceIdx === -1) {
            alert('CSVの1行目に「商品名」と「金額」の見出しが必要です。');
            return;
        }

        const newItems = [];
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (row.length === 1 && row[0].trim() === '') continue; // 空行スキップ

            let productCode = '';
            if (productCodeIdx !== -1 && row[productCodeIdx]) {
                productCode = row[productCodeIdx].trim();
            }

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

            let stampColor = '#e60000';
            if (stampColorIdx !== -1 && row[stampColorIdx]) {
                stampColor = row[stampColorIdx].trim() || '#e60000';
            }

            let damageMap = '';
            if (damageMapIdx !== -1 && row[damageMapIdx]) {
                damageMap = row[damageMapIdx].trim();
            }

            newItems.push({
                productCode: productCode || undefined,
                title: title,
                titleFontSize: titleFontSize,
                condition: condition,
                notes: notes,
                notesFontSize: notesFontSize,
                deliveryOptionText: deliveryOptionText,
                price: isNaN(price) ? NaN : price,
                stampText: stampText,
                stampColor: stampColor,
                damageMap: damageMap,
                selected: true // デフォルトでチェックオン
            });
        }

        if (newItems.length > 0) {
            const savePromises = newItems.map(item => {
                return new Promise((resolve) => {
                    const itemData = {
                        title: item.title,
                        titleFontSize: item.titleFontSize,
                        condition: item.condition,
                        notes: item.notes,
                        notesFontSize: item.notesFontSize,
                        deliveryOptionText: item.deliveryOptionText,
                        price: item.price,
                        stampText: item.stampText,
                        stampColor: item.stampColor,
                        damageMap: item.damageMap
                    };

                    if (item.productCode) {
                        saveProductToDB(itemData, (assignedCode) => {
                            item.productCode = assignedCode;
                            resolve(item);
                        }, item.productCode);
                    } else {
                        saveProductToDB(itemData, (assignedCode) => {
                            item.productCode = assignedCode;
                            resolve(item);
                        });
                    }
                });
            });

            Promise.all(savePromises).then((importedItems) => {
                const validItems = importedItems.filter(x => x && x.productCode);
                if (validItems.length > 0) {
                    state.printQueue = [...validItems, ...state.printQueue];
                    updateQueueUI();
                    renderLedger();
                    alert(`${validItems.length}件の商品データをインポートし、復元用バーコードを登録・付与しました。`);
                } else {
                    alert('データベースへの登録に失敗しました。');
                }
            }).catch(err => {
                console.error("Promise.all error during import:", err);
                alert('インポート処理中にエラーが発生しました。');
            });
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

        const stampHTML = data.stampText ? `<div class="card-stamp active" style="--stamp-color: ${data.stampColor || '#e60000'};">${data.stampText}</div>` : '';
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
            <div class="card-row notes-row" style="font-size: ${data.notesFontSize}px;">${formatNotesText(data.notes || '')}</div>
            <div class="card-row preview-delivery-options">${data.deliveryOptionText || ''}</div>
            <div class="card-row price-row">${formattedPrice}</div>
            <svg id="batch-barcode-${index}" class="barcode-svg"></svg>
            <div class="restore-barcode-wrapper">
                <svg id="batch-restore-barcode-${index}"></svg>
            </div>
            
            ${damageMapHTML}
    
            <div class="check-section">
                <div class="check-item">接客者:</div>
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
        const selectedItems = state.printQueue.filter(item => item.selected !== false);
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
        // 印刷前の編集状態を記憶しておく
        const wasNewProduct = (state.editingProductCode === null);
        const originalEditingCode = state.editingProductCode;

        // 通常の個別印刷時にも、直前に IndexedDB 永久台帳へ保存して復元用バーコードを描画する
        const itemData = {
            title: titleInput.value.trim(),
            titleFontSize: titleFontSizeInput.value,
            condition: conditionSelect.value,
            notes: notesTextarea.value,
            notesFontSize: notesFontSizeInput.value,
            deliveryOptionText: deliveryOptionsSelect ? deliveryOptionsSelect.options[deliveryOptionsSelect.selectedIndex].text : '',
            price: parseInt(priceInput.value, 10),
            stampText: state.currentStamp,
            stampColor: state.currentStampColor,
            damageMap: state.currentDamageMap
        };

        saveProductToDB(itemData, (productCode) => {
            if (productCode) {
                state.editingProductCode = productCode; // 描画処理がupdatePreviewで消えないようにコードを設定
            }

            updatePreview();
            renderLedger();

            // 描画が確実に適用されるよう微小なディレイを挟んで印刷ダイアログを表示
            setTimeout(() => {
                window.onafterprint = () => {
                    window.onafterprint = null;
                    
                    // 印刷終了の確認処理 (ダイアログ遷移の安定のため少し待つ)
                    setTimeout(() => {
                        const printed = confirm("実際にプライスカードを印刷しましたか？\n（「キャンセル」を押すと、台帳への登録とID発行を破棄します）");
                        
                        if (printed) {
                            // 印刷成功時
                            state.editingProductCode = null; // 印刷完了したので新規作成状態に戻す
                            updatePreview();
                            renderLedger();
                        } else {
                            // 印刷キャンセル時
                            if (wasNewProduct && productCode) {
                                // 新規商品の場合は、IndexedDBから物理削除してIDを破棄
                                const idToDelete = parseInt(productCode, 10);
                                deleteProductFromDB(idToDelete, (success) => {
                                    state.editingProductCode = null;
                                    updatePreview();
                                    renderLedger();
                                    alert(`商品コード [${productCode}] の発行および登録を破棄しました。（入力内容は維持されます）`);
                                });
                            } else {
                                // 既存商品の編集中の場合は、削除せず、元の編集状態IDを維持
                                state.editingProductCode = originalEditingCode;
                                updatePreview();
                                renderLedger();
                                alert("印刷がキャンセルされました。編集状態を維持します。");
                            }
                        }
                    }, 300);
                };
                window.print();
            }, 100);
        }, state.editingProductCode);
    });

    // --- イベントリスナーの設定 ---
    titleInput.addEventListener('input', () => {
        isAutoFittingTitle = true;
        titleFontSizeInput.value = titleInput.value.includes('\n') ? 45 : 60;
        updatePreview();
    });
    
    notesTextarea.addEventListener('input', () => {
        isAutoFittingNotes = true;
        notesFontSizeInput.value = 30; // 備考欄の自動調整開始フォントサイズを30に設定
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
    
    if (priceBeforeTaxInput) {
        priceBeforeTaxInput.addEventListener('input', () => {
            const beforeTaxVal = parseFloat(priceBeforeTaxInput.value);
            if (!isNaN(beforeTaxVal) && beforeTaxVal >= 0) {
                // 消費税10%を掛けて四捨五入
                priceInput.value = Math.round(beforeTaxVal * 1.1);
            } else {
                priceInput.value = '';
            }
            updatePreview();
        });
    }

    if (priceInput) {
        priceInput.addEventListener('input', () => {
            const priceVal = parseFloat(priceInput.value);
            if (!isNaN(priceVal) && priceVal >= 0) {
                // 1.1 で割って四捨五入し税抜金額を逆算
                priceBeforeTaxInput.value = Math.round(priceVal / 1.1);
            } else {
                priceBeforeTaxInput.value = '';
            }
            updatePreview();
        });
    }

    if (deliveryOptionsSelect) {
        deliveryOptionsSelect.addEventListener('change', updatePreview);
    }

    // --- 登録商品台帳の制御ロジック ---
    function renderLedger() {
        getAllProductsFromDB((products) => {
            if (!ledgerTableBody) return;
            
            // フィルタリング処理
            const query = (ledgerSearchInput ? ledgerSearchInput.value.trim().toLowerCase() : '');
            const conditionFilter = (ledgerConditionFilter ? ledgerConditionFilter.value : '');
            
            // クリアボタンの表示切り替え
            if (ledgerSearchClearBtn) {
                ledgerSearchClearBtn.style.display = query ? 'block' : 'none';
            }

            const filteredProducts = products.filter(product => {
                // 状態フィルター
                if (conditionFilter && product.condition !== conditionFilter) {
                    return false;
                }
                // キーワードフィルター
                if (query) {
                    const titleMatch = (product.title || '').toLowerCase().includes(query);
                    const notesMatch = (product.notes || '').toLowerCase().includes(query);
                    const codeStr = String(product.id).padStart(5, '0');
                    const codeMatch = codeStr.includes(query);
                    return titleMatch || notesMatch || codeMatch;
                }
                return true;
            });

            // 件数表示の更新
            if (ledgerCountSpan) {
                ledgerCountSpan.textContent = filteredProducts.length;
            }

            ledgerTableBody.innerHTML = '';

            if (filteredProducts.length === 0) {
                const tr = document.createElement('tr');
                const td = document.createElement('td');
                td.setAttribute('colspan', '6');
                td.className = 'ledger-table-empty';
                td.textContent = query || conditionFilter ? '条件に合致する商品はありません。' : '発行済みのプライスカードはありません。';
                tr.appendChild(td);
                ledgerTableBody.appendChild(tr);
                return;
            }

            filteredProducts.forEach(product => {
                const tr = document.createElement('tr');
                const productCodeStr = String(product.id).padStart(5, '0');

                // 1. 状態
                const tdCondition = document.createElement('td');
                tdCondition.textContent = product.condition || '中古';
                tdCondition.style.color = product.condition === '中古' ? '#d9534f' : '#5cb85c';
                tdCondition.style.fontWeight = 'bold';
                tr.appendChild(tdCondition);

                // 3. 商品名
                const tdTitle = document.createElement('td');
                tdTitle.textContent = product.title || '(名称未入力)';
                tdTitle.style.fontWeight = 'bold';
                tr.appendChild(tdTitle);

                // 4. 金額
                const tdPrice = document.createElement('td');
                const priceVal = parseInt(product.price, 10);
                tdPrice.textContent = !isNaN(priceVal) ? `¥${priceVal.toLocaleString()}` : '¥---';
                tdPrice.style.fontWeight = 'bold';
                tr.appendChild(tdPrice);

                // 5. スタンプ / ダメージ
                const tdStampDamage = document.createElement('td');
                tdStampDamage.style.display = 'flex';
                tdStampDamage.style.flexWrap = 'wrap';
                tdStampDamage.style.gap = '6px';
                tdStampDamage.style.alignItems = 'center';
                
                if (product.stampText) {
                    const stampBadge = document.createElement('span');
                    stampBadge.className = 'stamp-badge';
                    stampBadge.style.backgroundColor = product.stampColor || '#e60000';
                    stampBadge.textContent = product.stampText;
                    tdStampDamage.appendChild(stampBadge);
                }
                
                if (product.damageMap) {
                    const damageSpan = document.createElement('span');
                    damageSpan.className = 'damage-icon';
                    
                    const damageEmojiMap = {
                        'sofa': '🛋️',
                        'chair': '🪑',
                        'table': '🟫',
                        'cabinet_tall': '🪟',
                        'cabinet_wide': '📺',
                        'cupboard': '🍽️',
                        'bed': '🛏️',
                        'color_box': '🗄️',
                        'circle': '⚪️',
                        'rect_vertical': '▮',
                        'rect_horizontal': '▬',
                        'square': '◼️'
                    };
                    damageSpan.textContent = damageEmojiMap[product.damageMap] || '🗺️';
                    damageSpan.title = `ダメージマップ: ${product.damageMap}`;
                    tdStampDamage.appendChild(damageSpan);
                }
                tr.appendChild(tdStampDamage);

                // 6. 備考
                const tdNotes = document.createElement('td');
                tdNotes.textContent = product.notes ? product.notes.replace(/\n/g, ' ') : '';
                tdNotes.style.fontSize = '0.9em';
                tdNotes.style.color = '#555';
                tr.appendChild(tdNotes);

                // 7. 操作ボタン
                const tdActions = document.createElement('td');
                const actionsContainer = document.createElement('div');
                actionsContainer.className = 'action-buttons';

                // 編集ボタン
                const editBtn = document.createElement('button');
                editBtn.type = 'button';
                editBtn.className = 'ledger-action-btn edit';
                editBtn.innerHTML = '📝 編集';
                editBtn.title = 'フォームに読み込む';
                editBtn.onclick = () => {
                    state.editingProductCode = productCodeStr;
                    titleInput.value = product.title || '';
                    titleFontSizeInput.value = product.titleFontSize || 50;
                    conditionSelect.value = product.condition || '中古';
                    notesTextarea.value = product.notes || '';
                    notesFontSizeInput.value = product.notesFontSize || 30;
                    priceInput.value = isNaN(product.price) ? '' : product.price;
                    if (priceBeforeTaxInput) {
                        priceBeforeTaxInput.value = isNaN(product.price) ? '' : Math.round(product.price / 1.1);
                    }
                    
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

                    state.currentStamp = product.stampText || '';
                    let matchedPreset = false;
                    stampButtons.forEach(b => {
                        b.classList.remove('selected');
                        if (state.currentStamp && b.dataset.stamp === state.currentStamp) {
                           b.classList.add('selected');
                           matchedPreset = true;
                        }
                    });
                    if (!state.currentStamp) {
                        if (clearStampBtn) clearStampBtn.classList.add('selected');
                        if (customStampInput) customStampInput.value = '';
                    } else if (!matchedPreset) {
                        if (customStampInput) customStampInput.value = state.currentStamp;
                    } else {
                        if (customStampInput) customStampInput.value = '';
                    }

                    state.currentStampColor = product.stampColor || '#e60000';
                    stampColorButtons.forEach(b => {
                        b.classList.remove('selected');
                        if (b.dataset.color === state.currentStampColor) {
                            b.classList.add('selected');
                        }
                    });

                    state.currentDamageMap = product.damageMap || '';
                    if (damageMapSelect) {
                        damageMapSelect.value = state.currentDamageMap;
                    }

                    updatePreview();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                };
                actionsContainer.appendChild(editBtn);

                // 印刷待ちリストに追加ボタン
                const addQueueBtn = document.createElement('button');
                addQueueBtn.type = 'button';
                addQueueBtn.className = 'ledger-action-btn add-queue';
                addQueueBtn.innerHTML = '➕ リストに追加';
                addQueueBtn.title = '印刷待ちに追加';
                addQueueBtn.onclick = () => {
                    const queueItem = {
                        productCode: productCodeStr,
                        title: product.title,
                        titleFontSize: product.titleFontSize || 50,
                        condition: product.condition || '中古',
                        notes: product.notes || '',
                        notesFontSize: product.notesFontSize || 30,
                        deliveryOptionText: product.deliveryOptionText || '',
                        price: product.price,
                        stampText: product.stampText || '',
                        stampColor: product.stampColor || '#e60000',
                        damageMap: product.damageMap || '',
                        selected: true
                    };
                    
                    const existingIdx = state.printQueue.findIndex(q => q.productCode === productCodeStr);
                    if (existingIdx !== -1) {
                        state.printQueue[existingIdx] = queueItem;
                    } else {
                        state.printQueue.unshift(queueItem);
                    }
                    updateQueueUI();
                };
                actionsContainer.appendChild(addQueueBtn);

                tdActions.appendChild(actionsContainer);
                tr.appendChild(tdActions);

                ledgerTableBody.appendChild(tr);
            });
        });
    }

    // 検索・フィルタリングのイベント
    if (ledgerSearchInput) {
        ledgerSearchInput.addEventListener('input', renderLedger);
    }
    if (ledgerSearchClearBtn) {
        ledgerSearchClearBtn.addEventListener('click', () => {
            ledgerSearchInput.value = '';
            renderLedger();
        });
    }
    if (ledgerConditionFilter) {
        ledgerConditionFilter.addEventListener('change', renderLedger);
    }

    // --- 初期表示 ---
    notesFontSizeInput.value = '30';
    if (notesFontSizeValueSpan) {
        notesFontSizeValueSpan.textContent = '30';
    }
    updatePreview();
    updateQueueUI();
});
