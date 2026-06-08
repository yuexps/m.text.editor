/**
 * app.js - PodNote 主入口协调器
 * 负责全局 I/O 调度、核心引导及事件分发
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

// 初始化全局上下文状态
AppContext.update({
    currentPath: window.currentPath || '',
    currentEncoding: window.currentEncoding || 'utf-8',
    originalEncoding: window.currentEncoding || 'utf-8'
});

const filePreloadPromise = window.filePreloadPromise || Promise.resolve(null);
let loadAbortController = null;
let foregroundLoadSeq = 0;
let workspaceLoadSeq = 0;
let appDisposables = createDisposableStore();

/**
 * 切换编辑/只读模式
 */
function setEditMode(enabled, skipReset = false) {
    const isEdit = AppContext.state.isEditMode;
    const originalContent = AppContext.state.originalContent;
    const newEditMode = EditorManager.setEditMode(enabled, isEdit, originalContent, (state) => {
        if (state.isIgnoringChange !== undefined) {
            AppContext.update({ isIgnoringChange: state.isIgnoringChange });
        }
    }, skipReset);

    AppContext.update({ isEditMode: newEditMode });
    eventBus.emit('mode:changed', newEditMode);
}

/**
 * 加载工作区目录列表
 */
async function loadWorkspace(path) {
    if (!path) return;
    const requestId = ++workspaceLoadSeq;
    Log.info('Workspace', '开始加载工作区目录:', path);
    try {
        const data = await API.list(path);
        if (requestId !== workspaceLoadSeq) return;
        AppContext.update({ workspacePath: data.path });
        renderFileTree(els.fileTree, data.files, 0);
    } catch (err) {
        if (requestId !== workspaceLoadSeq) return;
        Log.error('Workspace', '加载工作区失败:', err);
        showToast('无法读取工作区: ' + err.message, true);
    }
}

/**
 * 高亮当前活跃的文件树节点
 */
function highlightTreeItem(path) {
    if (!path) return;
    document.querySelectorAll('.tree-item').forEach(el => {
        if (el.getAttribute('data-path') === path) {
            el.classList.add('active');
            let parent = el.parentElement.closest('.tree-children');
            while (parent) {
                parent.classList.add('visible');
                const folderItem = parent.previousElementSibling;
                if (folderItem && folderItem.classList.contains('tree-item')) {
                    const arrow = folderItem.querySelector('.tree-item-arrow');
                    if (arrow) arrow.classList.add('expanded');
                }
                parent = parent.parentElement.closest('.tree-children');
            }
        } else {
            el.classList.remove('active');
        }
    });
}

/**
 * 加载文件内容
 */
async function loadFile(path, isAutoRetry = false, isManual = false, shouldSwitch = true) {
    const isForegroundLoad = shouldSwitch !== false;
    if (AppContext.state.isProcessing && AppContext.state.processingKind !== 'load' && !isAutoRetry && !isManual) return;

    if (!isManual) {
        const existingTab = TabManager.getTabs().find(t => t.path === path);
        if (existingTab) {
            TabManager.switch(path);
            return;
        }
    }

    if (loadAbortController && !isAutoRetry && isForegroundLoad) {
        loadAbortController.abort();
    }
    let controller;
    let requestId = 0;
    if (isForegroundLoad) {
        if (!isAutoRetry || !loadAbortController) {
            loadAbortController = new AbortController();
        }
        controller = loadAbortController;
        requestId = ++foregroundLoadSeq;
    } else {
        controller = new AbortController();
    }
    const signal = controller.signal;
    const isCurrentForegroundRequest = () => {
        return !isForegroundLoad || (loadAbortController === controller && requestId === foregroundLoadSeq && !signal.aborted);
    };

    if (isForegroundLoad) {
        AppContext.update({ isProcessing: true, processingKind: 'load', pendingPath: path });
        updateStatus('正在读取...');
    }
    Log.info('IO', '开始读取文件:', path, '编码:', AppContext.state.currentEncoding, isManual ? '(手动指定)' : '(自动/预设)');

    try {
        let data = await API.read(path, AppContext.state.currentEncoding, signal);
        if (!isCurrentForegroundRequest()) return;

        if (!isManual && data.encoding && data.encoding !== AppContext.state.currentEncoding) {
            Log.info('IO', `检测到编码不匹配，自动切换: ${AppContext.state.currentEncoding} -> ${data.encoding}`);
            AppContext.update({ currentEncoding: data.encoding });
            if (els.encodingSelector) {
                els.encodingSelector.innerText = getEncodingLabel(data.encoding);
            }
            showToast(`检测到文件编码为 ${getEncodingLabel(data.encoding)}，已为您自动重载`);
            data = await API.read(path, AppContext.state.currentEncoding, signal);
            if (!isCurrentForegroundRequest()) return;
        }

        const contentVal = data.content !== undefined && data.content !== null ? data.content : '';
        Log.success('IO', '文件读取成功, 大小:', contentVal.length);

        const finalShouldSwitch = shouldSwitch;

        eventBus.emit('file:opened', {
            path,
            content: contentVal,
            language: data.language,
            mtime: data.mtime,
            size: data.size,
            encoding: AppContext.state.currentEncoding,
            isNew: false,
            shouldSwitch: finalShouldSwitch
        });

        if (!finalShouldSwitch) {
            const addedTab = TabManager.getTabs().find(t => t.path === path);
            if (addedTab) {
                addedTab.isDirty = false;
            }
            showToast(`文件 "${path.split(/[/\\]/).pop()}" 已在后台加载完成`);
        }

        if (isForegroundLoad) {
            updateStatus('已加载');
        }
    } catch (err) {
        if (err.name === 'AbortError') {
            Log.info('IO', '文件读取请求已被主动中止:', path);
            return;
        }
        if (!isCurrentForegroundRequest()) return;
        Log.error('IO', '读取文件失败:', err);
        
        if (isForegroundLoad) {
            const hasActiveTabs = TabManager.getTabs().length > 0 && AppContext.state.currentPath;
            if (hasActiveTabs) {
                highlightTreeItem(AppContext.state.currentPath);
            } else {
                updateUIState(false, AppContext.state.isEditMode, setEditMode);
                if (els.welcomeOverlay) {
                    els.welcomeOverlay.style.display = 'flex';
                }
                if (els.manualPathInput) {
                    els.manualPathInput.value = path;
                }
            }
        }
        
        showToast('读取失败: ' + err.message, true);
        if (isForegroundLoad) {
            updateStatus('读取失败', '#f44336');
        }
    } finally {
        if (isForegroundLoad && loadAbortController === controller) {
            AppContext.update({ isProcessing: false, processingKind: '', pendingPath: '' });
            loadAbortController = null;
        }
    }
}

