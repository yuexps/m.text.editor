/**
 * app.js - NotePod++ 主入口模块
 * 负责协调 API、UI 和 Editor 模块，处理核心业务流程
 */

import { API } from './js/api.js';
import {
    els,
    Log,
    ENCODING_LIST,
    getEncodingLabel,
    showToast,
    updateStatus,
    updateBreadcrumbs,
    updateUIState,
    hideAllPanels
} from './js/ui.js';
import { EditorManager } from './js/editor.js';

// =============================================================================
// [1] 全局业务状态
// =============================================================================
let isEditMode = false;
let isIgnoringChange = false;
let isProcessing = false;

let currentPath = window.currentPath || '';
let currentEncoding = window.currentEncoding || 'utf-8';
let originalEncoding = currentEncoding;
let originalContent = '';
let lastMtime = 0;

const filePreloadPromise = window.filePreloadPromise || Promise.resolve(null);

// =============================================================================
// [2] 核心业务函数
// =============================================================================

/**
 * 设置编辑模式
 */
function setEditMode(enabled) {
    isEditMode = EditorManager.setEditMode(enabled, isEditMode, originalContent, (state) => {
        if (state.isIgnoringChange !== undefined) isIgnoringChange = state.isIgnoringChange;
    });
}

/**
 * 加载文件
 */
async function loadFile(path, isAutoRetry = false, isManual = false) {
    if (isProcessing && !isAutoRetry) return;
    isProcessing = true;

    updateStatus('正在读取...');
    Log.info('IO', '开始读取文件:', path, '编码:', currentEncoding, isManual ? '(手动指定)' : '(自动/预设)');

    try {
        const data = await API.read(path, currentEncoding);

        // 只有在非手动指定编码的情况下，才根据后端建议自动切换
        if (!isManual && data.encoding && data.encoding !== currentEncoding) {
            Log.info('IO', `检测到编码不匹配，自动切换: ${currentEncoding} -> ${data.encoding}`);
            currentEncoding = data.encoding;
            if (els.encodingSelector) {
                els.encodingSelector.innerText = getEncodingLabel(data.encoding);
            }
            showToast(`检测到文件编码为 ${getEncodingLabel(data.encoding)}，已为您自动重载`);
            isProcessing = false;
            return loadFile(path, true);
        }

        Log.success('IO', '文件读取成功, 大小:', data.content.length);
        updateUIState(true, isEditMode, setEditMode);
        els.welcomeOverlay.style.display = 'none';

        const editor = EditorManager.getEditor();
        isIgnoringChange = true;
        editor.setValue(data.content);
        if (data.language) {
            EditorManager.setLanguage(data.language);
        }
        isIgnoringChange = false;

        originalContent = editor.getValue();
        originalEncoding = currentEncoding;
        lastMtime = data.mtime;

        els.saveBtn.disabled = true;
        setEditMode(false);
        updateStatus('已加载');
        EditorManager.updateCharCount();
    } catch (err) {
        Log.error('IO', '读取文件失败:', err);
        updateUIState(false, isEditMode, setEditMode);
        showToast('读取失败: ' + err.message, true);
        updateStatus('读取失败', '#f44336');
    } finally {
        isProcessing = false;
    }
}

/**
 * 新建文件
 */
async function createNewFile(path) {
    if (!path) { showToast('请输入有效的文件路径'); return; }
    if (isProcessing) return;
    isProcessing = true;

    updateStatus('正在预检...');
    Log.info('UI', '请求后端预检新建路径:', path);

    try {
        const data = await API.checkCreate(path);
        Log.success('IO', '后端预检通过，进入新建模式');

        currentPath = path;
        els.tabFilename.innerText = path.split(/[/\\]/).pop();
        updateBreadcrumbs(path, handleBreadcrumbsClick);
        els.welcomeOverlay.style.display = 'none';

        updateUIState(true, isEditMode, setEditMode);
        const editor = EditorManager.getEditor();
        isIgnoringChange = true;
        editor.setValue('');
        if (data.language) {
            EditorManager.setLanguage(data.language);
        }
        isIgnoringChange = false;

        originalContent = '';
        lastMtime = 0;

        setEditMode(true);
        updateStatus('准备新建');
        showToast('验证通过，保存后将创建文件');
    } catch (err) {
        Log.error('IO', '新建预检失败:', err);
        showToast('无法新建: ' + err.message, true);
        updateStatus('新建失败', '#f44336');
    } finally {
        isProcessing = false;
    }
}

