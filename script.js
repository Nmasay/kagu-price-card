document.addEventListener('DOMContentLoaded', () => {
    const titleInput = document.getElementById('product-title');
    const titleFontSizeInput = document.getElementById('title-font-size');
    const titleFontSizeValueSpan = document.getElementById('title-font-size-value');
    const conditionSelect = document.getElementById('condition');
    const notesTextarea = document.getElementById('notes');
    const notesHistoryListDiv = document.getElementById('notes-history-list'); // 備考履歴リスト表示用div
    const notesHistoryKey = 'productNotesHistory'; // 備考履歴のlocalStorageキー
    const notesFontSizeInput = document.getElementById('notes-font-size');
    const notesFontSizeValueSpan = document.getElementById('notes-font-size-value');
    const priceInput = document.getElementById('price');
    const printButton = document.getElementById('print-button');

    const previewTitle = document.getElementById('preview-title');
    const previewCondition = document.getElementById('preview-condition');
    const previewNotes = document.getElementById('preview-notes');
    const previewPrice = document.getElementById('preview-price'); // 金額表示用
    const barcodeSvg = document.getElementById('barcode');
    const timestampDiv = document.getElementById('timestamp');
    const priceRowDiv = document.querySelector('.price-row'); // 金額表示エリア (フォントサイズ調整用)
    const titleHistoryListDiv = document.getElementById('title-history-list'); // 履歴リスト表示用div
    const titleHistoryKey = 'productTitleHistory'; // localStorageのキー

    // --- EAN-13 チェックデジット計算関数 ---
    function calculateEan13CheckDigit(digits) {
        if (digits.length !== 12) {
            console.error("Check digit calculation requires 12 digits.");
            return null;
        }
        let sum = 0;
        for (let i = 0; i < 12; i++) {
            const digit = parseInt(digits[i], 10);
            sum += (i % 2 === 0) ? digit : digit * 3;
        }
        const checkDigit = (10 - (sum % 10)) % 10;
        return checkDigit.toString();
    }

    // --- バーコード生成関数 ---
    function generateBarcode() {
        const price = parseInt(priceInput.value, 10) || 0;
        const condition = conditionSelect.value;
        let baseNumberStr = 0;

        // 状態に応じてバーコードのプレフィックスを変更
        if (condition === '中古') {
            baseNumberStr = 20438000000; // 中古品用プレフィックス
        } else { // 未使用
            baseNumberStr = 20451000000; // 未使用品用プレフィックス
        }

        // BigInt を使って大きな数値を扱う
        try {
            const baseNumber = BigInt(baseNumberStr);
            const priceBigInt = BigInt(price);
            const totalNumber = baseNumber + priceBigInt;

            // チェックデジット計算用に12桁に整形 (先頭ゼロ埋め)
            let barcodeDigits = totalNumber.toString().slice(-12).padStart(12, '0');

            // チェックデジット計算
            const checkDigit = calculateEan13CheckDigit(barcodeDigits);

            if (checkDigit !== null) {
                const finalBarcodeValue = barcodeDigits + checkDigit;

                // JsBarcodeで生成
                JsBarcode(barcodeSvg, finalBarcodeValue, {
                    format: "EAN13",
                    width: 1.5, // バーの幅
                    height: 25, // バーの高さ
                    displayValue: true, // 数値を表示
                    fontSize: 12, // 数値のフォントサイズ
                    margin: 5, // バーコード周りの余白
                    background: "transparent", // 背景を透明に
                    textPosition: "bottom", // 数値の表示位置
                    textMargin: 2,
                    font: "Arial"
                });
                barcodeSvg.style.display = 'block'; // 表示する
            } else {
                 console.error("Failed to calculate check digit.");
                 barcodeSvg.style.display = 'none'; // エラー時は非表示
            }

        } catch (e) {
            console.error("Barcode generation error:", e);
            barcodeSvg.style.display = 'none';
        }
    }

    // --- 金額のフォントサイズ調整関数 ---
    function adjustPriceFontSize() {
        const containerWidth = priceRowDiv.clientWidth - 10; // 左右のpadding分を考慮
        let fontSize = 60; // 開始フォントサイズ (大きめから始める)
        previewPrice.style.fontSize = fontSize + 'px';

        // 要素の幅がコンテナ幅を超える限りフォントサイズを小さくする
        // TODO: 現在コメントアウト中。必要に応じて有効化または削除。
        /*while (previewPrice.scrollWidth > containerWidth && fontSize > 10) {
            fontSize -= 1;
            previewPrice.style.fontSize = fontSize + 'px';
        }*/
     }

    // --- タイムスタンプ更新関数 ---
    function updateTimestamp() {
        const now = new Date();
        const year = now.getFullYear();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        timestampDiv.textContent = `作成日時: ${year}/${month}/${day} ${hours}:${minutes}`;
    }

    // --- プレビュー更新関数 ---
    function updatePreview() {
        // タイトル
        const isTitleMultiLine = titleInput.value.includes('\n');
        let titleFontSize;
        // タイトルが2行以上の場合、フォントサイズを最大46pxに制限
        if (isTitleMultiLine) {
            titleFontSize = 45;
        }else{
            titleFontSize = parseInt(titleFontSizeInput.value, 10);
        }

        titleFontSizeInput.value = titleFontSize; // スライダーの値を更新
        titleFontSizeValueSpan.textContent = titleFontSize; // スライダー横の数値を更新
        previewTitle.textContent = titleInput.value || '商品タイトル';
        previewTitle.style.fontSize = titleFontSize + 'px';

        // --- ここから追加 ---
        // タイトル要素の最小の高さを設定し、後続要素のズレを防ぐ
        // スライダーのmax属性値を取得 (HTMLに設定されている前提)
        // <input type="range" id="title-font-size" ... max="60"> のような想定
        const maxAttr = titleFontSizeInput.getAttribute('max');
        const maxSingleLineFontSize = maxAttr ? parseFloat(maxAttr) : 60; // デフォルト60px

        // CSSでのline-heightを仮定 (実際の値に合わせて調整が必要)
        // 一般的なブラウザのデフォルト line-height は normal (おおよそフォントサイズの1.2倍)
        // もしCSSで previewTitle に line-height が具体的に指定されていれば、その値を考慮するのがベストです。
        // ここでは1.2を仮定します。
        const assumedLineHeightRatio = 1.2;

        // 単一行の場合の最大高さを計算
        const singleLineMaxHeight = maxSingleLineFontSize * assumedLineHeightRatio;

        // 複数行の場合のフォントサイズは45px（現在のロジックより）
        const multiLineBaseFontSize = 40;
        // 複数行の場合の最大行数を仮定 (例: 2行)。この値はデザインや要件によって調整してください。
        const maxLinesForMultiLine = 2;
        const multiLineMaxHeight = multiLineBaseFontSize * assumedLineHeightRatio * maxLinesForMultiLine;

        // 設定するmin-heightは、単一行最大と複数行最大の大きい方
        const calculatedMinHeight = Math.max(singleLineMaxHeight, multiLineMaxHeight);
        previewTitle.style.minHeight = calculatedMinHeight + 'px';
        // これにより、フォントサイズが小さくなってもタイトルエリアの高さは維持され、
        // テキストはエリアの上部に配置される（デフォルトのvertical-align）。
        // --- ここまで追加 ---

        // 状態
        const selectedOption = conditionSelect.options[conditionSelect.selectedIndex];
        previewCondition.textContent = selectedOption.text;

        // 備考
        previewNotes.textContent = notesTextarea.value || '';
        previewNotes.style.fontSize = notesFontSizeInput.value + 'px';

        // 金額
        const priceValue = parseInt(priceInput.value, 10);
        if (!isNaN(priceValue)) {
            previewPrice.textContent = `¥${priceValue.toLocaleString()}`; // 3桁区切り
        } else {
            previewPrice.textContent = '¥---';
        }

        // 金額フォントサイズ調整
        adjustPriceFontSize();

        // バーコード更新
        generateBarcode();

        // タイムスタンプ更新
        updateTimestamp();
    }

    // --- タイトル履歴の読み込みとリスト表示 ---
    function loadTitleHistory() {
        const history = JSON.parse(localStorage.getItem(titleHistoryKey)) || [];
        titleHistoryListDiv.innerHTML = ''; // リストをクリア

        // 入力中のテキストで履歴をフィルタリング
        const filterText = titleInput.value.trim().toLowerCase();
        const filteredHistory = history.filter(title => title.toLowerCase().includes(filterText));

        filteredHistory.forEach(title => {
            const itemDiv = document.createElement('div');
            itemDiv.classList.add('history-item');

            const titleSpan = document.createElement('span');
            titleSpan.textContent = title;
            // 項目クリックで入力欄にタイトルを設定し、リストを閉じる
            titleSpan.addEventListener('click', () => {
                titleInput.value = title;
                titleHistoryListDiv.style.display = 'none';
                updatePreview();
            });

            const deleteButton = document.createElement('button');
            deleteButton.innerHTML = '&times;'; // バツ印 (×)
            deleteButton.title = '履歴から削除';
            // ★ 削除ボタンクリックで履歴から削除
            deleteButton.addEventListener('click', (event) => {
                event.stopPropagation(); // 親要素(itemDiv)へのクリックイベント伝播を阻止
                removeTitleFromHistory(title);
            });

            itemDiv.appendChild(titleSpan);
            itemDiv.appendChild(deleteButton);
            titleHistoryListDiv.appendChild(itemDiv);
        });

        // フィルタリングされた結果がある場合のみリストを表示
        titleHistoryListDiv.style.display = filteredHistory.length > 0 ? 'block' : 'none';
    }

    // --- タイトル履歴から削除 ---
    function removeTitleFromHistory(titleToRemove) {
        let history = JSON.parse(localStorage.getItem(titleHistoryKey)) || [];
        history = history.filter(title => title !== titleToRemove);
        localStorage.setItem(titleHistoryKey, JSON.stringify(history));
        loadTitleHistory(); // リスト表示を更新
    }

    // --- タイトル履歴への追加 ---
    function addTitleToHistory(title) {
        if (!title) return; // 空文字は追加しない
        let history = JSON.parse(localStorage.getItem(titleHistoryKey)) || [];
        // 重複チェック
        if (!history.includes(title)) {
            history.unshift(title); // 新しいものを先頭に追加
            // 必要であれば履歴の最大件数を制限する (例: 最新100件)
            // history = history.slice(0, 100);
            localStorage.setItem(titleHistoryKey, JSON.stringify(history));;
        }
    }

    // --- 備考履歴の読み込みとリスト表示 ---
    function loadNotesHistory() {
        if (!notesHistoryListDiv) return; // 要素がなければ何もしない
        const history = JSON.parse(localStorage.getItem(notesHistoryKey)) || [];
        notesHistoryListDiv.innerHTML = ''; // リストをクリア

        // 入力中のテキストで履歴をフィルタリング
        const filterText = notesTextarea.value.trim().toLowerCase();
        const filteredHistory = history.filter(note => note.toLowerCase().includes(filterText));

        filteredHistory.forEach(note => {
            const itemDiv = document.createElement('div');
            itemDiv.classList.add('history-item'); // CSSクラスを適用

            const noteSpan = document.createElement('span');
            noteSpan.textContent = note;
            // 項目クリックで入力欄に備考を設定し、リストを閉じる
            noteSpan.addEventListener('click', () => {
                notesTextarea.value = note;
                notesHistoryListDiv.style.display = 'none';
                updatePreview();
            });

            const deleteButton = document.createElement('button');
            deleteButton.innerHTML = '&times;'; // バツ印 (×)
            deleteButton.title = '履歴から削除';
            deleteButton.addEventListener('click', (event) => {
                event.stopPropagation(); // 親要素(itemDiv)へのクリックイベント伝播を阻止
                removeNotesFromHistory(note);
            });

            itemDiv.appendChild(noteSpan);
            itemDiv.appendChild(deleteButton);
            notesHistoryListDiv.appendChild(itemDiv);
        });

        notesHistoryListDiv.style.display = filteredHistory.length > 0 ? 'block' : 'none';
    }

    // --- 備考履歴から削除 ---
    function removeNotesFromHistory(noteToRemove) {
        let history = JSON.parse(localStorage.getItem(notesHistoryKey)) || [];
        history = history.filter(note => note !== noteToRemove);
        localStorage.setItem(notesHistoryKey, JSON.stringify(history));
        if (notesHistoryListDiv) loadNotesHistory(); // リスト表示を更新
    }

    // --- 備考履歴への追加 ---
    function addNotesToHistory(note) {
        if (!note) return; // 空文字は追加しない
        let history = JSON.parse(localStorage.getItem(notesHistoryKey)) || [];
        // 重複チェック
        if (!history.includes(note)) {
            history.unshift(note); // 新しいものを先頭に追加
            // 必要であれば履歴の最大件数を制限する (例: 最新100件)
            // history = history.slice(0, 100);
            localStorage.setItem(notesHistoryKey, JSON.stringify(history));
        }
    }

    // --- イベントリスナーの設定 ---
    // タイトル入力時に履歴リストをフィルタリング表示 & プレビュー更新
    titleInput.addEventListener('input', () => {
        loadTitleHistory();
        updatePreview();
    });
    // タイトル入力欄フォーカス時に履歴リスト表示
    titleInput.addEventListener('focus', () => {
        if (titleHistoryListDiv) loadTitleHistory();
    });

    // タイトル入力欄からフォーカスが外れたら履歴に追加
    titleInput.addEventListener('blur', () => {
        // 少し遅延させて、リスト内のクリック操作を可能にする
        setTimeout(() => {
            // リストが非表示の場合（＝リスト項目がクリックされなかった場合）のみ履歴追加
            if (titleHistoryListDiv && getComputedStyle(titleHistoryListDiv).display === 'none') {
                 addTitleToHistory(titleInput.value.trim());
            }
        }, 150); // 150ミリ秒待つ (リスト項目のクリックイベントが先に処理されるように)
    });

    // ドキュメント全体をクリックしたときにリストを閉じる（入力欄とリスト以外がクリックされた場合）
    document.addEventListener('click', (event) => {
        if (titleHistoryListDiv && !titleInput.contains(event.target) && !titleHistoryListDiv.contains(event.target)) {
            titleHistoryListDiv.style.display = 'none';
        }
        if (notesHistoryListDiv && !notesTextarea.contains(event.target) && !notesHistoryListDiv.contains(event.target)) {
            notesHistoryListDiv.style.display = 'none';
        }
    });

    titleFontSizeInput.addEventListener('input', () => {
        titleFontSizeValueSpan.textContent = titleFontSizeInput.value; // スライダーの数値を表示
        updatePreview();
    });
    conditionSelect.addEventListener('change', updatePreview);

    // 備考入力時に履歴リストをフィルタリング表示 & プレビュー更新
    notesTextarea.addEventListener('input', () => {
        if (notesHistoryListDiv) loadNotesHistory();
        updatePreview();
    });
    // 備考入力欄フォーカス時に履歴リスト表示
    notesTextarea.addEventListener('focus', () => {
        if (notesHistoryListDiv) loadNotesHistory();
    });
    // 備考入力欄からフォーカスが外れたら履歴に追加
    notesTextarea.addEventListener('blur', () => {
        setTimeout(() => {
            if (notesHistoryListDiv && getComputedStyle(notesHistoryListDiv).display === 'none') {
                 addNotesToHistory(notesTextarea.value.trim());
            }
        }, 150);
    });

    // ★ 備考文字サイズスライダーのイベントリスナー
    notesFontSizeInput.addEventListener('input', () => {
        notesFontSizeValueSpan.textContent = notesFontSizeInput.value; // ★ 数値表示を更新
        updatePreview(); // ★ プレビューも更新
    });
    priceInput.addEventListener('input', updatePreview);

    // 印刷ボタン
    printButton.addEventListener('click', () => {
        // 印刷前に最新の状態を反映 (念のため)
        updatePreview();

        // 印刷ダイアログが閉じた後にページをリロードする
        window.onafterprint = () => {
            location.reload();
            window.onafterprint = null; // イベントリスナーを削除 (念のため)
        };

        // 印刷ダイアログを開く
        window.print();
    });

    // --- 初期表示 ---
    // 備考フォントサイズスライダーの初期値を30に設定
    notesFontSizeInput.value = '30';
    if (notesFontSizeValueSpan) { // スライダー横の数値表示も更新
        notesFontSizeValueSpan.textContent = '30';
    }
    updatePreview();

    // ウィンドウリサイズ時にも金額フォントサイズを再調整
    window.addEventListener('resize', adjustPriceFontSize);
});
