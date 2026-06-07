# 开发测试目录 (test/)

本目录用于本地开发调试、API 仿真与前端界面预览，提供非飞牛OS环境下的 Node.js mock 仿真服务器。

---

## 1. 目录与文件索引

* [scratch/mock_server.js](./scratch/mock_server.js)：本地测试 Node.js 仿真服务器。
* [scratch/files/](./scratch/files)：真实测试物理文件存放目录。
* [package.json](./package.json) & `package-lock.json`：Node.js 依赖配置。

---

## 2. 仿真服务器实现细节 (mock_server.js)

`mock_server.js` 启动于本地 3000 端口，模拟了后端的全部核心业务接口：
* **路径映射**：直接映射并使用 `test/scratch/files/` 中的真实物理文件，并将请求参数 `path` 映射为该工作区绝对路径。
* **HTTP API 仿真**：
  * `/api/list`：目录项读取。
  * `/api/read`：文件读取（含大小限制及二进制校验）。
  * `/api/save`：带 mtime 乐观锁冲突检测的文件原子写入。
  * `/api/new` & `/api/create`：文件/目录的物理新建与预检。
* **WebSocket 升级分流**：
  * `/api/terminal/ws`：终端仿真。处理退格及模拟执行常用 Bash 指令（help, clear, date, whoami）。
  * `/api/watch/ws`：文件监视仿真。基于 `fs.watch` 在文件发生实质改变（mtime 或 size 变化）时推送变更。

---

## 3. 本地开发调试方法

在 `test/` 目录下依次运行以下命令：
```bash
# 1. 安装依赖
npm install

# 2. 启动仿真服务器
node scratch/mock_server.js
```
打开浏览器访问 [http://localhost:3000](http://localhost:3000) 即可预览与调试编辑器前端。
