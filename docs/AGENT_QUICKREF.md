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

### 3.3 文件安全写入与 ACL 一致性校验
* **逻辑**：物理写入必须保全 Linux POSIX ACL 与 Inode。
* **规则**：
  * **已有文件**：采用带备份保护的原地截断覆写，禁止临时文件重命名和显式 chmod。
  * **新建文件**：使用 0666 权限创建，严禁显式 chmod，继承父目录 Default ACL 与属主。

### 3.4 缓存失效控制规约
* **逻辑**：修改前端 JS 或 CSS 组件后，必须同步递增 [build/manifest](../build/manifest) 中的应用版本号。
* **规则**：版本网关依赖此版本号生成静态文件的缓存失效戳（`?v={version}`）。未递增版本号将导致飞牛OS容器部署后浏览器使用本地旧版缓存，引发渲染异常。

### 3.5 MAIN World 限制与桥接隔离
* **逻辑**：`inject_fnos.js` 仅允许在 MAIN world 执行，严禁在其中直接发起 `chrome.runtime` 调用。
* **规则**：若需向扩展传输状态，必须分发 `podnote_status_event` 事件，由 ISOLATED 桥接脚本捕获后转发，确保不会抛出 API 未定义异常。

### 3.6 事件总线监听泄漏自检
* **逻辑**：前端组件绑定 `eventBus.on` 后，必须统一将其托管至 `disposables` 容器。
* **规则**：在 `dispose()` 被调用时，必须执行 `disposables.dispose()` 卸载所有监听器，杜绝因组件销毁后事件泄露造成的页面内存溢出和重复回调。

### 3.7 虚拟协议与主页防穿透隔离规约
* **逻辑**：主页标签页使用虚拟协议路径 `podnote://welcome` 标识。
### 3.8 终端重连隔离与拟合规约
* **逻辑**：重连拉起新 Pty 会话时需保留历史缓冲区供调试，但须防止旧行残留数据与延迟的窗口尺寸调整导致光标在 XTerm 中 Reflow 错叠。
* **规则**：重连前必须先向终端同步写入物理换行及隔离标识，并在连接前同步调用 `fit()` 拟合窗口物理尺寸，确保初始传递尺寸准确以规避 Reflow 导致的光标重叠。

### 3.9 终端按键拦截与剪贴板注入契约
* **逻辑**：Linux PTY 将 `Ctrl+V` 定义为字面量转义（`lnext`，ASCII `0x16`），直接透传会导致终端进入转义模式并与剪贴板输入产生乱码冲突。
* **规则**：
  1. **按键拦截**：必须使用 `attachCustomKeyEventHandler` 显式拦截 `Ctrl+V` / `Cmd+V` / `Shift+Insert`，严禁将 `\x16` 控制码发送给 PTY。
  2. **选区感知复制**：按下 `Ctrl+C` / `Cmd+C` 时，若 `hasSelection()` 为真，必须复制选区文本并阻止发送中断信号；仅在无选区时放行 `\x03`（SIGINT）。
  3. **安全注入管道**：所有剪贴板文本写入必须调用 `terminalInstance.paste(text)` 接口，严禁直接按普通按键字符拼接发送，确保换行符转换与括号粘贴模式（Bracketed Paste）自适应生效。

---

## 4. 变更交付确认链

Agent 结束修改并交付任务前，必须按序执行以下步骤：
1. **重构 README**：若有物理文件的新增、修改、移动或删除，必须同步修补所在模块的 `README.md`。
2. **变更日志写入**：遵循 [CHANGELOG.md](../CHANGELOG.md) 的合并约束，在日志首部以严密技术措辞追加执行明细。
3. **技术文档维护**：若底层设计（API、数据流、事件）发生微调，必须即时修正 `docs/` 下对应的 `.md` 文档。
