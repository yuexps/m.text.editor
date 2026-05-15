/**
 * NotePod++ FNOS文件管理 注入脚本
 */
(function() {
    console.log("%c[NotePod++] FNOS文件管理 注入插件启动", "color: #4CAF50; font-weight: bold;");

    const WIN_SELECTOR = '.trim-os__app-layout--files-container';
    let lastActiveWin = null;

    const OriginalWS = window.WebSocket;
    window.WebSocket = function(url, protocols) {
        const ws = new OriginalWS(url, protocols);
        if (typeof url === 'string' && url.includes('type=file')) {
            ws.__is_file_ws = true;
        }
        return ws;
    };
    window.WebSocket.prototype = OriginalWS.prototype;

    document.addEventListener('mousedown', (e) => {
        const win = e.target.closest(WIN_SELECTOR);
        if (win) lastActiveWin = win;
    }, true);

    // 获取某个窗口当前的 DOM 地址栏文字（最后一个层级）
    function getWinLastBreadcrumb(win) {
        const breadcrumbBox = win.querySelector('.rounded-md.border.border-border');
        const breadItems = breadcrumbBox ? breadcrumbBox.querySelectorAll('div[title]') : [];
        if (breadItems.length === 0) return "";
        return breadItems[breadItems.length - 1].getAttribute('title').trim();
    }

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
                    
                    // 寻找匹配的窗口
                    let target = lastActiveWin;
                    const wins = document.querySelectorAll(WIN_SELECTOR);
                    
                    // 双路校验：如果当前活跃窗口不匹配，或者没有活跃窗口，则遍历所有窗口进行特征比对
                    let matchedWin = null;
                    for (let win of wins) {
                        const domLastPart = getWinLastBreadcrumb(win);
                        // 校验逻辑：物理路径末端与 DOM 地址栏末端一致，或者都是根目录
                        if (domLastPart === wsLastPart || (wsPath === "/" && domLastPart === "我的文件")) {
                            matchedWin = win;
                            break;
                        }
                    }

                    target = matchedWin || target || wins[wins.length - 1];

                    if (target) {
                        target.__notepod_path = wsPath;
                        console.log(`%c[NotePod++] 路径已通过特征比对绑定: ${wsPath}`, "color: #FF9800; font-weight: bold;");
                    }
                }
            } catch (e) {}
            return WebSocket.prototype.originalSend.apply(this, arguments);
        };
    }

    function createBackdrop() {
        const backdrop = document.createElement('div');
        backdrop.style.cssText = "position:absolute;inset:0;background:var(--semi-color-overlay-bg, rgba(0,0,0,0.4));z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(2px);border-radius:inherit;";
        return backdrop;
    }

    function showCreateFileModal(path, container) {
        return new Promise((resolve) => {
            const backdrop = createBackdrop();
            const modal = document.createElement('div');
            modal.role = "dialog";
            modal.className = "semi-modal-content undefined";
            modal.style.cssText = "width: 448px; height: 260px; background-color: var(--semi-color-bg-2); border: 1px solid var(--semi-color-border-modal); border-radius: var(--semi-border-radius-large); box-shadow: var(--semi-shadow-elevated); font-family: var(--font-family-regular); display: flex; flex-direction: column; overflow: hidden; animation: semi-modal-zoomIn 0.1s ease-out;";

            modal.innerHTML = `
                <div class="semi-modal-header">
                    <h5 class="semi-typography semi-modal-title semi-typography-primary semi-typography-normal semi-typography-h5"><span class="semi-modal-confirm-title-text">新建文件</span></h5>
                    <button id="notepod-x" aria-label="close" class="semi-button semi-button-tertiary semi-button-size-small semi-button-borderless semi-modal-close" type="button" style="background:none; border:none; cursor:pointer; color:var(--semi-color-text-2); position:absolute; right:16px; top:16px;"><span class="semi-button-content"><span role="img" class="semi-icon semi-icon-default semi-icon-close"><svg viewBox="0 0 24 24" fill="none" width="1em" height="1em"><path d="M17.66 19.78a1.5 1.5 0 0 0 2.12-2.12L14.12 12l5.66-5.66a1.5 1.5 0 0 0-2.12-2.12L12 9.88 6.34 4.22a1.5 1.5 0 1 0-2.12 2.12L9.88 12l-5.66 5.66a1.5 1.5 0 0 0 2.12 2.12L12 14.12l5.66 5.66Z" fill="currentColor"></path></svg></span></span></button>
                </div>
                <div class="semi-modal-body" id="semi-modal-body">
                    <div class="semi-modal-confirm-content">
                        <div class="w-full">
                            <div class="w-full" style="height: calc(100% - 80px);">
                                <div class="ms-container size-full -mr-3.5 pr-3.5" style="overflow: auto;">
                                    <div class="ms-track-box ms-theme-light"></div>
                                    <div class="semi-space w-full semi-space-align-start semi-space-vertical" style="gap: 12px; display:flex; flex-direction:column;">
                                        <div class="flex w-full flex-col gap-2">
                                            <p class="semi-typography"><strong>文件名 <span style="color:var(--semi-color-danger)">*</span></strong></p>
                                            <div id="notepod-in-wrap" class="semi-input-wrapper semi-input-wrapper-default">
                                                <input id="notepod-in" class="semi-input semi-input-default" type="text" value="" placeholder="请输入文件名" style="width:100%; border:none; background:none; outline:none;">
                                            </div>
                                            <p style="font-size:12px; color:var(--semi-color-text-2); margin-top:4px;">位置: ${path}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <footer class="mt-5 box-border flex w-full items-center justify-end gap-3 !my-6">
                                <button id="notepod-can" class="semi-button semi-button-tertiary semi-button-outline min-w-[88px]" type="button"><span class="semi-button-content">取消</span></button>
                                <button id="notepod-ok" class="semi-button semi-button-primary min-w-[88px]" type="button"><span class="semi-button-content">确定</span></button>
                            </footer>
                        </div>
                    </div>
                </div>
                <style> @keyframes semi-modal-zoomIn { from { opacity:0; transform:scale(0.98); } to { opacity:1; transform:scale(1); } } </style>
            `;

            container.appendChild(backdrop);
            backdrop.appendChild(modal);
            const input = modal.querySelector('#notepod-in');
            const wrap = modal.querySelector('#notepod-in-wrap');
            input.focus();
            const finish = (val) => { 
                if (val !== null && !val.trim()) { wrap.style.border = "1px solid var(--semi-color-danger)"; return; }
                container.removeChild(backdrop); 
                resolve(val); 
            };
            modal.querySelector('#notepod-ok').onclick = () => finish(input.value);
            modal.querySelector('#notepod-can').onclick = () => finish(null);
            modal.querySelector('#notepod-x').onclick = () => finish(null);
            backdrop.onclick = (e) => { if(e.target === backdrop) finish(null); };
            input.onkeydown = (e) => {
                if (e.key === 'Enter') finish(input.value);
                if (e.key === 'Escape') finish(null);
                wrap.style.border = "none";
            };
        });
    }

    function showNotePodAlert(title, content, container) {
        return new Promise((resolve) => {
            const backdrop = createBackdrop();
            const modal = document.createElement('div');
            modal.role = "dialog";
            modal.className = "semi-modal-content undefined";
            modal.style.cssText = "width: 448px; height: 220px; background-color: var(--semi-color-bg-2); border: 1px solid var(--semi-color-border-modal); border-radius: var(--semi-border-radius-large); box-shadow: var(--semi-shadow-elevated); font-family: var(--font-family-regular); display: flex; flex-direction: column; overflow: hidden; animation: semi-modal-zoomIn 0.1s ease-out;";

            modal.innerHTML = `
                <div class="semi-modal-header">
                    <h5 class="semi-typography semi-modal-title semi-typography-primary semi-typography-normal semi-typography-h5"><span class="semi-modal-confirm-title-text">${title}</span></h5>
                    <button id="alert-close-x" class="semi-button semi-button-tertiary semi-button-size-small semi-button-borderless semi-modal-close" type="button" style="background:none; border:none; cursor:pointer; color:var(--semi-color-text-2); position:absolute; right:16px; top:16px;"><span class="semi-button-content"><span role="img" class="semi-icon semi-icon-default semi-icon-close"><svg viewBox="0 0 24 24" fill="none" width="1em" height="1em"><path d="M17.66 19.78a1.5 1.5 0 0 0 2.12-2.12L14.12 12l5.66-5.66a1.5 1.5 0 0 0-2.12-2.12L12 9.88 6.34 4.22a1.5 1.5 0 1 0-2.12 2.12L9.88 12l-5.66 5.66a1.5 1.5 0 0 0 2.12 2.12L12 14.12l5.66 5.66Z" fill="currentColor"></path></svg></span></span></button>
                </div>
                <div class="semi-modal-body" style="flex: 1; overflow: auto; padding: 0 24px;">
                    <div class="semi-modal-confirm-content" style="padding: 16px 0;">${content}</div>
                </div>
                <div class="semi-modal-footer"><div style="display:flex; justify-content:flex-end; padding: 0 24px 6px;"><button id="alert-ok" class="semi-button semi-button-primary min-w-[88px]" type="button"><span class="semi-button-content">知道了</span></button></div></div>
            `;
            const target = container || document.body;
            target.appendChild(backdrop);
            backdrop.appendChild(modal);
            const close = () => { target.removeChild(backdrop); resolve(); };
            modal.querySelector('#alert-ok').onclick = close;
            modal.querySelector('#alert-close-x').onclick = close;
            backdrop.onclick = (e) => { if(e.target === backdrop) close(); };
        });
    }

    function inject() {
        const spans = document.querySelectorAll('span.semi-button-content-right');
        spans.forEach(span => {
            if (span.innerText === "新建文件夹" || span.innerText === "上传文件夹") {
                const targetBtn = span.closest('button');
                const bar = targetBtn ? targetBtn.parentElement : null;
                const winContainer = span.closest(WIN_SELECTOR);
                if (bar && winContainer && !bar.querySelector('.notepod-new-file-btn')) {
                    const btn = document.createElement('button');
                    btn.className = 'notepod-new-file-btn semi-button semi-button-tertiary semi-button-size-small semi-button-outline semi-button-with-icon';
                    btn.innerHTML = `<span class="semi-button-content"><svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg><span class="semi-button-content-right">新建文件</span></span>`;
                    btn.onclick = async (e) => {
                        e.stopPropagation();
                        
                        let wsPath = winContainer.__notepod_path;
                        const domLastPart = getWinLastBreadcrumb(winContainer);
                        const wsLastPart = wsPath === "/" ? "我的文件" : (wsPath ? wsPath.split('/').pop() : "");

                        // 1. 如果物理路径还没抓到，但 DOM 显示“我的文件”，判定为根目录
                        if (!wsPath && domLastPart === "我的文件") wsPath = "/";
                        
                        // 2. 路径对碰校验：确保 DOM 看到的层级和我们内存里的物理路径是一致的
                        const isMatch = (wsPath === "/" && domLastPart === "我的文件") || (wsLastPart === domLastPart);
                        
                        console.log("%c[NotePod++] 当前窗口路径校验:", "color: #2196F3; font-weight: bold;");
                        console.log("WebSocket 路径:", wsPath);
                        console.log("DOM 当前位置:", domLastPart);
                        console.log("校验结果:", isMatch ? "通过 " : "未通过");

                        if (!isMatch || !wsPath) {
                            showNotePodAlert("操作受限", "路径同步中或识别不匹配，请尝试刷新页面或重新进入文件夹。", winContainer);
                            return;
                        }

                        if (wsPath === '/') { 
                            showNotePodAlert("操作受限", "根目录不允许创建文件，请进入具体文件夹后再操作。", winContainer); 
                            return; 
                        }

                        const filename = await showCreateFileModal(wsPath, winContainer);
                        if (!filename) return;
                        const fullPath = wsPath.endsWith('/') ? wsPath + filename : wsPath + "/" + filename;
                        try {
                            const resp = await fetch('/app/m-text-editor/api/new', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ path: fullPath })
                            });
                            const res = await resp.json();
                            if (res.error) showNotePodAlert("创建失败", res.error, winContainer);
                            else {
                                console.log(`%c[NotePod++] 文件创建成功: ${fullPath}`, "color: #4CAF50; font-weight: bold;");
                                // 通过精确的 SVG 路径特征定位无文本标识的按钮
                                let refreshed = false;
                                const potentialBtns = winContainer.querySelectorAll('button, [role="button"], .semi-button');
                                for (let btn of potentialBtns) {
                                    const p = btn.querySelector('path');
                                    if (p) {
                                        const d = p.getAttribute('d') || "";
                                        // 匹配刷新图标路径特征
                                        if (d.includes('M12 4a8 8 0 108 8') && d.includes('7.433 3.02')) {
                                            btn.click();
                                            refreshed = true;
                                            console.log("%c[NotePod++] 已通过图标路径特征成功触发刷新", "color: #4CAF50; font-weight: bold;");
                                            break;
                                        }
                                    }
                                }
                                if (!refreshed) {
                                    console.warn("%c[NotePod++] 未能通过图标特征找到刷新按钮", "color: #F44336; font-weight: bold;");
                                }
                            }
                        } catch (err) { showNotePodAlert("网络错误", "服务连接失败。", winContainer); }
                    };
                    targetBtn.parentNode.insertBefore(btn, targetBtn.nextSibling);
                }
            }
        });
    }

    if (window.__notepod_observer__) window.__notepod_observer__.disconnect();
    window.__notepod_observer__ = new MutationObserver(inject);
    window.__notepod_observer__.observe(document.body, { childList: true, subtree: true });
    inject();
})();
