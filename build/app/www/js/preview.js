/**
 * preview.js - 非文本文件动态预览控制器
 */

// 支持预览的文件后缀映射
const PREVIEW_TYPES = {
    // 图片
    'png': 'image', 'jpg': 'image', 'jpeg': 'image', 'gif': 'image',
    'webp': 'image', 'svg': 'image', 'bmp': 'image', 'ico': 'image',
    // 音频
    'mp3': 'audio', 'wav': 'audio', 'ogg': 'audio',
    // PDF
    'pdf': 'pdf',
    // Office
    'docx': 'docx',
    'xlsx': 'xlsx'
};

/**
 * 判断是否属于可预览的文件类型
 */
export function getPreviewType(path) {
    if (!path) return null;
    const ext = path.split('.').pop().toLowerCase();
    return PREVIEW_TYPES[ext] || null;
}

/**
 * 动态加载本地挂载的 JS 依赖
 */
function loadScript(src) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
        }
        // 备份并置空全局 define，防止被内建 RequireJS 劫持
        const tempDefine = window.define;
        window.define = undefined;

        const script = document.createElement('script');
        script.src = src;
        script.onload = () => {
            window.define = tempDefine;
            resolve();
        };
        script.onerror = () => {
            window.define = tempDefine;
            reject(new Error(`加载脚本失败: ${src}`));
        };
        document.head.appendChild(script);
    });
}

/**
 * 预览管理器
 */
