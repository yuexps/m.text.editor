# Go 后端服务模块 (src/)

本模块编译后运行于飞牛OS应用容器中，负责提供 API 服务和 PTY 终端桥接。

---

## 1. 文件索引

* [main.go](./main.go)：服务入口，初始化路由并监听 Unix Socket (`m-text-editor.sock`)。
* [models.go](./models.go)：API 响应体及目录结构体定义。
* [middleware.go](./middleware.go)：Gzip 压缩、静态缓存与管理员鉴权中间件。
* [handlers.go](./handlers.go)：处理文件读写、原子保存、终端与监视 WebSocket 的业务处理器。
* [utils.go](./utils.go)：绝对路径校验、字符集探测及 PTY 控制等辅助函数。
* [go.mod](./go.mod) & [go.sum](./go.sum)：依赖管理。
* [build.bat](./build.bat)：Windows 交叉编译脚本。

---

## 2. 核心数据模型

* **Response**：标准 API JSON 响应体。
  ```go
  type Response struct {
      Content  string `json:"content,omitempty"`  // 转码后的文本内容
      Mtime    int64  `json:"mtime,omitempty"`    // 修改时间戳
      Size     int64  `json:"size,omitempty"`     // 字节大小
      Mode     string `json:"mode,omitempty"`     // 权限描述
      Language string `json:"language,omitempty"` // Monaco 语言 ID
      Encoding string `json:"encoding,omitempty"` // 建议编码
      Error    string `json:"error,omitempty"`    // 错误描述
  }
  ```
* **FileInfo**：目录项元数据。
  ```go
  type FileInfo struct {
      Name  string `json:"name"`
      Path  string `json:"path"`
      IsDir bool   `json:"is_dir"`
      Size  int64  `json:"size"`
      Mtime int64  `json:"mtime"`
  }
  ```

---

## 3. 核心 API 与业务逻辑

### 目录列表读取 (`/api/list` -> `handleList`)
* **逻辑**：校验路径安全 -> 读取目录内容（排序：文件夹在前，文件在后，按名称忽略大小写排序） -> 忽略隐藏文件（以 `.` 开头）。

### 文件读取与转码 (`/api/read` -> `handleRead`)
* **限制**：文件大小限制在 10MB 内。
* **探测与拦截**：读取前 1024 字节探测编码。非 UTF-16 且含 `0` 字节则判定为二进制文件，予以拦截。
* **转码**：非 UTF-8 文本（如 GBK）透明转码为标准 UTF-8 下发。

### 文件原子保存 (`/api/save` -> `handleSave`)
* **乐观锁**：若 `req.Mtime > 0` 且物理文件实际 `mtime` 晚于该值，返回并发冲突。
* **流程**：写同级 `.tmp` 临时文件 -> 转码写入（过滤非法 Unicode） -> `f.Sync()` 强落盘 -> 恢复原文件权限/所有权（UID/GID） -> `os.Rename` 原子替换。

### 终端 WebSocket 桥接 (`/api/terminal/ws` -> `handleTerminalWS`)
* **用户切换**：从 Header 提取 `X-Trim-Username`。若 `user=current`，切换子进程（默认 `/bin/bash`）的 UID/GID 为该飞牛用户，并在其家目录下运行；否则默认以 `root` 在 `/root` 运行。
* **交互**：双向绑定 WebSocket I/O 流与 PTY。支持 `\x00resize:cols,rows` 消息调整大小。

### 文件变化监视 (`/api/watch/ws` -> `handleWatchWS`)
* **逻辑**：基于 WebSocket 监听特定文件，当发生物理变更时向前端推送提示。

---

## 4. 中间件说明

1. **adminAuthMiddleware**：从 Header 提取 `X-Trim-Isadmin`。非管理员拦截，保障系统安全。
2. **gzipMiddleware**：对文本静态资源与常规 API 实施 Gzip 压缩，忽略 WebSocket 升级请求。
3. **cacheMiddleware**：设置 `/vs/`（Monaco）强缓存 1 年，带版本参数的业务脚本缓存 30 天。
