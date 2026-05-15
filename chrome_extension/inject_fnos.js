/**
 * NotePod++ FNOS文件管理 深度集成脚本
 * 
 * 去类名化 (Text-Driven)
 * 依赖于功能文本和 HTML 标准属性，而非官方频繁变动的 CSS 类名。
 */
(function() {
    'use strict';
    console.log("%c[NotePod++] FNOS文件管理 集成插件已启动", "color: #4CAF50; font-weight: bold;");

    // ==========================================
    // [1] 核心配置与选择器
    // ==========================================
    const CONFIG = {
        WIN_SELECTOR: '[role="tabpanel"]',
        APP_TITLE: '文件管理',
        ROOT_LABELS: ["我的文件", "设备全部文件", "应用文件"],
        MENU_KEYWORDS: ['打开', '重命名', '下载'],
        REFRESH_ICON_PATH: 'M12 4a8 8 0 108 8', // 刷新图标的 SVG 路径特征
        API_NEW: '/app/m-text-editor/api/new',
        EDITOR_URL: '/app/m-text-editor/?path='
    };

    let lastActiveWin = null;
    let lastContextMenuTarget = null;

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
                        console.log(`%c[NotePod++] 路径已同步: ${wsPath}`, "color: #FF9800; font-weight: bold;");
                    }
                }
            } catch (e) {}
            return WebSocket.prototype.originalSend.apply(this, arguments);
        };
    }

    // ==========================================
    // [3] 核心业务逻辑助手
    // ==========================================
    
    // 验证是否为“文件管理”窗口
    function isFileManagerWin(el) {
        if (!el) return false;
        // 向上查找最近的窗口容器
        const win = el.closest('.trim-ui__app-layout--window') || el.closest('.trim-ui__app-layout--window-shell');
        if (!win) return false;

        // 严格匹配标题栏文本
        const header = win.querySelector('.trim-ui__app-layout--header-title');
        return header && header.innerText.trim() === CONFIG.APP_TITLE;
    }

    // 动态提取地址栏最后一个层级名
    function getWinLastBreadcrumb(win) {
        const items = Array.from(win.querySelectorAll('div[title]'));
        const rootItem = items.find(el => CONFIG.ROOT_LABELS.includes(el.innerText.trim()));
        if (!rootItem) return "";

        const container = rootItem.closest('.flex-1') || rootItem.parentElement;
        const breadItems = container.querySelectorAll('div[title]');
        return breadItems.length > 0 ? breadItems[breadItems.length - 1].getAttribute('title').trim() : "";
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
            console.log('%c[NotePod++] 编辑文件:', 'color: #2196F3; font-weight: bold;', fullPath);
            showEditorWindow(fullPath);
        } else {
            console.warn("%c[NotePod++] 识别失败: 无法确定文件路径", "color: #F44336; font-weight: bold;");
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
                    <h5 style="margin: 0; font-size: 16px; font-weight: 600; color: var(--semi-color-text-0, #1c1f23);">新建文件</h5>
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
                <h5 style="margin: 0; font-size: 16px; font-weight: 600;">${title}</h5>
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
        const winId = 'notepod-editor-win';
        // 尝试读取记忆的状态
        const savedState = JSON.parse(localStorage.getItem('notepod-editor-win-state') || '{}');
        
        const container = document.createElement('div');
        container.id = winId;
        container.style.cssText = `
            position: fixed;
            top: ${savedState.top || '15%'};
            left: ${savedState.left || '15%'};
            width: ${savedState.width || '70%'};
            height: ${savedState.height || '70%'};
            background: var(--semi-color-bg-2, #ffffff);
            border-radius: 12px;
            box-shadow: 0 12px 48px rgba(0,0,0,0.25);
            z-index: 10001;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            animation: np-modalIn 0.3s cubic-bezier(0.2, 0, 0, 1);
            border: 1px solid var(--semi-color-border, #f0f0f0);
            min-width: 400px;
            min-height: 300px;
            resize: both;
        `;

        const editorUrl = `${CONFIG.EDITOR_URL}${encodeURIComponent(path)}`;

        container.innerHTML = `
            <div class="np-win-header" style="height: 40px; background: var(--semi-color-bg-1, #f5f6f7); display: flex; align-items: center; justify-content: space-between; padding: 0 12px; cursor: move; border-bottom: 1px solid var(--semi-color-border, #f0f0f0); user-select: none;">
                <div style="display: flex; align-items: center; gap: 8px; pointer-events: none;">
                    <img src="/app/m-text-editor/images/ICON.PNG" style="width: 20px; height: 20px; object-fit: contain;" />
                    <span style="font-size: 13px; font-weight: 600; color: var(--semi-color-text-0);">NotePod++</span>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
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
            </div>
            <div class="resizer" style="position: absolute; right: 0; bottom: 0; width: 15px; height: 15px; cursor: nwse-resize; background: transparent; z-index: 10;"></div>
        `;

        document.body.appendChild(container);

        // A. 功能逻辑
        const iframe = container.querySelector('iframe');
        const header = container.querySelector('.np-win-header');
        
        container.querySelector('.win-btn-external').onclick = () => {
            window.open(editorUrl, '_blank');
        };
        container.querySelector('.win-btn-close').onclick = () => {
            document.body.removeChild(container);
        };

        // B. 拖拽逻辑
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

        // 监听缩放变化
        container.addEventListener('mouseup', saveState);

        // C. 关闭逻辑
        container.querySelector('.win-btn-close').onclick = () => {
            saveState();
            document.body.removeChild(container);
        };
    }

    // ==========================================
    // [5] 注入器引擎
    // ==========================================

    function injectNotePodMenuItem(menu) {
        const firstItem = Array.from(menu.querySelectorAll('div')).find(el => el.innerText.trim() === "打开")?.closest('div');
        if (!firstItem || menu.querySelector('.notepod-menu-item')) return;

        const newItem = document.createElement('div');
        newItem.className = 'notepod-menu-item';
        newItem.innerHTML = `
            <div style="padding:8px 16px; cursor:pointer; display:flex; align-items:center; font-size:14px; color:var(--semi-color-text-0);" onmouseover="this.style.background='var(--semi-color-fill-0)'" onmouseout="this.style.background='none'">
                <svg viewBox="0 0 24 24" width="16" height="16" style="margin-right:8px;"><path fill="currentColor" d="M17.876 4c-.298 0-.583.118-.794.329l-12.01 12.01a1.002 1.002 0 00-.254.428l-.583 1.996 1.997-.582c.161-.047.309-.134.428-.253L18.67 5.917A1.123 1.123 0 0017.876 4zm-2.208-1.085a3.123 3.123 0 114.416 4.416L8.074 19.34a3 3 0 01-1.282.76l-2.872.838a1.5 1.5 0 01-1.86-1.86l.838-2.872a3 3 0 01.759-1.281l12.01-12.011zM10.999 20a1 1 0 011-1h9a1 1 0 110 2h-9a1 1 0 01-1-1z"></path></svg>
                <span>使用 NotePod++ 编辑</span>
            </div>
        `;
        newItem.onclick = (e) => { e.stopPropagation(); handleContextMenuEdit(); };
        firstItem.after(newItem);
    }

    function inject() {
        // A. 右键菜单注入
        const divs = document.querySelectorAll('div');
        for (let menu of divs) {
            // 检查是否为右键菜单容器，且其触发源属于文件管理
            if (menu.offsetWidth > 0 && menu.innerText.includes('打开') && (menu.innerText.includes('重命名') || menu.innerText.includes('下载'))) {
                // 如果能找到触发菜单的原始目标，且该目标属于文件管理，则注入
                if (lastContextMenuTarget && isFileManagerWin(lastContextMenuTarget)) {
                    injectNotePodMenuItem(menu);
                }
                break; 
            }
        }

        // B. 工具栏“新建文件”注入
        const buttons = document.querySelectorAll('button');
        buttons.forEach(targetBtn => {
            const btnText = targetBtn.innerText;
            if (btnText.includes("新建文件夹") || btnText.includes("上传文件夹")) {
                const winContainer = targetBtn.closest(CONFIG.WIN_SELECTOR);
                if (!winContainer || !isFileManagerWin(winContainer)) return;

                const hasNewFileBtn = Array.from(winContainer.querySelectorAll('button')).some(b => b.innerText.includes("新建文件") && !b.innerText.includes("文件夹"));
                if (hasNewFileBtn) return;

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
                    btn.querySelector('svg').style.opacity = '0.62';
                };
                
                btn.innerHTML = `
                    <span style="display: flex; align-items: center; justify-content: center; pointer-events: none;">
                        <svg viewBox="0 0 24 24" width="14" height="14" style="flex-shrink: 0; opacity: 0.62; transition: opacity 0.2s;"><path fill-rule="evenodd" clip-rule="evenodd" d="M6 2a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6H6zm0 2h7v5h5v11H6V4zm7 8a1 1 0 011 1v2h2a1 1 0 110 2h-2v2a1 1 0 11-2 0v-2H9a1 1 0 110-2h2v-2a1 1 0 011-1z" fill="currentColor"></path></svg>
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
                            console.log(`%c[NotePod++] 文件已创建: ${fullPath}`, "color: #4CAF50; font-weight: bold;");
                            // 触发页面刷新按钮
                            const refreshed = Array.from(winContainer.querySelectorAll('button')).some(b => {
                                const p = b.querySelector('path');
                                if (p && (p.getAttribute('d') || "").includes(CONFIG.REFRESH_ICON_PATH)) {
                                    b.click(); 
                                    return true;
                                }
                                
                                return false;
                            });
                            if (!refreshed) console.warn("[NotePod++] 自动刷新失败: 未找到刷新按钮特征");
                        }
                    } catch (err) { showNotePodAlert("网络错误", "无法连接到后端服务。", winContainer); }
                };
                targetBtn.after(btn);
            }
        });
    }

    // ==========================================
    // [6] 事件与观察者
    // ==========================================

    document.addEventListener('mousedown', (e) => {
        const win = e.target.closest(CONFIG.WIN_SELECTOR);
        if (win) lastActiveWin = win;
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
