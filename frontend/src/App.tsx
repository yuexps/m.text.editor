import React, { useEffect, useRef, useState } from "react";
import { useAppStore, checkIsMobile, checkIsNarrowScreen, showConfirm, WELCOME_PATH } from "./store/useAppStore";
import { FileIO } from "./services/fileIO";
import { FnosSDK } from "./services/fnosSDK";
import { Sidebar } from "./components/Sidebar";
import { EditorArea } from "./components/EditorArea";
import { StatusBar } from "./components/StatusBar";
import { BottomPanel } from "./components/BottomPanel";
import { Toast } from "./components/Toast";
import { TabBar } from "./components/TabBar";
import { ConfirmModal } from "./components/ConfirmModal";
import * as monaco from "monaco-editor";

const App: React.FC = () => {
  const loadSettings = useAppStore((state) => state.loadSettings);
  const activeTabPath = useAppStore((state) => state.activeTabPath);
  const tabs = useAppStore((state) => state.tabs);
  const isEditMode = useAppStore((state) => state.isEditMode);
  const setEditMode = useAppStore((state) => state.setEditMode);
  const setActiveSidebarPanel = useAppStore((state) => state.setActiveSidebarPanel);
  const updateTabEncoding = useAppStore((state) => state.updateTabEncoding);
  const isFnosAvailable = useAppStore((state) => state.isFnosAvailable);
  const showToast = useAppStore((state) => state.showToast);

  const activeTab = tabs.find((t) => t.path === activeTabPath);

  // 编辑器原生实例引用
  const editorRef = useRef<any>(null);

  // 底栏状态字段
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const [charCount, setCharCount] = useState<string | number>(0);
  const [eol, setEol] = useState("LF");
  const [language, setLanguage] = useState("plaintext");
  const [isPreviewActive, setIsPreviewActive] = useState(false);

  // 汉堡菜单下拉状态
  const [showHamburgerMenu, setShowHamburgerMenu] = useState(false);
  const hamburgerMenuRef = useRef<HTMLDivElement>(null);

  // 根布局高度 (VisualViewport 软键盘适配)
  const [layoutHeight, setLayoutHeight] = useState<string>("");

  // 苹果系统检测 (macOS / iOS)
  const isApple = /(Macintosh|Mac OS X|iPhone|iPad|iPod)/i.test(navigator.userAgent);
  const cmdKey = isApple ? "⌘" : "Ctrl+";

  // 1. 初始化 FNOS SDK、云端配置与 URL 外部参数
  useEffect(() => {
    const initApp = async () => {
      FnosSDK.init();
      await loadSettings();

      const params = new URLSearchParams(window.location.search);
      const urlPath = params.get("path") || "";
      const urlEncoding = params.get("encoding") || "utf-8";

      if (urlPath) {
        const lastSlash = Math.max(urlPath.lastIndexOf("/"), urlPath.lastIndexOf("\\"));
        if (lastSlash !== -1) {
          const dir = urlPath.substring(0, lastSlash);
          await FileIO.loadWorkspace(dir);
        }
        await FileIO.loadFile(urlPath, urlEncoding !== "utf-8");
      } else {
        const store = useAppStore.getState();
        const defaultPath = store.settings.defaultOpenPath;
        if (defaultPath) {
          await FileIO.loadWorkspace(defaultPath);
        }
        store.openTab({
          path: WELCOME_PATH,
          name: "主页",
          content: "",
          originalContent: "",
          encoding: "utf-8",
          originalEncoding: "utf-8",
          mtime: 0,
          isNew: false,
          languageId: "plaintext",
        });
      }
    };

    initApp();
  }, [loadSettings]);

  // 2. 移动端 VisualViewport 全局软键盘自适应
  useEffect(() => {
    if (!window.visualViewport || !checkIsMobile()) return;

    let lastHeight = "";
    const handleViewportChange = () => {
      const viewport = window.visualViewport;
      if (!viewport) return;

      const scale = viewport.scale || 1;
      const isZoomed = Math.abs(scale - 1) > 0.05;
      const keyboardHeight = !isZoomed ? window.innerHeight - viewport.height : 0;
      const isKeyboardOpen = keyboardHeight > 50;

      if (isKeyboardOpen) {
        window.scrollTo(0, 0);
      }

      const newHeight = isKeyboardOpen ? `${viewport.height}px` : "";
      if (newHeight !== lastHeight) {
        lastHeight = newHeight;
        setLayoutHeight(newHeight);
      }
    };

    window.visualViewport.addEventListener("resize", handleViewportChange, { passive: true });
    window.visualViewport.addEventListener("scroll", handleViewportChange, { passive: true });

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", handleViewportChange);
        window.visualViewport.removeEventListener("scroll", handleViewportChange);
      }
    };
  }, []);

  // 3. 点击外部收起汉堡菜单
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (hamburgerMenuRef.current && !hamburgerMenuRef.current.contains(e.target as Node)) {
        setShowHamburgerMenu(false);
      }
    };
    document.addEventListener("pointerdown", handleOutsideClick, true);
    return () => document.removeEventListener("pointerdown", handleOutsideClick, true);
  }, []);

  // 4. 全局快捷键监听 (Ctrl+F / Ctrl+H 打开侧栏查找与替换)
  useEffect(() => {
    const handleSearchShortcut = (e: KeyboardEvent) => {
      if (checkIsNarrowScreen()) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setActiveSidebarPanel("search");
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "h") {
        e.preventDefault();
        setActiveSidebarPanel("search");
      }
    };
    window.addEventListener("keydown", handleSearchShortcut);
    return () => window.removeEventListener("keydown", handleSearchShortcut);
  }, [setActiveSidebarPanel]);

  // 5. 活动 Tab 标题动态同步至 FNOS 窗口
  useEffect(() => {
    if (activeTab && activeTabPath !== WELCOME_PATH) {
      FnosSDK.setTitle(`${activeTab.name} - PodNote`);
    } else {
      FnosSDK.setTitle("PodNote");
    }
  }, [activeTab, activeTabPath]);

  const isDirty = activeTab
    ? activeTab.content !== activeTab.originalContent ||
      activeTab.encoding !== activeTab.originalEncoding
    : false;

  const isMarkdown =
    activeTab?.path.toLowerCase().endsWith(".md") ||
    activeTab?.languageId === "markdown";

  const hasValidFile = Boolean(activeTabPath && activeTabPath !== WELCOME_PATH && !activeTab?.previewType);

  useEffect(() => {
    if (!isMarkdown) {
      setIsPreviewActive(false);
    }
  }, [activeTabPath, isMarkdown]);

  const handleSaveClick = async () => {
    const editor = editorRef.current;
    if (editor && !activeTab?.previewType) {
      try {
        await FileIO.saveFile(editor.getValue());
      } catch (e) {}
    }
  };

  const handleCancelClick = async () => {
    if (!activeTabPath || !activeTab) return;

    if (isDirty) {
      const confirmCancel = await showConfirm(`确定要放弃对 "${activeTab.name}" 的未保存修改吗？`, "放弃修改");
      if (!confirmCancel) return;

      useAppStore.setState((state) => ({
        tabs: state.tabs.map((t) =>
          t.path === activeTabPath
            ? { ...t, content: t.originalContent, encoding: t.originalEncoding }
            : t
        ),
      }));

      const editor = editorRef.current;
      if (editor) {
        const model = editor.getModel();
        if (model) {
          model.setValue(activeTab.originalContent);
        }
      }
    }

    setEditMode(false);
  };

  const handleSelectLanguage = (newLang: string) => {
    const editor = editorRef.current;
    if (editor) {
      const model = editor.getModel();
      if (model) {
        monaco.editor.setModelLanguage(model, newLang);
        setLanguage(newLang);
        useAppStore.setState((state) => ({
          tabs: state.tabs.map((t) =>
            t.path === activeTabPath ? { ...t, languageId: newLang } : t
          ),
        }));
      }
    }
  };

  const handleSelectEOL = (newEol: string) => {
    const editor = editorRef.current;
    if (editor) {
      const model = editor.getModel();
      if (model) {
        model.setEOL(newEol === "\n" ? monaco.editor.EndOfLineSequence.LF : monaco.editor.EndOfLineSequence.CRLF);
        setEol(newEol === "\n" ? "LF" : "CRLF");
        const val = editor.getValue();
        if (activeTabPath) {
          useAppStore.getState().updateTabContent(activeTabPath, val);
        }
      }
    }
  };

  const handleSelectEncoding = async (newEncoding: string) => {
    if (!activeTabPath) return;
    if (isEditMode) {
      updateTabEncoding(activeTabPath, newEncoding);
      showToast(`已切换目标编码为 ${newEncoding.toUpperCase()}`);
    } else {
      updateTabEncoding(activeTabPath, newEncoding);
      await FileIO.loadFile(activeTabPath, true);
    }
  };

  // 汉堡菜单 10 项动作
  const menuActions = {
    openFile: async () => {
      setShowHamburgerMenu(false);
      if (isFnosAvailable) {
        const path = await FnosSDK.pickUserFile();
        if (path) FileIO.loadFile(path);
      } else {
        setActiveSidebarPanel("explorer");
        showToast("请在主页或侧边栏输入路径打开文件");
      }
    },
    openFolder: async () => {
      setShowHamburgerMenu(false);
      if (isFnosAvailable) {
        const path = await FnosSDK.pickUserFolder();
        if (path) FileIO.loadWorkspace(path);
      } else {
        setActiveSidebarPanel("explorer");
        showToast("请在主页或侧边栏输入路径打开文件夹");
      }
    },
    undo: () => {
      setShowHamburgerMenu(false);
      const editor = editorRef.current;
      if (editor) {
        editor.focus();
        editor.trigger("keyboard", "undo");
      }
    },
    redo: () => {
      setShowHamburgerMenu(false);
      const editor = editorRef.current;
      if (editor) {
        editor.focus();
        editor.trigger("keyboard", "redo");
      }
    },
    copy: async () => {
      setShowHamburgerMenu(false);
      const editor = editorRef.current;
      if (!editor) return;
      editor.focus();
      const model = editor.getModel();
      const selection = editor.getSelection();
      if (!model || !selection || selection.isEmpty()) {
        showToast("未选中任何文本", true);
        return;
      }
      const text = model.getValueInRange(selection);
      try {
        await navigator.clipboard.writeText(text);
        showToast("已复制到剪贴板");
      } catch (e) {
        showToast("复制失败", true);
      }
    },
    paste: async () => {
      setShowHamburgerMenu(false);
      const editor = editorRef.current;
      if (!editor || !isEditMode) return;
      editor.focus();
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          editor.executeEdits("paste-action", [
            {
              range: editor.getSelection(),
              text,
              forceMoveMarkers: true,
            },
          ]);
          showToast("已粘贴");
        }
      } catch (e) {
        showToast("浏览器安全限制，请使用键盘 Ctrl+V 直接粘贴", true);
      }
    },
    find: () => {
      setShowHamburgerMenu(false);
      const editor = editorRef.current;
      if (editor) {
        editor.focus();
        const action = editor.getAction("actions.find");
        if (action) action.run();
      }
    },
    replace: () => {
      setShowHamburgerMenu(false);
      const editor = editorRef.current;
      if (editor && isEditMode) {
        editor.focus();
        const action = editor.getAction("editor.action.startFindReplaceAction");
        if (action) action.run();
      }
    },
    settings: () => {
      setShowHamburgerMenu(false);
      setActiveSidebarPanel("settings");
    },
  };

  return (
    <div
      className="w-screen flex flex-col overflow-hidden bg-zinc-950 text-zinc-300 font-sans select-none"
      style={{ height: layoutHeight || "100vh" }}
    >
      {/* 1. 顶栏 (Header) */}
      <header className="h-8.75 w-full bg-zinc-950 border-b border-zinc-900 flex items-center justify-between px-0 shrink-0 select-none relative z-50">
        <div className="flex-1 h-full flex items-center min-w-0">
          {/* 汉堡菜单按钮 */}
          <div ref={hamburgerMenuRef} className="relative h-full">
            <button
              onClick={() => setShowHamburgerMenu(!showHamburgerMenu)}
              title="菜单"
              className="w-12 h-full flex items-center justify-center border-r border-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition duration-150"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16">
                <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 6h16" />
                  <path d="M4 12h16" />
                  <path d="M4 18h16" />
                </g>
              </svg>
            </button>

            {/* 汉堡菜单下拉面板 */}
            {showHamburgerMenu && (
              <div className="absolute left-0 top-8.75 w-52 bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl py-1 z-50 text-xs animate-fade-in">
                <button
                  onClick={menuActions.openFile}
                  className="w-full px-3 py-1.5 text-left hover:bg-[#0078d4] hover:text-white text-zinc-300 transition flex items-center justify-between"
                >
                  <span>打开文件...</span>
                </button>
                <button
                  onClick={menuActions.openFolder}
                  className="w-full px-3 py-1.5 text-left hover:bg-[#0078d4] hover:text-white text-zinc-300 transition flex items-center justify-between"
                >
                  <span>打开目录...</span>
                </button>
                
                <div className="my-1 border-t border-zinc-800" />

                <button
                  onClick={menuActions.undo}
                  disabled={!hasValidFile}
                  className="w-full px-3 py-1.5 text-left hover:bg-[#0078d4] hover:text-white text-zinc-300 disabled:opacity-30 disabled:hover:bg-transparent transition flex items-center justify-between"
                >
                  <span>撤销</span>
                  <span className="text-[10px] opacity-60 font-mono">{cmdKey}Z</span>
                </button>
                <button
                  onClick={menuActions.redo}
                  disabled={!hasValidFile}
                  className="w-full px-3 py-1.5 text-left hover:bg-[#0078d4] hover:text-white text-zinc-300 disabled:opacity-30 disabled:hover:bg-transparent transition flex items-center justify-between"
                >
                  <span>恢复</span>
                  <span className="text-[10px] opacity-60 font-mono">{cmdKey}Y</span>
                </button>

                <div className="my-1 border-t border-zinc-800" />

                <button
                  onClick={menuActions.copy}
                  disabled={!hasValidFile}
                  className="w-full px-3 py-1.5 text-left hover:bg-[#0078d4] hover:text-white text-zinc-300 disabled:opacity-30 disabled:hover:bg-transparent transition flex items-center justify-between"
                >
                  <span>复制</span>
                  <span className="text-[10px] opacity-60 font-mono">{cmdKey}C</span>
                </button>
                <button
                  onClick={menuActions.paste}
                  disabled={!hasValidFile || !isEditMode}
                  className="w-full px-3 py-1.5 text-left hover:bg-[#0078d4] hover:text-white text-zinc-300 disabled:opacity-30 disabled:hover:bg-transparent transition flex items-center justify-between"
                >
                  <span>粘贴</span>
                  <span className="text-[10px] opacity-60 font-mono">{cmdKey}V</span>
                </button>

                <div className="my-1 border-t border-zinc-800" />

                <button
                  onClick={menuActions.find}
                  disabled={!hasValidFile}
                  className="w-full px-3 py-1.5 text-left hover:bg-[#0078d4] hover:text-white text-zinc-300 disabled:opacity-30 disabled:hover:bg-transparent transition flex items-center justify-between"
                >
                  <span>查找</span>
                  <span className="text-[10px] opacity-60 font-mono">{cmdKey}F</span>
                </button>
                <button
                  onClick={menuActions.replace}
                  disabled={!hasValidFile || !isEditMode}
                  className="w-full px-3 py-1.5 text-left hover:bg-[#0078d4] hover:text-white text-zinc-300 disabled:opacity-30 disabled:hover:bg-transparent transition flex items-center justify-between"
                >
                  <span>替换</span>
                  <span className="text-[10px] opacity-60 font-mono">{cmdKey}H</span>
                </button>

                <div className="my-1 border-t border-zinc-800" />

                <button
                  onClick={menuActions.settings}
                  className="w-full px-3 py-1.5 text-left hover:bg-[#0078d4] hover:text-white text-zinc-300 transition flex items-center justify-between"
                >
                  <span>偏好设置</span>
                </button>
              </div>
            )}
          </div>
          
          {/* Tab 栏 */}
          <div className="flex-1 h-full min-w-0">
            <TabBar editorRef={editorRef} />
          </div>
        </div>

        {/* 右侧控制按钮 */}
        <div className="flex items-center space-x-2 px-3 shrink-0 h-full border-l border-zinc-900">
          {activeTab && activeTabPath !== WELCOME_PATH && !activeTab.previewType && (
            <>
              {/* Markdown 预览切换 */}
              {isMarkdown && (
                <button
                  onClick={() => setIsPreviewActive(!isPreviewActive)}
                  title={isPreviewActive ? "关闭预览" : "实时预览"}
                  className={`flex items-center space-x-1 px-3 py-1 text-xs font-medium rounded transition duration-150 ${
                    isPreviewActive
                      ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-500"
                      : "bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white"
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="12" height="12">
                    <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="5" width="18" height="14" rx="2" />
                      <path d="M7 15V9l2 2l2-2v6" />
                      <path d="M14 13l2 2l2-2m-2 2V9" />
                    </g>
                  </svg>
                  <span>预览</span>
                </button>
              )}

              {!isEditMode || activeTab.isHugeFile || activeTab.isTruncated ? (
                <button
                  onClick={() => {
                    if (activeTab.isHugeFile || activeTab.isTruncated) {
                      showToast(activeTab.isTruncated ? "大文件已截断加载，仅支持只读预览。" : "大文件为保证性能，仅支持只读预览。", true, 6000);
                      return;
                    }
                    setEditMode(true);
                  }}
                  disabled={!!activeTab.isHugeFile || !!activeTab.isTruncated}
                  title={activeTab.isHugeFile || activeTab.isTruncated ? "大文件只读保护" : "切换为编辑模式"}
                  className={`flex items-center px-3 py-1.5 text-xs font-medium rounded transition duration-150 ${
                    activeTab.isHugeFile || activeTab.isTruncated
                      ? "bg-zinc-800 text-zinc-600 cursor-not-allowed opacity-40"
                      : "bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white"
                  }`}
                >
                  <span>编辑</span>
                </button>
              ) : (
                <>
                  <button
                    onClick={handleCancelClick}
                    title="取消编辑并放弃修改"
                    className="flex items-center px-3 py-1.5 text-xs font-medium rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition duration-150"
                  >
                    <span>取消</span>
                  </button>

                  <button
                    onClick={handleSaveClick}
                    disabled={!isDirty}
                    title="保存 (Ctrl+S)"
                    className={`flex items-center px-3.5 py-1.5 text-xs font-semibold rounded shadow transition duration-150 ${
                      isDirty
                        ? "bg-[#0078d4] hover:bg-[#1e85d9] text-white cursor-pointer"
                        : "bg-zinc-800 text-zinc-600 cursor-not-allowed opacity-50"
                    }`}
                  >
                    <span>保存</span>
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </header>

      {/* 2. 主工作台 (Workbench) */}
      <main className="flex-1 w-full flex overflow-hidden min-h-0 relative">
        {/* 侧边栏 */}
        <Sidebar editorRef={editorRef} />

        {/* 编辑主区与底部通用面板 */}
        <div className="flex-1 h-full flex flex-col overflow-hidden min-w-0" style={{ minHeight: 0 }}>
          <EditorArea
            editorRef={editorRef}
            setCursorPosition={setCursorPosition}
            setCharCount={setCharCount}
            setEol={setEol}
            setLanguage={setLanguage}
            isPreviewActive={isPreviewActive}
          />

          {/* 底部通用控制面板（问题/终端） */}
          <BottomPanel />
        </div>
      </main>

      {/* 3. 底部状态栏 */}
      <StatusBar
        cursorPosition={cursorPosition}
        charCount={charCount}
        eol={eol}
        language={language}
        onSelectLanguage={handleSelectLanguage}
        onSelectEOL={handleSelectEOL}
        onSelectEncoding={handleSelectEncoding}
      />

      {/* 4. 全局 Toast 气泡提醒 */}
      <Toast />

      {/* 5. 全局 Confirm/Prompt 模态弹窗 */}
      <ConfirmModal />
    </div>
  );
};

export default App;
