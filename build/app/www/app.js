/**
 * NotePod++ - 前端主脚本
 * 负责 Monaco 编辑器初始化、文件 IO 及 UI 交互逻辑
 */

// =============================================================================
// [1] 全局状态与常量
// =============================================================================
let editor;
let isEditMode = false;
let isIgnoringChange = false;
let isProcessing = false; // 并发锁，防止重复点击或重叠操作

let currentPath = window.currentPath || '';
let currentEncoding = window.currentEncoding || 'utf-8';
let originalContent = ''; // 记录原始内容用于比对
let lastMtime = 0;       // 记录最后修改时间用于冲突检测

// filePreloadPromise 已经在 index.html 中发起
const filePreloadPromise = window.filePreloadPromise || Promise.resolve(null);

// =============================================================================
// [2] UI 元素引用
// =============================================================================
const els = {
    // 顶部工具栏
    editModeBtn: document.getElementById('edit-mode-btn'),
    saveBtn: document.getElementById('save-btn'),
    undoBtn: document.getElementById('undo-btn'),
    redoBtn: document.getElementById('redo-btn'),
    copyBtn: document.getElementById('copy-btn'),
    pasteBtn: document.getElementById('paste-btn'),
    findBtn: document.getElementById('find-btn'),
    replaceBtn: document.getElementById('replace-btn'),

    // 标签与路径
    tabFilename: document.getElementById('tab-filename'),
    tabCloseBtn: document.querySelector('.tab-close'),
    breadcrumbs: document.getElementById('breadcrumbs'),

    // 欢迎页/输入
    welcomeOverlay: document.getElementById('welcome-overlay'),
    manualPathInput: document.getElementById('manual-path-input'),
    openPathBtn: document.getElementById('open-path-btn'),

    // 底部状态栏
    statusText: document.getElementById('status-text'),
    posDisplay: document.getElementById('pos-display'),
    langSelector: document.getElementById('lang-selector'),
    langPanel: document.getElementById('lang-panel'),
    langList: document.getElementById('lang-list'),
    encodingSelector: document.getElementById('encoding-selector'),
    encodingPanel: document.getElementById('encoding-panel'),
    encodingList: document.getElementById('encoding-list'),
    eolSelector: document.getElementById('eol-selector'),
    eolPanel: document.getElementById('eol-panel'),
    eolList: document.getElementById('eol-list'),

    // 容器与反馈
    editorContainer: document.getElementById('editor-container'),
    toast: document.getElementById('toast')
};

// =============================================================================
// [3] 工具函数
// =============================================================================

/**
 * 日志管理器
 */
const Log = {
    prefix: 'NotePod++',
    info(tag, ...args) { console.log(`%c${this.prefix}%c [${tag}]`, 'color: #9e9e9e', 'color: #2196F3; font-weight: bold', ...args); },
    warn(tag, ...args) { console.warn(`%c${this.prefix}%c [${tag}]`, 'color: #9e9e9e', 'color: #FF9800; font-weight: bold', ...args); },
    error(tag, ...args) { console.error(`%c${this.prefix}%c [${tag}]`, 'color: #9e9e9e', 'color: #F44336; font-weight: bold', ...args); },
    success(tag, ...args) { console.log(`%c${this.prefix}%c [${tag}]`, 'color: #9e9e9e', 'color: #4CAF50; font-weight: bold', ...args); }
};

/**
 * 根据文件路径获取对应的语言 ID
 */
