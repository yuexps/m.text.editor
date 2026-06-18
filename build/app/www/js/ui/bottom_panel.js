/**
 * bottom_panel.js - 底部多页签面板控制器
 */
import { els } from './elements.js';
import { eventBus } from '../event_bus.js';
import { checkIsNarrowScreen } from '../utils.js';

let activeTab = 'problems';
let isPanelVisible = false;

// 拖拽相关状态
let startY = 0;
let startHeight = 0;
let animationFrameId = null;

export const BottomPanelManager = {
    /**
     * 初始化事件监听与拖动条
     */
    init() {
        if (!els.bottomPanel) return;

        // 订阅折叠隐藏命令
        eventBus.on('bottom-panel:collapse-request', () => {
            this.hidePanel();
        });

        // 绑定 Tab 点击切换
        const tabProblems = document.getElementById('panel-tab-problems');
        const tabTerminal = document.getElementById('panel-tab-terminal');

        if (tabProblems) {
            tabProblems.onclick = () => this.switchTab('problems');
        }
        if (tabTerminal) {
            tabTerminal.onclick = () => this.switchTab('terminal');
        }

        // 绑定重启终端
        const restartBtn = document.getElementById('panel-terminal-restart-btn');
        if (restartBtn) {
            restartBtn.onclick = () => {
                eventBus.emit('terminal:restart-request');
            };
        }

        // 绑定关闭面板
        if (els.closePanelBtn) {
            els.closePanelBtn.onclick = () => this.hidePanel();
        }

        // 绑定底栏问题指示器
        const problemsIndicator = document.getElementById('status-problems');
        if (problemsIndicator) {
            problemsIndicator.onclick = (e) => {
                e.stopPropagation();
                if (isPanelVisible && activeTab === 'problems') {
                    this.hidePanel();
                } else {
                    this.showPanel('problems');
                }
            };
        }

        // 绑定高度拖拽 Resizer
        const resizer = document.getElementById('panel-resizer');
        if (resizer) {
            const onMouseMove = (e) => {
                const deltaY = e.clientY - startY;
                let newHeight = startHeight - deltaY;

                // 限制高度范围与折叠
                if (newHeight < 50) {
                    newHeight = 0;
                    this.hidePanel();
                    onMouseUp();
                    return;
                } else if (newHeight < 100) {
                    newHeight = 100;
                } else if (newHeight > window.innerHeight * 0.8) {
                    newHeight = window.innerHeight * 0.8;
                }

                if (newHeight > 0) {
                    els.bottomPanel.style.height = `${newHeight}px`;
                }

                // 节流触发重绘
                if (!animationFrameId) {
                    animationFrameId = requestAnimationFrame(() => {
                        eventBus.emit('editor:layout-request');
                        eventBus.emit('terminal:resize-request');
                        animationFrameId = null;
                    });
                }
            };

            const onMouseUp = () => {
                if (animationFrameId) {
                    cancelAnimationFrame(animationFrameId);
                    animationFrameId = null;
                }
                eventBus.emit('editor:layout-request');
                eventBus.emit('terminal:resize-request');

                resizer.classList.remove('active');
                document.body.style.removeProperty('user-select');
                document.body.style.removeProperty('cursor');
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };

            const onMouseDown = (e) => {
                startY = e.clientY;
                startHeight = parseInt(document.defaultView.getComputedStyle(els.bottomPanel).height, 10) || 400;
                resizer.classList.add('active');
                document.body.style.userSelect = 'none';
                document.body.style.cursor = 'row-resize';
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            };

            resizer.addEventListener('mousedown', onMouseDown);
        }
    },

    isVisible() {
        return isPanelVisible;
    },

    getActiveTab() {
        return activeTab;
    },

    /**
     * 打开底部面板并定位到指定 Tab
     */
    showPanel(tabName) {
        if (!els.bottomPanel) return;
        isPanelVisible = true;
        els.bottomPanel.style.display = 'flex';
        this.switchTab(tabName);
        if (checkIsNarrowScreen()) {
            eventBus.emit('sidebar:collapse-request');
        }
        eventBus.emit('editor:layout-request');
    },

    /**
     * 关闭底部面板
     */
    hidePanel() {
        if (!els.bottomPanel) return;
        isPanelVisible = false;
        els.bottomPanel.style.display = 'none';
        if (els.activityTerminalBtn) els.activityTerminalBtn.classList.remove('active');
        eventBus.emit('bottom-panel:active-tab-changed', '');
        eventBus.emit('editor:layout-request');
    },

    /**
     * 切换底部面板折叠状态
     */
    togglePanel(tabName) {
        if (isPanelVisible && activeTab === tabName) {
            this.hidePanel();
        } else {
            this.showPanel(tabName);
        }
    },

    /**
     * 面板内部 Tab 切换
     */
    switchTab(tabName) {
        activeTab = tabName;
        const tabProblems = document.getElementById('panel-tab-problems');
        const tabTerminal = document.getElementById('panel-tab-terminal');
        const problemsList = document.getElementById('problems-list');
        const terminalContainer = document.getElementById('terminal-panel-container');
        const restartBtn = document.getElementById('panel-terminal-restart-btn');

        if (tabProblems) tabProblems.classList.toggle('active', tabName === 'problems');
        if (tabTerminal) tabTerminal.classList.toggle('active', tabName === 'terminal');

        if (problemsList) problemsList.style.display = tabName === 'problems' ? 'block' : 'none';
        if (terminalContainer) terminalContainer.style.display = tabName === 'terminal' ? 'block' : 'none';
        if (restartBtn) restartBtn.style.display = tabName === 'terminal' ? 'flex' : 'none';

        if (els.activityTerminalBtn) {
            els.activityTerminalBtn.classList.toggle('active', tabName === 'terminal');
        }


        eventBus.emit('bottom-panel:active-tab-changed', tabName);

        if (tabName === 'problems') {
            eventBus.emit('problems:render-request');
        }
    },

    /**
     * 绘制问题项列表 (由 ide_core 触发)
     */
    renderProblemsList(markers, editor) {
        const listEl = document.getElementById('problems-list');
        if (!listEl) return;

        if (!markers || markers.length === 0) {
            listEl.innerHTML = '<div style="padding:20px; opacity:0.5; font-size:13px; text-align:center;">未检测到任何问题</div>';
            return;
        }

        listEl.innerHTML = '';
        const sorted = [...markers].sort((a, b) => a.severity - b.severity);

        sorted.forEach(m => {
            const row = document.createElement('div');
            const isError = m.severity === monaco.MarkerSeverity.Error;
            row.className = `problem-row ${isError ? 'error' : 'warning'}`;

            const icon = isError
                ? '<svg viewBox="0 0 16 16" width="14" height="14"><path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 1a6 6 0 1 1 0 12A6 6 0 0 1 8 2zM10.35 5.65L11.06 6.36 8.71 8.71 11.06 11.06 10.35 11.77 8 9.41 5.65 11.77 4.94 11.06 7.29 8.71 4.94 6.36 5.65 5.65 8 8 10.35 5.65z"/></svg>'
                : '<svg viewBox="0 0 16 16" width="14" height="14"><path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M7.56 1.18a1 1 0 0 1 1.74 0L15.3 12.31a1 1 0 0 1-.87 1.49H2.43a1 1 0 0 1-.87-1.49L7.56 1.18zM2.43 12.8h12L8.43 2.18l-6 10.62zM8 11.2a.8.8 0 1 0 0-1.6.8.8 0 0 0 0 1.6zM7.2 9.6h1.6V5.6H7.2v4z"/></svg>';

            row.innerHTML = `
                ${icon}
                <span class="prob-msg" title="${m.message}">${m.message}</span>
                <span class="prob-loc">[${m.startLineNumber}, ${m.startColumn}]</span>
            `;

            row.onclick = () => {
                if (editor) {
                    editor.setPosition({ lineNumber: m.startLineNumber, column: m.startColumn });
                    editor.revealPositionInCenter({ lineNumber: m.startLineNumber, column: m.startColumn });
                    editor.focus();
                    setTimeout(() => editor.trigger('source', 'editor.action.showHover'), 50);
                }
            };
            listEl.appendChild(row);
        });
    }
};
