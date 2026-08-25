/**
 * api.ts - 封装与 Go 后端的 HTTP 接口通信，支持重试、超时与强类型
 */

const DEFAULT_TIMEOUT = 15000;
const READ_TIMEOUT = 30000;
const SAVE_TIMEOUT = 30000;

export interface ListResponse {
  path: string;
  files: {
    name: string;
    path: string;
    is_dir: boolean;
    size?: number;
    mtime?: number;
    is_symlink?: boolean;
  }[];
}

export interface ReadResponse {
  content: string;
  encoding: string;
  mtime: number;
  size: number;
  language?: string;
  error?: string;
  is_truncated?: boolean;
  is_huge_file?: boolean;
}

export interface SaveResponse {
  mtime: number;
  size: number;
  error?: string;
}

export interface CreatePrecheckResponse {
  content: string;
  language: string;
  error?: string;
}

interface RequestOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface AbortContext {
  signal: AbortSignal;
  readonly timedOut: boolean;
  cleanup: () => void;
}

function createAbortContext(externalSignal: AbortSignal | null | undefined, timeoutMs: number): AbortContext {
  const controller = new AbortController();
  let timedOut = false;
  let timeoutId: any = null;

  const abortFromExternal = () => {
    controller.abort(externalSignal?.reason);
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      abortFromExternal();
    } else {
      externalSignal.addEventListener("abort", abortFromExternal, { once: true });
    }
  }

  if (timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
  }

  return {
    signal: controller.signal,
    get timedOut() {
      return timedOut;
    },
    cleanup() {
      if (timeoutId) clearTimeout(timeoutId);
      if (externalSignal) {
        externalSignal.removeEventListener("abort", abortFromExternal);
      }
    },
  };
}

async function parseResponse(res: Response): Promise<any> {
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return await res.json();
  }
  const text = await res.text();
  if (!text) return {};
  return { error: text };
}

function createHttpError(res: Response, payload: any): Error {
  const message = payload?.error || `服务器响应异常 (${res.status})`;
  const err = new Error(message) as any;
  err.name = "HttpError";
  err.status = res.status;
  return err;
}

function normalizeFetchError(err: any, context: AbortContext): Error {
  if (err?.name === "AbortError") {
    if (context.timedOut) {
      const timeoutError = new Error("请求超时，请稍后重试");
      timeoutError.name = "TimeoutError";
      return timeoutError;
    }
    return err;
  }
  if (err?.name === "TypeError") {
    const networkError = new Error("网络连接异常，请检查服务是否可用");
    networkError.name = "NetworkError";
    return networkError;
  }
  return err;
}

function shouldRetry(err: any): boolean {
  if (err?.name === "TimeoutError" || err?.name === "NetworkError") return true;
  return err?.name === "HttpError" && [408, 429, 500, 502, 503, 504].includes(err.status);
}

async function request<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const {
    timeout = DEFAULT_TIMEOUT,
    retries = 0,
    retryDelay = 300,
    signal,
    ...fetchOptions
  } = options;

  let attempt = 0;
  while (true) {
    const context = createAbortContext(signal, timeout);
    try {
      const res = await fetch(url, { ...fetchOptions, signal: context.signal });
      const data = await parseResponse(res);
      if (!res.ok) throw createHttpError(res, data);
      if (data?.error) throw new Error(data.error);
      return data as T;
    } catch (err: any) {
      const normalized = normalizeFetchError(err, context);
      if (normalized.name === "AbortError") throw normalized;
      if (attempt >= retries || !shouldRetry(normalized)) throw normalized;

      attempt += 1;
      await sleep(retryDelay * attempt);
    } finally {
      context.cleanup();
    }
  }
}

export const API = {
  /**
   * 读取文件内容
   */
  async read(path: string, encoding: string, signal?: AbortSignal): Promise<ReadResponse> {
    const url = `./api/read?path=${encodeURIComponent(path)}&encoding=${encoding}`;
    return await request<ReadResponse>(url, { signal, timeout: READ_TIMEOUT, retries: 1 });
  },

  /**
   * 获取原始二进制流 URL（用于图片/音频/PDF/文档预览）
   */
  getRawReadUrl(path: string): string {
    return `./api/read?path=${encodeURIComponent(path)}&raw=true`;
  },

  /**
   * 保存文件内容
   */
  async save(path: string, content: string, encoding: string, mtime: number): Promise<SaveResponse> {
    return await request<SaveResponse>("./api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, content, encoding, mtime }),
      timeout: SAVE_TIMEOUT,
    });
  },

  /**
   * 新建文件预检
   */
  async checkCreate(path: string): Promise<CreatePrecheckResponse> {
    const url = `./api/create?path=${encodeURIComponent(path)}`;
    return await request<CreatePrecheckResponse>(url);
  },

  /**
   * 获取目录的文件列表
   */
  async list(path: string): Promise<ListResponse> {
    const url = `./api/list?path=${encodeURIComponent(path)}`;
    return await request<ListResponse>(url, { retries: 1 });
  },

  /**
   * 创建空文件
   */
  async newFile(path: string): Promise<void> {
    await request<void>("./api/new", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    });
  },

  /**
   * 拉取云端配置
   */
  async getSettings(clientType?: "pc" | "mobile"): Promise<Record<string, any>> {
    const url = `./api/settings?client=${encodeURIComponent(clientType || "")}`;
    return await request<Record<string, any>>(url, { retries: 1 });
  },

  /**
   * 保存云端配置
   */
  async saveSettings(settings: Record<string, any>, clientType?: "pc" | "mobile"): Promise<void> {
    const url = `./api/settings?client=${encodeURIComponent(clientType || "")}`;
    await request<void>(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
  },

  /**
   * 获取文件监控的 WebSocket 连接 URL
   */
  getWatchWSUrl(filePath: string): string {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const pathname = window.location.pathname;
    const basePath = pathname.endsWith("/") ? pathname : pathname.substring(0, pathname.lastIndexOf("/") + 1);
    return `${proto}//${host}${basePath}api/watch/ws?path=${encodeURIComponent(filePath)}`;
  },

  /**
   * 获取内部终端的 WebSocket 连接 URL
   */
  getTerminalWSUrl(cols: number, rows: number, user: string, workspace?: string): string {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const pathname = window.location.pathname;
    const basePath = pathname.endsWith("/") ? pathname : pathname.substring(0, pathname.lastIndexOf("/") + 1);
    let wsUrl = `${proto}//${host}${basePath}api/terminal/ws?cols=${cols}&rows=${rows}&user=${encodeURIComponent(user)}`;
    if (workspace && !workspace.startsWith("podnote://")) {
      wsUrl += `&workspace=${encodeURIComponent(workspace)}`;
    }
    return wsUrl;
  },
};
