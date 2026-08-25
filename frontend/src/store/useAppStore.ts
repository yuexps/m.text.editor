import { create } from "zustand";
import { API } from "../services/api";

export const WELCOME_PATH = "podnote://welcome";

export type PreviewType = "image" | "audio" | "pdf" | "docx" | "xlsx";

export interface TabItem {
  path: string;
  name: string;
  content: string;
  originalContent: string;
  encoding: string;
  originalEncoding: string;
  mtime: number;
  isNew: boolean;
  languageId: string;
  viewState: any; // Monaco Editor ICodeEditorViewState
  previewType?: PreviewType | null;
  isHugeFile?: boolean;
  isTruncated?: boolean;
}

export interface FileItem {
  name: string;
  path: string;
  isDir: boolean;
  size?: number;
  mtime?: number;
  isSymlink?: boolean;
}

export interface AppSettings {
  defaultOpenPath: string;
  pcAutoEditMode: boolean;
  fontSize: number;
  fontFamily: string;
  wordWrap: "on" | "off";
  minimap: boolean;
  readOnlyTail: boolean;
  tabSize: number;
  renderWhitespace: "none" | "boundary" | "all";
  editorTheme: "vs-dark" | "vs" | "hc-black";
  uiTheme: "dark" | "light";
  terminalFontSize: number;
  terminalCursorStyle: "block" | "bar";
  terminalCursorBlink: boolean;
  terminalUser: "root" | "current";
}

export interface ModalConfig {
  isOpen: boolean;
  title: string;
  message: string;
  isPrompt: boolean;
  defaultValue?: string;
  resolve?: (value: any) => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  defaultOpenPath: "",
  pcAutoEditMode: false,
  fontSize: 14,
  fontFamily: "Consolas, 'Courier New', monospace",
  wordWrap: "on",
  minimap: true,
  readOnlyTail: false,
  tabSize: 4,
  renderWhitespace: "none",
  editorTheme: "vs-dark",
  uiTheme: "dark",
  terminalFontSize: 13,
  terminalCursorStyle: "block",
  terminalCursorBlink: true,
  terminalUser: "current",
};

export const checkIsMobile = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

export const checkIsNarrowScreen = (): boolean => {
  return window.innerWidth <= 768;
};

interface AppState {
  // 核心状态
  workspacePath: string;
  workspaceFiles: FileItem[];
  tabs: TabItem[];
  activeTabPath: string;
  isEditMode: boolean;
  theme: "dark" | "light";
  
  // 设置状态
  settings: AppSettings;
  
  // 界面状态
  sidebarWidth: number;
  activeSidebarPanel: "explorer" | "search" | "settings" | null;
  activeBottomPanelTab: "problems" | "terminal" | null;
  bottomPanelHeight: number;
  isTouchBarUserEnabled: boolean;
  isFnosAvailable: boolean;

  problems: { severity: "error" | "warning"; message: string; line?: number; column?: number }[];
  toast: { message: string; isError: boolean; id: number; duration?: number } | null;
  modal: ModalConfig;

  // Actions
  setWorkspacePath: (path: string) => void;
  setWorkspaceFiles: (files: FileItem[]) => void;
  setEditMode: (isEdit: boolean) => void;
  setTheme: (theme: "dark" | "light") => void;
  setSidebarWidth: (width: number) => void;
  setActiveSidebarPanel: (panel: "explorer" | "search" | "settings" | null) => void;
  setActiveBottomPanelTab: (tab: "problems" | "terminal" | null) => void;
  setBottomPanelHeight: (height: number) => void;
  setTouchBarUserEnabled: (enabled: boolean | ((prev: boolean) => boolean)) => void;
  setIsFnosAvailable: (available: boolean) => void;
  
  // Settings Actions
  loadSettings: () => Promise<void>;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;

  // Tabs Actions
  openTab: (tab: Omit<TabItem, "viewState">, shouldSwitch?: boolean) => void;
  closeTab: (path: string) => void;
  setActiveTabPath: (path: string) => void;
  updateTabContent: (path: string, content: string) => void;
  updateTabEncoding: (path: string, encoding: string) => void;
  updateTabViewState: (path: string, viewState: any) => void;
  saveTabMetadata: (path: string, mtime: number, isNew: boolean, content: string, encoding?: string) => void;

  // UI Actions
  showToast: (message: string, isError?: boolean, duration?: number) => void;
  clearToast: () => void;
  setModal: (config: ModalConfig) => void;
  closeModal: () => void;
  addProblem: (problem: { severity: "error" | "warning"; message: string; line?: number; column?: number }) => void;
  setProblems: (problems: { severity: "error" | "warning"; message: string; line?: number; column?: number }[]) => void;
  clearProblems: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  workspacePath: "",
  workspaceFiles: [],
  tabs: [],
  activeTabPath: "",
  isEditMode: false,
  theme: "dark",
  settings: DEFAULT_SETTINGS,
  sidebarWidth: 260,
  activeSidebarPanel: "explorer",
  activeBottomPanelTab: null,
  bottomPanelHeight: 300,
  isTouchBarUserEnabled: false,
  isFnosAvailable: false,
  problems: [],
  toast: null,
  modal: {
    isOpen: false,
    title: "",
    message: "",
    isPrompt: false,
    defaultValue: "",
  },

