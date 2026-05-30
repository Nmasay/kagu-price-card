import { BARCODE_PREFIX_USED, BARCODE_PREFIX_NEW } from './config.js';

// --- EAN13 チェックディジットの計算 ---
export function calculateEan13CheckDigit(digits) {
    if (digits.length !== 12) return null;
    let sum = 0;
    for (let i = 0; i < 12; i++) {
        const digit = parseInt(digits[i], 10);
        sum += (i % 2 === 0) ? digit : digit * 3;
    }
    return ((10 - (sum % 10)) % 10).toString();
}

// --- 金額バーコード値の生成 ---
export function generateBarcodeValue(price, condition) {
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

// --- 金額バーコードのレンダリング ---
export function renderBarcode(svgElement, finalBarcodeValue) {
    if (finalBarcodeValue && svgElement) {
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
    } else if (svgElement) {
        svgElement.style.display = 'none';
    }
}

// --- スタンプからバーコード埋め込み用コードへの変換 ---
export function getStampCode(stamp) {
    if (!stamp) return '0';
    if (stamp === 'NEW') return '1';
    if (stamp === '値下げ!') return '2';
    if (stamp === '美品') return '3';
    if (stamp === '現品限り') return '4';
    return '5'; // 自由入力
}

// --- バーコード埋め込み用コードからスタンプテキストへの変換 ---
export function getStampTextByCode(code) {
    const map = {
        '0': '',
        '1': 'NEW',
        '2': '値下げ!',
        '3': '美品',
        '4': '現品限り'
    };
    return map[code] !== undefined ? map[code] : null; // 5は自由入力のためnull
}

// --- ダメージマップからバーコード埋め込み用コードへの変換 ---
export function getDamageMapCode(map) {
    const maps = ['', 'sofa', 'chair', 'table', 'cabinet_tall', 'cabinet_wide', 'cupboard', 'bed', 'color_box', 'circle', 'rect_vertical', 'rect_horizontal', 'square'];
    const idx = maps.indexOf(map);
    return idx !== -1 ? String(idx).padStart(2, '0') : '00';
}

// --- バーコード埋め込み用コードからダメージマップへの変換 ---
export function getDamageMapByCode(code) {
    const maps = ['', 'sofa', 'chair', 'table', 'cabinet_tall', 'cabinet_wide', 'cupboard', 'bed', 'color_box', 'circle', 'rect_vertical', 'rect_horizontal', 'square'];
    const idx = parseInt(code, 10);
    return (idx >= 0 && idx < maps.length) ? maps[idx] : '';
}

// --- 復元用バーコード値の生成 ---
export function generateRestoreBarcodeValue(productCode, condition, stamp, damageMap) {
    const prefix = '209';
    const conditionCode = condition === '中古' ? '1' : '2';
    const stampCode = getStampCode(stamp);
    const damageCode = getDamageMapCode(damageMap);
    const pCode = String(productCode).padStart(5, '0');
    
    const base12 = prefix + conditionCode + stampCode + damageCode + pCode;
    const checkDigit = calculateEan13CheckDigit(base12);
    return checkDigit !== null ? base12 + checkDigit : null;
}

// --- 復元用バーコードの描画 ---
export function drawRestoreBarcode(svgElement, codeValue) {
    if (codeValue && svgElement) {
        JsBarcode(svgElement, codeValue, {
            format: "EAN13",
            width: 1.5,          // 金額用と同じ大きさに変更
            height: 16,          // 金額用の3分の2（25 -> 16）に縮小
            displayValue: true,  // 金額用と同じ大きさに変更
            fontSize: 12,        // 金額用と同じ大きさに変更
            textMargin: 2,       // 金額用と同じ大きさに変更
            margin: 5,           // 金額用と同じ大きさに変更
            background: "transparent",
            textPosition: "bottom",
            font: "Arial"
        });
        svgElement.style.display = 'block';
    } else if (svgElement) {
        svgElement.style.display = 'none';
    }
}
