(function () {
    'use strict';

    // FNOS 文件管理深度集成（去类名化文本驱动）
    document.documentElement.dataset.podnoteStatus = 'active';

    function notifyExtension() {
        try {
            const detail = {
                action: 'status_update',
                status: document.documentElement.dataset.podnoteStatus || 'inactive',
                features: document.documentElement.dataset.podnoteFeatures || '',
                logs: document.documentElement.dataset.podnoteLogs || '[]'
            };
            window.dispatchEvent(new CustomEvent('podnote_status_event', { detail }));
        } catch (e) {}
    }

    function logToExtension(msg, type = 'info') {
        const html = document.documentElement;
        let logs = [];
        try { logs = JSON.parse(html.dataset.podnoteLogs || "[]"); } catch (e) { }
        logs.push({ t: new Date().toLocaleTimeString(), m: msg, s: type });
        if (logs.length > 50) logs.shift();
        html.dataset.podnoteLogs = JSON.stringify(logs);
        notifyExtension();
    }

    const NPLog = {
        success: (msg) => {
            console.log(`%c[PodNote] ${msg}`, "color: #4CAF50; font-weight: bold;");
            logToExtension(msg, "success");
        },
        info: (msg) => {
            console.log(`%c[PodNote] ${msg}`, "color: #2196F3;");
            logToExtension(msg, "info");
        },
        warn: (msg) => {
            console.warn(`%c[PodNote] ${msg}`, "color: #FF9800; font-weight: bold;");
            logToExtension(msg, "error");
        },
        error: (msg) => {
            console.error(`%c[PodNote] ${msg}`, "color: #FF5722; font-weight: bold;");
            logToExtension(msg, "error");
        },
        sync: (msg) => {
            console.log(`%c[PodNote] ${msg}`, "color: #FF9800; font-weight: bold;");
            logToExtension(msg, "sync");
        }
    };

    NPLog.success("FNOS 集成插件已启动");

    function updateStatus(feature) {
        const html = document.documentElement;
        html.dataset.podnoteStatus = 'injected';
        const features = new Set((html.dataset.podnoteFeatures || "").split(',').filter(f => f));
        features.add(feature);
        html.dataset.podnoteFeatures = Array.from(features).join(',');
        notifyExtension();
    }


    // 核心配置与选择器
    const CONFIG = {
        WIN_SELECTOR: '[role="tabpanel"]',
        APP_TITLE: '文件管理',
        ROOT_LABELS: ["我的文件", "设备全部文件", "应用文件"],
        MENU_KEYWORDS: ['重命名', '详细信息', '下载', '剪切'],
        REFRESH_ICON_PATH: 'M12 4a8 8 0 108 8',
        API_NEW: '/app/m-text-editor/api/new',
        EDITOR_URL: '/app/m-text-editor/?path='
    };

    let lastActiveWin = null;
    let lastContextMenuTarget = null;
    let lastContextMenuPath = null;

    window.__NP_WINS__ = window.__NP_WINS__ || {};
    window.__NP_MAX_Z__ = window.__NP_MAX_Z__ || 10001;

    // 校验物理路径与面包屑末尾是否一致
    function checkPathMatchBreadcrumb(physicalPath, winContainer) {
        if (!physicalPath) return null;
        const breadcrumbs = getWinBreadcrumbPath(winContainer);
        const domParts = breadcrumbs.split('/').filter(p => p && !CONFIG.ROOT_LABELS.includes(p));
        const physParts = physicalPath.split('/').filter(p => p);

        if (domParts.length === 0) {
            const isSystemRoot = CONFIG.ROOT_LABELS.includes(breadcrumbs.trim());
            return isSystemRoot ? '/' : null;
        }

        const lastDomDir = domParts[domParts.length - 1];
        const lastPhysDir = physParts[physParts.length - 1];

        if (lastDomDir && lastPhysDir && lastDomDir.toLowerCase() === lastPhysDir.toLowerCase()) {
            return physicalPath;
        }
        return null;
    }

    // 物理路径解析 (DOM 属性直读 + 面包屑校验)
    function getPathFromDOM(winContainer) {
        if (!winContainer) return null;

        const breadcrumbs = getWinBreadcrumbPath(winContainer);
        const domParts = breadcrumbs.split('/').filter(p => p && !CONFIG.ROOT_LABELS.includes(p));
        if (domParts.length === 0 && CONFIG.ROOT_LABELS.includes(breadcrumbs.trim())) {
            return "/";
        }

        const anyItem = winContainer.querySelector('[data-path]');
        if (anyItem) {
            const itemPath = anyItem.getAttribute('data-path');
            if (itemPath && itemPath.includes('/')) {
                const parentPath = itemPath.substring(0, itemPath.lastIndexOf('/'));
                const matched = checkPathMatchBreadcrumb(parentPath, winContainer);
                if (matched) return matched;
                return parentPath;
            }
        }

        return null;
    }

    function isFileManagerWin(el) {
        if (!el) return false;

        const win = el.closest('.trim-ui__app-layout--window') || 
                    (el.matches && el.matches(CONFIG.WIN_SELECTOR) ? el : null) || 
                    el.closest(CONFIG.WIN_SELECTOR);
        if (win) {
            const header = win.querySelector('.trim-ui__app-layout--header-title');
            const isTitleMatch = header && header.innerText.trim() === CONFIG.APP_TITLE;
            if (!isTitleMatch) return false;
            return getWinBreadcrumbPath(win) !== "";
        }

        return getWinBreadcrumbPath(document.body) !== "";
    }

    // 获取完整的面包屑层级路径
    function getWinBreadcrumbPath(win) {
        const items = Array.from(win.querySelectorAll('div[title]'));
        const rootItem = items.find(el => CONFIG.ROOT_LABELS.includes(el.innerText.trim()));
        if (!rootItem) return "";

        const addressBar = rootItem.closest('.flex-1') || rootItem.parentElement;

        return Array.from(addressBar.querySelectorAll('div[title]'))
            .map(el => el.getAttribute('title').trim())
            .filter(t => t)
            .join('/');
    }

    // 处理右键菜单的编辑操作
    function handleContextMenuEdit() {
        if (!lastContextMenuTarget) return;

        // 优先使用锁定的物理路径
        const itemPath = lastContextMenuPath || 
            lastContextMenuTarget.getAttribute('data-path') ||
            lastContextMenuTarget.closest('[data-path]')?.getAttribute('data-path');

        if (itemPath) {
            NPLog.info(`准备编辑文件: ${itemPath}`);
            showEditorWindow(itemPath);
        } else {
            NPLog.error("文件识别失败: 无法确定完整路径");
        }
    }

    // UI 组件与编辑器弹窗
    function createBackdrop() {
        const backdrop = document.createElement('div');
        backdrop.className = 'podnote-backdrop';
        backdrop.style.cssText = `
            position: absolute; 
            inset: 0; 
            background: var(--semi-color-overlay-bg, rgba(0,0,0,0.15)); 
            z-index: 9999; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            backdrop-filter: blur(2px); 
            border-radius: inherit;
            animation: np-fadeIn 0.2s ease-out;
        `;
        return backdrop;
    }

    function showCreateFileModal(path, container) {
        return new Promise((resolve) => {
            const backdrop = createBackdrop();
            const modal = document.createElement('div');

            modal.style.cssText = `
                width: 448px; 
                background: var(--semi-color-bg-2, #ffffff); 
                border: 1px solid var(--semi-color-border, #eef0f1); 
                border-radius: 16px; 
                box-shadow: 0 8px 36px rgba(0,0,0,0.12); 
                display: flex; 
                flex-direction: column; 
                overflow: hidden; 
                animation: np-modalIn 0.3s cubic-bezier(0.2, 0, 0, 1);
                font-family: Inter, -apple-system, sans-serif;
            `;

            modal.innerHTML = `
                <div style="padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--semi-color-border, #f0f0f0);">
                    <h5 style="margin: 0; font-size: 16px; font-weight: 600; color: var(--semi-color-text-0, #1c1f23);">新建文件 - PodNote</h5>
                    <button id="np-close" style="background: none; border: none; cursor: pointer; color: var(--semi-color-text-2, #646a73); font-size: 20px; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 6px; transition: background 0.2s;" onmouseover="this.style.background='var(--semi-color-fill-0, #f5f6f7)'" onmouseout="this.style.background='none'">
                        <svg viewBox="0 0 24 24" fill="none" width="1em" height="1em"><path d="M17.66 19.78a1.5 1.5 0 0 0 2.12-2.12L14.12 12l5.66-5.66a1.5 1.5 0 0 0-2.12-2.12L12 9.88 6.34 4.22a1.5 1.5 0 1 0-2.12 2.12L9.88 12l-5.66 5.66a1.5 1.5 0 0 0 2.12 2.12L12 14.12l5.66 5.66Z" fill="currentColor"></path></svg>
                    </button>
                </div>
                <div style="padding: 24px; flex: 1;">
                    <div style="margin-bottom: 8px; font-size: 14px; font-weight: 600;">文件名 <span style="color: var(--semi-color-danger, #f93920);">*</span></div>
                    <div id="np-input-wrap" style="border: 1px solid var(--semi-color-border, #dcdfe6); border-radius: 6px; padding: 6px 12px; background: var(--semi-color-fill-0, #f5f6f7);">
                        <input id="np-filename" type="text" placeholder="请输入文件名" style="width: 100%; border: none; background: none; outline: none; font-size: 14px;">
                    </div>
                    <p style="font-size: 12px; color: var(--semi-color-text-2, #646a73); margin-top: 12px;">保存至: ${path}</p>
                </div>
                <div style="padding: 16px 24px; display: flex; justify-content: flex-end; gap: 12px; border-top: 1px solid var(--semi-color-border, #f0f0f0);">
                    <button id="np-btn-cancel" style="padding: 0 16px; height: 32px; border-radius: 6px; border: 1px solid var(--semi-color-border, #dcdfe6); background: white; cursor: pointer; font-size: 14px; font-weight: 600; color: var(--semi-color-text-0, #1c1f23); min-width: 88px;" onmouseover="this.style.background='var(--semi-color-fill-0, #f5f6f7)'" onmouseout="this.style.background='white'">取消</button>
                    <button id="np-btn-ok" style="padding: 0 16px; height: 32px; border-radius: 6px; border: none; background: var(--semi-color-primary, #336df4); cursor: pointer; font-size: 14px; font-weight: 600; color: white; min-width: 88px;" onmouseover="this.style.filter='brightness(1.1)'" onmouseout="this.style.filter='none'">确定</button>
                </div>
                <style>
                    @keyframes np-fadeIn { from { opacity: 0; } to { opacity: 1; } }
                    @keyframes np-modalIn { from { opacity: 0; transform: translateY(20px) scale(0.9); } to { opacity: 1; transform: translateY(0) scale(1); } }
                </style>
            `;

            container.appendChild(backdrop);
            backdrop.appendChild(modal);
            const input = modal.querySelector('#np-filename');
            const wrap = modal.querySelector('#np-input-wrap');
            input.focus();

            const finish = (val) => {
                if (val !== null && !val.trim()) { wrap.style.borderColor = "var(--semi-color-danger, #f93920)"; return; }
                container.removeChild(backdrop);
                resolve(val);
            };
            modal.querySelector('#np-btn-ok').onclick = () => finish(input.value);
            modal.querySelector('#np-btn-cancel').onclick = () => finish(null);
            modal.querySelector('#np-close').onclick = () => finish(null);
            input.onkeydown = (e) => { if (e.key === 'Enter') finish(input.value); if (e.key === 'Escape') finish(null); };
        });
    }

    function showPodNoteAlert(title, content, container) {
        const backdrop = createBackdrop();
        const modal = document.createElement('div');
        modal.style.cssText = `
            width: 448px; 
            background: var(--semi-color-bg-2, #ffffff); 
            border: 1px solid var(--semi-color-border, #f0f0f0); 
            border-radius: 16px; 
            box-shadow: 0 8px 36px rgba(0,0,0,0.12); 
            display: flex; 
            flex-direction: column; 
            overflow: hidden;
            animation: np-modalIn 0.3s cubic-bezier(0.2, 0, 0, 1);
            font-family: Inter, -apple-system, sans-serif;
        `;
        modal.innerHTML = `
            <div style="padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--semi-color-border, #f0f0f0);">
                <h5 style="margin: 0; font-size: 16px; font-weight: 600;">${title} - PodNote</h5>
                <button id="np-alert-close" style="background: none; border: none; cursor: pointer; color: var(--semi-color-text-2, #646a73); font-size: 20px; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 6px; transition: background 0.2s;" onmouseover="this.style.background='var(--semi-color-fill-0, #f5f6f7)'" onmouseout="this.style.background='none'">
                    <svg viewBox="0 0 24 24" fill="none" width="1em" height="1em"><path d="M17.66 19.78a1.5 1.5 0 0 0 2.12-2.12L14.12 12l5.66-5.66a1.5 1.5 0 0 0-2.12-2.12L12 9.88 6.34 4.22a1.5 1.5 0 1 0-2.12 2.12L9.88 12l-5.66 5.66a1.5 1.5 0 0 0 2.12 2.12L12 14.12l5.66 5.66Z" fill="currentColor"></path></svg>
                </button>
            </div>
            <div style="padding: 24px; flex: 1; color: var(--semi-color-text-1, #1c1f23); line-height: 1.6;">${content}</div>
            <div style="padding: 16px 24px; display: flex; justify-content: flex-end; border-top: 1px solid var(--semi-color-border, #f0f0f0);">
                <button id="alert-ok" style="padding: 0 16px; height: 32px; border-radius: 6px; border: none; background: var(--semi-color-primary, #336df4); cursor: pointer; font-size: 14px; font-weight: 600; color: white; min-width: 88px;" onmouseover="this.style.filter='brightness(1.1)'" onmouseout="this.style.filter='none'">知道了</button>
            </div>
        `;
        const target = container || document.body;
        target.appendChild(backdrop);
        backdrop.appendChild(modal);

        const closeBtn = modal.querySelector('#np-alert-close');
        const okBtn = modal.querySelector('#alert-ok');

        const close = () => target.removeChild(backdrop);
        closeBtn.onclick = close;
        okBtn.onclick = close;
    }

    function showEditorWindow(path) {
        const pathHash = btoa(unescape(encodeURIComponent(path))).replace(/[/+=]/g, '');
        const winId = `podnote-win-${pathHash}`;

        // 检查是否已打开
        if (window.__NP_WINS__[path]) {
            const existingWin = document.getElementById(winId);
            if (existingWin) {
                focusPodNoteWindow(existingWin);
                NPLog.info(`窗口置顶: ${path}`);
                existingWin.style.outline = "2px solid var(--semi-color-primary)";
                setTimeout(() => existingWin.style.outline = "none", 500);
                return;
            }
        }

        if (!document.getElementById('podnote-window-global-style')) {
            const style = document.createElement('style');
            style.id = 'podnote-window-global-style';
            style.innerHTML = `
                .podnote-window-instance.np-win-transition {
                    transition: top 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), 
                                left 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), 
                                width 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), 
                                height 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), 
                                border-radius 0.25s, 
                                box-shadow 0.25s;
                }
            `;
            document.head.appendChild(style);
        }

        // 读取上次关闭时的位置状态
        const savedState = JSON.parse(localStorage.getItem('podnote-editor-win-state') || '{}');

        let isDragging = false, isResizing = false;
        let startX, startY, initialX, initialY;
        let startWidth, startHeight;
        let isMaximized = false;
        let originalRect = {};

        const container = document.createElement('div');
        container.id = winId;
        container.className = 'podnote-window-instance';
        container.style.cssText = `
            position: fixed;
            top: ${savedState.top || '15%'};
            left: ${savedState.left || '15%'};
            width: ${savedState.width || '70%'};
            height: ${savedState.height || '70%'};
            background: var(--semi-color-bg-2, #ffffff);
            border-radius: 12px;
            box-shadow: 0 12px 48px rgba(0,0,0,0.25);
            z-index: ${window.__NP_MAX_Z__};
            display: flex;
            flex-direction: column;
            overflow: hidden;
            animation: np-modalIn 0.3s cubic-bezier(0.2, 0, 0, 1);
            border: 1px solid var(--semi-color-border, #f0f0f0);
            min-width: 700px;
            min-height: 500px;
            transition: box-shadow 0.2s, opacity 0.2s, z-index 0.1s;
        `;

        const editorUrl = `${CONFIG.EDITOR_URL}${encodeURIComponent(path)}`;

        container.innerHTML = `
            <div class="np-win-header" style="height: 40px; background: var(--semi-color-bg-1, #f5f6f7); display: flex; align-items: center; justify-content: space-between; padding: 0 12px; cursor: move; border-bottom: 1px solid var(--semi-color-border, #f0f0f0); user-select: none;">
                <div style="display: flex; align-items: center; gap: 8px; pointer-events: none; overflow: hidden; flex: 1;">
                    <img src="/app/m-text-editor/images/ICON.PNG" style="width: 20px; height: 20px; object-fit: contain;" />
                    <span style="font-size: 13px; font-weight: 600; color: var(--semi-color-text-0); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">PodNote</span>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <button class="win-btn-ghost" title="开启/关闭幽灵模式" style="background: none; border: none; cursor: pointer; color: var(--semi-color-text-2); display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 6px; transition: all 0.2s; pointer-events: auto;" onmouseover="this.style.background='var(--semi-color-fill-0)'" onmouseout="this.style.background='none'">
                        <svg class="eye-open" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                        <svg class="eye-close" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" style="display:none;"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                    </button>
                    <button class="win-btn-max" title="最大化/还原" style="background: none; border: none; cursor: pointer; color: var(--semi-color-text-2); display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 6px; transition: all 0.2s;" onmouseover="this.style.background='var(--semi-color-fill-0)'" onmouseout="this.style.background='none'">
                        <svg class="icon-max" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24" width="16" height="16"><g fill="none"><path d="M5 6a1 1 0 0 1 1-1h2a1 1 0 0 0 0-2H6a3 3 0 0 0-3 3v2a1 1 0 0 0 2 0V6zm0 12a1 1 0 0 0 1 1h2a1 1 0 1 1 0 2H6a3 3 0 0 1-3-3v-2a1 1 0 1 1 2 0v2zM18 5a1 1 0 0 1 1 1v2a1 1 0 1 0 2 0V6a3 3 0 0 0-3-3h-2a1 1 0 1 0 0 2h2zm1 13a1 1 0 0 1-1 1h-2a1 1 0 1 0 0 2h2a3 3 0 0 0 3-3v-2a1 1 0 1 0-2 0v2z" fill="currentColor"></path></g></svg>
                        <svg class="icon-restore" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24" width="16" height="16" style="display: none;"><g fill="none"><path d="M9 4a1 1 0 0 0-2 0v2.5a.5.5 0 0 1-.5.5H4a1 1 0 0 0 0 2h2.5A2.5 2.5 0 0 0 9 6.5V4zm0 16a1 1 0 1 1-2 0v-2.5a.5.5 0 0 0-.5-.5H4a1 1 0 1 1 0-2h2.5A2.5 2.5 0 0 1 9 17.5V20zm7-17a1 1 0 0 0-1 1v2.5A2.5 2.5 0 0 0 17.5 9H20a1 1 0 1 0 0-2h-2.5a.5.5 0 0 1-.5-.5V4a1 1 0 0 0-1-1zm-1 17a1 1 0 1 0 2 0v-2.5a.5.5 0 0 1 .5-.5H20a1 1 0 1 0 0-2h-2.5a.5.5 0 0 0-2.5 2.5V20z" fill="currentColor"></path></g></svg>
                    </button>
                    <button class="win-btn-close" title="关闭" style="background: none; border: none; cursor: pointer; color: var(--semi-color-text-2); display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 6px; transition: all 0.2s;" onmouseover="this.style.background='#ff4d4f';this.style.color='white'" onmouseout="this.style.background='none';this.style.color='var(--semi-color-text-2)'">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none"><path d="M17.66 19.78a1.5 1.5 0 0 0 2.12-2.12L14.12 12l5.66-5.66a1.5 1.5 0 0 0-2.12-2.12L12 9.88 6.34 4.22a1.5 1.5 0 1 0-2.12 2.12L9.88 12l-5.66 5.66a1.5 1.5 0 0 0 2.12 2.12L12 14.12l5.66 5.66Z" fill="currentColor"></path></svg>
                    </button>
                </div>
            </div>
            <div style="flex: 1; position: relative; background: #1e1e1e;">
                <iframe src="${editorUrl}" style="width: 100%; height: 100%; border: none;"></iframe>
                <div class="np-iframe-shim" style="position: absolute; inset: 0; z-index: 5; background: transparent; display: none;"></div>
            </div>
            <div class="resizer-r" style="position: absolute; right: 0; top: 0; width: 6px; height: 100%; cursor: e-resize; z-index: 9; background: transparent;"></div>
            <div class="resizer-b" style="position: absolute; left: 0; bottom: 0; width: 100%; height: 6px; cursor: s-resize; z-index: 9; background: transparent;"></div>
            <div class="resizer-rb" style="position: absolute; right: 0; bottom: 0; width: 16px; height: 16px; cursor: nwse-resize; z-index: 10; background: transparent;"></div>
        `;

        document.body.appendChild(container);
        window.__NP_WINS__[path] = container;
        focusPodNoteWindow(container);
        NPLog.info(`编辑器启动: ${path}`);

        // 绑定窗口最大化与幽灵模式逻辑
        const iframe = container.querySelector('iframe');
        const header = container.querySelector('.np-win-header');
        const ghostBtn = container.querySelector('.win-btn-ghost');

        ghostBtn.onclick = (e) => {
            e.stopPropagation();
            const isGhost = container.getAttribute('data-ghost') === 'true';
            setGhostMode(container, !isGhost);
            if (isGhost) focusPodNoteWindow(container);
        };

        const updateMaxBtnIcon = (maximized) => {
            const maxBtn = container.querySelector('.win-btn-max');
            if (!maxBtn) return;
            const maxIcon = maxBtn.querySelector('.icon-max');
            const restoreIcon = maxBtn.querySelector('.icon-restore');
            if (maximized) {
                if (maxIcon) maxIcon.style.display = 'none';
                if (restoreIcon) restoreIcon.style.display = 'block';
            } else {
                if (maxIcon) maxIcon.style.display = 'block';
                if (restoreIcon) restoreIcon.style.display = 'none';
            }
        };

        const toggleMaximize = () => {
            container.classList.add('np-win-transition');
            if (isMaximized) {
                container.style.top = originalRect.top;
                container.style.left = originalRect.left;
                container.style.width = originalRect.width;
                container.style.height = originalRect.height;
                container.style.borderRadius = '12px';
                isMaximized = false;
            } else {
                originalRect = {
                    top: container.style.top,
                    left: container.style.left,
                    width: container.style.width,
                    height: container.style.height
                };
                container.style.top = '0';
                container.style.left = '0';
                container.style.width = '100vw';
                container.style.height = '100vh';
                container.style.borderRadius = '0';
                isMaximized = true;
            }
            updateMaxBtnIcon(isMaximized);
            setTimeout(() => {
                container.classList.remove('np-win-transition');
                saveState();
            }, 250);
        };

        container.querySelector('.win-btn-max').onclick = (e) => {
            e.stopPropagation();
            if (container.getAttribute('data-ghost') === 'true') return;
            toggleMaximize();
        };

        // 窗口层级置顶处理
        container.addEventListener('mousedown', (e) => {
            // 如果是幽灵模式，不处理置顶
            if (container.getAttribute('data-ghost') === 'true') return;
            focusPodNoteWindow(container);
        });

        // 窗口拖拽与缩放逻辑
        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('button')) return;
            if (container.getAttribute('data-ghost') === 'true') return;
            if (isMaximized) return;

            isDragging = true;
            iframe.style.pointerEvents = 'none';
            header.style.cursor = 'grabbing';

            startX = e.clientX;
            startY = e.clientY;
            initialX = container.offsetLeft;
            initialY = container.offsetTop;
        });

        let resizeType = '';

        const initResize = (e, type) => {
            e.stopPropagation();
            e.preventDefault();

            if (isMaximized) {
                container.style.borderRadius = '12px';
                isMaximized = false;
                updateMaxBtnIcon(false);
                container.style.width = originalRect.width;
                container.style.height = originalRect.height;
                container.style.top = originalRect.top;
                container.style.left = originalRect.left;
            }

            isResizing = true;
            resizeType = type;
            startX = e.clientX;
            startY = e.clientY;
            startWidth = container.offsetWidth;
            startHeight = container.offsetHeight;
            iframe.style.pointerEvents = 'none';
        };

        container.querySelector('.resizer-r').addEventListener('mousedown', (e) => initResize(e, 'r'));
        container.querySelector('.resizer-b').addEventListener('mousedown', (e) => initResize(e, 'b'));
        container.querySelector('.resizer-rb').addEventListener('mousedown', (e) => initResize(e, 'rb'));

        window.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                container.style.left = initialX + dx + 'px';
                container.style.top = initialY + dy + 'px';
                container.style.right = 'auto';
                container.style.bottom = 'auto';
            } else if (isResizing) {
                const dw = e.clientX - startX;
                const dh = e.clientY - startY;
                if (resizeType === 'r' || resizeType === 'rb') {
                    const newWidth = Math.max(700, startWidth + dw);
                    container.style.width = newWidth + 'px';
                }
                if (resizeType === 'b' || resizeType === 'rb') {
                    const newHeight = Math.max(500, startHeight + dh);
                    container.style.height = newHeight + 'px';
                }
            }
        });

        const saveState = () => {
            if (isMaximized) {
                localStorage.setItem('podnote-editor-win-state', JSON.stringify(originalRect));
            } else {
                localStorage.setItem('podnote-editor-win-state', JSON.stringify({
                    top: container.style.top,
                    left: container.style.left,
                    width: container.style.width,
                    height: container.style.height
                }));
            }
        };

        window.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                iframe.style.pointerEvents = 'auto';
                header.style.cursor = 'move';
                saveState();
            }
            if (isResizing) {
                isResizing = false;
                iframe.style.pointerEvents = 'auto';
                saveState();
            }
        });

        container.addEventListener('mouseup', saveState);

        // 双击最大化/还原逻辑
        header.addEventListener('dblclick', (e) => {
            if (e.target.closest('button')) return;
            if (container.getAttribute('data-ghost') === 'true') return;
            toggleMaximize();
        });

        // 关闭逻辑
        container.querySelector('.win-btn-close').onclick = () => {
            saveState();
            delete window.__NP_WINS__[path];
            document.body.removeChild(container);
        };
    }

    // 激活窗口高亮
    function focusPodNoteWindow(el) {
        window.__NP_MAX_Z__++;
        el.style.zIndex = window.__NP_MAX_Z__;
        el.style.boxShadow = "0 12px 64px rgba(0,0,0,0.4)";
        el.style.opacity = "1";
        el.style.pointerEvents = 'auto';
        el.setAttribute('data-ghost', 'false');

        // 切换幽灵模式图标
        const openEye = el.querySelector('.eye-open');
        const closeEye = el.querySelector('.eye-close');
        if (openEye) openEye.style.display = 'block';
        if (closeEye) closeEye.style.display = 'none';

        // 隐藏当前窗口遮罩
        const shim = el.querySelector('.np-iframe-shim');
        if (shim) shim.style.display = 'none';

        // 弱化其他窗口
        document.querySelectorAll('.podnote-window-instance').forEach(win => {
            if (win !== el) {
                blurPodNoteWindow(win);
            }
        });
    }

    // 弱化未活动窗口（不开启穿透）
    function blurPodNoteWindow(el) {
        if (el.getAttribute('data-ghost') === 'true') return;
        el.style.boxShadow = "0 4px 16px rgba(0,0,0,0.15)";
        el.style.opacity = "0.9";
        const shim = el.querySelector('.np-iframe-shim');
        if (shim) {
            shim.style.display = 'block';
            shim.style.pointerEvents = 'auto';
        }
    }

    // 切换幽灵模式（调整透明度与鼠标穿透）
    function setGhostMode(el, isGhost) {
        const shim = el.querySelector('.np-iframe-shim');
        const ghostBtn = el.querySelector('.win-btn-ghost');
        const iframe = el.querySelector('iframe');
        const resizers = el.querySelectorAll('[class^="resizer-"]');

        if (isGhost) {
            el.style.opacity = "0.3";
            el.style.pointerEvents = 'none';
            el.style.boxShadow = "none";
            el.setAttribute('data-ghost', 'true');
            if (el.querySelector('.eye-open')) el.querySelector('.eye-open').style.display = 'none';
            if (el.querySelector('.eye-close')) el.querySelector('.eye-close').style.display = 'block';

            // 限制只有按钮可以交互
            if (ghostBtn) {
                ghostBtn.style.pointerEvents = 'auto';
                ghostBtn.style.color = 'var(--semi-color-primary)';
            }
            if (iframe) iframe.style.pointerEvents = 'none';
            resizers.forEach(r => r.style.display = 'none');

            if (shim) {
                shim.style.display = 'block';
                shim.style.pointerEvents = 'none';
            }
        } else {
            el.setAttribute('data-ghost', 'false');
            if (ghostBtn) {
                ghostBtn.style.color = 'var(--semi-color-text-2)';
            }
            if (iframe) iframe.style.pointerEvents = 'auto';
            resizers.forEach(r => r.style.display = 'block');
            focusPodNoteWindow(el);
        }
    }

    // 点击原生区域时弱化所有窗口
    function blurPodNoteWindows() {
        Object.values(window.__NP_WINS__).forEach(win => {
            blurPodNoteWindow(win);
        });
    }


    // 右键菜单与工具栏元素注入引擎
    function injectPodNoteMenuItem(menu) {
        const findAnchor = (label) => {
            const spans = Array.from(menu.querySelectorAll('span'));
            return spans.find(el => el.innerText.trim() === label);
        };

        let anchorSpan = findAnchor("打开方式");
        let isFolder = false;

        if (!anchorSpan) {
            anchorSpan = findAnchor("新窗口打开");
            isFolder = true;
        }
        if (!anchorSpan) {
            anchorSpan = findAnchor("下载");
            isFolder = false;
        }

        if (!anchorSpan) {
            NPLog.error("右键菜单注入失败: 未找到‘打开方式’、‘新窗口打开’或‘下载’锚点");
            return;
        }

        const anchorRow = anchorSpan.closest('.relative');
        if (!anchorRow || menu.querySelector('.podnote-menu-item')) return;

        const newItem = document.createElement('div');
        newItem.className = 'podnote-menu-item relative';
        const labelText = isFolder ? "使用 PodNote 打开目录" : "使用 PodNote 编辑";

        newItem.innerHTML = `
            <div class="" title="">
                <div class="my-super-tight flex items-center justify-between px-4 py-2 relative w-full text-[12px] box-border cursor-pointer whitespace-nowrap hover:bg-[var(--semi-color-fill-0)]" style="color: var(--semi-color-text-0);">
                    <span class="flex w-full max-w-[170px] overflow-hidden text-ellipsis !max-w-[300px]">
                        <span class="inline-flex w-full flex-1 items-center gap-2">
                            <span class="truncate text-[14px] leading-xs w-full">
                                <div class="flex min-w-[150px] items-center">
                                    <svg viewBox="0 0 24 24" width="16" height="16" style="margin-right:8px;"><path fill="currentColor" d="M17.876 4c-.298 0-.583.118-.794.329l-12.01 12.01a1.002 1.002 0 00-.254.428l-.583 1.996 1.997-.582c.161-.047.309-.134.428-.253L18.67 5.917A1.123 1.123 0 0017.876 4zm-2.208-1.085a3.123 3.123 0 114.416 4.416L8.074 19.34a3 3 0 01-1.282.76l-2.872.838a1.5 1.5 0 01-1.86-1.86l.838-2.872a3 3 0 01.759-1.281l12.01-12.011zM10.999 20a1 1 0 011-1h9a1 1 0 110 2h-9a1 1 0 01-1-1z"></path></svg>
                                    <span>${labelText}</span>
                                </div>
                            </span>
                        </span>
                    </span>
                </div>
            </div>
        `;
        newItem.onclick = () => {
            handleContextMenuEdit();
            try {
                const popper = anchorRow.closest('.base-Popper-root') || menu;
                if (popper) popper.style.display = 'none';
            } catch (err) {}
        };

        anchorRow.after(newItem);
        NPLog.success("右键菜单项注入成功");
    }

    function injectToolbar(winContainer) {
        if (!isFileManagerWin(winContainer)) return;

        const existingBtn = Array.from(winContainer.querySelectorAll('button')).find(b =>
            (b.textContent.includes("新建文件") && !b.textContent.includes("文件夹")) ||
            b.classList.contains('podnote-new-file-btn')
        );

        if (existingBtn) {
            if (!existingBtn.classList.contains('podnote-new-file-btn')) {
                NPLog.info(`工具栏退避: 视图 [${getWinBreadcrumbPath(winContainer)}] 已存在新建按钮`);
            }
            return;
        }

        const buttons = Array.from(winContainer.querySelectorAll('button'));
        const newFolderBtn = buttons.find(b => b.textContent.includes("新建文件夹"));
        const uploadBtn = buttons.find(b => b.textContent.includes("上传"));

        if (newFolderBtn && uploadBtn) {
            const targetBtn = newFolderBtn;
            const btn = document.createElement('button');
            btn.className = 'podnote-new-file-btn';
            btn.style.cssText = `
                padding: 0 12px; 
                height: 28px; 
                border-radius: 6px; 
                border: 1px solid var(--semi-color-border, #dcdfe6); 
                background: transparent; 
                cursor: pointer; 
                font-size: 14px; 
                font-weight: 600;
                font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Helvetica, Arial, sans-serif;
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
                color: var(--semi-color-text-1, #41464f); 
                display: flex; 
                align-items: center; 
                gap: 4px; 
                transition: all 0.2s;
            `;
            btn.onmouseover = () => {
                btn.style.background = 'var(--semi-color-fill-0, #f5f6f7)';
                btn.querySelector('svg').style.opacity = '1';
            };
            btn.onmouseout = () => {
                btn.style.background = 'transparent';
                btn.querySelector('svg').style.opacity = '0.85';
            };

            btn.innerHTML = `
                <span style="display: flex; align-items: center; justify-content: center; pointer-events: none;">
                    <svg viewBox="0 0 24 24" width="14" height="14" style="flex-shrink: 0; opacity: 0.85; transition: opacity 0.2s;"><path fill-rule="evenodd" clip-rule="evenodd" d="M6 2a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6H6zm0 2h7v5h5v11H6V4zm7 8a1 1 0 011 1v2h2a1 1 0 110 2h-2v2a1 1 0 11-2 0v-2H9a1 1 0 110-2h2v-2a1 1 0 011-1z" fill="currentColor"></path></svg>
                    <span style="margin-left: 4px; white-space: nowrap;">新建文件</span>
                </span>
            `;
            btn.onclick = async (e) => {
                e.stopPropagation();
                let wsPath = getPathFromDOM(winContainer);
                if (!wsPath) {
                    showPodNoteAlert("不支持新建", "空文件夹内暂不支持新建文件，或未获取到路径。", winContainer);
                    return;
                }
                if (wsPath === '/') {
                    showPodNoteAlert("操作受限", "根目录不允许创建文件。", winContainer);
                    return;
                }

                const filename = await showCreateFileModal(wsPath, winContainer);
                if (!filename) return;
                const fullPath = wsPath.endsWith('/') ? wsPath + filename : wsPath + "/" + filename;

                try {
                    const resp = await fetch(CONFIG.API_NEW, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ path: fullPath })
                    });
                    const res = await resp.json();
                    if (res.error) showPodNoteAlert("创建失败", res.error, winContainer);
                    else {
                        const createdMsg = `文件已创建: ${fullPath}`;
                        NPLog.success(createdMsg);

                        const refreshed = Array.from(winContainer.querySelectorAll('button')).some(b => {
                            const p = b.querySelector('path');
                            if (p && (p.getAttribute('d') || "").includes(CONFIG.REFRESH_ICON_PATH)) {
                                b.click();
                                return true;
                            }
                            return false;
                        });
                        if (!refreshed) {
                            NPLog.warn("自动刷新失败: 未找到系统刷新按钮");
                        }
                    }
                } catch (err) {
                    showPodNoteAlert("网络错误", "无法连接到后端服务。", winContainer);
                    NPLog.error("后端连接失败：", err);
                }
            };
            targetBtn.after(btn);
            updateStatus('toolbar');
            const winPath = getWinBreadcrumbPath(winContainer);
            NPLog.success(`工具栏‘新建文件’按钮注入成功,当前视图: ${winPath}`);
        } else {
            const path = getWinBreadcrumbPath(winContainer);
            const isSystemRoot = CONFIG.ROOT_LABELS.includes(path) || path.includes('存储空间');
            if (path && !isSystemRoot) {
                NPLog.error(`工具栏‘新建文件’按钮注入失败: [${path}] 未找到定位锚点（‘新建文件夹’和‘上传’按钮）`);
            }
        }
    }

    // 增量 DOM 监听与注入触发
    let toolbarTimer = null;
    function scheduleToolbarInject() {
        if (toolbarTimer) return;
        toolbarTimer = setTimeout(() => {
            toolbarTimer = null;
            document.querySelectorAll(CONFIG.WIN_SELECTOR).forEach(winEl => {
                if (!winEl.querySelector('.podnote-new-file-btn')) {
                    injectToolbar(winEl);
                }
            });
        }, 100);
    }

    function handleMutations(mutations) {
        // 定位右键菜单
        const menuEl = document.querySelector('.base-Popper-root, [role="tooltip"]');
        if (menuEl && menuEl.offsetWidth > 0 && !menuEl.querySelector('.podnote-menu-item')) {
            if (lastActiveWin && isFileManagerWin(lastActiveWin)) {
                const matchedCount = CONFIG.MENU_KEYWORDS.filter(k => menuEl.textContent.includes(k)).length;
                if (matchedCount >= 2) {
                    const breadcrumbPath = getWinBreadcrumbPath(lastActiveWin);
                    const isRoot = CONFIG.ROOT_LABELS.includes(breadcrumbPath);
                    if (!isRoot) {
                        injectPodNoteMenuItem(menuEl);
                        updateStatus('menu');
                    } else {
                        NPLog.info("根目录，跳过右键菜单注入");
                    }
                }
            }
        }

        scheduleToolbarInject();
    }

    // 事件监听与初始化挂载
    document.addEventListener('mousedown', (e) => {
        const win = e.target.closest(CONFIG.WIN_SELECTOR);
        if (win) {
            lastActiveWin = win;
            blurPodNoteWindows();
        }
    }, true);

    document.addEventListener('contextmenu', (e) => {
        const target = e.target.closest('[data-path]') ||
            e.target.closest('tr') ||
            e.target.closest('li') ||
            e.target.closest('[title]') ||
            e.target;

        lastContextMenuTarget = target;
        
        // 锁存右键目标路径以防 DOM 离线
        lastContextMenuPath = target.getAttribute('data-path') ||
            target.closest('[data-path]')?.getAttribute('data-path') || 
            null;
            
        // 锁存窗口容器
        lastActiveWin = target.closest(CONFIG.WIN_SELECTOR) || 
            target.closest('.trim-ui__app-layout--window') || 
            null;
    }, true);

    if (window.__podnote_observer__) window.__podnote_observer__.disconnect();
    window.__podnote_observer__ = new MutationObserver(handleMutations);
    window.__podnote_observer__.observe(document.body, { childList: true, subtree: true });

    scheduleToolbarInject();
})();
