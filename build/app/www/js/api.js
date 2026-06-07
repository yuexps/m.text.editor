/**
 * api.js - 处理所有与后端的通信
 */
export const API = {
    /**
     * 读取文件
     */
    async read(path, encoding, signal) {
        const url = `./api/read?path=${encodeURIComponent(path)}&encoding=${encoding}`;
        const res = await fetch(url, { signal });
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
    },

    /**
     * 获取指定目录的子文件及子目录列表
     */
    async list(path) {
        const res = await fetch(`./api/list?path=${encodeURIComponent(path)}`);
        if (!res.ok) throw new Error(`服务器响应异常 (${res.status})`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        return data;
    },

    /**
     * 物理创建文件
     */
    async newFile(path) {
        const res = await fetch('./api/new', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path })
        });
        if (!res.ok) throw new Error(`服务器响应异常 (${res.status})`);
    },

    /**
     * 获取云端配置
     */
    async getSettings(clientType) {
        const res = await fetch(`./api/settings?client=${encodeURIComponent(clientType || '')}`);
        if (!res.ok) throw new Error(`服务器响应异常 (${res.status})`);
        return await res.json();
    },

    /**
     * 保存云端配置
     */
    async saveSettings(settings, clientType) {
        const res = await fetch(`./api/settings?client=${encodeURIComponent(clientType || '')}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });
        if (!res.ok) throw new Error(`服务器响应异常 (${res.status})`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        return data;
    }
};

