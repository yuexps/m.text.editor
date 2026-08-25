import TrimApp, { type FilePickerParams } from "@trimjs/web-app";
import { useAppStore } from "../store/useAppStore";

let sdkInstance: TrimApp | null = null;
let isFnosEnv = false;
let initPromise: Promise<void> | null = null;
let lastExitPageTipsState: boolean | null = null;
let lastTitle: string | null = null;

export const FnosSDK = {
  /**
   * 初始化 FNOS 官方 SDK 实例并执行 RPC 链路双向握手校验
   */
  init(): Promise<void> {
    if (!initPromise) {
      initPromise = (async () => {
        try {
          sdkInstance = new TrimApp({ debug: false });
          
          // 握手超时限制 (1500ms)，避免非 FNOS 环境卡死
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("FNOS SDK 握手超时")), 1500)
          );
          await Promise.race([sdkInstance.ready(), timeoutPromise]);

          // RPC 探针测试
          await sdkInstance.setTitle(document.title || "PodNote");
          isFnosEnv = true;
          useAppStore.setState({ isFnosAvailable: true });
        } catch (err: any) {
          isFnosEnv = false;
          useAppStore.setState({ isFnosAvailable: false });
        }
      })();
    }
    return initPromise;
  },

  /**
   * 确保 SDK 初始化完成
   */
  async ensureReady(): Promise<void> {
    if (initPromise) {
      await initPromise;
    }
  },

  /**
   * 是否在可用 FNOS 宿主环境下
   */
  isAvailable(): boolean {
    return isFnosEnv && sdkInstance !== null;
  },

  /**
   * 同步窗口顶栏标题
   */
  async setTitle(title: string): Promise<void> {
    if (!title || lastTitle === title) return;
    lastTitle = title;
    document.title = title;

    await this.ensureReady();
    if (this.isAvailable() && sdkInstance) {
      try {
        await sdkInstance.setTitle(title);
      } catch (err) {}
    }
  },

  /**
   * 设置离开页面未保存更改提示
   */
  async setExitPageTips(params?: { title?: string; content?: string }): Promise<void> {
    await this.ensureReady();
    if (this.isAvailable() && sdkInstance) {
      try {
        await sdkInstance.setExitPageTips(params || {
          title: "未保存的更改",
          content: "当前工作区有未保存的文件，离开后修改可能丢失。"
        });
      } catch (err) {}
    }
  },

  /**
   * 清除离开页面提示
   */
  async clearExitPageTips(): Promise<void> {
    await this.ensureReady();
    if (this.isAvailable() && sdkInstance) {
      try {
        await sdkInstance.setExitPageTips();
      } catch (err) {}
    }
  },

  /**
   * 根据脏文件状态自动同步退出提示
   */
  syncExitPageTipsState(hasDirtyTabs: boolean): void {
    const nextState = !!hasDirtyTabs;
    if (lastExitPageTipsState === nextState) return;
    lastExitPageTipsState = nextState;
    if (nextState) {
      this.setExitPageTips();
    } else {
      this.clearExitPageTips();
    }
  },

  /**
   * 在 FNOS 文件管理器中定位
   */
  async openFileManager(path: string, isDir?: boolean): Promise<void> {
    if (!path) return;
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    await this.ensureReady();

    let targetDir = path;
    const lastSegment = path.replace(/[/\\]+$/, "").split(/[/\\]/).pop() || "";
    const looksLikeFile = /\.[a-zA-Z0-9]+$/.test(lastSegment);

    if (isDir === false || (isDir !== true && looksLikeFile)) {
      const parts = path.replace(/[/\\]+$/, "").split(/[/\\]/);
      if (parts.length > 1) {
        parts.pop();
        targetDir = parts.join("/") || "/";
      }
    }

    if (this.isAvailable() && sdkInstance) {
      try {
        await sdkInstance.openFileManager(targetDir);
      } catch (err) {}
    }
  },

  /**
   * 唤起 FNOS 原生文件/目录选择器
   */
  async pickUserFile(options: FilePickerParams = {}): Promise<string | null> {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    await this.ensureReady();
    if (!this.isAvailable() || !sdkInstance) return null;

    try {
      const res = await sdkInstance.pickFile(options);
      if (Array.isArray(res) && res.length > 0) {
        return res[0];
      }
      if (typeof res === "string") {
        return res;
      }
      // 备用通道 pickUserFile
      const userRes: any = await sdkInstance.pickUserFile(options);
      if (userRes) {
        if (Array.isArray(userRes.data) && userRes.data.length > 0) return userRes.data[0];
        if (typeof userRes.data === "string") return userRes.data;
        if (Array.isArray(userRes) && userRes.length > 0) return userRes[0];
      }
    } catch (err) {}
    return null;
  },

  /**
   * 唤起 FNOS 目录选择器
   */
  async pickUserFolder(): Promise<string | null> {
    return this.pickUserFile({ directory: true });
  }
};
