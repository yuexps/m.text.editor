/**
 * search.js - 查找与替换模块
 */
import { els, showToast } from './ui.js';
import { EditorManager } from './editor.js';
import { eventBus } from './event_bus.js';
import { createDisposableStore } from './utils.js';

let searchMatches = [];
let currentMatchIndex = -1;
let searchTimer = null;
let searchInitialized = false;
let searchDisposables = createDisposableStore();

/**
 * 字符转义 HTML 防止注入
 */
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g,
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

/**
 * 转义正则字符以做忽略大小写查找
 */
function escapeRegex(str) {
    return str.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');
}

/**
 * 执行侧栏单文件匹配搜索
 */
function performSidebarSearch() {
    const query = els.sidebarSearchInput.value;
    const resultsContainer = els.sidebarSearchResults;
    const infoContainer = els.sidebarSearchResultsInfo;
    
    if (!resultsContainer || !infoContainer) return;
    resultsContainer.innerHTML = '';

    const editor = EditorManager.getEditor();
    if (!editor || !query) {
        searchMatches = [];
        currentMatchIndex = -1;
        infoContainer.innerText = query ? '编辑器未就绪' : '无结果';
        return;
    }

    const model = editor.getModel();
    searchMatches = model.findMatches(query, false, false, false, null, true, 1000);
    currentMatchIndex = -1;

    if (searchMatches.length === 0) {
        infoContainer.innerText = '未找到匹配项';
        return;
    }

    infoContainer.innerText = `找到 ${searchMatches.length} 个匹配项`;

    searchMatches.forEach((match, index) => {
        const lineNum = match.range.startLineNumber;
        let lineText = model.getLineContent(lineNum);

        const escapedText = escapeHTML(lineText);
        const escapedQuery = escapeHTML(query);

        let highlightedText = escapedText;
        try {
            const regex = new RegExp(escapeRegex(escapedQuery), 'gi');
            highlightedText = escapedText.replace(regex, (m) => `<mark>${m}</mark>`);
        } catch (e) {
            // 回退直接显示，防正则字符转义意外崩溃
        }

        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.setAttribute('data-index', index);
        item.innerHTML = `
            <div class="search-result-header">
                <span>行 ${lineNum}</span>
            </div>
            <div class="search-result-body">${highlightedText}</div>
        `;

        item.onclick = () => {
            selectSearchMatch(index);
        };

        resultsContainer.appendChild(item);
    });
}

/**
 * 选中并定位指定的匹配项
 */
function selectSearchMatch(index) {
    if (index < 0 || index >= searchMatches.length) return;
    currentMatchIndex = index;

    const items = els.sidebarSearchResults.querySelectorAll('.search-result-item');
    items.forEach((item, idx) => {
        if (idx === index) {
            item.classList.add('active');
            item.scrollIntoView({ block: 'nearest' });
        } else {
            item.classList.remove('active');
        }
    });

    const editor = EditorManager.getEditor();
    if (editor) {
        const match = searchMatches[index];
        editor.revealRangeInCenter(match.range);
        editor.setSelection(match.range);
        editor.focus();
    }
}

/**
 * 下一个匹配
 */
function jumpToNextMatch() {
    if (searchMatches.length === 0) return;
    let nextIdx = (currentMatchIndex + 1) % searchMatches.length;
    selectSearchMatch(nextIdx);
}

/**
 * 上一个匹配
 */
function jumpToPrevMatch() {
    if (searchMatches.length === 0) return;
    let prevIdx = currentMatchIndex - 1;
    if (prevIdx < 0) prevIdx = searchMatches.length - 1;
    selectSearchMatch(prevIdx);
}

/**
 * 执行替换
 */
function performSidebarReplace() {
    const editor = EditorManager.getEditor();
    const replaceVal = els.sidebarReplaceInput.value;

    if (!editor || searchMatches.length === 0) return;

    let idx = currentMatchIndex;
    if (idx === -1) {
        idx = 0;
    }

    const match = searchMatches[idx];
    editor.executeEdits('sidebar-replace', [{
        range: match.range,
        text: replaceVal,
        forceMoveMarkers: true
    }]);

    performSidebarSearch();

    if (searchMatches.length > 0) {
        let nextIdx = idx >= searchMatches.length ? 0 : idx;
        selectSearchMatch(nextIdx);
    }
}

/**
 * 全部替换
 */
