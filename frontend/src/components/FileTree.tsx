import React, { useState, useEffect, useRef } from "react";
import { useAppStore, checkIsNarrowScreen, checkIsMobile, showPrompt } from "../store/useAppStore";
import type { FileItem } from "../store/useAppStore";
import { FileIO } from "../services/fileIO";
import { API } from "../services/api";
import { FnosSDK } from "../services/fnosSDK";

const getFileIcon = (name: string, isDir: boolean, isSymlink?: boolean) => {
  if (isSymlink) {
    return (
      <span className="mr-2 text-cyan-400 shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24">
          <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h8v4h4v12zm-6-3c-1.1 0-2-.9-2-2V9.5c0-.28.22-.5.5-.5s.5.22.5.5V15h2V9.5a2.5 2.5 0 0 0-5 0V15c0 2.21 1.79 4 4 4s4-1.79 4-4v-4h-2v4c0 1.1-.9 2-2 2z" fill="currentColor" />
        </svg>
      </span>
    );
  }

  if (isDir) {
    return (
      <span className="mr-2 text-amber-400 shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24">
          <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 3v4a1 1 0 0 0 1 1h4" />
            <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
            <path d="M9 9h1" />
            <path d="M9 13h6" />
            <path d="M9 17h6" />
          </g>
        </svg>
      </span>
    );
  }

  const ext = name.split(".").pop()?.toLowerCase() || "";

  // 1. 图片
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico"].includes(ext)) {
    return (
      <span className="mr-2 text-purple-400 shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 384 512">
          <path d="M369.9 97.9L286 14C277 5 264.8-.1 252.1-.1H48C21.5 0 0 21.5 0 48v416c0 26.5 21.5 48 48 48h288c26.5 0 48-21.5 48-48V131.9c0-12.7-5.1-25-14.1-34zM332.1 128H256V51.9l76.1 76.1zM48 464V48h160v104c0 13.3 10.7 24 24 24h104v288H48zm32-48h224V288l-23.5-23.5c-4.7-4.7-12.3-4.7-17 0L176 352l-39.5-39.5c-4.7-4.7-12.3-4.7-17 0L80 352v64zm48-240c-26.5 0-48 21.5-48 48s21.5 48 48 48s48-21.5 48-48s-21.5-48-48-48z" fill="currentColor" />
        </svg>
      </span>
    );
  }

  // 2. 音频
  if (["mp3", "wav", "ogg", "aac", "flac"].includes(ext)) {
    return (
      <span className="mr-2 text-pink-400 shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24">
          <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 3v4a1 1 0 0 0 1 1h4" />
            <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
            <circle cx="11" cy="16" r="1" />
            <path d="M12 16v-5l2 1" />
          </g>
        </svg>
      </span>
    );
  }

  // 3. PDF
  if (ext === "pdf") {
    return (
      <span className="mr-2 text-red-500 shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 384 512">
          <path d="M369.9 97.9L286 14C277 5 264.8-.1 252.1-.1H48C21.5 0 0 21.5 0 48v416c0 26.5 21.5 48 48 48h288c26.5 0 48-21.5 48-48V131.9c0-12.7-5.1-25-14.1-34zM332.1 128H256V51.9l76.1 76.1zM48 464V48h160v104c0 13.3 10.7 24 24 24h104v288H48zm250.2-143.7c-12.2-12-47-8.7-64.4-6.5c-17.2-10.5-28.7-25-36.8-46.3c3.9-16.1 10.1-40.6 5.4-56c-4.2-26.2-37.8-23.6-42.6-5.9c-4.4 16.1-.4 38.5 7 67.1c-10 23.9-24.9 56-35.4 74.4c-20 10.3-47 26.2-51 46.2c-3.3 15.8 26 55.2 76.1-31.2c22.4-7.4 46.8-16.5 68.4-20.1c18.9 10.2 41 17 55.8 17c25.5 0 28-28.2 17.5-38.7z" fill="currentColor" />
        </svg>
      </span>
    );
  }

  // 4. Word (.docx)
  if (ext === "docx" || ext === "doc") {
    return (
      <span className="mr-2 text-blue-500 shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 384 512">
          <path d="M369.9 97.9L286 14C277 5 264.8-.1 252.1-.1H48C21.5 0 0 21.5 0 48v416c0 26.5 21.5 48 48 48h288c26.5 0 48-21.5 48-48V131.9c0-12.7-5.1-25-14.1-34zM332.1 128H256V51.9l76.1 76.1zM48 464V48h160v104c0 13.3 10.7 24 24 24h104v288H48zm220.1-208c-5.7 0-10.6 4-11.7 9.5c-20.6 97.7-20.4 95.4-21 103.5c-.2-1.2-.4-2.6-.7-4.3c-.8-5.1.3.2-23.6-99.5c-1.3-5.4-6.1-9.2-11.7-9.2h-13.3c-5.5 0-10.3 3.8-11.7 9.1c-24.4 99-24 96.2-24.8 103.7c-.1-1.1-.2-2.5-.5-4.2c-.7-5.2-14.1-73.3-19.1-99c-1.1-5.6-6-9.7-11.8-9.7h-16.8c-7.8 0-13.5 7.3-11.7 14.8c8 32.6 26.7 109.5 33.2 136c1.3 5.4 6.1 9.1 11.7 9.1h25.2c5.5 0 10.3-3.7 11.6-9.1l17.9-71.4c1.5-6.2 2.5-12 3-17.3l2.9 17.3c.1.4 12.6 50.5 17.9 71.4c1.3 5.3 6.1 9.1 11.6 9.1h24.7c5.5 0 10.3-3.7 11.6-9.1c20.8-81.9 30.2-119 34.5-136c1.9-7.6-3.8-14.9-11.6-14.9h-15.8z" fill="currentColor" />
        </svg>
      </span>
    );
  }

  // 5. Excel (.xlsx)
  if (ext === "xlsx" || ext === "xls" || ext === "csv") {
    return (
      <span className="mr-2 text-emerald-500 shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24">
          <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h8v4h4v12zM8.8 17.5l2.2-3.5l-2-3.5h1.9l1.1 2.2l1.1-2.2H15l-2.1 3.5l2.2 3.5h-1.9L12 15.2l-1.2 2.3H8.8z" fill="currentColor" />
        </svg>
      </span>
    );
  }

  // 6. Markdown
  if (["md", "markdown"].includes(ext)) {
    return (
      <span className="mr-2 text-amber-500 shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 1024 1024">
          <path d="M854.6 288.6L639.4 73.4c-6-6-14.1-9.4-22.6-9.4H192c-17.7 0-32 14.3-32 32v832c0 17.7 14.3 32 32 32h640c17.7 0 32-14.3 32-32V311.3c0-8.5-3.4-16.7-9.4-22.7zM790.2 326H602V137.8L790.2 326zm1.8 562H232V136h302v216a42 42 0 0 0 42 42h216v494zM429 481.2c-1.9-4.4-6.2-7.2-11-7.2h-35c-6.6 0-12 5.4-12 12v272c0 6.6 5.4 12 12 12h27.1c6.6 0 12-5.4 12-12V582.1l66.8 150.2a12 12 0 0 0 11 7.1H524c4.7 0 9-2.8 11-7.1l66.8-150.6V758c0 6.6 5.4 12 12 12H641c6.6 0 12-5.4 12-12V486c0-6.6-5.4-12-12-12h-34.7c-4.8 0-9.1 2.8-11 7.2l-83.1 191l-83.2-191z" fill="currentColor" />
        </svg>
      </span>
    );
  }

  // 7. 代码文件配色
  const colorMap: Record<string, string> = {
    js: "text-yellow-400",
    ts: "text-blue-400",
    jsx: "text-cyan-400",
    tsx: "text-cyan-400",
    go: "text-cyan-500",
    py: "text-emerald-400",
    html: "text-orange-500",
    css: "text-sky-400",
    scss: "text-pink-400",
    json: "text-amber-300",
    sh: "text-green-400",
  };
  const color = colorMap[ext] || "text-zinc-400";

  return (
    <span className={`mr-2 ${color} shrink-0`}>
      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24">
        <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 3v4a1 1 0 0 0 1 1h4" />
          <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
        </g>
      </svg>
    </span>
  );
};

