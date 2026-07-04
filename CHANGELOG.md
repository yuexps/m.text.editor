# 变更日志 (CHANGELOG.md)

本文件用于记录 PodNote 项目的所有版本迭代、功能修改、问题修复和架构调整。所有 Agent 和开发者在完成代码修改后，均需在此记录变更。

## [1.3.7] - 2026-07-04
- **执行人**: Agent (Antigravity)
- **类型**: [修复]
- **受影响模块**: 前端 UI
- **变更明细**:
  - **修复终端重连后的光标重合与内容叠行缺陷**：重构 `./build/app/www/js/terminal.js` 中的重连前置逻辑。重连时向终端写入物理换行和隔离标识（`\r\n--- 终端已重连 ---\r\n`），并在建立 WebSocket 前同步调用 `fit()` 拟合窗口物理尺寸，确保初始传递尺寸与物理窗口一致，规避因延迟执行尺寸重拟合触发 XTerm 缓冲区 Reflow 导致的光标重合，同时保留前序会话的输出缓冲区。
  - **更新项目避坑规约文档**：在 `./docs/AGENT_QUICKREF.md` 中增补“终端重连隔离与拟合规约”以指导后续维护。
  - **递增版本号至 1.3.7**：更新 `./build/manifest` 应用版本信息以刷新浏览器静态资源缓存。

## [1.3.6] - 2026-07-04
- **执行人**: Agent (Antigravity)
- **类型**: [修复] / [新增] / [优化]
- **受影响模块**: 前端 UI / Go 后端 / JS 逻辑层 / 仿真测试服务
- **变更明细**:
  - **修复 Markdown 同步滚动卡顿回抖**：在 `./build/app/www/js/markdown.js` 中基于物理输入事件（鼠标移入、滚轮、按键）重构了单向锁机制，彻底消除因定时器防抖引起的双向滚动 Ping-Pong 回抖。
  - **新增终端跟随工作区路径启动**：前端在连接终端时附加非虚拟工作区参数，后端在启动 PTY 时对其执行安全清洗与防逃逸拦截，使终端默认定位至当前工作区。
  - **新增终端一键定位当前文件目录按钮**：在底栏右上角新增靶心定位按钮，点击即可提取当前编辑文件的父目录并触发终端重连。
  - **新增终端 Git 常用命令快捷菜单与所有权异常规避**：右上角引入 Git 菜单按钮，预置 8 个按常用频次排序且带淡色中文注释的 Git 常用指令，点击仅填入文本支持二次编辑。修复了因样式继承导致高度折叠为 0 的定位 Bug，并于 `./build/app/www/css/responsive.css` 中追加窄屏和触控适配。同时，后端在启动 PTY 终端时向进程环境变量中强制注入了 `safe.directory=*` 临时 Git 命令行配置，从而完美规避了容器内外用户 UID/所有权不一致导致的 `dubious ownership` 保护机制导致 `git` 失效的问题。
  - **优化主页免底栏挤压变形体验**：将主页 `#welcome-overlay` DOM 节点移至总编辑区 `.editor-area` 下并调整 `z-index`，使得当展开底栏终端时，主页在背景中保持大小及位置纹丝不动，仅下半部分被底栏正常覆盖。
  - **修复 Tail 日志监听后台超时断连问题**：在 `./build/app/www/js/tail.js` 中引入 `visibilitychange` 监听，在页面切回前台时自动清零尝试计数并触发自愈连接；同步升级健康连接校验为 `WebSocket.OPEN` 状态校验以防假活误判。
  - **支持识别和读取所有隐藏文件/文件夹**：废除 `./src/handlers.go` 目录列表接口中一刀切的硬编码隐藏文件过滤规则。现在 `.git`、`.gitignore`、`.env`、`.github` 等所有项目级隐藏文件/目录均完全可见并支持编辑。
  - **递增版本号至 1.3.6**：更新 `./build/manifest` 版本信息以刷新浏览器端静态资源缓存。

