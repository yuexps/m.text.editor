/**
 * manager.js - UIManager 核心管理器
 */

import { Log, Clipboard, checkIsMobile, checkIsMobileDevice, checkIsNarrowScreen, createDisposableStore, frameThrottle } from '../utils.js';
import { AppContext } from '../context.js';
import { eventBus } from '../event_bus.js';
import { API } from '../api.js';
import { EditorManager } from '../editor.js';
import { TerminalManager } from '../terminal.js';
import { SearchManager } from '../search.js';
import {
    els, uiInitialized, uiDisposables, editorEventDisposables,
    lastSidebarWidth, setLastSidebarWidth, setUiInitialized, setUiDisposables, setEditorEventDisposables
} from './elements.js';
import { showToast, updateBreadcrumbs, hideAllPanels } from './feedback.js';
import { FnosSDK } from '../fnos_sdk.js';

import { renderFileTree, initFileTreeEvents } from './filetree.js';
import {
    expandSidebar, collapseSidebar, switchSidebarPanel,
    toggleActivityDropdownMenu
} from './sidebar.js';
import { initStatusbarPanels } from './statusbar.js';
import { BottomPanelManager } from './bottom_panel.js';

// 移动端虚拟键盘视口适配 (全局常驻生效，主编辑区/底部终端/侧栏防遮挡)
let visualViewportHandler = null;
let layoutEl = null;
let lastAppliedHeight = '';

function setupVisualViewportListener() {
    if (!window.visualViewport || visualViewportHandler) return;

    if (!layoutEl) layoutEl = document.querySelector('.vscode-layout');

    visualViewportHandler = frameThrottle(() => {
        // 软键盘高度 = 布局视口高度 - 可视视口高度
        // 防缩放误判：仅在未处于手势或页面缩放状态 (scale ≈ 1) 下，高度差才代表真实虚拟键盘高度
        const scale = window.visualViewport.scale || 1;
        const isZoomed = Math.abs(scale - 1) > 0.05;
        const keyboardHeight = !isZoomed ? (window.innerHeight - window.visualViewport.height) : 0;
        const isKeyboardOpen = keyboardHeight > 50;

        // 锁定浏览器视口滚动，防页面随键盘弹起整体偏移
        if (isKeyboardOpen) {
            window.scrollTo(0, 0);
        }

        // 软键盘弹出时将整个布局高度收缩到可视视口高度，使状态栏贴合键盘上沿、
        // 编辑区与底部终端随新边框精确重排；收起时恢复样式表默认 100vh
        const newHeight = isKeyboardOpen ? `${window.visualViewport.height}px` : '';
        const changed = newHeight !== lastAppliedHeight;
        lastAppliedHeight = newHeight;
        if (layoutEl) {
            layoutEl.style.height = newHeight;
        }

        // 布局高度发生跳变时才触发重排，避免软键盘动画期间的重复开销
        if (changed) {
            // 底部终端重新拟合新高度
            if (typeof TerminalManager.resize === 'function') {
                TerminalManager.resize();
            }
            // 编辑器可用高度随软键盘伸缩，重排布局
            const editor = EditorManager.getEditor();
            if (editor) editor.layout();
        }
    });

    window.visualViewport.addEventListener('resize', visualViewportHandler, { passive: true });
    window.visualViewport.addEventListener('scroll', visualViewportHandler, { passive: true });
}

function destroyVisualViewportListener() {
    if (window.visualViewport && visualViewportHandler) {
        window.visualViewport.removeEventListener('resize', visualViewportHandler, { passive: true });
        window.visualViewport.removeEventListener('scroll', visualViewportHandler, { passive: true });
        visualViewportHandler.cancel?.();
        visualViewportHandler = null;
    }
    if (layoutEl) {
        layoutEl.style.height = '';
        layoutEl = null;
    }
    lastAppliedHeight = '';
}

