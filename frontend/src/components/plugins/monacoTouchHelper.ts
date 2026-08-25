import * as monaco from "monaco-editor";
import { useAppStore } from "../../store/useAppStore";

interface IDisposable {
  dispose(): void;
}

const showToast = (msg: string, isError = false) => {
  useAppStore.getState().showToast(msg, isError);
};

const createDisposableStore = () => {
  const disposables: (() => void)[] = [];
  return {
    add(disposable: (() => void) | IDisposable) {
      if (typeof disposable === "function") {
        disposables.push(disposable);
      } else if (disposable && typeof disposable.dispose === "function") {
        disposables.push(() => (disposable as IDisposable).dispose());
      }
    },
    dispose() {
      disposables.forEach((fn) => fn());
      disposables.length = 0;
    },
  };
};

function frameThrottle<T extends (...args: any[]) => void>(fn: T) {
  let active = false;
  let lastArgs: any[] | null = null;
  const throttled = function (...args: Parameters<T>) {
    lastArgs = args;
    if (active) return;
    active = true;
    requestAnimationFrame(() => {
      const currentArgs = lastArgs;
      lastArgs = null;
      active = false;
      if (currentArgs) {
        fn(...currentArgs);
      }
    });
  };
  (throttled as any).cancel = () => {
    active = false;
    lastArgs = null;
  };
  return throttled;
}

const Clipboard = {
  async copy(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.error("Clipboard copy error:", err);
      return false;
    }
  },
};

const STYLE_ID = "monaco-mobile-touch-helper-styles";

