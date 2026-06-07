# 第三方插件与环境注入 (build/app/www/plugins/)

本目录包含 PodNote 依赖的第三方插件及用于飞牛OS（FNOS）环境注入的脚本。

---

## 1. 插件与脚本列表

* [inject_fnos.js](./inject_fnos.js)：向飞牛OS（FNOS）页面注入右键菜单、文件管理器关联及新建文件按钮的核心脚本。
  * **机制**：基于文本特征和 DOM 属性匹配元素（去类名化）；代理原生 `WebSocket` 拦截 `file.ls` 并在宿主上绑定 `__podnote_path` 绝对物理路径；使用 iframe 加载悬浮窗口并支持幽灵透视模式（半透明与鼠标穿透）。
* [marked.min.js](./marked.min.js)：编译压缩后的 `marked` 解析库，用于前端将 Markdown 实时渲染为 HTML。
* [monaco_keyboard_blocker.js](./monaco_keyboard_blocker.js)：只读模式下阻断移动端虚拟软键盘弹出的插件。
  * **机制**：只读状态下动态在 Monaco 隐藏的 `textarea` 上追加 `inputmode="none"` 和 `readonly` 属性。
* [monaco_touch_helper.js](./monaco_touch_helper.js)：移动端触屏长按选择和浮动气泡复制菜单的辅助插件。
  * **机制**：长按触发后在选区两侧渲染倒水滴形触控滑柄，并呼出磨砂玻璃风格的选择操作气泡菜单。
