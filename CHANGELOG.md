# 变更日志 (CHANGELOG.md)

## [1.3.36] - 2026-08-25
### 应用包名与网关路由统一升级为 /app/podnote
- **网关路由与 Socket 规范化**:
  - 应用包名与唯一标识规范更新为 `podnote`。
  - 网关反向代理前缀从 `/app/m-text-editor/` 统一更新为 `/app/podnote/`。
  - 后端 Unix Domain Socket 命名从 `m-text-editor.sock` 规范更新为 `podnote.sock`。
  - 二进制执行文件命名从 `m-text-editor` 统一规范为 `podnote`。
- **前后端构建与开发配置同步**:
  - 更新 `src/main.go`、`src/build.bat`、`build/cmd/main` 中的二进制路径与 Socket 绑定逻辑。
  - 更新 `frontend/vite.config.ts` 中的本地开发代理路径为 `/app/podnote`。
  - 更新 `test/scratch/mock_server.js` 本地仿真服务器的基准路由为 `/app/podnote`。
  - 全面同步更新所有技术文档（`ARCHITECTURE.md`、`BACKEND_API.md`、`BUILD_DEPLOY.md`、`AGENT_QUICKREF.md`）。

## [1.3.35] - 2026-08-25
### 全面对齐旧版原生前端全功能与按键体系
- **顶栏汉堡菜单全面补齐**:
  - 完整实现 10 项菜单操作：打开文件、打开目录、撤销、恢复、复制、粘贴、查找、替换、偏好设置。
  - 支持根据当前活动文件与编辑模式动态置灰/禁用。
  - 针对苹果系统（macOS / iOS）自动自适应渲染 `⌘` 快捷键。
- **标签栏 (TabBar) 细节对齐**:
  - 实现左右滚动按钮根据实际内容溢出动态显隐（`scrollWidth > clientWidth`）及边界禁用置灰。
  - 规范统一虚拟主页协议 `podnote://welcome`，彻底阻断向后端的物理文件穿透。
  - 关闭未保存标签页统一接入自研 Confirm 模态弹窗。
- **资源管理器与文件树 (FileTree)**:
  - 增加节点右键 `contextmenu` 唤起 FNOS 文件管理器定位。
  - 窄屏模式下点击文件自动折叠侧栏，优化移动端阅读体验。
  - 全面采用纯原生精细矢量 SVG 图标库（覆盖 CSS/JS/TS/Docx/Xlsx/PDF/音频/图片/软链接等）。
  - 新建文件支持 PC 端内联输入与移动端 Prompt 模态弹窗。
- **查找与替换面板 (SearchPanel)**:
  - 替换原生 confirm 为自研模态弹窗，保持视觉一致性。
  - 支持全局 Ctrl+F / Ctrl+H 快捷键调起及选中文本自动搜索。
- **底部状态栏 (StatusBar)**:
  - 语言模式选择器支持动态获取 Monaco 全量 80+ 种语言列表并按字母升序排序，支持实时搜索。
  - 编码选择器在编辑模式下切换仅置脏当前 Tab，保存时按新编码写入；在只读模式下重载文件。
  - 面包屑路径仅在有效文件时展示，支持悬停高亮与点击安全复制。
  - 媒体预览激活时自适应隐藏行列/换行符/编码选择器。
- **通用底部面板 (BottomPanel)**:
  - Git 常用指令菜单点击后仅将指令填入终端输入行（不自动触发回车执行），允许用户二次确认与修改。
  - 问题列表点击项联动 Monaco 编辑器光标精准跳转至指定行与列、居中选区并唤起 Hover 提示。
- **弹窗系统 (ConfirmModal)**:
  - 自研轻量纯净的暗黑/明亮自适应 Confirm / Prompt 模态弹窗，彻底替代原生浏览器 alert/confirm/prompt 阻塞式弹窗。
