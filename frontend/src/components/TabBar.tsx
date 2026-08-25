import React, { useRef, useEffect, useState, useCallback } from "react";
import { useAppStore, showConfirm, WELCOME_PATH } from "../store/useAppStore";
import type { TabItem } from "../store/useAppStore";

export const TabBar: React.FC<{ editorRef: any }> = ({ editorRef }) => {
  const tabs = useAppStore((state) => state.tabs);
  const activeTabPath = useAppStore((state) => state.activeTabPath);
  const setActiveTabPath = useAppStore((state) => state.setActiveTabPath);
  const updateTabViewState = useAppStore((state) => state.updateTabViewState);
  const closeTab = useAppStore((state) => state.closeTab);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [isAtLeft, setIsAtLeft] = useState(true);
  const [isAtRight, setIsAtRight] = useState(false);

  // 检查滚动溢出状态与边界
  const checkScrollBounds = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const hasScroll = el.scrollWidth > el.clientWidth + 2;
    setHasOverflow(hasScroll);

    if (hasScroll) {
      setIsAtLeft(el.scrollLeft <= 1);
      setIsAtRight(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
    }
  }, []);

  useEffect(() => {
    checkScrollBounds();
    const el = scrollContainerRef.current;
    if (!el) return;

    el.addEventListener("scroll", checkScrollBounds, { passive: true });
    window.addEventListener("resize", checkScrollBounds);

    return () => {
      el.removeEventListener("scroll", checkScrollBounds);
      window.removeEventListener("resize", checkScrollBounds);
    };
  }, [tabs, checkScrollBounds]);

  // 监听 activeTabPath 改变，自动将当前 Tab 滚动到可视区域内
  useEffect(() => {
    if (!activeTabPath || !scrollContainerRef.current) return;
    const activeEl = scrollContainerRef.current.querySelector(
      `[data-tab-path="${activeTabPath.replace(/\\/g, "\\\\")}"]`
    ) as HTMLElement;

    if (activeEl) {
      const container = scrollContainerRef.current;
      const containerLeft = container.scrollLeft;
      const containerRight = containerLeft + container.clientWidth;
      const elLeft = activeEl.offsetLeft;
      const elRight = elLeft + activeEl.clientWidth;

      if (elLeft < containerLeft) {
        container.scrollTo({ left: elLeft - 10, behavior: "smooth" });
      } else if (elRight > containerRight) {
        container.scrollTo({
          left: elRight - container.clientWidth + 10,
          behavior: "smooth",
        });
      }
    }
    setTimeout(checkScrollBounds, 50);
  }, [activeTabPath, checkScrollBounds]);

  const handleTabClick = (path: string) => {
    const editor = editorRef.current;
    if (editor && activeTabPath && activeTabPath !== WELCOME_PATH) {
      const viewState = editor.saveViewState();
      updateTabViewState(activeTabPath, viewState);
    }
    setActiveTabPath(path);
  };

  const handleCloseTab = async (e: React.MouseEvent, tab: TabItem) => {
    e.stopPropagation();
    
    // 如果文件已被修改且未存盘，使用自定义 Modal 提示确认
    const isDirty =
      tab.path !== WELCOME_PATH &&
      (tab.content !== tab.originalContent ||
        tab.encoding !== tab.originalEncoding);

    if (isDirty) {
      const confirmClose = await showConfirm(
        `文件 "${tab.name}" 尚未保存，确定要关闭吗？修改将会丢失。`,
        "关闭未保存的文件"
      );
      if (!confirmClose) return;
    }

    closeTab(tab.path);
  };

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -150, behavior: "smooth" });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 150, behavior: "smooth" });
    }
  };

  if (tabs.length === 0) return null;

  return (
    <div className="h-full w-full flex items-center justify-between shrink-0 select-none">
      {/* 滚动左键 (仅溢出时显示) */}
      {hasOverflow && (
        <button
          onClick={scrollLeft}
          disabled={isAtLeft}
          title="向左滚动"
          style={{ opacity: isAtLeft ? 0.3 : 1, pointerEvents: isAtLeft ? "none" : "auto" }}
          className="h-full px-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition duration-150 shrink-0 border-r border-zinc-900"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
      )}

      {/* 中间横向滚动标签栏 */}
      <div
        ref={scrollContainerRef}
        className="flex-1 h-full overflow-x-auto no-scrollbar flex items-end"
      >
        {tabs.map((tab) => {
          const isActive = tab.path === activeTabPath;
          const isDirty =
            tab.path !== WELCOME_PATH &&
            (tab.content !== tab.originalContent ||
              tab.encoding !== tab.originalEncoding);

          const isWelcome = tab.path === WELCOME_PATH;

          return (
            <div
              key={tab.path}
              data-tab-path={tab.path}
              onClick={() => handleTabClick(tab.path)}
              className={`group h-full flex items-center px-3.5 border-r border-zinc-900 cursor-pointer text-xs transition duration-150 shrink-0 ${
                isActive
                  ? "bg-zinc-900 text-white border-t border-t-[#0078d4]"
                  : "bg-zinc-950 text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300"
              }`}
            >
              {isWelcome ? (
                <span className="flex items-center space-x-1">
                  <svg className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-200 transition" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                    <polyline points="9 22 9 12 15 12 15 22"></polyline>
                  </svg>
                  <span>主页</span>
                </span>
              ) : (
                <span className="truncate max-w-30">{tab.name}</span>
              )}
              
              {/* 右侧脏标记小圆点或关闭叉 */}
              <div className="w-4 h-4 ml-2 flex items-center justify-center relative">
                {isDirty ? (
                  <span className="w-1.5 h-1.5 bg-[#0078d4] rounded-full group-hover:hidden" />
                ) : null}
                <button
                  onClick={(e) => handleCloseTab(e, tab)}
                  title={isDirty ? "未保存修改" : "关闭标签页"}
                  className={`p-0.5 rounded-xs hover:bg-zinc-800 text-zinc-500 hover:text-white transition ${
                    isDirty ? "hidden group-hover:block" : "opacity-0 group-hover:opacity-100"
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="10" height="10">
                    <path d="M289.94 256l95-95A24 24 0 0 0 351 127l-95 95l-95-95a24 24 0 0 0-34 34l95 95l-95 95a24 24 0 1 0 34 34l95-95l95 95a24 24 0 0 0 34-34z" fill="currentColor"></path>
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 滚动右键 (仅溢出时显示) */}
      {hasOverflow && (
        <button
          onClick={scrollRight}
          disabled={isAtRight}
          title="向右滚动"
          style={{ opacity: isAtRight ? 0.3 : 1, pointerEvents: isAtRight ? "none" : "auto" }}
          className="h-full px-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition duration-150 shrink-0 border-l border-zinc-900"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      )}
    </div>
  );
};
