/**
 * tabs.js - 多标签页管理模块
 */
import { els, showConfirm } from './ui.js';
import { EditorManager } from './editor.js';
import { eventBus } from './event_bus.js';
import { AppContext } from './context.js';
import { checkIsMobile, createDisposableStore, debounce, frameThrottle } from './utils.js';
import { SettingsManager } from './settings.js';
import { getPreviewType, PreviewManager } from './preview.js';
import { FnosSDK } from './fnos_sdk.js';

let tabs = [];
let isClosingInProgress = false;
let isInitialized = false;
let tabDisposables = createDisposableStore();

/**
 * 渲染标签页 UI
 */
function renderTabsUI() {
    const hasAnyDirtyTab = tabs.some(t => t.isDirty);
    FnosSDK.syncExitPageTipsState(hasAnyDirtyTab);

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

        let isTabDirty = tab.isDirty;

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
const updateTabScrollButtons = frameThrottle(() => {
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
});

/**
 * 打开标签页
 */
function openTab(path, content, language, mtime, size, encoding, isNew = false, shouldSwitch = true, isTruncated = false, isHugeFile = false) {
    const isWelcome = path === 'podnote://welcome';
    const previewType = isWelcome ? 'welcome' : getPreviewType(path);
    const isPreview = !!previewType;

    let existingTab = tabs.find(t => t.path === path);
    if (existingTab) {
        if (isPreview) {
            existingTab.lastMtime = mtime;
            existingTab.lastSize = size;
            if (shouldSwitch) {
                switchTab(path);
            } else {
                renderTabsUI();
            }
            return;
        }
        existingTab.originalContent = content;
        existingTab.originalEncoding = encoding;
        existingTab.currentEncoding = encoding;
        existingTab.lastMtime = mtime;
        existingTab.lastSize = size;
        existingTab.isTruncated = isTruncated;
        existingTab.isHugeFile = isHugeFile;
        if (existingTab.model) {
            AppContext.update({ isIgnoringChange: true });
            existingTab.model.setValue(content);
            const finalLanguage = (isTruncated || isHugeFile) ? 'plaintext' : language;
            if (finalLanguage) {
                monaco.editor.setModelLanguage(existingTab.model, finalLanguage);
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

    if (isPreview) {
        const uri = path.startsWith('podnote://') ? monaco.Uri.parse(path) : monaco.Uri.file(path);
        let model = monaco.editor.getModel(uri);
        if (!model) {
            model = monaco.editor.createModel('', 'plaintext', uri);
        }
        const tab = {
            path,
            name: isWelcome ? '主页' : path.split(/[/\\]/).pop(),
            model,
            originalContent: '',
            originalEncoding: encoding,
            currentEncoding: encoding,
            lastMtime: mtime,
            lastSize: size,
            isEditMode: false,
            viewState: null,
            isNew: false,
            isDirty: false,
            isTruncated: false,
            isHugeFile: false,
            isPreview: true,
            previewType: previewType
        };
        tabs.push(tab);
        if (shouldSwitch) {
            switchTab(path);
        } else {
            renderTabsUI();
        }
        return;
    }

    const finalLanguage = (isTruncated || isHugeFile) ? 'plaintext' : language;
    let model = monaco.editor.getModel(monaco.Uri.file(path));
    if (!model) {
        model = monaco.editor.createModel(content, finalLanguage, monaco.Uri.file(path));
    } else {
        if (isNew) {
            model.setValue('');
        } else {
            AppContext.update({ isIgnoringChange: true });
            model.setValue(content);
            monaco.editor.setModelLanguage(model, finalLanguage);
            AppContext.update({ isIgnoringChange: false });
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
        isDirty: false,
        isTruncated: isTruncated,
        isHugeFile: isHugeFile
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
    if (currentPath && currentPath !== path) {
        const activeTab = tabs.find(t => t.path === currentPath);
        const editor = EditorManager.getEditor();
        if (activeTab && editor && !activeTab.isPreview) {
            activeTab.isEditMode = AppContext.state.isEditMode;
            activeTab.currentEncoding = AppContext.state.currentEncoding;
            activeTab.originalEncoding = AppContext.state.originalEncoding;
            activeTab.originalContent = AppContext.state.originalContent;
            activeTab.lastMtime = AppContext.state.lastMtime;
            activeTab.lastSize = AppContext.state.lastSize;
            activeTab.isDirty = AppContext.state.isEditMode && (AppContext.state.currentEncoding !== AppContext.state.originalEncoding);
            activeTab.viewState = editor.saveViewState();
            if (editor.getValue() !== AppContext.state.originalContent) {
                activeTab.isDirty = true;
            }
        }
    }

    const newTab = tabs.find(t => t.path === path);
    if (!newTab) return;

    AppContext.update({
        currentPath: newTab.path,
        currentEncoding: newTab.currentEncoding,
        originalEncoding: newTab.originalEncoding,
        originalContent: newTab.originalContent,
        lastMtime: newTab.lastMtime,
        lastSize: newTab.lastSize || 0,
        isEditMode: newTab.isEditMode
    });
    window.currentPath = newTab.path;

    const langId = newTab.model.getLanguageId();

    eventBus.emit('tab:activated', {
        path: newTab.path,
        model: newTab.model,
        viewState: newTab.viewState,
        isEditMode: newTab.isEditMode,
        currentEncoding: newTab.currentEncoding,
        originalEncoding: newTab.originalEncoding,
        originalContent: newTab.originalContent,
        languageId: langId,
        isTruncated: newTab.isTruncated,
        isHugeFile: newTab.isHugeFile,
        tabRef: newTab
    });

    eventBus.emit('mode:changed', newTab.isEditMode);

    // 触发全局文件选择事件，由 App 协调 UI 渲染
    eventBus.emit('file:selected', { path: newTab.path, isEditMode: newTab.isEditMode });

    // 分流处理显示/隐藏容器
    if (newTab.isPreview) {
        if (els.editorContainer) els.editorContainer.style.display = 'none';
        if (els.markdownPreviewContainer) els.markdownPreviewContainer.style.display = 'none';
        
        if (newTab.previewType === 'welcome') {
            if (els.filePreviewContainer) {
                els.filePreviewContainer.style.display = 'none';
                PreviewManager.cleanup(els.filePreviewContainer);
            }
            if (els.welcomeOverlay) {
                els.welcomeOverlay.style.display = 'flex';
            }
        } else {
            if (els.welcomeOverlay) {
                els.welcomeOverlay.style.display = 'none';
            }
            if (els.filePreviewContainer) {
                els.filePreviewContainer.style.display = '';
                PreviewManager.render(els.filePreviewContainer, newTab.path, newTab.previewType);
            }
        }

        if (els.editModeBtn) {
            els.editModeBtn.disabled = true;
            els.editModeBtn.style.opacity = '0.3';
            els.editModeBtn.style.pointerEvents = 'none';
        }
        if (els.saveBtn) {
            els.saveBtn.disabled = true;
            els.saveBtn.style.opacity = '0.3';
            els.saveBtn.style.pointerEvents = 'none';
        }
        if (els.previewModeBtn) {
            els.previewModeBtn.style.display = 'none';
        }
    } else {
        if (els.welcomeOverlay) {
            els.welcomeOverlay.style.display = 'none';
        }
        if (els.filePreviewContainer) {
            els.filePreviewContainer.style.display = 'none';
            PreviewManager.cleanup(els.filePreviewContainer);
        }
        if (els.editorContainer) els.editorContainer.style.display = 'block';
        const editor = EditorManager.getEditor();
        if (editor) {
            setTimeout(() => editor.layout(), 10);
        }
        if (els.editModeBtn) {
            const isPerformanceDegraded = newTab.isTruncated || newTab.isHugeFile;
            els.editModeBtn.disabled = isPerformanceDegraded;
            els.editModeBtn.style.opacity = isPerformanceDegraded ? '0.4' : '1';
            els.editModeBtn.style.pointerEvents = isPerformanceDegraded ? 'none' : 'auto';
        }
    }

    renderTabsUI();
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

        let isDirty = tab.isDirty;

        if (isDirty) {
            const confirmLeave = await showConfirm(`文件 "${tab.name}" 尚未保存，确定要关闭吗？修改将会丢失。`, '关闭未保存的文件');
            if (!confirmLeave) return;
        }

        // 先解绑并切换活动标签页的 model，再对原 model 进行 dispose
        if (tab.path === AppContext.state.currentPath) {
            if (tabs.length > 1) {
                const nextActiveTab = (index < tabs.length - 1) ? tabs[index + 1] : tabs[index - 1];
                switchTab(nextActiveTab.path);
            } else {
                // 已经没有其他标签页了，我们先将当前 tab 彻底移除并销毁
                tabs.splice(index, 1);
                if (tab.model) {
                    tab.model.dispose();
                }
                if (tab.isPreview && els.filePreviewContainer) {
                    PreviewManager.cleanup(els.filePreviewContainer);
                }

                // 移除后，重新打开全新的虚拟主页标签页
                openTab('podnote://welcome', '', 'plaintext', 0, 0, 'utf-8', false, true);
                renderTabsUI();
                return;
            }
        }

        // 从标签页列表删除并销毁 model
        tabs.splice(index, 1);
        if (tab.model) {
            tab.model.dispose();
        }
        if (tab.isPreview && els.filePreviewContainer) {
            PreviewManager.cleanup(els.filePreviewContainer);
        }

        renderTabsUI();
    } finally {
        isClosingInProgress = false;
    }
}

export const TabManager = {
    init() {
        if (isInitialized) return;
        isInitialized = true;
        tabDisposables = createDisposableStore();

        // 绑定事件订阅
        tabDisposables.add(eventBus.on('file:opened', (data) => {
            openTab(
                data.path,
                data.content,
                data.language,
                data.mtime,
                data.size,
                data.encoding,
                data.isNew,
                data.shouldSwitch,
                data.isTruncated,
                data.isHugeFile
            );
        }));

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
            tabDisposables.add(() => {
                btnLeft.onclick = null;
                btnRight.onclick = null;
            });
        }
        
        const tabsRow = document.getElementById('tabs-row');
        if (tabsRow) {
            tabsRow.addEventListener('scroll', updateTabScrollButtons, { passive: true });
            tabDisposables.add(() => {
                tabsRow.removeEventListener('scroll', updateTabScrollButtons, { passive: true });
                updateTabScrollButtons.cancel?.();
            });
        }

        const handleResize = debounce(updateTabScrollButtons, 120);
        window.addEventListener('resize', handleResize);
        tabDisposables.add(() => {
            window.removeEventListener('resize', handleResize);
            handleResize.cancel?.();
        });
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
    },

    dispose() {
        tabs.forEach(t => {
            if (t.model) {
                try {
                    t.model.dispose();
                } catch (err) {
                    // 仅捕获异常，防止影响后续释放
                }
            }
        });
        tabs = [];
        tabDisposables.dispose();
        tabDisposables = createDisposableStore();
        isInitialized = false;
    }
};