function getLang(path) {
    if (!path) return 'plaintext';
    const ext = path.split('.').pop().toLowerCase();
    const map = {
        'js': 'javascript', 'ts': 'typescript', 'jsx': 'javascript', 'tsx': 'typescript',
        'html': 'html', 'css': 'css', 'scss': 'scss', 'less': 'less', 'vue': 'html', 'svelte': 'html', 'astro': 'html',
        'json': 'json', 'json5': 'json', 'jsonl': 'json', 'md': 'markdown', 'go': 'go', 'py': 'python',
        'c': 'c', 'cpp': 'cpp', 'h': 'c', 'hpp': 'cpp', 'cs': 'csharp',
        'java': 'java', 'php': 'php', 'sql': 'sql', 'rs': 'rust', 'rb': 'ruby',
        'lua': 'lua', 'pl': 'perl', 'pm': 'perl', 'sh': 'shell', 'bash': 'shell', 'zsh': 'shell', 'fish': 'shell', 'ps1': 'powershell', 'bat': 'bat', 'cmd': 'bat',
        'yml': 'yaml', 'yaml': 'yaml', 'xml': 'xml', 'plist': 'xml', 'dockerfile': 'dockerfile',
        'conf': 'ini', 'ini': 'ini', 'properties': 'ini', 'cfg': 'ini', 'config': 'ini', 'env': 'ini', 'editorconfig': 'ini', 'gitconfig': 'ini',
        'toml': 'toml', 'makefile': 'makefile', 'mk': 'makefile', 'cmake': 'makefile', 'gradle': 'gradle'
    };
    return map[ext] || 'plaintext';
}

/**
 * 显示浮层提示
 */
function showToast(msg, isError = false) {
    const t = els.toast;
    if (!t) return;
    t.innerText = msg;
    t.style.display = 'block';
    t.style.background = isError ? '#f44336' : '#323232';
    t.style.border = '1px solid var(--border-color)';
    t.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';
    setTimeout(() => t.style.display = 'none', 3000);
}

/**
 * 更新状态栏文字
 */
function updateStatus(text, color) {
    if (els.statusText) {
        els.statusText.innerText = text;
        els.statusText.style.color = color || 'var(--status-text)';
    }
}

/**
 * 更新面包屑路径显示，并绑定点击复制
 */
function updateBreadcrumbs(path) {
    if (!els.breadcrumbs) return;
    Log.info('UI', '更新显示文件路径:', path);
    els.breadcrumbs.innerText = path;
    els.breadcrumbs.title = "点击复制完整路径";
    els.breadcrumbs.style.cursor = "pointer";

    els.breadcrumbs.onclick = async () => {
        if (!path) return;
        try {
            await navigator.clipboard.writeText(path);
            showToast('路径已复制');
        } catch (err) {
            showToast('复制失败: ' + err.message, true);
        }
    };
}

// =============================================================================
// [4] UI 核心控制
// =============================================================================

/**
 * 更新界面可用性状态（是否有打开的文件）
 */
function updateUIState(hasFile) {
    Log.info('UI', '更新界面可用性, hasFile:', hasFile);

    const allActionIds = [
        'edit-mode-btn', 'save-btn', 'undo-btn', 'redo-btn',
        'copy-btn', 'paste-btn', 'find-btn', 'replace-btn',
        'eol-selector', 'lang-selector', 'encoding-selector'
    ];

    allActionIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (hasFile) {
                el.style.opacity = '1';
                el.style.pointerEvents = 'auto';
                if (el.tagName === 'BUTTON') el.disabled = false;
            } else {
                el.style.opacity = '0.3';
                el.style.pointerEvents = 'none';
                if (el.tagName === 'BUTTON') el.disabled = true;
            }
        }
    });

    if (els.tabCloseBtn) {
        els.tabCloseBtn.style.display = hasFile ? 'flex' : 'none';
    }

    if (hasFile) {
        setEditMode(isEditMode);
    }
}

/**
 * 切换编辑/只读模式
 */
function setEditMode(enabled) {
    if (!editor || !els.editModeBtn || !els.saveBtn) return;

    // 从编辑模式切换到只读模式（即点击了“取消”），则还原内容
    if (isEditMode && !enabled) {
        isIgnoringChange = true;
        editor.setValue(originalContent);
        isIgnoringChange = false;
    }

    isEditMode = enabled;
    Log.info('Mode', '切换模式, isEditMode:', isEditMode);

    editor.updateOptions({ readOnly: !isEditMode });

    // 同步功能按钮状态
    const editOnlyIds = ['undo-btn', 'redo-btn', 'paste-btn', 'replace-btn', 'eol-selector'];
    editOnlyIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.style.opacity = isEditMode ? '1' : '0.4';
            el.style.pointerEvents = isEditMode ? 'auto' : 'none';
        }
    });

    if (isEditMode) {
        els.editModeBtn.classList.remove('active');
        els.editModeBtn.innerText = '取消';
        els.saveBtn.style.display = 'flex';
        els.saveBtn.disabled = true; // 进入编辑模式时初始禁用保存
        editor.focus();
    } else {
        els.editModeBtn.classList.add('active');
        els.editModeBtn.innerText = '编辑';
        els.saveBtn.style.display = 'none';
    }
}

