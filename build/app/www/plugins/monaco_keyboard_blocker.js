/**
 * monaco_keyboard_blocker.js - 移动端只读模式阻止弹出键盘插件
 */
import { Log } from '../js/utils.js';

export const MonacoReadOnlyMobileKeyboardBlocker = {
    /**
     * 为编辑器实例注册阻断器
     * @param {object} editor - Monaco 编辑器实例
     */
    register(editor) {
        if (!editor) return;

        let originalFocus = null;
        let disposed = false;
        let focusTextarea = null;
        let focusListener = null;
        const disposers = [];

        const updateInputMode = () => {
            if (disposed) return;
            const container = editor.getDomNode();
            if (!container) return;

            const textarea = container.querySelector('textarea.textarea');
            if (!textarea) return;
            focusTextarea = textarea;

            const isReadOnly = editor.getOption(monaco.editor.EditorOption.readOnly);

            if (!originalFocus) {
                originalFocus = textarea.focus;
            }

            if (isReadOnly) {
                // 阻断软键盘弹出
                textarea.setAttribute('inputmode', 'none');
                textarea.setAttribute('readonly', 'true');
                textarea.focus = function() {
                    // 屏蔽 focus 调用
                };
                if (!focusListener) {
                    focusListener = (e) => {
                        const readOnlyNow = editor.getOption(monaco.editor.EditorOption.readOnly);
                        if (readOnlyNow) {
                            e.preventDefault();
                            textarea.blur();
                        }
                    };
                    textarea.addEventListener('focus', focusListener, true);
                }
                if (document.activeElement === textarea) {
                    textarea.blur();
                }
            } else {
                // 恢复默认输入
                textarea.removeAttribute('inputmode');
                textarea.removeAttribute('readonly');
                if (originalFocus) {
                    textarea.focus = originalFocus;
                }
            }
        };

        // 初始化延迟应用以等待 DOM 渲染
        const initTimer = setTimeout(updateInputMode, 100);
        disposers.push(() => clearTimeout(initTimer));

        // 监听只读状态变化
        disposers.push(editor.onDidChangeConfiguration((e) => {
            if (e.hasChanged(monaco.editor.EditorOption.readOnly)) {
                updateInputMode();
            }
        }));

        // 监听焦点事件防止 Monaco 覆盖属性
        disposers.push(editor.onDidFocusEditorText(updateInputMode));
        disposers.push(editor.onDidFocusEditorWidget(updateInputMode));

        // 监听触屏事件提前干预
        const container = editor.getDomNode();
        if (container) {
            container.addEventListener('touchstart', updateInputMode, { passive: true });
            disposers.push(() => container.removeEventListener('touchstart', updateInputMode, { passive: true }));
        }

        return {
            dispose() {
                disposed = true;
                disposers.splice(0).forEach(disposable => {
                    try {
                        if (typeof disposable === 'function') {
                            disposable();
                        } else if (disposable && typeof disposable.dispose === 'function') {
                            disposable.dispose();
                        }
                    } catch (err) {
                        Log.warn('KeyboardBlocker', '释放监听失败:', err);
                    }
                });

                if (focusTextarea) {
                    if (focusListener) {
                        focusTextarea.removeEventListener('focus', focusListener, true);
                    }
                    focusTextarea.removeAttribute('inputmode');
                    focusTextarea.removeAttribute('readonly');
                    if (originalFocus) {
                        focusTextarea.focus = originalFocus;
                    }
                }
            }
        };
    }
};
