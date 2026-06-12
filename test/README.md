# 本地仿真测试模块 (test/)

---

## 1. 物理文件清单

| 文件/目录名 | 物理链接 | 核心职责 |
|:---|:---|:---|
| scratch/mock_server.js | [scratch/mock_server.js](./scratch/mock_server.js) | Node.js 本地开发仿真服务器，模拟全部 HTTP API 与 Web 终端通信。 |
| scratch/files/ | [scratch/files/](./scratch/files/) | 本地仿真的物理工作区，存放测试读写目标文件。 |
| package.json | [package.json](./package.json) | 本地测试服务的 Node.js 物理依赖管理规约。 |

---

## 2. 核心架构约束

* **仿真与生产隔离约束**：仿真服务器仅作为本地前端调试环境，严禁将其引入生产环境打包。任何新增的后端 HTTP 或 WS API 控制逻辑必须在 `mock_server.js` 中同步实现对应的模拟行为。

---

## 3. 技术文档超链接

* 仿真服务器环境搭建、本地调试及端口访问约束 → [docs/BUILD_DEPLOY.md](../docs/BUILD_DEPLOY.md)
