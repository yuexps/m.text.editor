# Agent 开发防御校验契约 (AGENT_QUICKREF.md)

---

## 1. 修改前置依赖参考

Agent 在执行任何文件修改前，必须完成关联设计契约的阅读与前置校验：

| 修改范围 | 强制前置阅读文档 |
|:---|:---|
| Go 后端物理层与处理器 | [src/README.md](../src/README.md) → [BACKEND_API.md](./BACKEND_API.md) |
| React 前端 UI 与组件 | [frontend/README.md](../frontend/README.md) → [FRONTEND_MODULES.md](./FRONTEND_MODULES.md) |
| 浏览器 Chrome/Edge 扩展 | [chrome_extension/README.md](../chrome_extension/README.md) → [CHROME_EXTENSION.md](./CHROME_EXTENSION.md) |
| FNOS 容器生命周期及编译打包 | [build/README.md](../build/README.md) → [BUILD_DEPLOY.md](./BUILD_DEPLOY.md) |

---

## 2. 代码库强修改路径物理约束

Agent 只能在以下限定物理文件及范围内进行修改，严禁改动任何未经声明的底层依赖：

### 后端约束 (`src/`)
* `main.go`：仅允许路由声明、日志过滤器定义、服务监听初始化修改。
* `handlers.go`：仅允许 HTTP 处理器（`handle*`）和 WebSocket 控制逻辑的编写。
* `utils.go`：仅允许路径校验（`cleanAndValidatePath`）、编码探测、原子写入公共逻辑的优化。
* `models.go` / `middleware.go`：仅允许数据结构体和请求拦截器的扩展。

### React 前端约束 (`frontend/src/`)
* `store/useAppStore.ts`：全局状态管理（Zustand），严禁在组件内随意声明分散的全局副作用。
* `services/fileIO.ts`：文件加载/保存/新建调度，必须严格做好大文件拦截与虚拟协议隔离。
* `components/`：按照组件职责清晰划分，禁止在视图组件中直接书写底层 fetch 调用。
* 修改完成后**必须**运行 `npm run build` 进行类型与打包验证。

---

## 3. 防御性编程自检清单 (避坑规约)

Agent 在合并任何代码修改前，必须逐项进行以下技术缺陷的前置核查：

### 3.1 mtime 并发乐观锁防覆写校验
* **逻辑**：在保存文件 API (`handleSave`) 中，必须强制校验客户端入参 `mtime`。
* **规则**：若物理文件已存在且客户端入参 `mtime > 0` 且小于物理文件最新 mtime，表示文件已被外部修改，必须返回 `409` 冲突，严禁强行覆写。

### 3.2 虚拟协议防穿透隔离
* **逻辑**：主页虚拟路径使用 `podnote://welcome`。
* **规则**：前端 `fileIO.ts` 与各组件必须拦截对 `podnote://` 虚拟协议的物理磁盘读取或保存请求，禁止向后端穿透。

### 3.3 Monaco 与终端资源卸载
* **逻辑**：Monaco Editor 与 xterm.js 实例必须托管所有 listener Disposables。
* **规则**：在 React 组件 `useEffect` 卸载清理函数中，必须调用 `dispose()` 释放实例与 WebSocket 连接，杜绝内存泄漏。

---

## 4. 变更交付确认链

Agent 结束修改并交付任务前，必须按序执行以下步骤：
1. **执行构建检查**：在 `frontend/` 目录下执行 `npm run build`，确保无 TypeScript 报错且顺利生成打包产物。
2. **变更日志写入**：遵循 [CHANGELOG.md](../CHANGELOG.md) 的规范，在日志首部以严密技术措辞追加执行明细。
3. **技术文档维护**：若底层设计发生微调，即时修正 `docs/` 下对应的 `.md` 文档。
