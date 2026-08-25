import React, { useEffect, useRef, useState, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { useAppStore, checkIsMobile, WELCOME_PATH } from "../store/useAppStore";
import { API } from "../services/api";

const GIT_COMMANDS = [
  { cmd: "git status", desc: "查看状态" },
  { cmd: "git pull", desc: "拉取同步" },
  { cmd: "git add .", desc: "暂存更改" },
  { cmd: 'git commit -m "update"', desc: "提交暂存" },
  { cmd: "git push", desc: "推送同步" },
  { cmd: "git diff", desc: "查看差异" },
  { cmd: "git log -n 5", desc: "查看日志" },
  { cmd: "git restore .", desc: "重置更改" },
];

export const BottomPanel: React.FC = () => {
  const activeTab = useAppStore((state) => state.activeBottomPanelTab);
  const setActiveTab = useAppStore((state) => state.setActiveBottomPanelTab);
  const panelHeight = useAppStore((state) => state.bottomPanelHeight);
  const setPanelHeight = useAppStore((state) => state.setBottomPanelHeight);
  const isTouchBarEnabled = useAppStore((state) => state.isTouchBarUserEnabled);
  const setTouchBarEnabled = useAppStore((state) => state.setTouchBarUserEnabled);
  const settings = useAppStore((state) => state.settings);
  const showToast = useAppStore((state) => state.showToast);
  const problems = useAppStore((state) => state.problems);
  const activeTabPath = useAppStore((state) => state.activeTabPath);
  const workspacePath = useAppStore((state) => state.workspacePath);

  const isMobile = checkIsMobile();

  // 终端相关 Ref
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<any>(null);
  const reconnectTimerRef = useRef<any>(null);
  const reconnectAttemptsRef = useRef(0);
  const hasConnectedOnceRef = useRef(false);

  // Git 菜单状态
  const [showGitMenu, setShowGitMenu] = useState(false);
  const gitMenuRef = useRef<HTMLDivElement>(null);

  // 修饰键状态
  const [modifiers, setModifiers] = useState({ ctrl: false, alt: false, shift: false });

  // 1. 拟合尺寸
  const fitTerminal = useCallback(() => {
    const term = terminalRef.current;
    const fitAddon = fitAddonRef.current;
    const container = containerRef.current;
    if (term && fitAddon && container && container.clientWidth > 0 && container.clientHeight > 0) {
      try {
        fitAddon.fit();
      } catch (e) {}
    }
  }, []);

  // 2. 清理 WebSocket 与计时器
  const cleanupConnections = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (socketRef.current) {
      try {
        const ws = socketRef.current;
        (ws as any).isClosing = true;
        ws.close();
      } catch (e) {}
      socketRef.current = null;
    }
  }, []);

  // 3. 建立 WebSocket 终端连接
  const connectTerminal = useCallback(
    (customPath?: string) => {
      const term = terminalRef.current;
      if (!term) return;

      cleanupConnections();

      if (hasConnectedOnceRef.current) {
        term.write("\r\n\x1b[90m--- 终端已重连 ---\x1b[0m\r\n");
      }

      fitTerminal();

      const cols = term.cols || 80;
      const rows = term.rows || 24;
      const targetWorkspace =
        customPath !== undefined
          ? customPath
          : activeTabPath && activeTabPath !== WELCOME_PATH
          ? activeTabPath.substring(0, Math.max(activeTabPath.lastIndexOf("/"), activeTabPath.lastIndexOf("\\"))) || workspacePath
          : workspacePath;

      const wsUrl = API.getTerminalWSUrl(cols, rows, settings.terminalUser, targetWorkspace);
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        if (socketRef.current !== ws) return;
        reconnectAttemptsRef.current = 0;
        hasConnectedOnceRef.current = true;
        setTimeout(fitTerminal, 100);

        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send("\x00ping");
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        if (socketRef.current !== ws) return;
        if (event.data === "\x00pong") return;
        term.write(event.data);
      };

      ws.onclose = () => {
        if (socketRef.current !== ws) return;
        term.write("\r\n[PodNote] 终端连接已断开。\r\n");
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }
        if (!(ws as any).isClosing) {
          if (reconnectAttemptsRef.current < 3) {
            reconnectAttemptsRef.current++;
            const delay = Math.min(2000 * reconnectAttemptsRef.current, 8000);
            reconnectTimerRef.current = setTimeout(() => {
              if (activeTab === "terminal" && terminalRef.current) {
                connectTerminal();
              }
            }, delay);
          }
        }
      };

      ws.onerror = (err: any) => {
        if (socketRef.current !== ws) return;
        term.write(`\r\n[PodNote] 连接异常: ${err.message || "网络断开"}\r\n`);
      };
    },
    [activeTab, activeTabPath, cleanupConnections, fitTerminal, settings.terminalUser, workspacePath]
  );

  // 4. 初始化 XTerm 实例与安全管道
  useEffect(() => {
    if (activeTab !== "terminal" || !containerRef.current) return;

    if (terminalRef.current) {
      if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
        connectTerminal();
      }
      setTimeout(fitTerminal, 50);
      return;
    }

    const term = new Terminal({
      cursorBlink: settings.terminalCursorBlink,
      cursorStyle: settings.terminalCursorStyle,
      theme: {
        background: "#0c0c0c",
        foreground: "#cccccc",
        cursor: "#ffffff",
      },
      fontSize: settings.terminalFontSize,
      fontFamily: "Consolas, 'Courier New', monospace",
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    // 拦截 Ctrl+V / Cmd+V / Shift+Insert 阻断 \x16 乱码，并实现智能复制
    term.attachCustomKeyEventHandler((e) => {
      const isCtrlOrMeta = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if ((isCtrlOrMeta && key === "v") || (e.shiftKey && e.key === "Insert")) {
        return false;
      }

      if (isCtrlOrMeta && key === "c") {
        if (term.hasSelection()) {
          const selection = term.getSelection();
          if (selection) {
            navigator.clipboard?.writeText(selection);
          }
          return false;
        }
        return true;
      }

      return true;
    });

    // 统一接管 paste 事件
    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const text = e.clipboardData?.getData("text/plain") || "";
      if (text && term) {
        term.paste(text);
      }
    };
    const container = containerRef.current;
    container.addEventListener("paste", handlePaste, true);

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    connectTerminal();

    const dataDisposer = term.onData((data) => {
      const socket = socketRef.current;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(data);
      }
    });

    const resizeDisposer = term.onResize((size) => {
      const socket = socketRef.current;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(`\x00resize:${size.cols},${size.rows}`);
      }
    });

    let resizeObserver: ResizeObserver | null = null;
    if (window.ResizeObserver) {
      let debounceTimer: any;
      resizeObserver = new ResizeObserver(() => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(fitTerminal, 50);
      });
      resizeObserver.observe(container);
    }

    return () => {
      dataDisposer.dispose();
      resizeDisposer.dispose();
      container.removeEventListener("paste", handlePaste, true);
      if (resizeObserver) resizeObserver.disconnect();
      cleanupConnections();
      if (term) {
        try {
          term.dispose();
        } catch (e) {}
      }
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [activeTab]);

  // 5. 点击外部收起 Git 菜单
  useEffect(() => {
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (gitMenuRef.current && !gitMenuRef.current.contains(e.target as Node)) {
        setShowGitMenu(false);
      }
    };
    document.addEventListener("pointerdown", handleOutside, true);
    return () => document.removeEventListener("pointerdown", handleOutside, true);
  }, []);

  // 6. 拖动调节高度
  const handleResizerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = panelHeight;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      let newHeight = startHeight - deltaY;

      if (newHeight < 50) {
        setActiveTab(null);
        onMouseUp();
        return;
      }
      if (newHeight < 100) newHeight = 100;
      if (newHeight > window.innerHeight * 0.8) newHeight = window.innerHeight * 0.8;

      setPanelHeight(newHeight);
      requestAnimationFrame(fitTerminal);
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.removeProperty("cursor");
      document.body.style.removeProperty("user-select");
      fitTerminal();
    };

    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  // 7. Git 命令处理：仅填入终端（不直接回车执行，对齐旧版）
  const handleGitCommand = (cmd: string) => {
    setShowGitMenu(false);
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(cmd);
      terminalRef.current?.focus();
    } else {
      showToast("终端未连接，无法发送指令", true);
    }
  };

  const handleLocateFileDir = () => {
    let targetDir = "";
    if (activeTabPath && activeTabPath !== WELCOME_PATH) {
      const lastSlash = Math.max(activeTabPath.lastIndexOf("/"), activeTabPath.lastIndexOf("\\"));
      if (lastSlash !== -1) {
        targetDir = activeTabPath.substring(0, lastSlash);
      }
    }
    if (!targetDir) targetDir = workspacePath;
    showToast(`正在重新定位终端至: ${targetDir || "/"}`);
    connectTerminal(targetDir);
  };

  const handleTouchBarBtn = (payload: string, isMod?: "ctrl" | "alt" | "shift") => {
    if (isMod) {
      setModifiers((prev) => ({ ...prev, [isMod]: !prev[isMod] }));
      terminalRef.current?.focus();
      return;
    }

    let processed = payload;
    if (modifiers.ctrl) {
      const upper = payload.toUpperCase();
      if (upper === "V") {
        navigator.clipboard?.readText().then((text) => {
          if (text && terminalRef.current) terminalRef.current.paste(text);
        });
        setModifiers({ ctrl: false, alt: false, shift: false });
        return;
      }
      const code = upper.charCodeAt(0);
      if (code >= 65 && code <= 90) {
        processed = String.fromCharCode(code - 64) + payload.slice(1);
      }
    }
    if (modifiers.alt) processed = "\x1b" + processed;
    if (modifiers.shift) processed = processed.toUpperCase();

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(processed);
      terminalRef.current?.focus();
    }
    setModifiers({ ctrl: false, alt: false, shift: false });
  };

  // 问题点击定位
  const handleProblemClick = (line?: number, column?: number) => {
    if (!line) return;
    const store = useAppStore.getState();
    const activePath = store.activeTabPath;
    if (!activePath || activePath === WELCOME_PATH) return;

    const editorWindow = (window as any).monacoEditorInstance || (window as any).editor;
    if (editorWindow) {
      editorWindow.setPosition({ lineNumber: line, column: column || 1 });
      editorWindow.revealPositionInCenter({ lineNumber: line, column: column || 1 });
      editorWindow.focus();
      const hoverAction = editorWindow.getAction("editor.action.showHover");
      if (hoverAction) hoverAction.run();
    }
  };

  if (!activeTab) return null;

  return (
    <div
      className="w-full bg-zinc-950 border-t border-zinc-800 flex flex-col shrink-0 relative z-30 select-none"
      style={{ height: `${panelHeight}px`, minHeight: 0 }}
    >
      {/* 顶部高度拉伸轨道 */}
      <div
        onMouseDown={handleResizerMouseDown}
        className="h-1 w-full bg-transparent hover:bg-[#0078d4] cursor-row-resize transition-colors duration-150 shrink-0"
        title="拖动调整面板高度"
      />

      {/* 面板 Header */}
      <div className="h-8 px-3 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between shrink-0">
        {/* 左侧 Tab 切换 */}
        <div className="flex items-center space-x-2 h-full">
          <button
            onClick={() => setActiveTab("problems")}
            className={`h-full px-3 text-xs font-semibold flex items-center space-x-1.5 transition ${
              activeTab === "problems"
                ? "text-white border-b-2 border-[#0078d4]"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <span>问题</span>
            <span className="text-[10px] px-1 bg-zinc-800 rounded-full text-zinc-400">
              {problems.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("terminal")}
            className={`h-full px-3 text-xs font-semibold flex items-center space-x-1.5 transition ${
              activeTab === "terminal"
                ? "text-white border-b-2 border-[#0078d4]"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <span>终端</span>
          </button>
        </div>

        {/* 右侧操作按钮 */}
        <div className="flex items-center space-x-1.5 relative">
          {activeTab === "terminal" && (
            <>
              {/* 移动端 TouchBar 开关 */}
              {isMobile && (
                <button
                  onClick={() => setTouchBarEnabled((prev) => !prev)}
                  title="虚拟快捷按键"
                  className={`p-1 rounded text-xs transition ${
                    isTouchBarEnabled ? "bg-[#0078d4] text-white" : "text-zinc-400 hover:bg-zinc-800"
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
                    <line x1="6" y1="8" x2="6.01" y2="8" />
                    <line x1="10" y1="8" x2="10.01" y2="8" />
                    <line x1="14" y1="8" x2="14.01" y2="8" />
                    <line x1="18" y1="8" x2="18.01" y2="8" />
                    <line x1="8" y1="16" x2="16" y2="16" />
                  </svg>
                </button>
              )}

              {/* Git 常用命令快捷菜单 */}
              <div ref={gitMenuRef} className="relative">
                <button
                  onClick={() => setShowGitMenu(!showGitMenu)}
                  title="Git 常用指令"
                  className="p-1 rounded text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="6" y1="3" x2="6" y2="15" />
                    <circle cx="18" cy="6" r="3" />
                    <circle cx="6" cy="18" r="3" />
                    <path d="M18 9a9 9 0 0 1-9 9" />
                  </svg>
                </button>

                {/* Git 下拉菜单 */}
                {showGitMenu && (
                  <div className="absolute right-0 bottom-8 w-56 bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl py-1 z-50 text-xs animate-fade-in">
                    <div className="px-3 py-1 text-[10px] font-bold text-zinc-500 border-b border-zinc-800 uppercase tracking-wider">
                      Git 快捷指令
                    </div>
                    {GIT_COMMANDS.map((g) => (
                      <button
                        key={g.cmd}
                        onClick={() => handleGitCommand(g.cmd)}
                        className="w-full px-3 py-1.5 flex items-center justify-between text-left hover:bg-[#0078d4] hover:text-white text-zinc-300 transition"
                      >
                        <span className="font-mono">{g.cmd}</span>
                        <span className="text-[10px] opacity-60">{g.desc}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 靶心定位当前文件目录 */}
              <button
                onClick={handleLocateFileDir}
                title="定位到当前文件目录"
                className="p-1 rounded text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="3" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                </svg>
              </button>

              {/* 重连终端 */}
              <button
                onClick={() => connectTerminal()}
                title="重连终端"
                className="p-1 rounded text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 11A8.1 8.1 0 0 0 4.5 9M4 5v4h4" />
                  <path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" />
                </svg>
              </button>
            </>
          )}

          {/* 关闭底部面板 */}
          <button
            onClick={() => setActiveTab(null)}
            title="关闭面板"
            className="p-1 rounded text-zinc-400 hover:bg-zinc-800 hover:text-white transition font-mono text-sm leading-none"
          >
            ×
          </button>
        </div>
      </div>

      {/* 面板内容主体 */}
      <div className="flex-1 w-full overflow-hidden relative" style={{ minHeight: 0 }}>
        {/* 问题列表 */}
        {activeTab === "problems" && (
          <div className="h-full w-full overflow-y-auto p-3 text-xs space-y-1 font-mono select-text bg-zinc-950">
            {problems.length === 0 ? (
              <div className="text-zinc-500 italic p-2">当前工作区未检测到错误或警告</div>
            ) : (
              problems.map((p, idx) => (
                <div
                  key={idx}
                  onClick={() => handleProblemClick(p.line, p.column)}
                  className={`flex items-center space-x-2 p-1.5 rounded hover:bg-zinc-900 cursor-pointer ${
                    p.severity === "error" ? "text-red-400" : "text-yellow-400"
                  }`}
                >
                  <span className="font-bold">[{p.severity.toUpperCase()}]</span>
                  {p.line && <span>[第 {p.line} 行{p.column ? `, 第 ${p.column} 列` : ""}]</span>}
                  <span className="truncate">{p.message}</span>
                </div>
              ))
            )}
          </div>
        )}

        {/* 终端主体与 TouchBar */}
        <div
          className={`h-full w-full flex flex-col bg-[#0c0c0c] ${
            activeTab === "terminal" ? "flex" : "hidden"
          }`}
          style={{ minHeight: 0 }}
        >
          <div ref={containerRef} className="flex-1 w-full p-2 overflow-hidden" style={{ minHeight: 0 }} />

          {/* 移动端 TouchBar */}
          {isMobile && isTouchBarEnabled && (
            <div className="w-full bg-zinc-900 border-t border-zinc-800 p-1 flex flex-col space-y-1 shrink-0">
              <div className="flex items-center justify-between space-x-1">
                <button onPointerDown={(e) => { e.preventDefault(); handleTouchBarBtn("\x1b"); }} className="flex-1 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300">Esc</button>
                <button onPointerDown={(e) => { e.preventDefault(); handleTouchBarBtn("", "alt"); }} className={`flex-1 py-1.5 text-xs rounded transition ${modifiers.alt ? "bg-[#0078d4] text-white" : "bg-zinc-800 text-zinc-300"}`}>Alt</button>
                <button onPointerDown={(e) => { e.preventDefault(); handleTouchBarBtn("", "shift"); }} className={`flex-1 py-1.5 text-xs rounded transition ${modifiers.shift ? "bg-[#0078d4] text-white" : "bg-zinc-800 text-zinc-300"}`}>Shift</button>
                <button onPointerDown={(e) => { e.preventDefault(); handleTouchBarBtn("\x1b[H"); }} className="flex-1 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300">Home</button>
                <button onPointerDown={(e) => { e.preventDefault(); handleTouchBarBtn("\x1b[F"); }} className="flex-1 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300">End</button>
                <button onPointerDown={(e) => { e.preventDefault(); handleTouchBarBtn("\x1b[A"); }} className="flex-1 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300">↑</button>
                <button onPointerDown={(e) => { e.preventDefault(); handleTouchBarBtn("/"); }} className="flex-1 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300">/</button>
              </div>
              <div className="flex items-center justify-between space-x-1">
                <button onPointerDown={(e) => { e.preventDefault(); handleTouchBarBtn("\t"); }} className="flex-1 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300">Tab</button>
                <button onPointerDown={(e) => { e.preventDefault(); handleTouchBarBtn("", "ctrl"); }} className={`flex-1 py-1.5 text-xs rounded transition ${modifiers.ctrl ? "bg-[#0078d4] text-white" : "bg-zinc-800 text-zinc-300"}`}>Ctrl</button>
                <button onPointerDown={(e) => { e.preventDefault(); handleTouchBarBtn("\\"); }} className="flex-1 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300">\</button>
                <button onPointerDown={(e) => { e.preventDefault(); handleTouchBarBtn("-"); }} className="flex-1 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300">-</button>
                <button onPointerDown={(e) => { e.preventDefault(); handleTouchBarBtn("\x1b[D"); }} className="flex-1 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300">←</button>
                <button onPointerDown={(e) => { e.preventDefault(); handleTouchBarBtn("\x1b[B"); }} className="flex-1 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300">↓</button>
                <button onPointerDown={(e) => { e.preventDefault(); handleTouchBarBtn("\x1b[C"); }} className="flex-1 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300">→</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
