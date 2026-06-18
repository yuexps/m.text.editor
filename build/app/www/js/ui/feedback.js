/**
 * feedback.js - 基础 UI 反馈函数
 */

import { els } from './elements.js';

export function showToast(msg, isError = false, duration = 3000) {
    const t = els.toast;
    if (!t) return;
    t.innerText = msg;
    t.style.display = 'block';
    t.className = isError ? 'error' : 'info';

    if (t._timer) clearTimeout(t._timer);
    t._timer = setTimeout(() => {
        t.style.display = 'none';
    }, duration);
}

export function updateStatus(text, color) {
    if (els.statusText) {
        els.statusText.innerText = text;
        els.statusText.style.color = color || 'var(--status-text)';
    }
}

export function updateBreadcrumbs(path) {
    if (!els.breadcrumbs) return;

    if (path) {
        els.breadcrumbs.style.display = '';
        els.breadcrumbs.innerText = path;
        els.breadcrumbs.title = "点击复制完整路径";
        els.breadcrumbs.style.cursor = "pointer";
        const filename = path.split(/[/\\]/).pop();
        document.title = `${filename}`;
    } else {
        els.breadcrumbs.style.display = 'none';
        els.breadcrumbs.innerText = '';
        document.title = 'PodNote';
    }
}

export function hideAllPanels() {
    if (els.langPanel) els.langPanel.style.display = 'none';
    if (els.encodingPanel) els.encodingPanel.style.display = 'none';
    if (els.eolPanel) els.eolPanel.style.display = 'none';
}

export function updateUIState(hasFile, isEditMode, setEditModeFunc) {
    const allActionIds = [
        'edit-mode-btn', 'save-btn',
        'eol-selector', 'lang-selector', 'encoding-selector'
    ];

    allActionIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            const isStatusItem = el.classList.contains('status-item');
            if (hasFile) {
                if (isStatusItem) {
                    el.classList.remove('disabled');
                } else {
                    el.style.opacity = '1';
                }
                el.style.pointerEvents = 'auto';
                if (el.tagName === 'BUTTON') el.disabled = false;
            } else {
                if (isStatusItem) {
                    el.classList.add('disabled');
                } else {
                    el.style.opacity = '0.3';
                }
                el.style.pointerEvents = 'none';
                if (el.tagName === 'BUTTON') el.disabled = true;
            }
        }
    });

    if (hasFile && typeof setEditModeFunc === 'function') {
        setEditModeFunc(isEditMode);
    }
}
