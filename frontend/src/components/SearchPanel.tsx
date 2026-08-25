import React, { useState, useEffect } from "react";
import { useAppStore, showConfirm } from "../store/useAppStore";

interface MatchItem {
  range: {
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
  };
  text: string;
}

export const SearchPanel: React.FC<{ editorRef: any }> = ({ editorRef }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [replaceQuery, setReplaceQuery] = useState("");
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const showToast = useAppStore((state) => state.showToast);

  const activeTabPath = useAppStore((state) => state.activeTabPath);
  const activeSidebarPanel = useAppStore((state) => state.activeSidebarPanel);

  // 当侧栏面板切换至 search 且编辑器有选中文本时，自动填入搜索框
  useEffect(() => {
    if (activeSidebarPanel === "search") {
      const editor = editorRef.current;
      if (editor) {
        const selection = editor.getSelection();
        const model = editor.getModel();
        if (model && selection && !selection.isEmpty()) {
          const selText = model.getValueInRange(selection);
          if (selText && selText.length < 200) {
            setSearchQuery(selText);
          }
        }
      }
    }
  }, [activeSidebarPanel]);

  // 防抖处理搜索输入，延迟 250ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 当激活的文件标签页改变或防抖后的查询词修改时，自动重新搜索
  useEffect(() => {
    performSearch(debouncedSearchQuery);
  }, [activeTabPath, debouncedSearchQuery]);

  const performSearch = (query = searchQuery) => {
    const editor = editorRef.current;
    if (!editor || !query) {
      setMatches([]);
      setCurrentIndex(-1);
      return;
    }

    const model = editor.getModel();
    if (!model) return;

    const monacoMatches = model.findMatches(
      query,
      false, // Regex
      false, // CaseSensitive
      false, // WholeWord
      null,  // wordSeparators
      true,  // captureMatches
      1000   // limitResultCount
    );

    const formattedMatches: MatchItem[] = monacoMatches.map((m: any) => ({
      range: m.range,
      text: model.getLineContent(m.range.startLineNumber),
    }));

    setMatches(formattedMatches);
    setCurrentIndex(-1);
  };

  const selectMatch = (index: number) => {
    if (index < 0 || index >= matches.length) return;
    setCurrentIndex(index);

    const editor = editorRef.current;
    if (editor) {
      const match = matches[index];
      editor.revealRangeInCenter(match.range);
      editor.setSelection(match.range);
      editor.focus();
    }
  };

  const handlePrev = () => {
    if (matches.length === 0) return;
    const prevIdx = currentIndex <= 0 ? matches.length - 1 : currentIndex - 1;
    selectMatch(prevIdx);
  };

  const handleNext = () => {
    if (matches.length === 0) return;
    const nextIdx = (currentIndex + 1) % matches.length;
    selectMatch(nextIdx);
  };

  const handleReplace = () => {
    const editor = editorRef.current;
    if (!editor || matches.length === 0) return;

    const idx = currentIndex === -1 ? 0 : currentIndex;
    const match = matches[idx];

    editor.executeEdits("sidebar-replace", [
      {
        range: match.range,
        text: replaceQuery,
        forceMoveMarkers: true,
      },
    ]);

    setTimeout(() => {
      performSearch(debouncedSearchQuery);
      if (matches.length > 0) {
        selectMatch(idx >= matches.length ? 0 : idx);
      }
    }, 50);
  };

  const handleReplaceAll = async () => {
    const editor = editorRef.current;
    if (!editor || matches.length === 0) return;

    const confirmReplace = await showConfirm(
      `确定要将所有 ${matches.length} 个匹配项替换为 "${replaceQuery}" 吗？`,
      "全部替换"
    );
    if (!confirmReplace) return;

    const edits = [...matches]
      .reverse()
      .map((m) => ({
        range: m.range,
        text: replaceQuery,
        forceMoveMarkers: true,
      }));

    editor.executeEdits("sidebar-replace-all", edits);
    showToast("已全部替换完成");
    setSearchQuery("");
    setMatches([]);
    setCurrentIndex(-1);
  };

  const highlightText = (text: string, query: string) => {
    if (!query) return text;
    const escapeRegExp = (str: string) => str.replace(/[/\-\\^$*+?.()|[\]{}]/g, "\\$&");
    const parts = text.split(new RegExp(`(${escapeRegExp(query)})`, "gi"));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={i} className="bg-yellow-500/40 text-white rounded-xs px-0.5">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  };

  return (
    <div className="h-full flex flex-col bg-zinc-950 border-r border-zinc-800 text-xs select-none">
      {/* 标题 */}
      <div className="px-3 py-2 border-b border-zinc-800 shrink-0">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          查找与替换
        </span>
      </div>

      {/* 表单输入区 */}
      <div className="p-3 space-y-2.5 border-b border-zinc-800 shrink-0">
        <div className="space-y-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleNext();
            }}
            placeholder="查找文本..."
            className="w-full bg-zinc-900 text-zinc-200 border border-zinc-800 focus:border-[#0078d4] outline-none text-xs px-2.5 py-1.5 rounded transition"
            autoComplete="off"
          />
        </div>
        <div className="space-y-1">
          <input
            type="text"
            value={replaceQuery}
            onChange={(e) => setReplaceQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleReplace();
            }}
            placeholder="替换为..."
            className="w-full bg-zinc-900 text-zinc-200 border border-zinc-800 focus:border-[#0078d4] outline-none text-xs px-2.5 py-1.5 rounded transition"
            autoComplete="off"
          />
        </div>

        {/* 动作面板 */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex space-x-1">
            <button
              onClick={handlePrev}
              disabled={matches.length === 0}
              title="上一个匹配 (Shift+F3)"
              className="p-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 disabled:opacity-30 text-zinc-300 rounded transition"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="18 15 12 9 6 15"></polyline>
              </svg>
            </button>
            <button
              onClick={handleNext}
              disabled={matches.length === 0}
              title="下一个匹配 (F3)"
              className="p-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 disabled:opacity-30 text-zinc-300 rounded transition"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
          </div>
          <div className="flex space-x-1.5">
            <button
              onClick={handleReplace}
              disabled={matches.length === 0}
              className="px-2.5 py-1 text-xs bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 disabled:opacity-30 text-zinc-300 rounded transition font-medium"
            >
              替换
            </button>
            <button
              onClick={handleReplaceAll}
              disabled={matches.length === 0}
              className="px-2.5 py-1 text-xs bg-[#0078d4] hover:bg-[#1e85d9] disabled:opacity-30 text-white rounded transition font-medium"
            >
              全部
            </button>
          </div>
        </div>

        {/* 结果数量提示 */}
        <div className="text-[11px] text-zinc-500 pt-0.5 font-mono">
          {searchQuery ? (matches.length > 0 ? `找到 ${matches.length} 个匹配项` : "无结果") : "无结果"}
        </div>
      </div>

      {/* 匹配列表 */}
      <div className="flex-1 overflow-y-auto p-1 space-y-1">
        {matches.map((match, idx) => (
          <div
            key={idx}
            onClick={() => selectMatch(idx)}
            className={`p-2 rounded cursor-pointer transition text-xs font-mono select-none ${
              currentIndex === idx
                ? "bg-[#0078d4]/20 border-l-2 border-[#0078d4] text-white"
                : "bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300"
            }`}
          >
            <div className="text-[10px] text-zinc-500 mb-0.5">行 {match.range.startLineNumber}</div>
            <div className="truncate text-xs">{highlightText(match.text, debouncedSearchQuery)}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