/**
 * 保存文件
 */
async function saveFile() {
    if (!currentPath || isProcessing || !isEditMode) return;
    const editor = EditorManager.getEditor();
    if (!editor) return;

    isProcessing = true;
    els.saveBtn.disabled = true;
    updateStatus('正在保存...');
    Log.info('IO', '开始保存文件:', currentPath, '编码:', currentEncoding);

    try {
        const data = await API.save(currentPath, editor.getValue(), currentEncoding, lastMtime);
        Log.success('IO', '文件保存成功');
        originalContent = editor.getValue();
        originalEncoding = currentEncoding;
        lastMtime = data.mtime;
        els.saveBtn.disabled = true;
        showToast('保存成功');
        updateStatus('已保存');
    } catch (err) {
        Log.error('IO', '保存文件失败:', err);
        showToast('保存失败: ' + err.message, true);
        updateStatus('保存失败', '#f44336');
        els.saveBtn.disabled = false;
    } finally {
        isProcessing = false;
    }
}

// =============================================================================
// [3] 事件处理器
// =============================================================================

async function handleBreadcrumbsClick() {
    if (!currentPath) return;
    try {
        await navigator.clipboard.writeText(currentPath);
        showToast('路径已复制');
    } catch (err) {
        showToast('复制失败: ' + err.message, true);
    }
}

function handleManualOpen() {
    const path = els.manualPathInput.value.trim();
    if (!path) { showToast('请输入有效的文件路径'); return; }
    Log.info('UI', '手动请求打开文件:', path);
    currentPath = path;
    els.tabFilename.innerText = path.split(/[/\\]/).pop();
    updateBreadcrumbs(path, handleBreadcrumbsClick);
    els.welcomeOverlay.style.display = 'none';
    loadFile(path);
}

// =============================================================================
// [4] 初始化引导
// =============================================================================

require.config({
    paths: { 'vs': '/app/m-text-editor/vs' }
});

