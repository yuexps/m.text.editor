import React, { useState, useEffect, useRef } from "react";
import { useAppStore } from "../store/useAppStore";

export const ConfirmModal: React.FC = () => {
  const modal = useAppStore((state) => state.modal);
  const closeModal = useAppStore((state) => state.closeModal);

  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (modal.isOpen) {
      setInputValue(modal.defaultValue || "");
      if (modal.isPrompt) {
        setTimeout(() => {
          inputRef.current?.focus();
          inputRef.current?.select();
        }, 50);
      }
    }
  }, [modal.isOpen, modal.defaultValue, modal.isPrompt]);

  if (!modal.isOpen) return null;

  const handleOk = () => {
    if (modal.resolve) {
      modal.resolve(modal.isPrompt ? inputValue.trim() : true);
    }
    closeModal();
  };

  const handleCancel = () => {
    if (modal.resolve) {
      modal.resolve(modal.isPrompt ? null : false);
    }
    closeModal();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleOk();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) handleCancel();
      }}
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-100 p-4 select-none animate-fade-in"
    >
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden text-xs text-zinc-300">
        {/* 头部标题 */}
        <div className="px-4 py-3 bg-zinc-950 border-b border-zinc-800 font-semibold text-zinc-200">
          {modal.title || "提示"}
        </div>

        {/* 提示内容 */}
        <div className="p-4 space-y-3">
          <div className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">
            {modal.message}
          </div>

          {/* 输入框 (Prompt 模式) */}
          {modal.isPrompt && (
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-zinc-950 text-zinc-200 border border-zinc-700 focus:border-[#0078d4] outline-none text-xs px-3 py-2 rounded transition"
              autoComplete="off"
            />
          )}
        </div>

        {/* 底部操作按钮 */}
        <div className="px-4 py-3 bg-zinc-950/60 border-t border-zinc-800 flex justify-end space-x-2">
          <button
            onClick={handleCancel}
            className="px-3.5 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition font-medium text-xs"
          >
            取消
          </button>
          <button
            onClick={handleOk}
            className="px-4 py-1.5 rounded bg-[#0078d4] hover:bg-[#1e85d9] text-white transition font-semibold text-xs shadow-md shadow-blue-500/10"
          >
            确定
          </button>
        </div>
      </div>
    </div>
  );
};
