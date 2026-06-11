# Chrome 浏览器扩展 (chrome_extension/)

本扩展用于将 PodNote 文本编辑器集成到飞牛OS（FNOS）文件管理器中，提供右键编辑和快捷新建功能。

---

## 1. 文件索引

* [manifest.json](./manifest.json)：扩展配置文件（使用 MV3 规范）。
* [background.js](./background.js)：后台服务脚本，负责插件存活自愈轮询。
* [inject_fnos.js](./inject_fnos.js)：页面注入脚本，核心业务逻辑实现（去类名化文本特征匹配）。
* [popup.html](./popup.html) & [popup.js](./popup.js)：Popup 侧栏，配置 FNOS 域名列表与生效状态。

---

## 2. 核心技术实现 (inject_fnos.js)

### 路径解析与直读
* 放弃复杂的 Fiber 节点遍历与网络层劫持，采用纯 DOM 解析机制。
* 通过 `getPathFromDOM` 读取文件列表子项的 `data-path` 属性并结合面包屑进行路径逆向组装与末梢校验，保证路径解析的高稳健度。

### 右键菜单劫持与“使用 PodNote 编辑”注入
* 监听宿主 `contextmenu` 事件，保存被右键的文件目标 DOM。
* 利用 `MutationObserver` 监听 DOM 树变化。当宿主生成右键菜单时，在“打开方式”或“下载”位置插入“使用 PodNote 编辑”选项。
* 触发点击时获取目标文件名，结合从 `getPathFromDOM` 解析到的物理路径，拼接绝对路径并呼出编辑器。

### 跨环境通信桥接 (Bridge)
* 由于 `inject_fnos.js` 注入在页面的 `world: 'MAIN'` 环境，该环境无权调用扩展 API。
* 本扩展采用 **DOM 事件桥接** 机制：`inject_fnos.js` 抛出 `podnote_status_event` 自定义事件，而 `background.js` 在 `world: 'ISOLATED'` 隔离环境注入的监听器捕获该事件后，调用 `chrome.runtime.sendMessage` 转发给控制台，实现低功耗、事件驱动的实时面板状态与日志更新。

### 弹窗管理与幽灵模式 (Ghost Mode)
* 动态挂载 iframe 容器加载编辑器。聚焦窗口时自增 `zIndex` 并添加高亮阴影，同时为其他非活动窗口覆盖透明遮罩防止拖拽卡顿。
* **幽灵模式**：一键切换容器半透明（`opacity: 0.3`）并开启鼠标穿透（`pointer-events: none`），实现底图透视交互。

### 工具栏“新建文件”与自动刷新
* 监听 DOM 并定位“新建文件夹”按钮，在其后插入“新建文件”按钮。
* 新建文件成功后，自动定位并模拟点击飞牛文件管理器内的“刷新”按钮，同步文件列表。

---

## 3. 插件自愈机制 (background.js)
* **机制**：由 `background.js` 监听宿主标签页的 `onUpdated` 事件（`status === 'complete'`），在页面完成加载时自动注入。搭配 `inject_fnos.js` 内部的 `MutationObserver` 增量节点监听机制，实现全生命周期的毫秒级注入自愈，无需任何定时器轮询。
