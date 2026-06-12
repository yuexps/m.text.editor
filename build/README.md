# 飞牛OS打包分发资源 (build/)

---

## 1. 物理文件清单

| 文件/目录名 | 物理链接 | 核心职责 |
|:---|:---|:---|
| app/www/ | [app/www/](./app/www/README.md) | 前端静态页面 HTML 结构与 ES Module 子模块。 |
| app/server/ | [app/server/](./app/server/) | Go 交叉编译生成的 Linux-AMD64 二进制存盘目标。 |
| app/ui/ | [app/ui/](./app/ui/) | 飞牛OS系统级关联配置描述（支持的默认文件后缀、向导设置、桌面图标）。 |
| cmd/ | [cmd/](./cmd/) | 飞牛OS容器应用生命周期回调脚本（主脚本、自定义后缀 PostgreSQL 同步脚本）。 |
| manifest | [manifest](./manifest) | 飞牛OS应用清单配置文件 (TOML 规范)。 |
| config/ | [config/](./config/) | 飞牛OS特权声明（run-as 等权限规约）。 |
| wizard/ | [wizard/](./wizard/) | 飞牛OS应用安装向导 UI 步骤定义。 |
| fnpack.exe | `fnpack.exe` | Windows 物理环境下飞牛OS官方分发包打包工具。 |

---

## 2. 核心架构约束

* **版本强制更新约束**：前端静态网页 JS/CSS 发生任何优化变更时，必须同步递增 `manifest` 文件中的应用版本号，否则版本缓存失效策略将无法运作。

---

## 3. 技术文档超链接

* 飞牛OS生命周期调用、数据库同步机制与 CI/CD 打包流水线 → [docs/BUILD_DEPLOY.md](../docs/BUILD_DEPLOY.md)