## [1.3.5] - 2026-06-23
- **执行人**: Agent (Antigravity)
- **类型**: [修复]
- **受影响模块**: 前端 UI / JS 逻辑层
- **变更明细**:
  - 修复PC端自动切换编辑模式页面初始加载未生效的 Bug：在 `./build/app/www/js/tabs.js` 的 `switchTab` 函数中，为保存切换前活动标签页状态的逻辑增加了 `currentPath !== path` 条件判断。这避免了在页面初始化时由于 `AppContext` 的默认只读状态（`false`）误将新建标签页的自动编辑状态（`true`）覆盖为只读，彻底解决了首屏加载文件时无法自动启用编辑模式的问题。
  - 递增 `./build/manifest` 中的应用版本号至 `1.3.5`，确保飞牛OS容器部署后浏览器端缓存能正确刷新失效。

## [1.3.4] - 2026-06-18
- **执行人**: Agent (Antigravity)
- **类型**: [新增] / [修改] / [修复] / [重构]
- **受影响模块**: 前端 UI / CSS 样式 / JS 逻辑层 / 项目文档
- **变更明细**:
  - 全局屏幕安全区适配：`./build/app/www/index.html` 追加 viewport-fit=cover；`header.css`/`sidebar.css`/`statusbar.css`/`editor.css`/`layout.css` 各布局增加安全区内边距；`./build/app/www/js/ui/sidebar.js` 修正下拉菜单偏移；`responsive.css` 补齐安全区变量兜底。
  - Monaco编辑器优化：`./build/app/www/app.js` 区分设备调整行装饰宽度避免误触，新增圆角选区、平滑光标、缩进辅助线等视觉配置，汉堡菜单替换原生查找组件。
  - 内存与异常修复：`./build/app/www/js/tabs.js` 释放TextModel解决内存泄漏；`./build/app/www/js/tail.js` 拦截预览/主页非法文件监听；`app.js`、`./build/app/www/js/ui/manager.js` 修复主页状态栏文字显示bug；`./build/app/www/js/terminal.js` 精简正常连接提示，仅保留报错日志。
  - 底部状态栏重构：`./build/app/www/statusbar.css` 给状态项固定宽度防抖动，分割线改用伪元素渲染，新增.disabled置灰样式，统一错误面板尺寸；`./build/app/www/index.html` 调换左侧状态节点顺序；`responsive.css` 压缩移动端状态栏尺寸；`./build/app/www/js/ide_core.js` 主页/预览页隐藏冗余状态栏组件、终端面板切换时精简状态栏；`./build/app/www/js/ui/feedback.js` 主页隐藏面包屑，改用类名控制置灰。
  - 状态栏文本完整性与可用性修复：在 `./build/app/www/js/ui/filetree.js` 中的新建文件异常处理分支（移动端与PC端）中，补充了 `updateStatus` 状态重置，防止文件创建失败时底栏文字卡死在“正在创建文件...”；在 `./build/app/www/app.js` 的 `tab:activated` 回调中增加了状态栏状态文本的复位更新（根据新 Tab 类型同步为“准备就绪”、“准备新建”或“已加载”），彻底解决多标签页切换时底栏状态文案残留的 bug。

