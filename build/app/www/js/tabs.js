/**
 * tabs.js - 多标签页管理模块
 */
import { els, showConfirm } from './ui.js';
import { EditorManager } from './editor.js';
import { MarkdownManager } from './markdown.js';
import { eventBus } from './event_bus.js';
import { AppContext } from './context.js';
import { getEncodingLabel, checkIsMobile } from './utils.js';
import { SettingsManager } from './settings.js';

let tabs = [];
let isClosingInProgress = false;

/**
 * 渲染标签页 UI
 */
function renderTabsUI() {
    const container = els.tabsRow;
    if (!container) return;
    container.innerHTML = '';

    tabs.forEach(tab => {
        const tabEl = document.createElement('div');
        tabEl.className = 'tab';
        const currentPath = AppContext.state.currentPath;
        if (tab.path === currentPath) {
            tabEl.classList.add('active');
        }

        let isTabDirty = false;
        if (tab.path === currentPath) {
            const editor = EditorManager.getEditor();
            if (editor) {
                const currentContent = editor.getValue();
                isTabDirty = AppContext.state.isEditMode && (currentContent !== AppContext.state.originalContent || AppContext.state.currentEncoding !== AppContext.state.originalEncoding);
            }
        } else {
            isTabDirty = tab.isDirty;
        }

        if (isTabDirty) {
            tabEl.classList.add('dirty');
        }

        tabEl.setAttribute('data-path', tab.path);

        const label = document.createElement('span');
        label.className = 'tab-label';
        label.innerText = tab.name;
        tabEl.appendChild(label);

        const closeBtn = document.createElement('span');
        closeBtn.className = isTabDirty ? 'tab-close dirty-dot' : 'tab-close';
        closeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512"><path d="M289.94 256l95-95A24 24 0 0 0 351 127l-95 95l-95-95a24 24 0 0 0-34 34l95 95l-95 95a24 24 0 1 0 34 34l95-95l95 95a24 24 0 0 0 34-34z" fill="currentColor"></path></svg>';
        closeBtn.title = isTabDirty ? '未保存修改' : '关闭标签页';

        closeBtn.onclick = async (e) => {
            e.stopPropagation();
            await closeTab(tab.path);
        };

        tabEl.appendChild(closeBtn);

        tabEl.onclick = () => {
            if (tab.path !== currentPath) {
                switchTab(tab.path);
            }
        };

        if (tab.path === currentPath) {
            setTimeout(() => {
                tabEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
            }, 50);
        }

        container.appendChild(tabEl);
    });

    setTimeout(updateTabScrollButtons, 50);
}

/**
 * 更新左右滚动按钮置灰状态
 */
function updateTabScrollButtons() {
    const tabsRow = document.getElementById('tabs-row');
    const btnLeft = document.getElementById('tab-scroll-left');
    const btnRight = document.getElementById('tab-scroll-right');
    if (!tabsRow || !btnLeft || !btnRight) return;

    const hasScroll = tabsRow.scrollWidth > tabsRow.clientWidth;
    if (hasScroll) {
        btnLeft.style.display = 'flex';
        btnRight.style.display = 'flex';

        const isAtLeft = tabsRow.scrollLeft <= 1;
        const isAtRight = tabsRow.scrollLeft + tabsRow.clientWidth >= tabsRow.scrollWidth - 1;

        btnLeft.disabled = isAtLeft;
        btnLeft.style.opacity = isAtLeft ? '0.3' : '1';
        btnLeft.style.pointerEvents = isAtLeft ? 'none' : 'auto';

        btnRight.disabled = isAtRight;
        btnRight.style.opacity = isAtRight ? '0.3' : '1';
        btnRight.style.pointerEvents = isAtRight ? 'none' : 'auto';
    } else {
        btnLeft.style.display = 'none';
        btnRight.style.display = 'none';
    }
}

/**
 * 打开标签页
 */
