# 变更日志 (CHANGELOG.md)

本文件用于记录 PodNote 项目的所有版本迭代、功能修改、问题修复和架构调整。所有 Agent 和开发者在完成代码修改后，均需在此记录变更。

## [1.2.9] - 2026-06-08
- **执行人**: Agent (Antigravity)
- **类型**: [修复] / [优化]
- **受影响模块**: 前端 UI / 移动端与窄屏适配 / CSS 样式
- **变更明细**: 
  - 修复终端重连时旧连接 `onclose` 事件污染新连接从而触发无限自愈重连的 Bug。在 WebSocket 回调函数中增加了一致性校验，自动忽略已被新连接替换的旧连接回调。
  - 修复终端右侧滚动条无法点击或拖动的问题。在 [dropdown.css](./build/app/www/css/dropdown.css) 中将 `.xterm-viewport` 的 `z-index` 提升为 `10`，并将其背景颜色设为 `transparent`，以防点击事件被终端屏幕（canvas）拦截捕捉。
  - 修复终端右侧滚动条上下极限在视觉上不对称的问题。在 [dropdown.css](./build/app/www/css/dropdown.css) 中对 `.xterm-viewport`应用 `top` 与 `bottom` 负偏移量以抵消外层 `.terminal-body-container` 的 `padding-bottom` 限制。
  - **侧边栏与终端移动端适配与防错乱优化**：
    - 在 [responsive.css](./build/app/www/css/responsive.css) 中将状态栏底端与系统安全区（`env(safe-area-inset-bottom)`）对齐并自适应撑高，同时为终端容器禁用系统自动字体放大，锁定字符渲染比例防止重叠。
    - 在 [ui.js](./build/app/www/js/ui.js) 中加入对整个侧边栏的 `visualViewport` 动态监听，在虚拟键盘弹出时上提收缩侧栏底部定位以避开遮挡，同时拦截并重置系统视口滚动，并在侧栏折叠时卸载监听。
    - 在 [terminal.js](./build/app/www/js/terminal.js) 中为终端容器绑定点击/触控事件以强制聚焦并拉起软键盘，并在尺寸调整时引入“即时 + 延时（200ms）”的双重自适应重绘机制，防御过渡动画期间尺寸失准导致的渲染错乱。

## [侧栏与移动端体验优化、Debian软链接支持、打包流程及规范更新、移动端气泡菜单修复] - 2026-06-05
- **执行人**: Agent (Antigravity)
- **类型**: [新增] / [修改] / [修复]
- **受影响模块**: Go 后端 / 前端 UI / CI-CD 工作流 / 项目规范与文档
- **变更明细**: 
  - **修复侧栏查找结果压缩**：在 [sidebar.css](./build/app/www/css/sidebar.css) 的 `.search-result-item` 中加入 `flex-shrink: 0;`，防止大量查找结果时高度被压缩。
  - **支持 Debian 软链接目录**：在 [models.go](./src/models.go) 与 [handlers.go](./src/handlers.go) 中解析软链接目录并重写 `is_dir` 属性为 `true`；在 [ui.js](./build/app/www/js/ui.js) 中为其绑定 `data-is-symlink` 并显示软链接 SVG 图标，解决软链接文件夹无法展开及读取错误的问题。
  - **前端与移动端细节优化**：在 [ui.js](./build/app/www/js/ui.js) 中将空文件夹提示缩进改为根据层级动态计算；优化 [dropdown.css](./build/app/www/css/dropdown.css) 中终端容器的 `padding-bottom` 为 `24px` 以免被状态栏遮挡；修复并重构汉堡菜单及底栏面板在外部点击时自动收起的逻辑，合并为统一的全局捕获阶段（pointerdown 与 click 双重事件）监听器，完美兼容移动端触摸及 PC 端点击 Monaco 编辑器内部的隐藏场景；在统一失焦事件监听器中加入底栏状态项（.status-item.clickable），修复底栏在移动端点击后焦点无法释放导致的高亮粘滞缺陷；在 [tabs.js](./build/app/www/js/tabs.js) 的脏状态计算中增加编辑模式（isEditMode）判定，修复只读模式下改变编码会被误判定为脏数据的 bug，并在 [app.js](./build/app/www/app.js) 中绑定编码改变（encoding:changed）事件对活动标签页脏状态（updateActiveTabDirty）的即时渲染；修复 [monaco_touch_helper.js](./build/app/www/plugins/monaco_touch_helper.js) 移动端气泡在选区为空或编辑器失焦时的残留问题。
  - **修复移动端气泡菜单**：在 [monaco_touch_helper.js](./build/app/www/plugins/monaco_touch_helper.js) 中新增 `bindBtn` 辅助函数，为按钮同时绑定 `touchend` 与 `click` 事件，解决触屏上气泡菜单点不动的问题；优化“全选”后的气泡处理，使其直接保持在原位置不动方便原地快速操作；优化手柄释放（`endDrag`）的逻辑，在获取坐标为 `null` 时添加延时 50ms 重新获取，且延时清除手柄的 `dragging` 状态，确保气泡百分百正常弹出，防止失焦引起的异步销毁冲突；利用 `onDidChangeCursorSelection` 的事件源类型判断（`e.source === 'mouse'`）来检测触屏上的原生双击或划选动作，同时引入 `lastTouchTime` 时间戳限制该气泡仅在 1 秒内有实际触屏交互时才自动弹出，完美防止普通 PC 鼠标双击或划选时的误触发。
