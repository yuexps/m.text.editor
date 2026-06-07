# 前端静态资源模块 (build/app/www/)

本目录包含 PodNote 前端 Web 界面静态资源与模块化 JavaScript 业务逻辑。

---

## 1. 文件索引

* [index.html](./index.html)：单页应用（SPA）主 DOM 结构（挂载编辑器、侧边栏、底栏及终端面板）。
* [app.js](./app.js)：前端主控制模块，引入业务子模块并协调全局状态（标签页切换、保存预检、双栏预览等）。
* [style.css](./style.css)：全局样式表入口，使用 `@import` 整合 `css/` 下子样式文件。
* [css/](./css/README.md)：解耦拆分的子样式表目录。
* [js/](./js/README.md)：核心 JavaScript 业务子模块目录。
* [plugins/](./plugins/README.md)：第三方外部插件及环境注入逻辑（含飞牛注入脚本）。
* `vs/` & `xterm/`：Monaco Editor 和 xterm.js 静态编译包。
