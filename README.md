# PodNote (React 重构版)

**PodNote** 是一款基于飞牛OS（FNOS）深度适配的轻量极速文本编辑器，前端采用 **React 19 + TypeScript + Zustand + Tailwind CSS** 现代技术栈重构，底层搭载 **Monaco Editor** 强劲内核。

---

## 核心特性

* **现代编辑器工作区**：类 VS Code 活动栏与侧边栏，支持多标签页编辑、全局正则查找与替换、只读监听追踪。
* **全功能顶栏与快捷键**：集成 10 项汉堡菜单指令，深度适配 macOS `⌘` 快捷键，支持多标签页溢出平滑滚动与脏数据保护。
* **集成交互式终端**：基于 WebSocket 与 xterm.js，后端桥接 PTY 提供 Linux Bash 终端交互，包含 Git 快捷指令与移动端 14 键 TouchBar。
* **全语言与编码支持**：支持 Monaco 全量 80+ 种语言模式切换、10+ 种文件编码实时转换与乐观锁存盘。
* **多媒体与文档预览**：内置图片、音频（黑胶动效）、PDF、Word (`.docx`) 及 Excel (`.xlsx` 多工作表) 纯前端解析预览。
* **深度适配飞牛OS**：支持在 FNOS 文件管理器中右键编辑、文件树右键定位、工作区一键新建文件。

---

## 目录结构

* [frontend/](./frontend/)：React 前端项目源码（Vite + React 19 + TypeScript + Zustand + Tailwind CSS）。
* [src/](./src/)：Go 后端服务源码（文件读写、PTY 终端、文件监听、配置持久化）。
* [build/](./build/)：飞牛OS 打包分发资源（包含前端编译产物 `/app/www`、后端程序 `/app/server`、生命周期脚本及配置）。
* [test/](./test/)：本地开发仿真环境（Node.js Mock Server 与物理测试工作区）。
* [docs/](./docs/)：Agent 与开发者完整技术文档。

---

## 前端开发与构建

### 1. 安装依赖
```bash
cd frontend
npm install
```

### 2. 构建前端产物
```bash
npm run build
```
* 构建产物将自动输出并同步至 `../build/app/www`，同时自动更新 app 版本号。

---

## 本地仿真测试

在项目根目录下启动 Mock 后端服务器进行联调：
```bash
node test/scratch/mock_server.js
```
访问 `http://localhost:3000` 即可直接体验完整的前后端交互。

---

## 致谢

* Monaco Editor: https://github.com/microsoft/monaco-editor
* xterm.js: https://github.com/xtermjs/xterm.js
* Zustand: https://github.com/pmndrs/zustand
* Tailwind CSS: https://tailwindcss.com
* 命名与集成方案：shuangji66, 米恋泥
