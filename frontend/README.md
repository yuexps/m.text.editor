# PodNote 前端源码目录 (`frontend/`)

本目录是 PodNote 的现代化 React 重构版本源码，基于 **React 19 + TypeScript + Zustand + Monaco Editor + Tailwind CSS + Vite** 构建。

---

## 目录结构

```
frontend/
├── src/
│   ├── components/            # UI 组件层
│   │   ├── hooks/             # 自定义 Hook (如 useFileWatch)
│   │   ├── plugins/           # Monaco 移动端插件 (TouchHelper, KeyboardBlocker)
│   │   ├── App.tsx            # 主应用根容器与 VisualViewport 适配
│   │   ├── BottomPanel.tsx    # 底部问题列表与 xterm.js 终端面板
│   │   ├── ConfirmModal.tsx   # 全局暗黑/明亮自适应模态弹窗
│   │   ├── EditorArea.tsx     # Monaco 编辑区与主页欢迎页
│   │   ├── FileTree.tsx       # 资源管理器树与原生 SVG 图标
│   │   ├── MarkdownPreview.tsx# Markdown 实时分栏预览与单向滚动锁
│   │   ├── MediaPreview.tsx   # 图片/音频(唱片动效)/PDF/Word/Excel 预览
│   │   ├── SearchPanel.tsx    # 侧栏查找与替换面板
│   │   ├── SettingsPanel.tsx  # 偏好设置中心
│   │   ├── Sidebar.tsx        # 活动栏与侧边栏抽屉
│   │   ├── StatusBar.tsx      # 底部状态栏 (全量语言/编码/面包屑)
│   │   ├── TabBar.tsx         # 多标签栏 (溢出平滑滚动与脏标记)
│   │   └── Toast.tsx          # 全局 Toast 气泡
│   ├── services/              # 底层通讯与业务 I/O
│   │   ├── api.ts             # 后端 HTTP API 与 WebSocket 路由
│   │   ├── fileIO.ts          # 文件读写/新建/智能打开调度
│   │   └── fnosSDK.ts         # 飞牛OS 微应用容器桥接
│   ├── store/                 # 响应式状态管理
│   │   └── useAppStore.ts     # Zustand 全局 Store 与状态 Action
│   ├── index.css              # 全局 Tailwind CSS 与主题样式
│   └── main.tsx               # 前端 React 入口
├── package.json               # 依赖与脚本
├── vite.config.ts             # Vite 构建与自动产物同步配置
└── tsconfig.json              # TypeScript 编译配置
```

---

## 开发与构建脚本

在 `frontend/` 目录下：

* **`npm install`**：安装前端开发依赖。
* **`npm run dev`**：启动本地 Vite HMR 热重载开发服务器。
* **`npm run build`**：执行 TypeScript 类型检查并将生产产物打包输出至 `../build/app/www`，同时自动递增应用版本号。
