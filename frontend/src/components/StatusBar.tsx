import React, { useState, useEffect, useRef, useMemo } from "react";
import * as monaco from "monaco-editor";
import { useAppStore, WELCOME_PATH } from "../store/useAppStore";

interface StatusBarProps {
  cursorPosition: { line: number; column: number };
  charCount: string | number;
  eol: string;
  language: string;
  onSelectLanguage: (lang: string) => void;
  onSelectEOL: (eol: string) => void;
  onSelectEncoding: (enc: string) => void;
}

const SUPPORTED_ENCODINGS = [
  { label: "UTF-8", value: "utf-8" },
  { label: "GBK (GB2312)", value: "gbk" },
  { label: "GB18030", value: "gb18030" },
  { label: "Big5 (繁体)", value: "big5" },
  { label: "UTF-16 LE", value: "utf-16le" },
  { label: "UTF-16 BE", value: "utf-16be" },
  { label: "ISO-8859-1", value: "iso-8859-1" },
  { label: "Shift-JIS (日文)", value: "shift_jis" },
  { label: "EUC-KR (韩文)", value: "euc-kr" },
];

const SUPPORTED_EOLS = [
  { label: "LF (Unix/Linux)", value: "\n" },
  { label: "CRLF (Windows)", value: "\r\n" },
];

