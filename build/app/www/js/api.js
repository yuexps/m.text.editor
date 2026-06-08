/**
 * api.js - 处理所有与后端的通信
 */
const DEFAULT_TIMEOUT = 15000;
const READ_TIMEOUT = 30000;
const SAVE_TIMEOUT = 30000;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function createAbortContext(externalSignal, timeoutMs) {
    const controller = new AbortController();
    let timedOut = false;
    let timeoutId = null;

    const abortFromExternal = () => {
        controller.abort(externalSignal.reason);
    };

    if (externalSignal) {
        if (externalSignal.aborted) {
            abortFromExternal();
        } else {
            externalSignal.addEventListener('abort', abortFromExternal, { once: true });
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
                externalSignal.removeEventListener('abort', abortFromExternal);
            }
        }
    };
}

async function parseResponse(res) {
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
        return await res.json();
    }

    const text = await res.text();
    if (!text) return {};
    return { error: text };
}

function createHttpError(res, payload) {
    const message = payload?.error || `服务器响应异常 (${res.status})`;
    const err = new Error(message);
    err.name = 'HttpError';
    err.status = res.status;
    return err;
}

function normalizeFetchError(err, context) {
    if (err?.name === 'AbortError') {
        if (context.timedOut) {
            const timeoutError = new Error('请求超时，请稍后重试');
            timeoutError.name = 'TimeoutError';
            return timeoutError;
        }
        return err;
    }

    if (err?.name === 'TypeError') {
        const networkError = new Error('网络连接异常，请检查服务是否可用');
        networkError.name = 'NetworkError';
        return networkError;
    }

    return err;
}

function shouldRetry(err) {
    if (err?.name === 'TimeoutError' || err?.name === 'NetworkError') return true;
    return err?.name === 'HttpError' && [408, 429, 500, 502, 503, 504].includes(err.status);
}

async function request(url, options = {}) {
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
            return data;
        } catch (err) {
            const normalized = normalizeFetchError(err, context);
            if (normalized.name === 'AbortError') throw normalized;
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
     * 读取文件
     */
    async read(path, encoding, signal) {
        const url = `./api/read?path=${encodeURIComponent(path)}&encoding=${encoding}`;
        return await request(url, { signal, timeout: READ_TIMEOUT, retries: 1 });
    },

    /**
     * 保存文件
     */
    async save(path, content, encoding, mtime) {
        return await request('./api/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path, content, encoding, mtime }),
            timeout: SAVE_TIMEOUT
        });
    },

    /**
     * 新建预检
     */
    async checkCreate(path) {
        return await request(`./api/create?path=${encodeURIComponent(path)}`);
    },

    /**
     * 获取指定目录的子文件及子目录列表
     */
    async list(path) {
        return await request(`./api/list?path=${encodeURIComponent(path)}`, { retries: 1 });
    },

    /**
     * 物理创建文件
     */
    async newFile(path) {
        await request('./api/new', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path })
        });
    },

    /**
     * 获取云端配置
     */
    async getSettings(clientType) {
        return await request(`./api/settings?client=${encodeURIComponent(clientType || '')}`, { retries: 1 });
    },

    /**
     * 保存云端配置
     */
    async saveSettings(settings, clientType) {
        return await request(`./api/settings?client=${encodeURIComponent(clientType || '')}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });
    }
};