function performSidebarReplaceAll() {
    const editor = EditorManager.getEditor();
    const replaceVal = els.sidebarReplaceInput.value;

    if (!editor || searchMatches.length === 0) return;

    const confirmReplace = confirm(`确定要将所有 ${searchMatches.length} 个匹配项替换为 "${replaceVal}" 吗？`);
    if (!confirmReplace) return;

    const edits = searchMatches.map(match => ({
        range: match.range,
        text: replaceVal,
        forceMoveMarkers: true
    })).reverse();

    editor.executeEdits('sidebar-replace-all', edits);
    performSidebarSearch();
    showToast('已全部替换完成');
}

/**
 * 触发侧栏查找并选中关键字
 */
function triggerSidebarFind() {
    eventBus.emit('sidebar:panel-request', 'search');
    setTimeout(() => {
        els.sidebarSearchInput?.focus();
        els.sidebarSearchInput?.select();
    }, 100);
}

/**
 * 触发侧栏替换并选定替换框
 */
function triggerSidebarReplace() {
    triggerSidebarFind();
    setTimeout(() => {
        els.sidebarReplaceInput?.focus();
        els.sidebarReplaceInput?.select();
    }, 120);
}

export const SearchManager = {
    init() {
        if (searchInitialized) return;
        searchInitialized = true;
        searchDisposables = createDisposableStore();

        // 订阅侧栏变化事件，完成同步选词和搜索
        searchDisposables.add(eventBus.on('sidebar:panel-changed', (panelName) => {
            if (panelName === 'search') {
                const editor = EditorManager.getEditor();
                if (editor) {
                    const selection = editor.getSelection();
                    const selText = editor.getModel().getValueInRange(selection);
                    if (selText && selText.length < 200) {
                        els.sidebarSearchInput.value = selText;
                    }
                }
                performSidebarSearch();
            }
        }));

        // 绑定搜索输入框及控制按钮的事件
        if (els.sidebarSearchInput) {
            const performSidebarSearchWithDebounce = () => {
                if (searchTimer) clearTimeout(searchTimer);
                searchTimer = setTimeout(() => {
                    performSidebarSearch();
                }, 250);
            };

            els.sidebarSearchInput.oninput = () => performSidebarSearchWithDebounce();
            els.sidebarSearchInput.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    if (searchTimer) {
                        clearTimeout(searchTimer);
                        searchTimer = null;
                        performSidebarSearch();
                    }
                    if (e.shiftKey) jumpToPrevMatch();
                    else jumpToNextMatch();
                    e.preventDefault();
                }
            };
            searchDisposables.add(() => {
                els.sidebarSearchInput.oninput = null;
                els.sidebarSearchInput.onkeydown = null;
            });
        }

        if (els.sidebarReplaceInput) {
            els.sidebarReplaceInput.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    performSidebarReplace();
                    e.preventDefault();
                }
            };
            searchDisposables.add(() => {
                els.sidebarReplaceInput.onkeydown = null;
            });
        }

        const btnPrev = document.getElementById('sidebar-search-prev-btn');
        const btnNext = document.getElementById('sidebar-search-next-btn');
        const btnReplace = document.getElementById('sidebar-replace-btn');
        const btnReplaceAll = document.getElementById('sidebar-replace-all-btn');

        if (btnPrev) btnPrev.onclick = () => jumpToPrevMatch();
        if (btnNext) btnNext.onclick = () => jumpToNextMatch();
        if (btnReplace) btnReplace.onclick = () => performSidebarReplace();
        if (btnReplaceAll) btnReplaceAll.onclick = () => performSidebarReplaceAll();
        searchDisposables.add(() => {
            if (btnPrev) btnPrev.onclick = null;
            if (btnNext) btnNext.onclick = null;
            if (btnReplace) btnReplace.onclick = null;
            if (btnReplaceAll) btnReplaceAll.onclick = null;
        });
    },

    triggerFind() {
        triggerSidebarFind();
    },

    triggerReplace() {
        triggerSidebarReplace();
    },
    
    clear() {
        searchMatches = [];
        currentMatchIndex = -1;
        if (els.sidebarSearchInput) els.sidebarSearchInput.value = '';
        if (els.sidebarReplaceInput) els.sidebarReplaceInput.value = '';
        if (els.sidebarSearchResults) els.sidebarSearchResults.innerHTML = '';
        if (els.sidebarSearchResultsInfo) els.sidebarSearchResultsInfo.innerText = '无结果';
    },

    dispose() {
        if (searchTimer) {
            clearTimeout(searchTimer);
            searchTimer = null;
        }
        searchDisposables.dispose();
        searchInitialized = false;
    }
};
