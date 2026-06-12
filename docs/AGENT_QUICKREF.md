# Agent 开发防御校验契约 (AGENT_QUICKREF.md)

---

## 1. 修改前置依赖参考

Agent 在执行任何文件修改前，必须完成关联设计契约的阅读与前置校验：

| 修改范围 | 强制前置阅读文档 |
|:---|:---|
| Go 后端物理层与处理器 | [src/README.md](../src/README.md) → [BACKEND_API.md](./BACKEND_API.md) |
| 前端 UI 行为与交互 | [build/app/www/js/README.md](../build/app/www/js/README.md) → [FRONTEND_MODULES.md](./FRONTEND_MODULES.md) |
| 前端 CSS 设计样式 | [build/app/www/css/README.md](../build/app/www/css/README.md) |
| 浏览器 Chrome/Edge 扩展 | [chrome_extension/README.md](../chrome_extension/README.md) → [CHROME_EXTENSION.md](./CHROME_EXTENSION.md) |
| 跨模块事件通知流 | [EVENT_BUS.md](./EVENT_BUS.md) |
| FNOS 容器生命周期及编译打包 | [build/README.md](../build/README.md) → [BUILD_DEPLOY.md](./BUILD_DEPLOY.md) |

---

## 2. 代码库强修改路径物理约束

Agent 只能在以下限定物理文件及范围内进行修改，严禁改动任何框架及未经声明的底层依赖：

### 后端约束 (`src/`)
* `main.go`：仅允许路由声明、日志过滤器定义、服务监听初始化修改。
* `handlers.go`：仅允许 HTTP 处理器（`handle*`）和 WebSocket 控制逻辑的编写。
* `utils.go`：仅允许路径校验（`cleanAndValidatePath`）、编码探测、原子写入公共逻辑的优化。
* `models.go` / `middleware.go`：仅允许数据结构体和请求拦截器的扩展。

### 前端约束 (`build/app/www/`)
* `app.js`：仅允许作为总调度器注册事件总线（EventBus）与管理子模块生命周期。
* `js/api.js`：仅允许作为 HTTP 通信的封装。
* `js/file_io.js`：仅允许进行文件级加载/保存/新建的业务处理。
* `js/editor.js`：仅允许 Monaco 实例生命周期控制及底层快捷键拦截的配置。
* `js/ui/elements.js`：仅允许作为 DOM 选择器注册器。
* 其他 `js/ui/*.js` 按职责定位进行局部的交互实现。

### CSS 约束 (`build/app/www/css/`)
* **媒介查询控制**：禁止在子样式文件中书写 `@media` 规则。所有窄屏与响应式适配逻辑**强制统一**编写至 `responsive.css` 末尾。
* **设计 Token 控制**：任何组件的颜色、背景值等禁止硬编码，**强制**使用 `variables.css` 中声明的 CSS 变量。

---

## 3. 防御性编程自检清单 (避坑规约)

Agent 在合并任何代码修改前，必须逐项进行以下技术缺陷的前置核查：

### 3.1 mtime 并发乐观锁防覆写校验
* **逻辑**：在保存文件 API (`handleSave`) 中，必须强制校验客户端入参 `mtime`。
* **规则**：
  * 若物理文件已存在且 `mtime === 0`，必须拒绝写入并报错。
  * 若 `mtime > 0` 且物理文件的 mtime 大于入参值，表示物理文件已被外部程序或并发修改，必须返回冲突状态码（`409`），严禁强行覆写。

### 3.2 路径逃逸与符号链接穿透校验
* **逻辑**：所有后端读写 API 必须前置调用 `cleanAndValidatePath`。
* **规则**：必须对用户输入的绝对路径进行 `filepath.Clean` 处理，并解析其真实的符号链接（`evalSymlinks`），确保其根基在限定的工作区目录下，拦截一切 `../` 目录逃逸和越权链接。

### 3.3 文件原子写入一致性校验
* **逻辑**：文件物理写入必须采用 `writeFileAtomic`。
* **规则**：严禁直接调用普通写入方法对原文件进行覆盖。必须遵循：写入 `.tmp` 临时文件 -> `Sync` 强落盘 -> `Rename` 原子覆写的时序，防止系统断电或崩溃导致原文件损坏。

### 3.4 缓存失效控制规约
* **逻辑**：修改前端 JS 或 CSS 组件后，必须同步递增 [build/manifest](../build/manifest) 中的应用版本号。
* **规则**：版本网关依赖此版本号生成静态文件的缓存失效戳（`?v={version}`）。未递增版本号将导致飞牛OS容器部署后浏览器使用本地旧版缓存，引发渲染异常。

### 3.5 MAIN World 限制与桥接隔离
* **逻辑**：`inject_fnos.js` 仅允许在 MAIN world 执行，严禁在其中直接发起 `chrome.runtime` 调用。
* **规则**：若需向扩展传输状态，必须分发 `podnote_status_event` 事件，由 ISOLATED 桥接脚本捕获后转发，确保不会抛出 API 未定义异常。

### 3.6 事件总线监听泄漏自检
* **逻辑**：前端组件绑定 `eventBus.on` 后，必须统一将其托管至 `disposables` 容器。
* **规则**：在 `dispose()` 被调用时，必须执行 `disposables.dispose()` 卸载所有监听器，杜绝因组件销毁后事件泄露造成的页面内存溢出和重复回调。

---

## 4. 变更交付确认链

Agent 结束修改并交付任务前，必须按序执行以下步骤：
1. **重构 README**：若有物理文件的新增、修改、移动或删除，必须同步修补所在模块的 `README.md`。
2. **变更日志写入**：遵循 [CHANGELOG.md](../CHANGELOG.md) 的合并约束，在日志首部以严密技术措辞追加执行明细。
3. **技术文档维护**：若底层设计（API、数据流、事件）发生微调，必须即时修正 `docs/` 下对应的 `.md` 文档。
