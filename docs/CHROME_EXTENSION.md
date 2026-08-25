# 浏览器扩展架构与注入规范 (CHROME_EXTENSION.md)

Chrome/Edge 扩展（MV3）实现 FNOS 文件管理器右键无缝调用 PodNote。

---

## 1. 运行时上下文隔离 (MAIN vs ISOLATED)

由于飞牛OS页面的安全域控制，扩展采用双 World 隔离桥接架构：

```
┌──────────────────────────────────────────────────────────────────┐
│ 浏览器标签页 (FNOS 页面)                                           │
│ ┌──────────────────────────────┐  ┌────────────────────────────┐ │
│ │ MAIN World                   │  │ ISOLATED World             │ │
│ │ (inject_fnos.js)             │  │ (background 注入桥接)       │ │
│ │                              │  │                            │ │
│ │ 触发事件:                    │  │ 监听事件:                  │ │
│ │ 'podnote_status_event' ──────┼─►│ 'podnote_status_event'     │ │
│ └──────────────────────────────┘  │     │                      │ │
│                                   │     ▼                      │ │
│                                   │ chrome.runtime.sendMessage │ │
└───────────────────────────────────┼────────────────────────────┼─┘
                                    │                            │
                                    ▼                            ▼
                          ┌───────────────────┐        ┌──────────────────┐
                          │ background.js     │◄───────│ popup.js (Popup) │
                          │ (Service Worker)  │        │ (日志与配置管理)   │
                          └───────────────────┘        └──────────────────┘
```

* **MAIN World (`inject_fnos.js`)**：
  * 直接访问页面 DOM、Window 属性与 React fiber 实例状态。
  * **设计限制**：无权调用 `chrome.runtime` 任何 API。
* **ISOLATED World (Bridge)**：
  * 拥有 `chrome.runtime` 发送消息权限，但与页面 JS 堆栈完全隔离。
  * **职责**：作为中介，拦截 `podnote_status_event` 自定义 DOM 事件，并将数据投递回 Extension Background/Popup。

---

## 2. 注入互斥与锁定伪代码规约

### 2.1 脚本双重注入防护算法
```typescript
// background.js 检查逻辑
function injectScripts(tabId: number, url: string) {
  if (!isUrlAllowed(url)) return;

  // 1. 读取并写入状态锁，防止并发触发 onUpdated 造成重复加载
  chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: () => {
      if (window.__podnote_injecting__ || window.__PODNOTE_EXTENSION_INSTALLED__) {
        return { shouldInject: false };
      }
      window.__podnote_injecting__ = true; // 加锁
      return { shouldInject: true };
    }
  }).then((results) => {
    const { shouldInject } = results[0].result;
    if (!shouldInject) return;

    // 2. 注入核心逻辑与桥接
    chrome.scripting.executeScript({ target: { tabId }, files: ["inject_fnos.js"], world: "MAIN" })
      .then(() => {
        // 标记就绪并释放临时锁
        chrome.scripting.executeScript({
          target: { tabId },
          world: "MAIN",
          func: () => {
            window.__PODNOTE_EXTENSION_INSTALLED__ = true;
            window.__podnote_injecting__ = false;
          }
        });
      })
      .catch(() => {
        // 注入异常重置状态
        chrome.scripting.executeScript({
          target: { tabId },
          world: "MAIN",
          func: () => { window.__podnote_injecting__ = false; }
        });
      });
  });
}
```

### 2.2 右键菜单路径锁存与 DOM 防离线算法
由于 React 可能会在右键菜单弹出时，异步销毁或重新渲染目标 DOM，必须在 `contextmenu` 事件冒泡的**捕获阶段**（`capture: true`）瞬间锁存目标节点的 `data-path`：

```typescript
// inject_fnos.js 右键处理
let lockedPath: string | null = null;
let lockedTarget: HTMLElement | null = null;

document.addEventListener("contextmenu", (event: MouseEvent) => {
  const target = event.target as HTMLElement;
  const itemRow = target.closest("[data-path]");
  
  if (itemRow) {
    // 瞬间锁存物理路径与节点引用，防止异步渲染导致的节点离线 (disconnected DOM)
    lockedPath = itemRow.getAttribute("data-path");
    lockedTarget = itemRow as HTMLElement;
  } else {
    lockedPath = null;
    lockedTarget = null;
  }
}, true); // 强制捕获阶段执行
```

---

## 3. 多标签页隔离机制 (Tab Isolation)

当用户在浏览器中打开多个 FNOS 文件管理器标签页时，Popup 页面的日志和状态渲染必须实行强物理隔离：
* **消息过滤契约**：
  在 `popup.js` 监听来自 `background.js` 的广播状态时，必须验证消息发送方的 `tab.id` 必须与当前聚焦激活的 Tab 完全一致，否则直接丢弃：
  ```typescript
  chrome.runtime.onMessage.addListener((message, sender) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (!activeTab || !sender.tab || sender.tab.id !== activeTab.id) {
        // 丢弃非当前活动 Tab 的状态与日志数据，防状态污染
        return;
      }
      
      if (message.type === "STATUS_UPDATE") {
        renderUI(message.data);
      }
    });
  });
  ```
