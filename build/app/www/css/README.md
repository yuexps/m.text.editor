# 样式表子模块 (build/app/www/css/)

---

## 1. 物理文件清单与加载时序

样式入口 `style.css` 通过 `@import` 按以下严格物理顺序加载子样式文件：

| 序号 | 样式文件名 | 物理链接 | 职责 |
|:---:|:---|:---|:---|
| 1 | variables.css | [variables.css](./variables.css) | 全局 CSS 变量与主题设计 Token。 |
| 2 | base.css | [base.css](./base.css) | 基础标签 Reset 与排版重置。 |
| 3 | layout.css | [layout.css](./layout.css) | Workbench、活动栏、侧边栏三栏网格布局。 |
| 4 | sidebar.css | [sidebar.css](./sidebar.css) | 侧栏工具箱与文件树节点排版。 |
| 5 | header.css | [header.css](./header.css) | 面包屑与多标签 Tab 页排版。 |
| 6 | editor.css | [editor.css](./editor.css) | Monaco Editor 高亮微调与 Markdown 同步预览组件。 |
| 7 | dropdown.css | [dropdown.css](./dropdown.css) | 下拉选择卡片与 PTY xterm.js 终端容器样式。 |
| 8 | statusbar.css | [statusbar.css](./statusbar.css) | 底部系统状态栏组件及项高亮。 |
| 9 | controls.css | [controls.css](./controls.css) | 输入框、按键、Toast 通知横幅样式。 |
| 10 | modal.css | [modal.css](./modal.css) | 模态确认对话框遮罩及主体排版。 |
| 11 | theme-light.css | [theme-light.css](./theme-light.css) | 明亮配色方案的强制变量覆盖。 |
| 12 | responsive.css | [responsive.css](./responsive.css) | 全局移动端与窄屏媒体查询（**必须最后加载**）。 |

---

## 2. 核心架构约束

* **禁止就地 `@media`**：子组件样式文件中禁止书写任何 `@media` 查询代码。所有窄屏适配必须统一写入 `responsive.css` 的最末尾。
* **设计 Token 隔离**：严禁在非 `variables.css` 的地方硬编码色值。一切颜色表现必须通过 CSS 变量间接引用。

---

## 3. 技术文档超链接

* 样式表层级关系、加载依赖顺序与设计 Token 说明 → [docs/FRONTEND_MODULES.md](../../../../docs/FRONTEND_MODULES.md) §3