  setWorkspacePath: (path) => set({ workspacePath: path }),
  setWorkspaceFiles: (files) => set({ workspaceFiles: files }),
  setEditMode: (isEdit) => set({ isEditMode: isEdit }),
  setTheme: (theme) => {
    set({ theme });
    const body = document.body;
    if (theme === "light") {
      body.classList.remove("theme-dark");
      body.classList.add("theme-light");
    } else {
      body.classList.remove("theme-light");
      body.classList.add("theme-dark");
    }
  },
  setSidebarWidth: (width) => set({ sidebarWidth: width }),
  setActiveSidebarPanel: (panel) => {
    // 窄屏下互斥：打开侧栏自动收起底栏
    if (panel && checkIsNarrowScreen()) {
      set({ activeSidebarPanel: panel, activeBottomPanelTab: null });
    } else {
      set({ activeSidebarPanel: panel });
    }
  },
  setActiveBottomPanelTab: (tab) => {
    // 窄屏下互斥：打开底栏自动收起侧栏
    if (tab && checkIsNarrowScreen()) {
      set({ activeBottomPanelTab: tab, activeSidebarPanel: null });
    } else {
      set({ activeBottomPanelTab: tab });
    }
  },
  setBottomPanelHeight: (height) => set({ bottomPanelHeight: height }),
  setTouchBarUserEnabled: (enabled) =>
    set((state) => ({
      isTouchBarUserEnabled: typeof enabled === "function" ? enabled(state.isTouchBarUserEnabled) : enabled,
    })),
  setIsFnosAvailable: (available) => set({ isFnosAvailable: available }),

  loadSettings: async () => {
    const isMobile = checkIsMobile();
    const clientType = isMobile ? "mobile" : "pc";
    
    const localDefaults = { ...DEFAULT_SETTINGS };
    if (isMobile) {
      localDefaults.fontSize = 13;
      localDefaults.minimap = false;
      localDefaults.terminalFontSize = 12;
      localDefaults.tabSize = 2;
    }

    try {
      const serverData = await API.getSettings(clientType);
      const merged = { ...localDefaults, ...serverData };
      set({ settings: merged, theme: merged.uiTheme });
      
      const body = document.body;
      if (merged.uiTheme === "light") {
        body.classList.remove("theme-dark");
        body.classList.add("theme-light");
      } else {
        body.classList.remove("theme-light");
        body.classList.add("theme-dark");
      }
    } catch (err) {
      set({ settings: localDefaults, theme: localDefaults.uiTheme });
    }
  },

  updateSetting: async (key, value) => {
    const { settings } = get();
    const updated = { ...settings, [key]: value };
    
    if (key === "uiTheme") {
      get().setTheme(value as "dark" | "light");
    }

    set({ settings: updated });

    const clientType = checkIsMobile() ? "mobile" : "pc";
    try {
      await API.saveSettings(updated, clientType);
    } catch (e) {}
  },

  openTab: (tab, shouldSwitch = true) => {
    const { tabs } = get();
    const exists = tabs.find((t) => t.path === tab.path);
    if (!exists) {
      set({
        tabs: [...tabs, { ...tab, viewState: null }],
        activeTabPath: shouldSwitch ? tab.path : get().activeTabPath,
      });
    } else {
      if (shouldSwitch) {
        set({ activeTabPath: tab.path });
      }
    }
  },

  closeTab: (path) => {
    const { tabs, activeTabPath } = get();
    let nextTabs = tabs.filter((t) => t.path !== path);
    let nextActivePath = activeTabPath;

    if (nextTabs.length === 0) {
      nextTabs = [
        {
          path: WELCOME_PATH,
          name: "主页",
          content: "",
          originalContent: "",
          encoding: "utf-8",
          originalEncoding: "utf-8",
          mtime: 0,
          isNew: false,
          languageId: "plaintext",
          viewState: null,
        },
      ];
      nextActivePath = WELCOME_PATH;
    } else if (activeTabPath === path) {
      const closedIndex = tabs.findIndex((t) => t.path === path);
      const nextIndex = Math.min(closedIndex, nextTabs.length - 1);
      nextActivePath = nextTabs[nextIndex].path;
    }

    set({ tabs: nextTabs, activeTabPath: nextActivePath });
  },

  setActiveTabPath: (path) => set({ activeTabPath: path }),

  updateTabContent: (path, content) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.path === path ? { ...t, content } : t)),
    }));
  },

  updateTabEncoding: (path, encoding) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.path === path ? { ...t, encoding } : t)),
    }));
  },

  updateTabViewState: (path, viewState) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.path === path ? { ...t, viewState } : t)),
    }));
  },

  saveTabMetadata: (path, mtime, isNew, content, encoding) => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.path === path
          ? {
              ...t,
              mtime,
              isNew,
              originalContent: content,
              content,
              originalEncoding: encoding || t.encoding,
              encoding: encoding || t.encoding,
            }
          : t
      ),
    }));
  },

  showToast: (message, isError = false, duration = 3000) => {
    const id = Date.now();
    set({ toast: { message, isError, id, duration } });
  },

  clearToast: () => set({ toast: null }),

  setModal: (config) => set({ modal: config }),
  closeModal: () => set((state) => ({ modal: { ...state.modal, isOpen: false } })),
  
  addProblem: (problem) => set((state) => ({ problems: [...state.problems, problem] })),
  setProblems: (problems) => set({ problems }),
  clearProblems: () => set({ problems: [] }),
}));

// 辅助方法：全局 Promise 调用的自定义 Confirm
export const showConfirm = (message: string, title = "提示"): Promise<boolean> => {
  return new Promise((resolve) => {
    useAppStore.getState().setModal({
      isOpen: true,
      title,
      message,
      isPrompt: false,
      resolve: (res) => resolve(Boolean(res)),
    });
  });
};

// 辅助方法：全局 Promise 调用的自定义 Prompt
export const showPrompt = (message: string, defaultValue = "", title = "提示"): Promise<string | null> => {
  return new Promise((resolve) => {
    useAppStore.getState().setModal({
      isOpen: true,
      title,
      message,
      isPrompt: true,
      defaultValue,
      resolve: (res) => resolve(res === null ? null : String(res)),
    });
  });
};
