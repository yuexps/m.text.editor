/**
 * editor.js - Monaco 编辑器实例管理与核心编辑逻辑
 */
import { els } from './ui.js';
import { Log } from './utils.js';
import { IDECore } from './ide_core.js';

let editor = null;

export const EditorManager = {
    init(container, options, context) {
        editor = monaco.editor.create(container, options);
        // 初始化 IDE 核心功能
        IDECore.init(editor, context);
        return editor;
    },

    getEditor() {
        return editor;
    },

    /**
     * 切换编辑/只读模式
     */
    setEditMode(enabled, isEditMode, originalContent, callback) {
        if (!editor || !els.editModeBtn || !els.saveBtn) return isEditMode;

        // 仅在模式发生变化时记录日志
        if (enabled !== isEditMode) {
            Log.info('Mode', '切换模式, isEditMode:', enabled);
        }

        // 如果是从编辑模式切换到只读（取消），还原内容
        if (isEditMode && !enabled) {
            callback({ isIgnoringChange: true });
            editor.setValue(originalContent);
            callback({ isIgnoringChange: false });
        }

        const newEditMode = enabled;
        editor.updateOptions({ readOnly: !newEditMode });

        // 同步功能按钮状态
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
