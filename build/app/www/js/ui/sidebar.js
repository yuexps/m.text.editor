/**
 * sidebar.js - 侧边栏管理函数
 */

import { els, lastSidebarWidth, setLastSidebarWidth } from './elements.js';
import { checkIsNarrowScreen, frameThrottle } from '../utils.js';
import { AppContext } from '../context.js';
import { eventBus } from '../event_bus.js';
import { EditorManager } from '../editor.js';
import { TerminalManager } from '../terminal.js';

/**
 * 切换汉堡菜单的显示与定位
 */
export function toggleActivityDropdownMenu() {
    const menu = els.activityDropdownMenu;
    if (!menu) return;

    const isHidden = menu.style.display === 'none';
    if (isHidden) {
        const rect = els.activityMenuBtn.getBoundingClientRect();
        menu.style.top = `${rect.bottom}px`;
        menu.style.left = `${rect.left}px`;

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

export function setupVisualViewportListener() {
    if (!window.visualViewport || visualViewportHandler) return;

    visualViewportHandler = frameThrottle(() => {
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
    });

    window.visualViewport.addEventListener('resize', visualViewportHandler, { passive: true });
    window.visualViewport.addEventListener('scroll', visualViewportHandler, { passive: true });
}

export function destroyVisualViewportListener() {
    if (window.visualViewport && visualViewportHandler) {
        window.visualViewport.removeEventListener('resize', visualViewportHandler, { passive: true });
        window.visualViewport.removeEventListener('scroll', visualViewportHandler, { passive: true });
        visualViewportHandler.cancel?.();
        visualViewportHandler = null;
    }
    if (els.sidebar) {
        els.sidebar.style.bottom = '0';
    }
}

/**
 * 展开侧边栏到指定面板
 */
export function expandSidebar(panelName) {
    const sidebar = els.sidebar;
    if (!sidebar) return;

    if (checkIsNarrowScreen()) {
        eventBus.emit('bottom-panel:collapse-request');
    }

    els.sidebarExplorer.style.display = 'none';
    els.sidebarSearch.style.display = 'none';
    els.sidebarSettings.style.display = 'none';

    if (els.activityExplorerBtn) els.activityExplorerBtn.classList.remove('active');
    if (els.activitySearchBtn) els.activitySearchBtn.classList.remove('active');
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
export function collapseSidebar() {
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
export function switchSidebarPanel(panelName) {
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

// 暴露 lastSidebarWidth 修改能力给 manager.js
export { setLastSidebarWidth };
