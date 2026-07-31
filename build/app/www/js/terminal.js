/**
 * terminal.js - XTerm 终端实例管理与心跳连接协议
 */
import { Log, createDisposableStore, checkIsMobile } from './utils.js';
import { SettingsManager } from './settings.js';
import { eventBus } from './event_bus.js';
import { els, showToast } from './ui.js';
import { AppContext } from './context.js';

let terminalInstance = null;
let terminalFitAddon = null;
let terminalSocket = null;
let terminalPingInterval = null;
let currentContainer = null;
let isResourceLoading = false;
let currentTerminalUser = null;
let terminalFocusDisposer = null;

let resizeObserver = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 3;
let terminalDisposables = createDisposableStore();
let terminalManagerDisposables = createDisposableStore();
let terminalInitialized = false;
let isTerminalActive = false;
let hasConnectedOnce = false;
let isTouchBarUserEnabled = true;

function syncTouchBarAndKeyboardBtnState() {
    const touchBar = document.getElementById('terminal-touch-bar');
    const container = document.getElementById('terminal-container');
    const isMobile = checkIsMobile();
    const showTouchBar = isMobile && isTouchBarUserEnabled;
    
    if (touchBar) {
        touchBar.style.display = showTouchBar ? 'flex' : 'none';
    }

    if (container) {
        const hasChanged = container.classList.contains('has-touch-bar') !== showTouchBar;
        container.classList.toggle('has-touch-bar', showTouchBar);
        if (hasChanged && terminalInstance) {
            TerminalManager.resize();
            setTimeout(() => TerminalManager.resize(), 160);
        }
    }

    if (els.terminalKeyboardBtn) {
        const showKeyboardBtn = isMobile && isTerminalActive;
        els.terminalKeyboardBtn.style.display = showKeyboardBtn ? 'flex' : 'none';
        els.terminalKeyboardBtn.classList.toggle('active', showTouchBar);
    }
}

let modifierStates = {
    ctrl: false,
    alt: false,
    shift: false
};

function resetModifiers() {
    modifierStates.ctrl = false;
    modifierStates.alt = false;
    modifierStates.shift = false;
    
    const touchBar = document.getElementById('terminal-touch-bar');
    if (touchBar) {
        const modBtns = touchBar.querySelectorAll('.modifier-btn');
        modBtns.forEach(btn => btn.classList.remove('active'));
    }
}

function processPayloadWithModifiers(rawPayload) {
    let payload = rawPayload;
    if (!payload || typeof payload !== 'string') return payload;

    if (modifierStates.ctrl) {
        const char = payload.charAt(0);
        const code = char.toUpperCase().charCodeAt(0);
        if (code >= 65 && code <= 90) { // A-Z
            payload = String.fromCharCode(code - 64) + payload.slice(1);
        }
    }

    if (modifierStates.alt) {
        payload = '\x1b' + payload;
    }

    if (modifierStates.shift) {
        payload = payload.toUpperCase();
    }

    return payload;
}

function scheduleReconnect() {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        Log.warn('Terminal', '终端自愈重连次数已达上限，停止重连');
        return;
    }

    if (!isTerminalActive || !terminalInstance) {
        return;
    }

    reconnectAttempts++;
    const delay = Math.min(2000 * reconnectAttempts, 8000);
    Log.info('Terminal', `终端物理断开，计划在 ${delay / 1000} 秒后执行第 ${reconnectAttempts} 次自愈重连...`);

    reconnectTimer = setTimeout(() => {
        if (isTerminalActive && terminalInstance) {
            Log.info('Terminal', `开始执行终端自愈重连 (第 ${reconnectAttempts} 次)...`);
            TerminalManager.connect();
        }
    }, delay);
}

/**
 * 辅助方法：动态向页面注入样式或脚本
 */
function loadLazyResource(url, type) {
    return new Promise((resolve, reject) => {
        const selector = type === 'css' ? `link[href="${url}"]` : `script[src="${url}"]`;
        if (document.querySelector(selector)) {
            resolve();
            return;
        }

        let el;
        if (type === 'css') {
            el = document.createElement('link');
            el.rel = 'stylesheet';
            el.href = url;
        } else {
            el = document.createElement('script');
            el.src = url;
        }
        el.onload = resolve;
        el.onerror = () => reject(new Error(`无法加载静态资源: ${url}`));
        document.head.appendChild(el);
    });
}

