// globals.d.ts - PodNote 全局类型声明（仅用于 TS 强校验）

// =============================================================================
// Monaco Editor 最小类型声明
// =============================================================================
declare namespace monaco {
    namespace editor {
        function create(domElement: HTMLElement, options?: any): any;
        function createModel(value: string, language?: string, uri?: any): any;
        function getModel(uri: any): any;
        function defineTheme(name: string, themeData: any): void;
        function setTheme(name: string): void;
        function getModels(): any[];
        function setModelLanguage(model: any, languageId: string): void;
        function colorize(text: string, languageId: string, options?: any): Promise<string>;
        function tokenize(text: string, languageId: string): any[][];
        function createWebWorker(options: any): any;
    }
    namespace languages {
        function getLanguages(): Array<{ id: string; aliases?: string[]; extensions?: string[] }>;
        function registerCompletionItemProvider(languageId: string, provider: any): any;
        function registerCodeActionProvider(languageId: string, provider: any): any;
        function registerHoverProvider(languageId: string, provider: any): any;
        function registerDocumentFormattingEditProvider(languageId: string, provider: any): any;
        function setLanguageConfiguration(languageId: string, conf: any): void;
        function setMonarchTokensProvider(languageId: string, languageDef: any): void;
        function register(language: any): void;
        function onLanguage(languageId: string, callback: () => void): any;
        const CompletionItemKind: any;
        const CompletionItemInsertTextRule: any;
    }
    namespace Uri {
        function parse(value: string): any;
        function file(path: string): any;
    }
    namespace Range {
        function fromPositions(start: any, end: any): any;
    }
    class Position {
        constructor(lineNumber: number, column: number);
        lineNumber: number;
        column: number;
    }
    class Range {
        constructor(startLineNumber: number, startColumn: number, endLineNumber: number, endColumn: number);
    }
    class Selection {
        constructor(selectionStartLineNumber: number, selectionStartColumn: number, positionLineNumber: number, positionColumn: number);
    }
    const MarkerSeverity: { Hint: number; Info: number; Warning: number; Error: number };
    const KeyCode: Record<string, number>;
    const KeyMod: { CtrlCmd: number; Shift: number; Alt: number; WinCtrl: number; chord(first: number, second: number): number };
    const KeyBindingType: any;
    class Token {
        constructor(offset: number, type: string, language: string);
    }
    const EditorOption: any;
}

// =============================================================================
// AMD require (Monaco loader)
// =============================================================================
declare function require(deps: string[], callback: (...modules: any[]) => void, errback?: (err: any) => void): void;

// =============================================================================
// xterm.js 全局变量
// =============================================================================
declare class Terminal {
    constructor(options?: any);
    open(container: HTMLElement): void;
    write(data: string): void;
    onData(callback: (data: string) => void): any;
    onResize(callback: (size: { cols: number; rows: number }) => void): any;
    onKey(callback: (e: { key: string; domEvent: KeyboardEvent }) => void): any;
    loadAddon(addon: any): void;
    focus(): void;
    dispose(): void;
    cols: number;
    rows: number;
    element: HTMLElement;
    textarea: HTMLTextAreaElement;
    clear(): void;
    reset(): void;
    scrollToBottom(): void;
}

declare class FitAddon {
    constructor();
    fit(): void;
    proposeDimensions(): { cols: number; rows: number } | undefined;
    activate(terminal: Terminal): void;
    dispose(): void;
}

// =============================================================================
// marked 全局变量
// =============================================================================
declare const marked: {
    parse(src: string, options?: any): string;
    setOptions(options: any): void;
    use(...extensions: any[]): void;
    Renderer: any;
};

// =============================================================================
// Window 扩展
// =============================================================================
interface Window {
    currentPath?: string;
    currentEncoding?: string;
    filePreloadPromise?: Promise<any>;
    MonacoEnvironment?: { getWorkerUrl?(workerId: string, label: string): string };
    require?: typeof require;
    marked?: typeof marked;
    Terminal?: typeof Terminal;
    FitAddon?: typeof FitAddon;
    monaco?: typeof monaco;
    isSecureContext: boolean;
}

// =============================================================================
// EventListenerOptions 扩展 (passive)
// =============================================================================
interface EventListenerOptions {
    capture?: boolean;
    passive?: boolean;
    once?: boolean;
}

// =============================================================================
// HTMLElement 扩展 (disabled, value, select 等)
// =============================================================================
interface HTMLElement {
    disabled?: boolean;
    value?: string;
    select?(): void;
    _timer?: ReturnType<typeof setTimeout> | null;
}
