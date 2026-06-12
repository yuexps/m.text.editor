# 前端 Web 物理模块 (build/app/www/)

---

## 1. 物理文件清单

| 文件/目录名 | 物理链接 | 核心职责 |
|:---|:---|:---|
| index.html | [index.html](./index.html) | SPA 单页入口 DOM 结构，配置 Monaco AMD loader 及环境侦测。 |
| app.js | [app.js](./app.js) | 前端逻辑入口协调器，订阅全局 EventBus 事件并挂载初始化子组件。 |
| style.css | [style.css](./style.css) | 样式入口，使用 `@import` 按照规约强制顺序汇总子样式文件。 |
| js/ | [js/](./js/README.md) | ES Module 核心业务逻辑子模块目录。 |
| css/ | [css/](./css/README.md) | 职责拆分的 12 个子样式文件目录。 |
| plugins/ | [plugins/](./plugins/) | 第三方及移动端触控、键盘锁辅助插件包。 |
| vs/ | `vs/` | Monaco Editor 静态编译器核心资源包. |
| xterm/ | `xterm/` | xterm.js 终端核心资源包。 |

---

## 2. 核心架构约束

* **事件防泄漏约束**：挂载事件总线 (EventBus) 监听时，必须托管给 `disposables` 容器，以防组件卸载后发生回调泄漏。

---

## 3. 技术文档超链接

* 前端依赖图、API 签名与 DOM 依赖映射 → [docs/FRONTEND_MODULES.md](../../../docs/FRONTEND_MODULES.md)
* 初始化流程、生命周期时序与运行拓扑 → [docs/ARCHITECTURE.md](../../../docs/ARCHITECTURE.md)
* 跨模块事件总线事件清单与 Payload 强类型 → [docs/EVENT_BUS.md](../../../docs/EVENT_BUS.md)
