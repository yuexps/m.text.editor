/**
 * monaco_touch_helper.js - 移动端触屏长按选择和浮动复制气泡插件
 */
import { showToast } from '../js/ui.js';
import { Clipboard } from '../js/utils.js';

export const MonacoMobileTouchHelper = {
    register(editor, container) {
        let touchStartTimer = null;
        let startX = 0;
        let startY = 0;
        let bubbleEl = null;
        let startHandleEl = null;
        let endHandleEl = null;
        let isSelectingAll = false;
        let isUpdatingPosition = false;
        let hasTriggeredLongPress = false;
        let lastTouchTime = 0;

        const createHandles = () => {
            if (startHandleEl) return;

            startHandleEl = document.createElement('div');
            startHandleEl.className = 'monaco-touch-handle handle-start';
            startHandleEl.innerHTML = '<div class="handle-line"></div><div class="handle-dot"></div>';

            endHandleEl = document.createElement('div');
            endHandleEl.className = 'monaco-touch-handle handle-end';
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

        const updateHandlesPosition = () => {
            if (isUpdatingPosition) return;
            isUpdatingPosition = true;

            requestAnimationFrame(() => {
                isUpdatingPosition = false;
                const selection = editor.getSelection();
                if (!selection || selection.isEmpty()) {
                    if (startHandleEl) {
                        startHandleEl.style.display = 'none';
                        endHandleEl.style.display = 'none';
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

                if (startCoord) {
                    startHandleEl.style.display = 'block';
                    const left = containerRect.left + startCoord.left;
                    const top = containerRect.top + startCoord.top;
                    const height = startCoord.height || defaultHeight;

                    startHandleEl.style.left = `${left}px`;
                    startHandleEl.style.top = `${top}px`;
                    startHandleEl.style.height = `${height}px`;
                } else {
                    startHandleEl.style.display = 'none';
                }

                if (endCoord) {
                    endHandleEl.style.display = 'block';
                    const left = containerRect.left + endCoord.left;
                    const top = containerRect.top + endCoord.top;
                    const height = endCoord.height || defaultHeight;

                    endHandleEl.style.left = `${left}px`;
                    endHandleEl.style.top = `${top}px`;
                    endHandleEl.style.height = `${height}px`;
                } else {
                    endHandleEl.style.display = 'none';
                }
            });
        };

        const bindHandleDrag = (handleEl, isStart) => {
            const dotEl = handleEl.querySelector('.handle-dot');
            let startTouchX = 0;
            let startTouchY = 0;

            dotEl.addEventListener('touchstart', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.touches.length !== 1) return;
                const touch = e.touches[0];
                startTouchX = touch.clientX;
                startTouchY = touch.clientY;
                handleEl.classList.add('dragging');
                removeBubble();
            }, { passive: false });

            dotEl.addEventListener('touchmove', (e) => {
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
                        if (currentPos.lineNumber > endPos.lineNumber ||
                            (currentPos.lineNumber === endPos.lineNumber && currentPos.column >= endPos.column)) {
                            newSelection = new monaco.Selection(endPos.lineNumber, Math.max(1, endPos.column - 1), endPos.lineNumber, endPos.column);
                        } else {
                            newSelection = new monaco.Selection(currentPos.lineNumber, currentPos.column, endPos.lineNumber, endPos.column);
                        }
                    } else {
                        const startPos = selection.getStartPosition();
                        if (currentPos.lineNumber < startPos.lineNumber ||
                            (currentPos.lineNumber === startPos.lineNumber && currentPos.column <= startPos.column)) {
                            newSelection = new monaco.Selection(startPos.lineNumber, startPos.column, startPos.lineNumber, startPos.column + 1);
                        } else {
                            newSelection = new monaco.Selection(startPos.lineNumber, startPos.column, currentPos.lineNumber, currentPos.column);
                        }
                    }
                    editor.setSelection(newSelection);
                }
            }, { passive: false });

            const endDrag = (e) => {
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

                // 尝试同步展示气泡，若失败则延迟重试以防脏帧
                if (!showSelectionBubble()) {
                    setTimeout(() => {
                        showSelectionBubble();
                        handleEl.classList.remove('dragging');
                    }, 50);
                } else {
                    handleEl.classList.remove('dragging');
                }
            };

            dotEl.addEventListener('touchend', endDrag, { passive: false });
            dotEl.addEventListener('touchcancel', endDrag, { passive: false });
        };

        const showBubble = (clientX, clientY) => {
            removeBubble();

            const isReadOnly = editor.getOption(monaco.editor.EditorOption.readOnly);

            bubbleEl = document.createElement('div');
            bubbleEl.className = 'monaco-mobile-bubble';
            bubbleEl.innerHTML = `
                <button class="bubble-btn" id="bubble-copy">复制</button>
                ${!isReadOnly ? '<button class="bubble-btn" id="bubble-cut">剪切</button>' : ''}
                <button class="bubble-btn" id="bubble-select-all">全选</button>
                <button class="bubble-btn" id="bubble-close">取消</button>
            `;

            // 阻止气泡内的点击导致编辑器失焦
            bubbleEl.addEventListener('touchstart', (e) => {
                e.preventDefault();
            }, { passive: false });
            bubbleEl.addEventListener('mousedown', (e) => {
                e.preventDefault();
            });

            document.body.appendChild(bubbleEl);

            const bubbleWidth = isReadOnly ? 170 : 220;
            const bubbleHeight = 32;
            let left = clientX - bubbleWidth / 2;
            let top = clientY - bubbleHeight - 15;

            if (left < 10) left = 10;
            if (left + bubbleWidth > window.innerWidth - 10) {
                left = window.innerWidth - bubbleWidth - 10;
            }
            if (top < 10) top = clientY + 15;
            if (top + bubbleHeight > window.innerHeight - 10) {
                top = window.innerHeight - bubbleHeight - 10;
            }

            bubbleEl.style.left = `${left}px`;
            bubbleEl.style.top = `${top}px`;

            const bindBtn = (id, handler) => {
                const btn = bubbleEl.querySelector(id);
                if (!btn) return;
                const wrapper = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handler(e);
                };
                btn.addEventListener('touchend', wrapper, { passive: false });
                btn.addEventListener('click', wrapper);
            };

            if (!isReadOnly) {
                bindBtn('#bubble-cut', async () => {
                    const selection = editor.getSelection();
                    if (selection && !selection.isEmpty()) {
                        const text = editor.getModel().getValueInRange(selection);
                        try {
                            const success = await Clipboard.copy(text);
                            if (success) {
                                editor.executeEdits('touch-helper', [{
                                    range: selection,
                                    text: '',
                                    forceMoveMarkers: true
                                }]);
                                showToast('已剪切选择内容');
                            }
                        } catch (err) {
                            console.error('Clipboard cut failed:', err);
                            showToast('剪切失败', true);
                        }
                    }
                    removeBubble();
                });
            }

            bindBtn('#bubble-copy', async () => {
                const selection = editor.getSelection();
                try {
                    if (selection && !selection.isEmpty()) {
                        const text = editor.getModel().getValueInRange(selection);
                        const success = await Clipboard.copy(text);
                        if (success) showToast('已复制选择内容');
                    } else {
                        const model = editor.getModel();
                        const position = editor.getPosition();
                        const word = model.getWordAtPosition(position);
                        if (word) {
                            const success = await Clipboard.copy(word.word);
                            if (success) showToast('已复制单词');
                        }
                    }
                } catch (err) {
                    console.error('Clipboard copy failed:', err);
                    showToast('复制失败', true);
                }
                removeBubble();
            });

            bindBtn('#bubble-select-all', () => {
                const model = editor.getModel();
                isSelectingAll = true;
                editor.setSelection(new monaco.Range(1, 1, model.getLineCount(), model.getLineMaxColumn(model.getLineCount())));
                editor.focus();

                setTimeout(() => {
                    isSelectingAll = false;
                }, 300);
            });

            bindBtn('#bubble-close', () => {
                editor.setSelection(new monaco.Range(0, 0, 0, 0));
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

        container.addEventListener('touchstart', (e) => {
            lastTouchTime = Date.now();
            if (e.touches.length !== 1) return;
            const touch = e.touches[0];
            startX = touch.clientX;
            startY = touch.clientY;
            hasTriggeredLongPress = false;

            if (touchStartTimer) clearTimeout(touchStartTimer);
            touchStartTimer = setTimeout(() => {
                const target = editor.getTargetAtClientPoint(touch.clientX, touch.clientY);
                if (target && target.position) {
                    const pos = target.position;
                    const model = editor.getModel();
                    const word = model.getWordAtPosition(pos);
                    if (word) {
                        hasTriggeredLongPress = true;
                        const range = new monaco.Range(pos.lineNumber, word.startColumn, pos.lineNumber, word.endColumn);
                        editor.setSelection(range);
                        showBubble(touch.clientX, touch.clientY);
                    }
                }
            }, 500);
        }, { passive: true });

        container.addEventListener('touchmove', (e) => {
            if (e.touches.length !== 1) return;
            const touch = e.touches[0];
            const dx = Math.abs(touch.clientX - startX);
            const dy = Math.abs(touch.clientY - startY);

            if (dx > 10 || dy > 10) {
                if (touchStartTimer) {
                    clearTimeout(touchStartTimer);
                    touchStartTimer = null;
                }
            }
        }, { passive: true });

        const preventDefaultCapture = (e) => {
            if (touchStartTimer && (e.type === 'touchend' || e.type === 'pointerup')) {
                clearTimeout(touchStartTimer);
                touchStartTimer = null;
            }
            if (hasTriggeredLongPress) {
                e.preventDefault();
                e.stopPropagation();
                if (e.type === 'click' || e.type === 'pointerup' || e.type === 'touchend') {
                    setTimeout(() => {
                        hasTriggeredLongPress = false;
                    }, 50);
                }
            }
        };

        container.addEventListener('touchend', preventDefaultCapture, true);
        container.addEventListener('pointerup', preventDefaultCapture, true);
        container.addEventListener('mouseup', preventDefaultCapture, true);
        container.addEventListener('click', preventDefaultCapture, true);

        container.addEventListener('touchcancel', () => {
            if (touchStartTimer) {
                clearTimeout(touchStartTimer);
                touchStartTimer = null;
            }
            hasTriggeredLongPress = false;
        }, { passive: true });

        editor.onDidChangeCursorSelection((e) => {
            updateHandlesPosition();
            // 触屏双击/拖拽选中时，自动弹出气泡菜单
            if (e.source === 'mouse' && (Date.now() - lastTouchTime < 1000)) {
                const selection = e.selection;
                if (selection && !selection.isEmpty()) {
                    setTimeout(() => {
                        const endPos = selection.getEndPosition();
                        const endCoord = editor.getScrolledVisiblePosition(endPos);
                        const containerRect = container.getBoundingClientRect();
                        if (endCoord) {
                            showBubble(containerRect.left + endCoord.left, containerRect.top + endCoord.top);
                        }
                    }, 50);
                }
            }
        });

        editor.onDidScrollChange(() => {
            updateHandlesPosition();
            if (!isSelectingAll) {
                removeBubble();
            }
        });

        window.addEventListener('resize', updateHandlesPosition);

        editor.onDidBlurEditorText(() => {
            setTimeout(() => {
                if (isSelectingAll) return;
                if (document.activeElement && bubbleEl && bubbleEl.contains(document.activeElement)) {
                    return;
                }
                if (document.activeElement && (
                    (startHandleEl && startHandleEl.contains(document.activeElement)) ||
                    (endHandleEl && endHandleEl.contains(document.activeElement))
                )) {
                    return;
                }
                if (startHandleEl && startHandleEl.classList.contains('dragging')) return;
                if (endHandleEl && endHandleEl.classList.contains('dragging')) return;

                removeBubble();
                removeHandles();
            }, 200);
        });
    }
};
