(function() {
    'use strict';

    /**
     * NotePod++ FNOS文件管理 深度集成脚本
     * 
     * 去类名化 (Text-Driven)
     * 依赖于功能文本和 HTML 标准属性，而非官方频繁变动的 CSS 类名。
     */
    // ==========================================
    // [0] 工具函数与日志管理
    // ==========================================
    document.documentElement.dataset.notepodStatus = 'active';

    function logToExtension(msg, type = 'info') {
        const html = document.documentElement;
        let logs = [];
        try { logs = JSON.parse(html.dataset.notepodLogs || "[]"); } catch (e) { }
        logs.push({ t: new Date().toLocaleTimeString(), m: msg, s: type });
        if (logs.length > 50) logs.shift();
        html.dataset.notepodLogs = JSON.stringify(logs);
    }

    const NPLog = {
        success: (msg) => {
            console.log(`%c[NotePod++] ${msg}`, "color: #4CAF50; font-weight: bold;");
            logToExtension(msg, "success");
        },
        info: (msg) => {
            console.log(`%c[NotePod++] ${msg}`, "color: #2196F3;");
            logToExtension(msg, "info");
        },
        warn: (msg) => {
            console.warn(`%c[NotePod++] ${msg}`, "color: #FF9800; font-weight: bold;");
            logToExtension(msg, "error");
        },
        error: (msg) => {
            console.error(`%c[NotePod++] ${msg}`, "color: #FF5722; font-weight: bold;");
            logToExtension(msg, "error");
        },
        sync: (msg) => {
            console.log(`%c[NotePod++] ${msg}`, "color: #FF9800; font-weight: bold;");
            logToExtension(msg, "sync");
        }
    };

    NPLog.success("FNOS 集成插件已启动");

    function updateStatus(feature) {
        const html = document.documentElement;
        html.dataset.notepodStatus = 'injected';
        const features = new Set((html.dataset.notepodFeatures || "").split(',').filter(f => f));
        features.add(feature);
        html.dataset.notepodFeatures = Array.from(features).join(',');
    }


    // ==========================================
    // [1] 核心配置与选择器
    // ==========================================
    const CONFIG = {
        WIN_SELECTOR: '[role="tabpanel"]',
        APP_TITLE: '文件管理',
        ROOT_LABELS: ["我的文件", "设备全部文件", "应用文件"],
        MENU_KEYWORDS: ['打开', '打开方式', '重命名', '详细信息', '下载', '压缩', '剪切'],
        REFRESH_ICON_PATH: 'M12 4a8 8 0 108 8', // 刷新图标的 SVG 路径特征
        API_NEW: '/app/m-text-editor/api/new',
        EDITOR_URL: '/app/m-text-editor/?path='
    };

    let lastActiveWin = null;
    let lastContextMenuTarget = null;

    window.__NP_WINS__ = window.__NP_WINS__ || {};
    window.__NP_MAX_Z__ = window.__NP_MAX_Z__ || 10001;

    // ==========================================
    // [2] WebSocket 网络拦截器
    // ==========================================
    const OriginalWS = window.WebSocket;
    window.WebSocket = function(url, protocols) {
        const ws = new OriginalWS(url, protocols);
        if (typeof url === 'string' && url.includes('type=file')) {
            ws.__is_file_ws = true;
        }
        return ws;
    };
    window.WebSocket.prototype = OriginalWS.prototype;

    if (!WebSocket.prototype.originalSend) {
        WebSocket.prototype.originalSend = WebSocket.prototype.send;
        WebSocket.prototype.send = function(data) {
            try {
                const strData = typeof data === 'string' ? data : new TextDecoder().decode(data);
                const jsonStr = strData.includes('=') ? strData.split('=')[1] : strData;
                const msg = JSON.parse(jsonStr);
                
                if (msg.req === "file.ls") {
                    const wsPath = msg.path || "/";
                    const wsLastPart = wsPath === "/" ? "我的文件" : wsPath.split('/').pop();
                    
                    const wins = document.querySelectorAll(CONFIG.WIN_SELECTOR);
                    let matchedWin = null;
                    for (let win of wins) {
                        const domLastPart = getWinLastBreadcrumb(win);
                        if (domLastPart === wsLastPart || (wsPath === "/" && domLastPart === "我的文件")) {
                            matchedWin = win;
                            break;
                        }
                    }

                    const target = matchedWin || lastActiveWin || wins[wins.length - 1];
                    if (target) {
                        target.__notepod_path = wsPath;
                        NPLog.sync(`路径已同步: ${wsPath}`);
                    }
                }
            } catch (e) {}
            return WebSocket.prototype.originalSend.apply(this, arguments);
        };
    }

    // ==========================================
    // [3] 核心业务逻辑助手
    // ==========================================
    
    function isFileManagerWin(el) {
        if (!el) return false;
        
        // 1. 寻找窗口容器并验证精确标题
        const win = el.closest('.trim-ui__app-layout--window');
        if (!win) return false;

        const header = win.querySelector('.trim-ui__app-layout--header-title');
        const isTitleMatch = header && header.innerText.trim() === CONFIG.APP_TITLE;
        if (!isTitleMatch) return false;

        // 2. 验证路径特征
        return getWinLastBreadcrumb(win) !== "";
    }

    // 获取完整的面包屑层级路径
    function getWinBreadcrumbPath(win) {
        const items = Array.from(win.querySelectorAll('div[title]'));
        // 1. 寻找根起点
        const rootItem = items.find(el => CONFIG.ROOT_LABELS.includes(el.innerText.trim()));
        if (!rootItem) return "";

        // 2. 锁定地址栏容器
        const addressBar = rootItem.closest('.flex-1') || rootItem.parentElement;

        // 3. 仅在地址栏范围内提取路径
        return Array.from(addressBar.querySelectorAll('div[title]'))
            .map(el => el.getAttribute('title').trim())
            .filter(t => t)
            .join('/');
    }

    // 动态提取地址栏最后一个层级名 (用于 WebSocket 匹配)
    function getWinLastBreadcrumb(win) {
        const fullPath = getWinBreadcrumbPath(win);
        if (!fullPath) return "";
        const parts = fullPath.split('/');
        return parts[parts.length - 1];
    }

    // 处理右键菜单的编辑操作
    function handleContextMenuEdit() {
        if (!lastContextMenuTarget) return;
        
        const titleEl = lastContextMenuTarget.querySelector('[title]');
        const filename = titleEl ? titleEl.getAttribute('title') : null;
        const winContainer = lastContextMenuTarget.closest(CONFIG.WIN_SELECTOR);
        const wsPath = winContainer ? winContainer.__notepod_path : null;

        if (wsPath && filename) {
            const fullPath = wsPath.endsWith('/') ? wsPath + filename : wsPath + "/" + filename;
            NPLog.info(`准备编辑文件: ${fullPath}`);
            showEditorWindow(fullPath);
        } else {
            NPLog.error("文件识别失败: 无法确定完整路径");
        }
    }

    // ==========================================
    // [4] UI 组件工厂
    // ==========================================

    function createBackdrop() {
        const backdrop = document.createElement('div');
        backdrop.className = 'notepod-backdrop';
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
                    <h5 style="margin: 0; font-size: 16px; font-weight: 600; color: var(--semi-color-text-0, #1c1f23);">新建文件 - NotePod++</h5>
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

    function showNotePodAlert(title, content, container) {
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
                <h5 style="margin: 0; font-size: 16px; font-weight: 600;">${title} - NotePod++</h5>
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
        const winId = `notepod-win-${pathHash}`;
        
        // 检查是否已打开
        if (window.__NP_WINS__[path]) {
            const existingWin = document.getElementById(winId);
            if (existingWin) {
                focusNotePodWindow(existingWin);
                NPLog.info(`窗口置顶: ${path}`);
                existingWin.style.outline = "2px solid var(--semi-color-primary)";
                setTimeout(() => existingWin.style.outline = "none", 500);
                return;
            }
        }

        // 尝试读取上次关闭时的位置状态（如果是同类窗口）
        const savedState = JSON.parse(localStorage.getItem('notepod-editor-win-state') || '{}');
        
        const container = document.createElement('div');
        container.id = winId;
        container.className = 'notepod-window-instance';
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
            min-width: 400px;
            min-height: 300px;
            resize: both;
            transition: box-shadow 0.2s, opacity 0.2s, z-index 0.1s;
        `;

        const editorUrl = `${CONFIG.EDITOR_URL}${encodeURIComponent(path)}`;

        container.innerHTML = `
            <div class="np-win-header" style="height: 40px; background: var(--semi-color-bg-1, #f5f6f7); display: flex; align-items: center; justify-content: space-between; padding: 0 12px; cursor: move; border-bottom: 1px solid var(--semi-color-border, #f0f0f0); user-select: none;">
                <div style="display: flex; align-items: center; gap: 8px; pointer-events: none; overflow: hidden; flex: 1;">
                    <img src="/app/m-text-editor/images/ICON.PNG" style="width: 20px; height: 20px; object-fit: contain;" />
                    <span style="font-size: 13px; font-weight: 600; color: var(--semi-color-text-0); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">NotePod++</span>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <button class="win-btn-ghost" title="开启/关闭幽灵模式" style="background: none; border: none; cursor: pointer; color: var(--semi-color-text-2); display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 6px; transition: all 0.2s; pointer-events: auto;" onmouseover="this.style.background='var(--semi-color-fill-0)'" onmouseout="this.style.background='none'">
                        <svg class="eye-open" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                        <svg class="eye-close" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" style="display:none;"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                    </button>
                    <button class="win-btn-external" title="在新标签页打开" style="background: none; border: none; cursor: pointer; color: var(--semi-color-text-2); display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 6px; transition: all 0.2s;" onmouseover="this.style.background='var(--semi-color-fill-0)'" onmouseout="this.style.background='none'">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none"><path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" fill="currentColor"></path></svg>
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
            <div class="resizer" style="position: absolute; right: 0; bottom: 0; width: 15px; height: 15px; cursor: nwse-resize; background: transparent; z-index: 10;"></div>
        `;

        document.body.appendChild(container);
        window.__NP_WINS__[path] = container;
        focusNotePodWindow(container);
        NPLog.info(`编辑器启动: ${path}`);

        // A. 功能逻辑
        const iframe = container.querySelector('iframe');
        const header = container.querySelector('.np-win-header');
        const ghostBtn = container.querySelector('.win-btn-ghost');
        
        ghostBtn.onclick = (e) => {
            e.stopPropagation();
            const isGhost = container.getAttribute('data-ghost') === 'true';
            setGhostMode(container, !isGhost);
            if (isGhost) focusNotePodWindow(container);
        };

        container.querySelector('.win-btn-external').onclick = () => {
            window.open(editorUrl, '_blank');
        };

        // B. 置顶逻辑
        container.addEventListener('mousedown', (e) => {
            // 如果是幽灵模式，不处理置顶
            if (container.getAttribute('data-ghost') === 'true') return;
            focusNotePodWindow(container);
        });

        // C. 拖拽逻辑
        let isDragging = false, startX, startY, initialX, initialY;
        header.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            initialX = container.offsetLeft;
            initialY = container.offsetTop;
            iframe.style.pointerEvents = 'none';
            header.style.cursor = 'grabbing';
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            container.style.left = initialX + dx + 'px';
            container.style.top = initialY + dy + 'px';
            container.style.right = 'auto';
            container.style.bottom = 'auto';
        });

        const saveState = () => {
            localStorage.setItem('notepod-editor-win-state', JSON.stringify({
                top: container.style.top,
                left: container.style.left,
                width: container.style.width,
                height: container.style.height
            }));
        };

        window.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                iframe.style.pointerEvents = 'auto';
                header.style.cursor = 'move';
                saveState();
            }
        });

        container.addEventListener('mouseup', saveState);

        // D. 关闭逻辑
        container.querySelector('.win-btn-close').onclick = () => {
            saveState();
            delete window.__NP_WINS__[path];
            document.body.removeChild(container);
        };
    }

    // 窗口聚焦逻辑
    function focusNotePodWindow(el) {
        window.__NP_MAX_Z__++;
        el.style.zIndex = window.__NP_MAX_Z__;
        el.style.boxShadow = "0 12px 64px rgba(0,0,0,0.4)";
        el.style.opacity = "1";
        el.style.pointerEvents = 'auto'; // 恢复点击
        el.setAttribute('data-ghost', 'false');
        
        // 切换图标
        const openEye = el.querySelector('.eye-open');
        const closeEye = el.querySelector('.eye-close');
        if (openEye) openEye.style.display = 'block';
        if (closeEye) closeEye.style.display = 'none';

        // 隐藏当前窗口的遮罩
        const shim = el.querySelector('.np-iframe-shim');
        if (shim) shim.style.display = 'none';
        
        // 标记为活跃，并弱化其他窗口
        document.querySelectorAll('.notepod-window-instance').forEach(win => {
            if (win !== el) {
                // 如果其他窗口没开启幽灵模式，则仅弱化
                if (win.getAttribute('data-ghost') !== 'true') {
                    win.style.boxShadow = "0 4px 16px rgba(0,0,0,0.15)";
                    win.style.opacity = "0.98";
                    const otherShim = win.querySelector('.np-iframe-shim');
                    if (otherShim) otherShim.style.display = 'block';
                }
            }
        });
    }

    // 切换幽灵模式状态
    function setGhostMode(el, isGhost) {
        const shim = el.querySelector('.np-iframe-shim');
        const ghostBtn = el.querySelector('.win-btn-ghost');
        const iframe = el.querySelector('iframe');
        const resizer = el.querySelector('.resizer');
        
        if (isGhost) {
            el.style.opacity = "0.3";
            el.style.pointerEvents = 'none'; // 容器穿透
            el.style.boxShadow = "none";
            el.setAttribute('data-ghost', 'true');
            if (el.querySelector('.eye-open')) el.querySelector('.eye-open').style.display = 'none';
            if (el.querySelector('.eye-close')) el.querySelector('.eye-close').style.display = 'block';
            
            // 限制只有按钮可以交互
            if (ghostBtn) {
                ghostBtn.style.pointerEvents = 'auto';
                ghostBtn.style.color = 'var(--semi-color-primary)';
            }
            if (iframe) iframe.style.pointerEvents = 'none'; // 强制内容穿透
            if (resizer) resizer.style.display = 'none';
            
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
            if (resizer) resizer.style.display = 'block';
            focusNotePodWindow(el);
        }
    }

    // 弱化所有 NotePod 窗口并开启幽灵模式 (当点击系统原生区域时)
    function blurNotePodWindows() {
        Object.values(window.__NP_WINS__).forEach(win => {
            setGhostMode(win, true);
        });
    }


    // ==========================================
    // [5] 注入器引擎
    // ==========================================

    function injectNotePodMenuItem(menu) {
        const firstItem = Array.from(menu.querySelectorAll('div')).find(el => el.innerText.trim() === "打开方式")?.closest('div');
        if (!firstItem) {
            NPLog.error("右键菜单注入失败: 未找到‘打开方式’锚点项");
            return;
        }
        if (menu.querySelector('.notepod-menu-item')) return;

        const newItem = document.createElement('div');
        newItem.className = 'notepod-menu-item';
        newItem.innerHTML = `
            <div style="padding:8px 16px; cursor:pointer; display:flex; align-items:center; font-size:14px; color:var(--semi-color-text-0);" onmouseover="this.style.background='var(--semi-color-fill-0)'" onmouseout="this.style.background='none'">
                <svg viewBox="0 0 24 24" width="16" height="16" style="margin-right:8px;"><path fill="currentColor" d="M17.876 4c-.298 0-.583.118-.794.329l-12.01 12.01a1.002 1.002 0 00-.254.428l-.583 1.996 1.997-.582c.161-.047.309-.134.428-.253L18.67 5.917A1.123 1.123 0 0017.876 4zm-2.208-1.085a3.123 3.123 0 114.416 4.416L8.074 19.34a3 3 0 01-1.282.76l-2.872.838a1.5 1.5 0 01-1.86-1.86l.838-2.872a3 3 0 01.759-1.281l12.01-12.011zM10.999 20a1 1 0 011-1h9a1 1 0 110 2h-9a1 1 0 01-1-1z"></path></svg>
                <span>使用 NotePod++ 编辑</span>
            </div>
        `;
        newItem.onclick = (e) => { e.stopPropagation(); handleContextMenuEdit(); };
        firstItem.before(newItem);
        NPLog.success("右键菜单项注入成功");
    }

    function inject() {
        // A. 右键菜单注入
        const divs = document.querySelectorAll('div');
        for (let menu of divs) {
            // 严格识别右键菜单容器：可见、且包含 CONFIG 中定义的所有强制指纹关键字
            const text = menu.innerText;
            const isPotentialMenu = menu.offsetWidth > 0 && 
                                   CONFIG.MENU_KEYWORDS.every(k => text.includes(k));

            if (isPotentialMenu) {
                // 确保该菜单是由文件管理窗口触发的
                if (lastContextMenuTarget && isFileManagerWin(lastContextMenuTarget)) {
                    injectNotePodMenuItem(menu);
                    updateStatus('menu');
                }
                break; 
            }
        }

        // B. 工具栏“新建文件”注入 (按窗口遍历)
        document.querySelectorAll(CONFIG.WIN_SELECTOR).forEach(winContainer => {
            if (!isFileManagerWin(winContainer)) return;
            
            // 检查是否已注入 (包括 NotePod 自身或其他工具)
            const existingBtn = Array.from(winContainer.querySelectorAll('button')).find(b => 
                (b.innerText.includes("新建文件") && !b.innerText.includes("文件夹")) || 
                b.classList.contains('notepod-new-file-btn')
            );

            if (existingBtn) {
                // 如果是第三方工具注入的按钮，记录退避日志
                if (!existingBtn.classList.contains('notepod-new-file-btn')) {
                    NPLog.info(`工具栏退避: 视图 [${getWinBreadcrumbPath(winContainer)}] 已存在新建按钮`);
                }
                return;
            }

            // 在当前窗口内寻找锚点
            const buttons = Array.from(winContainer.querySelectorAll('button'));
            const newFolderBtn = buttons.find(b => b.innerText.includes("新建文件夹"));
            const uploadBtn = buttons.find(b => b.innerText.includes("上传"));

            if (newFolderBtn && uploadBtn) {
                const targetBtn = newFolderBtn;
                const btn = document.createElement('button');
                btn.className = 'notepod-new-file-btn';
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
                    let wsPath = winContainer.__notepod_path;
                    const domLastPart = getWinLastBreadcrumb(winContainer);
                    const wsLastPart = wsPath === "/" ? "我的文件" : (wsPath ? wsPath.split('/').pop() : "");
                    
                    const isMatch = (wsPath === "/" && domLastPart === "我的文件") || (wsLastPart === domLastPart);
                    if (!isMatch || !wsPath) {
                        showNotePodAlert("识别延迟", "路径同步中，请稍微等待或刷新页面。", winContainer);
                        return;
                    }
                    if (wsPath === '/') { 
                        showNotePodAlert("操作受限", "根目录不允许创建文件。", winContainer); 
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
                        if (res.error) showNotePodAlert("创建失败", res.error, winContainer);
                        else {
                            const createdMsg = `文件已创建: ${fullPath}`;
                            NPLog.success(createdMsg);
                            
                            // 触发页面刷新按钮
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
                        showNotePodAlert("网络错误", "无法连接到后端服务。", winContainer); 
                        NPLog.error("后端连接失败：",err);
                    }
                };
                targetBtn.after(btn);
                updateStatus('toolbar');
                const winPath = getWinBreadcrumbPath(winContainer);
                NPLog.success(`工具栏‘新建文件’按钮注入成功,当前视图: ${winPath}`);
            } else {
                const path = getWinBreadcrumbPath(winContainer);
                // 排除没有工具栏的系统根路径（如“存储空间1”或根标签）
                const isSystemRoot = CONFIG.ROOT_LABELS.includes(path) || path.includes('存储空间');
                if (path && !isSystemRoot) {
                    NPLog.error(`工具栏‘新建文件’按钮注入失败: [${path}] 未找到定位锚点（‘新建文件夹’和‘上传’按钮）`);
                }
            }
        });
    }

    // ==========================================
    // [6] 事件与观察者
    // ==========================================

    document.addEventListener('mousedown', (e) => {
        const win = e.target.closest(CONFIG.WIN_SELECTOR);
        if (win) {
            lastActiveWin = win;
            // 仅点击系统窗口时，弱化 NotePod 窗口
            blurNotePodWindows();
        }
    }, true);

    document.addEventListener('contextmenu', (e) => {
        lastContextMenuTarget = e.target.closest('[data-path]') || e.target.closest('tr') || e.target.closest('li');
    }, true);

    if (window.__notepod_observer__) window.__notepod_observer__.disconnect();
    window.__notepod_observer__ = new MutationObserver(inject);
    window.__notepod_observer__.observe(document.body, { childList: true, subtree: true });
    
    // 首次执行
    inject();
})();