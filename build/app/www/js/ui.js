/**
 * ui.js - DOM 元素管理与基础 UI 反馈
 */

import { Log, ENCODING_LIST, getEncodingLabel, Clipboard, checkIsMobile, checkIsNarrowScreen } from './utils.js';
import { AppContext } from './context.js';
import { eventBus } from './event_bus.js';
import { API } from './api.js';
import { EditorManager } from './editor.js';
import { TerminalManager } from './terminal.js';
import { SearchManager } from './search.js';

export { Log, ENCODING_LIST, getEncodingLabel, Clipboard };

export const els = {
    // 顶部工具栏
    previewModeBtn: document.getElementById('preview-mode-btn'),
    editModeBtn: document.getElementById('edit-mode-btn'),
    saveBtn: document.getElementById('save-btn'),
    sidebarOverlay: document.getElementById('sidebar-overlay'),


    // 标签与路径
    tabsRow: document.getElementById('tabs-row'),
    breadcrumbs: document.getElementById('breadcrumbs'),

    // 预览区域
    markdownPreviewContainer: document.getElementById('markdown-preview-container'),
    markdownPreviewBody: document.getElementById('markdown-preview-body'),

    // 欢迎页/输入
    welcomeOverlay: document.getElementById('welcome-overlay'),
    manualPathInput: document.getElementById('manual-path-input'),
    openPathBtn: document.getElementById('open-path-btn'),
    createPathBtn: document.getElementById('create-path-btn'),

    // 底部状态栏
    statusText: document.getElementById('status-text'),
    charCount: document.getElementById('char-count'),
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
    toast: document.getElementById('toast'),

    // 活动栏与侧边栏
    activityExplorerBtn: document.getElementById('activity-explorer-btn'),
    activityOpenExternalBtn: document.getElementById('activity-open-external-btn'),
    activitySettingsBtn: document.getElementById('activity-settings-btn'),
    sidebar: document.getElementById('sidebar'),
    fileTree: document.getElementById('file-tree'),
    refreshTreeBtn: document.getElementById('refresh-tree-btn'),
    sidebarResizer: document.getElementById('sidebar-resizer'),
    sidebarNewFileBtn: document.getElementById('sidebar-new-file-btn'),

    // 侧栏搜索面板相关元素
    activitySearchBtn: document.getElementById('activity-search-btn'),
    sidebarExplorer: document.getElementById('sidebar-explorer'),
    sidebarSearch: document.getElementById('sidebar-search'),
    sidebarSearchInput: document.getElementById('sidebar-search-input'),
    sidebarReplaceInput: document.getElementById('sidebar-replace-input'),
    sidebarSearchPrevBtn: document.getElementById('sidebar-search-prev-btn'),
    sidebarSearchNextBtn: document.getElementById('sidebar-search-next-btn'),
    sidebarReplaceBtn: document.getElementById('sidebar-replace-btn'),
    sidebarReplaceAllBtn: document.getElementById('sidebar-replace-all-btn'),
    sidebarSearchResultsInfo: document.getElementById('sidebar-search-results-info'),
    sidebarSearchResults: document.getElementById('sidebar-search-results'),

    // 侧栏终端面板相关元素
    activityTerminalBtn: document.getElementById('activity-terminal-btn'),
    sidebarTerminal: document.getElementById('sidebar-terminal'),
    terminalContainer: document.getElementById('terminal-container'),
    terminalRestartBtn: document.getElementById('terminal-restart-btn'),
    sidebarSettings: document.getElementById('sidebar-settings'),
    sidebarSettingsForm: document.getElementById('sidebar-settings-form'),

    // 汉堡菜单相关元素
    activityMenuBtn: document.getElementById('activity-menu-btn'),
    activityDropdownMenu: document.getElementById('activity-dropdown-menu'),

    // 自定义确认弹窗 Modal
    confirmModal: document.getElementById('confirm-modal'),
    confirmHeader: document.getElementById('confirm-modal-header'),
    confirmMessage: document.getElementById('confirm-modal-message'),
    confirmOkBtn: document.getElementById('confirm-modal-ok'),
    confirmCancelBtn: document.getElementById('confirm-modal-cancel'),
    confirmInput: document.getElementById('confirm-modal-input')
};

let lastSidebarWidth = 250;

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

export function showToast(msg, isError = false) {
    const t = els.toast;
    if (!t) return;
    t.innerText = msg;
    t.style.display = 'block';
    t.className = isError ? 'error' : 'info';

    if (t._timer) clearTimeout(t._timer);
    t._timer = setTimeout(() => {
        t.style.display = 'none';
    }, 3000);
}

export function updateStatus(text, color) {
    if (els.statusText) {
        els.statusText.innerText = text;
        els.statusText.style.color = color || 'var(--status-text)';
    }
}