const injectStyles = () => {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .monaco-mobile-bubble {
        position: fixed;
        z-index: 20000;
        display: flex;
        flex-direction: row;
        align-items: center;
        background: #252526;
        border: 1px solid var(--border-color, #2b2b2b);
        border-radius: 6px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
        padding: 3px 6px;
        animation: bubbleFadeIn 0.15s cubic-bezier(0, 0, 0.2, 1);
    }
    @keyframes bubbleFadeIn {
        from {
            opacity: 0;
            transform: translateY(5px) scale(0.95);
        }
        to {
            opacity: 1;
            transform: translateY(0) scale(1);
        }
    }
    .monaco-mobile-bubble .bubble-btn {
        background: none;
        border: none;
        color: #ffffff;
        font-size: 12px;
        font-family: inherit;
        padding: 4px 10px;
        cursor: pointer;
        border-radius: 4px;
        transition: background 0.15s;
        outline: none;
        white-space: nowrap;
    }
    .monaco-mobile-bubble .bubble-btn:active {
        background: rgba(255, 255, 255, 0.15);
    }
    .theme-light .monaco-mobile-bubble {
        background: #ffffff;
        border: 1px solid var(--border-color, #d4d4d4);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    }
    .theme-light .monaco-mobile-bubble .bubble-btn {
        color: #333333;
    }
    .theme-light .monaco-mobile-bubble .bubble-btn:active {
        background: rgba(0, 0, 0, 0.08);
    }
    .monaco-touch-handle {
        position: fixed;
        z-index: 19999;
        pointer-events: none;
    }
    .monaco-touch-handle .handle-line {
        position: absolute;
        width: 2px;
        height: 100%;
        background: #007acc;
        left: 0;
        top: 0;
    }
    .monaco-touch-handle .handle-dot {
        position: absolute;
        width: 16px;
        height: 16px;
        background: #007acc;
        pointer-events: auto;
        cursor: pointer;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
    }
    .monaco-touch-handle.handle-start .handle-dot {
        border-radius: 50% 0 50% 50%;
        left: -16px;
        top: 100%;
    }
    .monaco-touch-handle.handle-end .handle-dot {
        border-radius: 0 50% 50% 50%;
        left: 0;
        top: 100%;
    }
    .monaco-touch-handle.dragging .handle-dot {
        pointer-events: none !important;
    }
    .monaco-touch-handle .handle-dot::after {
        content: '';
        position: absolute;
        width: 36px;
        height: 36px;
        left: -10px;
        top: -10px;
        background: transparent;
    }
  `;
  document.head.appendChild(style);
};

export const MonacoMobileTouchHelper = {
  register(editor: monaco.editor.IStandaloneCodeEditor, container: HTMLElement) {
    injectStyles();
    const disposables = createDisposableStore();
    let disposed = false;
    let touchStartTimer: any = null;
    let startX = 0;
    let startY = 0;
    let bubbleEl: HTMLDivElement | null = null;
    let startHandleEl: HTMLDivElement | null = null;
    let endHandleEl: HTMLDivElement | null = null;
    let isSelectingAll = false;
    let hasTriggeredLongPress = false;
    let lastTouchTime = 0;

    const addContainerListener = (
      type: string,
      handler: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions
    ) => {
      container.addEventListener(type, handler, options);
      disposables.add(() => container.removeEventListener(type, handler, options));
    };

    const createHandles = () => {
      if (startHandleEl) return;

      startHandleEl = document.createElement("div");
      startHandleEl.className = "monaco-touch-handle handle-start";
      startHandleEl.innerHTML = '<div class="handle-line"></div><div class="handle-dot"></div>';

      endHandleEl = document.createElement("div");
      endHandleEl.className = "monaco-touch-handle handle-end";
      endHandleEl.innerHTML = '<div class="handle-line"></div><div class="handle-dot"></div>';

      document.body.appendChild(startHandleEl);
      document.body.appendChild(endHandleEl);

      bindHandleDrag(startHandleEl, true);
      bindHandleDrag(endHandleEl, false);
    };

    const removeHandles = () => {
      if (startHandleEl) {
        if (startHandleEl.parentNode) startHandleEl.parentNode.removeChild(startHandleEl);
        startHandleEl = null;
      }
      if (endHandleEl) {
        if (endHandleEl.parentNode) endHandleEl.parentNode.removeChild(endHandleEl);
        endHandleEl = null;
      }
    };

    const updateHandlesPosition = frameThrottle(() => {
      if (disposed) return;

      const selection = editor.getSelection();
      if (!selection || selection.isEmpty()) {
        if (startHandleEl) {
          startHandleEl.style.display = "none";
          endHandleEl!.style.display = "none";
        }
        removeBubble();
        return;
      }

      createHandles();

      const startPos = selection.getStartPosition();
      const endPos = selection.getEndPosition();

      const startCoord = editor.getScrolledVisiblePosition(startPos);
      const endCoord = editor.getScrolledVisiblePosition(endPos);

      const containerRect = container.getBoundingClientRect();
      const defaultHeight = editor.getOption(monaco.editor.EditorOption.lineHeight) || 18;

      if (startCoord && startHandleEl) {
        startHandleEl.style.display = "block";
        const left = containerRect.left + startCoord.left;
        const top = containerRect.top + startCoord.top;
        const height = startCoord.height || defaultHeight;

        startHandleEl.style.left = `${left}px`;
        startHandleEl.style.top = `${top}px`;
        startHandleEl.style.height = `${height}px`;
      } else if (startHandleEl) {
        startHandleEl.style.display = "none";
      }

      if (endCoord && endHandleEl) {
        endHandleEl.style.display = "block";
        const left = containerRect.left + endCoord.left;
        const top = containerRect.top + endCoord.top;
        const height = endCoord.height || defaultHeight;

        endHandleEl.style.left = `${left}px`;
        endHandleEl.style.top = `${top}px`;
        endHandleEl.style.height = `${height}px`;
      } else if (endHandleEl) {
        endHandleEl.style.display = "none";
      }
    });

    const bindHandleDrag = (handleEl: HTMLDivElement, isStart: boolean) => {
      const dotEl = handleEl.querySelector(".handle-dot") as HTMLDivElement;
      if (!dotEl) return;

      dotEl.addEventListener(
        "touchstart",
        (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (e.touches.length !== 1) return;
          handleEl.classList.add("dragging");
          removeBubble();
        },
        { passive: false }
      );

      dotEl.addEventListener(
        "touchmove",
        (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (e.touches.length !== 1) return;
          const touch = e.touches[0];

          const target = editor.getTargetAtClientPoint(touch.clientX, touch.clientY);
          if (target && target.position) {
            const currentPos = target.position;
            const selection = editor.getSelection();
            if (!selection) return;

            let newSelection;
            if (isStart) {
              const endPos = selection.getEndPosition();
              if (
                currentPos.lineNumber > endPos.lineNumber ||
                (currentPos.lineNumber === endPos.lineNumber && currentPos.column >= endPos.column)
              ) {
                newSelection = new monaco.Selection(
                  endPos.lineNumber,
                  Math.max(1, endPos.column - 1),
                  endPos.lineNumber,
                  endPos.column
                );
              } else {
                newSelection = new monaco.Selection(
                  currentPos.lineNumber,
                  currentPos.column,
                  endPos.lineNumber,
                  endPos.column
                );
              }
            } else {
              const startPos = selection.getStartPosition();
              if (
                currentPos.lineNumber < startPos.lineNumber ||
                (currentPos.lineNumber === startPos.lineNumber && currentPos.column <= startPos.column)
              ) {
                newSelection = new monaco.Selection(
                  startPos.lineNumber,
                  startPos.column,
                  startPos.lineNumber,
                  startPos.column + 1
                );
              } else {
                newSelection = new monaco.Selection(
                  startPos.lineNumber,
                  startPos.column,
                  currentPos.lineNumber,
                  currentPos.column
                );
              }
            }
            editor.setSelection(newSelection);
          }
        },
        { passive: false }
      );

      const endDrag = (e: TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const showSelectionBubble = () => {
          const selection = editor.getSelection();
          if (selection && !selection.isEmpty()) {
            const endPos = selection.getEndPosition();
            const endCoord = editor.getScrolledVisiblePosition(endPos);
            const containerRect = container.getBoundingClientRect();
            if (endCoord) {
              showBubble(containerRect.left + endCoord.left, containerRect.top + endCoord.top);
              return true;
            }
          }
          return false;
        };

        if (!showSelectionBubble()) {
          setTimeout(() => {
            if (disposed) return;
            showSelectionBubble();
            handleEl.classList.remove("dragging");
          }, 50);
        } else {
          handleEl.classList.remove("dragging");
        }
      };

      dotEl.addEventListener("touchend", endDrag, { passive: false });
      dotEl.addEventListener("touchcancel", endDrag, { passive: false });
    };

    const showBubble = (clientX: number, clientY: number) => {
      removeBubble();

      const isReadOnly = editor.getOption(monaco.editor.EditorOption.readOnly);

      bubbleEl = document.createElement("div");
      bubbleEl.className = "monaco-mobile-bubble";
      bubbleEl.innerHTML = `
          <button class="bubble-btn" id="bubble-copy">复制</button>
          ${!isReadOnly ? '<button class="bubble-btn" id="bubble-cut">剪切</button>' : ""}
          <button class="bubble-btn" id="bubble-select-all">全选</button>
          <button class="bubble-btn" id="bubble-close">取消</button>
      `;

      bubbleEl.addEventListener(
        "touchstart",
        (e) => {
          e.preventDefault();
        },
        { passive: false }
      );
      bubbleEl.addEventListener("mousedown", (e) => {
        e.preventDefault();
      });

      document.body.appendChild(bubbleEl);

      const bubbleWidth = isReadOnly ? 170 : 220;
      const bubbleHeight = 32;
      const viewport = (window as any).visualViewport;
      const viewportLeft = viewport?.offsetLeft || 0;
      const viewportTop = viewport?.offsetTop || 0;
      const viewportWidth = viewport?.width || window.innerWidth;
      const viewportHeight = viewport?.height || window.innerHeight;
      let left = clientX - bubbleWidth / 2;
      let top = clientY - bubbleHeight - 15;

      if (left < viewportLeft + 10) left = viewportLeft + 10;
      if (left + bubbleWidth > viewportLeft + viewportWidth - 10) {
        left = viewportLeft + viewportWidth - bubbleWidth - 10;
      }
      if (top < viewportTop + 10) top = clientY + 15;
      if (top + bubbleHeight > viewportTop + viewportHeight - 10) {
        top = viewportTop + viewportHeight - bubbleHeight - 10;
      }

      bubbleEl.style.left = `${left}px`;
      bubbleEl.style.top = `${top}px`;

      const bindBtn = (id: string, handler: (e: Event) => void) => {
        const btn = bubbleEl!.querySelector(id);
        if (!btn) return;
        const wrapper = (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
          handler(e);
        };
        btn.addEventListener("touchend", wrapper, { passive: false });
        btn.addEventListener("click", wrapper);
      };

      if (!isReadOnly) {
        bindBtn("#bubble-cut", async () => {
          const selection = editor.getSelection();
          const model = editor.getModel();
          if (selection && !selection.isEmpty() && model) {
            const text = model.getValueInRange(selection);
            try {
              const success = await Clipboard.copy(text);
              if (success) {
                editor.executeEdits("touch-helper", [
                  {
                    range: selection,
                    text: "",
                    forceMoveMarkers: true,
                  },
                ]);
                showToast("已剪切选择内容");
              }
            } catch (err) {
              console.error("Clipboard cut failed:", err);
              showToast("剪切失败", true);
            }
          }
          removeBubble();
        });
      }

      bindBtn("#bubble-copy", async () => {
        const selection = editor.getSelection();
        const model = editor.getModel();
        try {
          if (selection && !selection.isEmpty() && model) {
            const text = model.getValueInRange(selection);
            const success = await Clipboard.copy(text);
            if (success) showToast("已复制选择内容");
          } else if (model) {
            const position = editor.getPosition();
            if (position) {
              const word = model.getWordAtPosition(position);
              if (word) {
                const success = await Clipboard.copy(word.word);
                if (success) showToast("已复制单词");
              }
            }
          }
        } catch (err) {
          console.error("Clipboard copy failed:", err);
          showToast("复制失败", true);
        }
        removeBubble();
      });

      bindBtn("#bubble-select-all", () => {
        const model = editor.getModel();
        if (model) {
          isSelectingAll = true;
          editor.setSelection(
            new monaco.Range(
              1,
              1,
              model.getLineCount(),
              model.getLineMaxColumn(model.getLineCount())
            )
          );
          editor.focus();

          setTimeout(() => {
            if (disposed) return;
            isSelectingAll = false;
          }, 300);
        }
      });

      bindBtn("#bubble-close", () => {
        const position = editor.getPosition() || { lineNumber: 1, column: 1 };
        editor.setSelection(
          new monaco.Range(
            position.lineNumber,
            position.column,
            position.lineNumber,
            position.column
          )
        );
        removeBubble();
      });
    };

    const removeBubble = () => {
      if (bubbleEl) {
        if (bubbleEl.parentNode) {
          bubbleEl.parentNode.removeChild(bubbleEl);
        }
        bubbleEl = null;
      }
    };

    addContainerListener(
      "touchstart",
      (e: Event) => {
        if (disposed) return;
        const touchEvent = e as TouchEvent;
        lastTouchTime = Date.now();
        if (touchEvent.touches.length !== 1) return;
        const touch = touchEvent.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        hasTriggeredLongPress = false;

        if (touchStartTimer) clearTimeout(touchStartTimer);
        touchStartTimer = setTimeout(() => {
          if (disposed) return;
          const target = editor.getTargetAtClientPoint(touch.clientX, touch.clientY);
          if (target && target.position) {
            const pos = target.position;
            const model = editor.getModel();
            if (model) {
              const word = model.getWordAtPosition(pos);
              if (word) {
                hasTriggeredLongPress = true;
                const range = new monaco.Range(
                  pos.lineNumber,
                  word.startColumn,
                  pos.lineNumber,
                  word.endColumn
                );
                editor.setSelection(range);
                showBubble(touch.clientX, touch.clientY);
              }
            }
          }
        }, 500);
      },
      { passive: true }
    );

    addContainerListener(
      "touchmove",
      (e: Event) => {
        if (disposed) return;
        const touchEvent = e as TouchEvent;
        if (touchEvent.touches.length !== 1) return;
        const touch = touchEvent.touches[0];
        const dx = Math.abs(touch.clientX - startX);
        const dy = Math.abs(touch.clientY - startY);

        if (dx > 10 || dy > 10) {
          if (touchStartTimer) {
            clearTimeout(touchStartTimer);
            touchStartTimer = null;
          }
        }
      },
      { passive: true }
    );

    const preventDefaultCapture = (e: Event) => {
      if (disposed) return;
      if (touchStartTimer && (e.type === "touchend" || e.type === "pointerup")) {
        clearTimeout(touchStartTimer);
        touchStartTimer = null;
      }
      if (hasTriggeredLongPress) {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "click" || e.type === "pointerup" || e.type === "touchend") {
          setTimeout(() => {
            if (disposed) return;
            hasTriggeredLongPress = false;
          }, 50);
        }
      }
    };

    addContainerListener("touchend", preventDefaultCapture, true);
    addContainerListener("pointerup", preventDefaultCapture, true);
    addContainerListener("mouseup", preventDefaultCapture, true);
    addContainerListener("click", preventDefaultCapture, true);

    addContainerListener(
      "touchcancel",
      () => {
        if (touchStartTimer) {
          clearTimeout(touchStartTimer);
          touchStartTimer = null;
        }
        hasTriggeredLongPress = false;
      },
      { passive: true }
    );

    disposables.add(
      editor.onDidChangeCursorSelection((e) => {
        if (disposed) return;
        updateHandlesPosition();
        if (e.source === "mouse" && Date.now() - lastTouchTime < 1000) {
          const selection = e.selection;
          if (selection && !selection.isEmpty()) {
            setTimeout(() => {
              if (disposed) return;
              const endPos = selection.getEndPosition();
              const endCoord = editor.getScrolledVisiblePosition(endPos);
              const containerRect = container.getBoundingClientRect();
              if (endCoord) {
                showBubble(containerRect.left + endCoord.left, containerRect.top + endCoord.top);
              }
            }, 50);
          }
        }
      }).dispose
    );

    disposables.add(
      editor.onDidScrollChange(() => {
        if (disposed) return;
        updateHandlesPosition();
        if (!isSelectingAll) {
          removeBubble();
        }
      }).dispose
    );

    const handleViewportChange = () => {
      updateHandlesPosition();
      if (bubbleEl && !isSelectingAll) {
        removeBubble();
      }
    };
    window.addEventListener("resize", handleViewportChange, { passive: true });
    disposables.add(() => window.removeEventListener("resize", handleViewportChange));

    const visualViewport = (window as any).visualViewport;
    if (visualViewport) {
      visualViewport.addEventListener("resize", handleViewportChange, { passive: true });
      visualViewport.addEventListener("scroll", handleViewportChange, { passive: true });
      disposables.add(() => {
        visualViewport.removeEventListener("resize", handleViewportChange);
        visualViewport.removeEventListener("scroll", handleViewportChange);
      });
    }

    disposables.add(
      editor.onDidBlurEditorText(() => {
        if (disposed) return;
        setTimeout(() => {
          if (disposed) return;
          if (isSelectingAll) return;
          if (document.activeElement && bubbleEl && bubbleEl.contains(document.activeElement)) {
            return;
          }
          if (
            document.activeElement &&
            ((startHandleEl && startHandleEl.contains(document.activeElement)) ||
              (endHandleEl && endHandleEl.contains(document.activeElement)))
          ) {
            return;
          }
          if (startHandleEl && startHandleEl.classList.contains("dragging")) return;
          if (endHandleEl && endHandleEl.classList.contains("dragging")) return;

          removeBubble();
          removeHandles();
        }, 200);
      }).dispose
    );

    return {
      dispose() {
        disposed = true;
        if (touchStartTimer) {
          clearTimeout(touchStartTimer);
          touchStartTimer = null;
        }
        (updateHandlesPosition as any).cancel?.();
        removeBubble();
        removeHandles();
        disposables.dispose();
      },
    };
  },
};