## [1.3.3] - 2026-06-16
- **执行人**: Agent (Antigravity)
- **类型**: [新增] / [修改]
- **受影响模块**: Go 后端 / 前端 UI / CSS 样式 / 依赖组件
- **变更明细**: 
  - 支持多媒体与文档的轻量只读预览：新增对图片（PNG/JPG/WEBP 等）、音频（MP3/WAV/OGG 等）、PDF 以及 Office（Word docx 文本提取、Excel xlsx 极简工作表）的纯前端轻量化预览支持。
  - 实现后端 raw 原始流响应：在 `./src/handlers.go` 的 `handleRead` 接口前置加入了 `raw=true` 参数拦截，跳过转码和大文件体积校验，直接通过 `http.ServeFile` 流式输出经安全检验的原始物理文件，打通媒体文件加载链路；同时在 `./test/scratch/mock_server.js` 仿真服务器中同步实现了此逻辑以方便本地离线开发测试。
  - 改造 Tab 切换控制：在 `./build/app/www/js/tabs.js` 和 `./build/app/www/js/file_io.js` 中改造了 `loadFile`、`openTab` 与 `switchTab` 核心逻辑，拦截预览文件的 Monaco Model 创建流程，根据活动页签类型动态在编辑器与预览容器之间进行隐藏、显露和防错位重构自适应 layout 调整。
  - 文件树特色图标适配：修改了 `filetree.js` 中的 `createTreeItem` 逻辑，识别常见多媒体、文档与代码文件的扩展名。在文件树节点中针对图片（PNG/JPG 等）、音频（MP3 等，采用最新带音符文件款式）、PDF、Word (docx) 以及 Markdown (md/markdown)、CSS (css/scss/less)、JavaScript (js/ts/jsx/tsx) 文件分别渲染用户提供的高精细度专属矢量 SVG 图标，极大提升了文件管理侧边栏的视觉精致感与区分度。
  - 底部问题/终端控制面板主题自适应：重构了 `statusbar.css` 中的底部控制面板 `.bottom-panel` 的配色逻辑。移除了硬编码的深灰背景（`#1e1e1e`）、边框（`#2b2b2b`）和文本前景色，全部映射并绑定为系统标准主题变量（如 `var(--bg-color)`、`var(--border-color)`、`var(--text-color)`）；同时专门对亮色模式下的控制按钮 Hover 状态及问题列表行的选中高亮进行了微调，彻底解决亮色主题下底栏面板界面风格突兀与色彩未对齐的缺陷。
  - 亮色主题样式收拢重构与弹出面板优化：将此前分散在 `./build/app/www/css/layout.css`、`./build/app/www/css/statusbar.css`、`./build/app/www/css/header.css`、`./build/app/www/css/controls.css` 和 `./build/app/www/css/dropdown.css` 中的所有明亮模式微调样式块彻底剥离纯净化，并统一合流合并写入 `./build/app/www/css/theme-light.css` 尾部。深度优化了语言、编码、换行符等弹出面板（`.lang-panel`）与子项（`.lang-item`）在亮色下的色彩和对比度可读性。
  - 更新项目主页致谢：在 `./README.md` 的致谢版块中，追加了为多媒体只读预览功能所引入的第三方依赖库 `mammoth.js` 与 `SheetJS` 链接。
  - 缩减底栏面包屑点击复制路径的物理响应区域：将 `./build/app/www/css/statusbar.css` 中面包屑 `.status-breadcrumbs` 容器的宽度自适应化（由 `width: 100%` 改为 `display: inline-block` + `max-width: 100%`），使鼠标 Hover 效果及点击复制响应范围精确收缩于文字本身，避免点击两侧空白区域误触复制。
  - 避免手动请求打开文件路径时产生 400 Bad Request 控制台红色报错：在 `./build/app/www/js/ui/manager.js` 的 `handleManualOpen` 函数中引入了启发式文件名后缀预判，如果输入的路径含有文件扩展名，则优先直接发起文件打开与工作区目录加载请求，避开了直接对文件调用目录列表接口（`/api/list`）导致后端返回类型不匹配 HTTP 错误码的冗余报错流程。
  - 将 `#welcome-overlay` 从 `#editor-container` 移至外层平级 (修改 `./build/app/www/index.html`)。
  - 标签页管理器支持虚拟协议 `podnote://welcome`（“主页”），并在切换时控制其显隐分流 (修改 `./build/app/www/js/tabs.js`)。
  - 优化关闭最后一个页签时的兜底重建主页逻辑 (修改 `./build/app/www/js/tabs.js`)。
  - 重构初始化和 `file:selected` 过滤，取消对 `tab:emptied` 事件的监听 (修改 `./build/app/www/app.js`)。
  - 支持在无路径或切换到主页时清空文件树所有高亮 (修改 `./build/app/www/js/file_io.js`)。
  - 递增应用版本号至 `1.3.4` (修改 `./build/manifest`)。
  - 标注 `tab:emptied` 事件为已废弃 (修改 `./docs/EVENT_BUS.md`)。
  - 将虚拟协议防穿透隔离条款写入项目约束规范 (修改 `./AGENTS.md` 与 `./docs/AGENT_QUICKREF.md`)。
  - 新增终端面板模式展示设置：支持用户选择“悬浮遮罩”或“分隔布局”，配置字段为 `terminalPanelMode`，并在此模式切换后自动重算 Monaco 与 xterm 尺寸自适应排版 (修改 `./build/app/www/index.html`、`./build/app/www/js/settings.js`、`./build/app/www/css/statusbar.css`)

