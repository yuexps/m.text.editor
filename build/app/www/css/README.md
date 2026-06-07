# 样式表子模块说明文档 (build/app/www/css/)

PodNote 前端样式已按业务职责进行彻底拆分，并通过根目录下的 `style.css` 进行汇聚。

---

## 1. 样式表加载层级与架构

为了确保 CSS 样式的正确继承与覆盖，样式表在汇聚入口中严格遵循以下载入顺序：

| 加载顺序 | 样式文件名 | 对应职责说明 |
| :--- | :--- | :--- |
| 1 | [variables.css](./variables.css) | **全局变量与主题配色**。定义调色板、圆角、字号等 Token。 |
| 2 | [base.css](./base.css) | **基础重置样式**。HTML 标记重置及盒模型初始化。 |
| 3 | [layout.css](./layout.css) | **顶层布局结构**。workbench 容器、活动栏、侧边栏排版。 |
| 4 | [sidebar.css](./sidebar.css) | **侧栏专属样式**。包含文件树节点、伸缩 Resizer、侧栏搜索面板。 |
| 5 | [header.css](./header.css) | **头部控制区样式**。顶部菜单、操作按钮组和多标签页（Tab）排版。 |
| 6 | [editor.css](./editor.css) | **编辑器与预览区**。Monaco 容器及 Markdown 双栏实时预览排版。 |
| 7 | [dropdown.css](./dropdown.css) | **下拉菜单**。语言、编码、换行符选择面板及活动栏汉堡菜单。 |
| 8 | [statusbar.css](./statusbar.css) | **底部状态栏**。面包屑路径、光标定位及状态栏交互信息。 |
| 9 | [controls.css](./controls.css) | **通用 UI 控件**。Toast 弹窗提示、欢迎遮罩蒙层及各项输入框。 |
| 10 | [modal.css](./modal.css) | **自定义弹窗**。未保存退出时的 Modal 对话框。 |
| 11 | [theme-light.css](./theme-light.css) | **明亮模式皮肤适配**。管理非响应式专属的外观微调。 |
| 12 | [responsive.css](./responsive.css) | **响应式与移动端适配**。**必须置于最后**。集中管理所有 `@media` 查询。 |

---

## 2. 样式维护规范

1. **媒体查询归口**：移动端适配的 `@media` 样式，**一律写入 `responsive.css` 最底部**，严禁零散分布。
2. **使用变量**：多使用 CSS 变量（Variables）控制颜色切换，严禁在子模块中硬编码色值。
