import { API } from "./api";
import { useAppStore, type PreviewType, checkIsMobile, WELCOME_PATH } from "../store/useAppStore";
import { FnosSDK } from "./fnosSDK";

let loadAbortController: AbortController | null = null;
let foregroundLoadSeq = 0;
let workspaceLoadSeq = 0;

const PREVIEW_EXT_MAP: Record<string, PreviewType> = {
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  svg: "image",
  bmp: "image",
  ico: "image",
  mp3: "audio",
  wav: "audio",
  ogg: "audio",
  pdf: "pdf",
  docx: "docx",
  xlsx: "xlsx",
};

export function getFilePreviewType(path: string): PreviewType | null {
  if (!path || path.startsWith("podnote://")) return null;
  const ext = path.split(".").pop()?.toLowerCase() || "";
  return PREVIEW_EXT_MAP[ext] || null;
}

export const FileIO = {
  /**
   * 加载工作区目录列表
   */
  async loadWorkspace(dirPath: string): Promise<void> {
    if (!dirPath || dirPath.startsWith("podnote://")) return;
    const requestId = ++workspaceLoadSeq;
    const store = useAppStore.getState();
    
    try {
      const data = await API.list(dirPath);
      if (requestId !== workspaceLoadSeq) return;
      
      const files = data.files.map((f) => ({
        name: f.name,
        path: f.path,
        isDir: f.is_dir,
        size: f.size,
        mtime: f.mtime,
        isSymlink: f.is_symlink,
      }));
      
      store.setWorkspacePath(data.path);
      store.setWorkspaceFiles(files);
      store.showToast("工作区加载成功");
    } catch (err: any) {
      if (requestId !== workspaceLoadSeq) return;
      store.showToast("无法读取工作区: " + err.message, true);
    }
  },

  /**
   * 加载并打开文件内容 (自动加入标签页)
   */
  async loadFile(
    filePath: string,
    isManualEncoding = false,
    shouldSwitch = true
  ): Promise<void> {
    if (!filePath || filePath === WELCOME_PATH) {
      const store = useAppStore.getState();
      store.openTab({
        path: WELCOME_PATH,
        name: "主页",
        content: "",
        originalContent: "",
        encoding: "utf-8",
        originalEncoding: "utf-8",
        mtime: 0,
        isNew: false,
        languageId: "plaintext",
      }, shouldSwitch);
      return;
    }

    const store = useAppStore.getState();
    const name = filePath.split(/[/\\]/).pop() || filePath;
    const previewType = getFilePreviewType(filePath);

    // 如果是多媒体/文档只读预览文件，直接以预览 Tab 形式开启，无需 Monaco 文本读取
    if (previewType) {
      const existingTab = store.tabs.find((t) => t.path === filePath);
      if (existingTab) {
        if (shouldSwitch) store.setActiveTabPath(filePath);
        return;
      }

      store.openTab({
        path: filePath,
        name,
        content: "",
        originalContent: "",
        encoding: "utf-8",
        originalEncoding: "utf-8",
        mtime: Date.now(),
        isNew: false,
        languageId: "plaintext",
        previewType,
      }, shouldSwitch);

      if (shouldSwitch) store.setActiveTabPath(filePath);
      return;
    }

    // 文本文件：如果已经打开直接切换
    const existingTab = store.tabs.find((t) => t.path === filePath);
    if (existingTab && !isManualEncoding) {
      if (shouldSwitch) store.setActiveTabPath(filePath);
      return;
    }

    if (loadAbortController && shouldSwitch) {
      loadAbortController.abort();
    }

    const controller = new AbortController();
    if (shouldSwitch) {
      loadAbortController = controller;
    }

    const requestId = ++foregroundLoadSeq;
    const signal = controller.signal;

    const isCurrentRequest = () => {
      return (
        !shouldSwitch ||
        (loadAbortController === controller &&
          requestId === foregroundLoadSeq &&
          !signal.aborted)
      );
    };

    const activeTab = store.tabs.find((t) => t.path === store.activeTabPath);
    const targetEncoding = isManualEncoding && activeTab ? activeTab.encoding : "utf-8";

    try {
      let data = await API.read(filePath, targetEncoding, signal);
      if (!isCurrentRequest()) return;

      // 编码自动探测重载
      if (
        !isManualEncoding &&
        data.encoding &&
        data.encoding.toLowerCase() !== targetEncoding.toLowerCase()
      ) {
        store.showToast(`检测到文件编码为 ${data.encoding.toUpperCase()}，已为您自动重载`);
        data = await API.read(filePath, data.encoding, signal);
        if (!isCurrentRequest()) return;
      }

      const content = data.content ?? "";

      // 大文件/截断提示 (6000ms 持续时间)
      if (data.is_truncated) {
        store.showToast("文件超过 50MB，为保证性能仅截断读取末尾 2MB (只读)", true, 6000);
      } else if (data.is_huge_file) {
        store.showToast("文件较大 (超过 20MB)，已自动关闭语法高亮并启用只读模式", false, 6000);
      }

      store.openTab({
        path: filePath,
        name,
        content,
        originalContent: content,
        encoding: data.encoding || targetEncoding,
        originalEncoding: data.encoding || targetEncoding,
        mtime: data.mtime,
        isNew: false,
        languageId: data.language || "plaintext",
        isHugeFile: data.is_huge_file,
        isTruncated: data.is_truncated,
      }, shouldSwitch);

      if (!shouldSwitch) {
        store.showToast(`文件 "${name}" 已在后台加载完成`);
      } else {
        store.setActiveTabPath(filePath);
      }

      // PC 端根据配置自动切换编辑模式
      if (store.settings.pcAutoEditMode && !checkIsMobile() && !data.is_huge_file && !data.is_truncated) {
        store.setEditMode(true);
      }
    } catch (err: any) {
      if (err.name === "AbortError") return;
      if (!isCurrentRequest()) return;
      store.showToast(`读取失败: ${err.message}`, true);
    } finally {
      if (shouldSwitch && loadAbortController === controller) {
        loadAbortController = null;
      }
    }
  },

  /**
   * 物理保存当前标签页
   */
  async saveFile(editorValue: string): Promise<void> {
    const store = useAppStore.getState();
    const activePath = store.activeTabPath;
    const activeTab = store.tabs.find((t) => t.path === activePath);
    
    if (!activePath || !activeTab || !store.isEditMode || activePath.startsWith("podnote://")) return;

    if (activeTab.isHugeFile || activeTab.isTruncated) {
      store.showToast("大文件或截断文件处于只读保护状态，禁止存盘", true);
      return;
    }

    store.showToast("正在保存...");
    try {
      const data = await API.save(
        activePath,
        editorValue,
        activeTab.encoding,
        activeTab.mtime
      );

      store.saveTabMetadata(activePath, data.mtime, false, editorValue, activeTab.encoding);
      store.showToast("保存成功");

      // 同步 FNOS 退出提示状态
      const remainingDirty = store.tabs.some(
        (t) =>
          t.path !== activePath &&
          (t.content !== t.originalContent || t.encoding !== t.originalEncoding)
      );
      FnosSDK.syncExitPageTipsState(remainingDirty);
    } catch (err: any) {
      store.showToast(`保存失败: ${err.message}`, true);
      throw err;
    }
  },

  /**
   * 新建文件预检
   */
  async createNewFile(filePath: string): Promise<void> {
    if (!filePath || filePath.startsWith("podnote://")) {
      useAppStore.getState().showToast("请输入有效的文件绝对路径", true);
      return;
    }

    const store = useAppStore.getState();
    const existingTab = store.tabs.find((t) => t.path === filePath);
    if (existingTab) {
      store.setActiveTabPath(filePath);
      return;
    }

    try {
      const data = await API.checkCreate(filePath);
      const name = filePath.split(/[/\\]/).pop() || filePath;

      store.openTab({
        path: filePath,
        name,
        content: "",
        originalContent: "",
        encoding: "utf-8",
        originalEncoding: "utf-8",
        mtime: 0,
        isNew: true,
        languageId: data.language || "plaintext",
      });
      
      store.setActiveTabPath(filePath);
      store.setEditMode(true);
      store.showToast("路径验证通过，保存后将自动在物理端创建文件");
    } catch (err: any) {
      store.showToast(`无法新建: ${err.message}`, true);
    }
  },

  /**
   * 手动路径输入智能打开
   */
  async handleManualOpen(pathInput: string): Promise<void> {
    const path = pathInput.trim();
    if (!path) {
      useAppStore.getState().showToast("请输入有效的目录或文件路径", true);
      return;
    }

    const looksLikeFile = /\.[a-zA-Z0-9]+$/.test(path.split(/[/\\]/).pop() || "");
    if (looksLikeFile) {
      const lastSlash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
      if (lastSlash !== -1) {
        const dir = path.substring(0, lastSlash);
        await this.loadWorkspace(dir);
      }
      await this.loadFile(path);
    } else {
      try {
        await this.loadWorkspace(path);
        useAppStore.getState().setActiveSidebarPanel("explorer");
      } catch (err) {
        await this.loadFile(path);
      }
    }
  }
};
