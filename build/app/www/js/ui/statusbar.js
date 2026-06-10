/**
 * statusbar.js - 底栏状态选择面板（语言/编码/EOL）
 */

import { ENCODING_LIST, getEncodingLabel, checkIsNarrowScreen } from '../utils.js';
import { AppContext } from '../context.js';
import { eventBus } from '../event_bus.js';
import { EditorManager } from '../editor.js';
import { els } from './elements.js';
import { showToast, hideAllPanels } from './feedback.js';

/**
 * 面板对齐计算
 */
function alignPanel(panelEl, selectorEl) {
    const isNarrow = checkIsNarrowScreen();
    if (isNarrow) {
        panelEl.style.right = '';
        return;
    }
    const rect = selectorEl.getBoundingClientRect();
    const container = document.querySelector('.editor-area');
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const rightOffset = Math.max(10, containerRect.right - rect.right);
    panelEl.style.right = `${rightOffset}px`;
}

/**
 * 初始化底栏三个选择面板事件
 */
export function initStatusbarPanels(uiDisp) {
    // 语言选择器
    const handleLangSelectorClick = (e) => {
        e.stopPropagation();
        hideAllPanels();
        const langs = monaco.languages.getLanguages().sort((a, b) => a.id.localeCompare(b.id));
        els.langList.innerHTML = '';
        langs.forEach(lang => {
            const item = document.createElement('div');
            item.className = 'lang-item';
            item.innerHTML = `<span>${lang.aliases ? lang.aliases[0] : lang.id}</span><span class="lang-id">${lang.id}</span>`;
            item.onclick = () => {
                EditorManager.setLanguage(lang.id);
                els.langPanel.style.display = 'none';
            };
            els.langList.appendChild(item);
        });
        alignPanel(els.langPanel, els.langSelector);
        els.langPanel.style.display = 'flex';
    };
    els.langSelector.addEventListener('click', handleLangSelectorClick);
    uiDisp.add(() => els.langSelector.removeEventListener('click', handleLangSelectorClick));

    // 编码选择器
    const handleEncodingSelectorClick = (e) => {
        e.stopPropagation();
        hideAllPanels();
        els.encodingList.innerHTML = '';
        ENCODING_LIST.forEach(enc => {
            const item = document.createElement('div');
            item.className = 'lang-item';
            item.innerHTML = `<span>${enc.label}</span><span class="lang-id">${enc.id.toUpperCase()}</span>`;
            item.onclick = () => {
                const oldEncoding = AppContext.state.currentEncoding;
                AppContext.update({ currentEncoding: enc.id });
                els.encodingSelector.innerText = getEncodingLabel(enc.id);
                els.encodingPanel.style.display = 'none';

                const isContentDirty = EditorManager.getEditor() && EditorManager.getEditor().getValue() !== AppContext.state.originalContent;
                const isEncodingDirty = AppContext.state.currentEncoding !== AppContext.state.originalEncoding;
                const totalDirty = isContentDirty || isEncodingDirty;

                eventBus.emit('encoding:changed', { oldEncoding, newEncoding: enc.id, totalDirty });
            };
            els.encodingList.appendChild(item);
        });
        alignPanel(els.encodingPanel, els.encodingSelector);
        els.encodingPanel.style.display = 'flex';
    };
    els.encodingSelector.addEventListener('click', handleEncodingSelectorClick);
    uiDisp.add(() => els.encodingSelector.removeEventListener('click', handleEncodingSelectorClick));

    // EOL 选择器
    const handleEolSelectorClick = (e) => {
        e.stopPropagation();
        hideAllPanels();
        els.eolList.innerHTML = '';
        const eolTypes = [
            { label: 'LF (Unix)', id: 'LF', value: monaco.editor.EndOfLineSequence.LF },
            { label: 'CRLF (Windows)', id: 'CRLF', value: monaco.editor.EndOfLineSequence.CRLF }
        ];
        eolTypes.forEach(type => {
            const item = document.createElement('div');
            item.className = 'lang-item';
            item.innerHTML = `<span>${type.label}</span>`;
            item.onclick = () => {
                const editor = EditorManager.getEditor();
                if (editor) {
                    editor.getModel().setEOL(type.value);
                }
                els.eolSelector.innerText = type.id;
                els.eolPanel.style.display = 'none';
                showToast(`换行符已切换为 ${type.id}`);
            };
            els.eolList.appendChild(item);
        });
        alignPanel(els.eolPanel, els.eolSelector);
        els.eolPanel.style.display = 'flex';
    };
    els.eolSelector.addEventListener('click', handleEolSelectorClick);
    uiDisp.add(() => els.eolSelector.removeEventListener('click', handleEolSelectorClick));
}
