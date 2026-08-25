import React, { useEffect, useRef, useState } from "react";
import { marked } from "marked";
import { loader } from "@monaco-editor/react";

interface MarkdownPreviewProps {
  content: string;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onScroll: () => void;
  onMouseEnter?: () => void;
}

export const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({
  content,
  scrollRef,
  onScroll,
  onMouseEnter,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [debouncedContent, setDebouncedContent] = useState(content);

  // 300ms 渲染防抖
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedContent(content);
    }, 300);

    return () => clearTimeout(timer);
  }, [content]);

  useEffect(() => {
    if (!containerRef.current) return;
    let isCurrent = true;

    const isCanceled = (err: any) => {
      if (!err) return false;
      if (err === "Canceled" || err.message === "Canceled" || err.name === "Canceled") return true;
      if (typeof err.message === "string" && err.message.includes("Canceled")) return true;
      if (typeof err.toString === "function" && err.toString().includes("Canceled")) return true;
      return false;
    };

    const highlightCodeBlocks = (monacoInstance: any) => {
      if (!containerRef.current) return;
      containerRef.current.querySelectorAll("pre code").forEach((el) => {
        if (!isCurrent) return;
        const langClass = el.className || "";
        const lang = langClass.replace("language-", "") || "plaintext";
        
        monacoInstance.editor.colorize(el.textContent || "", lang, {})
          .then((highlightedHtml: string) => {
            if (isCurrent && el.isConnected) {
              el.innerHTML = highlightedHtml;
            }
          })
          .catch((err: any) => {
            if (!isCanceled(err)) {
              console.error("[Markdown] 代码高亮着色失败:", err);
            }
          });
      });
    };

    const renderHtml = (html: string) => {
      if (containerRef.current && isCurrent) {
        containerRef.current.innerHTML = html;
        loader.init().then((monacoInstance) => {
          if (isCurrent) {
            highlightCodeBlocks(monacoInstance);
          }
        }).catch((err) => {
          if (isCurrent) {
            console.error("[Markdown] Monaco 实例加载失败:", err);
          }
        });
      }
    };

    try {
      const parsed = marked.parse(debouncedContent, { breaks: true, gfm: true });
      if (parsed instanceof Promise) {
        parsed.then((html) => {
          if (isCurrent) renderHtml(html);
        }).catch((err) => {
          if (isCurrent && containerRef.current) {
            containerRef.current.innerHTML = `<div class="text-red-500 p-3">Markdown 解析失败: ${err.message}</div>`;
          }
        });
      } else {
        renderHtml(parsed);
      }
    } catch (err) {
      if (containerRef.current) {
        containerRef.current.innerHTML = `<div class="text-red-500 p-3">Markdown 解析失败: ${(err as Error).message}</div>`;
      }
    }

    return () => {
      isCurrent = false;
    };
  }, [debouncedContent]);

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      onMouseEnter={onMouseEnter}
      onWheel={onMouseEnter}
      className="flex-1 min-w-0 h-full overflow-y-auto bg-zinc-950 px-6 py-5 border-l border-zinc-800 text-sm prose prose-invert select-text markdown-body"
      style={{
        color: "#d4d4d4",
        lineHeight: "1.6",
      }}
    >
      <div ref={containerRef} />
    </div>
  );
};