function openTab(path, content, language, mtime, size, encoding, isNew = false, shouldSwitch = true) {
    let existingTab = tabs.find(t => t.path === path);
    if (existingTab) {
        existingTab.originalContent = content;
        existingTab.originalEncoding = encoding;
        existingTab.currentEncoding = encoding;
        existingTab.lastMtime = mtime;
        existingTab.lastSize = size;
        if (existingTab.model) {
            AppContext.update({ isIgnoringChange: true });
            existingTab.model.setValue(content);
            if (language) {
                monaco.editor.setModelLanguage(existingTab.model, language);
            }
            AppContext.update({ isIgnoringChange: false });
        }
        if (shouldSwitch) {
            switchTab(path);
        } else {
            renderTabsUI();
        }
        return;
    }

    let model = monaco.editor.getModel(monaco.Uri.file(path));
    if (!model) {
        model = monaco.editor.createModel(content, language, monaco.Uri.file(path));
    } else {
        if (isNew) {
            model.setValue('');
        }
    }

    const settings = SettingsManager.load();
    const isPCAutoEdit = settings.pcAutoEditMode === true && !checkIsMobile();

    const tab = {
        path,
        name: path.split(/[/\\]/).pop(),
        model,
        originalContent: content,
        originalEncoding: encoding,
        currentEncoding: encoding,
        lastMtime: mtime,
        lastSize: size,
        isEditMode: isNew ? true : (isPCAutoEdit ? true : false),
        viewState: null,
        isNew: isNew,
        isDirty: false
    };

    tabs.push(tab);
    if (shouldSwitch) {
        switchTab(path);
    } else {
        renderTabsUI();
    }
}

/**
 * 切换标签页
 */
function switchTab(path) {
    const currentPath = AppContext.state.currentPath;
    if (currentPath) {
        const activeTab = tabs.find(t => t.path === currentPath);
        const editor = EditorManager.getEditor();
        if (activeTab && editor) {
            activeTab.isEditMode = AppContext.state.isEditMode;
            activeTab.currentEncoding = AppContext.state.currentEncoding;
            activeTab.originalEncoding = AppContext.state.originalEncoding;
            activeTab.originalContent = AppContext.state.originalContent;
            activeTab.lastMtime = AppContext.state.lastMtime;
            activeTab.lastSize = AppContext.state.lastSize;
            activeTab.viewState = editor.saveViewState();
            activeTab.isDirty = AppContext.state.isEditMode && (editor.getValue() !== AppContext.state.originalContent || AppContext.state.currentEncoding !== AppContext.state.originalEncoding);
        }
    }

    const newTab = tabs.find(t => t.path === path);
    if (!newTab) return;

    const editor = EditorManager.getEditor();
    if (!editor) return;

    AppContext.update({
        currentPath: newTab.path,
        currentEncoding: newTab.currentEncoding,
        originalEncoding: newTab.originalEncoding,
        originalContent: newTab.originalContent,
        lastMtime: newTab.lastMtime,
        lastSize: newTab.lastSize || 0,
        isEditMode: newTab.isEditMode,
        isIgnoringChange: true
    });
    window.currentPath = newTab.path;

    editor.setModel(newTab.model);
    AppContext.update({ isIgnoringChange: false });

    eventBus.emit('mode:changed', newTab.isEditMode);

    if (newTab.viewState) {
        try {
            editor.restoreViewState(newTab.viewState);
        } catch (e) {
            Log.info('Editor', '还原视图状态被取消:', e.message || e);
        }
    }

    if (els.encodingSelector) {
        els.encodingSelector.innerText = getEncodingLabel(AppContext.state.currentEncoding);
    }

    EditorManager.updateEOLDisplay();

    const langId = newTab.model.getLanguageId();
    const lang = monaco.languages.getLanguages().find(l => l.id === langId);
    els.langSelector.innerText = lang?.aliases?.[0] || langId;

    const isMD = path.toLowerCase().endsWith('.md') || langId === 'markdown';
    MarkdownManager.togglePreviewBtn(isMD);

    els.welcomeOverlay.style.display = 'none';

    // 触发全局文件选择事件，由 App 协调 UI 渲染
    eventBus.emit('file:selected', { path: newTab.path, isEditMode: newTab.isEditMode });

    const isContentDirty = editor.getValue() !== AppContext.state.originalContent;
    const isEncodingDirty = AppContext.state.currentEncoding !== AppContext.state.originalEncoding;
    els.saveBtn.disabled = !(isContentDirty || isEncodingDirty);

    renderTabsUI();
    editor.focus();
}

/**
 * 关闭标签页
 */
