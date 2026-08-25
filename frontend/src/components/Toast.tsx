import React, { useEffect } from "react";
import { useAppStore } from "../store/useAppStore";

export const Toast: React.FC = () => {
  const toast = useAppStore((state) => state.toast);
  const clearToast = useAppStore((state) => state.clearToast);

  useEffect(() => {
    if (!toast) return;

    const duration = toast.duration || (toast.isError ? 4000 : 3000);
    const timer = setTimeout(() => {
      clearToast();
    }, duration);

    return () => clearTimeout(timer);
  }, [toast, clearToast]);

  if (!toast) return null;

  return (
    <div className="fixed bottom-10 right-6 z-100 flex items-center space-x-2 px-4 py-2.5 bg-zinc-900 border border-zinc-700/80 rounded-lg shadow-2xl animate-fade-in select-none max-w-sm">
      <span className="shrink-0">
        {toast.isError ? (
          <svg className="w-4 h-4 text-red-500" viewBox="0 0 16 16" fill="currentColor">
            <path fillRule="evenodd" clipRule="evenodd" d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 1a6 6 0 1 1 0 12A6 6 0 0 1 8 2zM10.35 5.65L11.06 6.36 8.71 8.71 11.06 11.06 10.35 11.77 8 9.41 5.65 11.77 4.94 11.06 7.29 8.71 4.94 6.36 5.65 5.65 8 8 10.35 5.65z" />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-[#0078d4]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        )}
      </span>
      <span className="text-xs text-zinc-200 font-medium leading-relaxed">
        {toast.message}
      </span>
    </div>
  );
};
