# Chrome 浏览器扩展 (chrome_extension/)

---

## 1. 物理文件清单

| 文件名 | 物理链接 | 核心职责 |
|:---|:---|:---|
| manifest.json | [manifest.json](./manifest.json) | 扩展描述与运行配置清单 (遵循 Chrome Extension MV3 规范)。 |
| background.js | [background.js](./background.js) | 后台 Service Worker，负责控制域名注入匹配与防并发重复加载。 |
| inject_fnos.js | [inject_fnos.js](./inject_fnos.js) | MAIN world 注入脚本：路径锁存、右键菜单渲染、工具栏新建、多窗口管理及幽灵模式。 |
| popup.html | [popup.html](./popup.html) | 扩展控制台前端面板：用于配置白名单域名、控制开关及展示实时调试日志。 |
| popup.js | [popup.js](./popup.js) | 控制台交互控制器：支持 Tab 级日志隔离与匹配规则热加载。 |
| ICON.PNG | [ICON.PNG](./ICON.PNG) | 扩展工具栏展示图标。 |

---

## 2. 核心架构约束

* **双 World 通信约束**：MAIN world 中运行的注入脚本严禁直接调用 `chrome` api。一切扩展级的数据交互必须经过 `CustomEvent` 进行 ISOLATED 桥接。
* **DOM 防离线保护**：必须在右键 `contextmenu` 事件捕获阶段进行路径和目标锁定，杜绝 React 状态更新销毁 DOM 导致路径指针失效。

---

## 3. 技术文档超链接

* 页面 DOM 面包屑路径探测算法、双 World 隔离通信与窗口管理器 → [docs/CHROME_EXTENSION.md](../docs/CHROME_EXTENSION.md)
