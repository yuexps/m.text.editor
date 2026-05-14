/**
 * utils.js - 通用工具函数与常量
 */

/**
 * 日志包装器
 */
export const Log = {
    prefix: 'NotePod++',
    info(tag, ...args) { console.log(`%c${this.prefix}%c [${tag}]`, 'color: #9e9e9e', 'color: #2196F3; font-weight: bold', ...args); },
    warn(tag, ...args) { console.warn(`%c${this.prefix}%c [${tag}]`, 'color: #9e9e9e', 'color: #FF9800; font-weight: bold', ...args); },
    error(tag, ...args) { console.error(`%c${this.prefix}%c [${tag}]`, 'color: #9e9e9e', 'color: #F44336; font-weight: bold', ...args); },
    success(tag, ...args) { console.log(`%c${this.prefix}%c [${tag}]`, 'color: #9e9e9e', 'color: #4CAF50; font-weight: bold', ...args); }
};

/**
 * 编码配置列表
 */
export const ENCODING_LIST = [
    { label: 'UTF-8', id: 'utf-8' },
    { label: 'GBK', id: 'gbk' },
    { label: 'GB18030', id: 'gb18030' },
    { label: 'UTF-16 LE', id: 'utf-16le' },
    { label: 'UTF-16 BE', id: 'utf-16be' },
    { label: 'Big5', id: 'big5' }
];

/**
 * 获取编码显示标签
 */
export function getEncodingLabel(id) {
    const enc = ENCODING_LIST.find(e => e.id === id);
    return enc ? enc.label.split(' ')[0] : id.toUpperCase();
}

/**
 * 剪贴板工具
 */
export const Clipboard = {
    /**
     * 降级复制方案 (使用 document.execCommand)
     */
    fallbackCopy(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '0';
        textarea.setAttribute('readonly', '');
        document.body.appendChild(textarea);
        textarea.select();
        textarea.setSelectionRange(0, text.length);

        try {
            const result = document.execCommand('copy');
            document.body.removeChild(textarea);
            return result;
        } catch (e) {
            Log.error('Clipboard', '降级复制失败:', e);
            document.body.removeChild(textarea);
            return false;
        }
    },

    /**
     * 复制文本到剪贴板
     * @param {string} text - 要复制的文本
     * @returns {Promise<boolean>} - 是否复制成功
     */
    async copy(text) {
        if (!text) return false;
        Log.info('Clipboard', '请求复制文本，长度:', text.length);

        try {
            // 尝试使用现代 API（仅在 HTTPS 或 localhost 下可用）
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
                Log.success('Clipboard', '文本已复制 (Clipboard API)');
                return true;
            }
        } catch (err) {
            Log.warn('Clipboard', ' Clipboard API 复制失败，尝试降级方案:', err);
        }

        // 使用降级方案
        const success = this.fallbackCopy(text);
        if (success) {
            Log.success('Clipboard', '文本已复制 (降级方案)');
        } else {
            Log.error('Clipboard', '复制最终失败');
        }
        return success;
    },

    /**
     * 从剪贴板读取文本
     * @returns {Promise<string|null>} - 返回读取的文本，失败返回 null
     */
    async read() {
        Log.info('Clipboard', '请求读取剪贴板内容');

        // 检查是否为安全上下文 (HTTPS 或 localhost)
        if (!window.isSecureContext) {
            Log.error('Clipboard', '读取失败: 非安全环境 (HTTP)');
            return { error: 'HTTPS' };
        }

        try {
            if (navigator.clipboard && navigator.clipboard.readText) {
                const text = await navigator.clipboard.readText();
                Log.success('Clipboard', '从剪贴板读取成功');
                return { data: text };
            }
        } catch (err) {
            Log.warn('Clipboard', 'Clipboard API 读取失败 (权限拒绝):', err);
            return { error: 'PERMISSION' };
        }

        Log.error('Clipboard', '读取失败 (环境不支持)');
        return { error: 'NOT_SUPPORTED' };
    }
};
