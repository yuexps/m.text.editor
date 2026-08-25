import React from "react";
import { useAppStore } from "../store/useAppStore";
import type { AppSettings } from "../store/useAppStore";
import { FnosSDK } from "../services/fnosSDK";

export const SettingsPanel: React.FC = () => {
  const settings = useAppStore((state) => state.settings);
  const updateSetting = useAppStore((state) => state.updateSetting);
  const isFnosAvailable = useAppStore((state) => state.isFnosAvailable);

  const handleCheckboxChange = (key: keyof AppSettings) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    updateSetting(key, e.target.checked);
  };

  const handleSelectChange = (key: keyof AppSettings) => (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const value = e.target.value;
    const isNum = !isNaN(Number(value)) && value.trim() !== "";
    updateSetting(key, isNum ? Number(value) : value);
  };

  const handleInputChange = (key: keyof AppSettings) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    updateSetting(key, e.target.value);
  };

  const handlePickDefaultPath = async () => {
    const picked = await FnosSDK.pickUserFolder();
    if (picked) {
      updateSetting("defaultOpenPath", picked);
    }
  };

  return (
    <div className="h-full flex flex-col bg-zinc-950 border-r border-zinc-800 text-xs select-none text-zinc-300">
      {/* 标题 */}
      <div className="px-3 py-2 border-b border-zinc-800 shrink-0">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          设置
        </span>
      </div>

      {/* 表单项 */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
        {/* [A] 工作区设置 */}
        <div className="space-y-2.5">
          <div className="text-xs font-bold text-zinc-400 uppercase border-b border-zinc-800 pb-1">
            工作区
          </div>
          <div className="space-y-1">
            <label className="text-xs text-zinc-400">默认打开路径</label>
            <div className="flex space-x-1.5">
              <input
                type="text"
                value={settings.defaultOpenPath}
                onChange={handleInputChange("defaultOpenPath")}
                placeholder="如: /vol1/1000/，留空不启用"
                className="flex-1 bg-zinc-900 text-zinc-200 border border-zinc-800 focus:border-[#0078d4] outline-none text-xs px-2.5 py-1.5 rounded"
              />
              {isFnosAvailable && (
                <button
                  type="button"
                  onClick={handlePickDefaultPath}
                  className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded border border-zinc-700 text-xs"
                >
                  选择
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between py-1">
            <label className="text-xs text-zinc-400">PC端自动切换编辑模式</label>
            <input
              type="checkbox"
              checked={settings.pcAutoEditMode}
              onChange={handleCheckboxChange("pcAutoEditMode")}
              className="w-4 h-4 accent-[#0078d4] bg-zinc-800 rounded border-zinc-700 cursor-pointer"
            />
          </div>
        </div>

        {/* [B] 编辑器设置 */}
        <div className="space-y-2.5">
          <div className="text-xs font-bold text-zinc-400 uppercase border-b border-zinc-800 pb-1">
            编辑器
          </div>
          
          <div className="space-y-1">
            <label className="text-xs text-zinc-400">字体大小</label>
            <select
              value={settings.fontSize}
              onChange={handleSelectChange("fontSize")}
              className="w-full bg-zinc-900 text-zinc-200 border border-zinc-800 outline-none text-xs px-2 py-1.5 rounded cursor-pointer"
            >
              {[12, 13, 14, 15, 16, 18, 20, 22].map((size) => (
                <option key={size} value={size}>
                  {size} px
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-zinc-400">字体类型</label>
            <select
              value={settings.fontFamily}
              onChange={handleSelectChange("fontFamily")}
              className="w-full bg-zinc-900 text-zinc-200 border border-zinc-800 outline-none text-xs px-2 py-1.5 rounded cursor-pointer"
            >
              <option value="Consolas, 'Courier New', monospace">Consolas</option>
              <option value="'Fira Code', Consolas, monospace">Fira Code</option>
              <option value="'Courier New', Courier, monospace">Courier New</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-zinc-400">缩进长度</label>
            <select
              value={settings.tabSize}
              onChange={handleSelectChange("tabSize")}
              className="w-full bg-zinc-900 text-zinc-200 border border-zinc-800 outline-none text-xs px-2 py-1.5 rounded cursor-pointer"
            >
              <option value="2">2 个空格</option>
              <option value="4">4 个空格</option>
              <option value="8">8 个空格</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-zinc-400">渲染空白字符</label>
            <select
              value={settings.renderWhitespace}
              onChange={handleSelectChange("renderWhitespace")}
              className="w-full bg-zinc-900 text-zinc-200 border border-zinc-800 outline-none text-xs px-2 py-1.5 rounded cursor-pointer"
            >
              <option value="none">不显示</option>
              <option value="boundary">边界显示</option>
              <option value="all">显示全部</option>
            </select>
          </div>

          <div className="flex items-center justify-between py-1">
            <label className="text-xs text-zinc-400">自动换行</label>
            <input
              type="checkbox"
              checked={settings.wordWrap === "on"}
              onChange={(e) => updateSetting("wordWrap", e.target.checked ? "on" : "off")}
              className="w-4 h-4 accent-[#0078d4] bg-zinc-800 rounded border-zinc-700 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between py-1">
            <label className="text-xs text-zinc-400">显示小地图</label>
            <input
              type="checkbox"
              checked={settings.minimap}
              onChange={handleCheckboxChange("minimap")}
              className="w-4 h-4 accent-[#0078d4] bg-zinc-800 rounded border-zinc-700 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between py-1">
            <label className="text-xs text-zinc-400">只读模式下启用 Tail</label>
            <input
              type="checkbox"
              checked={settings.readOnlyTail}
              onChange={handleCheckboxChange("readOnlyTail")}
              className="w-4 h-4 accent-[#0078d4] bg-zinc-800 rounded border-zinc-700 cursor-pointer"
            />
          </div>
        </div>

        {/* [C] 主题与换肤 */}
        <div className="space-y-2.5">
          <div className="text-xs font-bold text-zinc-400 uppercase border-b border-zinc-800 pb-1">
            主题皮肤
          </div>

          <div className="space-y-1">
            <label className="text-xs text-zinc-400">代码主题</label>
            <select
              value={settings.editorTheme}
              onChange={handleSelectChange("editorTheme")}
              className="w-full bg-zinc-900 text-zinc-200 border border-zinc-800 outline-none text-xs px-2 py-1.5 rounded cursor-pointer"
            >
              <option value="vs-dark">Dark (深色)</option>
              <option value="vs">Light (浅色)</option>
              <option value="hc-black">High Contrast (高对比度)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-zinc-400">界面皮肤</label>
            <select
              value={settings.uiTheme}
              onChange={handleSelectChange("uiTheme")}
              className="w-full bg-zinc-900 text-zinc-200 border border-zinc-800 outline-none text-xs px-2 py-1.5 rounded cursor-pointer"
            >
              <option value="dark">暗黑主题</option>
              <option value="light">明亮主题</option>
            </select>
          </div>
        </div>

        {/* [D] 终端设置 */}
        <div className="space-y-2.5">
          <div className="text-xs font-bold text-zinc-400 uppercase border-b border-zinc-800 pb-1">
            终端 (Terminal)
          </div>

          <div className="space-y-1">
            <label className="text-xs text-zinc-400">终端字体大小</label>
            <select
              value={settings.terminalFontSize}
              onChange={handleSelectChange("terminalFontSize")}
              className="w-full bg-zinc-900 text-zinc-200 border border-zinc-800 outline-none text-xs px-2 py-1.5 rounded cursor-pointer"
            >
              {[12, 13, 14, 15, 16].map((size) => (
                <option key={size} value={size}>
                  {size} px
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-zinc-400">终端光标样式</label>
            <select
              value={settings.terminalCursorStyle}
              onChange={handleSelectChange("terminalCursorStyle")}
              className="w-full bg-zinc-900 text-zinc-200 border border-zinc-800 outline-none text-xs px-2 py-1.5 rounded cursor-pointer"
            >
              <option value="block">Block</option>
              <option value="bar">Bar</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-zinc-400">默认执行用户</label>
            <select
              value={settings.terminalUser}
              onChange={handleSelectChange("terminalUser")}
              className="w-full bg-zinc-900 text-zinc-200 border border-zinc-800 outline-none text-xs px-2 py-1.5 rounded cursor-pointer"
            >
              <option value="current">当前登录用户</option>
              <option value="root">root</option>
            </select>
          </div>

          <div className="flex items-center justify-between py-1">
            <label className="text-xs text-zinc-400">光标闪烁</label>
            <input
              type="checkbox"
              checked={settings.terminalCursorBlink}
              onChange={handleCheckboxChange("terminalCursorBlink")}
              className="w-4 h-4 accent-[#0078d4] bg-zinc-800 rounded border-zinc-700 cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
