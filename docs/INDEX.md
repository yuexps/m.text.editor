# 技术文档索引 (INDEX.md)

---

## 1. 文档结构树

```
docs/
├── INDEX.md              # 总索引与技术文档映射
├── ARCHITECTURE.md       # 系统运行拓扑、中间件链及核心控制流 (Mermaid 时序规约)
├── BACKEND_API.md        # Go 后端 HTTP/WS 接口强类型定义与业务规则 (TS Interface 风格)
├── FRONTEND_MODULES.md   # 前端业务模块、主要类/方法签名与 DOM 依赖
├── EVENT_BUS.md          # EventBus 事件名称与强类型 Payload 载荷定义
├── CHROME_EXTENSION.md   # 浏览器扩展 MV3 边界、DOM 注入机制与跨环境通信
├── BUILD_DEPLOY.md       # 编译打包、容器生命周期脚本与 CI/CD 配置
└── AGENT_QUICKREF.md     # Agent 编码契约、设计约束与防御性编程校验项
```

---

## 2. 物理模块与文档映射

| 物理模块 | 入口目录 | 关联规范文档 |
|:---|:---|:---|
| Go 后端 | [src/](../src/) | [BACKEND_API.md](./BACKEND_API.md), [ARCHITECTURE.md](./ARCHITECTURE.md) |
| 打包资源 / 静态网页 | [build/](../build/) | [BUILD_DEPLOY.md](./BUILD_DEPLOY.md), [FRONTEND_MODULES.md](./FRONTEND_MODULES.md) |
| 前端事件通信 | [build/app/www/js/event_bus.js](../build/app/www/js/event_bus.js) | [EVENT_BUS.md](./EVENT_BUS.md) |
| Chrome/Edge 扩展 | [chrome_extension/](../chrome_extension/) | [CHROME_EXTENSION.md](./CHROME_EXTENSION.md) |
| 开发仿真环境 | [test/](../test/) | [BUILD_DEPLOY.md](./BUILD_DEPLOY.md) |

---

## 3. 开发约束入口

* **修改前必读**：[docs/AGENT_QUICKREF.md](./AGENT_QUICKREF.md) — 罗列修改路径约束、检查清单与常见避坑点。
* **变更记录规范**：[CHANGELOG.md](../CHANGELOG.md) — 严格规范变更日志的书写格式与合并约束。