export function updateBreadcrumbs(path) {
    if (!els.breadcrumbs) return;
    els.breadcrumbs.innerText = path;
    els.breadcrumbs.title = "点击复制完整路径";
    els.breadcrumbs.style.cursor = "pointer";

    if (path) {
        const filename = path.split(/[/\\]/).pop();
        document.title = `${filename}`;
    } else {
        document.title = 'PodNote';
    }
}

export function hideAllPanels() {
    if (els.langPanel) els.langPanel.style.display = 'none';
    if (els.encodingPanel) els.encodingPanel.style.display = 'none';
    if (els.eolPanel) els.eolPanel.style.display = 'none';
}

export function updateUIState(hasFile, isEditMode, setEditModeFunc) {
    const allActionIds = [
        'edit-mode-btn', 'save-btn',
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

    if (hasFile && typeof setEditModeFunc === 'function') {
        setEditModeFunc(isEditMode);
    }
}

function getIconClass(name, isDir) {
    if (isDir) return 'icon-color-folder';
    const ext = name.split('.').pop().toLowerCase();
    const classMap = {
        'js': 'icon-color-js', 'ts': 'icon-color-js', 'jsx': 'icon-color-js', 'tsx': 'icon-color-js',
        'go': 'icon-color-go',
        'py': 'icon-color-py',
        'html': 'icon-color-html', 'vue': 'icon-color-html',
        'css': 'icon-color-css', 'scss': 'icon-color-css', 'less': 'icon-color-css',
        'json': 'icon-color-json', 'toml': 'icon-color-json',
        'md': 'icon-color-md',
        'sh': 'icon-color-sh', 'bash': 'icon-color-sh'
    };
    return classMap[ext] || '';
}

export function createTreeItem(file, level) {
    const item = document.createElement('div');
    item.className = 'tree-item';
    item.setAttribute('data-path', file.path);
    item.setAttribute('data-is-dir', file.is_dir);
    if (file.is_symlink) {
        item.setAttribute('data-is-symlink', 'true');
    }
    item.style.paddingLeft = `${level * 12 + 12}px`;

    const arrow = document.createElement('span');
    arrow.className = 'tree-item-arrow';
    if (file.is_dir) {
        arrow.innerHTML = `<svg width="14" height="14" viewBox="0 0 16 16"><path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M10.072 8.024L5.707 3.659l.707-.707 5.072 5.072-5.072 5.072-.707-.707 4.365-4.365z"/></svg>`;
    }
    item.appendChild(arrow);

    const icon = document.createElement('span');
    icon.className = `tree-item-icon ${getIconClass(file.name, file.is_dir)}`;
    if (file.is_symlink) {
        icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h8v4h4v12zm-6-3c-1.1 0-2-.9-2-2V9.5c0-.28.22-.5.5-.5s.5.22.5.5V15h2V9.5a2.5 2.5 0 0 0-5 0V15c0 2.21 1.79 4 4 4s4-1.79 4-4v-4h-2v4c0 1.1-.9 2-2 2z" fill="currentColor"></path></svg>`;
    } else if (file.is_dir) {
        icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3v4a1 1 0 0 0 1 1h4"></path><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"></path><path d="M9 9h1"></path><path d="M9 13h6"></path><path d="M9 17h6"></path></g></svg>`;
    } else {
        icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3v4a1 1 0 0 0 1 1h4"></path><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"></path></g></svg>`;
    }
    item.appendChild(icon);

    const label = document.createElement('span');
    label.className = 'tree-item-label';
    label.innerText = file.name;
    item.appendChild(label);

    return item;
}

export function renderFileTree(container, files, level = 0) {
    container.innerHTML = '';
    if (!files || files.length === 0) {
        container.innerHTML = '<div class="tree-empty-hint">此工作区为空</div>';
        return;
    }

    files.forEach(file => {
        const item = createTreeItem(file, level);
        container.appendChild(item);

        if (file.is_dir) {
            const childContainer = document.createElement('div');
            childContainer.className = 'tree-children';
            const safeId = btoa(encodeURIComponent(file.path)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
            childContainer.id = `children-${safeId}`;
            container.appendChild(childContainer);
        }
    });
}

/**
 * 切换汉堡菜单的显示与定位
 */
function toggleActivityDropdownMenu() {
    const menu = els.activityDropdownMenu;
    if (!menu) return;

    const isHidden = menu.style.display === 'none';
    if (isHidden) {
        const rect = els.activityMenuBtn.getBoundingClientRect();
        menu.style.top = `${rect.bottom}px`;
        menu.style.left = '6px';

        const menuUndo = document.getElementById('menu-undo');
        const menuRedo = document.getElementById('menu-redo');
        const menuCopy = document.getElementById('menu-copy');
        const menuPaste = document.getElementById('menu-paste');
        const menuFind = document.getElementById('menu-find');
        const menuReplace = document.getElementById('menu-replace');

        const currentPath = AppContext.state.currentPath;
        const isEditMode = AppContext.state.isEditMode;

        if (menuUndo) menuUndo.classList.toggle('disabled', !currentPath);
        if (menuRedo) menuRedo.classList.toggle('disabled', !currentPath);
        if (menuCopy) menuCopy.classList.toggle('disabled', !currentPath);
        if (menuPaste) menuPaste.classList.toggle('disabled', !currentPath || !isEditMode);
        if (menuFind) menuFind.classList.toggle('disabled', !currentPath);
        if (menuReplace) menuReplace.classList.toggle('disabled', !currentPath || !isEditMode);

        menu.style.display = 'block';
    } else {
        menu.style.display = 'none';
    }
}

// 移动端虚拟键盘视口适配
let visualViewportHandler = null;

function setupVisualViewportListener() {
    if (!window.visualViewport || visualViewportHandler) return;

    visualViewportHandler = () => {
        const sidebar = els.sidebar;
        if (!sidebar) return;

        const activePanel = sidebar.getAttribute('data-active-panel');
        if (activePanel) {
            const keyboardHeight = window.innerHeight - window.visualViewport.height;
            // 锁定浏览器视口滚动，防页面随键盘弹起整体偏移
            window.scrollTo(0, 0);

            if (keyboardHeight > 50) {
                sidebar.style.bottom = `${keyboardHeight}px`;
            } else {
                sidebar.style.bottom = '0';
            }

            if (activePanel === 'terminal' && typeof TerminalManager.resize === 'function') {
                TerminalManager.resize();
            }
        }
    };

    window.visualViewport.addEventListener('resize', visualViewportHandler);
    window.visualViewport.addEventListener('scroll', visualViewportHandler);
}

function destroyVisualViewportListener() {
    if (window.visualViewport && visualViewportHandler) {
        window.visualViewport.removeEventListener('resize', visualViewportHandler);
        window.visualViewport.removeEventListener('scroll', visualViewportHandler);
        visualViewportHandler = null;
    }
    if (els.sidebar) {
        els.sidebar.style.bottom = '0';
    }
}

/**
 * 展开侧边栏到指定面板
 */
function expandSidebar(panelName) {
    const sidebar = els.sidebar;
    if (!sidebar) return;

    els.sidebarExplorer.style.display = 'none';
    els.sidebarSearch.style.display = 'none';
    els.sidebarTerminal.style.display = 'none';
    els.sidebarSettings.style.display = 'none';

    if (els.activityExplorerBtn) els.activityExplorerBtn.classList.remove('active');
    if (els.activitySearchBtn) els.activitySearchBtn.classList.remove('active');
    if (els.activityTerminalBtn) els.activityTerminalBtn.classList.remove('active');
    if (els.activitySettingsBtn) els.activitySettingsBtn.classList.remove('active');

    const isCollapsed = sidebar.style.width === '0px' || parseInt(window.getComputedStyle(sidebar).width, 10) === 0 || window.getComputedStyle(sidebar).display === 'none';
    const curWidth = parseInt(sidebar.style.width || '0', 10);
    sidebar.style.width = (curWidth < 50 || isCollapsed) ? `${lastSidebarWidth}px` : sidebar.style.width;
    sidebar.setAttribute('data-active-panel', panelName);

    if (panelName === 'explorer') {
        els.sidebarExplorer.style.display = 'flex';
        if (els.activityExplorerBtn) els.activityExplorerBtn.classList.add('active');
    } else if (panelName === 'search') {
        els.sidebarSearch.style.display = 'flex';
        if (els.activitySearchBtn) els.activitySearchBtn.classList.add('active');
    } else if (panelName === 'terminal') {
        els.sidebarTerminal.style.display = 'flex';
        if (els.activityTerminalBtn) els.activityTerminalBtn.classList.add('active');
    } else if (panelName === 'settings') {
        els.sidebarSettings.style.display = 'flex';
        if (els.activitySettingsBtn) els.activitySettingsBtn.classList.add('active');
    }

    const editor = EditorManager.getEditor();
    if (editor) {
        setTimeout(() => editor.layout(), 150);
    }

    if (checkIsNarrowScreen() && els.sidebarOverlay) {
        els.sidebarOverlay.classList.add('active');
        setupVisualViewportListener();
    }

    eventBus.emit('sidebar:panel-changed', panelName);
}

/**
 * 折叠侧边栏
 */
function collapseSidebar() {
    const sidebar = els.sidebar;
    if (!sidebar) return;

    // 如果焦点在侧栏内或为输入控件，强制失焦以触发 change 事件保存并收回移动端软键盘
    if (document.activeElement && (sidebar.contains(document.activeElement) || document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'SELECT')) {
        document.activeElement.blur();
    }

    sidebar.style.width = '0px';
    sidebar.setAttribute('data-active-panel', '');

    if (els.activityExplorerBtn) els.activityExplorerBtn.classList.remove('active');
    if (els.activitySearchBtn) els.activitySearchBtn.classList.remove('active');
    if (els.activityTerminalBtn) els.activityTerminalBtn.classList.remove('active');
    if (els.activitySettingsBtn) els.activitySettingsBtn.classList.remove('active');

    const editor = EditorManager.getEditor();
    if (editor) {
        setTimeout(() => editor.layout(), 150);
    }

    if (els.sidebarOverlay) {
        els.sidebarOverlay.classList.remove('active');
    }

    destroyVisualViewportListener();

    eventBus.emit('sidebar:panel-changed', '');
}

/**
 * 切换侧栏活动面板
 */
function switchSidebarPanel(panelName) {
    const sidebar = els.sidebar;
    if (!sidebar) return;

    const isCollapsed = sidebar.style.width === '0px' || parseInt(window.getComputedStyle(sidebar).width, 10) === 0 || window.getComputedStyle(sidebar).display === 'none';
    const lastActivePanel = sidebar.getAttribute('data-active-panel');

    if (!isCollapsed && lastActivePanel === panelName) {
        collapseSidebar();
    } else {
        expandSidebar(panelName);
    }
}

export const UIManager = {
    init() {
        // 绑定点击/触摸外部自动隐藏弹出面板
        const handleOutsideTrigger = (e) => {
            // 汉堡菜单收起
            const menu = els.activityDropdownMenu;
            const btn = els.activityMenuBtn;
            if (menu && menu.style.display === 'block') {
                if (!menu.contains(e.target) && !btn.contains(e.target)) {
                    menu.style.display = 'none';
                }
            }
            // 底栏面板收起
            if (!e.target.closest('.lang-panel') && !e.target.closest('.status-item') && !e.target.closest('.text-link-btn')) {
                hideAllPanels();
            }
        };
        document.addEventListener('pointerdown', handleOutsideTrigger, true);
        document.addEventListener('click', handleOutsideTrigger, true);

        // 绑定底栏状态选择面板事件
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
            this.alignPanel(els.langPanel, els.langSelector);
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
            this.alignPanel(els.encodingPanel, els.encodingSelector);
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
            this.alignPanel(els.eolPanel, els.eolSelector);
            els.eolPanel.style.display = 'flex';
        };

        // 绑定文件树快捷创建按钮
        if (els.sidebarNewFileBtn) {
            els.sidebarNewFileBtn.onclick = () => this.handleNewFileInTree();
        }

        // 绑定侧栏拉伸 Resizer
        if (els.sidebarResizer && els.sidebar) {
            let startX = 0;
            let startWidth = 0;
            let animationFrameId = null;

            const onMouseMove = (e) => {
                const deltaX = e.clientX - startX;
                let newWidth = startWidth + deltaX;
                const explorerBtn = els.activityExplorerBtn;
                const searchBtn = els.activitySearchBtn;
                const terminalBtn = els.activityTerminalBtn;
                const settingsBtn = els.activitySettingsBtn;

                const isExplorer = els.sidebarExplorer.style.display !== 'none';
                const isSearch = els.sidebarSearch.style.display !== 'none';
                const isTerminal = els.sidebarTerminal.style.display !== 'none';
                const isSettings = els.sidebarSettings.style.display !== 'none';

                if (newWidth < 50) {
                    newWidth = 0;
                    if (explorerBtn) explorerBtn.classList.remove('active');
                    if (searchBtn) searchBtn.classList.remove('active');
                    if (terminalBtn) terminalBtn.classList.remove('active');
                    if (settingsBtn) settingsBtn.classList.remove('active');
                } else if (newWidth < 150) {
                    newWidth = 150;
                } else if (newWidth > 600) {
                    newWidth = 600;
                }

                if (newWidth >= 50) {
                    if (explorerBtn) explorerBtn.classList.toggle('active', isExplorer);
                    if (searchBtn) searchBtn.classList.toggle('active', isSearch);
                    if (terminalBtn) terminalBtn.classList.toggle('active', isTerminal);
                    if (settingsBtn) settingsBtn.classList.toggle('active', isSettings);
                }

                els.sidebar.style.width = `${newWidth}px`;
                if (newWidth >= 50) {
                    lastSidebarWidth = newWidth;
                }

                if (!animationFrameId) {
                    animationFrameId = requestAnimationFrame(() => {
                        const editor = EditorManager.getEditor();
                        if (editor) editor.layout();
                        animationFrameId = null;
                    });
                }
            };

            const onMouseUp = () => {
                if (animationFrameId) {
                    cancelAnimationFrame(animationFrameId);
                    animationFrameId = null;
                }
                const editor = EditorManager.getEditor();
                if (editor) editor.layout();

                els.sidebarResizer.classList.remove('active');
                document.body.style.removeProperty('user-select');
                document.body.style.removeProperty('cursor');
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };

            els.sidebarResizer.onmousedown = (e) => {
                startX = e.clientX;
                startWidth = parseInt(document.defaultView.getComputedStyle(els.sidebar).width, 10);
                els.sidebarResizer.classList.add('active');
                document.body.style.userSelect = 'none';
                document.body.style.cursor = 'col-resize';
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            };

            els.sidebarResizer.ondblclick = () => {
                const currentWidth = parseInt(document.defaultView.getComputedStyle(els.sidebar).width, 10);
                const explorerBtn = els.activityExplorerBtn;
                const searchBtn = els.activitySearchBtn;
                const terminalBtn = els.activityTerminalBtn;
                const settingsBtn = els.activitySettingsBtn;

                const isExplorer = els.sidebarExplorer.style.display !== 'none';
                const isSearch = els.sidebarSearch.style.display !== 'none';
                const isTerminal = els.sidebarTerminal.style.display !== 'none';
                const isSettings = els.sidebarSettings.style.display !== 'none';

                if (currentWidth > 0) {
                    els.sidebar.style.width = '0px';
                    if (explorerBtn) explorerBtn.classList.remove('active');
                    if (searchBtn) searchBtn.classList.remove('active');
                    if (terminalBtn) terminalBtn.classList.remove('active');
                    if (settingsBtn) settingsBtn.classList.remove('active');
                } else {
                    els.sidebar.style.width = `${lastSidebarWidth}px`;
                    if (explorerBtn) explorerBtn.classList.toggle('active', isExplorer);
                    if (searchBtn) searchBtn.classList.toggle('active', isSearch);
                    if (terminalBtn) terminalBtn.toggle('active', isTerminal);
                    if (settingsBtn) settingsBtn.toggle('active', isSettings);
                }
                const editor = EditorManager.getEditor();
                if (editor) editor.layout();
            };
        }

        // 绑定路径复制逻辑
        if (els.breadcrumbs) {
            els.breadcrumbs.onclick = async () => {
                const currentPath = AppContext.state.currentPath;
                if (!currentPath) return;
                Log.info('Breadcrumbs', '执行路径复制:', currentPath);
                const success = await Clipboard.copy(currentPath);
                if (success) {
                    showToast('路径已复制');
                } else {
                    showToast('复制失败', true);
                }
            };
        }

        // 绑定欢迎页输入框和打开按钮逻辑
        if (els.openPathBtn) {
            els.openPathBtn.onclick = () => this.handleManualOpen();
        }
        if (els.manualPathInput) {
            els.manualPathInput.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    this.handleManualOpen();
                    els.manualPathInput.blur();
                }
            };
        }

        // 绑定汉堡下拉菜单
        if (els.activityMenuBtn) {
            els.activityMenuBtn.onclick = (e) => {
                e.stopPropagation();
                toggleActivityDropdownMenu();
            };
        }

        if (els.activityDropdownMenu) {
            const menuActions = {
                undo: () => {
                    const editor = EditorManager.getEditor();
                    if (editor) editor.trigger('keyboard', 'undo');
                },
                redo: () => {
                    const editor = EditorManager.getEditor();
                    if (editor) editor.trigger('keyboard', 'redo');
                },
                copy: async () => {
                    const editor = EditorManager.getEditor();
                    if (!editor) return;
                    editor.focus();
                    const text = editor.getModel().getValueInRange(editor.getSelection());
                    if (!text) { showToast('未选中任何文本'); return; }
                    const success = await Clipboard.copy(text);
                    if (success) showToast('已复制到剪贴板');
                    else showToast('复制失败', true);
                },
                paste: async () => {
                    const editor = EditorManager.getEditor();
                    if (!editor) return;
                    editor.focus();
                    const result = await Clipboard.read();
                    if (result.data !== undefined) {
                        editor.executeEdits('paste-action', [{
                            range: editor.getSelection(),
                            text: result.data,
                            forceMoveMarkers: true
                        }]);
                        showToast('已粘贴');
                    } else {
                        let msg = '粘贴失败';
                        if (result.error === 'HTTPS') msg = '浏览器安全限制，请使用键盘 Ctrl+V 直接粘贴';
                        else if (result.error === 'PERMISSION') msg = '粘贴失败，请确认浏览器粘贴权限';
                        showToast(msg, true);
                    }
                },
                find: () => {
                    const editor = EditorManager.getEditor();
                    if (checkIsMobile()) {
                        if (editor) editor.getAction('actions.find').run();
                    } else {
                        SearchManager.triggerFind();
                    }
                },
                replace: () => {
                    const editor = EditorManager.getEditor();
                    if (checkIsMobile()) {
                        if (editor) editor.getAction('editor.action.startFindReplaceAction').run();
                    } else {
                        SearchManager.triggerReplace();
                    }
                }
            };

            els.activityDropdownMenu.onclick = (e) => {
                const item = e.target.closest('.menu-item');
                if (!item || item.classList.contains('disabled')) return;
                const action = item.getAttribute('data-action');
                if (menuActions[action]) {
                    menuActions[action]();
                }
                els.activityDropdownMenu.style.display = 'none';
            };
        }

        // 订阅侧栏请求事件
        eventBus.on('sidebar:panel-request', (panelName) => {
            expandSidebar(panelName);
        });
        eventBus.on('sidebar:collapse-request', () => {
            collapseSidebar();
        });

        // 绑定工具栏编辑操作按钮事件
        if (els.editModeBtn) {
            els.editModeBtn.onclick = () => {
                eventBus.emit('mode:toggle-request');
                els.editModeBtn.blur();
            };
        }
        if (els.saveBtn) {
            els.saveBtn.onclick = () => {
                eventBus.emit('file:save-request');
                els.saveBtn.blur();
            };
        }


        // 绑定活动栏切换事件
        if (els.activityExplorerBtn) els.activityExplorerBtn.onclick = () => switchSidebarPanel('explorer');
        if (els.activitySearchBtn) els.activitySearchBtn.onclick = () => switchSidebarPanel('search');
        if (els.activityTerminalBtn) els.activityTerminalBtn.onclick = () => switchSidebarPanel('terminal');
        if (els.activitySettingsBtn) els.activitySettingsBtn.onclick = () => switchSidebarPanel('settings');
        if (els.activityOpenExternalBtn) {
            els.activityOpenExternalBtn.onclick = () => {
                window.open(window.location.href, '_blank');
            };
        }

        // 绑定文件树刷新按钮事件
        if (els.refreshTreeBtn) {
            els.refreshTreeBtn.onclick = () => {
                const workspacePath = AppContext.state.workspacePath;
                if (workspacePath) {
                    eventBus.emit('workspace:refresh-request');
                    showToast('工作区已刷新');
                } else {
                    showToast('尚未打开工作区');
                }
            };
        }

        // 欢迎页新建文件按钮直接绑定
        if (els.createPathBtn) {
            els.createPathBtn.onclick = () => {
                this.handleNewFileInTree();
            };
        }

        // 全局搜索快捷键监听
        window.addEventListener('keydown', (e) => {
            const isNarrow = checkIsNarrowScreen();
            if (!isNarrow) {
                if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
                    e.preventDefault();
                    SearchManager.triggerFind();
                }
                if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
                    e.preventDefault();
                    SearchManager.triggerReplace();
                }
            }
        });

        // 窄屏下遮罩层点击自动折叠侧边栏
        if (els.sidebarOverlay) {
            els.sidebarOverlay.onclick = () => {
                collapseSidebar();
            };
        }

        // 移动端与触屏点击后自动失焦，规避按钮点击态粘滞/残留高亮虚线框
        document.addEventListener('click', (e) => {
            if (e.detail > 0) {
                const clickable = e.target.closest('button, .activity-btn, .sidebar-action-btn, .tab-scroll-btn, .menu-item, .status-item.clickable');
                if (clickable) {
                    clickable.blur();
                }
            }
        });

        // 绑定文件树点击事件
        if (els.fileTree) {
            els.fileTree.onclick = async (e) => {
                const item = e.target.closest('.tree-item');
                if (!item || item.classList.contains('temp-new-file-item')) return;

                const path = item.getAttribute('data-path');
                const isDir = item.getAttribute('data-is-dir') === 'true';

                if (isDir) {
                    els.fileTree.querySelectorAll('.tree-item').forEach(el => el.classList.remove('active'));
                    item.classList.add('active');

                    const arrow = item.querySelector('.tree-item-arrow');
                    const safeId = btoa(encodeURIComponent(path)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
                    const childContainer = document.getElementById(`children-${safeId}`);

                    if (childContainer) {
                        const isVisible = childContainer.classList.contains('visible');
                        if (isVisible) {
                            childContainer.classList.remove('visible');
                            if (arrow) arrow.classList.remove('expanded');
                        } else {
                            childContainer.classList.add('visible');
                            if (arrow) arrow.classList.add('expanded');

                            if (childContainer.children.length === 0) {
                                const currentPadding = parseInt(item.style.paddingLeft) || 12;
                                const nextLevel = Math.floor((currentPadding - 12) / 12) + 1;
                                const indent = nextLevel * 12 + 12;

                                childContainer.innerHTML = "<div style=\"padding: 4px " + indent + "px; opacity: 0.5; font-size:12px;\">加载中...</div>";
                                try {
                                    const data = await API.list(path);
                                    childContainer.innerHTML = '';
                                    if (data.files && data.files.length > 0) {
                                        data.files.forEach(file => {
                                            const subItem = createTreeItem(file, nextLevel);
                                            childContainer.appendChild(subItem);
                                            if (file.is_dir) {
                                                const subChildContainer = document.createElement('div');
                                                subChildContainer.className = 'tree-children';
                                                const subSafeId = btoa(encodeURIComponent(file.path)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
                                                subChildContainer.id = `children-${subSafeId}`;
                                                childContainer.appendChild(subChildContainer);
                                            }
                                        });
                                    } else {
                                        childContainer.innerHTML = "<div style=\"padding: 4px " + indent + "px; opacity: 0.3; font-size:12px; font-style: italic;\">空文件夹</div>";
                                    }
                                } catch (err) {
                                    Log.error('Workspace', '加载子目录失败:', err);
                                    childContainer.innerHTML = "<div style=\"padding: 4px " + indent + "px; color:#f44336; font-size:12px;\">加载失败</div>";
                                }
                            }
                        }
                    }
                } else {
                    els.fileTree.querySelectorAll('.tree-item').forEach(el => el.classList.remove('active'));
                    item.classList.add('active');
                    eventBus.emit('file:open-request', { path });
                    if (checkIsNarrowScreen()) {
                        collapseSidebar();
                    }
                }
            };
        }
    },

    bindEditorEvents(editor) {
        if (!editor) return;

        // 监听焦点和点击隐藏面板
        editor.onDidFocusEditorText(() => hideAllPanels());
        editor.onMouseDown(() => hideAllPanels());

        // 状态栏光标行列数更新
        editor.onDidChangeCursorPosition((e) => {
            if (els.posDisplay) {
                els.posDisplay.innerText = `行 ${e.position.lineNumber}，列 ${e.position.column}`;
            }
        });

        // 状态栏字数统计更新
        editor.onDidChangeCursorSelection(() => {
            EditorManager.updateCharCount();
        });

        // 状态栏语言显示更新
        editor.onDidChangeModelLanguage(() => {
            const langId = editor.getModel().getLanguageId();
            const lang = monaco.languages.getLanguages().find(l => l.id === langId);
            if (els.langSelector) {
                els.langSelector.innerText = lang?.aliases?.[0] || langId;
            }
        });

        // 编辑器内绑定保存快捷键 (Ctrl+S)
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
            if (AppContext.state.isEditMode) {
                eventBus.emit('file:save-request');
            }
        });

        // 建立 ResizeObserver 自适应布局
        const resizeObserver = new ResizeObserver(() => editor.layout());
        resizeObserver.observe(els.editorContainer);
    },

    alignPanel(panelEl, selectorEl) {
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
    },

    async handleManualOpen() {
        const path = els.manualPathInput.value.trim();
        if (!path) { showToast('请输入有效的文件或目录路径'); return; }
        Log.info('UI', '手动请求打开路径:', path);

        try {
            const data = await API.list(path);
            AppContext.update({ workspacePath: data.path });
            renderFileTree(els.fileTree, data.files, 0);

            AppContext.update({ currentPath: '' });
            updateBreadcrumbs(path);
            els.welcomeOverlay.style.display = 'none';

            const editor = EditorManager.getEditor();
            if (editor) editor.layout();

            showToast('工作区加载成功');
            eventBus.emit('sidebar:panel-request', 'explorer');
        } catch (err) {
            const dir = path.substring(0, Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')));
            if (dir) {
                eventBus.emit('workspace:load-request', dir);
            }
            eventBus.emit('file:open-request', { path });
            eventBus.emit('sidebar:collapse-request');
        }
    },

    async handleNewFileInTree() {
        const workspacePath = AppContext.state.workspacePath;
        if (!workspacePath) {
            showToast('尚未打开工作区', true);
            return;
        }

        let targetDir = workspacePath;
        const activeItem = els.fileTree.querySelector('.tree-item.active');
        if (activeItem) {
            const itemPath = activeItem.getAttribute('data-path');
            const isDir = activeItem.getAttribute('data-is-dir') === 'true';
            if (isDir) {
                targetDir = itemPath;
            } else {
                const lastSlash = Math.max(itemPath.lastIndexOf('/'), itemPath.lastIndexOf('\\'));
                if (lastSlash !== -1) {
                    targetDir = itemPath.substring(0, lastSlash);
                }
            }
        }

        let container = els.fileTree;
        let level = 0;
        const isRoot = targetDir === workspacePath;

        if (!isRoot) {
            const safeId = btoa(encodeURIComponent(targetDir)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
            container = document.getElementById(`children-${safeId}`);

            const parentItem = Array.from(els.fileTree.querySelectorAll('.tree-item')).find(el => el.getAttribute('data-path') === targetDir);
            if (parentItem) {
                const currentPadding = parseInt(parentItem.style.paddingLeft) || 12;
                level = Math.floor((currentPadding - 12) / 12) + 1;
                const arrow = parentItem.querySelector('.tree-item-arrow');
                if (arrow) arrow.classList.add('expanded');
            }
            if (container) {
                container.classList.add('visible');
            }
        }

        if (checkIsMobile()) {
            const workspaceName = workspacePath.split(/[/\\]/).pop() || '工作区';
            let displayDir = '';
            if (targetDir === workspacePath) {
                displayDir = workspaceName;
            } else if (targetDir.startsWith(workspacePath)) {
                const rel = targetDir.substring(workspacePath.length).replace(/^[/\\]+/, '');
                displayDir = workspaceName + '/' + rel.replace(/\\/g, '/');
            } else {
                displayDir = targetDir.replace(/\\/g, '/');
            }

            const filename = await showPrompt(`请输入文件名 (./${displayDir}/)：`, '', '新建文件');
            if (!filename) return;

            const separator = targetDir.includes('\\') ? '\\' : '/';
            const filePath = targetDir.endsWith(separator) ? (targetDir + filename) : (targetDir + separator + filename);

            try {
                updateStatus('正在创建文件...');
                await API.newFile(filePath);
                showToast('文件创建成功');

                if (isRoot || !container) {
                    eventBus.emit('workspace:refresh-request');
                } else {
                    const data = await API.list(targetDir);
                    container.innerHTML = '';
                    if (data.files && data.files.length > 0) {
                        data.files.forEach(file => {
                            const subItem = createTreeItem(file, level);
                            container.appendChild(subItem);
                            if (file.is_dir) {
                                const subChildContainer = document.createElement('div');
                                subChildContainer.className = 'tree-children';
                                const subSafeId = btoa(encodeURIComponent(file.path)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
                                subChildContainer.id = `children-${subSafeId}`;
                                container.appendChild(subChildContainer);
                            }
                        });
                    } else {
                        const indent = level * 12 + 12;
                        container.innerHTML = '<div style="padding: 4px ' + indent + 'px; opacity: 0.3; font-size:12px; font-style: italic;">空文件夹</div>';
                    }
                }
                eventBus.emit('file:open-request', { path: filePath, isNew: true });
            } catch (err) {
                showToast('创建失败: ' + err.message, true);
            }
            return;
        }

        if (!container) return;

        const emptyHint = container.querySelector('.tree-empty-hint') ||
            Array.from(container.children).find(el => el.innerText.includes('空文件夹') || el.innerText.includes('加载中'));
        if (emptyHint) {
            emptyHint.style.display = 'none';
        }

        const existingTemp = container.querySelector('.temp-new-file-item');
        if (existingTemp) {
            const input = existingTemp.querySelector('input');
            if (input) input.focus();
            return;
        }

        const tempItem = document.createElement('div');
        tempItem.className = 'tree-item temp-new-file-item';
        tempItem.style.paddingLeft = `${level * 12 + 12}px`;
        tempItem.innerHTML = `
            <span class="tree-item-arrow"></span>
            <span class="tree-item-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3v4a1 1 0 0 0 1 1h4"></path><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"></path></g></svg>
            </span>
            <input type="text" class="tree-item-input" placeholder="文件名" />
        `;

        container.insertBefore(tempItem, container.firstChild);

        const input = tempItem.querySelector('input');
        if (input) input.focus();

        let isSubmitting = false;
        let blurTimer = null;

        const cleanUp = () => {
            if (blurTimer) {
                clearTimeout(blurTimer);
                blurTimer = null;
            }
            input.onblur = null;
            input.onkeydown = null;
            if (tempItem.parentNode) tempItem.remove();
            if (emptyHint && container.children.length === 0) {
                emptyHint.style.display = '';
            }
        };

        const submitNewFile = async () => {
            const filename = input.value.trim();
            if (!filename) {
                showToast('文件名不能为空', true);
                cleanUp();
                return;
            }

            const separator = targetDir.includes('\\') ? '\\' : '/';
            const filePath = targetDir.endsWith(separator) ? (targetDir + filename) : (targetDir + separator + filename);

            try {
                isSubmitting = true;
                updateStatus('正在创建文件...');
                await API.newFile(filePath);
                showToast('文件创建成功');

                cleanUp();

                if (isRoot) {
                    eventBus.emit('workspace:refresh-request');
                } else {
                    const data = await API.list(targetDir);
                    container.innerHTML = '';
                    if (data.files && data.files.length > 0) {
                        data.files.forEach(file => {
                            const subItem = createTreeItem(file, level);
                            container.appendChild(subItem);
                            if (file.is_dir) {
                                const subChildContainer = document.createElement('div');
                                subChildContainer.className = 'tree-children';
                                const subSafeId = btoa(encodeURIComponent(file.path)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
                                subChildContainer.id = `children-${subSafeId}`;
                                container.appendChild(subChildContainer);
                            }
                        });
                    } else {
                        const indent = level * 12 + 12;
                        container.innerHTML = '<div style="padding: 4px ' + indent + 'px; opacity: 0.3; font-size:12px; font-style: italic;">空文件夹</div>';
                    }
                }

                eventBus.emit('file:open-request', { path: filePath, isNew: true });
            } catch (err) {
                Log.error('IO', '创建文件失败:', err);
                showToast('创建失败: ' + err.message, true);
                cleanUp();
            } finally {
                isSubmitting = false;
            }
        };

        input.onkeydown = async (e) => {
            if (e.key === 'Enter') {
                input.onblur = null;
                input.disabled = true;
                await submitNewFile();
            } else if (e.key === 'Escape') {
                cleanUp();
            }
        };

        input.onblur = () => {
            blurTimer = setTimeout(() => {
                if (!isSubmitting) cleanUp();
            }, 150);
        };
    }
};
