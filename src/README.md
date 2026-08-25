# Go 后端物理模块 (src/)

---

## 1. 物理文件清单

| 文件名 | 物理链接 | 核心职责 |
|:---|:---|:---|
| main.go | [main.go](./main.go) | 后端服务入口、Unix Socket 监听、路由注册与版本缓存控制。 |
| models.go | [models.go](./models.go) | 强类型数据模型及 Go Struct 载荷定义。 |
| middleware.go | [middleware.go](./middleware.go) | 路由过滤链拦截器（管理员特权鉴权、Gzip 压缩、静态缓存等）。 |
| handlers.go | [handlers.go](./handlers.go) | HTTP API 及 WebSocket 控制器的具体业务实现。 |
| utils.go | [utils.go](./utils.go) | 文件原子写入、字符编码探测、PTY 生命周期管理辅助函数。 |
| go.mod | [go.mod](./go.mod) | Go Module 物理依赖规约描述。 |

---

## 2. 核心架构约束

* **绝对安全校验**：任何针对文件的 I/O 动作，必须经由 `cleanAndValidatePath` 函数前置拦截与解析校验，防止路径逃逸与非法符号链接注入。
* **乐观并发锁**：保存逻辑必须遵循 mtime 版本乐观锁防覆盖校验规约。

---

## 3. 技术文档超链接

* 后端 HTTP 接口规范、特权 PTY 信令控制 → [docs/BACKEND_API.md](../docs/BACKEND_API.md)
* Go 后端拓扑关系与拦截器链组装时序 → [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)
