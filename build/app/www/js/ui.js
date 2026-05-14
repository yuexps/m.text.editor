/**
 * ui.js - DOM 元素管理与基础 UI 反馈
 */

import { Log, ENCODING_LIST, getEncodingLabel, Clipboard } from './utils.js';

export { Log, ENCODING_LIST, getEncodingLabel, Clipboard };

export const els = {
    // 顶部工具栏
    editModeBtn: document.getElementById('edit-mode-btn'),
    saveBtn: document.getElementById('save-btn'),
    undoBtn: document.getElementById('undo-btn'),
    redoBtn: document.getElementById('redo-btn'),
    copyBtn: document.getElementById('copy-btn'),
    pasteBtn: document.getElementById('paste-btn'),
    findBtn: document.getElementById('find-btn'),
    replaceBtn: document.getElementById('replace-btn'),

    // 标签与路径
    tabFilename: document.getElementById('tab-filename'),
    tabCloseBtn: document.querySelector('.tab-close'),
    breadcrumbs: document.getElementById('breadcrumbs'),

    // 欢迎页/输入
    welcomeOverlay: document.getElementById('welcome-overlay'),
    manualPathInput: document.getElementById('manual-path-input'),
    openPathBtn: document.getElementById('open-path-btn'),
    createPathBtn: document.getElementById('create-path-btn'),

    // 底部状态栏
    statusText: document.getElementById('status-text'),
    charCount: document.getElementById('char-count'),
    posDisplay: document.getElementById('pos-display'),
    langSelector: document.getElementById('lang-selector'),
    langPanel: document.getElementById('lang-panel'),
    langList: document.getElementById('lang-list'),
    encodingSelector: document.getElementById('encoding-selector'),
    encodingPanel: document.getElementById('encoding-panel'),
    encodingList: document.getElementById('encoding-list'),
    eolSelector: document.getElementById('eol-selector'),
    eolPanel: document.getElementById('eol-panel'),
    eolList: document.getElementById('eol-list'),

    // 容器与反馈
    editorContainer: document.getElementById('editor-container'),
    toast: document.getElementById('toast')
};

export function showToast(msg, isError = false) {
    const t = els.toast;
    if (!t) return;
    t.innerText = msg;
    t.style.display = 'block';
    t.className = isError ? 'error' : 'info';

    if (t._timer) clearTimeout(t._timer);
    t._timer = setTimeout(() => {
        t.style.display = 'none';
    }, 3000);
}

export function updateStatus(text, color) {
    if (els.statusText) {
        els.statusText.innerText = text;
        els.statusText.style.color = color || 'var(--status-text)';
    }
}

export function updateBreadcrumbs(path, onClickCopy) {
    if (!els.breadcrumbs) return;
    els.breadcrumbs.innerText = path;
    els.breadcrumbs.title = "点击复制完整路径";
    els.breadcrumbs.style.cursor = "pointer";

    if (path) {
        const filename = path.split(/[/\\]/).pop();
        document.title = `${filename}`;
    } else {
        document.title = 'NotePod++';
    }

    els.breadcrumbs.onclick = onClickCopy;
}

export function hideAllPanels() {
    if (els.langPanel) els.langPanel.style.display = 'none';
    if (els.encodingPanel) els.encodingPanel.style.display = 'none';
    if (els.eolPanel) els.eolPanel.style.display = 'none';
}

export function updateUIState(hasFile, isEditMode, setEditModeFunc) {
    const allActionIds = [
        'edit-mode-btn', 'save-btn', 'undo-btn', 'redo-btn',
        'copy-btn', 'paste-btn', 'find-btn', 'replace-btn',
        'eol-selector', 'lang-selector', 'encoding-selector'
    ];

    allActionIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (hasFile) {
                el.style.opacity = '1';
                el.style.pointerEvents = 'auto';
                if (el.tagName === 'BUTTON') el.disabled = false;
            } else {
                el.style.opacity = '0.3';
                el.style.pointerEvents = 'none';
                if (el.tagName === 'BUTTON') el.disabled = true;
            }
        }
    });

    if (els.tabCloseBtn) {
        els.tabCloseBtn.style.display = hasFile ? 'flex' : 'none';
    }

    if (hasFile && typeof setEditModeFunc === 'function') {
        setEditModeFunc(isEditMode);
    }
}
