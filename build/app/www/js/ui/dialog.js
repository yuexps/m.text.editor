/**
 * dialog.js - 确认与输入对话框
 */

import { els } from './elements.js';

export function showConfirm(message, title = '提示') {
    return new Promise((resolve) => {
        const modal = els.confirmModal;
        const headerEl = els.confirmHeader;
        const msgEl = els.confirmMessage;
        const okBtn = els.confirmOkBtn;
        const cancelBtn = els.confirmCancelBtn;
        const inputEl = els.confirmInput;

        if (!modal || !msgEl || !okBtn || !cancelBtn) {
            resolve(window.confirm(message));
            return;
        }

        if (headerEl) headerEl.innerText = title;
        if (inputEl) inputEl.style.display = 'none';
        msgEl.innerText = message;
        modal.style.display = 'flex';

        const cleanUp = (result) => {
            modal.style.display = 'none';
            okBtn.onclick = null;
            cancelBtn.onclick = null;
            resolve(result);
        };

        okBtn.onclick = () => cleanUp(true);
        cancelBtn.onclick = () => cleanUp(false);
        modal.onclick = (e) => {
            if (e.target === modal) cleanUp(false);
        };
    });
}

export function showPrompt(message, defaultValue = '', title = '提示') {
    return new Promise((resolve) => {
        const modal = els.confirmModal;
        const headerEl = els.confirmHeader;
        const msgEl = els.confirmMessage;
        const okBtn = els.confirmOkBtn;
        const cancelBtn = els.confirmCancelBtn;
        const inputEl = els.confirmInput;

        if (!modal || !msgEl || !okBtn || !cancelBtn || !inputEl) {
            resolve(window.prompt(message, defaultValue));
            return;
        }

        if (headerEl) headerEl.innerText = title;
        msgEl.innerText = message;
        inputEl.value = defaultValue;
        inputEl.style.display = 'block';
        modal.style.display = 'flex';

        setTimeout(() => {
            inputEl.focus();
            inputEl.select();
        }, 50);

        const cleanUp = (result) => {
            modal.style.display = 'none';
            okBtn.onclick = null;
            cancelBtn.onclick = null;
            inputEl.onkeydown = null;
            resolve(result);
        };

        okBtn.onclick = () => cleanUp(inputEl.value.trim());
        cancelBtn.onclick = () => cleanUp(null);
        inputEl.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                cleanUp(inputEl.value.trim());
            } else if (e.key === 'Escape') {
                cleanUp(null);
            }
        };
        modal.onclick = (e) => {
            if (e.target === modal) cleanUp(null);
        };
    });
}