/**
 * 关闭底栏所有弹出面板
 */
function hideAllPanels() {
    if (els.langPanel) els.langPanel.style.display = 'none';
    if (els.encodingPanel) els.encodingPanel.style.display = 'none';
    if (els.eolPanel) els.eolPanel.style.display = 'none';
}

// =============================================================================
// [5] 文件 IO 操作
// =============================================================================

/**
 * 从服务器加载文件内容
 */
async function loadFile(path) {
    if (isProcessing) return;
    isProcessing = true;

    updateStatus('正在读取...');
    const apiUrl = `./api/read?path=${encodeURIComponent(path)}&encoding=${currentEncoding}`;
    Log.info('IO', '开始读取文件:', path, '编码:', currentEncoding);

    try {
        const res = await fetch(apiUrl);
        if (!res.ok) throw new Error(`HTTP 错误 ${res.status}`);

        const data = await res.json();
        if (data.error) throw new Error(data.error);

        Log.success('IO', '文件读取成功, 大小:', data.content.length);
        updateUIState(true);
        els.welcomeOverlay.style.display = 'none';

        isIgnoringChange = true;
        editor.setValue(data.content);
        isIgnoringChange = false;

        originalContent = editor.getValue();
        lastMtime = data.mtime;
        els.saveBtn.disabled = true;
        setEditMode(false); // 加载新文件后默认只读
        updateStatus('已加载');
    } catch (err) {
        Log.error('IO', '读取文件失败:', err);
        updateUIState(false);
        showToast('读取失败: ' + err.message, true);
        updateStatus('读取失败', '#f44336');
    } finally {
        isProcessing = false;
    }
}

/**
 * 保存当前编辑器内容到服务器
 */
async function saveFile() {
    if (!currentPath || isProcessing || !isEditMode) return;
    isProcessing = true;

    const prevDisabledState = els.saveBtn.disabled;
    els.saveBtn.disabled = true; // 立即锁定按钮

    updateStatus('正在保存...');
    Log.info('IO', '开始保存文件:', currentPath, '编码:', currentEncoding);

    try {
        const res = await fetch('./api/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                path: currentPath,
                content: editor.getValue(),
                encoding: currentEncoding,
                mtime: lastMtime
            })
        });

        if (!res.ok) throw new Error(`服务器响应异常 (${res.status})`);

        const data = await res.json();
        if (data.error) throw new Error(data.error);

        Log.success('IO', '文件保存成功');
        originalContent = editor.getValue();
        lastMtime = data.mtime;
        els.saveBtn.disabled = true;
        showToast('保存成功');
        updateStatus('已保存');
    } catch (err) {
        Log.error('IO', '保存文件失败:', err);
        showToast('保存失败: ' + err.message, true);
        updateStatus('保存失败', '#f44336');
        els.saveBtn.disabled = false; // 允许重试
    } finally {
        isProcessing = false;
    }
}

// =============================================================================
// [6] 初始化逻辑
// =============================================================================

require.config({
    paths: { 'vs': '/app/m-text-editor/vs' }
});

