# 前端模块强类型参考 (FRONTEND_MODULES.md)

前端采用原生 ES Module，核心类与子模块均通过 EventBus 互通。

---

## 1. 核心业务层 (build/app/www/js/)

### 1.1 api.js (API 通信层)
```typescript
export declare class Api {
  /** 读取文件接口，默认 30 秒超时 */
  static read(path: string, encoding: string, signal?: AbortSignal): Promise<Response>;
  /** 保存文件接口，默认 30 秒超时 */
  static save(path: string, content: string, encoding: string, mtime: number): Promise<Response>;
  /** 获取物理目录文件列表，支持 1 次自动重试 */
  static list(path: string): Promise<ListResponse>;
  /** 新建预检 */
  static checkCreate(path: string): Promise<{ content: string; language: string }>;
  /** 创建空文件 */
  static newFile(path: string): Promise<{ content: string; mtime: number }>;
  /** 拉取云端配置 */
  static getSettings(clientType?: "pc" | "mobile"): Promise<Record<string, any>>;
  /** 保存云端配置 */
  static saveSettings(settings: Record<string, any>, clientType?: "pc" | "mobile"): Promise<Response>;
}
```

### 1.2 file_io.js (I/O 逻辑层)
```typescript
export declare class FileIO {
  /** 物理读取文件并加载进编辑器，同步状态机 */
  static loadFile(path: string, isNew?: boolean, silent?: boolean): Promise<void>;
  /** 保存当前活动 Model 内容，捕获乐观锁并发冲突 */
  static saveFile(): Promise<void>;
  /** 创建物理文件并自动打开 */
  static createNewFile(path: string): Promise<void>;
  /** 触发工作区目录加载与文件树重绘 */
  static loadWorkspace(dir: string): Promise<void>;
  /** 切换编辑/只读状态 */
  static setEditMode(isEdit: boolean, silent?: boolean): void;
  /** 高亮文件树的特定文件节点 */
  static highlightTreeItem(path: string): void;
}
```

### 1.3 editor.js (Monaco 封装层)
```typescript
export declare class EditorManager {
  /** 配置 Monaco Worker 路径和语言载入环境 */
  static configureEnvironment(): void;
  /** 初始化 Monaco 实例并注册核心 Shortcut 动作 */
  static init(container: HTMLElement, options: Record<string, any>, actions: Record<string, Function>): void;
  /** 获取当前活跃的 Monaco 实例 */
  static getEditor(): any;
  /** 读取当前换行符状态并同步底栏 EOL 展示 */
  static updateEOLDisplay(): void;
  /** 计算文档字符字数并同步状态栏 */
  static updateCharCount(): void;
  /** 卸载编辑器实例与绑定的事件流 */
  static dispose(): void;
}
```

### 1.4 tabs.js (标签页控制层)
```typescript
export declare class TabManager {
  /** 初始化标签栏 UI 并绑定交互监听 */
  static init(): void;
  /** 同步特定标签页的脏状态渲染标记 */
  static updateActiveTabDirty(isDirty: boolean): void;
  /** 彻底关闭并释放所有活动标签页 */
  static dispose(): void;
}
```

---

## 2. UI 组件与 DOM 依赖约束 (build/app/www/js/ui/)

UI 各子模块由 `elements.js` 提供全局 DOM 节点引用的统一状态，并在初始化及生命周期各阶段直接依赖、修改特定的 DOM 节点。

### 2.1 elements.js (DOM 引用状态)
* **核心 DOM 元素字典 (`els`)**：
  ```typescript
  interface HTMLElementsRegistry {
    app: HTMLElement;            // #app
    editorContainer: HTMLElement; // #editor-container
    sidebar: HTMLElement;         // #sidebar
    terminalPanel: HTMLElement;   // #terminal-panel
    fileTreeContainer: HTMLElement;// #file-tree
    breadcrumbs: HTMLElement;     // #breadcrumbs-path
    tabsBar: HTMLElement;         // #tabs-bar
    activityBar: HTMLElement;     // #activity-bar
    toast: HTMLElement;           // #toast-notification
    dialog: HTMLElement;          // #global-dialog
  }
  ```

### 2.2 UIManager 依赖约束与 DOM 映射

| 子模块 | 核心导出方法签名与职责 | 强依赖的 DOM 选择器 |
|:---|:---|:---|
| **dialog.js** | `showConfirm(title: string, message: string): Promise<boolean>`<br>`showPrompt(title: string, msg: string, def?: string): Promise<string\|null>` | `#dialog` (模态框容器)<br>`#dialog-confirm-btn` (确认按钮)<br>`#dialog-input` (输入域) |
| **feedback.js** | `showToast(msg: string, isError?: boolean): void`<br>`updateStatus(text: string, color?: string): void`<br>`updateBreadcrumbs(path: string): void` | `#toast` (Toast 浮层)<br>`#status-bar-text` (底栏文本)<br>`#breadcrumbs-path` (面包屑路径) |
| **filetree.js** | `renderFileTree(container: HTMLElement, files: FileInfo[], depth: number): void`<br>`handleNewFileInTree(): void` | `.tree-item` (树节点)<br>`.tree-folder-arrow` (目录折叠箭头)<br>`.active-tree-item` (当前高亮节点) |
| **sidebar.js** | `expandSidebar(panelName: string): void`<br>`collapseSidebar(): void`<br>`switchSidebarPanel(panelName: string): void` | `#sidebar` (侧栏大容器)<br>`.sidebar-panel` (侧栏面板)<br>`.activity-btn` (活动栏图标) |
| **statusbar.js** | `bindStatusBarEvents(): void`<br>`toggleSelectionPanel(panelName: string): void` | `.status-item` (状态栏条目)<br>`.dropdown-panel` (弹出的选项菜单) |

---

## 3. 样式表加载规约 (build/app/www/css/)

样式入口 `style.css` 必须保证其引入顺序，任何新的组件样式必须按相应归口放入子样式表中，严禁直接写入 `style.css`：

```css
/* style.css 加载层级顺序 */
@import "./variables.css";     /* 1. 全局设计 Token 变量（颜色、间距、字体） */
@import "./base.css";          /* 2. 基础浏览器 Reset 与排版重置 */
@import "./layout.css";        /* 3. 顶层分栏网格布局规约 */
@import "./sidebar.css";       /* 4. 侧边栏及文件树组件样式 */
@import "./header.css";        /* 5. 面包屑与多标签页组件样式 */
@import "./editor.css";        /* 6. Monaco Editor 覆盖及 Markdown 双栏预览 */
@import "./dropdown.css";      /* 7. 底栏弹出菜单及 xterm 终端容器样式 */
@import "./statusbar.css";     /* 8. 底部系统状态栏组件样式 */
@import "./controls.css";      /* 9. 输入框、按钮、Toast 消息通知样式 */
@import "./modal.css";         /* 10. 模态确认对话框样式 */
@import "./theme-light.css";   /* 11. 明亮模式配色覆盖文件 */
@import "./responsive.css";    /* 12. 媒体查询响应式布局 (必须置于末尾以确保覆盖) */
```