export const TerminalManager = {
    /**
     * 初始化事件监听绑定
     */
    init() {
        if (terminalInitialized) return;
        terminalInitialized = true;
        terminalManagerDisposables = createDisposableStore();

        // 订阅底部面板激活 Tab 改变事件，在 terminal 激活时初始化并 resize
        terminalManagerDisposables.add(eventBus.on('bottom-panel:active-tab-changed', (tabName) => {
            if (tabName === 'terminal') {
                isTerminalActive = true;
                this.initTerminalInstance(els.terminalContainer);
                setTimeout(() => this.resize(), 200);
            } else {
                isTerminalActive = false;
            }
            syncTouchBarAndKeyboardBtnState();
        }));

        // 监听来自拖拽的 resize 请求
        terminalManagerDisposables.add(eventBus.on('terminal:resize-request', () => {
            this.resize();
        }));

        // 监听来自底部 Tab 页签的重启与定位终端请求
        terminalManagerDisposables.add(eventBus.on('terminal:restart-request', () => {
            this.restart();
        }));

        terminalManagerDisposables.add(eventBus.on('terminal:locate-request', () => {
            const currentPath = AppContext.state.currentPath;
            let targetDir = '';
            if (currentPath && !currentPath.startsWith('podnote://')) {
                const lastSlash = Math.max(currentPath.lastIndexOf('/'), currentPath.lastIndexOf('\\'));
                if (lastSlash !== -1) {
                    targetDir = currentPath.substring(0, lastSlash);
                }
            }
            if (!targetDir) {
                targetDir = AppContext.state.workspacePath || '';
            }
            this.restart(targetDir);
        }));

        // 订阅设置变化事件，自动同步终端样式
        terminalManagerDisposables.add(eventBus.on('settings:changed', (settings) => {
            this.applySettings(settings);
        }));

        // 绑定重连和定位终端按钮事件
        if (els.terminalRestartBtn) {
            els.terminalRestartBtn.onclick = () => {
                this.restart();
            };
            terminalManagerDisposables.add(() => {
                els.terminalRestartBtn.onclick = null;
            });
        }

        if (els.terminalLocateBtn) {
            els.terminalLocateBtn.onclick = () => {
                eventBus.emit('terminal:locate-request');
            };
            terminalManagerDisposables.add(() => {
                els.terminalLocateBtn.onclick = null;
            });
        }

        if (els.terminalGitBtn) {
            els.terminalGitBtn.onclick = (e) => {
                e.stopPropagation();
                const menu = document.getElementById('panel-terminal-git-menu');
                if (menu) {
                    const isVisible = menu.style.display === 'flex';
                    menu.style.display = isVisible ? 'none' : 'flex';
                }
            };
            terminalManagerDisposables.add(() => {
                els.terminalGitBtn.onclick = null;
            });
        }

        // 全局点击关闭 Git 菜单
        const closeGitMenu = () => {
            const menu = document.getElementById('panel-terminal-git-menu');
            if (menu) menu.style.display = 'none';
        };
        document.addEventListener('click', closeGitMenu);
        terminalManagerDisposables.add(() => document.removeEventListener('click', closeGitMenu));

        // 绑定 Git 菜单项点击事件委托
        const gitMenu = document.getElementById('panel-terminal-git-menu');
        if (gitMenu) {
            const handleGitMenuClick = (e) => {
                const item = e.target.closest('.lang-item');
                if (item) {
                    e.stopPropagation();
                    const cmd = item.getAttribute('data-cmd');
                    if (cmd) {
                        if (terminalSocket && terminalSocket.readyState === WebSocket.OPEN) {
                            terminalSocket.send(cmd);
                            terminalInstance.focus();
                        } else {
                            showToast('终端未连接，无法执行命令', true);
                        }
                    }
                    gitMenu.style.display = 'none';
                }
            };
            gitMenu.addEventListener('click', handleGitMenuClick);
            terminalManagerDisposables.add(() => gitMenu.removeEventListener('click', handleGitMenuClick));
        }

        // 绑定终端顶栏虚拟按键开关按钮点击事件 (仅移动端生效)
        if (els.terminalKeyboardBtn) {
            els.terminalKeyboardBtn.onclick = (e) => {
                e.stopPropagation();
                isTouchBarUserEnabled = !isTouchBarUserEnabled;
                syncTouchBarAndKeyboardBtnState();
                if (terminalInstance) {
                    setTimeout(() => this.resize(), 50);
                }
            };
            terminalManagerDisposables.add(() => {
                els.terminalKeyboardBtn.onclick = null;
            });
        }

        // 绑定移动端/触屏终端快捷键工具栏事件委托
        const touchBar = document.getElementById('terminal-touch-bar');
        if (touchBar) {
            syncTouchBarAndKeyboardBtnState();

            const handleTouchBarBtnClick = (e) => {
                const btn = e.target.closest('.touch-bar-btn');
                if (!btn) return;

                // 阻止默认行为防失焦，保持触屏输入连续性
                e.preventDefault();
                e.stopPropagation();

                const modType = btn.getAttribute('data-modifier');
                if (modType) {
                    modifierStates[modType] = !modifierStates[modType];
                    btn.classList.toggle('active', modifierStates[modType]);
                    if (terminalInstance) terminalInstance.focus();
                    return;
                }

                const seq = btn.getAttribute('data-seq');
                const cmd = btn.getAttribute('data-cmd');
                let payload = seq !== null ? seq : cmd;

                if (payload) {
                    payload = processPayloadWithModifiers(payload);
                    if (terminalSocket && terminalSocket.readyState === WebSocket.OPEN) {
                        terminalSocket.send(payload);
                        if (terminalInstance) {
                            terminalInstance.focus();
                        }
                    } else {
                        showToast('终端未连接，无法发送指令', true);
                    }
                    resetModifiers();
                }
            };

            touchBar.addEventListener('pointerdown', handleTouchBarBtnClick);
            window.addEventListener('resize', syncTouchBarAndKeyboardBtnState);
            terminalManagerDisposables.add(() => {
                touchBar.removeEventListener('pointerdown', handleTouchBarBtnClick);
                window.removeEventListener('resize', syncTouchBarAndKeyboardBtnState);
            });
        }
    },

    /**
     * 初始化终端实例（在用户首次访问时按需拉取资源）
     * @param {HTMLElement} container - 挂载容器
     */
    async initTerminalInstance(container) {
        if (!container) return;
        currentContainer = container;

        if (terminalInstance) {
            if (!terminalSocket || terminalSocket.readyState !== WebSocket.OPEN) {
                this.connect();
            }
            return;
        }

        if (isResourceLoading) return;

        // 仅在全局不存在 Terminal 时按需获取静态文件
        if (!window.Terminal || !window.FitAddon) {
            isResourceLoading = true;
            container.innerHTML = '<div style="padding: 20px; opacity: 0.7; font-size:12px; font-style:italic;">正在按需载入终端引擎...</div>';
            try {
                Log.info('Terminal', '正在按需载入终端引擎...');
                
                // 加载 CSS
                await loadLazyResource('./xterm/xterm.css', 'css');
                
                // 配置模块路径
                window.require.config({
                    paths: {
                        'xterm': './xterm/xterm',
                        'xterm-addon-fit': './xterm/xterm-addon-fit'
                    }
                });
                
                // 使用 AMD 加载器引入 xterm 模块
                const [xtermModule, fitModule] = await new Promise((resolve, reject) => {
                    window.require(['xterm', 'xterm-addon-fit'], (xterm, fit) => {
                        resolve([xterm, fit]);
                    }, (err) => reject(err));
                });
                
                window.Terminal = xtermModule.Terminal;
                window.FitAddon = fitModule;

                Log.success('Terminal', '终端组件加载就绪');
            } catch (err) {
                Log.error('Terminal', '动态加载终端组件失败:', err);
                container.innerHTML = `<div style="padding: 20px; color: #f44336; font-size:12px;">终端加载失败，请刷新重试。<br>${err.message}</div>`;
                isResourceLoading = false;
                return;
            }
            isResourceLoading = false;
        }

        container.innerHTML = '';
        terminalDisposables.dispose();
        terminalDisposables = createDisposableStore();

        const settings = SettingsManager.load();

        Log.info('Terminal', '创建 xterm.js 实例');
        terminalInstance = new Terminal({
            cursorBlink: settings.terminalCursorBlink === true || settings.terminalCursorBlink === 'true',
            cursorStyle: settings.terminalCursorStyle || 'block',
            theme: {
                background: '#0c0c0c',
                foreground: '#cccccc',
                cursor: '#ffffff'
            },
            fontSize: parseInt(settings.terminalFontSize, 10) || 13,
            fontFamily: "Consolas, 'Courier New', monospace"
        });

        terminalFitAddon = new FitAddon.FitAddon();
        terminalInstance.loadAddon(terminalFitAddon);
        terminalInstance.open(container);
        terminalFitAddon.fit();

        // 移动端点击/触控终端容器自动聚焦内部隐藏输入框以拉起软键盘
        const handleFocus = () => {
            const textarea = container.querySelector('.xterm-helper-textarea');
            if (textarea && document.activeElement !== textarea) {
                textarea.focus();
            }
        };
        if (terminalFocusDisposer) {
            terminalFocusDisposer();
            terminalFocusDisposer = null;
        }
        container.addEventListener('touchend', handleFocus);
        container.addEventListener('click', handleFocus);
        terminalFocusDisposer = () => {
            container.removeEventListener('touchend', handleFocus);
            container.removeEventListener('click', handleFocus);
        };
        terminalDisposables.add(() => {
            container.removeEventListener('touchend', handleFocus);
            container.removeEventListener('click', handleFocus);
        });

        if (window.ResizeObserver) {
            if (resizeObserver) resizeObserver.disconnect();
            let debounceTimer = null;
            resizeObserver = new ResizeObserver(() => {
                if (debounceTimer) clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    if (terminalInstance && terminalFitAddon && container.clientWidth > 0 && container.clientHeight > 0) {
                        try {
                            terminalFitAddon.fit();
                        } catch (e) {}
                    }
                }, 50); // 50ms 缓冲防抖
            });
            resizeObserver.observe(container);
            terminalDisposables.add(() => {
                if (debounceTimer) clearTimeout(debounceTimer);
            });
        }

        this.connect();

        terminalDisposables.add(terminalInstance.onData(data => {
            let processed = data;
            if (modifierStates.ctrl || modifierStates.alt || modifierStates.shift) {
                processed = processPayloadWithModifiers(data);
                resetModifiers();
            }
            if (terminalSocket && terminalSocket.readyState === WebSocket.OPEN) {
                terminalSocket.send(processed);
            }
        }));

        terminalDisposables.add(terminalInstance.onResize(size => {
            if (terminalSocket && terminalSocket.readyState === WebSocket.OPEN) {
                terminalSocket.send(`\x00resize:${size.cols},${size.rows}`);
            }
        }));
    },

    /**
     * 建立与后端的 WebSocket 长连接
     */
    connect(customPath) {
        if (!terminalInstance) return;

        if (hasConnectedOnce) {
            // 写入物理换行及隔离标识，避免提示符与旧行重叠
            terminalInstance.write('\r\n\x1b[90m--- 终端已重连 ---\x1b[0m\r\n');
        }

        // 同步拟合物理尺寸，防止延迟 fit 重流引发光标错位
        if (terminalFitAddon && currentContainer && currentContainer.clientWidth > 0 && currentContainer.clientHeight > 0) {
            try {
                terminalFitAddon.fit();
            } catch (e) {}
        }

        if (terminalSocket) {
            try {
                terminalSocket.isClosing = true;
                terminalSocket.close();
            } catch (e) {}
            terminalSocket = null;
        }
        if (terminalPingInterval) {
            clearInterval(terminalPingInterval);
            terminalPingInterval = null;
        }
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }



        const settings = SettingsManager.load();
        const cols = terminalInstance.cols || 80;
        const rows = terminalInstance.rows || 24;
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const terminalUser = settings.terminalUser || 'root';
        currentTerminalUser = terminalUser;
        let workspaceParam = '';
        const workspacePath = customPath !== undefined ? customPath : (AppContext.state.workspacePath || '');
        if (workspacePath && !workspacePath.startsWith('podnote://')) {
            workspaceParam = `&workspace=${encodeURIComponent(workspacePath)}`;
        }
        const wsUrl = `${proto}//${host}/app/m-text-editor/api/terminal/ws?cols=${cols}&rows=${rows}&user=${encodeURIComponent(terminalUser)}${workspaceParam}`;

        Log.info('Terminal', `开始建立连接: ${wsUrl}`);
        const ws = new WebSocket(wsUrl);
        terminalSocket = ws;

        ws.onopen = () => {
            if (terminalSocket !== ws) return; // 忽略已被替换的旧连接

            Log.success('Terminal', 'WebSocket 连接成功');
            reconnectAttempts = 0;
            hasConnectedOnce = true;
            setTimeout(() => {
                if (terminalFitAddon && currentContainer && currentContainer.clientWidth > 0 && currentContainer.clientHeight > 0) {
                    try {
                        terminalFitAddon.fit();
                    } catch (e) {}
                }
            }, 100);

            terminalPingInterval = setInterval(() => {
                if (terminalSocket && terminalSocket.readyState === WebSocket.OPEN) {
                    terminalSocket.send('\x00ping');
                }
            }, 30000);
        };

        ws.onmessage = (event) => {
            if (terminalSocket !== ws) return; // 忽略已被替换的旧连接
            if (event.data === '\x00pong') return;
            terminalInstance.write(event.data);
        };

        ws.onclose = () => {
            if (terminalSocket !== ws) return; // 忽略已被替换的旧连接
            terminalInstance.write('\r\n[PodNote] 终端连接已断开。您可以点击右上方重连按钮重试。\r\n');
            Log.warn('Terminal', 'WebSocket 连接断开');
            if (terminalPingInterval) {
                clearInterval(terminalPingInterval);
                terminalPingInterval = null;
            }

            if (terminalSocket && !terminalSocket.isClosing) {
                scheduleReconnect();
            }
        };

        ws.onerror = (err) => {
            if (terminalSocket !== ws) return; // 忽略已被替换的旧连接
            terminalInstance.write(`\r\n[PodNote] 连接错误: ${err.message || '网络异常'}\r\n`);
            Log.error('Terminal', 'WebSocket 发生错误:', err);
            if (terminalPingInterval) {
                clearInterval(terminalPingInterval);
                terminalPingInterval = null;
            }
        };
    },

    /**
     * 重启终端会话
     */
    restart(customPath) {
        Log.info('Terminal', customPath ? `手动重连并定位终端会话: ${customPath}` : '手动重连终端会话');
        reconnectAttempts = 0;
        showToast(customPath ? '正在定位并重连终端...' : '正在重新连接终端会话...');
        this.connect(customPath);
    },

    /**
     * 自适应容器大小调整
     */
    resize() {
        if (terminalInstance && terminalFitAddon && currentContainer && currentContainer.clientWidth > 0 && currentContainer.clientHeight > 0) {
            try {
                // 立即进行首次自适应，并自动滚动到底部
                terminalFitAddon.fit();
                terminalInstance.scrollToBottom();

                // 延迟 200ms 进行二次校验，防范侧栏过渡动画或键盘弹起动画导致的临时尺寸测量偏差
                setTimeout(() => {
                    if (terminalInstance && terminalFitAddon && currentContainer) {
                        try {
                            terminalFitAddon.fit();
                            terminalInstance.scrollToBottom();
                        } catch (e) {}
                    }
                }, 200);
            } catch (e) {}
        }
    },

    /**
     * 释放终端和连接资源
     */
    dispose() {
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
        if (resizeObserver) {
            resizeObserver.disconnect();
            resizeObserver = null;
        }
        terminalDisposables.dispose();
        terminalManagerDisposables.dispose();
        terminalInitialized = false;
        if (terminalPingInterval) {
            clearInterval(terminalPingInterval);
            terminalPingInterval = null;
        }
        if (terminalSocket) {
            try {
                terminalSocket.isClosing = true;
                terminalSocket.close();
            } catch (e) {}
            terminalSocket = null;
        }
        if (terminalFocusDisposer) {
            terminalFocusDisposer();
            terminalFocusDisposer = null;
        }
        if (terminalInstance) {
            try { terminalInstance.dispose(); } catch (e) {}
            terminalInstance = null;
        }
        terminalFitAddon = null;
        if (currentContainer) {
            currentContainer.innerHTML = '';
        }
        Log.info('Terminal', '终端实例资源已完全释放');
    },

    /**
     * 热应用最新的终端选项
     */
    applySettings(settings) {
        if (!terminalInstance) return;
        try {
            const fontSize = parseInt(settings.terminalFontSize, 10) || 13;
            const cursorBlink = settings.terminalCursorBlink === true || settings.terminalCursorBlink === 'true';
            const cursorStyle = settings.terminalCursorStyle || 'block';

            terminalInstance.options.fontSize = fontSize;
            terminalInstance.options.cursorBlink = cursorBlink;
            terminalInstance.options.cursorStyle = cursorStyle;

            this.resize();
            Log.success('Terminal', '热应用终端配置成功');

            const newTerminalUser = settings.terminalUser || 'root';
            if (currentTerminalUser !== null && currentTerminalUser !== newTerminalUser) {
                Log.info('Terminal', `检测到执行用户变更: ${currentTerminalUser} -> ${newTerminalUser}，执行热更新重连`);
                this.connect();
            }
        } catch (e) {
            Log.error('Terminal', '热更新终端配置失败:', e);
        }
    }
};
