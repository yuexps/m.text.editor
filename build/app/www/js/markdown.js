/**
 * markdown.js - Markdown 实时渲染与双栏分屏控制器
 */
import { els } from './ui.js';
import { Log, createDisposableStore, frameThrottle } from './utils.js';
import { eventBus } from './event_bus.js';

let editor = null;
let isPreviewMode = false;
let isScrollingFromEditor = false;
let isScrollingFromPreview = false;
let markedLoadedPromise = null;
let renderSeq = 0;
let markdownDisposables = createDisposableStore();

/**
 * 动态加载 marked.min.js 解析库，仅在需要时按需引入
 */
async function loadMarked() {
    if (window.marked) return;
    if (markedLoadedPromise) return markedLoadedPromise;

    Log.info('Markdown', '开始按需加载 marked.min.js...');

    window.require.config({
        paths: {
            'marked': './plugins/marked.min'
        }
    });

    markedLoadedPromise = new Promise((resolve, reject) => {
        window.require(['marked'], (mod) => {
            window.marked = mod.marked || mod;
            Log.success('Markdown', 'marked.min.js 加载就绪');
            resolve();
        }, (err) => {
            Log.error('Markdown', '动态加载 marked.min.js 失败:', err);
            reject(err);
        });
    });

    try {
        await markedLoadedPromise;
    } catch (err) {
        markedLoadedPromise = null;
        throw err;
    }
}

export const MarkdownManager = {
    /**
     * 初始化同步滚动与预览订阅
     */
    init(monacoEditor) {
        markdownDisposables.dispose();
        markdownDisposables = createDisposableStore();
        editor = monacoEditor;

        const syncPreviewFromEditor = frameThrottle(() => {
            if (!editor || !els.markdownPreviewContainer) return;
            const scrollTop = editor.getScrollTop();
            const scrollHeight = editor.getScrollHeight() - editor.getLayoutInfo().height;
            if (scrollHeight > 0) {
                const ratio = scrollTop / scrollHeight;
                const previewContainer = els.markdownPreviewContainer;
                previewContainer.scrollTop = (previewContainer.scrollHeight - previewContainer.clientHeight) * ratio;
            }
        });

        const syncEditorFromPreview = frameThrottle(() => {
            if (!editor || !els.markdownPreviewContainer) return;
            const container = els.markdownPreviewContainer;
            const scrollTop = container.scrollTop;
            const scrollHeight = container.scrollHeight - container.clientHeight;
            if (scrollHeight > 0) {
                const ratio = scrollTop / scrollHeight;
                editor.setScrollTop((editor.getScrollHeight() - editor.getLayoutInfo().height) * ratio);
            }
        });

        // 监听编辑器滚动，同步到预览区
        markdownDisposables.add(editor.onDidScrollChange((e) => {
            if (!isPreviewMode || isScrollingFromPreview) return;
            if (e.scrollTopChanged) {
                isScrollingFromEditor = true;
                syncPreviewFromEditor();
                setTimeout(() => { isScrollingFromEditor = false; }, 50);
            }
        }));
        markdownDisposables.add(() => syncPreviewFromEditor.cancel?.());

        // 监听预览区滚动，反向同步到编辑器
        if (els.markdownPreviewContainer) {
            const handlePreviewScroll = () => {
                if (!isPreviewMode || isScrollingFromEditor) return;
                isScrollingFromPreview = true;
                syncEditorFromPreview();
                setTimeout(() => { isScrollingFromPreview = false; }, 50);
            };
            els.markdownPreviewContainer.addEventListener('scroll', handlePreviewScroll, { passive: true });
            markdownDisposables.add(() => {
                els.markdownPreviewContainer.removeEventListener('scroll', handlePreviewScroll, { passive: true });
                syncEditorFromPreview.cancel?.();
            });
        }

        // 绑定预览按钮
        if (els.previewModeBtn) {
            els.previewModeBtn.onclick = () => {
                this.setPreviewMode(!isPreviewMode);
                els.previewModeBtn.blur();
            };
            markdownDisposables.add(() => {
                els.previewModeBtn.onclick = null;
            });
        }

        // 订阅文件选择事件，自动切换预览按钮显隐
        markdownDisposables.add(eventBus.on('file:selected', (data) => {
            const path = data.path;
            if (!path) {
                this.togglePreviewBtn(false);
                return;
            }
            const model = editor.getModel();
            const langId = model ? model.getLanguageId() : 'plaintext';
            const isMD = path.toLowerCase().endsWith('.md') || langId === 'markdown';
            this.togglePreviewBtn(isMD);
        }));
    },

    isPreviewActive() {
        return isPreviewMode;
    },

    /**
     * 实时防抖渲染 Markdown
     */
    async updatePreview() {
        if (!isPreviewMode || !editor) return;

        try {
            const model = editor.getModel();
            const modelUri = model?.uri?.toString();
            const currentSeq = ++renderSeq;

            await loadMarked();
            if (currentSeq !== renderSeq || editor.getModel()?.uri?.toString() !== modelUri) return;

            const content = model ? model.getValue() : '';
            const parser = window.marked || (typeof marked !== 'undefined' ? marked : null);
            if (!parser) {
                throw new Error('window.marked 解析器未成功挂载');
            }

            parser.setOptions({
                breaks: true,
                gfm: true
            });

            if (currentSeq !== renderSeq || editor.getModel()?.uri?.toString() !== modelUri) return;
            els.markdownPreviewBody.innerHTML = parser.parse(content);

            // Monaco 内置着色器渲染代码块语法高亮
            els.markdownPreviewBody.querySelectorAll('pre code').forEach(el => {
                const langClass = el.className || '';
                const lang = langClass.replace('language-', '') || 'plaintext';
                monaco.editor.colorize(el.textContent, lang, {}).then(html => {
                    if (currentSeq === renderSeq && el.isConnected) {
                        el.innerHTML = html;
                    }
                });
            });
        } catch (err) {
            console.error('[Markdown] 实时更新渲染失败:', err);
            els.markdownPreviewBody.innerHTML = `<div style="padding: 10px; color: #f44336;">无法渲染 Markdown: ${err.message}</div>`;
        }
    },

    /**
     * 切换预览模式
     */
    setPreviewMode(active) {
        isPreviewMode = active;
        const container = els.markdownPreviewContainer;
        if (!container || !editor) return;

        const wrapper = els.editorContainer.parentElement;

        if (active) {
            container.style.display = 'block';
            if (wrapper) wrapper.classList.add('preview-active');
            if (els.previewModeBtn) {
                els.previewModeBtn.title = '关闭预览';
                els.previewModeBtn.classList.add('active');
            }
            this.updatePreview();
        } else {
            container.style.display = 'none';
            if (wrapper) wrapper.classList.remove('preview-active');
            if (els.previewModeBtn) {
                els.previewModeBtn.title = '预览';
                els.previewModeBtn.classList.remove('active');
            }
        }

        setTimeout(() => {
            editor.layout();
        }, 50);
    },

    togglePreviewBtn(show) {
        if (els.previewModeBtn) {
            els.previewModeBtn.style.display = show ? 'inline-block' : 'none';
            if (show) {
                this.setPreviewMode(isPreviewMode);
            } else {
                this.setPreviewMode(false);
            }
        }
    },

    cleanup() {
        this.togglePreviewBtn(false);
    },

    dispose() {
        renderSeq += 1;
        markdownDisposables.dispose();
        isPreviewMode = false;
        isScrollingFromEditor = false;
        isScrollingFromPreview = false;
    }
};
