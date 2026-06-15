# 前端业务逻辑子模块 (build/app/www/js/)

---

## 1. 物理文件清单

| 文件/目录名 | 物理链接 | 核心职责 |
|:---|:---|:---|
| event_bus.js | [event_bus.js](./event_bus.js) | 事件发布/订阅器，前端解耦核心通信信道。 |
| context.js | [context.js](./context.js) | 前端全局状态上下文，封装 `AppContext` 单例。 |
| api.js | [api.js](./api.js) | 前端底层 HTTP 请求层（封装超时重试及 Abort 控制）。 |
| file_io.js | [file_io.js](./file_io.js) | 文件读写加载业务处理器（防冲突、处理并发乐观锁）。 |
| editor.js | [editor.js](./editor.js) | Monaco Editor 实例生命周期托管及 EOL、字符数统计控制。 |
| tabs.js | [tabs.js](./tabs.js) | 标签页生命周期、多标签脏标记及 DOM 渲染控制。 |
| search.js | [search.js](./search.js) | 侧栏查找与逐个/批量替换业务实现。 |
| terminal.js | [terminal.js](./terminal.js) | xterm.js 交互式终端懒加载与 WebSocket 状态控制。 |
| settings.js | [settings.js](./settings.js) | 用户设置表单同步及云端配置持久化。 |
| markdown.js | [markdown.js](./markdown.js) | 双栏同步滚动及 Markdown 异步渲染控制器。 |
| tail.js | [tail.js](./tail.js) | 只读文件变更实时监控，后端 WS 事件同步。 |
| ide_core.js | [ide_core.js](./ide_core.js) | 快捷键绑定、Monarch 校验解析及 Snippets 代码段配置。 |
| utils.js | [utils.js](./utils.js) | 移动端探测、防抖节流函数、字符集映射工具。 |
| ui.js | [ui.js](./ui.js) | 整合 `ui/` 目录下所有的 DOM 交互管理器的聚合导出。 |
| ui/ | [ui/](./ui/manager.js) | UIManager 及 elements DOM 映射物理目录。 |
| ui/bottom_panel.js | [bottom_panel.js](./ui/bottom_panel.js) | 底部多页签控制面板管理器，处理高度拖动调节及多标签切换。 |

---

## 2. 核心架构约束

* **松耦合约束**：业务子模块之间严禁直接 `import` 或跨模块进行直接的属性修改。一切跨组件状态传递与操作命令转发强制经由全局 `eventBus` 进行。

---

## 3. 技术文档超链接

* 前端业务模块核心 API 签名与 DOM 依赖映射 → [docs/FRONTEND_MODULES.md](../../../../docs/FRONTEND_MODULES.md)
* 跨模块事件总线名称映射与 Payload 强类型 → [docs/EVENT_BUS.md](../../../../docs/EVENT_BUS.md)