/**
 * 新建文件预检
 */
async function createNewFile(path) {
    if (!path) { showToast('请输入有效的文件路径'); return; }
    if (AppContext.state.isProcessing) return;
    AppContext.update({ isProcessing: true, processingKind: 'create', pendingPath: path });

    const existingTab = TabManager.getTabs().find(t => t.path === path);
    if (existingTab) {
        TabManager.switch(path);
        AppContext.update({ isProcessing: false, processingKind: '', pendingPath: '' });
        return;
    }

    updateStatus('正在预检...');
    Log.info('UI', '请求后端预检新建路径:', path);

    try {
        const data = await API.checkCreate(path);
        Log.success('IO', '后端预检通过，进入新建模式');
        
        eventBus.emit('file:opened', {
            path,
            content: '',
            language: data.language,
            mtime: 0,
            size: 0,
            encoding: AppContext.state.currentEncoding,
            isNew: true,
            shouldSwitch: true
        });
        setEditMode(true);
        updateStatus('准备新建');
        showToast('验证通过，保存后将创建文件');
    } catch (err) {
        Log.error('IO', '新建预检失败:', err);
        showToast('无法新建: ' + err.message, true);
        updateStatus('新建失败', '#f44336');
    } finally {
        AppContext.update({ isProcessing: false, processingKind: '', pendingPath: '' });
    }
}

/**
 * 保存文件
 */
async function saveFile() {
    const currentPath = AppContext.state.currentPath;
    const isEditMode = AppContext.state.isEditMode;
    if (!currentPath || AppContext.state.isProcessing || !isEditMode) return;
    const editor = EditorManager.getEditor();
    if (!editor) return;

    AppContext.update({ isProcessing: true, processingKind: 'save', pendingPath: currentPath });
    els.saveBtn.disabled = true;
    updateStatus('正在保存...');
    Log.info('IO', '开始保存文件:', currentPath, '编码:', AppContext.state.currentEncoding);

    try {
        const data = await API.save(currentPath, editor.getValue(), AppContext.state.currentEncoding, AppContext.state.lastMtime);
        Log.success('IO', '文件保存成功');

        AppContext.update({
            originalContent: editor.getValue(),
            originalEncoding: AppContext.state.currentEncoding,
            lastMtime: data.mtime,
            lastSize: data.size || 0
        });

        TabManager.syncActiveTabSave(data.mtime, data.size || 0, editor.getValue(), AppContext.state.currentEncoding);
        eventBus.emit('file:saved', { path: currentPath, mtime: data.mtime, size: data.size || 0 });

        els.saveBtn.disabled = true;
        showToast('保存成功');
        updateStatus('已保存');
    } catch (err) {
        Log.error('IO', '保存文件失败:', err);
        showToast('保存失败: ' + err.message, true);
        updateStatus('保存失败', '#f44336');
        els.saveBtn.disabled = false;
    } finally {
        AppContext.update({ isProcessing: false, processingKind: '', pendingPath: '' });
    }
}

// =============================================================================
// 事件处理器与总线订阅
// =============================================================================

appDisposables.add(eventBus.on('file:selected', (data) => {
    const path = data.path;
    if (path) {
        updateBreadcrumbs(path);
        highlightTreeItem(path);
        AppContext.update({ isEditMode: data.isEditMode });
        updateUIState(true, data.isEditMode, (mode) => setEditMode(mode, true));
    } else {
        updateBreadcrumbs('');
        updateUIState(false, AppContext.state.isEditMode, setEditMode);
    }
}));

appDisposables.add(eventBus.on('status:updated', (data) => {
    updateStatus(data.text, data.color);
}));

appDisposables.add(eventBus.on('workspace:refresh-request', () => {
    const workspacePath = AppContext.state.workspacePath;
    if (workspacePath) {
        loadWorkspace(workspacePath);
    }
}));

appDisposables.add(eventBus.on('file:open-request', async (data) => {
    if (data.isNew) {
        await loadFile(data.path);
        setEditMode(true);
    } else {
        await loadFile(data.path);
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
        if (path) loadFile(path, false, true);
    }
}));

appDisposables.add(eventBus.on('workspace:load-request', (dir) => {
    loadWorkspace(dir);
}));

appDisposables.add(eventBus.on('mode:toggle-request', () => {
    setEditMode(!AppContext.state.isEditMode);
}));

appDisposables.add(eventBus.on('file:save-request', () => {
    saveFile();
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
                        loadWorkspace(dir);
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
                saveFile: () => saveFile(),
                toggleEdit: () => setEditMode(!AppContext.state.isEditMode)
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
                    loadFile(initialPathVal);
                }
            } else {
                setEditMode(false);
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
