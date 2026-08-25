import React, { useRef, useEffect, useState } from "react";
import { useAppStore, checkIsNarrowScreen } from "../store/useAppStore";
import { FileTree } from "./FileTree";
import { SearchPanel } from "./SearchPanel";
import { SettingsPanel } from "./SettingsPanel";

export const Sidebar: React.FC<{ editorRef: any }> = ({ editorRef }) => {
  const activePanel = useAppStore((state) => state.activeSidebarPanel);
  const setActivePanel = useAppStore((state) => state.setActiveSidebarPanel);
  const activeBottomTab = useAppStore((state) => state.activeBottomPanelTab);
  const setActiveBottomTab = useAppStore((state) => state.setActiveBottomPanelTab);
  const sidebarWidth = useAppStore((state) => state.sidebarWidth);
  const setSidebarWidth = useAppStore((state) => state.setSidebarWidth);

  const resizerRef = useRef<HTMLDivElement>(null);
  const [lastWidth, setLastWidth] = useState(260);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const isNarrow = checkIsNarrowScreen();

  const handlePanelClick = (panelName: "explorer" | "search" | "settings") => {
    if (activePanel === panelName) {
      collapseSidebar();
    } else {
      expandSidebar(panelName);
    }
  };

  const expandSidebar = (panelName: "explorer" | "search" | "settings") => {
    setActivePanel(panelName);
    if (sidebarWidth < 50) {
      setSidebarWidth(lastWidth || 260);
    }
  };

  const collapseSidebar = () => {
    if (
      document.activeElement &&
      (document.activeElement.tagName === "INPUT" ||
        document.activeElement.tagName === "TEXTAREA" ||
        document.activeElement.tagName === "SELECT")
    ) {
      (document.activeElement as HTMLElement).blur();
    }
    setActivePanel(null);
  };

  const handleTerminalClick = () => {
    if (activeBottomTab === "terminal") {
      setActiveBottomTab(null);
    } else {
      setActiveBottomTab("terminal");
    }
  };

  // 移动端虚拟键盘视口适配
  useEffect(() => {
    if (!window.visualViewport) return;

    const handleViewportChange = () => {
      if (!activePanel) {
        setKeyboardHeight(0);
        return;
      }
      const viewport = window.visualViewport;
      if (!viewport) return;

      const scale = viewport.scale || 1;
      const isZoomed = Math.abs(scale - 1) > 0.05;
      const heightDiff = !isZoomed ? window.innerHeight - viewport.height : 0;
      window.scrollTo(0, 0);

      if (heightDiff > 50) {
        setKeyboardHeight(heightDiff);
      } else {
        setKeyboardHeight(0);
      }
    };

    window.visualViewport.addEventListener("resize", handleViewportChange, { passive: true });
    window.visualViewport.addEventListener("scroll", handleViewportChange, { passive: true });
    handleViewportChange();

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", handleViewportChange);
        window.visualViewport.removeEventListener("scroll", handleViewportChange);
      }
    };
  }, [activePanel]);

  // 鼠标拖拽调节侧边栏宽度与双击折叠/还原
  useEffect(() => {
    const resizer = resizerRef.current;
    if (!resizer) return;

    let startX = 0;
    let startW = sidebarWidth;

    const handleMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      startX = e.clientX;
      startW = sidebarWidth;
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    };

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX;
      let newWidth = startW + deltaX;
      if (newWidth < 50) {
        newWidth = 0;
      } else if (newWidth < 150) {
        newWidth = 150;
      } else if (newWidth > 600) {
        newWidth = 600;
      }

      if (newWidth >= 50) {
        setSidebarWidth(newWidth);
        setLastWidth(newWidth);
      } else {
        setActivePanel(null);
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.removeProperty("cursor");
      document.body.style.removeProperty("user-select");
    };

    const handleDblClick = () => {
      if (activePanel) {
        collapseSidebar();
      } else {
        expandSidebar("explorer");
      }
    };

    resizer.addEventListener("mousedown", handleMouseDown);
    resizer.addEventListener("dblclick", handleDblClick);

    return () => {
      resizer.removeEventListener("mousedown", handleMouseDown);
      resizer.removeEventListener("dblclick", handleDblClick);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [activePanel, sidebarWidth, lastWidth, setSidebarWidth]);

  return (
    <>
      {/* 窄屏遮罩层 */}
      {isNarrow && activePanel && (
        <div
          onClick={collapseSidebar}
          className="fixed inset-0 bg-black/50 backdrop-blur-xs z-30 animate-fade-in"
        />
      )}

      <div className={`flex h-full shrink-0 select-none ${isNarrow && activePanel ? "fixed left-0 top-8.75 bottom-6.25 z-40" : "relative"}`}>
        {/* 1. 最左侧：活动图标栏 (ActivityBar) */}
        <div className="w-12.5 bg-zinc-950 border-r border-zinc-800 flex flex-col justify-between items-center py-3 shrink-0 z-20">
          <div className="flex flex-col space-y-4 w-full items-center">
            {/* 资源管理器 */}
            <button
              onClick={() => handlePanelClick("explorer")}
              title="资源管理器"
              className={`p-2.5 rounded-lg transition-all duration-150 relative ${
                activePanel === "explorer"
                  ? "text-[#0078d4] bg-zinc-900"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3v4a1 1 0 0 0 1 1h4" />
                  <path d="M18 17h-7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4l5 5v7a2 2 0 0 1-2 2z" />
                  <path d="M16 17v2a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2" />
                </g>
              </svg>
              {activePanel === "explorer" && (
                <span className="absolute left-0 top-1/4 w-1 h-1/2 bg-[#0078d4] rounded-r" />
              )}
            </button>

            {/* 全局查找 */}
            <button
              onClick={() => handlePanelClick("search")}
              title="搜索"
              className={`p-2.5 rounded-lg transition-all duration-150 relative ${
                activePanel === "search"
                  ? "text-[#0078d4] bg-zinc-900"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 3v4a1 1 0 0 0 1 1h4" />
                  <path d="M12 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v4.5" />
                  <circle cx="16.5" cy="17.5" r="2.5" />
                  <path d="M18.5 19.5L21 22" />
                </g>
              </svg>
              {activePanel === "search" && (
                <span className="absolute left-0 top-1/4 w-1 h-1/2 bg-[#0078d4] rounded-r" />
              )}
            </button>

            {/* 底部终端切换 */}
            <button
              onClick={handleTerminalClick}
              title="终端"
              className={`p-2.5 rounded-lg transition-all duration-150 relative ${
                activeBottomTab === "terminal"
                  ? "text-[#0078d4] bg-zinc-900"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 9l3 3l-3 3" />
                  <path d="M13 15h3" />
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                </g>
              </svg>
              {activeBottomTab === "terminal" && (
                <span className="absolute left-0 top-1/4 w-1 h-1/2 bg-[#0078d4] rounded-r" />
              )}
            </button>
          </div>

          {/* 底部图标：在新标签页打开与设置 */}
          <div className="flex flex-col space-y-4 w-full items-center">
            <button
              onClick={() => window.open(window.location.href, "_blank")}
              title="在新标签页打开"
              className="p-2.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 transition-all duration-150"
            >
              <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path
                  d="M18 19H6c-.55 0-1-.45-1-1V6c0-.55.45-1 1-1h5c.55 0 1-.45 1-1s-.45-1-1-1H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-6c0-.55-.45-1-1-1s-1 .45-1 1v5c0 .55-.45 1-1 1zM14 4c0 .55.45 1 1 1h2.59l-9.13 9.13a.996.996 0 1 0 1.41 1.41L19 6.41V9c0 .55.45 1 1 1s1-.45 1-1V4c0-.55-.45-1-1-1h-5c-.55 0-1 .45-1 1z"
                  fill="currentColor"
                />
              </svg>
            </button>

            <button
              onClick={() => handlePanelClick("settings")}
              title="设置"
              className={`p-2.5 rounded-lg transition-all duration-150 relative ${
                activePanel === "settings"
                  ? "text-[#0078d4] bg-zinc-900"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path
                  d="M19.43 12.98c.04-.32.07-.64.07-.98c0-.34-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46a.5.5 0 0 0-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65A.488.488 0 0 0 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1a.566.566 0 0 0-.18-.03c-.17 0-.34.09-.43.25l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98c0 .33.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46a.5.5 0 0 0 .61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.06.02.12.03.18.03c.17 0 .34-.09.43-.25l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zm-1.98-1.71c.04.31.05.52.05.73c0 .21-.02.43-.05.73l-.14 1.13l.89.7l1.08.84l-.7 1.21l-1.27-.51l-1.04-.42l-.9.68c-.43.32-.84.56-1.25.73l-1.06.43l-.16 1.13l-.2 1.35h-1.4l-.19-1.35l-.16-1.13l-1.06-.43c-.43-.18-.83-.41-1.23-.71l-.91-.7l-1.06.43l-1.27.51l-.7-1.21l1.08-.84l.89-.7l-.14-1.13c-.03-.31-.05-.54-.05-.74s.02-.43.05-.73l.14-1.13l-.89-.7l-1.08-.84l.7-1.21l1.27.51l1.04.42l.9-.68c.43-.32.84-.56 1.25-.73l1.06-.43l.16-1.13l.2-1.35h1.39l.19 1.35l.16 1.13l1.06.43c.43.18.83.41 1.23.71l.91.7l1.06-.43l1.27-.51l.7 1.21l-1.07.85l-.89.7l.14 1.13zM12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4s4-1.79 4-4s-1.79-4-4-4zm0 6c-1.1 0-2-.9-2-2s.9-2 2-2s2 .9 2 2s-.9 2-2 2z"
                  fill="currentColor"
                />
              </svg>
              {activePanel === "settings" && (
                <span className="absolute left-0 top-1/4 w-1 h-1/2 bg-[#0078d4] rounded-r" />
              )}
            </button>
          </div>
        </div>

        {/* 2. 侧边栏内容面板 */}
        {activePanel && (
          <div
            className="bg-zinc-950 border-r border-zinc-800 flex flex-col shrink-0 overflow-hidden relative z-20"
            style={{
              width: `${sidebarWidth}px`,
              paddingBottom: keyboardHeight > 0 ? `${keyboardHeight}px` : undefined,
            }}
          >
            {activePanel === "explorer" && <FileTree />}
            {activePanel === "search" && <SearchPanel editorRef={editorRef} />}
            {activePanel === "settings" && <SettingsPanel />}
          </div>
        )}

        {/* 3. 侧边栏拖拽拉伸轨道 */}
        {activePanel && (
          <div
            ref={resizerRef}
            className="w-1 bg-transparent hover:bg-[#0078d4] cursor-col-resize transition-colors duration-150 shrink-0"
            title="拖动调节宽度，双击快速折叠/展开"
          />
        )}
      </div>
    </>
  );
};
