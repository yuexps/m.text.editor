/**
 * app.js - PodNote 主入口协调器
 * 负责全局引导、事件编排与子模块初始化
 */

import { API } from './js/api.js';
import { Log, getEncodingLabel, checkIsMobile, createDisposableStore } from './js/utils.js';
import {
    els,
    showToast,
    updateStatus,
    updateBreadcrumbs,
    updateUIState,
    renderFileTree,
    UIManager
} from './js/ui.js';
import { EditorManager } from './js/editor.js';
import { TerminalManager } from './js/terminal.js';
import { SettingsManager } from './js/settings.js';
import { MarkdownManager } from './js/markdown.js';
import { TailManager } from './js/tail.js';
import { eventBus } from './js/event_bus.js';
import { AppContext } from './js/context.js';
import { TabManager } from './js/tabs.js';
import { SearchManager } from './js/search.js';
import { FileIO } from './js/file_io.js';

// 初始化全局上下文状态
AppContext.update({
    currentPath: window.currentPath || '',
    currentEncoding: window.currentEncoding || 'utf-8',
    originalEncoding: window.currentEncoding || 'utf-8'
});

const filePreloadPromise = window.filePreloadPromise || Promise.resolve(null);
let appDisposables = createDisposableStore();

// =============================================================================
// 事件处理器与总线订阅
// =============================================================================

appDisposables.add(eventBus.on('file:selected', (data) => {
    const path = data.path;
    if (path) {
        updateBreadcrumbs(path);
        FileIO.highlightTreeItem(path);
        AppContext.update({ isEditMode: data.isEditMode });
        updateUIState(true, data.isEditMode, (mode) => FileIO.setEditMode(mode, true));
    } else {
        updateBreadcrumbs('');
        updateUIState(false, AppContext.state.isEditMode, FileIO.setEditMode);
    }
}));

appDisposables.add(eventBus.on('status:updated', (data) => {
    updateStatus(data.text, data.color);
}));

appDisposables.add(eventBus.on('workspace:refresh-request', () => {
    const workspacePath = AppContext.state.workspacePath;
    if (workspacePath) {
        FileIO.loadWorkspace(workspacePath);
    }
}));

appDisposables.add(eventBus.on('file:open-request', async (data) => {
    if (data.isNew) {
        await FileIO.loadFile(data.path);
        FileIO.setEditMode(true);
    } else {
        await FileIO.loadFile(data.path);
    }
}));

appDisposables.add(eventBus.on('encoding:changed', (data) => {
    if (AppContext.state.isEditMode) {
        Log.info('UI', '编辑模式切换编码:', data.oldEncoding, '->', AppContext.state.currentEncoding, 'Dirty:', data.totalDirty);
        els.saveBtn.disabled = !data.totalDirty;
        TabManager.updateActiveTabDirty(data.totalDirty);
    } else {
        Log.info('UI', '只读模式切换预览编码:', AppContext.state.currentEncoding);
        const path = AppContext.state.currentPath;
        if (path) FileIO.loadFile(path, false, true);
    }
}));

appDisposables.add(eventBus.on('workspace:load-request', (dir) => {
    FileIO.loadWorkspace(dir);
}));

appDisposables.add(eventBus.on('mode:toggle-request', () => {
    FileIO.setEditMode(!AppContext.state.isEditMode);
}));

appDisposables.add(eventBus.on('file:save-request', () => {
    FileIO.saveFile();
}));

appDisposables.add(eventBus.on('tab:activated', (data) => {
    const editor = EditorManager.getEditor();
    if (!editor) return;
    AppContext.update({ isIgnoringChange: true });
    editor.setModel(data.model);
    AppContext.update({ isIgnoringChange: false });
    if (data.viewState) {
        try {
            editor.restoreViewState(data.viewState);
        } catch (e) {
            Log.info('Editor', '还原视图状态被取消:', e.message || e);
        }
    }
    if (els.encodingSelector) {
        els.encodingSelector.innerText = getEncodingLabel(data.currentEncoding);
    }
    const lang = monaco.languages.getLanguages().find(l => l.id === data.languageId);
    if (els.langSelector) {
        els.langSelector.innerText = lang?.aliases?.[0] || data.languageId;
    }
    EditorManager.updateEOLDisplay();
    const isMD = data.languageId === 'markdown' || data.path.toLowerCase().endsWith('.md');
    MarkdownManager.togglePreviewBtn(isMD);
    if (els.welcomeOverlay) els.welcomeOverlay.style.display = 'none';
    const isContentDirty = editor.getValue() !== data.originalContent;
    const isEncodingDirty = data.currentEncoding !== data.originalEncoding;
    if (els.saveBtn) els.saveBtn.disabled = !(isContentDirty || isEncodingDirty);
    editor.focus();
}));

