# 第三方插件与环境注入 (build/app/www/plugins/)

本目录包含 PodNote 依赖的第三方库及用于飞牛OS（FNOS）环境注入的脚本。

---

## 1. 文件清单

| 文件 | 职责 |
|------|------|
| [inject_fnos.js](./inject_fnos.js) | FNOS 文件管理器集成（右键菜单/新建按钮/编辑器弹窗） |
| [marked.min.js](./marked.min.js) | Markdown 解析库 |
| [monaco_keyboard_blocker.js](./monaco_keyboard_blocker.js) | 只读模式阻断移动端虚拟键盘 |
| [monaco_touch_helper.js](./monaco_touch_helper.js) | 移动端触屏长按选择与气泡菜单 |
| [mammoth.browser.min.js](./mammoth.browser.min.js) | Word docx 前端解析与文本 HTML 提取转换器 |
| [xlsx.mini.min.js](./xlsx.mini.min.js) | Excel xlsx 前端极简数据读取及解析器 |
| [trimapp_sdk.js](./trimapp_sdk.js) | 飞牛 OS (FNOS) 开放能力前端本地 JS SDK (离线/内网环境垫片) |


---

## 2. 深度参考

* 插件功能说明 → [docs/FRONTEND_MODULES.md](../../../../docs/FRONTEND_MODULES.md) §5
* 注入机制与通信桥接 → [docs/CHROME_EXTENSION.md](../../../../docs/CHROME_EXTENSION.md)
