/**
 * tail.js - 只读模式 Tail WebSocket 监控管理器
 */
import { API } from './api.js';
import { Log, createDisposableStore } from './utils.js';
import { SettingsManager } from './settings.js';
import { EditorManager } from './editor.js';
import { eventBus } from './event_bus.js';
import { AppContext } from './context.js';
import { TabManager } from './tabs.js';

let tailSocket = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
let tailDisposables = createDisposableStore();

function scheduleReconnect(path) {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        Log.warn('Tail', '自愈重连次数已达上限，停止重连');
        return;
    }

    reconnectAttempts++;
    const delay = Math.min(2000 * reconnectAttempts, 10000);
    Log.info('Tail', `监视连接异常断开，计划在 ${delay / 1000} 秒后执行第 ${reconnectAttempts} 次自愈重连...`);

    reconnectTimer = setTimeout(() => {
        const settings = SettingsManager.load();
        const isTailEnabled = settings.readOnlyTail === true || settings.readOnlyTail === 'true';
        if (AppContext.state.currentPath === path && !AppContext.state.isEditMode && isTailEnabled) {
            Log.info('Tail', `开始执行第 ${reconnectAttempts} 次自愈重连...`);
            updateTail();
        }
    }, delay);
}

function updateTail() {
    const settings = SettingsManager.load();
    const isTailEnabled = settings.readOnlyTail === true || settings.readOnlyTail === 'true';
    const path = AppContext.state.currentPath;
    const isEdit = AppContext.state.isEditMode;

    const targetPath = (!path || isEdit || !isTailEnabled) ? null : path;

    // 若已有连接且对应的路径未发生改变，则保留当前连接，防止重复重连
    if (tailSocket && tailSocket.path === targetPath) {
        return;
    }

    // 清理可能悬挂的重连定时器
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }

    // 路径改变时重置计数
    if (!tailSocket || tailSocket.path !== targetPath) {
        reconnectAttempts = 0;
    }

    // 关闭上一个旧连接
    if (tailSocket) {
        Log.info('Tail', '主动关闭上一个 WS 监视连接');
        try {
            tailSocket.isClosing = true;
            tailSocket.close();
        } catch (e) {}
        tailSocket = null;
    }

    if (!targetPath) {
        return;
    }

    const pollPath = targetPath;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/app/m-text-editor/api/watch/ws?path=${encodeURIComponent(pollPath)}`;

    try {
        Log.info('Tail', '建立 WebSocket 实时监控连接:', pollPath);
        const ws = new WebSocket(wsUrl);
        ws.path = pollPath; // 绑定当前监视的路径，供去重判断使用
        tailSocket = ws;

        ws.onopen = () => {
            if (tailSocket !== ws) return;
            Log.success('Tail', 'WebSocket 实时监控连接已建立');
            reconnectAttempts = 0;
        };

        ws.onmessage = async (event) => {
            if (tailSocket !== ws) return;
            // 确保异步回调触发时路径及模式未改变，否则主动关闭
            if (AppContext.state.currentPath !== pollPath || AppContext.state.isEditMode) {
                if (tailSocket === ws) {
                    ws.close();
                    tailSocket = null;
                }
                return;
            }

            try {
                const data = JSON.parse(event.data);
                if (data.error) {
                    Log.error('Tail', '后端推送错误:', data.error);
                    return;
                }

                if (data.event === 'change') {
                    // 仅在修改时间或物理大小实际变化时重载
                    const isMtimeChanged = data.mtime > AppContext.state.lastMtime;
                    const isSizeChanged = data.size !== AppContext.state.lastSize;

                    if (isMtimeChanged || isSizeChanged) {
                        Log.info('Tail', 'WS 接收到变更通知，执行全量重载. mtime:', data.mtime, 'size:', data.size);
                        
                        const fileData = await API.read(pollPath, AppContext.state.currentEncoding);
                        if (tailSocket !== ws || AppContext.state.currentPath !== pollPath || AppContext.state.isEditMode) return;

                        const editor = EditorManager.getEditor();
                        const tabsList = TabManager.getTabs();
                        const activeTab = tabsList.find(t => t.path === pollPath);

                        if (editor && activeTab && activeTab.model) {
                            AppContext.update({ isIgnoringChange: true });
                            
                            // 判断重载前滚动条是否在底部（30px 容差）
                            const scrollHeight = editor.getScrollHeight();
                            const scrollTop = editor.getScrollTop();
                            const layoutInfo = editor.getLayoutInfo();
                            const clientHeight = layoutInfo ? layoutInfo.height : 0;
                            const isAtBottom = scrollTop + clientHeight >= scrollHeight - 30;

                            editor.setValue(fileData.content);
                            AppContext.update({ isIgnoringChange: false });

                            if (isAtBottom) {
                                setTimeout(() => {
                                    const latestModel = editor.getModel();
                                    if (latestModel && AppContext.state.currentPath === pollPath) {
                                        const lineCount = latestModel.getLineCount();
                                        editor.revealLine(lineCount);
                                    }
                                }, 50);
                            }
                        }

                        // 同步上下文状态
                        AppContext.update({
                            lastMtime: fileData.mtime,
                            lastSize: fileData.size,
                            originalContent: fileData.content
                        });

                        // 同步 Tab
                        TabManager.syncActiveTabSave(fileData.mtime, fileData.size, fileData.content, AppContext.state.currentEncoding);
                    }
                }
            } catch (e) {
                Log.error('Tail', '解析 WS 消息失败:', e);
            }
        };

        ws.onerror = (err) => {
            if (tailSocket !== ws) return;
            Log.error('Tail', 'WebSocket 监听链路异常:', err);
        };

        ws.onclose = (event) => {
            if (tailSocket !== ws) return;
            Log.info('Tail', 'WebSocket 监听连接已断开. Code:', event.code, 'Reason:', event.reason);
            tailSocket = null;
            if (!ws.isClosing) {
                scheduleReconnect(pollPath);
            }
        };
    } catch (err) {
        Log.error('Tail', '创建 WebSocket 连接失败:', err);
    }
}

export const TailManager = {
    init() {
        tailDisposables.dispose();
        tailDisposables = createDisposableStore();
        tailDisposables.add(eventBus.on('file:selected', () => updateTail()));
        tailDisposables.add(eventBus.on('mode:changed', () => updateTail()));
        tailDisposables.add(eventBus.on('settings:changed', () => updateTail()));
    },

    update() {
        updateTail();
    },

    dispose() {
        tailDisposables.dispose();
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
        if (tailSocket) {
            try {
                tailSocket.isClosing = true;
                tailSocket.close();
            } catch (e) {}
            tailSocket = null;
        }
    }
};
