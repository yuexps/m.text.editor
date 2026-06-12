# 事件总线协议强类型参考 (EVENT_BUS.md)

`js/event_bus.js` 提供超轻量 Pub/Sub 机制，在前端解耦体系中定义所有的跨模块异步通信契约。

---

## 1. 强类型接口定义

```typescript
export interface EventPayloads {
  // --- 文件生命周期事件 ---
  /** 文件成功载入编辑器 */
  "file:opened": {
    path: string;            // 物理绝对路径
    content: string;         // 文件 UTF-8 文本内容
    language: string;        // 推导的 Monaco 语言 ID
    mtime: number;           // 后端返回的最后物理修改戳
    size: number;            // 物理文件字节大小
    encoding: string;        // 当前文件字符集
    isNew?: boolean;         // 是否为新建的未命名文件
    shouldSwitch?: boolean;  // 是否强制将标签页切至最前
  };
  /** 文件保存落盘成功 */
  "file:saved": {
    path: string;            // 写入的目标路径
    mtime: number;           // 原子写入后生成的新 mtime
    size: number;            // 原子写入后最新字节大小
  };
  /** 工作区文件树节点被选中 */
  "file:selected": {
    path: string;            // 选中节点的绝对路径
    isEditMode: boolean;     // 容器当前的只读/编辑态
  };
  /** 用户点击或程序发起打开文件的请求 */
  "file:open-request": {
    path: string;            // 需载入的绝对路径
    isNew?: boolean;         // 是否为临时空文件
  };
  /** 触发文件保存指令请求 (如 Ctrl+S) */
  "file:save-request": void;

  // --- 多标签管理事件 ---
  /** 活动标签页切换激活 */
  "tab:activated": {
    model: any;              // Monaco TextModel 实例
    viewState: any;          // Monaco 视图滚动及光标锁存状态
    languageId: string;      // 语言 ID
    path: string;            // 活动文件的绝对物理路径
    currentEncoding: string; // 当前工作区选择的字符集
    originalEncoding: string;// 刚载入时的原始物理字符集
    originalContent: string; // 载入时的原始文本内容 (用于脏检测对比)
  };
  /** 所有标签页关闭，编辑器变为空 */
  "tab:emptied": void;

  // --- 模式与字符集状态变更 ---
  /** 只读/编辑模式切换同步 */
  "mode:changed": {
    isEditMode: boolean;     // 切换后的编辑态
  };
  /** UI 发起模式切换请求 */
  "mode:toggle-request": void;
  /** 字符编码被用户变更 */
  "encoding:changed": {
    oldEncoding: string;     // 改变前的字符集编码
    totalDirty: boolean;     // 当前文档的脏状态
  };

  // --- 工作区控制 ---
  /** 用户手动刷新文件树 */
  "workspace:refresh-request": void;
  /** 根目录变更，重新装载工作区 */
  "workspace:load-request": string; // 目标工作区目录的绝对路径

  // --- 侧边栏及辅助窗口 ---
  /** 请求展开侧边栏并切到指定面板 */
  "sidebar:panel-request": "explorer" | "search" | "terminal" | "settings";
  /** 请求折叠侧边栏 */
  "sidebar:collapse-request": void;

  // --- 系统全局配置与状态 ---
  /** 设置发生改变，触发相关子组件重绘 */
  "settings:changed": Record<string, any>; // 配置键值对快照
  /** 更新状态栏状态文本 */
  "status:updated": {
    text: string;            // 展示文本
    color?: string;          // 文本颜色代码 (如 "var(--text-error)")
  };
  /** 全局状态快照变更通知 */
  "state:changed": any;      // AppContext 状态快照
}
```

---

## 2. 请求型事件 (Request-Response Pattern) 规约

前端为了保持状态机在 `app.js` 统一归口，广泛使用 `*-request` 模式：

```
子组件 (如 Tab) ──► emit("file:save-request") ──► app.js 监听到请求 ──► 调用 FileIO.saveFile()
                                                                              │
                                                                       成功原子写入后
                                                                              │
子组件 (如 Tab) ◄── 监听到事件并重置脏状态 ◄─── emit("file:saved", payload) ◄────┘
```

### 约束要求
* **异步时序上限**：任何由 `*-request` 触发的底层 API 调用，其 Promise 超时强制归口为 30s。若超时未响应，`app.js` 必须发射 `status:updated` 抛出超时异常，并复位请求状态锁。
* **解耦禁止**：子组件与子模块之间**严禁**直接相互引入对方实例。一切通信必须通过 `eventBus.emit` 广播或 `*-request` 指令转发，实现物理上的松耦合。

---

## 3. 订阅生命周期与内存泄漏防御

所有 EventBus 的订阅行为都必须注册至统一的 `disposableStore`，在销毁时集中调用，防御事件监听泄漏造成的幽灵执行：

```javascript
import { eventBus } from './event_bus.js';
import { createDisposableStore } from './utils.js';

export class FeatureModule {
  constructor() {
    this.disposables = createDisposableStore();
    
    // 注册订阅并托管生命周期
    this.disposables.add(
      eventBus.on('file:opened', (data) => this.handleOpen(data))
    );
  }

  dispose() {
    // 强制释放所有托管的事件监听器
    this.disposables.dispose();
  }
}
```
