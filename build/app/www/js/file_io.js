/**
 * file_io.js - 文件加载/保存/新建业务逻辑
 */

import { API } from './api.js';
import { Log, getEncodingLabel } from './utils.js';
import { AppContext } from './context.js';
import { eventBus } from './event_bus.js';
import { EditorManager } from './editor.js';
import { TabManager } from './tabs.js';
import { getPreviewType } from './preview.js';
import { els, showToast, updateStatus, updateBreadcrumbs, updateUIState, renderFileTree } from './ui.js';

let loadAbortController = null;
let foregroundLoadSeq = 0;
let workspaceLoadSeq = 0;

/**
 * 切换编辑/只读模式
 */
function setEditMode(enabled, skipReset = false) {
    const activeTab = TabManager.getTabs().find(t => t.path === AppContext.state.currentPath);
    if (activeTab && (activeTab.isTruncated || activeTab.isHugeFile)) {
        if (enabled) {
            showToast(activeTab.isTruncated ? "大文件已截断加载，仅支持只读预览。" : "大文件为保证性能，仅支持只读预览。", true, 6000);
            return;
        }
    }

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
 * 加载文件内容
 */
async function loadFile(path, isAutoRetry = false, isManual = false, shouldSwitch = true) {
    const previewType = getPreviewType(path);
    if (previewType) {
        eventBus.emit('file:opened', {
            path,
            content: '',
            language: previewType,
            mtime: Date.now() / 1000,
            size: 0,
            encoding: 'utf-8',
            isNew: false,
            shouldSwitch: shouldSwitch,
            isTruncated: false,
            isHugeFile: false
        });
        if (shouldSwitch !== false) {
            updateStatus('已加载');
        }
        return;
    }

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
            shouldSwitch: finalShouldSwitch,
            isTruncated: data.is_truncated,
            isHugeFile: data.is_huge_file
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

export const FileIO = {
    setEditMode,
    loadFile,
    saveFile,
    createNewFile,
    loadWorkspace,
    highlightTreeItem
};
