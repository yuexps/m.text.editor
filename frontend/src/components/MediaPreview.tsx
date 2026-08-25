import React, { useEffect, useState, useRef } from "react";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { API } from "../services/api";
import type { PreviewType } from "../store/useAppStore";

interface MediaPreviewProps {
  path: string;
  name: string;
  type: PreviewType;
}

export const MediaPreview: React.FC<MediaPreviewProps> = ({ path, name, type }) => {
  const rawUrl = API.getRawReadUrl(path);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [docxHtml, setDocxHtml] = useState<string>("");
  const [sheets, setSheets] = useState<{ name: string; html: string }[]>([]);
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);

  // 音频动效状态
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    setError(null);
    if (type === "docx") {
      setLoading(true);
      fetch(rawUrl)
        .then((res) => {
          if (!res.ok) throw new Error(`拉取文档失败: ${res.statusText}`);
          return res.arrayBuffer();
        })
        .then((arrayBuffer) => mammoth.convertToHtml({ arrayBuffer }))
        .then((result) => {
          setDocxHtml(result.value || "<p style='text-align:center;color:#888;'>暂无内容</p>");
          setLoading(false);
        })
        .catch((err) => {
          setError(err.message);
          setLoading(false);
        });
    } else if (type === "xlsx") {
      setLoading(true);
      fetch(rawUrl)
        .then((res) => {
          if (!res.ok) throw new Error(`拉取表格失败: ${res.statusText}`);
          return res.arrayBuffer();
        })
        .then((arrayBuffer) => {
          const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });
          const parsedSheets = workbook.SheetNames.map((sheetName) => {
            const worksheet = workbook.Sheets[sheetName];
            const html = XLSX.utils.sheet_to_html(worksheet, { header: "", footer: "" });
            return { name: sheetName, html };
          });
          setSheets(parsedSheets);
          setActiveSheetIndex(0);
          setLoading(false);
        })
        .catch((err) => {
          setError(err.message);
          setLoading(false);
        });
    }
  }, [rawUrl, type]);

  if (loading) {
    return (
      <div className="flex-1 h-full flex items-center justify-center bg-zinc-900 text-zinc-400 text-sm">
        正在解析文件...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 h-full flex flex-col items-center justify-center bg-zinc-900 text-red-400 space-y-2 p-4">
        <div className="text-base font-semibold">预览失败</div>
        <div className="text-xs text-zinc-400">{error}</div>
      </div>
    );
  }

  // 1. 图片预览
  if (type === "image") {
    return (
      <div className="flex-1 h-full flex items-center justify-center p-6 bg-[#0c0c0c] overflow-auto select-none">
        <img
          src={rawUrl}
          alt={name}
          className="max-w-full max-h-full object-contain rounded shadow-lg transition-opacity duration-300"
        />
      </div>
    );
  }

  // 2. 音频预览（带唱片盘动效）
  if (type === "audio") {
    return (
      <div className="flex-1 h-full flex flex-col items-center justify-center p-6 bg-zinc-900 select-none">
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-8 flex flex-col items-center max-w-sm w-full shadow-2xl space-y-6">
          {/* 黑胶唱片动效 */}
          <div className="relative w-40 h-40 flex items-center justify-center">
            <div
              className={`w-36 h-36 rounded-full bg-linear-to-tr from-zinc-950 via-zinc-800 to-zinc-950 border-4 border-zinc-900 flex items-center justify-center shadow-2xl ${
                isPlaying ? "animate-spin" : ""
              }`}
              style={{ animationDuration: "4s" }}
            >
              <div className="w-12 h-12 rounded-full bg-[#0078d4] border-2 border-zinc-900 flex items-center justify-center shadow-inner">
                <div className="w-3 h-3 rounded-full bg-zinc-950" />
              </div>
            </div>
          </div>

          <div className="text-center space-y-1">
            <div className="text-sm font-semibold text-zinc-200 truncate max-w-60" title={name}>
              {name}
            </div>
            <div className="text-xs text-zinc-500">音频播放器</div>
          </div>

          <audio
            ref={audioRef}
            src={rawUrl}
            controls
            className="w-full h-10"
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
          />
        </div>
      </div>
    );
  }

  // 3. PDF 预览
  if (type === "pdf") {
    return (
      <div className="flex-1 h-full w-full bg-zinc-900">
        <iframe src={rawUrl} title={name} className="w-full h-full border-none" />
      </div>
    );
  }

  // 4. Word (.docx) 预览
  if (type === "docx") {
    return (
      <div className="flex-1 h-full overflow-auto bg-zinc-900 p-8 flex justify-center">
        <div
          className="bg-white text-zinc-900 max-w-3xl w-full p-10 rounded-lg shadow-xl prose prose-sm overflow-x-auto select-text"
          dangerouslySetInnerHTML={{ __html: docxHtml }}
        />
      </div>
    );
  }

  // 5. Excel (.xlsx) 预览
  if (type === "xlsx") {
    return (
      <div className="flex-1 h-full flex flex-col overflow-hidden bg-zinc-900 select-text">
        {/* 工作表 Tab 切换栏 */}
        <div className="flex items-center space-x-1 px-3 py-1.5 bg-zinc-950 border-b border-zinc-800 shrink-0 overflow-x-auto no-scrollbar">
          {sheets.map((s, idx) => (
            <button
              key={s.name}
              onClick={() => setActiveSheetIndex(idx)}
              className={`px-3 py-1 text-xs rounded transition whitespace-nowrap ${
                activeSheetIndex === idx
                  ? "bg-[#0078d4] text-white font-medium shadow"
                  : "bg-zinc-900 hover:bg-zinc-800 text-zinc-400"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>

        {/* 表格内容渲染 */}
        <div className="flex-1 overflow-auto p-4 bg-zinc-900">
          {sheets[activeSheetIndex] && (
            <div
              className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 text-xs text-zinc-200 overflow-x-auto [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-zinc-800 [&_th]:p-2 [&_th]:bg-zinc-900 [&_td]:border [&_td]:border-zinc-800 [&_td]:p-2"
              dangerouslySetInnerHTML={{ __html: sheets[activeSheetIndex].html }}
            />
          )}
        </div>
      </div>
    );
  }

  return null;
};