require(['vs/editor/editor.main'], function () {
    Log.success('System', 'Monaco 核心模块已加载');

    (async function init() {
        try {
            const isMobile = window.innerWidth <= 768;
            let preloadData = null;

            if (currentPath) {
                Log.info('Editor', '等待预加载数据...');
                preloadData = await filePreloadPromise;
            } else {
                // 无路径时，确保 Promise 已解决（通常 index.html 已处理）
                preloadData = await filePreloadPromise;
                Log.info('Editor', '无路径，返回主页');
            }

            let initialValue = '';
            if (preloadData) {
                if (preloadData.error) {
                    showToast('预读取失败: ' + preloadData.error, true);
                    updateStatus('读取失败', '#f44336');
                } else {
                    // 如果编码建议且与当前不符，则后端已执行“主动转码”
                    if (preloadData.encoding && preloadData.encoding !== currentEncoding) {
                        Log.info('Init', `预加载自动同步编码: ${currentEncoding} -> ${preloadData.encoding}`);
                        currentEncoding = preloadData.encoding;
                        originalEncoding = currentEncoding; // 此时数据是正确的，可以同步原始状态
                        if (els.encodingSelector) {
                            els.encodingSelector.innerText = getEncodingLabel(currentEncoding);
                        }
                    }
                    initialValue = preloadData.content;
                    originalContent = initialValue;
                    lastMtime = preloadData.mtime;
                }
            }

            const editor = EditorManager.init(els.editorContainer, {
                value: initialValue,
                language: preloadData?.language || 'plaintext',
                theme: 'vs-dark',
                automaticLayout: false,
                fontSize: isMobile ? 13 : 14,
                fontFamily: "Consolas, 'Courier New', monospace",
                minimap: { enabled: !isMobile },
                scrollBeyondLastLine: false,
                padding: { top: isMobile ? 5 : 10 },
                lineNumbersMinChars: 3,
                folding: !isMobile,
                lineDecorationsWidth: isMobile ? 3 : 5,
                contextmenu: !isMobile,
                fixedOverflowWidgets: true,
                accessibilitySupport: 'on',
                readOnly: true,
                unicodeHighlight: { ambiguousCharacters: false, invisibleCharacters: false },
                quickSuggestions: !isMobile,
                links: !isMobile,
                wordWrap: 'on',
                renderWhitespace: 'none',
                smoothScrolling: !isMobile,
                cursorSmoothCaretAnimation: 'off',
            });

            const resizeObserver = new ResizeObserver(() => editor.layout());
            resizeObserver.observe(els.editorContainer);

            // [4.1] 绑定编辑器基础事件
            editor.onDidFocusEditorText(() => hideAllPanels());
            editor.onMouseDown(() => hideAllPanels());
            editor.onDidChangeCursorPosition((e) => {
                els.posDisplay.innerText = `行 ${e.position.lineNumber}，列 ${e.position.column}`;
            });
            editor.onDidChangeCursorSelection(() => EditorManager.updateCharCount());

            let compareTimer = null;
            editor.onDidChangeModelContent(() => {
                if (!isEditMode || isIgnoringChange) return;
                if (compareTimer) clearTimeout(compareTimer);
                compareTimer = setTimeout(() => {
                    const isContentDirty = editor.getValue() !== originalContent;
                    const isEncodingDirty = currentEncoding !== originalEncoding;
                    els.saveBtn.disabled = !(isContentDirty || isEncodingDirty);
                    EditorManager.updateCharCount();
                }, 300);
                EditorManager.updateEOLDisplay();
            });

            editor.onDidChangeModelLanguage(() => {
                const langId = editor.getModel().getLanguageId();
                const lang = monaco.languages.getLanguages().find(l => l.id === langId);
                els.langSelector.innerText = lang?.aliases?.[0] || langId;
            });

            // [4.2] 绑定工具栏按钮
            els.editModeBtn.onclick = () => { setEditMode(!isEditMode); els.editModeBtn.blur(); };
            els.saveBtn.onclick = () => { saveFile(); els.saveBtn.blur(); };
            els.undoBtn.onclick = () => { Log.info('Toolbar', '执行撤销'); editor.trigger('keyboard', 'undo'); els.undoBtn.blur(); };
            els.redoBtn.onclick = () => { Log.info('Toolbar', '执行恢复'); editor.trigger('keyboard', 'redo'); els.redoBtn.blur(); };

            els.copyBtn.onclick = async () => {
                editor.focus();
                const text = editor.getModel().getValueInRange(editor.getSelection());
                if (!text) { showToast('未选中任何文本'); return; }
                try {
                    await navigator.clipboard.writeText(text);
                    showToast('已复制到剪贴板');
                } catch (err) {
                    showToast('复制失败: ' + err.message, true);
                }
                els.copyBtn.blur();
            };

            els.pasteBtn.onclick = async () => {
                editor.focus();
                try {
                    const text = await navigator.clipboard.readText();
                    editor.executeEdits('paste-action', [{ range: editor.getSelection(), text: text, forceMoveMarkers: true }]);
                    showToast('已粘贴');
                } catch (err) {
                    showToast('粘贴失败，请检查权限', true);
                }
                els.pasteBtn.blur();
            };

            els.findBtn.onclick = () => { editor.getAction('actions.find').run(); els.findBtn.blur(); };
            els.replaceBtn.onclick = () => { editor.getAction('editor.action.startFindReplaceAction').run(); els.replaceBtn.blur(); };

            // [4.3] 绑定状态栏选择器
            els.langSelector.onclick = (e) => {
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
                els.langPanel.style.display = 'flex';
            };

            els.encodingSelector.onclick = (e) => {
                e.stopPropagation();
                hideAllPanels();
                els.encodingList.innerHTML = '';
                ENCODING_LIST.forEach(enc => {
                    const item = document.createElement('div');
                    item.className = 'lang-item';
                    item.innerHTML = `<span>${enc.label}</span><span class="lang-id">${enc.id.toUpperCase()}</span>`;
                    item.onclick = () => {
                        const oldEncoding = currentEncoding;
                        currentEncoding = enc.id;
                        els.encodingSelector.innerText = getEncodingLabel(enc.id);
                        els.encodingPanel.style.display = 'none';

                        const isContentDirty = editor && editor.getValue() !== originalContent;
                        const isEncodingDirty = currentEncoding !== originalEncoding;
                        const totalDirty = isContentDirty || isEncodingDirty;

                        if (isEditMode) {
                            Log.info('UI', '编辑模式切换编码:', oldEncoding, '->', currentEncoding, 'Dirty:', totalDirty);
                            els.saveBtn.disabled = !totalDirty;
                        } else {
                            Log.info('UI', '只读模式切换预览编码:', currentEncoding);
                            if (currentPath) loadFile(currentPath, false, true);
                        }
                    };
                    els.encodingList.appendChild(item);
                });
                els.encodingPanel.style.display = 'flex';
            };

            els.eolSelector.onclick = (e) => {
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
                        editor.getModel().setEOL(type.value);
                        els.eolSelector.innerText = type.id;
                        els.eolPanel.style.display = 'none';
                        showToast(`换行符已切换为 ${type.id}`);
                    };
                    els.eolList.appendChild(item);
                });
                els.eolPanel.style.display = 'flex';
            };

            document.addEventListener('click', (e) => {
                if (!e.target.closest('.lang-panel') && !e.target.closest('.status-item') && !e.target.closest('.text-link-btn')) {
                    hideAllPanels();
                }
            }, true);

            editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
                if (isEditMode) saveFile();
            });

            // [4.4] 业务逻辑绑定
            if (els.openPathBtn) els.openPathBtn.onclick = handleManualOpen;
            if (els.createPathBtn) els.createPathBtn.onclick = () => createNewFile(els.manualPathInput.value.trim());
            if (els.manualPathInput) {
                els.manualPathInput.onkeydown = (e) => {
                    if (e.key === 'Enter') { handleManualOpen(); els.manualPathInput.blur(); }
                };
            }

            if (els.tabCloseBtn) {
                els.tabCloseBtn.onclick = (e) => {
                    e.stopPropagation();
                    currentPath = '';
                    window.currentPath = '';
                    lastMtime = 0;
                    originalContent = '';
                    currentEncoding = 'utf-8';
                    originalEncoding = 'utf-8';
                    document.title = 'NotePod++';
                    els.tabFilename.innerText = '未选择文件';
                    if (els.encodingSelector) els.encodingSelector.innerText = 'UTF-8';
                    if (els.manualPathInput) els.manualPathInput.value = '';
                    els.welcomeOverlay.style.display = 'flex';
                    updateStatus('准备就绪');
                    EditorManager.updateCharCount();
                    updateBreadcrumbs('', handleBreadcrumbsClick);
                    setEditMode(false);
                    updateUIState(false, isEditMode, setEditMode);
                    isIgnoringChange = true;
                    editor.setValue('');
                    EditorManager.setLanguage('plaintext');
                    isIgnoringChange = false;
                    setTimeout(() => els.manualPathInput?.focus(), 100);
                };
            }

            // [4.5] 初始状态检测
            if (currentPath) {
                // 仅设置 UI 框架状态，不触发模式逻辑
                updateUIState(true, isEditMode, null);
                els.welcomeOverlay.style.display = 'none';
                els.tabFilename.innerText = currentPath.split(/[/\\]/).pop();
                updateBreadcrumbs(currentPath, handleBreadcrumbsClick);

                if (preloadData && !preloadData.error) {
                    // 数据已经通过预加载加载（包括自动转码后的数据）
                    setEditMode(false);
                    updateStatus('已加载');
                    EditorManager.updateCharCount();
                } else {
                    // 仅在没有预加载数据或预加载出错时才执行标准加载
                    loadFile(currentPath);
                }
            } else {
                setEditMode(false);
                updateUIState(false, isEditMode, null);
                els.welcomeOverlay.style.display = 'flex';
                updateStatus('准备就绪');
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