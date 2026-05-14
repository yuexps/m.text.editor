/**
 * api.js - 处理所有与后端的通信
 */
export const API = {
    /**
     * 读取文件
     */
    async read(path, encoding) {
        const url = `./api/read?path=${encodeURIComponent(path)}&encoding=${encoding}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP 错误 ${res.status}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        return data;
    },

    /**
     * 保存文件
     */
    async save(path, content, encoding, mtime) {
        const res = await fetch('./api/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path, content, encoding, mtime })
        });
        if (!res.ok) throw new Error(`服务器响应异常 (${res.status})`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        return data;
    },

    /**
     * 新建预检
     */
    async checkCreate(path) {
        const res = await fetch(`./api/create?path=${encodeURIComponent(path)}`);
        if (!res.ok) throw new Error(`服务器响应异常 (${res.status})`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        return data;
    }
};