## [1.3.2] - 2026-06-15
- **执行人**: Agent (Antigravity)
- **类型**: [重构]
- **受影响模块**: 前端 UI / CSS 样式 / JS 逻辑层
- **变更明细**: 
  - 迁移终端到通用底部控制面板：将终端从狭窄的左侧侧栏中彻底移出。重构了 `./build/app/www/index.html`，升级原底部问题面板为通用多页签控制面板 `.bottom-panel`，支持“问题”与“终端”页签随时点击切换，并为其配置独立的终端重连按钮。
  - 实现底部面板绝对定位悬浮：在 `./build/app/www/css/statusbar.css` 中将 `.bottom-panel` 的定位配置为 `position: absolute; bottom: 0;`。面板以悬浮层遮罩的形式叠在编辑器最底端，在展开和拉伸时不挤压和顶缩主页面代码编辑区。
  - 支持面板高度鼠标垂直拖动调整：在 `./build/app/www/index.html` 的面板最上方边缘引入了 4px 的 `#panel-resizer` 拖拽轨道，并在新建的 `./build/app/www/js/ui/bottom_panel.js` 中编写了 `BottomPanelManager` 控制器，利用 `requestAnimationFrame` 节流对拖拽事件进行高帧率响应，在拉伸期间联动重计算终端行列（`TerminalManager.resize()`），限制拉伸高度范围为 100px 到 80% 屏幕高度，向下拖动低于 50px 自动折叠。
  - 清理侧栏遗留代码：在 `./build/app/www/js/ui/sidebar.js`、`manager.js` 中去掉了对终端侧栏状态的控制与侧栏拉伸的干涉判断；将活动栏终端图标的点击行为重绑定为切换底部面板终端页签；在 `./build/app/www/css/dropdown.css` 中彻底删除了已废弃的 `#sidebar-terminal` 相关的历史残留 CSS。
  - 优化移动端窄屏交互（侧栏与底栏互斥折叠）：针对窄屏设备中侧栏展开会重叠遮挡底部面板的体验缺陷，在 `./build/app/www/js/ui/bottom_panel.js` 与 `sidebar.js` 中引入互斥折叠逻辑——在窄屏（移动端）设备下，展开侧栏时会自动折叠隐藏底部面板，反之展开底栏时会自动折叠侧边栏，彻底消除重叠遮挡。
  - 升级应用缓存失效版本戳：在 `./build/manifest` 中升级版本号为 `1.4.0`，通知浏览器重新拉取重构后的 CSS 与 JS 静态文件。

## [1.3.2] - 2026-06-15
- **执行人**: Agent (Antigravity)
- **类型**: [修复]
- **受影响模块**: 前端 UI / CSS 样式
- **变更明细**: 
  - 修复终端无法右键粘贴及选中文本的问题：在 `./build/app/www/css/dropdown.css` 中将 `.xterm-viewport` 的宽度限制在右侧滚动条区域（`17px`），并将其贴右对齐（`left: auto !important`），避免其透明覆盖层遮挡终端核心区域，完美解决右键菜单粘贴拦截与滚动条可拖拽性的冲突。
  - 修复终端底行内容渲染到底部可见区域外的问题：在 `./build/app/www/index.html` 中重构 DOM 结构，在带 padding 的外层容器 `.terminal-body-container` 下新增无 padding 的干净子容器 `#terminal-container` 用以专门挂载终端，并在 `./build/app/www/css/dropdown.css` 中定义其宽高 100% 铺满，彻底消除 padding 对 xterm.js 视口及行数计算的干扰。
  - 递增 `./build/manifest` 中的版本号至 `1.3.2`，确保浏览器端缓存能正确刷新失效。

