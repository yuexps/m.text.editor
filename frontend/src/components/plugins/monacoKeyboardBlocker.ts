import * as monaco from "monaco-editor";

export const MonacoReadOnlyMobileKeyboardBlocker = {
  register(editor: monaco.editor.IStandaloneCodeEditor) {
    if (!editor) return { dispose: () => {} };

    let originalFocus: (() => void) | null = null;
    let disposed = false;
    let focusTextarea: HTMLTextAreaElement | null = null;
    let focusListener: ((e: FocusEvent) => void) | null = null;
    const disposers: (() => void)[] = [];

    const updateInputMode = () => {
      if (disposed) return;
      const container = editor.getDomNode();
      if (!container) return;

      const textarea = container.querySelector("textarea.textarea") as HTMLTextAreaElement;
      if (!textarea) return;
      focusTextarea = textarea;

      const isReadOnly = editor.getOption(monaco.editor.EditorOption.readOnly);

      if (!originalFocus) {
        originalFocus = textarea.focus;
      }

      if (isReadOnly) {
        textarea.setAttribute("inputmode", "none");
        textarea.setAttribute("readonly", "true");
        textarea.focus = function () {
          // 屏蔽 focus 调用
        };
        if (!focusListener) {
          focusListener = (e: FocusEvent) => {
            const readOnlyNow = editor.getOption(monaco.editor.EditorOption.readOnly);
            if (readOnlyNow) {
              e.preventDefault();
              textarea.blur();
            }
          };
          textarea.addEventListener("focus", focusListener, true);
        }
        if (document.activeElement === textarea) {
          textarea.blur();
        }
      } else {
        textarea.removeAttribute("inputmode");
        textarea.removeAttribute("readonly");
        if (originalFocus) {
          textarea.focus = originalFocus;
        }
      }
    };

    const initTimer = setTimeout(updateInputMode, 100);
    disposers.push(() => clearTimeout(initTimer));

    disposers.push(
      editor.onDidChangeConfiguration((e) => {
        if (e.hasChanged(monaco.editor.EditorOption.readOnly)) {
          updateInputMode();
        }
      }).dispose
    );

    disposers.push(editor.onDidFocusEditorText(updateInputMode).dispose);
    disposers.push(editor.onDidFocusEditorWidget(updateInputMode).dispose);

    const container = editor.getDomNode();
    if (container) {
      const touchHandler = () => updateInputMode();
      container.addEventListener("touchstart", touchHandler, { passive: true });
      disposers.push(() => container.removeEventListener("touchstart", touchHandler));
    }

    return {
      dispose() {
        disposed = true;
        disposers.forEach((disposable) => {
          try {
            disposable();
          } catch (err) {
            console.warn("KeyboardBlocker 释放监听失败:", err);
          }
        });

        if (focusTextarea) {
          if (focusListener) {
            focusTextarea.removeEventListener("focus", focusListener, true);
          }
          focusTextarea.removeAttribute("inputmode");
          focusTextarea.removeAttribute("readonly");
          if (originalFocus) {
            focusTextarea.focus = originalFocus;
          }
        }
      },
    };
  },
};
