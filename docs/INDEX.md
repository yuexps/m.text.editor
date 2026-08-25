# 技术文档索引 (INDEX.md)

---

## 1. 文档结构树

```
docs/
├── INDEX.md              # 总索引与技术文档映射
├── ARCHITECTURE.md       # 系统运行拓扑、中间件链及 React 组件状态流
├── BACKEND_API.md        # Go 后端 HTTP/WS 接口强类型定义与业务规则
├── FRONTEND_MODULES.md   # React 前端组件、Zustand 状态机与 Monaco 插件体系
├── STATE_MANAGEMENT.md   # Zustand 全局 Store 契约与 Action 规约
├── BUILD_DEPLOY.md       # 编译打包、容器生命周期脚本与构建配置
└── AGENT_QUICKREF.md     # Agent 编码契约、设计约束与防御性编程校验项
```

---

## 2. 物理模块与文档映射

| 物理模块 | 入口目录 | 关联规范文档 |
|:---|:---|:---|
| React 前端源码 | [frontend/](../frontend/) | [FRONTEND_MODULES.md](./FRONTEND_MODULES.md), [STATE_MANAGEMENT.md](./STATE_MANAGEMENT.md), [ARCHITECTURE.md](./ARCHITECTURE.md) |
| Go 后端 | [src/](../src/) | [BACKEND_API.md](./BACKEND_API.md), [ARCHITECTURE.md](./ARCHITECTURE.md) |
| 打包资源 / 产物 | [build/](../build/) | [BUILD_DEPLOY.md](./BUILD_DEPLOY.md) |
| 开发仿真环境 | [test/](../test/) | [BUILD_DEPLOY.md](./BUILD_DEPLOY.md) |

---

## 3. 开发约束入口

* **修改前必读**：[docs/AGENT_QUICKREF.md](./AGENT_QUICKREF.md) — 罗列修改路径约束、检查清单与常见避坑点。
* **变更记录规范**：[CHANGELOG.md](../CHANGELOG.md) — 严格规范变更日志的书写格式与合并约束。
