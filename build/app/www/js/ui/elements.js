/**
 * elements.js - DOM 元素引用集合与共享状态
 */

import { createDisposableStore } from '../utils.js';

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
    filePreviewContainer: document.getElementById('file-preview-container'),
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

    // 终端与底部面板相关元素
    activityTerminalBtn: document.getElementById('activity-terminal-btn'),
    terminalContainer: document.getElementById('terminal-container'),
    terminalGitBtn: document.getElementById('panel-terminal-git-btn'),
    terminalLocateBtn: document.getElementById('panel-terminal-locate-btn'),
    terminalRestartBtn: document.getElementById('panel-terminal-restart-btn'),
    bottomPanel: document.getElementById('bottom-panel'),
    panelResizer: document.getElementById('panel-resizer'),
    closePanelBtn: document.getElementById('close-panel-btn'),
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

// 共享状态变量
let lastSidebarWidth = 250;
let uiInitialized = false;
let uiDisposables = createDisposableStore();
let editorEventDisposables = createDisposableStore();

export { lastSidebarWidth, uiInitialized, uiDisposables, editorEventDisposables };

// 状态修改函数（仅内部模块使用）
export function setLastSidebarWidth(val) { lastSidebarWidth = val; }
export function setUiInitialized(val) { uiInitialized = val; }
export function setUiDisposables(val) { uiDisposables = val; }
export function setEditorEventDisposables(val) { editorEventDisposables = val; }