export const StatusBar: React.FC<StatusBarProps> = ({
  cursorPosition,
  charCount,
  eol,
  language,
  onSelectLanguage,
  onSelectEOL,
  onSelectEncoding,
}) => {
  const activeTabPath = useAppStore((state) => state.activeTabPath);
  const activeTab = useAppStore((state) =>
    state.tabs.find((t) => t.path === state.activeTabPath)
  );
  const problems = useAppStore((state) => state.problems);
  const activeBottomTab = useAppStore((state) => state.activeBottomPanelTab);
  const setActiveBottomTab = useAppStore((state) => state.setActiveBottomPanelTab);
  const showToast = useAppStore((state) => state.showToast);
  
  const [activeDropdown, setActiveDropdown] = useState<"lang" | "encoding" | "eol" | null>(null);
  const [langSearch, setLangSearch] = useState("");
  const statusBarRef = useRef<HTMLDivElement>(null);

  const errorsCount = problems.filter((p) => p.severity === "error").length;
  const warningsCount = problems.filter((p) => p.severity === "warning").length;

  // 动态获取 Monaco 全量语言列表并排序
  const allLanguages = useMemo(() => {
    try {
      const list = monaco.languages.getLanguages();
      return list
        .map((l) => ({
          id: l.id,
          label: (l.aliases && l.aliases[0]) || l.id,
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
    } catch (e) {
      return [{ id: "plaintext", label: "Plain Text" }];
    }
  }, []);

  const filteredLanguages = useMemo(() => {
    if (!langSearch.trim()) return allLanguages;
    const q = langSearch.toLowerCase();
    return allLanguages.filter(
      (l) => l.label.toLowerCase().includes(q) || l.id.toLowerCase().includes(q)
    );
  }, [allLanguages, langSearch]);

  const currentEncodingLabel =
    SUPPORTED_ENCODINGS.find((e) => e.value === (activeTab?.encoding || "utf-8").toLowerCase())?.label || "UTF-8";

  const currentLanguageLabel =
    allLanguages.find((l) => l.id === (activeTab?.languageId || language))?.label ||
    (activeTab?.languageId || language || "纯文本");

  // 点击外部收起底栏下拉
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (statusBarRef.current && !statusBarRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
        setLangSearch("");
      }
    };

    document.addEventListener("pointerdown", handleOutsideClick, true);
    return () => {
      document.removeEventListener("pointerdown", handleOutsideClick, true);
    };
  }, []);

  const handleCopyPath = async () => {
    if (!activeTabPath || activeTabPath === WELCOME_PATH) return;
    try {
      await navigator.clipboard.writeText(activeTabPath);
      showToast("文件路径已复制");
    } catch (e) {
      showToast("复制失败", true);
    }
  };

  const handleToggleProblems = () => {
    if (activeBottomTab === "problems") {
      setActiveBottomTab(null);
    } else {
      setActiveBottomTab("problems");
    }
  };

  const isMediaPreview = Boolean(activeTab?.previewType);
  const isHome = !activeTabPath || activeTabPath === WELCOME_PATH;

  return (
    <div
      ref={statusBarRef}
      className="h-6.25 w-full bg-zinc-950 border-t border-zinc-900 flex items-center justify-between px-3 text-xs text-zinc-400 select-none shrink-0 relative z-40"
    >
      {/* 1. 左侧：状态与问题指示器 */}
      <div className="flex items-center space-x-3.5">
        <span className="truncate max-w-30" title={!isHome ? "已加载" : "准备就绪"}>
          {!isHome ? "已加载" : "准备就绪"}
        </span>

        <button
          onClick={handleToggleProblems}
          className={`flex items-center space-x-1.5 px-1 py-0.5 rounded hover:bg-zinc-800 transition ${
            activeBottomTab === "problems" ? "bg-zinc-800 text-[#0078d4]" : ""
          }`}
          title="切换问题面板"
        >
          <span className="flex items-center text-red-500">
            <svg className="w-3.5 h-3.5 mr-0.5" viewBox="0 0 16 16" fill="currentColor">
              <path fillRule="evenodd" clipRule="evenodd" d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 1a6 6 0 1 1 0 12A6 6 0 0 1 8 2zM10.35 5.65L11.06 6.36 8.71 8.71 11.06 11.06 10.35 11.77 8 9.41 5.65 11.77 4.94 11.06 7.29 8.71 4.94 6.36 5.65 5.65 8 8 10.35 5.65z" />
            </svg>
            {errorsCount}
          </span>
          <span className="flex items-center text-yellow-500">
            <svg className="w-3.5 h-3.5 mr-0.5" viewBox="0 0 16 16" fill="currentColor">
              <path d="M7.56 1h.88l6.54 12.25-.44.75H1.46l-.44-.75L7.56 1zM8 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zm-.75-7v5h1.5V5h-1.5z" />
            </svg>
            {warningsCount}
          </span>
        </button>
      </div>

      {/* 2. 中间：文件路径面包屑 (支持点击复制) */}
      {!isHome && (
        <div
          onClick={handleCopyPath}
          title="点击复制路径"
          className="hidden md:block truncate max-w-[40%] text-zinc-500 font-mono transition hover:text-zinc-200 cursor-pointer"
        >
          {activeTabPath}
        </div>
      )}

      {/* 3. 右侧：语言、编码、换行与行列指示器 */}
      <div className="flex items-center space-x-3">
        {/* 行列指示器 (非预览且非主页) */}
        {!isHome && !isMediaPreview && (
          <span className="hidden sm:inline text-zinc-500 font-mono text-[11px]">
            行 {cursorPosition.line}，列 {cursorPosition.column} ({charCount} 字符)
          </span>
        )}

        {/* 换行符选择 */}
        {!isHome && !isMediaPreview && (
          <div className="relative">
            <button
              onClick={() => setActiveDropdown(activeDropdown === "eol" ? null : "eol")}
              className="hover:text-zinc-200 transition px-1 py-0.5 rounded hover:bg-zinc-800"
            >
              {eol}
            </button>
            {activeDropdown === "eol" && (
              <div className="absolute right-0 bottom-7 bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl py-1 w-36 z-50 text-xs">
                <div className="px-2.5 py-1 text-[10px] font-bold text-zinc-500 border-b border-zinc-800">
                  选择行尾序列
                </div>
                {SUPPORTED_EOLS.map((item) => (
                  <button
                    key={item.value}
                    onClick={() => {
                      onSelectEOL(item.value);
                      setActiveDropdown(null);
                    }}
                    className={`w-full px-2.5 py-1.5 text-left hover:bg-[#0078d4] hover:text-white transition ${
                      eol === (item.value === "\n" ? "LF" : "CRLF") ? "text-[#0078d4] font-medium" : "text-zinc-300"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 编码选择 */}
        {!isHome && !isMediaPreview && (
          <div className="relative">
            <button
              onClick={() => setActiveDropdown(activeDropdown === "encoding" ? null : "encoding")}
              className="hover:text-zinc-200 transition px-1 py-0.5 rounded hover:bg-zinc-800"
            >
              {currentEncodingLabel}
            </button>
            {activeDropdown === "encoding" && (
              <div className="absolute right-0 bottom-7 bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl py-1 w-44 z-50 text-xs">
                <div className="px-2.5 py-1 text-[10px] font-bold text-zinc-500 border-b border-zinc-800">
                  选择文件编码
                </div>
                {SUPPORTED_ENCODINGS.map((item) => (
                  <button
                    key={item.value}
                    onClick={() => {
                      onSelectEncoding(item.value);
                      setActiveDropdown(null);
                    }}
                    className={`w-full px-2.5 py-1.5 text-left hover:bg-[#0078d4] hover:text-white transition ${
                      (activeTab?.encoding || "utf-8").toLowerCase() === item.value
                        ? "text-[#0078d4] font-medium"
                        : "text-zinc-300"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 语言选择 */}
        <div className="relative">
          <button
            onClick={() => {
              if (isHome || isMediaPreview) return;
              setActiveDropdown(activeDropdown === "lang" ? null : "lang");
              setLangSearch("");
            }}
            disabled={isHome || isMediaPreview}
            className={`transition px-1 py-0.5 rounded ${
              isHome || isMediaPreview
                ? "text-zinc-600 cursor-default"
                : "hover:text-zinc-200 hover:bg-zinc-800"
            }`}
          >
            {isHome ? "主页" : isMediaPreview ? (activeTab?.previewType ? activeTab.previewType.toUpperCase() : "预览") : currentLanguageLabel}
          </button>
          {activeDropdown === "lang" && (
            <div className="absolute right-0 bottom-7 bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl py-1 w-56 z-50 text-xs flex flex-col max-h-64">
              <div className="px-2.5 py-1.5 border-b border-zinc-800">
                <input
                  type="text"
                  value={langSearch}
                  onChange={(e) => setLangSearch(e.target.value)}
                  placeholder="搜索语言..."
                  autoFocus
                  className="w-full bg-zinc-950 text-zinc-200 border border-zinc-800 focus:border-[#0078d4] outline-none text-xs px-2 py-1 rounded"
                />
              </div>
              <div className="flex-1 overflow-y-auto py-1">
                {filteredLanguages.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      onSelectLanguage(item.id);
                      setActiveDropdown(null);
                      setLangSearch("");
                    }}
                    className={`w-full px-2.5 py-1.5 text-left hover:bg-[#0078d4] hover:text-white transition truncate ${
                      (activeTab?.languageId || language) === item.id ? "text-[#0078d4] font-medium" : "text-zinc-300"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