export const PreviewManager = {
    activeAudio: null,

    /**
     * 主渲染分流入口
     */
    async render(container, path, type) {
        this.cleanup(container);
        container.className = 'file-preview-container';

        // 拼接获取二进制文件的 raw=true URL
        const rawUrl = `./api/read?path=${encodeURIComponent(path)}&raw=true`;
        const fileName = path.split(/[/\\]/).pop();

        try {
            switch (type) {
                case 'image':
                    this.renderImage(container, rawUrl);
                    break;
                case 'audio':
                    this.renderAudio(container, rawUrl, fileName);
                    break;
                case 'pdf':
                    this.renderPDF(container, rawUrl);
                    break;
                case 'docx':
                    await this.renderDocx(container, rawUrl);
                    break;
                case 'xlsx':
                    await this.renderXlsx(container, rawUrl);
                    break;
                default:
                    container.innerHTML = `<div class="preview-error">不支持的预览格式: ${type}</div>`;
            }
        } catch (err) {
            container.innerHTML = `
                <div class="preview-error">
                    <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    <p>预览失败: ${err.message}</p>
                </div>
            `;
        }
    },

    /**
     * 渲染图片
     */
    renderImage(container, url) {
        container.classList.add('preview-image-mode');
        const img = document.createElement('img');
        img.src = url;
        img.alt = '图片预览';
        img.onload = () => {
            img.style.opacity = '1';
        };
        container.appendChild(img);
    },

    /**
     * 渲染音频及动态唱片机
     */
    renderAudio(container, url, fileName) {
        container.classList.add('preview-audio-mode');
        
        const card = document.createElement('div');
        card.className = 'audio-card';

        // 唱片盘组件
        const discContainer = document.createElement('div');
        discContainer.className = 'audio-disc-container';
        discContainer.innerHTML = `
            <div class="audio-disc">
                <div class="audio-disc-center"></div>
            </div>
            <div class="audio-stylus"></div>
        `;

        const title = document.createElement('div');
        title.className = 'audio-title';
        title.innerText = fileName;

        const audio = document.createElement('audio');
        audio.controls = true;
        audio.src = url;
        this.activeAudio = audio;

        // 结合播放事件绑定唱片针和盘的动效
        const disc = discContainer.querySelector('.audio-disc');
        const stylus = discContainer.querySelector('.audio-stylus');

        audio.onplay = () => {
            disc.classList.add('rotating');
            stylus.classList.add('playing');
        };
        audio.onpause = () => {
            disc.classList.remove('rotating');
            stylus.classList.remove('playing');
        };
        audio.onended = () => {
            disc.classList.remove('rotating');
            stylus.classList.remove('playing');
        };

        card.appendChild(discContainer);
        card.appendChild(title);
        card.appendChild(audio);
        container.appendChild(card);
    },

    /**
     * 渲染 PDF
     */
    renderPDF(container, url) {
        container.classList.add('preview-pdf-mode');
        const iframe = document.createElement('iframe');
        iframe.src = url;
        container.appendChild(iframe);
    },

    /**
     * 渲染 Word
     */
    async renderDocx(container, url) {
        container.innerHTML = '<div class="preview-loading">正在解析 Word 文档...</div>';
        
        // 动态加载内置的 mammoth.js
        await loadScript('./plugins/mammoth.browser.min.js');

        const res = await fetch(url);
        if (!res.ok) throw new Error(`拉取文档失败: ${res.statusText}`);
        const arrayBuffer = await res.arrayBuffer();

        // 使用 mammoth 转码干净 HTML
        const result = await window.mammoth.convertToHtml({ arrayBuffer });
        
        container.innerHTML = '';
        container.classList.add('preview-docx-mode');

        const article = document.createElement('article');
        article.className = 'docx-body';
        article.innerHTML = result.value || '<p style="text-align:center; color:var(--text-muted);">暂无内容</p>';
        
        container.appendChild(article);
    },

    /**
     * 渲染 Excel
     */
    async renderXlsx(container, url) {
        container.innerHTML = '<div class="preview-loading">正在解析 Excel 数据...</div>';

        // 动态加载内置的 xlsx.mini
        await loadScript('./plugins/xlsx.mini.min.js');

        const res = await fetch(url);
        if (!res.ok) throw new Error(`拉取数据失败: ${res.statusText}`);
        const arrayBuffer = await res.arrayBuffer();

        const data = new Uint8Array(arrayBuffer);
        const workbook = window.XLSX.read(data, { type: 'array' });

        container.innerHTML = '';
        container.classList.add('preview-xlsx-mode');

        // 工作表分页 Tab 栏
        const tabHeader = document.createElement('div');
        tabHeader.className = 'xlsx-tab-header';

        const tableContainer = document.createElement('div');
        tableContainer.className = 'xlsx-table-container';

        workbook.SheetNames.forEach((sheetName, index) => {
            const tab = document.createElement('button');
            tab.className = `xlsx-tab-btn ${index === 0 ? 'active' : ''}`;
            tab.innerText = sheetName;

            // 转 HTML 表格
            const worksheet = workbook.Sheets[sheetName];
            const htmlTable = window.XLSX.utils.sheet_to_html(worksheet, { header: '', footer: '' });

            const tabContent = document.createElement('div');
            tabContent.className = 'xlsx-sheet-content';
            tabContent.style.display = index === 0 ? 'block' : 'none';
            tabContent.innerHTML = htmlTable;

            // 清理表格默认生成的多余冗杂属性并标准化
            const table = tabContent.querySelector('table');
            if (table) {
                table.removeAttribute('border');
                table.className = 'xlsx-table';
            }

            tableContainer.appendChild(tabContent);

            tab.onclick = () => {
                tabHeader.querySelectorAll('.xlsx-tab-btn').forEach(btn => btn.classList.remove('active'));
                tab.classList.add('active');
                tableContainer.querySelectorAll('.xlsx-sheet-content').forEach(content => content.style.display = 'none');
                tabContent.style.display = 'block';
            };

            tabHeader.appendChild(tab);
        });

        container.appendChild(tabHeader);
        container.appendChild(tableContainer);
    },

    /**
     * 清理状态，回收资源防止泄露
     */
    cleanup(container) {
        if (this.activeAudio) {
            this.activeAudio.pause();
            this.activeAudio.src = '';
            this.activeAudio = null;
        }
        container.innerHTML = '';
    }
};
