/**
 * ide_core.js - NotePod++ 核心功能模块 (IDE 增强)
 */
import { Log } from './utils.js';

export const IDECore = {
    _editor: null,
    _disposables: [],
    _currentMarkers: [],

    /**
     * 初始化 IDE 核心功能
     */
    init(editor, context) {
        this._editor = editor;
        this._clearDisposables();
        Log.info('System', '正在初始化 IDE 核心功能...');

        this._registerActions(context);
        this._registerProviders();
        this._registerValidation();
        this._bindUIEvents();

        Log.success('System', 'IDE 核心功能初始化完成');
    },

    _clearDisposables() {
        this._disposables.forEach(d => d.dispose());
        this._disposables = [];
    },

    /**
     * 绑定 UI 交互事件 (面板控制)
     */
    _bindUIEvents() {
        const problemsEl = document.getElementById('status-problems');
        const panelEl = document.getElementById('problems-panel');
        const closeBtn = document.getElementById('close-panel-btn');

        if (problemsEl && panelEl) {
            problemsEl.onclick = (e) => {
                e.stopPropagation();
                const isHidden = panelEl.style.display === 'none' || !panelEl.style.display;
                panelEl.style.display = isHidden ? 'flex' : 'none';
                if (isHidden) this._renderProblemsList();
            };
        }

        if (closeBtn && panelEl) {
            closeBtn.onclick = () => panelEl.style.display = 'none';
        }
    },

    /**
     * 渲染问题列表 (整合原生与自定义问题)
     */
    _renderProblemsList() {
        const listEl = document.getElementById('problems-list');
        if (!listEl) return;

        if (this._currentMarkers.length === 0) {
            listEl.innerHTML = '<div style="padding:20px; opacity:0.5; font-size:13px; text-align:center;">未检测到任何问题</div>';
            return;
        }

        listEl.innerHTML = '';
        const sorted = [...this._currentMarkers].sort((a, b) => a.severity - b.severity);

        sorted.forEach(m => {
            const row = document.createElement('div');
            const isError = m.severity === monaco.MarkerSeverity.Error;
            row.className = `problem-row ${isError ? 'error' : 'warning'}`;
            
            const icon = isError 
                ? '<svg viewBox="0 0 16 16" width="14" height="14"><path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 1a6 6 0 1 1 0 12A6 6 0 0 1 8 2zM10.35 5.65L11.06 6.36 8.71 8.71 11.06 11.06 10.35 11.77 8 9.41 5.65 11.77 4.94 11.06 7.29 8.71 4.94 6.36 5.65 5.65 8 8 10.35 5.65z"/></svg>'
                : '<svg viewBox="0 0 16 16" width="14" height="14"><path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M7.56 1.18a1 1 0 0 1 1.74 0L15.3 12.31a1 1 0 0 1-.87 1.49H2.43a1 1 0 0 1-.87-1.49L7.56 1.18zM2.43 12.8h12L8.43 2.18l-6 10.62zM8 11.2a.8.8 0 1 0 0-1.6.8.8 0 0 0 0 1.6zM7.2 9.6h1.6V5.6H7.2v4z"/></svg>';

            row.innerHTML = `
                ${icon}
                <span class="prob-msg" title="${m.message}">${m.message}</span>
                <span class="prob-loc">[${m.startLineNumber}, ${m.startColumn}]</span>
            `;

            row.onclick = () => {
                this._editor.setPosition({ lineNumber: m.startLineNumber, column: m.startColumn });
                this._editor.revealPositionInCenter({ lineNumber: m.startLineNumber, column: m.startColumn });
                this._editor.focus();
                setTimeout(() => this._editor.trigger('source', 'editor.action.showHover'), 50);
            };
            listEl.appendChild(row);
        });
    },

    /**
     * [1] 注册 Actions
     */
    _registerActions(ctx) {
        if (!this._editor) return;
        this._editor.addAction({
            id: 'notepod-save-file',
            label: '保存文件',
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
            contextMenuGroupId: 'navigation', contextMenuOrder: 1.5,
            run: () => ctx.saveFile && ctx.saveFile()
        });
    },

    /**
     * [2] 注册代码片段
     */
    _registerProviders() {
        const langs = ['javascript', 'typescript', 'html', 'css', 'json', 'python', 'shell'];
        const provider = monaco.languages.registerCompletionItemProvider(langs, {
            provideCompletionItems: (model, position) => {
                const word = model.getWordUntilPosition(position);
                const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn };
                const suggestions = [
                    { label: 'log', kind: monaco.languages.CompletionItemKind.Snippet, documentation: '控制台输出', insertText: model.getLanguageId() === 'python' ? 'print(${1:obj})' : 'console.log(${1:obj});', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range: range },
                    { label: 'func', kind: monaco.languages.CompletionItemKind.Snippet, documentation: '函数定义', insertText: model.getLanguageId() === 'python' ? 'def ${1:name}(${2:args}):\n\t${3:pass}' : 'function ${1:name}(${2:args}) {\n\t${3}\n}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range: range }
                ];
                return { suggestions: suggestions };
            }
        });
        this._disposables.push(provider);
    },

    /**
     * [3] 实时校验 (原生 + 自定义)
     */
    _registerValidation() {
        if (!this._editor) return;

        // 监听所有 Marker 的变化 (原生 Worker 产生的 + 我们手动生成的)
        this._disposables.push(monaco.editor.onDidChangeMarkers(() => {
            const model = this._editor.getModel();
            if (!model) return;
            
            // 汇总当前文件的所有问题
            const allMarkers = monaco.editor.getModelMarkers({ resource: model.uri });
            this._currentMarkers = allMarkers;
            this._updateStatusBar(allMarkers);
            
            // 如果面板正打开，实时更新列表
            const panelEl = document.getElementById('problems-panel');
            if (panelEl && panelEl.style.display !== 'none') {
                this._renderProblemsList();
            }
        }));

        const doCustomValidate = () => {
            const model = this._editor.getModel();
            if (!model) return;
            const lang = model.getLanguageId();
            const text = model.getValue();
            let customMarkers = [];

            // 仅对原生不支持的语言进行自定义校验补足
            // [A] Python
            if (lang === 'python' && text.trim()) {
                text.split('\n').forEach((line, i) => {
                    const codePart = line.split('#')[0].trim();
                    if (!codePart) return;
                    if (/^(if|elif|else|for|while|def|class|with|try|except|finally)\b/.test(codePart) && !codePart.endsWith(':')) {
                        customMarkers.push({ severity: monaco.MarkerSeverity.Warning, message: `Python: 结尾可能缺失冒号 ':'`, startLineNumber: i + 1, startColumn: line.length + 1, endLineNumber: i + 1, endColumn: line.length + 2 });
                    }
                });
            }
            // [B] Shell
            else if (lang === 'shell' && text.trim()) {
                const lines = text.split('\n');
                let ifCount = 0, doCount = 0, caseCount = 0;
                lines.forEach((line, i) => {
                    const codePart = line.split('#')[0].trim();
                    if (!codePart) return;

                    // 引号校验 (仅在非注释部分)
                    if (((codePart.match(/'/g) || []).length % 2 !== 0) || ((codePart.match(/"/g) || []).length % 2 !== 0)) {
                        customMarkers.push({ severity: monaco.MarkerSeverity.Warning, message: `Shell: 引号未闭合`, startLineNumber: i + 1, startColumn: 1, endLineNumber: i + 1, endColumn: line.length + 1 });
                    }

                    // 结构块校验
                    if (/\bif\b/.test(codePart)) ifCount++;
                    if (/\bfi\b/.test(codePart)) ifCount--;
                    if (/\bdo\b/.test(codePart)) doCount++;
                    if (/\bdone\b/.test(codePart)) doCount--;
                    if (/\bcase\b/.test(codePart)) caseCount++;
                    if (/\besac\b/.test(codePart)) caseCount--;
                });
                
                if (ifCount !== 0) customMarkers.push({ severity: monaco.MarkerSeverity.Warning, message: `Shell: if/fi 结构不匹配`, startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 10 });
                if (doCount !== 0) customMarkers.push({ severity: monaco.MarkerSeverity.Warning, message: `Shell: do/done 结构不匹配`, startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 10 });
                if (caseCount !== 0) customMarkers.push({ severity: monaco.MarkerSeverity.Warning, message: `Shell: case/esac 结构不匹配`, startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 10 });
            }
            // [C] XML (排除注释干扰的标签检查)
            else if (lang === 'xml' && text.trim()) {
                const stack = [];
                // 1. 预处理：标记注释和 CDATA 区域，避免正则误抓
                const cleanText = text.replace(/<!--[\s\S]*?-->/g, m => ' '.repeat(m.length))
                                    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, m => ' '.repeat(m.length));

                const tagRegex = /<(\/?[a-zA-Z0-9_:-]+)(?:\s+[^>]*?)?(\/?)>/g;
                let match;
                while ((match = tagRegex.exec(cleanText)) !== null) {
                    const fullTag = match[0];
                    const tagName = match[1];
                    const isClosing = tagName.startsWith('/');
                    const isSelfClosing = match[2] === '/' || ['br', 'img', 'hr', 'input', 'link', 'meta'].includes(tagName.toLowerCase());

                    if (isSelfClosing || fullTag.startsWith('<?') || fullTag.startsWith('<!')) continue;

                    if (isClosing) {
                        const pureName = tagName.substring(1);
                        if (stack.length === 0 || stack[stack.length - 1].name !== pureName) {
                            const pos = model.getPositionAt(match.index);
                            customMarkers.push({
                                severity: monaco.MarkerSeverity.Error,
                                message: `XML: 标签闭合错误，不期望的闭合标签 </${pureName}>`,
                                startLineNumber: pos.lineNumber, startColumn: pos.column,
                                endLineNumber: pos.lineNumber, endColumn: pos.column + fullTag.length
                            });
                        } else {
                            stack.pop();
                        }
                    } else {
                        const pos = model.getPositionAt(match.index);
                        stack.push({ name: tagName, pos: pos, fullTag: fullTag });
                    }
                }
                stack.forEach(unclosed => {
                    customMarkers.push({
                        severity: monaco.MarkerSeverity.Error,
                        message: `XML: 标签 <${unclosed.name}> 未正确闭合`,
                        startLineNumber: unclosed.pos.lineNumber, startColumn: unclosed.pos.column,
                        endLineNumber: unclosed.pos.lineNumber, endColumn: unclosed.pos.column + unclosed.fullTag.length
                    });
                });
            }

            // 将自定义 Marker 注入，它会触发 onDidChangeMarkers 从而更新 UI
            monaco.editor.setModelMarkers(model, 'notepod-custom-validator', customMarkers);
        };

        this._disposables.push(this._editor.onDidChangeModelContent(doCustomValidate));
        this._disposables.push(this._editor.onDidChangeModel(doCustomValidate));
        setTimeout(doCustomValidate, 500);
    },

    _updateStatusBar(markers) {
        const problemsEl = document.getElementById('status-problems');
        const errCountEl = document.getElementById('error-count');
        const warnCountEl = document.getElementById('warning-count');

        if (problemsEl) {
            const errorCount = markers.filter(m => m.severity === monaco.MarkerSeverity.Error).length;
            const warningCount = markers.filter(m => m.severity === monaco.MarkerSeverity.Warning).length;
            problemsEl.style.display = 'flex';
            if (errCountEl) errCountEl.innerText = errorCount;
            if (warnCountEl) warnCountEl.innerText = warningCount;
        }
    }
};
