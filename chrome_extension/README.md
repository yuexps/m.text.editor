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

### 网络拦截与路径绑定
* 重置 `window.WebSocket` 原生构造函数，捕获并标记文件管理 WebSocket 实例。
* 劫持 `WebSocket.send` 方法。拦截到 `file.ls` 请求时解析出当前逻辑路径 `wsPath`，并绑定在活动窗口 DOM 的 `__podnote_path` 属性上。

### 右键菜单劫持与“使用 PodNote 编辑”注入
* 监听宿主 `contextmenu` 事件，保存被右键的文件目标 DOM。
* 利用 `MutationObserver` 监听 DOM 树变化。当宿主生成右键菜单时，在“打开方式”或“下载”位置插入“使用 PodNote 编辑”选项。
* 触发点击时获取目标文件名，结合 `__podnote_path` 拼接绝对路径并呼出编辑器。

### 弹窗管理与幽灵模式 (Ghost Mode)
* 动态挂载 iframe 容器加载编辑器。聚焦窗口时自增 `zIndex` 并添加高亮阴影，同时为其他非活动窗口覆盖透明遮罩防止拖拽卡顿。
* **幽灵模式**：一键切换容器半透明（`opacity: 0.3`）并开启鼠标穿透（`pointer-events: none`），实现底图透视交互。

### 工具栏“新建文件”与自动刷新
* 监听 DOM 并定位“新建文件夹”按钮，在其后插入“新建文件”按钮。
* 新建文件成功后，自动定位并模拟点击飞牛文件管理器内的“刷新”按钮，同步文件列表。

---

## 3. 插件存活自愈 (background.js)
* **机制**：由 `background.js` 每 30 秒轮询检测宿主 `document.documentElement`，若发现 `data-podnote-ready` 标记丢失，则重新执行脚本注入，应对 SPA 单页应用路由切换引起的 DOM 清空。
