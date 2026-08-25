# 全局状态管理规范 (STATE_MANAGEMENT.md)

在 React 重构版本中，原有的 EventBus 事件总线已全面升级为基于 **Zustand (`frontend/src/store/useAppStore.ts`)** 的现代化响应式单向数据流。

---

## 1. 全局状态契约 (AppState)

```typescript
export interface AppState {
  // 核心工作区与文件状态
  workspacePath: string;
  workspaceFiles: FileItem[];
  tabs: TabItem[];
  activeTabPath: string;
  isEditMode: boolean;
  theme: "dark" | "light";

  // 云端与本地配置
  settings: AppSettings;

  // 界面交互状态
  sidebarWidth: number;
  activeSidebarPanel: "explorer" | "search" | "settings" | null;
  activeBottomPanelTab: "problems" | "terminal" | null;
  bottomPanelHeight: number;
  isTouchBarUserEnabled: boolean;
  isFnosAvailable: boolean;

  // 诊断、通知与全局弹窗
  problems: { severity: "error" | "warning"; message: string; line?: number; column?: number }[];
  toast: { message: string; isError: boolean; id: number; duration?: number } | null;
  modal: ModalConfig;
}
```

---

## 2. 状态驱动与 Action 规约

* **标签页生命周期**：
  - `openTab(tab, shouldSwitch)`: 开启新文件标签，自动去重并恢复 viewState。
  - `closeTab(path)`: 销毁指定标签，若全部关闭则自动挂载 `podnote://welcome` 虚拟主页。
  - `updateTabContent(path, content)`: 输入时实时更新内存缓存，联动 `isDirty` 标记。
* **双向数据绑定与热配置**：
  - `updateSetting(key, value)`: 立即更新本地界面，并以 400ms 防抖持久化至云端。
* **全局无阻塞弹窗契约**：
  - `showConfirm(message, title): Promise<boolean>`: 替代原生 `window.confirm`。
  - `showPrompt(message, defaultValue, title): Promise<string | null>`: 替代原生 `window.prompt`。
