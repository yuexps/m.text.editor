# 变更日志 (CHANGELOG.md)

本文件用于记录 PodNote 项目的所有版本迭代、功能修改、问题修复和架构调整。所有 Agent 和开发者在完成代码修改后，均需在此记录变更。

## [1.3.0] - 2026-06-11
- **执行人**: Agent (Antigravity)
- **类型**: [优化] / [修复]
- **受影响模块**: 浏览器插件
- **变更明细**: 
  - 优化 DOM 监听性能：重构了 [inject_fnos.js](./chrome_extension/inject_fnos.js) 中的 `MutationObserver` 机制，放弃原有的全局 `querySelectorAll('div')` 遍历方案，改用 `addedNodes` 的局部增量节点扫描定位。
  - 增强右键菜单注入鲁棒性：添加限制只在确定是文件管理下的文件/目录行时才允许注入菜单，并在未来官方改版导致锚点元素（如“打开方式”）缺失时，支持直接将“使用 PodNote 编辑/打开”按钮降级安全注入至菜单的最顶部（首项）。
  - 重构失焦与幽灵模式逻辑：解耦原有“一失焦即自动降透明度并点击穿透”的设计，改为普通失焦仅微调透明度（0.9）和阴影并不开启穿透（可点击任意区域重新聚焦），只在用户主动点击“眼睛”按钮时才进入 0.3 透明度的幽灵模式。
  - 修复跨环境事件通信失效问题：由于页面的 `world: 'MAIN'` 环境无权直接调用扩展的 `chrome.runtime.sendMessage` API，重构了 [inject_fnos.js](./chrome_extension/inject_fnos.js) 中的 `notifyExtension` 逻辑，改为抛出 `podnote_status_event` 自定义事件。
  - 建立 Isolated 桥接：在 [background.js](./chrome_extension/background.js) 注入逻辑中新增在默认 `world: 'ISOLATED'` 环境下自动加载的轻量级桥接脚本，捕获并转发该自定义事件给扩展后台，恢复零延迟、低功耗的状态和日志推送。
  - 增加跨 Tab 日志隔离保护：修改了 [popup.js](./chrome_extension/popup.js) 的 `onMessage` 监听器，在接收到 `status_update` 时通过匹配 `sender.tab.id` 与当前活跃 Tab ID 来过滤消息，彻底避免多标签页并存时的日志和状态串扰。
  - 修复右键菜单直接注入失败 Bug：重构 [inject_fnos.js](./chrome_extension/inject_fnos.js)，在 `contextmenu` 事件触发瞬间“锁定”文件路径和所属窗口，防范 React 状态更新导致 DOM 节点离线（disconnected）而丢失路径引用；同时改用高效的专属选择器 `document.querySelector` 定位页面菜单容器，攻克了 React 异步填充菜单文字导致 `addedNodes` 检测遗漏的经典时序缺陷。

## [1.3.0] - 2026-06-10
- **执行人**: Agent (Qoder)
- **类型**: [重构]
- **受影响模块**: Go 后端 / 前端 UI
- **变更明细**: 
  - 在 ./src/utils.go 新增 writeFileAtomic() 公共函数，将 ./src/handlers.go 中 handleSave 与 handleSettings 的重复原子写入逻辑提取合并，减少约 40 行冗余代码
  - 加固 ./src/handlers.go handleWatchWS 的 goroutine 生命周期管理：done channel 改为 chan struct{} + close 模式，添加生命周期注释
  - 将 ./build/app/www/js/ui.js 中 22 处 onclick/onmousedown/ondblclick/onkeydown 赋值统一转为 addEventListener + uiDisposables 清理模式
  - 将 ./build/app/www/js/ui.js（约 1340 行）按职责拆分为 6 个独立子模块至 ./build/app/www/js/ui/ 目录：elements.js、dialog.js、feedback.js、filetree.js、sidebar.js、manager.js
  - 原 ui.js 改写为聚合导出器（re-export），保持所有外部模块的导入路径不变
  - 从 ./build/app/www/js/ui/manager.js (858行) 提取底栏选择面板逻辑至新建的 ./build/app/www/js/ui/statusbar.js
  - 将 manager.js 中文件树交互逻辑（点击展开/折叠、新建文件、刷新）合并进 ./build/app/www/js/ui/filetree.js
  - 从 ./build/app/www/app.js (593行) 提取文件加载/保存/新建业务逻辑至新建的 ./build/app/www/js/file_io.js
  - 优化 ./build/app/www/js/tabs.js，移除对 MarkdownManager 的直接依赖，通过 tab:activated/tab:emptied 事件解耦编辑器操作
  - 清理 ./build/app/www/js/ui.js barrel 文件中对 utils.js 的冗余透传


## [1.3.0] - 2026-06-08
- **执行人**: Agent (Codex)
- **类型**: [修复] / [优化]
- **受影响模块**: 前端 UI / Monaco 交互
- **变更明细**: 
  - 在 ./build/app/www/js/utils.js、./build/app/www/js/event_bus.js、./build/app/www/js/api.js 中补充防抖/节流、可释放订阅、请求超时、重试与错误归一化。
  - 在 ./build/app/www/app.js、./build/app/www/js/tabs.js、./build/app/www/js/ui.js、./build/app/www/js/markdown.js、./build/app/www/js/search.js、./build/app/www/js/settings.js 中加固文件加载竞态、Tab 生命周期、监听释放、Markdown 渲染序号与 600px 抽屉侧栏断点。

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
