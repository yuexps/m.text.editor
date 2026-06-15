/**
 * ui.js - 聚合导出，保持 app.js 及其他模块导入路径不变
 */

// DOM 元素引用与共享状态
export { els, uiDisposables, editorEventDisposables } from './ui/elements.js';

// 对话框
export { showConfirm, showPrompt } from './ui/dialog.js';

// 基础 UI 反馈
export { showToast, updateStatus, updateBreadcrumbs, hideAllPanels, updateUIState } from './ui/feedback.js';

// 文件树
export { getIconClass, createTreeItem, renderFileTree } from './ui/filetree.js';

// 侧边栏
export { expandSidebar, collapseSidebar, switchSidebarPanel, toggleActivityDropdownMenu } from './ui/sidebar.js';

// 核心管理器
export { UIManager } from './ui/manager.js';

// 底部面板
export { BottomPanelManager } from './ui/bottom_panel.js';
