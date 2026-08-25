# React 前端架构与模块规范 (FRONTEND_MODULES.md)

前端基于 **React 19 + TypeScript + Zustand + Monaco Editor + Tailwind CSS** 构建，采用单向数据流与响应式 Store 进行全局状态管理。

---

## 1. 状态管理层 (`frontend/src/store/useAppStore.ts`)

### 1.1 核心类型定义
```typescript
export type PreviewType = "image" | "audio" | "pdf" | "docx" | "xlsx";

export interface TabItem {
  path: string;
  name: string;
  content: string;
  originalContent: string;
  encoding: string;
  originalEncoding: string;
  mtime: number;
  isNew: boolean;
  languageId: string;
  viewState: any; // Monaco Editor ICodeEditorViewState
  previewType?: PreviewType | null;
  isHugeFile?: boolean;
  isTruncated?: boolean;
}

export interface AppSettings {
  defaultOpenPath: string;
  pcAutoEditMode: boolean;
  fontSize: number;
  fontFamily: string;
  wordWrap: "on" | "off";
  minimap: boolean;
  readOnlyTail: boolean;
  tabSize: number;
  renderWhitespace: "none" | "boundary" | "all";
  editorTheme: "vs-dark" | "vs" | "hc-black";
  uiTheme: "dark" | "light";
  terminalFontSize: number;
  terminalCursorStyle: "block" | "bar";
  terminalCursorBlink: boolean;
  terminalUser: "root" | "current";
}
```

### 1.2 全局 Store Actions
* `openTab(tab, shouldSwitch)`: 打开或激活标签页。
* `closeTab(path)`: 关闭标签页，无标签时自动激活 `podnote://welcome` 虚拟主页。
* `saveTabMetadata(path, mtime, isNew, content, encoding)`: 更新存盘后的元数据与状态。
* `updateSetting(key, value)`: 响应式热更新本地配置并防抖同步至云端。
* `showToast(message, isError, duration)`: 全局淡入淡出气泡提醒。
* `showConfirm(message, title)` / `showPrompt(message, defaultValue, title)`: 基于 Promise 的全局无阻塞模态对话框。

---

## 2. 核心组件层 (`frontend/src/components/`)

### 2.1 布局与导航
* **`App.tsx`**：主应用入口。负责 VisualViewport 软键盘高度适配、全局顶栏（包含 10 项汉堡菜单指令与快捷键）、工作台布局组装及模态对话框挂载。
* **`TabBar.tsx`**：多标签页栏。支持横向平滑滚动、内容溢出动态检测、滚动边界禁用置灰、脏数据标记与防穿透主页隔离。
* **`Sidebar.tsx`**：活动栏（ActivityBar）与侧边栏抽屉容器。支持宽度鼠标拖拽（150px ~ 600px）、双击 Resizer 快速折叠/展开、窄屏遮罩层与焦点失焦软键盘收起。

### 2.2 视图与编辑面板
* **`EditorArea.tsx`**：主编辑区。封装 Monaco Editor 实例绑定、单向物理滚动锁、主页欢迎页（含拓展检测安装卡片与智能路径分流）及只读大文件保护。
* **`FileTree.tsx`**：资源管理器树。支持异步子目录按需加载、纯原生精细矢量 SVG 图标、节点右键唤起 FNOS 文件管理器定位、PC 内联与移动端 Prompt 新建文件。
* **`SearchPanel.tsx`**：侧栏查找与替换。支持防抖匹配、全局正则搜索、关键词 `<mark>` 结果高亮与一键替换/全部替换。
* **`SettingsPanel.tsx`**：偏好设置中心。覆盖工作区、编辑器、主题皮肤、终端四大模块 15+ 项设置的双向数据绑定与实时热预览。
* **`BottomPanel.tsx`**：通用底部控制面板。包含语法问题诊断（点击跳转指定行列与 Hover）和交互式终端（xterm.js + PTY，Git 快捷指令填入，移动端 14 键 TouchBar 工具栏）。
* **`StatusBar.tsx`**：底部状态栏。动态读取 Monaco 全量 80+ 种语言列表、10+ 种编码切换置脏、面包屑路径点击复制与多媒体预览自适应。
* **`MediaPreview.tsx`**：多媒体/Office 预览组件。支持图片缩放、音频黑胶旋转动效、PDF iframe 渲染、Word (`.docx` via mammoth) 与 Excel (`.xlsx` 多工作表 via SheetJS)。
* **`ConfirmModal.tsx`**：全局自定义暗黑/明亮自适应模态对话框。

---

## 3. 服务与辅助插件 (`frontend/src/services/` & `plugins/`)

* **`api.ts`**：前后端 HTTP API 与 WebSocket 路由封装。
* **`fileIO.ts`**：文件加载/保存/新建调度层，包含大文件保护、编码自动探测、虚拟路径防穿透隔离及智能路径分流。
* **`fnosSDK.ts`**：飞牛OS 微应用容器桥接（文件选择器、文件管理器右键定位、窗口标题同步、离开页面防丢失拦截）。
* **`plugins/monacoTouchHelper.ts`**：移动端触控光标微调与选词气泡辅助插件。
* **`plugins/monacoKeyboardBlocker.ts`**：移动端只读模式阻断呼出软键盘插件。
* **`hooks/useFileWatch.ts`**：只读模式下的底层文件变更 WebSocket 实时监听与 Tail 追加机制。
