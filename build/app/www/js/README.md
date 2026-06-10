# 前端核心业务子模块 (build/app/www/js/)

本目录包含 PodNote 前端核心业务子模块，采用事件驱动与全局状态集中的解耦协作机制。

---

## 1. 核心解耦协作机制

* [event_bus.js](./event_bus.js) (全局事件总线)：提供超轻量发布-订阅 (Pub/Sub) 机制。
  * 常用事件：`file:opened`, `file:saved`, `file:selected`, `mode:changed`, `settings:changed`, `tab:activated`, `tab:emptied` 等，以及 `file:save-request`, `workspace:refresh-request` 等请求事件。
* [context.js](./context.js) (状态上下文)：集中维护并响应式更新应用全局状态（如 `currentPath`、`isEditMode` 等）。

---

## 2. 业务子模块解构

* [api.js](./api.js) (API)：封装 Ajax 请求。包括目录读取 `list`、文件读取 `read`（带取消信号）、写入 `save`、新建预检与新建文件 `newFile`。
* [file_io.js](./file_io.js) (FileIO)：文件加载/保存/新建业务逻辑。封装 `loadFile`、`saveFile`、`createNewFile`、`loadWorkspace` 及编辑模式切换。
* [editor.js](./editor.js) (EditorManager)：封装 Monaco 实例。处理折行、字体、语言热切换、只读/编辑状态切换及 `configureEnvironment` Monaco Worker 路径注册。
* [tabs.js](./tabs.js) (TabManager)：管理多标签页 UI 渲染及状态。处理文件“脏标记”与未保存退出确认。通过 `tab:activated`/`tab:emptied` 事件与编辑器解耦。
* [search.js](./search.js) (SearchManager)：侧栏全局查找与替换。支持正则、匹配跳转、逐个替换与全局替换。
* [terminal.js](./terminal.js) (TerminalManager)：包装 xterm.js Web 终端。处理 WebSocket 双向流、断线重连、自适应 Resize 及按需懒加载。
* [settings.js](./settings.js) (SettingsManager)：管理 LocalStorage 用户设置，同步热应用主题色与字号。
* [markdown.js](./markdown.js) (MarkdownManager)：Markdown 渲染与双栏同步滚动。使用 Monaco 着色器高亮代码块。
* [tail.js](./tail.js) (TailManager)：只读模式下的实时文件追踪。通过 `/api/watch/ws` 接收变更并触发重载。
* [ui.js](./ui.js) (聚合导出)：re-export `ui/` 子模块的公共 API，保持外部导入路径不变。
* [ui/](./ui/) (UI 子模块目录)：按职责拆分的 UI 模块。
  * [elements.js](./ui/elements.js)：DOM 元素引用集合 (`els`) 及共享状态 (`uiDisposables`, `editorEventDisposables`)。
  * [dialog.js](./ui/dialog.js)：确认与输入对话框 (`showConfirm`, `showPrompt`)。
  * [feedback.js](./ui/feedback.js)：基础 UI 反馈 (`showToast`, `updateStatus`, `updateBreadcrumbs`, `hideAllPanels`, `updateUIState`)。
  * [filetree.js](./ui/filetree.js)：文件树渲染与交互管理 (`createTreeItem`, `renderFileTree`, `initFileTreeEvents`, `handleNewFileInTree`)。
  * [sidebar.js](./ui/sidebar.js)：侧边栏管理 (`expandSidebar`, `collapseSidebar`, `switchSidebarPanel`, `toggleActivityDropdownMenu`, 视口适配)。
  * [statusbar.js](./ui/statusbar.js)：底栏状态选择面板（语言/编码/EOL）事件绑定与面板对齐。
  * [manager.js](./ui/manager.js)：UIManager 核心管理器 (`init`, `bindEditorEvents`, `handleManualOpen`, `dispose`)。
* [utils.js](./utils.js) (工具集)：提供公用逻辑（防抖节流、字符集判断、移动端环境探测等）。
* [ide_core.js](./ide_core.js) (IDECore)：注册 Monaco 自定义快捷键、代码片段，以及 Python/Shell/XML 的实时语法校验。
