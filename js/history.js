import { HISTORY_MAX_ITEMS } from './config.js';

// --- 入力履歴管理用クラス ---
export class HistoryManager {
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