require(['vs/editor/editor.main'], function () {
    Log.success('System', 'Monaco 核心模块已加载');

    (async function init() {
        try {
            const isMobile = window.innerWidth <= 768;

            // [6.1] 等待预取的数据
            Log.info('Editor', '准备等待预加载数据...');
            const preloadData = await filePreloadPromise;
            Log.info('Editor', '预加载数据等待结束, 是否有数据:', !!preloadData);

            let initialValue = '';
            if (preloadData) {
                if (preloadData.error) {
                    showToast('预读取失败: ' + preloadData.error, true);
                    updateStatus('读取失败', '#f44336');
                } else {
                    initialValue = preloadData.content;
                    originalContent = initialValue;
                    lastMtime = preloadData.mtime;
                }
            }

            // [6.2] 创建编辑器实例
            Log.info('Editor', '开始创建 Monaco 实例...');
            editor = monaco.editor.create(els.editorContainer, {
                value: initialValue,
                language: getLang(currentPath),
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

            // 手动布局优化
            const resizeObserver = new ResizeObserver(() => {
                if (editor) editor.layout();
            });
            resizeObserver.observe(els.editorContainer);

            // [6.3] 绑定编辑器基础事件
            editor.onDidFocusEditorText(() => hideAllPanels());
            editor.onMouseDown(() => hideAllPanels());

            editor.onDidChangeCursorPosition((e) => {
                els.posDisplay.innerText = `行 ${e.position.lineNumber}，列 ${e.position.column}`;
            });

            // 内容变化监听（带防抖比对）
            let compareTimer = null;
            editor.onDidChangeModelContent(() => {
                if (!isEditMode || isIgnoringChange) return;
                if (compareTimer) clearTimeout(compareTimer);
                compareTimer = setTimeout(() => {
                    const currentValue = editor.getValue();
                    els.saveBtn.disabled = (currentValue === originalContent);
                }, 300);
            });

            // 监听换行符与语言变化同步 UI
            const updateEOLDisplay = () => {
                const eol = editor.getModel().getEOL();
                els.eolSelector.innerText = eol === '\n' ? 'LF' : 'CRLF';
            };
            updateEOLDisplay();
            editor.onDidChangeModelContent(updateEOLDisplay);

            editor.onDidChangeModelLanguage(() => {
                const langId = editor.getModel().getLanguageId();
                const lang = monaco.languages.getLanguages().find(l => l.id === langId);
                els.langSelector.innerText = lang && lang.aliases ? lang.aliases[0] : langId;
            });

            // [6.4] 绑定工具栏按钮事件
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
                    Log.success('Toolbar', '已将选中文本复制到剪贴板');
                    showToast('已复制到剪贴板');
                } catch (err) {
                    Log.error('Toolbar', '复制失败:', err);
                    showToast('复制失败: ' + err.message, true);
                }
                els.copyBtn.blur();
            };

            els.pasteBtn.onclick = async () => {
                editor.focus();
                if (!navigator.clipboard?.readText) {
                    Log.warn('Toolbar', '浏览器限制：粘贴需 HTTPS 环境');
                    showToast('浏览器限制：粘贴需 HTTPS 环境', true);
                    return;
                }
                try {
                    const text = await navigator.clipboard.readText();
                    Log.info('Toolbar', '从剪贴板读取到文本，长度:', text.length);
                    editor.executeEdits('paste-action', [{
                        range: editor.getSelection(),
                        text: text,
                        forceMoveMarkers: true
                    }]);
                    showToast('已粘贴');
                } catch (err) {
                    Log.error('Toolbar', '粘贴失败:', err);
                    showToast('粘贴失败，请检查权限', true);
                }
                els.pasteBtn.blur();
            };

            els.findBtn.onclick = () => { Log.info('Toolbar', '打开查找面板'); editor.getAction('actions.find').run(); els.findBtn.blur(); };
            els.replaceBtn.onclick = () => { Log.info('Toolbar', '打开替换面板'); editor.getAction('editor.action.startFindReplaceAction').run(); els.replaceBtn.blur(); };

            // [6.5] 绑定状态栏面板逻辑
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
                        Log.info('UI', '切换语言模式为:', lang.id);
                        monaco.editor.setModelLanguage(editor.getModel(), lang.id);
                        els.langPanel.style.display = 'none';
                    };
                    els.langList.appendChild(item);
                });
                els.langPanel.style.display = 'flex';
            };

            const encodings = [
                { label: 'UTF-8', id: 'utf-8' }, { label: 'GBK (简体中文)', id: 'gbk' },
                { label: 'GB18030 (更全的中文字符)', id: 'gb18030' },
                { label: 'UTF-16 LE', id: 'utf-16le' }, { label: 'UTF-16 BE', id: 'utf-16be' },
                { label: 'Windows-1252', id: 'windows-1252' }, { label: 'Big5 (繁体中文)', id: 'big5' }
            ];

            els.encodingSelector.onclick = (e) => {
                e.stopPropagation();
                hideAllPanels();
                els.encodingList.innerHTML = '';
                encodings.forEach(enc => {
                    const item = document.createElement('div');
                    item.className = 'lang-item';
                    item.innerHTML = `<span>${enc.label}</span><span class="lang-id">${enc.id.toUpperCase()}</span>`;
                    item.onclick = () => {
                        Log.info('UI', '切换编码为:', enc.id);
                        currentEncoding = enc.id;
                        els.encodingSelector.innerText = enc.label.split(' ')[0];
                        els.encodingPanel.style.display = 'none';
                        showToast(`已切换编码为 ${enc.label}`);
                        if (currentPath) loadFile(currentPath);
                    };
                    els.encodingList.appendChild(item);
                });
                els.encodingPanel.style.display = 'flex';
            };

            const eolTypes = [
                { label: 'LF (Unix)', id: 'LF', value: monaco.editor.EndOfLineSequence.LF },
                { label: 'CRLF (Windows)', id: 'CRLF', value: monaco.editor.EndOfLineSequence.CRLF }
            ];

            els.eolSelector.onclick = (e) => {
                e.stopPropagation();
                hideAllPanels();
                els.eolList.innerHTML = '';
                eolTypes.forEach(type => {
                    const item = document.createElement('div');
                    item.className = 'lang-item';
                    item.innerHTML = `<span>${type.label}</span>`;
                    item.onclick = () => {
                        Log.info('UI', '切换换行符为:', type.id);
                        editor.getModel().setEOL(type.value);
                        els.eolSelector.innerText = type.id;
                        els.eolPanel.style.display = 'none';
                        showToast(`换行符已切换为 ${type.id}`);
                    };
                    els.eolList.appendChild(item);
                });
                els.eolPanel.style.display = 'flex';
            };

            // 全局点击关闭面板
            const handleGlobalClick = (e) => {
                if (!e.target.closest('.lang-panel') && !e.target.closest('.status-item') && !e.target.closest('.text-link-btn')) {
                    hideAllPanels();
                }
            };
            document.addEventListener('click', handleGlobalClick, true);
            document.addEventListener('touchstart', handleGlobalClick, { passive: true, capture: true });

            // [6.6] 快捷键绑定
            editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
                if (isEditMode) saveFile();
            });

            // [6.7] 业务逻辑绑定：手动打开、关闭标签
            const handleManualOpen = () => {
                const path = els.manualPathInput.value.trim();
                if (!path) { showToast('请输入有效的文件路径'); return; }
                Log.info('UI', '手动请求打开文件:', path);
                currentPath = path;
                els.tabFilename.innerText = path.split('/').pop();
                updateBreadcrumbs(path);
                els.welcomeOverlay.style.display = 'none';
                loadFile(path);
            };

            if (els.openPathBtn) els.openPathBtn.onclick = handleManualOpen;
            if (els.manualPathInput) {
                els.manualPathInput.onkeydown = (e) => {
                    if (e.key === 'Enter') { handleManualOpen(); els.manualPathInput.blur(); }
                };
            }

            if (els.tabCloseBtn) {
                els.tabCloseBtn.onclick = (e) => {
                    e.stopPropagation();
                    Log.info('UI', '关闭当前文件，返回主页');
                    currentPath = '';
                    window.currentPath = '';
                    els.welcomeOverlay.style.display = 'flex';
                    els.tabFilename.innerText = '未选择文件';
                    updateStatus('准备就绪');
                    updateBreadcrumbs('');
                    if (els.manualPathInput) {
                        els.manualPathInput.value = '';
                        setTimeout(() => els.manualPathInput.focus(), 100);
                    }
                    setEditMode(false);
                    updateUIState(false);
                    isIgnoringChange = true;
                    editor.setValue('');
                    isIgnoringChange = false;
                };
            }

            // [6.8] 初始状态检测
            if (currentPath) {
                updateUIState(true);
                els.welcomeOverlay.style.display = 'none';
                els.tabFilename.innerText = currentPath.split('/').pop();
                updateBreadcrumbs(currentPath);
                if (preloadData && !preloadData.error) {
                    updateStatus('已加载');
                } else if (!preloadData) {
                    loadFile(currentPath);
                }
            } else {
                updateUIState(false);
                els.welcomeOverlay.style.display = 'flex';
                updateStatus('准备就绪');
            }

            // 初始化 UI 显示
            setEditMode(false);
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
