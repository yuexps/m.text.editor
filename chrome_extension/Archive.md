# 归档技术细节：WebSocket 网络拦截器与匹配逻辑

本文件记录了在废弃 WebSocket 劫持方案之前，所采用的动态网络拦截与窗口绝对路径对齐同步的具体技术实现，供日后研究和回溯使用。

---

## 1. 原生 WebSocket 构造函数与 send 方法拦截

通过在 JavaScript 执行上下文中进行 AOP 注入（Monkey Patching），拦截含有 `type=file` 标志的文件数据通道请求。

```javascript
// ==========================================
// WebSocket 网络拦截器
// ==========================================
const OriginalWS = window.WebSocket;
window.WebSocket = function (url, protocols) {
    const ws = new OriginalWS(url, protocols);
    if (typeof url === 'string' && url.includes('type=file')) {
        ws.__is_file_ws = true;
    }
    return ws;
};
window.WebSocket.prototype = OriginalWS.prototype;

if (!WebSocket.prototype.originalSend) {
    WebSocket.prototype.originalSend = WebSocket.prototype.send;
    WebSocket.prototype.send = function (data) {
        if (this.__is_file_ws) {
            try {
                const strData = typeof data === 'string' ? data : new TextDecoder().decode(data);
                const jsonStr = strData.includes('=') ? strData.split('=')[1] : strData;
                const msg = JSON.parse(jsonStr);

                if (msg.req === "file.ls") {
                    const wsPath = msg.path || "/";

                    const wins = document.querySelectorAll(CONFIG.WIN_SELECTOR);
                    let matchedWin = null;
                    for (let win of wins) {
                        if (checkPathMatch(wsPath, getWinBreadcrumbPath(win))) {
                            matchedWin = win;
                            break;
                        }
                    }

                    const target = matchedWin || lastActiveWin || wins[wins.length - 1];
                    if (target) {
                        target.__podnote_path = wsPath;
                        NPLog.sync(`路径已同步: ${wsPath}`);
                    }
                }
            } catch (e) { }
        }
        return WebSocket.prototype.originalSend.apply(this, arguments);
    };
}
```

---

## 2. 最右侧路径后缀匹配算法 (checkPathMatch)

因为 WebSocket 发送的物理磁盘绝对路径可能包含特定的磁盘卷和用户 UID（如 `vol2/1000/docker`），而 DOM 面包屑显示的是逻辑根目录名（如 `我的文件/docker`），因此采用将面包屑去根后，与物理绝对路径的最右侧进行对齐校验的后缀匹配算法。

```javascript
// ==========================================
// 物理与逻辑路径对齐匹配
// ==========================================
function checkPathMatch(wsPath, domBreadcrumbs) {
    const wsParts = (wsPath || "").split('/').filter(p => p);
    const domParts = (domBreadcrumbs || "").split('/').filter(p => p);
    const domRelativeParts = domParts.filter(part => !CONFIG.ROOT_LABELS.includes(part));

    if (wsPath === "/" || wsPath === "") {
        // 根路径匹配
        return domParts.length === 1 && CONFIG.ROOT_LABELS.includes(domParts[0]);
    }
    if (domRelativeParts.length > 0 && wsParts.length >= domRelativeParts.length) {
        // 物理路径尾部子集吻合
        const wsTail = wsParts.slice(-domRelativeParts.length);
        return wsTail.every((part, idx) => part === domRelativeParts[idx]);
    }
    return false;
}
```
