# 前端核心业务子模块 (build/app/www/js/)

本目录包含 PodNote 前端核心业务子模块，采用事件驱动与全局状态集中的解耦协作机制。

---

## 1. 核心解耦协作机制

* [event_bus.js](./event_bus.js) (全局事件总线)：提供超轻量发布-订阅 (Pub/Sub) 机制。
  * 常用事件：`file:opened`, `file:saved`, `file:selected`, `mode:changed`, `settings:changed` 等，以及 `file:save-request`, `workspace:refresh-request` 等请求事件。
* [context.js](./context.js) (状态上下文)：集中维护并响应式更新应用全局状态（如 `currentPath`、`isEditMode` 等）。

---

## 2. 业务子模块解构

* [api.js](./api.js) (API)：封装 Ajax 请求。包括目录读取 `list`、文件读取 `read`（带取消信号）、写入 `save`、新建预检与新建文件 `newFile`。
* [editor.js](./editor.js) (EditorManager)：封装 Monaco 实例。处理折行、字体、语言热切换、只读/编辑状态切换及 `configureEnvironment` Monaco Worker 路径注册。
* [tabs.js](./tabs.js) (TabManager)：管理多标签页 UI 渲染及状态。处理文件“脏标记”与未保存退出确认。
* [search.js](./search.js) (SearchManager)：侧栏全局查找与替换。支持正则、匹配跳转、逐个替换与全局替换。
* [terminal.js](./terminal.js) (TerminalManager)：包装 xterm.js Web 终端。处理 WebSocket 双向流、断线重连、自适应 Resize 及按需懒加载。
* [settings.js](./settings.js) (SettingsManager)：管理 LocalStorage 用户设置，同步热应用主题色与字号。
* [markdown.js](./markdown.js) (MarkdownManager)：Markdown 渲染与双栏同步滚动。使用 Monaco 着色器高亮代码块。
* [tail.js](./tail.js) (TailManager)：只读模式下的实时文件追踪。通过 `/api/watch/ws` 接收变更并触发重载。
* [ui.js](./ui.js) (UIManager)：全局 DOM 缓存与展现层交互。包含侧栏拖拽与拉伸、文件树折叠、工具栏按钮点击绑定、编辑器事件代理（光标计数、Ctrl+S 代理、ResizeObserver）。
* [utils.js](./utils.js) (工具集)：提供公用逻辑（防抖节流、字符集判断、移动端环境探测等）。
* [ide_core.js](./ide_core.js) (IDECore)：注册 Monaco 自定义快捷键、代码片段，以及 Python/Shell/XML 的实时语法校验。