async function closeTab(path) {
    if (isClosingInProgress) return;
    isClosingInProgress = true;

    try {
        const index = tabs.findIndex(t => t.path === path);
        if (index === -1) return;

        const tab = tabs[index];
        const editor = EditorManager.getEditor();
        if (!editor) return;

        let isDirty = false;
        if (tab.path === AppContext.state.currentPath) {
            isDirty = AppContext.state.isEditMode && (editor.getValue() !== AppContext.state.originalContent || AppContext.state.currentEncoding !== AppContext.state.originalEncoding);
        } else {
            isDirty = tab.isDirty;
        }

        if (isDirty) {
            const confirmLeave = await showConfirm(`文件 "${tab.name}" 尚未保存，确定要关闭吗？修改将会丢失。`, '关闭未保存的文件');
            if (!confirmLeave) return;
        }

        // 先解绑并切换活动标签页的 model，再对原 model 进行 dispose
        if (tab.path === AppContext.state.currentPath) {
            if (tabs.length > 1) {
                // 找出下一个切换的标签页（避开当前被关闭的）
                const nextActiveTab = (index < tabs.length - 1) ? tabs[index + 1] : tabs[index - 1];
                switchTab(nextActiveTab.path);
            } else {
                // 无其他标签页时重置为空模型
                AppContext.update({
                    currentPath: '',
                    lastMtime: 0,
                    originalContent: '',
                    currentEncoding: 'utf-8',
                    originalEncoding: 'utf-8',
                    isIgnoringChange: true
                });
                window.currentPath = '';
                document.title = 'PodNote';
                if (els.encodingSelector) els.encodingSelector.innerText = 'UTF-8';
                if (els.manualPathInput) els.manualPathInput.value = '';
                els.welcomeOverlay.style.display = 'flex';
                
                eventBus.emit('status:updated', { text: '准备就绪' });
                EditorManager.updateCharCount();
                
                eventBus.emit('file:selected', { path: '', isEditMode: false });
                MarkdownManager.cleanup();

                let emptyModel = monaco.editor.getModel(monaco.Uri.parse('inmemory://model/empty'));
                if (!emptyModel) {
                    emptyModel = monaco.editor.createModel('', 'plaintext', monaco.Uri.parse('inmemory://model/empty'));
                }
                editor.setModel(emptyModel);
                AppContext.update({ isIgnoringChange: false });
            }
        }

        // 从标签页列表删除并销毁 model
        tabs.splice(index, 1);
        if (tab.model) {
            tab.model.dispose();
        }

        renderTabsUI();
    } finally {
        isClosingInProgress = false;
    }
}

export const TabManager = {
    init() {
        // 绑定事件订阅
        eventBus.on('file:opened', (data) => {
            openTab(
                data.path,
                data.content,
                data.language,
                data.mtime,
                data.size,
                data.encoding,
                data.isNew,
                data.shouldSwitch
            );
        });

        // 绑定 UI 滚动事件
        const btnLeft = document.getElementById('tab-scroll-left');
        const btnRight = document.getElementById('tab-scroll-right');
        
        if (btnLeft && btnRight) {
            btnLeft.onclick = () => {
                const tabsRow = document.getElementById('tabs-row');
                if (tabsRow) tabsRow.scrollBy({ left: -150, behavior: 'smooth' });
            };
            btnRight.onclick = () => {
                const tabsRow = document.getElementById('tabs-row');
                if (tabsRow) tabsRow.scrollBy({ left: 150, behavior: 'smooth' });
            };
        }
        
        const tabsRow = document.getElementById('tabs-row');
        if (tabsRow) {
            tabsRow.addEventListener('scroll', updateTabScrollButtons);
        }

        window.addEventListener('resize', updateTabScrollButtons);
    },

    getTabs() {
        return tabs;
    },

    switch(path) {
        switchTab(path);
    },

    async close(path) {
        await closeTab(path);
    },

    updateActiveTabDirty(isDirty) {
        const activeTab = tabs.find(t => t.path === AppContext.state.currentPath);
        if (activeTab) {
            activeTab.isDirty = isDirty;
            renderTabsUI();
        }
    },

    syncActiveTabSave(mtime, size, content, encoding) {
        const activeTab = tabs.find(t => t.path === AppContext.state.currentPath);
        if (activeTab) {
            activeTab.originalContent = content;
            activeTab.originalEncoding = encoding;
            activeTab.currentEncoding = encoding;
            activeTab.lastMtime = mtime;
            activeTab.lastSize = size;
            activeTab.isNew = false;
            activeTab.isDirty = false;
            renderTabsUI();
        }
    }
};
