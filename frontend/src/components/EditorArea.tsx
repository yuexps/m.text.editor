import React, { useState, useEffect, useRef, useCallback } from "react";
import Editor, { type OnMount, type OnChange } from "@monaco-editor/react";
import * as monaco from "monaco-editor";

import { useAppStore, WELCOME_PATH } from "../store/useAppStore";
import { FileIO } from "../services/fileIO";
import { FnosSDK } from "../services/fnosSDK";

import { MarkdownPreview } from "./MarkdownPreview";
import { MediaPreview } from "./MediaPreview";
import { MonacoMobileTouchHelper } from "./plugins/monacoTouchHelper";
import { MonacoReadOnlyMobileKeyboardBlocker } from "./plugins/monacoKeyboardBlocker";
import { useFileWatch } from "./hooks/useFileWatch";

interface EditorAreaProps {
  editorRef: React.MutableRefObject<any>;
  setCursorPosition: (pos: { line: number; column: number }) => void;
  setCharCount: (count: string | number) => void;
  setEol: (eol: string) => void;
  setLanguage: (lang: string) => void;
  isPreviewActive: boolean;
}

export const EditorArea: React.FC<EditorAreaProps> = ({
  editorRef,
  setCursorPosition,
  setCharCount,
  setEol,
  setLanguage,
  isPreviewActive,
}) => {
  const tabs = useAppStore((state) => state.tabs);
  const activeTabPath = useAppStore((state) => state.activeTabPath);
  const isEditMode = useAppStore((state) => state.isEditMode);
  const settings = useAppStore((state) => state.settings);
  const showToast = useAppStore((state) => state.showToast);
  const updateTabContent = useAppStore((state) => state.updateTabContent);
  const isFnosAvailable = useAppStore((state) => state.isFnosAvailable);

  const activeTab = tabs.find((t) => t.path === activeTabPath);

  // 内部 UI 状态
  const [manualPath, setManualPath] = useState("");
  const [isExtensionInstalled, setIsExtensionInstalled] = useState(true);

  // 检测浏览器扩展安装状态
  useEffect(() => {
    const checkExtension = () => {
      const isInstalled =
        (window as any).__PODNOTE_EXTENSION_INSTALLED__ ||
        (window.parent && (window.parent as any).__PODNOTE_EXTENSION_INSTALLED__);
      const isEdgeOrChrome = /Edg\/|Chrome\//.test(navigator.userAgent);
      setIsExtensionInstalled(Boolean(isInstalled) || !isEdgeOrChrome);
    };

    checkExtension();
    const timer = setTimeout(checkExtension, 1000);
    return () => clearTimeout(timer);
  }, []);

  // Markdown 单向物理滚动锁
  const previewScrollRef = useRef<HTMLDivElement | null>(null);
  const currentScrollOwnerRef = useRef<"editor" | "preview">("editor");
  const isSyncingScrollRef = useRef(false);

  // 忽略外部变更触发的 onChange
  const isIgnoringChangeRef = useRef(false);

  // 移动端辅助插件 ref
  const touchHelperRef = useRef<any>(null);
  const keyboardBlockerRef = useRef<any>(null);

  const editorDisposablesRef = useRef<any[]>([]);

  // 启用实时变化监控与 Tail
  useFileWatch(editorRef, isIgnoringChangeRef);

  const updateEditorModel = useCallback(
    (editorInstance: any) => {
      if (!editorInstance) return;
      const store = useAppStore.getState();
      const currentActiveTab = store.tabs.find((t) => t.path === store.activeTabPath);
      if (!currentActiveTab || currentActiveTab.previewType || currentActiveTab.path === WELCOME_PATH) return;

      let model = monaco.editor.getModel(monaco.Uri.file(currentActiveTab.path));
      if (!model) {
        model = monaco.editor.createModel(
          currentActiveTab.content,
          currentActiveTab.isHugeFile || currentActiveTab.isTruncated ? "plaintext" : currentActiveTab.languageId,
          monaco.Uri.file(currentActiveTab.path)
        );
      }
      
      editorInstance.setModel(model);

      if (currentActiveTab.viewState) {
        editorInstance.restoreViewState(currentActiveTab.viewState);
      }

      setLanguage(currentActiveTab.isHugeFile || currentActiveTab.isTruncated ? "plaintext" : currentActiveTab.languageId);
      setEol(model.getEOL() === "\n" ? "LF" : "CRLF");
      setCharCount(model.getValueLength());

      // 大文件性能降级
      if (currentActiveTab.isHugeFile || currentActiveTab.isTruncated) {
        editorInstance.updateOptions({
          readOnly: true,
          domReadOnly: true,
          minimap: { enabled: false },
          folding: false,
          wordWrap: "off",
        });
      }

      editorInstance.focus();
    },
    [setCharCount, setEol, setLanguage]
  );

  useEffect(() => {
    updateEditorModel(editorRef.current);
  }, [activeTabPath, updateEditorModel]);

  useEffect(() => {
    return () => {
      touchHelperRef.current?.dispose();
      keyboardBlockerRef.current?.dispose();
      editorDisposablesRef.current.forEach((d) => d.dispose());
      editorDisposablesRef.current = [];
    };
  }, []);

  const handleEditorMount: OnMount = (editor) => {
    editorRef.current = editor;

    // 单向物理滚动锁：编辑器拥有滚动权
    const setEditorOwner = () => {
      currentScrollOwnerRef.current = "editor";
    };

    // 快捷键 Ctrl+S 保存
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
      () => {
        FileIO.saveFile(editor.getValue()).catch(() => {});
      }
    );

    // 移动端插件挂载
    const domNode = editor.getDomNode();
    if (domNode) {
      touchHelperRef.current = MonacoMobileTouchHelper.register(editor, domNode);
      keyboardBlockerRef.current = MonacoReadOnlyMobileKeyboardBlocker.register(editor);
      domNode.addEventListener("mouseenter", setEditorOwner);
      domNode.addEventListener("wheel", setEditorOwner, { passive: true });
    }

    const cursorDisposer = editor.onDidChangeCursorPosition((e) => {
      setCursorPosition({ line: e.position.lineNumber, column: e.position.column });
      const selection = editor.getSelection();
      const model = editor.getModel();
      if (selection && model && !selection.isEmpty()) {
        const selectedText = model.getValueInRange(selection);
        setCharCount(`${selectedText.length} / ${model.getValueLength()}`);
      } else if (model) {
        setCharCount(model.getValueLength());
      }
    });
    editorDisposablesRef.current.push(cursorDisposer);

    // 语法错误与警告同步
    const markerDisposer = monaco.editor.onDidChangeMarkers(() => {
      const model = editor.getModel();
      if (!model) return;
      const markers = monaco.editor.getModelMarkers({ resource: model.uri });
      const problems = markers.map((m) => ({
        severity: m.severity === monaco.MarkerSeverity.Error ? ("error" as const) : ("warning" as const),
        message: m.message,
        line: m.startLineNumber,
        column: m.startColumn,
      }));
      useAppStore.getState().setProblems(problems);
    });
    editorDisposablesRef.current.push(markerDisposer);

    const scrollDisposer = editor.onDidScrollChange((e) => {
      if (!isPreviewActive || currentScrollOwnerRef.current === "preview") return;
      if (isSyncingScrollRef.current) return;

      if (e.scrollTopChanged && previewScrollRef.current) {
        isSyncingScrollRef.current = true;
        const scrollTop = editor.getScrollTop();
        const scrollHeight = editor.getScrollHeight() - editor.getLayoutInfo().height;
        if (scrollHeight > 0) {
          const ratio = scrollTop / scrollHeight;
          const previewEl = previewScrollRef.current;
          previewEl.scrollTop = (previewEl.scrollHeight - previewEl.clientHeight) * ratio;
        }
        requestAnimationFrame(() => {
          isSyncingScrollRef.current = false;
        });
      }
    });
    editorDisposablesRef.current.push(scrollDisposer);

    editorDisposablesRef.current.push(editor.onDidFocusEditorWidget(setEditorOwner));
    updateEditorModel(editor);
  };

  // 预览区反向同步编辑器滚动
  const handlePreviewScroll = () => {
    if (!isPreviewActive || currentScrollOwnerRef.current === "editor") return;
    if (isSyncingScrollRef.current) return;

    const previewEl = previewScrollRef.current;
    const editor = editorRef.current;
    if (previewEl && editor) {
      isSyncingScrollRef.current = true;
      const scrollTop = previewEl.scrollTop;
      const scrollHeight = previewEl.scrollHeight - previewEl.clientHeight;
      if (scrollHeight > 0) {
        const ratio = scrollTop / scrollHeight;
        editor.setScrollTop((editor.getScrollHeight() - editor.getLayoutInfo().height) * ratio);
      }
      requestAnimationFrame(() => {
        isSyncingScrollRef.current = false;
      });
    }
  };

  const handleEditorChange: OnChange = (value) => {
    if (isIgnoringChangeRef.current) return;
    if (!activeTabPath || value === undefined) return;

    updateTabContent(activeTabPath, value);

    const activeTab = useAppStore.getState().tabs.find((t) => t.path === activeTabPath);
    if (activeTab) {
      const isDirty = value !== activeTab.originalContent || activeTab.encoding !== activeTab.originalEncoding;
      FnosSDK.syncExitPageTipsState(isDirty);
    }
  };

  const handleOpenPath = () => {
    const path = manualPath.trim();
    if (!path) {
      showToast("请输入文件或文件夹路径", true);
      return;
    }
    FileIO.handleManualOpen(path);
  };

  const handleCreateNewFile = () => {
    const path = manualPath.trim();
    if (!path) {
      showToast("请输入完整的新建路径", true);
      return;
    }
    FileIO.createNewFile(path);
  };

  const isMarkdown =
    activeTab?.path.toLowerCase().endsWith(".md") ||
    activeTab?.languageId === "markdown";

  const isReadOnlyMode = !isEditMode || !!activeTab?.isHugeFile || !!activeTab?.isTruncated;

  const monacoOptions: monaco.editor.IStandaloneEditorConstructionOptions = {
    fontSize: settings.fontSize,
    fontFamily: settings.fontFamily,
    wordWrap: settings.wordWrap,
    minimap: { enabled: settings.minimap && !activeTab?.isHugeFile && !activeTab?.isTruncated },
    tabSize: settings.tabSize,
    renderWhitespace: settings.renderWhitespace,
    readOnly: isReadOnlyMode,
    domReadOnly: isReadOnlyMode,
    automaticLayout: true,
    scrollBeyondLastLine: false,
    folding: !activeTab?.isHugeFile && !activeTab?.isTruncated,
    contextmenu: true,
    quickSuggestions: !isReadOnlyMode,
    smoothScrolling: true,
  };

  return (
    <div className="flex-1 h-full flex flex-col overflow-hidden bg-zinc-900">
      <div className="flex-1 w-full flex overflow-hidden relative">
        {activeTab && activeTabPath !== WELCOME_PATH ? (
          <>
            {/* 1. 多媒体与文档只读预览 */}
            {activeTab.previewType ? (
              <MediaPreview
                path={activeTab.path}
                name={activeTab.name}
                type={activeTab.previewType}
              />
            ) : (
              /* 2. 普通文本 Monaco 编辑器 */
              <>
                <div className="flex-1 min-w-0 h-full relative">
                  <Editor
                    height="100%"
                    theme={settings.editorTheme}
                    options={monacoOptions}
                    onChange={handleEditorChange}
                    onMount={handleEditorMount}
                  />
                </div>

                {/* 3. Markdown 实时分栏预览 */}
                {isMarkdown && isPreviewActive && (
                  <MarkdownPreview
                    content={activeTab.content}
                    scrollRef={previewScrollRef}
                    onScroll={handlePreviewScroll}
                    onMouseEnter={() => {
                      currentScrollOwnerRef.current = "preview";
                    }}
                  />
                )}
              </>
            )}
          </>
        ) : (
          /* 4. 主页 (Welcome Overlay) */
          <div className="flex-1 h-full flex flex-col items-center justify-center p-6 bg-zinc-900 select-none text-zinc-300 animate-fade-in">
            <div className="max-w-md w-full text-center space-y-6">
              <div className="space-y-2">
                <div className="text-3xl font-extrabold tracking-wider bg-linear-to-r from-[#0078d4] to-teal-400 bg-clip-text text-transparent">
                  PodNote
                </div>
                <div className="text-xs text-zinc-500 font-medium">
                  基于 Monaco Editor 编辑器 - 轻量、极速的文本编辑器。
                </div>
                <div className="text-xs text-zinc-400">
                  {isFnosAvailable
                    ? "请使用左上角菜单打开文件或目录"
                    : "请从 FNOS 文件管理 中打开文件"}
                </div>
              </div>

              <div className="bg-zinc-950/60 border border-zinc-800 p-6 rounded-xl space-y-5 shadow-2xl">
                <div className="text-xs text-zinc-400 font-semibold border-b border-zinc-800 pb-2">
                  手动输入绝对路径
                </div>

                <div className="space-y-3">
                  <input
                    type="text"
                    value={manualPath}
                    onChange={(e) => setManualPath(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleOpenPath();
                    }}
                    placeholder="输入文件或文件夹绝对路径 (如 /etc/)"
                    className="w-full bg-zinc-900 text-zinc-200 border border-zinc-800 focus:border-[#0078d4] outline-none text-xs px-3.5 py-2.5 rounded-lg transition"
                    autoComplete="off"
                  />
                  <div className="grid grid-cols-2 gap-3.5">
                    <button
                      onClick={handleOpenPath}
                      className="w-full bg-[#0078d4] hover:bg-[#1e85d9] text-white text-xs font-semibold py-2.5 rounded-lg transition shadow-md shadow-blue-500/10"
                    >
                      打开路径
                    </button>
                    <button
                      onClick={handleCreateNewFile}
                      className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold py-2.5 rounded-lg transition border border-zinc-700"
                    >
                      新建文件
                    </button>
                  </div>
                </div>
              </div>

              {/* 浏览器插件引导 */}
              {!isExtensionInstalled && (
                <div className="bg-zinc-950/40 border border-zinc-800 p-4 rounded-xl text-left flex items-center justify-between text-xs animate-fade-in">
                  <div className="space-y-0.5">
                    <div className="font-semibold text-zinc-200">PodNote 浏览器拓展</div>
                    <div className="text-[11px] text-zinc-500">安装拓展获得无缝右键在 PodNote 中打开体验</div>
                  </div>
                  <a
                    href="https://microsoftedge.microsoft.com/addons/detail/podnote/ejcfjbjfgddfocnbocmdeodidfdpjcfk"
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-[#0078d4] hover:text-white rounded-lg border border-zinc-700 transition font-medium"
                  >
                    前往安装
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
