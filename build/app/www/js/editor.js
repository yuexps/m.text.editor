/**
 * editor.js - Monaco 编辑器实例管理与核心编辑逻辑
 */
import { els } from './ui.js';
import { Log, checkIsMobile } from './utils.js';
import { IDECore } from './ide_core.js';
import { MonacoReadOnlyMobileKeyboardBlocker } from '../plugins/monaco_keyboard_blocker.js';
import { MonacoMobileTouchHelper } from '../plugins/monaco_touch_helper.js';

let editor = null;

export const EditorManager = {
    /**
     * 配置 Monaco 底层 Web Worker 加载路径与多语言环境 (NLS)
     */
    configureEnvironment() {
        const APP_BASE = '/app/m-text-editor';
        const ORIGIN = window.location.origin;
        const VS_PATH = ORIGIN + APP_BASE + '/vs';

        window.MonacoEnvironment = {
            getWorkerUrl: function (workerId, label) {
                const workerCode = `
                    self.MonacoEnvironment = { baseUrl: '${ORIGIN}${APP_BASE}/' };
                    importScripts('${VS_PATH}/base/worker/workerMain.js');
                `;
                const blob = new Blob([workerCode], { type: 'application/javascript' });
                return URL.createObjectURL(blob);
            }
        };

        window.require.config({
            paths: { 'vs': VS_PATH },
            'vs/nls': {
                availableLanguages: {
                    '*': 'zh-cn'
                }
            }
        });
    },

    init(container, options, context) {
        editor = monaco.editor.create(container, options);
        IDECore.init(editor, context);

        // 移动端相关插件注册 (选词手柄与只读键盘阻断)
        if (checkIsMobile()) {
            MonacoMobileTouchHelper.register(editor, container);
            MonacoReadOnlyMobileKeyboardBlocker.register(editor);
        }

        return editor;
    },

    getEditor() {
        return editor;
    },

    /**
     * 切换编辑/只读模式
     */
    setEditMode(enabled, isEditMode, originalContent, callback, skipReset = false) {
        if (!editor || !els.editModeBtn || !els.saveBtn) return isEditMode;

        if (enabled !== isEditMode) {
            Log.info('Mode', '切换模式, isEditMode:', enabled);
        }

        if (isEditMode && !enabled && !skipReset) {
            callback({ isIgnoringChange: true });
            editor.setValue(originalContent);
            callback({ isIgnoringChange: false });
        }

        const newEditMode = enabled;
        editor.updateOptions({ 
            readOnly: !newEditMode,
            domReadOnly: !newEditMode
        });

        const editOnlyIds = ['undo-btn', 'redo-btn', 'paste-btn', 'replace-btn', 'eol-selector'];
        editOnlyIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.style.opacity = newEditMode ? '1' : '0.4';
                el.style.pointerEvents = newEditMode ? 'auto' : 'none';
            }
        });

        if (newEditMode) {
            els.editModeBtn.classList.remove('active');
            els.editModeBtn.innerText = '取消';
            els.saveBtn.style.display = 'flex';
            els.saveBtn.disabled = true;
            editor.focus();
        } else {
            els.editModeBtn.classList.add('active');
            els.editModeBtn.innerText = '编辑';
            els.saveBtn.style.display = 'none';
        }

        return newEditMode;
    },

    /**
     * 更新字数统计
     */
    updateCharCount() {
        if (!editor || !els.charCount) return;
        const model = editor.getModel();
        if (!model) {
            els.charCount.innerText = '0 字符';
            return;
        }

        const totalChars = model.getValueLength();
        const selection = editor.getSelection();

        if (selection && !selection.isEmpty()) {
            const selectedChars = model.getValueInRange(selection).length;
            els.charCount.innerText = `${selectedChars} / ${totalChars} 字符`;
        } else {
            els.charCount.innerText = `${totalChars} 字符`;
        }
    },

    /**
     * 更新换行符显示
     */
    updateEOLDisplay() {
        if (!editor) return;
        const eol = editor.getModel().getEOL();
        els.eolSelector.innerText = eol === '\n' ? 'LF' : 'CRLF';
    },

    /**
     * 设置语言
     */
    setLanguage(langId) {
        if (editor && langId) {
            monaco.editor.setModelLanguage(editor.getModel(), langId);
        }
    }
};