export const UIManager = {
    init() {
        if (uiInitialized) return;
        setUiInitialized(true);
        setUiDisposables(createDisposableStore());
        const uiDisp = uiDisposables;

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
        uiDisp.add(() => {
            document.removeEventListener('pointerdown', handleOutsideTrigger, true);
            document.removeEventListener('click', handleOutsideTrigger, true);
        });

        // 初始化底栏状态选择面板（语言/编码/EOL）
        initStatusbarPanels(uiDisp);

        // 初始化文件树交互事件
        initFileTreeEvents(uiDisp);

        // 初始化底部面板并订阅重绘事件
        BottomPanelManager.init();
        // 移动端软键盘视口适配常驻注册，保护主编辑区不被软键盘遮挡
        if (checkIsMobileDevice()) {
            setupVisualViewportListener();
        }
        uiDisp.add(eventBus.on('editor:layout-request', () => {
            const editor = EditorManager.getEditor();
            if (editor) editor.layout();
        }));

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
                const isSettings = els.sidebarSettings.style.display !== 'none';

                if (newWidth < 50) {
                    newWidth = 0;
                    if (explorerBtn) explorerBtn.classList.remove('active');
                    if (searchBtn) searchBtn.classList.remove('active');
                    if (settingsBtn) settingsBtn.classList.remove('active');
                } else if (newWidth < 150) {
                    newWidth = 150;
                } else if (newWidth > 600) {
                    newWidth = 600;
                }

                if (newWidth >= 50) {
                    if (explorerBtn) explorerBtn.classList.toggle('active', isExplorer);
                    if (searchBtn) searchBtn.classList.toggle('active', isSearch);
                    if (settingsBtn) settingsBtn.classList.toggle('active', isSettings);
                }

                els.sidebar.style.width = `${newWidth}px`;
                if (newWidth >= 50) {
                    setLastSidebarWidth(newWidth);
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

            const handleResizerMousedown = (e) => {
                startX = e.clientX;
                startWidth = parseInt(document.defaultView.getComputedStyle(els.sidebar).width, 10);
                els.sidebarResizer.classList.add('active');
                document.body.style.userSelect = 'none';
                document.body.style.cursor = 'col-resize';
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            };
            els.sidebarResizer.addEventListener('mousedown', handleResizerMousedown);
            uiDisp.add(() => els.sidebarResizer.removeEventListener('mousedown', handleResizerMousedown));

            const handleResizerDblclick = () => {
                const currentWidth = parseInt(document.defaultView.getComputedStyle(els.sidebar).width, 10);
                const explorerBtn = els.activityExplorerBtn;
                const searchBtn = els.activitySearchBtn;
                const terminalBtn = els.activityTerminalBtn;
                const settingsBtn = els.activitySettingsBtn;

                const isExplorer = els.sidebarExplorer.style.display !== 'none';
                const isSearch = els.sidebarSearch.style.display !== 'none';
                const isSettings = els.sidebarSettings.style.display !== 'none';

                if (currentWidth > 0) {
                    els.sidebar.style.width = '0px';
                    if (explorerBtn) explorerBtn.classList.remove('active');
                    if (searchBtn) searchBtn.classList.remove('active');
                    if (settingsBtn) settingsBtn.classList.remove('active');
                } else {
                    els.sidebar.style.width = `${lastSidebarWidth}px`;
                    if (explorerBtn) explorerBtn.classList.toggle('active', isExplorer);
                    if (searchBtn) searchBtn.classList.toggle('active', isSearch);
                    if (settingsBtn) settingsBtn.classList.toggle('active', isSettings);
                }
                const editor = EditorManager.getEditor();
                if (editor) editor.layout();
            };
            els.sidebarResizer.addEventListener('dblclick', handleResizerDblclick);
            uiDisp.add(() => els.sidebarResizer.removeEventListener('dblclick', handleResizerDblclick));
        }

        // 绑定路径复制逻辑
        if (els.breadcrumbs) {
            const handleBreadcrumbsClick = async () => {
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
            els.breadcrumbs.addEventListener('click', handleBreadcrumbsClick);
            uiDisp.add(() => els.breadcrumbs.removeEventListener('click', handleBreadcrumbsClick));
        }

        // 绑定欢迎页输入框和打开按钮逻辑
        if (els.openPathBtn) {
            const handleOpenPathBtnClick = () => this.handleManualOpen();
            els.openPathBtn.addEventListener('click', handleOpenPathBtnClick);
            uiDisp.add(() => els.openPathBtn.removeEventListener('click', handleOpenPathBtnClick));
        }

        if (els.manualPathInput) {
            const handleManualPathKeydown = (e) => {
                if (e.key === 'Enter') {
                    this.handleManualOpen();
                    els.manualPathInput.blur();
                }
            };
            els.manualPathInput.addEventListener('keydown', handleManualPathKeydown);
            uiDisp.add(() => els.manualPathInput.removeEventListener('keydown', handleManualPathKeydown));
        }

        // 绑定汉堡下拉菜单
        if (els.activityMenuBtn) {
            const handleActivityMenuBtnClick = (e) => {
                e.stopPropagation();
                toggleActivityDropdownMenu();
            };
            els.activityMenuBtn.addEventListener('click', handleActivityMenuBtnClick);
            uiDisp.add(() => els.activityMenuBtn.removeEventListener('click', handleActivityMenuBtnClick));
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
                    if (editor) {
                        editor.focus();
                        const action = editor.getAction('actions.find');
                        if (action) action.run();
                    }
                },
                replace: () => {
                    const editor = EditorManager.getEditor();
                    if (editor) {
                        editor.focus();
                        const action = editor.getAction('editor.action.startFindReplaceAction');
                        if (action) action.run();
                    }
                },
                openFile: async () => {
                    if (FnosSDK.isAvailable()) {
                        const pickedPath = await FnosSDK.pickUserFile({ directory: false });
                        if (pickedPath) {
                            if (els.manualPathInput) els.manualPathInput.value = pickedPath;
                            UIManager.handleManualOpen(pickedPath, true);
                        }
                    } else {
                        if (els.welcomeOverlay && els.welcomeOverlay.style.display !== 'none' && els.manualPathInput) {
                            els.manualPathInput.focus();
                            els.manualPathInput.select();
                        } else {
                            eventBus.emit('sidebar:panel-request', 'explorer');
                        }
                        showToast('请在主页或侧边栏输入路径打开文件');
                    }
                },
                openFolder: async () => {
                    if (FnosSDK.isAvailable()) {
                        const pickedFolder = await FnosSDK.pickUserFolder();
                        if (pickedFolder) {
                            if (els.manualPathInput) els.manualPathInput.value = pickedFolder;
                            UIManager.handleManualOpen(pickedFolder, false);
                        }
                    } else {
                        if (els.welcomeOverlay && els.welcomeOverlay.style.display !== 'none' && els.manualPathInput) {
                            els.manualPathInput.focus();
                            els.manualPathInput.select();
                        } else {
                            eventBus.emit('sidebar:panel-request', 'explorer');
                        }
                        showToast('请在主页或侧边栏输入路径打开文件夹');
                    }
                }
            };

            const handleDropdownMenuClick = (e) => {
                const item = e.target.closest('.menu-item');
                if (!item || item.classList.contains('disabled')) return;
                const action = item.getAttribute('data-action');
                if (menuActions[action]) {
                    menuActions[action]();
                }
                els.activityDropdownMenu.style.display = 'none';
            };
            els.activityDropdownMenu.addEventListener('click', handleDropdownMenuClick);
            uiDisp.add(() => els.activityDropdownMenu.removeEventListener('click', handleDropdownMenuClick));
        }

        // 订阅侧栏请求事件
        uiDisp.add(eventBus.on('sidebar:panel-request', (panelName) => {
            expandSidebar(panelName);
        }));
        uiDisp.add(eventBus.on('sidebar:collapse-request', () => {
            collapseSidebar();
        }));

        // 绑定工具栏编辑操作按钮事件
        if (els.editModeBtn) {
            const handleEditModeBtnClick = () => {
                eventBus.emit('mode:toggle-request');
                els.editModeBtn.blur();
            };
            els.editModeBtn.addEventListener('click', handleEditModeBtnClick);
            uiDisp.add(() => els.editModeBtn.removeEventListener('click', handleEditModeBtnClick));
        }
        if (els.saveBtn) {
            const handleSaveBtnClick = () => {
                eventBus.emit('file:save-request');
                els.saveBtn.blur();
            };
            els.saveBtn.addEventListener('click', handleSaveBtnClick);
            uiDisp.add(() => els.saveBtn.removeEventListener('click', handleSaveBtnClick));
        }


        // 绑定活动栏切换事件
        if (els.activityExplorerBtn) {
            const handleExplorerBtnClick = () => switchSidebarPanel('explorer');
            els.activityExplorerBtn.addEventListener('click', handleExplorerBtnClick);
            uiDisp.add(() => els.activityExplorerBtn.removeEventListener('click', handleExplorerBtnClick));
        }
        if (els.activitySearchBtn) {
            const handleActivitySearchBtnClick = () => switchSidebarPanel('search');
            els.activitySearchBtn.addEventListener('click', handleActivitySearchBtnClick);
            uiDisp.add(() => els.activitySearchBtn.removeEventListener('click', handleActivitySearchBtnClick));
        }
        if (els.activityTerminalBtn) {
            const handleTerminalBtnClick = () => BottomPanelManager.togglePanel('terminal');
            els.activityTerminalBtn.addEventListener('click', handleTerminalBtnClick);
            uiDisp.add(() => els.activityTerminalBtn.removeEventListener('click', handleTerminalBtnClick));
        }
        if (els.activitySettingsBtn) {
            const handleSettingsBtnClick = () => switchSidebarPanel('settings');
            els.activitySettingsBtn.addEventListener('click', handleSettingsBtnClick);
            uiDisp.add(() => els.activitySettingsBtn.removeEventListener('click', handleSettingsBtnClick));
        }
        if (els.activityOpenExternalBtn) {
            const handleOpenExternalBtnClick = () => {
                window.open(window.location.href, '_blank');
            };
            els.activityOpenExternalBtn.addEventListener('click', handleOpenExternalBtnClick);
            uiDisp.add(() => els.activityOpenExternalBtn.removeEventListener('click', handleOpenExternalBtnClick));
        }

        // 全局搜索快捷键监听
        const handleSearchShortcut = (e) => {
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
        };
        window.addEventListener('keydown', handleSearchShortcut);
        uiDisp.add(() => window.removeEventListener('keydown', handleSearchShortcut));

        // 窄屏下遮罩层点击自动折叠侧边栏
        if (els.sidebarOverlay) {
            const handleSidebarOverlayClick = () => {
                collapseSidebar();
            };
            els.sidebarOverlay.addEventListener('click', handleSidebarOverlayClick);
            uiDisp.add(() => els.sidebarOverlay.removeEventListener('click', handleSidebarOverlayClick));
        }

        // 移动端与触屏点击后自动失焦，规避按钮点击态粘滞/残留高亮虚线框
        const handleClickableBlur = (e) => {
            if (e.detail > 0) {
                const clickable = e.target.closest('button, .activity-btn, .sidebar-action-btn, .tab-scroll-btn, .menu-item, .status-item.clickable');
                if (clickable) {
                    clickable.blur();
                }
            }
        };
        document.addEventListener('click', handleClickableBlur);
        uiDisp.add(() => document.removeEventListener('click', handleClickableBlur));
    },

    bindEditorEvents(editor) {
        if (!editor) return;
        editorEventDisposables.dispose();
        setEditorEventDisposables(createDisposableStore());

        // 监听焦点和点击隐藏面板
        editorEventDisposables.add(editor.onDidFocusEditorText(() => hideAllPanels()));
        editorEventDisposables.add(editor.onMouseDown(() => hideAllPanels()));

        // 状态栏光标行列数更新
        editorEventDisposables.add(editor.onDidChangeCursorPosition((e) => {
            if (els.posDisplay) {
                els.posDisplay.innerText = `行 ${e.position.lineNumber}，列 ${e.position.column}`;
            }
        }));

        // 状态栏字数统计更新
        editorEventDisposables.add(editor.onDidChangeCursorSelection(() => {
            EditorManager.updateCharCount();
        }));

        // 状态栏语言显示更新
        editorEventDisposables.add(editor.onDidChangeModelLanguage(() => {
            const model = editor.getModel();
            if (!model) return;
            if (model.uri.toString() === 'podnote://welcome') {
                if (els.langSelector) {
                    els.langSelector.innerText = '主页';
                }
                return;
            }
            const langId = model.getLanguageId();
            const lang = monaco.languages.getLanguages().find(l => l.id === langId);
            if (els.langSelector) {
                els.langSelector.innerText = lang?.aliases?.[0] || langId;
            }
        }));

        // 编辑器内绑定保存快捷键 (Ctrl+S)
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
            if (AppContext.state.isEditMode) {
                eventBus.emit('file:save-request');
            }
        });

        // 建立 ResizeObserver 自适应布局
        const layoutEditor = frameThrottle(() => editor.layout());
        const resizeObserver = new ResizeObserver(layoutEditor);
        resizeObserver.observe(els.editorContainer);
        editorEventDisposables.add(() => {
            resizeObserver.disconnect();
            layoutEditor.cancel?.();
        });
    },

    async handleManualOpen(overridePath = null, isExplicitFile = null) {
        let path = (overridePath !== null && overridePath !== undefined) ? overridePath : (els.manualPathInput ? els.manualPathInput.value.trim() : '');

        if (!path) { showToast('请输入有效的目录或文件路径'); return; }
        Log.info('UI', '手动请求打开路径:', path);

        const isFile = isExplicitFile !== null ? isExplicitFile : /\.[a-zA-Z0-9]+$/.test(path.split(/[/\\]/).pop() || '');

        if (isFile) {
            const dir = path.substring(0, Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')));
            if (dir) {
                eventBus.emit('workspace:load-request', dir);
            }
            eventBus.emit('file:open-request', { path });
            eventBus.emit('sidebar:collapse-request');
        } else {
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
                // 目录加载失败时，fallback 尝试作为文件打开
                const dir = path.substring(0, Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')));
                if (dir) {
                    eventBus.emit('workspace:load-request', dir);
                }
                eventBus.emit('file:open-request', { path });
                eventBus.emit('sidebar:collapse-request');
            }
        }
    },

    dispose() {
        editorEventDisposables.dispose();
        uiDisposables.dispose();
        destroyVisualViewportListener();
        setUiInitialized(false);
    }
};