## [1.3.1] - 2026-06-15
- **执行人**: Agent (Antigravity)
- **类型**: [优化]
- **受影响模块**: Go 后端 / 前端 UI
- **变更明细**: 
  - 提升文件加载限制：将 Go 后端大文件限制从硬编码的 10MB 提升至 50MB。
  - 实现超大文件末尾截断：在 `./src/handlers.go` 的 `handleRead` 中，对于大于 50MB 的文件在后端自动 Seek 定位并仅截断读取末尾 2MB，在 `./src/models.go` 的 `Response` 结构中新增 `is_truncated` 标志，并丢弃转码后首行可能不完整的数据以保证日志显示整洁。
  - 引入大文件只读与特性自动降级：修改了 `./build/app/www/js/tabs.js` 与 `./build/app/www/app.js`，对于 20MB 以上的大文件或截断预览文件，在创建或设置 Monaco Model 时强制以 `plaintext`（纯文本）加载以避免高亮解析阻塞。在 Tab 激活时，通过 `editor.updateOptions` 自动关闭缩略图（minimap）、代码折叠（folding）、自动换行（wordWrap）并强制设为只读模式（readOnly）。
  - 拦截只读编辑模式切换：在 `./build/app/www/js/file_io.js` 的 `setEditMode` 中，判断为大文件时拦截编辑按钮交互，给出 Toast 降级提示，彻底保障大文件下的编辑器性能与流畅度。
  - 修复大文件 Toast 提示问题：修复了初始化预加载大文件时丢失状态标记导致未能应用优化的缺陷，并将性能降级提示标记绑定至持久的 Tab 实例上，避免切换 Tab 时重复弹出 Toast。
  - 修复编辑按钮竞态状态覆盖问题：在 `./build/app/www/app.js` 的 `file:selected` 监听器中，由于 `updateUIState` 默认覆写，导致 `tab:activated` 的按钮置灰设置失效。已在 `file:selected` 后置逻辑中追加判断，为大文件强制实施置灰及禁用属性拦截（`disabled = true`, `opacity = '0.4'`, `pointerEvents = 'none'`）。
  - 支持自定义 Toast 持续时间：重构了 `./build/app/www/js/ui/feedback.js` 的 `showToast`，新增 `duration` 可选参数，并将大文件相关的只读和截断提示时长延长至 6 秒（6000ms），提升关键长文本警告的阅读体验。

## [1.3.1] - 2026-06-12
- **执行人**: Agent (Antigravity)
- **类型**: [新增]
- **受影响模块**: 项目文档
- **变更明细**: 
  - 建立 `./docs/` 技术文档目录，包含 7 篇 Agent 专用文档：[INDEX.md](./docs/INDEX.md)（总索引）、[ARCHITECTURE.md](./docs/ARCHITECTURE.md)（系统架构详解）、[BACKEND_API.md](./docs/BACKEND_API.md)（后端 API 参考）、[FRONTEND_MODULES.md](./docs/FRONTEND_MODULES.md)（前端模块详解）、[EVENT_BUS.md](./docs/EVENT_BUS.md)（事件总线协议）、[CHROME_EXTENSION.md](./docs/CHROME_EXTENSION.md)（浏览器扩展详解）、[BUILD_DEPLOY.md](./docs/BUILD_DEPLOY.md)（构建与部署指南）、[AGENT_QUICKREF.md](./docs/AGENT_QUICKREF.md)（Agent 快速参考）
  - 更新 [AGENTS.md](./AGENTS.md) 模块地图，新增技术文档索引入口
  - 删除前端冗余配置文件 `./build/app/www/package.json`、`./build/app/www/package-lock.json`、`./build/app/www/globals.d.ts`
  - 重构全部目录级 README，瘦身为文件索引 + 编码约定 + 指向 `docs/` 的深度参考链接：`src/README.md`、`build/README.md`、`chrome_extension/README.md`、`test/README.md`、`build/app/www/README.md`、`build/app/www/js/README.md`、`build/app/www/css/README.md`、`build/app/www/plugins/README.md`
  - 优化 [AGENTS.md](./AGENTS.md)，新增“核心决策与开发习惯准则”章节，明确要求遵守第一性原理决策、约束先行、结论先行以及开发规范红线。

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
