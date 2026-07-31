/**
 * settings.js - 云端设置持久化管理与组件配置热更新
 */
import { Log, checkIsMobile, createDisposableStore, debounce } from './utils.js';
import { API } from './api.js';
import { FnosSDK } from './fnos_sdk.js';
import { showToast } from './ui/feedback.js';


const DEFAULT_SETTINGS = {
    defaultOpenPath: "",
    pcAutoEditMode: false,
    fontSize: 14,
    fontFamily: "Consolas, 'Courier New', monospace",
    wordWrap: 'on',
    minimap: true,
    readOnlyTail: false,
    tabSize: 4,
    renderWhitespace: 'none',
    editorTheme: 'vs-dark',
    uiTheme: 'dark',
    terminalFontSize: 13,
    terminalCursorStyle: 'block',
    terminalCursorBlink: true,
    terminalUser: 'current'
};

let cachedSettings = null;
let settingsDisposables = createDisposableStore();

export const SettingsManager = {
    /**
     * 同步获取内存缓存配置 (作为兜底与同步调用接口)
     */
    load() {
        if (cachedSettings) {
            return cachedSettings;
        }

        const isMobile = checkIsMobile();
        const defaultSettings = { ...DEFAULT_SETTINGS };
        if (isMobile) {
            defaultSettings.fontSize = 13;
            defaultSettings.minimap = false;
            defaultSettings.terminalFontSize = 12;
            defaultSettings.tabSize = 2;
        }
        return defaultSettings;
    },

    /**
     * 异步从云端加载配置
     */
    async loadFromServer() {
        const isMobile = checkIsMobile();
        const clientType = isMobile ? 'mobile' : 'pc';
        const defaultSettings = { ...DEFAULT_SETTINGS };
        if (isMobile) {
            defaultSettings.fontSize = 13;
            defaultSettings.minimap = false;
            defaultSettings.terminalFontSize = 12;
            defaultSettings.tabSize = 2;
        }

        try {
            const serverSettings = await API.getSettings(clientType);
            cachedSettings = { ...defaultSettings, ...serverSettings };
        } catch (err) {
            Log.error('Settings', '云端读取配置失败:', err);
            cachedSettings = defaultSettings;
        }
        return cachedSettings;
    },

    /**
     * 异步保存配置至云端
     */
    async save(settings) {
        cachedSettings = { ...settings };
        const clientType = checkIsMobile() ? 'mobile' : 'pc';
        try {
            await API.saveSettings(settings, clientType);
        } catch (err) {
            Log.error('Settings', '保存配置到云端失败:', err);
        }
    },


    /**
     * 热应用设置选项到 Monaco 编辑器与系统 UI DOM
     * @param {Object} settings - 配置选项
     * @param {Object} editor - Monaco 编辑器实例
     */
    apply(settings, editor) {
        // [1] 热更新 Monaco 编辑器相关选项
        if (editor) {
            const wrapOption = settings.wordWrap === 'on' || settings.wordWrap === true ? 'on' : 'off';
            editor.updateOptions({
                fontSize: parseInt(settings.fontSize, 10) || 14,
                fontFamily: settings.fontFamily,
                wordWrap: wrapOption,
                minimap: { enabled: settings.minimap === true || settings.minimap === 'true' },
                tabSize: parseInt(settings.tabSize, 10) || 4,
                renderWhitespace: settings.renderWhitespace
            });

            // [2] 代码主题热更新
            if (window.monaco && monaco.editor) {
                monaco.editor.setTheme(settings.editorTheme);
            }
        }

        // [3] UI 深浅色主题皮肤热更新
        const body = document.body;
        if (settings.uiTheme === 'light') {
            body.classList.remove('theme-dark');
            body.classList.add('theme-light');
        } else {
            body.classList.remove('theme-light');
            body.classList.add('theme-dark');
        }

        // [4] 对外状态栏指示器等联动（如有）
        const eolSelector = document.getElementById('eol-selector');
        if (eolSelector && editor) {
            const model = editor.getModel();
            if (model) {
                const eol = model.getEOL();
                eolSelector.innerText = eol === '\n' ? 'LF' : 'CRLF';
            }
        }

        // 终端模式切换已弃用，系统已默认采用分隔布局
    },

    /**
     * 双向数据绑定：同步回填表单并注册事件监听
     * @param {HTMLElement} container - 设置侧栏表单的容器 DOM
     * @param {Object} editor - 编辑器实例
     * @param {Function} onSettingsSaved - 配置被修改保存后的附加回调，用于同步其它组件（如 xterm）
     */
    bindUI(container, editor, onSettingsSaved) {
        if (!container) return;
        settingsDisposables.dispose();
        settingsDisposables = createDisposableStore();

        const settings = this.load();
        const inputs = {
            defaultOpenPath: container.querySelector('#settings-default-open-path'),
            pcAutoEditMode: container.querySelector('#settings-pc-auto-edit'),
            fontSize: container.querySelector('#settings-font-size'),
            fontFamily: container.querySelector('#settings-font-family'),
            wordWrap: container.querySelector('#settings-word-wrap'),
            minimap: container.querySelector('#settings-minimap'),
            readOnlyTail: container.querySelector('#settings-read-only-tail'),
            tabSize: container.querySelector('#settings-tab-size'),
            renderWhitespace: container.querySelector('#settings-whitespace'),
            editorTheme: container.querySelector('#settings-editor-theme'),
            uiTheme: container.querySelector('#settings-ui-theme'),
            terminalFontSize: container.querySelector('#settings-terminal-font-size'),
            terminalCursorStyle: container.querySelector('#settings-terminal-cursor-style'),
            terminalCursorBlink: container.querySelector('#settings-terminal-cursor-blink'),
            terminalUser: container.querySelector('#settings-terminal-user')
        };

        // 数据回显
        for (const key in inputs) {
            const el = inputs[key];
            if (!el) continue;
            if (el.type === 'checkbox') {
                el.checked = settings[key] === true || settings[key] === 'true' || settings[key] === 'on';
            } else {
                el.value = settings[key];
            }
        }

        // 事件委托监听输入更新
        const persistSettings = debounce((newSettings) => {
            this.save(newSettings);
        }, 400);
        settingsDisposables.add(() => persistSettings.flush?.());

        const handleUpdate = () => {
            const newSettings = {};
            for (const key in inputs) {
                const el = inputs[key];
                if (!el) continue;
                if (el.type === 'checkbox') {
                    newSettings[key] = el.checked;
                } else {
                    newSettings[key] = el.value;
                }
            }

            cachedSettings = { ...newSettings };
            persistSettings(newSettings);
            this.apply(newSettings, editor);

            if (typeof onSettingsSaved === 'function') {
                onSettingsSaved(newSettings);
            }
        };

        const handleInput = (e) => {
            // 对输入数值或直接操作进行输入过程中的实时热预览，改善用户交互细节
            if (e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') {
                handleUpdate();
            }
        };

        container.addEventListener('change', handleUpdate);
        container.addEventListener('input', handleInput);
        settingsDisposables.add(() => {
            container.removeEventListener('change', handleUpdate);
            container.removeEventListener('input', handleInput);
        });

        // 绑定默认工作区路径唤起 FNOS 目录选择器按钮
        const browseBtn = container.querySelector('#browse-default-path-btn');
        if (browseBtn) {
            const handleBrowseClick = async () => {
                if (FnosSDK.isAvailable()) {
                    const pickedFolder = await FnosSDK.pickUserFolder();
                    if (pickedFolder && inputs.defaultOpenPath) {
                        inputs.defaultOpenPath.value = pickedFolder;
                        handleUpdate();
                    }
                } else {
                    showToast('请在 FNOS 微应用容器中试用目录选择器');
                }
            };
            browseBtn.addEventListener('click', handleBrowseClick);
            settingsDisposables.add(() => browseBtn.removeEventListener('click', handleBrowseClick));
        }

        // 初始应用配置
        this.apply(settings, editor);
        FnosSDK.updateAdaptationUI();
    },

    dispose() {
        settingsDisposables.dispose();
    }
};
