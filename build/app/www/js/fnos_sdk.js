/**
 * fnos_sdk.js - 飞牛 OS (FNOS) 开放平台官方 SDK 桥接与降级托管模块
 */
import { Log, checkIsMobile } from './utils.js';

let sdkInstance = null;
let isFnosEnv = false;
let initPromise = null;
let lastExitPageTipsState = null;
let lastTitle = null;

export const FnosSDK = {
    /**
     * 初始化 FNOS 官方 SDK 实例并执行 RPC 链路双向握手校验
     */
    init() {
        if (!initPromise) {
            initPromise = (async () => {
                try {
                    const TrimAppConstructor = window.TrimApp && (window.TrimApp.TrimApp || window.TrimApp);
                    if (typeof TrimAppConstructor === 'function') {
                        sdkInstance = new TrimAppConstructor({ debug: false });
                        if (typeof sdkInstance.ready === 'function') {
                            const timeoutPromise = new Promise((_, reject) =>
                                setTimeout(() => reject(new Error('FNOS SDK 握手超时 (1500ms)')), 1500)
                            );
                            await Promise.race([sdkInstance.ready(), timeoutPromise]);
                        }

                        // 执行宿主 Bridge RPC 通信链路可用性活动探针校验
                        if (typeof sdkInstance.setTitle === 'function') {
                            await sdkInstance.setTitle(document.title || 'PodNote');
                        }

                        isFnosEnv = true;
                        Log.info('FNOS_SDK', 'SDK 链路握手成功，功能就绪');
                    } else {
                        isFnosEnv = false;
                        Log.info('FNOS_SDK', '当前环境未检测到 TrimApp 模块，自动切换至 Fallback 降级运行模式');
                    }
                } catch (err) {
                    isFnosEnv = false;
                    Log.warn('FNOS_SDK', 'SDK 初始化不可用，处于降级模式:', err.message);
                } finally {
                    this.updateAdaptationUI();
                }
            })();
        }
        return initPromise;
    },

    /**
     * 根据 FNOS 开放能力可用状态自适应更新页面特定按钮显隐
     */
    updateAdaptationUI() {
        const available = this.isAvailable();
        const isMobile = checkIsMobile();

        // 侧边栏“在文件管理器中定位”按钮 (移动端暂时隐藏)
        const openFileManagerBtn = document.getElementById('open-file-manager-btn');
        if (openFileManagerBtn) {
            openFileManagerBtn.style.display = (available && !isMobile) ? 'flex' : 'none';
        }

        // 下拉菜单“打开文件”、“打开目录”项及分隔线
        const menuOpenFile = document.getElementById('menu-open-file');
        const menuOpenFolder = document.getElementById('menu-open-folder');
        const menuDivider = document.getElementById('menu-fnos-divider');
        if (menuOpenFile) menuOpenFile.style.display = available ? 'flex' : 'none';
        if (menuOpenFolder) menuOpenFolder.style.display = available ? 'flex' : 'none';
        if (menuDivider) menuDivider.style.display = available ? 'block' : 'none';

        // 设置面板默认路径选择按钮
        const browseDefaultBtn = document.getElementById('browse-default-path-btn');
        if (browseDefaultBtn) browseDefaultBtn.style.display = available ? 'flex' : 'none';

        // 主页提示文案
        const welcomeMainHint = document.getElementById('welcome-main-hint');
        if (welcomeMainHint) {
            welcomeMainHint.innerText = available
                ? '请使用左上角菜单打开文件或目录'
                : '请从 FNOS 文件管理 中打开文件';
        }
    },

    /**
     * 确保 SDK 初始化握手完成
     */
    async ensureReady() {
        if (initPromise) {
            await initPromise;
        }
    },

    /**
     * 判断当前页面是否正常连接至 FNOS 宿主系统
     */
    isAvailable() {
        return isFnosEnv && sdkInstance !== null;
    },

    /**
     * 设置 FNOS 窗口顶栏标题
     * @param {string} title 窗口标题内容
     */
    async setTitle(title) {
        if (!title) return;
        if (lastTitle === title) return;
        lastTitle = title;
        document.title = title;

        await this.ensureReady();
        if (this.isAvailable() && typeof sdkInstance.setTitle === 'function') {
            try {
                await sdkInstance.setTitle(title);
            } catch (err) {
                Log.warn('FNOS_SDK', 'setTitle 失败:', err);
            }
        }
    },

    /**
     * 设置离开页面未保存确认提示
     * @param {Object} [params] 提示文案对象 { title, content }
     */
    async setExitPageTips(params) {
        await this.ensureReady();
        if (this.isAvailable() && typeof sdkInstance.setExitPageTips === 'function') {
            try {
                await sdkInstance.setExitPageTips(params || {
                    title: '未保存的更改',
                    content: '当前工作区有未保存的文件，离开后修改可能丢失。'
                });
            } catch (err) {
                Log.warn('FNOS_SDK', 'setExitPageTips 失败:', err);
            }
        }
    },

    /**
     * 清除离开页面确认提示
     */
    async clearExitPageTips() {
        await this.ensureReady();
        if (this.isAvailable() && typeof sdkInstance.setExitPageTips === 'function') {
            try {
                await sdkInstance.setExitPageTips();
            } catch (err) {
                Log.warn('FNOS_SDK', 'clearExitPageTips 失败:', err);
            }
        }
    },

    /**
     * 根据工作区脏状态自动联动触发或清除提示
     * @param {boolean} hasDirtyTabs 是否存在未保存脏标签页
     */
    syncExitPageTipsState(hasDirtyTabs) {
        const nextState = !!hasDirtyTabs;
        if (lastExitPageTipsState === nextState) {
            return;
        }
        lastExitPageTipsState = nextState;
        if (nextState) {
            this.setExitPageTips();
        } else {
            this.clearExitPageTips();
        }
    },

    /**
     * 在 FNOS 文件管理器中定位目录
     * @param {string} path 绝对路径
     * @param {boolean} [isDir] 是否为目录（若为文件或显式 false，自动截取父目录）
     */
    async openFileManager(path, isDir) {
        if (!path) return;
        if (document.activeElement && typeof document.activeElement.blur === 'function') {
            document.activeElement.blur();
        }
        await this.ensureReady();

        let targetDir = path;
        const lastSegment = path.replace(/[/\\]+$/, '').split(/[/\\]/).pop() || '';
        const looksLikeFile = /\.[a-zA-Z0-9]+$/.test(lastSegment);

        // FNOS 要求参数必须为目录。若为文件或未显式为目录且带文件扩展名，自动转换为所在父目录
        if (isDir === false || (isDir !== true && looksLikeFile)) {
            const parts = path.replace(/[/\\]+$/, '').split(/[/\\]/);
            if (parts.length > 1) {
                parts.pop();
                targetDir = parts.join('/') || '/';
            }
        }

        if (this.isAvailable() && typeof sdkInstance.openFileManager === 'function') {
            try {
                await sdkInstance.openFileManager(targetDir);
                Log.info('FNOS_SDK', `在文件管理器中定位目录成功: ${targetDir}`);
            } catch (err) {
                Log.error('FNOS_SDK', 'openFileManager 失败:', err);
            }
        }
    },

    /**
     * 唤起 FNOS 文件/目录选择器
     * @param {Object} [options] 选择选项 { directory?: boolean, accept?: string[] }
     * @returns {Promise<string|null>} 选择的绝对路径
     */
    async pickUserFile(options = {}) {
        if (document.activeElement && typeof document.activeElement.blur === 'function') {
            document.activeElement.blur();
        }
        await this.ensureReady();
        if (!this.isAvailable()) {
            return null;
        }

        const safeCall = async (fn) => {
            try {
                const promise = fn();
                if (promise && typeof promise.catch === 'function') {
                    promise.catch(() => { });
                }
                return await promise;
            } catch (err) {
                return null;
            }
        };

        // 优先调用 FNOS 官方支持参数透传的底层标准 API pickFile
        const pickApi = typeof sdkInstance.pickFile === 'function'
            ? sdkInstance.pickFile
            : sdkInstance.pickUserFile;

        let rawRes = null;
        if (typeof pickApi === 'function') {
            rawRes = await safeCall(() => pickApi.call(sdkInstance, options));
        }

        // 提取绝对路径助手
        const extractPath = (val) => {
            if (!val) return null;
            if (typeof val === 'string') return val.trim();
            if (Array.isArray(val) && val.length > 0) return extractPath(val[0]);
            if (typeof val === 'object') {
                return extractPath(val.path) || extractPath(val.paths) || extractPath(val.data) || extractPath(val.result) || extractPath(val.files);
            }
            return null;
        };

        const selectedPath = extractPath(rawRes);

        if (selectedPath) {
            Log.info('FNOS_SDK', '已选择目标路径:', selectedPath);
        } else {
            Log.info('FNOS_SDK', '未选择任何路径', rawRes ? `(原始响应: ${JSON.stringify(rawRes)})` : '');
        }

        return selectedPath;
    },

    /**
     * 唤起 FNOS 目录选择器
     * @returns {Promise<string|null>} 选择的目录绝对路径
     */
    async pickUserFolder() {
        return this.pickUserFile({ directory: true });
    }
};
