# 后端 API 强类型参考 (BACKEND_API.md)

所有 API 端点基准前缀为 `/app/m-text-editor`，均通过 Unix Socket 网关转发。

---

## 1. 基础强类型声明

```typescript
// 基础响应体
export interface Response {
  content?: string;  // 文件内容 (已转码为 UTF-8)
  mtime?: number;    // 文件最后修改时间戳 (Unix 毫秒/秒级乐观锁)
  size?: number;     // 文件大小 (字节)
  mode?: string;     // 文件权限位，如 "-rw-r--r--"
  language?: string; // 探测到的语言标识符，如 "markdown"
  encoding?: string; // 探测到的或建议的文件物理字符集，如 "gb18030"
  error?: string;    // 错误信息描述
}

// 物理文件/目录信息
export interface FileInfo {
  name: string;      // 文件或目录名称
  path: string;      // 绝对路径
  is_dir: boolean;   // 是否为目录 (软链接目录已平铺解析为 true)
  size: number;      // 大小 (字节)
  mtime: number;     // 物理修改时间戳
  is_symlink: boolean; // 是否为符号链接
}

// 目录列表响应
export interface ListResponse {
  path?: string;
  files?: FileInfo[];
  error?: string;
}

// 错误响应格式 (状态码不为 200 时返回)
export interface ErrorResponse {
  error: string;     // 具体技术错误描述
}
```

---

## 2. HTTP 接口规约

### 2.1 目录列表
* **端点**：`GET /api/list`
* **参数规约**：
  ```typescript
  interface ListParams {
    path: string; // 绝对路径，如 "/vol1/1000/documents"
  }
  ```
* **应答载荷**：`ListResponse`
* **标准错误**：
  * `400 Bad Request`：路径校验不通过（如包含非法路径、试图越权逃逸）。
    ```json
    { "error": "invalid path or path traversal detected" }
    ```
  * `500 Internal Server Error`：物理目录读取失败。

---

### 2.2 读取文件
* **端点**：`GET /api/read`
* **参数规约**：
  ```typescript
  interface ReadParams {
    path: string;       // 文件绝对物理路径
    encoding?: string;  // 显式指定物理字符集。不传则自动探测。
  }
  ```
* **应答载荷**：`Response`
* **控制规则**：
  * 单文件大小限制上限为 `10MB`（`10 * 1024 * 1024` 字节）。超过限制返回 `400 Bad Request`。
  * 二进制拦截：检测前 1024 字节。若非 UTF-16 且包含空字符（`0x00`），直接判断为二进制并拒绝，返回 `400 Bad Request`。
  * 编码探测与转码：默认探测字符集并转换为统一的 UTF-8 返回；只有当请求与实际字符集冲突时，在 `encoding` 字段给出建议值。

---

### 2.3 保存文件
* **端点**：`POST /api/save`
* **请求体载荷**：
  ```typescript
  interface SavePayload {
    path: string;      // 目标绝对路径
    content: string;   // 待写入文本内容
    encoding: string;  // 保存的目标字符集 (转码保存)
    mtime: number;     // 乐观锁戳：0 表示创建；大于 0 表示期望的物理修改时间
  }
  ```
* **应答载荷**：`Response` （写入成功后，返回新 `mtime` 和 `size`）
* **并发锁与错误规约**：
  * `mtime === 0` 但物理文件已存在：返回 `409 Conflict`。
    ```json
    { "error": "file already exists" }
    ```
  * `mtime > 0` 且物理文件的 mtime 晚于该请求中的 mtime：表示遭遇并发修改，拒绝写入，返回 `409 Conflict`。
    ```json
    { "error": "file has been modified concurrently" }
    ```

---

### 2.4 新建文件预检
* **端点**：`GET /api/create`
* **参数规约**：
  ```typescript
  interface CreateParams {
    path: string; // 预新建的绝对物理路径
  }
  ```
* **应答载荷**：
  ```typescript
  interface CreateResponse {
    content: "ok";
    language: string; // 根据扩展名预推导的语言标识
  }
  ```
* **异常处理**：文件已存在则响应 `400 Bad Request`，返回错误描述。

---

### 2.5 创建物理空文件
* **端点**：`POST /api/new`
* **请求体载荷**：
  ```typescript
  interface NewFilePayload {
    path: string; // 绝对物理路径
  }
  ```
* **应答载荷**：
  ```typescript
  interface NewFileResponse {
    content: "ok";
    mtime: 0;
  }
  ```
* **控制规则**：父目录不存在或无写入权限时，响应 `403 Forbidden` 或 `500`。

---

### 2.6 获取/更新用户设置
* **端点**：`GET /api/settings`
* **更新端点**：`POST /api/settings`
* **参数规约**：
  ```typescript
  interface SettingsParams {
    client: "pc" | "mobile"; // 区分客户端类型拉取不同配置
  }
  ```
* **读取响应 / 更新载荷**：任意 JSON 键值对对象（如 Monaco 主题、字号配置等）。
* **物理文件映射**：`${TRIM_PKGVAR}/settings.json` 或 `settings_mobile.json`。

---

## 3. WebSocket 协议通道

### 3.1 交互式终端 (Terminal WebSocket)
* **端点**：`WS /api/terminal/ws`
* **连接参数**：
  ```typescript
  interface TerminalWSParams {
    cols: string;          // 初始列宽 (默认 "80")
    rows: string;          // 初始行高 (默认 "24")
    user: "root" | "current"; // 切换为 root 用户或容器内当前登录用户的 UID/GID
  }
  ```
* **传输协议与信令控制**：
  本连接采用原始数据透传协议，除普通 I/O 数据流外，首字节为 `\x00` 的消息被解析为特权信令控制帧：
  * **尺寸变更信令** (C -> S)：`\x00resize:{cols},{rows}`
  * **应用层 Keep-Alive 心跳** (C -> S)：`\x00ping`
  * **应用层 Keep-Alive 应答** (S -> C)：`\x00pong`
* **心跳超时约束**：连接后，若 90 秒内无任意数据（含 ping 帧）写入，服务端强制发送 SIGKILL 终止对应 PTY 进程并断开 WS。

---

### 3.2 文件只读轮询监视 (File Watcher WS)
* **端点**：`WS /api/watch/ws`
* **连接参数**：
  ```typescript
  interface WatchWSParams {
    path: string; // 监视的绝对物理路径
  }
  ```
* **消息应答协议**：
  服务端每秒对文件状态进行 `os.Stat` 检查，如有变更则下发：
  ```typescript
  type WatchEvent = 
    | { event: "change"; mtime: number; size: number } // 文件改变
    | { error: string }                                // 物理文件被删除
  ```
