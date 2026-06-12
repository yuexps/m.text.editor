# 构建与部署指南

---

## 1. 本地开发环境

### 前端调试（无需后端）

```bash
cd test/
npm install
node scratch/mock_server.js
```

打开 `http://localhost:3000` 即可调试前端。仿真服务器：
- 映射 `test/scratch/files/` 为工作区
- 模拟全部 HTTP API（list/read/save/create/new/settings）
- 模拟 WebSocket 终端（支持 help/clear/date/whoami）
- 基于 `fs.watch` 的文件变更监视

### Go 后端编译

```bash
cd src/
# Linux amd64
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -ldflags="-s -w" -o ../build/app/server/m-text-editor .

# Linux arm64
GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build -ldflags="-s -w" -o ../build/app/server/m-text-editor .
```

### VS Code 配置

`.vscode/settings.json` 已预设交叉编译环境变量：
```json
{
  "go.toolsEnvVars": { "GOOS": "linux", "GOARCH": "amd64" }
}
```

---

## 2. 飞牛OS 打包

### 打包工具
- Windows: `build/fnpack.exe`
- Linux: `build/fnpack-1.2.1-linux-amd64`

### 快速打包
```bash
cd build/
# Windows
build.bat
# Linux
./fnpack build
```

输出：`build/m.text.editor.fpk`

### manifest 配置

文件 `build/manifest`（TOML 格式）：

| 字段 | 说明 |
|------|------|
| `appname` | `m.text.editor` |
| `version` | 语义版本号（如 `1.3.0`） |
| `display_name` | `PodNote` |
| `platform` | `x86` 或 `arm` |
| `maintainer` | 维护者 |
| `desktop_uidir` | `ui`（UI 配置目录） |
| `desktop_applaunchname` | `m.text.editor.open` |
| `os_min_version` | 最低飞牛OS版本 |

### 目录映射

打包后在飞牛OS 容器中的路径：

| 源码路径 | 容器路径 | 说明 |
|----------|----------|------|
| `build/app/www/` | `/app/m-text-editor/www/` | 前端静态资源 |
| `build/app/server/` | `/app/m-text-editor/server/` | Go 二进制 |
| `build/app/ui/` | `/app/m-text-editor/ui/` | UI 配置与图标 |

---

## 3. 应用生命周期脚本

所有脚本位于 `build/cmd/`，由飞牛OS 在不同阶段调用：

| 脚本 | 阶段 | 说明 |
|------|------|------|
| `install_init` | 安装前 | 预检（当前为空） |
| `install_callback` | 安装后 | 回调（当前为空） |
| `main` | 运行时 | 核心入口：start/stop/status 进程管理 |
| `config_init` | 配置变更前 | 预检（当前为空） |
| `config_callback` | 配置变更后 | 同步文件后缀到 PostgreSQL 数据库 |
| `upgrade_init` | 升级前 | 预检（当前为空） |
| `upgrade_callback` | 升级后 | 回调（当前为空） |
| `uninstall_init` | 卸载前 | 预检（当前为空） |
| `uninstall_callback` | 卸载后 | 清理 `${TRIM_PKGVAR}` 持久化数据 |

### main 脚本详解

`build/cmd/main` 实现标准进程管理：
- **start**：后台启动 Go 服务，PID 写入 `${TRIM_PKGVAR}/app.pid`
- **stop**：SIGTERM → 等待 10s → SIGKILL
- **status**：检查 PID 文件，进程不存在则清理

### config_callback 详解

`build/cmd/config_callback` 在用户修改"自定义文件后缀"配置后触发：
1. 通过 Python 3 连接 PostgreSQL (`appcenter` 数据库)
2. 查询 `app_service` 表中 `service_name = 'm.text.editor.custom'` 的原有后缀
3. 合并新老后缀并去重
4. 安全校验（仅允许字母数字，总长 ≤ 500）
5. 写回数据库

---

## 4. UI 关联配置

### `build/app/ui/config`

声明两个服务关联：

| 服务名 | 说明 | 默认后缀 |
|--------|------|----------|
| `m.text.editor.open` | 主关联 | txt, md, json, html, css, js, ts, py, sh, yml, go, java 等 68 种 |
| `m.text.editor.custom` | 用户自定义 | key, pem, crt（可通过向导修改） |

配置声明了 iframe 类型、网关 Socket、URL 前缀和权限控制。

### `build/app/ui/images/`
- `icon_64.png`：小图标
- `icon_256.png`：大图标

---

## 5. CI/CD 流水线

`.github/workflows/build.yml` 实现自动化构建：

### 触发方式
手动触发（`workflow_dispatch`），可选 `publish` 参数控制是否发布 Release。

### 构建步骤
1. Checkout 代码
2. Setup Go 1.21
3. 从 `build/manifest` 读取版本号
4. 安装 fnpack 到 `/usr/local/bin`
5. 交叉编译 x86 fpk
6. 交叉编译 arm fpk
7. 上传 fpk 制品（保留 30 天）
8. 打包 Chrome 扩展 zip

### 发布步骤（`publish: true`）
1. 生成 changelog（git log）
2. 清理已有 Release 和 Tag
3. 创建 GitHub Release 并上传 fpk + chrome_extension.zip
4. 更新 FnDepot 仓库的 `fnpack.json`

---

## 6. 权限配置

### `build/config/privilege`
```json
{ "defaults": { "run-as": "root" } }
```

Go 服务以 root 身份运行，通过 `X-Trim-Isadmin` 请求头进行用户级鉴权。

### `build/config/resource`
```json
{}
```

无额外资源声明。

---

## 7. 安装向导

### `build/wizard/config`

JSON 数组定义安装向导步骤：
- **步骤标题**："自定义文件类型"
- **输入项**：逗号分隔的文件后缀列表（正则校验，单个 ≤ 15 字符，总长 ≤ 400）
- **默认值**：`key,pem,crt`
- **警告提示**：保存将直接同步修改系统数据库
