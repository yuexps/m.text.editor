# 飞牛OS打包与分发资源 (build/)

本目录包含 PodNote 前端静态资源、打包配置文件、生命周期脚本及打包工具，用于构建 `.fpk` 格式的飞牛OS安装包。

---

## 1. 目录结构

### 核心包目录 `app/`
* [app/www/](./app/www/README.md)：前端 Web 静态资源与 JavaScript 业务模块。
* [app/server/](./app/server)：存放编译生成的 Linux-AMD64 平台 Go 服务程序。
* [app/ui/](./app/ui)：**飞牛OS应用关联配置**。
  * `config`：声明支持右键或关联打开的文件后缀（如 `txt`, `md`, `json` 等）。
  * `images/`：存放应用中心和桌面的图标文件（如 `icon_256.png`）。

### 飞牛OS应用生命周期脚本 `cmd/`
* **main**：容器入口启动脚本。读取 `TRIM_APPDEST` 并在后台静默拉起 Go 服务。
* **config_init** / **config_callback**：应用参数调整或安装向导触发，初始化端口暴露、挂载路径与 Socket 权限掩码。
* **install_init** / **install_callback**：部署前后执行，创建物理存储目录，校验宿主架构与系统版本。
* **uninstall_init** / **uninstall_callback**：卸载时清理 Unix Socket 残留文件并断开映射。
* **upgrade_init** / **upgrade_callback**：升级时备份并迁移用户配置文件。

### 打包配置与工具
* [manifest](./manifest)：飞牛OS应用配置（TOML）。定义应用名 `m.text.editor`、版本、维护人及入口图标。
* [config/privilege](./config/privilege)：权限声明文件。
* [wizard/](./wizard)：向导配置文件。
* `fnpack.exe` / `fnpack-1.2.1-linux-amd64`：飞牛OS官方打包工具。
* `build.bat`：Windows 快速打包脚本，自动打包生成 `m.text.editor.fpk`。
* [fnpack_skill.md](./fnpack_skill.md)：飞牛OS打包技术说明文档。