interface TreeNodeProps {
  file: FileItem;
  level: number;
  expandedPaths: Set<string>;
  toggleExpand: (path: string) => void;
  loadedDirectories: Record<string, FileItem[]>;
  newFileParent: string | null;
  setNewFileParent: (path: string | null) => void;
  onSubmitNewFile: (parentPath: string, name: string) => Promise<void>;
}

const TreeNode: React.FC<TreeNodeProps> = ({
  file,
  level,
  expandedPaths,
  toggleExpand,
  loadedDirectories,
  newFileParent,
  setNewFileParent,
  onSubmitNewFile,
}) => {
  const activeTabPath = useAppStore((state) => state.activeTabPath);
  const setActiveSidebarPanel = useAppStore((state) => state.setActiveSidebarPanel);
  const isExpanded = expandedPaths.has(file.path);
  const children = loadedDirectories[file.path] || [];
  const isCreatingHere = newFileParent === file.path;
  const [newFileName, setNewFileName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isCreatingHere && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCreatingHere]);

  const handleNodeClick = () => {
    if (file.isDir) {
      toggleExpand(file.path);
    } else {
      FileIO.loadFile(file.path);
      if (checkIsNarrowScreen()) {
        setActiveSidebarPanel(null);
      }
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    FnosSDK.openFileManager(file.path, file.isDir);
  };

  const handleNewFileHere = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNewFileParent(file.path);
    if (!expandedPaths.has(file.path)) {
      toggleExpand(file.path);
    }
  };

  const handleInputKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      const name = newFileName.trim();
      if (name) {
        await onSubmitNewFile(file.path, name);
      }
      setNewFileParent(null);
      setNewFileName("");
    } else if (e.key === "Escape") {
      setNewFileParent(null);
      setNewFileName("");
    }
  };

  const isSelected = activeTabPath === file.path;

  return (
    <div className="select-none text-xs">
      <div
        onClick={handleNodeClick}
        onContextMenu={handleContextMenu}
        title={`${file.path}\n(右键在 FNOS 文件管理器中定位)`}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        className={`group flex items-center py-1.5 px-2 cursor-pointer hover:bg-zinc-800 transition-colors duration-150 rounded ${
          isSelected
            ? "bg-zinc-800 text-[#0078d4] font-medium border-l-2 border-[#0078d4]"
            : "text-zinc-300"
        }`}
      >
        <span className="w-4 h-4 flex items-center justify-center mr-1 text-zinc-500 shrink-0">
          {file.isDir ? (
            <svg
              className={`w-3.5 h-3.5 transition-transform duration-150 ${isExpanded ? "rotate-90" : ""}`}
              viewBox="0 0 16 16"
              fill="currentColor"
            >
              <path fillRule="evenodd" clipRule="evenodd" d="M10.072 8.024L5.707 3.659l.707-.707 5.072 5.072-5.072 5.072-.707-.707 4.365-4.365z" />
            </svg>
          ) : (
            <span className="w-3.5" />
          )}
        </span>

        {getFileIcon(file.name, file.isDir, file.isSymlink)}

        <span className="truncate flex-1" title={file.name}>
          {file.name}
        </span>

        {file.isDir && (
          <button
            onClick={handleNewFileHere}
            title="在此目录下新建文件"
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white transition-all ml-1"
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        )}
      </div>

      {isCreatingHere && (
        <div style={{ paddingLeft: `${(level + 1) * 12 + 24}px` }} className="py-1 pr-2">
          <input
            ref={inputRef}
            type="text"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            onKeyDown={handleInputKeyDown}
            onBlur={() => {
              setNewFileParent(null);
              setNewFileName("");
            }}
            placeholder="输入文件名按 Enter 创建"
            className="w-full bg-zinc-950 text-xs px-2 py-1 border border-[#0078d4] rounded outline-none text-zinc-200"
          />
        </div>
      )}

      {file.isDir && isExpanded && (
        <div>
          {children.length === 0 ? (
            <div
              style={{ paddingLeft: `${(level + 1) * 12 + 24}px` }}
              className="py-1 text-[11px] text-zinc-600 italic"
            >
              空文件夹
            </div>
          ) : (
            children.map((subFile) => (
              <TreeNode
                key={subFile.path}
                file={subFile}
                level={level + 1}
                expandedPaths={expandedPaths}
                toggleExpand={toggleExpand}
                loadedDirectories={loadedDirectories}
                newFileParent={newFileParent}
                setNewFileParent={setNewFileParent}
                onSubmitNewFile={onSubmitNewFile}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

export const FileTree: React.FC = () => {
  const workspacePath = useAppStore((state) => state.workspacePath);
  const workspaceFiles = useAppStore((state) => state.workspaceFiles);
  const activeTabPath = useAppStore((state) => state.activeTabPath);
  const showToast = useAppStore((state) => state.showToast);

  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [loadedDirectories, setLoadedDirectories] = useState<Record<string, FileItem[]>>({});
  const [newFileParent, setNewFileParent] = useState<string | null>(null);
  const [isCreatingRoot, setIsCreatingRoot] = useState(false);
  const [rootNewFileName, setRootNewFileName] = useState("");
  const rootInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isCreatingRoot && rootInputRef.current) {
      rootInputRef.current.focus();
    }
  }, [isCreatingRoot]);

  const toggleExpand = async (path: string) => {
    const next = new Set(expandedPaths);
    if (next.has(path)) {
      next.delete(path);
      setExpandedPaths(next);
    } else {
      next.add(path);
      setExpandedPaths(next);
      if (!loadedDirectories[path]) {
        try {
          const res = await API.list(path);
          const children = res.files.map((f) => ({
            name: f.name,
            path: f.path,
            isDir: f.is_dir,
            size: f.size,
            mtime: f.mtime,
            isSymlink: f.is_symlink,
          }));
          setLoadedDirectories((prev) => ({ ...prev, [path]: children }));
        } catch (e) {}
      }
    }
  };

  const handleRefreshWorkspace = async () => {
    if (!workspacePath) return;
    await FileIO.loadWorkspace(workspacePath);
    setLoadedDirectories({});
    showToast("工作区目录已刷新");
  };

  const handleOpenInFnos = () => {
    const targetPath = (activeTabPath && !activeTabPath.startsWith("podnote://")) ? activeTabPath : workspacePath;
    if (!targetPath) {
      showToast("尚未打开文件或工作区", true);
      return;
    }
    FnosSDK.openFileManager(targetPath, !!workspacePath && (!activeTabPath || activeTabPath.startsWith("podnote://")));
  };

  const handleTriggerNewFile = async () => {
    if (!workspacePath) {
      showToast("尚未打开工作区", true);
      return;
    }

    if (checkIsMobile()) {
      const workspaceName = workspacePath.split(/[/\\]/).pop() || "工作区";
      const filename = await showPrompt(`请输入文件名 (./${workspaceName}/)：`, "", "新建文件");
      if (filename) {
        await handleSubmitNewFile(workspacePath, filename);
      }
      return;
    }

    setIsCreatingRoot(true);
  };

  const handleSubmitNewFile = async (parentPath: string, name: string) => {
    const isWin = parentPath.includes("\\");
    const sep = isWin ? "\\" : "/";
    const fullPath = `${parentPath.replace(/[/\\]+$/, "")}${sep}${name}`;

    try {
      await API.newFile(fullPath);
      showToast("文件创建成功");
      FileIO.loadFile(fullPath);

      if (parentPath === workspacePath) {
        await FileIO.loadWorkspace(workspacePath);
      } else {
        const res = await API.list(parentPath);
        const children = res.files.map((f) => ({
          name: f.name,
          path: f.path,
          isDir: f.is_dir,
          size: f.size,
          mtime: f.mtime,
          isSymlink: f.is_symlink,
        }));
        setLoadedDirectories((prev) => ({ ...prev, [parentPath]: children }));
      }
    } catch (err: any) {
      showToast(`创建失败: ${err.message}`, true);
    }
  };

  return (
    <div className="flex-1 h-full flex flex-col overflow-hidden bg-zinc-950 text-zinc-300">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 shrink-0">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 truncate max-w-30">
          {workspacePath ? workspacePath.split(/[/\\]/).pop() || "工作区" : "资源管理器"}
        </span>

        <div className="flex items-center space-x-1">
          {/* 在 FNOS 文件管理器中定位 */}
          <button
            onClick={handleOpenInFnos}
            title="在 FNOS 文件管理器中定位"
            className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 32 32">
              <path d="M25.707 17.293l-5-5A1 1 0 0 0 20 12h-6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V18a1 1 0 0 0-.293-.707zM23.586 18H20v-3.586zM14 28V14h4v4a2 2 0 0 0 2 2h4v8z" fill="currentColor" />
              <path d="M8 27H4a2.002 2.002 0 0 1-2-2V5a2.002 2.002 0 0 1 2-2h7.586A1.986 1.986 0 0 1 13 3.586L16.414 7H28a2.002 2.002 0 0 1 2 2v8h-2V9H15.586l-4-4H4v20h4z" fill="currentColor" />
            </svg>
          </button>

          {/* 新建文件 */}
          <button
            onClick={handleTriggerNewFile}
            disabled={!workspacePath}
            title="新建文件"
            className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition disabled:opacity-30"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 3v4a1 1 0 0 0 1 1h4" />
              <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
              <path d="M12 11v6" />
              <path d="M9 14h6" />
            </svg>
          </button>

          {/* 刷新 */}
          <button
            onClick={handleRefreshWorkspace}
            disabled={!workspacePath}
            title="刷新工作区"
            className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition disabled:opacity-30"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 11A8.1 8.1 0 0 0 4.5 9M4 5v4h4" />
              <path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" />
            </svg>
          </button>
        </div>
      </div>

      {/* 根目录新建输入框 (PC端) */}
      {isCreatingRoot && (
        <div className="p-2 border-b border-zinc-800 bg-zinc-900">
          <input
            ref={rootInputRef}
            type="text"
            value={rootNewFileName}
            onChange={(e) => setRootNewFileName(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key === "Enter") {
                const name = rootNewFileName.trim();
                if (name && workspacePath) {
                  await handleSubmitNewFile(workspacePath, name);
                }
                setIsCreatingRoot(false);
                setRootNewFileName("");
              } else if (e.key === "Escape") {
                setIsCreatingRoot(false);
                setRootNewFileName("");
              }
            }}
            onBlur={() => {
              setIsCreatingRoot(false);
              setRootNewFileName("");
            }}
            placeholder="输入文件名按 Enter 创建"
            className="w-full bg-zinc-950 text-xs px-2 py-1 border border-[#0078d4] rounded outline-none text-zinc-200"
          />
        </div>
      )}

      {/* 树节点列表 */}
      <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
        {!workspacePath ? (
          <div className="p-4 text-center text-xs text-zinc-500">工作区为空</div>
        ) : workspaceFiles.length === 0 ? (
          <div className="p-4 text-center text-xs text-zinc-500">工作区为空</div>
        ) : (
          workspaceFiles.map((file) => (
            <TreeNode
              key={file.path}
              file={file}
              level={0}
              expandedPaths={expandedPaths}
              toggleExpand={toggleExpand}
              loadedDirectories={loadedDirectories}
              newFileParent={newFileParent}
              setNewFileParent={setNewFileParent}
              onSubmitNewFile={handleSubmitNewFile}
            />
          ))
        )}
      </div>
    </div>
  );
};