appDisposables.add(eventBus.on('tab:emptied', () => {
    const editor = EditorManager.getEditor();
    if (!editor) return;
    if (els.encodingSelector) els.encodingSelector.innerText = 'UTF-8';
    if (els.welcomeOverlay) els.welcomeOverlay.style.display = 'flex';
    EditorManager.updateCharCount();
    MarkdownManager.cleanup();
    AppContext.update({ isIgnoringChange: true });
    let emptyModel = monaco.editor.getModel(monaco.Uri.parse('inmemory://model/empty'));
    if (!emptyModel) {
        emptyModel = monaco.editor.createModel('', 'plaintext', monaco.Uri.parse('inmemory://model/empty'));
    }
    editor.setModel(emptyModel);
    AppContext.update({ isIgnoringChange: false });
}));

// =============================================================================

// =============================================================================
// 初始化配置与引导
// =============================================================================

// 初始化编辑器底层 Web Worker 及多语言加载环境
EditorManager.configureEnvironment();

require(['vs/editor/editor.main'], function () {
    Log.success('System', 'Monaco 核心模块已加载');

    (async function init() {
        try {
            const isMobileDevice = checkIsMobile();
            let preloadData = null;
            let shouldOpenSidebar = false;
            let shouldCollapseSidebar = false;

            const userSettings = await SettingsManager.loadFromServer();
            let initialPath = AppContext.state.currentPath;
            if (!initialPath && userSettings.defaultOpenPath) {
                initialPath = userSettings.defaultOpenPath.trim();
                AppContext.update({ currentPath: initialPath });
            }

            if (initialPath) {
                try {
                    const listData = await API.list(initialPath);
                    AppContext.update({ workspacePath: listData.path });
                    renderFileTree(els.fileTree, listData.files, 0);
                    AppContext.update({ currentPath: '' });
                    preloadData = null;
                    showToast('工作区已加载');
                    shouldOpenSidebar = true;
                } catch (err) {
                    const dir = initialPath.substring(0, Math.max(initialPath.lastIndexOf('/'), initialPath.lastIndexOf('\\')));
                    if (dir) {
                        FileIO.loadWorkspace(dir);
                    }
                    Log.info('Editor', '等待预加载数据...');
                    preloadData = await filePreloadPromise;
                    shouldCollapseSidebar = true;
                }
            } else {
                preloadData = await filePreloadPromise;
                Log.info('Editor', '无路径，返回主页');
                shouldCollapseSidebar = true;
            }

            let initialValue = '';
            if (preloadData) {
                if (preloadData.error) {
                    showToast('预读取失败: ' + preloadData.error, true);
                    updateStatus('读取失败', '#f44336');
                } else {
                    if (preloadData.encoding && preloadData.encoding !== AppContext.state.currentEncoding) {
                        Log.info('Init', `预加载自动同步编码: ${AppContext.state.currentEncoding} -> ${preloadData.encoding}`);
                        AppContext.update({
                            currentEncoding: preloadData.encoding,
                            originalEncoding: preloadData.encoding
                        });
                        if (els.encodingSelector) {
                            els.encodingSelector.innerText = getEncodingLabel(AppContext.state.currentEncoding);
                        }
                    }
                    initialValue = preloadData.content !== undefined && preloadData.content !== null ? preloadData.content : '';
                    AppContext.update({
                        originalContent: initialValue,
                        lastMtime: preloadData.mtime,
                        lastSize: preloadData.size || 0
                    });
                }
            }

            const editor = EditorManager.init(els.editorContainer, {
                value: initialValue,
                language: preloadData?.language || 'plaintext',
                theme: userSettings.editorTheme,
                automaticLayout: false,
                fontSize: parseInt(userSettings.fontSize, 10) || 14,
                fontFamily: userSettings.fontFamily,
                minimap: { enabled: userSettings.minimap === true || userSettings.minimap === 'true' },
                scrollBeyondLastLine: false,
                padding: { top: isMobileDevice ? 5 : 10 },
                lineNumbersMinChars: 3,
                folding: !isMobileDevice,
                lineDecorationsWidth: isMobileDevice ? 3 : 5,
                contextmenu: !isMobileDevice,
                fixedOverflowWidgets: true,
                accessibilitySupport: 'on',
                readOnly: true,
                domReadOnly: true,
                unicodeHighlight: { ambiguousCharacters: false, invisibleCharacters: false },
                quickSuggestions: !isMobileDevice,
                links: !isMobileDevice,
                wordWrap: userSettings.wordWrap === 'on' || userSettings.wordWrap === true ? 'on' : 'off',
                renderWhitespace: userSettings.renderWhitespace,
                tabSize: parseInt(userSettings.tabSize, 10) || 4,
                smoothScrolling: !isMobileDevice,
                cursorSmoothCaretAnimation: 'off',
            }, {
                saveFile: () => FileIO.saveFile(),
                toggleEdit: () => FileIO.setEditMode(!AppContext.state.isEditMode)
            });

            // 初始化子业务模块及展现层交互
            UIManager.init();
            TabManager.init();
            SearchManager.init();
            TerminalManager.init();
            TailManager.init();

            // 代理绑定编辑器展现层事件
            UIManager.bindEditorEvents(editor);

            if (shouldOpenSidebar) {
                eventBus.emit('sidebar:panel-request', 'explorer');
            } else if (shouldCollapseSidebar) {
                eventBus.emit('sidebar:collapse-request');
            }

            SettingsManager.bindUI(els.sidebarSettingsForm, editor, (updatedSettings) => {
                Log.info('Settings', '设置已持久化保存并热更新完毕，广播设置变更事件。');
                eventBus.emit('settings:changed', updatedSettings);
            });

            MarkdownManager.init(editor);

            let compareTimer = null;
            editor.onDidChangeModelContent(() => {
                const isEdit = AppContext.state.isEditMode;
                const isIgnoring = AppContext.state.isIgnoringChange;
                if (!isEdit || isIgnoring) return;
                if (compareTimer) clearTimeout(compareTimer);

                const isLargeFile = AppContext.state.originalContent && AppContext.state.originalContent.length > 1024 * 1024;
                const delay = isLargeFile ? 1000 : 300;

                compareTimer = setTimeout(() => {
                    let isContentDirty = false;
                    const model = editor.getModel();
                    if (model) {
                        const currentLength = model.getValueLength();
                        if (currentLength !== (AppContext.state.originalContent ? AppContext.state.originalContent.length : 0)) {
                            isContentDirty = true;
                        } else {
                            isContentDirty = editor.getValue() !== AppContext.state.originalContent;
                        }
                    }
                    const isEncodingDirty = AppContext.state.currentEncoding !== AppContext.state.originalEncoding;
                    const totalDirty = isContentDirty || isEncodingDirty;

                    els.saveBtn.disabled = !totalDirty;
                    EditorManager.updateCharCount();

                    TabManager.updateActiveTabDirty(totalDirty);

                    if (MarkdownManager.isPreviewActive()) {
                        MarkdownManager.updatePreview();
                    }
                }, delay);
                EditorManager.updateEOLDisplay();
            });

            // 初始化历史状态恢复
            const initialPathVal = AppContext.state.currentPath;
            if (initialPathVal) {
                if (preloadData && !preloadData.error) {
                    eventBus.emit('file:opened', {
                        path: initialPathVal,
                        content: preloadData.content !== undefined && preloadData.content !== null ? preloadData.content : '',
                        language: preloadData.language || 'plaintext',
                        mtime: preloadData.mtime,
                        size: preloadData.size || 0,
                        encoding: AppContext.state.currentEncoding,
                        isNew: false,
                        shouldSwitch: true
                    });
                    updateStatus('已加载');
                    EditorManager.updateCharCount();
                } else {
                    FileIO.loadFile(initialPathVal);
                }
            } else {
                FileIO.setEditMode(false);
                eventBus.emit('file:selected', { path: '', isEditMode: false });
                els.welcomeOverlay.style.display = 'flex';
                updateStatus('准备就绪');

                AppContext.update({ isIgnoringChange: true });
                let emptyModel = monaco.editor.getModel(monaco.Uri.parse('inmemory://model/empty'));
                if (!emptyModel) {
                    emptyModel = monaco.editor.createModel('', 'plaintext', monaco.Uri.parse('inmemory://model/empty'));
                }
                editor.setModel(emptyModel);
                AppContext.update({ isIgnoringChange: false });
            }

            EditorManager.updateEOLDisplay();
            const initialLangId = editor.getModel().getLanguageId();
            const initialLang = monaco.languages.getLanguages().find(l => l.id === initialLangId);
            els.langSelector.innerText = initialLang?.aliases?.[0] || initialLangId;

        } catch (e) {
            updateStatus('初始化失败', '#f44336');
            Log.error('Init', '初始化详细错误:', e);
        }
    })();
}, function (err) {
    Log.error('Loader', 'Monaco 加载器错误:', err);
    updateStatus('核心组件加载失败', '#f44336');
});

// 窗口卸载前主动释放终端与监控 WebSocket 长连接
window.addEventListener('beforeunload', () => {
    try {
        appDisposables.dispose();
        UIManager.dispose?.();
        TabManager.dispose?.();
        MarkdownManager.dispose?.();
        SearchManager.dispose?.();
        SettingsManager.dispose?.();
        EditorManager.dispose?.();
        TerminalManager.dispose();
        TailManager.dispose();
    } catch (e) {
        console.error('[PodNote] 卸载资源出错:', e);
    }
});
