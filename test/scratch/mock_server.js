const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const WebSocket = require('ws');

const PORT = 3000;
const WWW_DIR = path.join(__dirname, '../../build/app/www');
const WORKSPACE_DIR = path.join(__dirname, 'files');

// [0] 初始化测试物理工作区
if (!fs.existsSync(WORKSPACE_DIR)) {
    fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
}

// 辅助方法：路径转换与防错映射
function getPhysicalPath(queryPath) {
    if (!queryPath || queryPath === '/mock_workspace') {
        return WORKSPACE_DIR;
    }
    if (!path.isAbsolute(queryPath)) {
        const localPath = path.join(__dirname, queryPath);
        if (fs.existsSync(localPath)) {
            return localPath;
        }
    }
    return path.resolve(queryPath);
}

// 辅助方法：根据扩展名推导 Monaco 语言 ID
function detectLanguage(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const extMap = {
        '.js': 'javascript', '.ts': 'typescript', '.jsx': 'javascript', '.tsx': 'typescript',
        '.html': 'html', '.css': 'css', '.json': 'json', '.md': 'markdown', '.go': 'go', '.py': 'python',
        '.sh': 'shell', '.bash': 'shell', '.txt': 'plaintext'
    };
    return extMap[ext] || 'plaintext';
}

// MIME 类型配置
const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.json': 'application/json; charset=utf-8',
    '.wasm': 'application/wasm'
};

// 辅助响应 JSON 方法
function sendJSON(res, data, status = 200) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
}

// 辅助读取 POST 请求体
function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk;
        });
        req.on('end', () => {
            try {
                resolve(JSON.parse(body));
            } catch (e) {
                resolve({});
            }
        });
        req.on('error', err => reject(err));
    });
}

// 创建 HTTP 服务器
const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    let pathname = parsedUrl.pathname;

    // 过滤基准路径
    const BASE_URL = '/app/m-text-editor';
    if (pathname.startsWith(BASE_URL)) {
        pathname = pathname.slice(BASE_URL.length);
    }
    if (pathname === '') {
        pathname = '/';
    }

    // [1] list API - 获取真实目录列表
    if (pathname === '/api/list') {
        const queryPath = parsedUrl.query.path || '';
        const targetPath = getPhysicalPath(queryPath);

        try {
            const stats = await fs.promises.stat(targetPath);
            if (!stats.isDirectory()) {
                return sendJSON(res, { error: '目标路径不是一个文件夹' }, 400);
            }

            const entries = await fs.promises.readdir(targetPath, { withFileTypes: true });
            const files = [];

            for (const entry of entries) {
                if (entry.name.startsWith('.')) continue; // 忽略隐藏文件

                const fullPath = path.join(targetPath, entry.name);
                let size = 0;
                let mtime = Date.now();
                try {
                    const fStats = await fs.promises.stat(fullPath);
                    size = fStats.size;
                    mtime = fStats.mtimeMs;
                } catch (e) { }

                files.push({
                    name: entry.name,
                    path: fullPath.replace(/\\/g, '/'),
                    is_dir: entry.isDirectory(),
                    size: entry.isDirectory() ? 0 : size,
                    mtime: Math.floor(mtime / 1000)
                });
            }

            // 排序：文件夹在前，文件在后
            files.sort((a, b) => {
                if (a.is_dir && !b.is_dir) return -1;
                if (!a.is_dir && b.is_dir) return 1;
                return a.name.localeCompare(b.name);
            });

            return sendJSON(res, {
                path: targetPath.replace(/\\/g, '/'),
                files: files
            });
        } catch (err) {
            console.error('[API] list 失败:', err);
            return sendJSON(res, { error: '目录不存在或无权访问' }, 404);
        }
    }

    // [2] read API - 读取真实文件
    if (pathname === '/api/read') {
        const queryPath = parsedUrl.query.path || '';
        const targetPath = getPhysicalPath(queryPath);

        try {
            const stats = await fs.promises.stat(targetPath);
            if (stats.isDirectory()) {
                return sendJSON(res, { error: '目标路径是一个文件夹' }, 400);
            }

            if (stats.size > 10 * 1024 * 1024) {
                return sendJSON(res, { error: '文件超过 10MB，仿真环境拒绝加载' }, 400);
            }

            const content = await fs.promises.readFile(targetPath, 'utf8');
            return sendJSON(res, {
                content: content,
                encoding: 'utf-8',
                language: detectLanguage(targetPath),
                mtime: Math.floor(stats.mtimeMs / 1000),
                size: stats.size
            });
        } catch (err) {
            console.error('[API] read 失败:', err);
            return sendJSON(res, { error: '文件读取失败' }, 404);
        }
    }

    // [3] save API - 保存真实文件 (并发乐观锁校验)
    if (pathname === '/api/save' && req.method === 'POST') {
        const body = await readBody(req);
        const { path: queryPath, content, mtime } = body;
        if (!queryPath) {
            return sendJSON(res, { error: '路径不能为空' }, 400);
        }

        const targetPath = getPhysicalPath(queryPath);
        try {
            try {
                const stats = await fs.promises.stat(targetPath);
                if (mtime > 0 && Math.floor(stats.mtimeMs / 1000) > mtime) {
                    return sendJSON(res, { error: '文件已被外部修改，保存被阻止' }, 409);
                }
            } catch (e) {
                // 文件不存在，允许新建写入
            }

            await fs.promises.writeFile(targetPath, content || '', 'utf8');
            const newStats = await fs.promises.stat(targetPath);
            return sendJSON(res, { mtime: Math.floor(newStats.mtimeMs / 1000) });
        } catch (err) {
            console.error('[API] save 失败:', err);
            return sendJSON(res, { error: '保存文件失败' }, 500);
        }
    }

    // [4] create API - 新建预检
    if (pathname === '/api/create') {
        const queryPath = parsedUrl.query.path || '';
        if (!queryPath) {
            return sendJSON(res, { error: '路径不能为空' }, 400);
        }
        const targetPath = getPhysicalPath(queryPath);
        try {
            try {
                await fs.promises.access(targetPath);
                return sendJSON(res, { error: '文件已存在' }, 400);
            } catch (e) { }

            const parentDir = path.dirname(targetPath);
            await fs.promises.access(parentDir);
            return sendJSON(res, { language: detectLanguage(targetPath) });
        } catch (err) {
            return sendJSON(res, { error: '父级目录不存在' }, 400);
        }
    }

    // [5] new API - 物理创建文件或目录
    if (pathname === '/api/new' && req.method === 'POST') {
        const body = await readBody(req);
        const { path: queryPath, is_dir } = body;
        if (!queryPath) {
            return sendJSON(res, { error: '路径不能为空' }, 400);
        }
        const targetPath = getPhysicalPath(queryPath);
        try {
            try {
                await fs.promises.access(targetPath);
                return sendJSON(res, { error: '路径已存在' }, 400);
            } catch (e) { }

            if (is_dir) {
                await fs.promises.mkdir(targetPath, { recursive: true });
            } else {
                await fs.promises.writeFile(targetPath, '', 'utf8');
            }
            return sendJSON(res, {});
        } catch (err) {
            console.error('[API] new 失败:', err);
            return sendJSON(res, { error: '创建路径失败' }, 500);
        }
    }

    // [5.5] settings API - 获取或保存配置
    if (pathname === '/api/settings') {
        const client = parsedUrl.query.client || 'pc';
        const filename = client === 'mobile' ? 'settings_mobile.json' : 'settings.json';
        const settingsPath = path.join(__dirname, filename);

        if (req.method === 'GET') {
            try {
                if (fs.existsSync(settingsPath)) {
                    const content = await fs.promises.readFile(settingsPath, 'utf8');
                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    return res.end(content);
                } else {
                    return sendJSON(res, {});
                }
            } catch (err) {
                console.error('[API] 读取 settings 失败:', err);
                return sendJSON(res, { error: '读取设置失败' }, 500);
            }
        }

        if (req.method === 'POST') {
            try {
                const body = await readBody(req);
                await fs.promises.writeFile(settingsPath, JSON.stringify(body, null, 2), 'utf8');
                return sendJSON(res, { content: 'ok' });
            } catch (err) {
                console.error('[API] 保存 settings 失败:', err);
                return sendJSON(res, { error: '保存设置失败' }, 500);
            }
        }
    }

    // [6] 静态文件托管
    let filePath = path.join(WWW_DIR, pathname === '/' ? 'index.html' : pathname);
    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            return res.end('File Not Found');
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = mimeTypes[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        fs.createReadStream(filePath).pipe(res);
    });
});

// 设置 WebSocket 服务器用于模拟终端
const wss = new WebSocket.Server({ noServer: true });

wss.on('connection', (ws) => {
    let currentLine = '';
    ws.send('\r\nWelcome to 祭祀本 Mock Terminal!\r\n$ ');

    ws.on('message', (message) => {
        const dataStr = message.toString();

        if (dataStr === '\x00ping') {
            ws.send('\x00pong');
            return;
        }

        if (dataStr.startsWith('\x00resize:')) {
            return;
        }

        for (let i = 0; i < dataStr.length; i++) {
            const char = dataStr[i];
            if (char === '\r') {
                ws.send('\r\n');
                if (currentLine.trim() === 'help') {
                    ws.send('Available commands: help, clear, date, whoami\r\n');
                } else if (currentLine.trim() === 'clear') {
                    ws.send('\x1b[2J\x1b[H');
                } else if (currentLine.trim() === 'date') {
                    ws.send(new Date().toString() + '\r\n');
                } else if (currentLine.trim() === 'whoami') {
                    ws.send('mock_user\r\n');
                } else if (currentLine.trim()) {
                    ws.send(`mock-sh: command not found: ${currentLine}\r\n`);
                }
                currentLine = '';
                ws.send('$ ');
            } else if (char === '\x7f' || char === '\x08') {
                if (currentLine.length > 0) {
                    currentLine = currentLine.slice(0, -1);
                    ws.send('\b \b');
                }
            } else {
                currentLine += char;
                ws.send(char);
            }
        }
    });
});

// 设置 WebSocket 服务器用于监视文件变更
const watchWss = new WebSocket.Server({ noServer: true });

watchWss.on('connection', (ws, request) => {
    const parsedUrl = url.parse(request.url, true);
    const queryPath = parsedUrl.query.path || '';
    const targetPath = getPhysicalPath(queryPath);

    if (!fs.existsSync(targetPath)) {
        ws.send(JSON.stringify({ error: '监听的文件不存在' }));
        ws.close();
        return;
    }

    console.log('[Watch] 仿真服务器启动 WS 监视:', targetPath);

    let watcher = null;
    try {
        let lastMtime = 0;
        let lastSize = 0;

        // 获取初始文件属性
        const initialStats = fs.statSync(targetPath);
        lastMtime = Math.floor(initialStats.mtimeMs / 1000);
        lastSize = initialStats.size;

        // 使用 Node.js 的 fs.watch 订阅系统底层变更通知
        watcher = fs.watch(targetPath, async (eventType) => {
            if (eventType === 'change') {
                try {
                    const stats = fs.statSync(targetPath);
                    const currentMtime = Math.floor(stats.mtimeMs / 1000);
                    const currentSize = stats.size;

                    // 当且仅当修改时间或物理大小实际变化时推送，实现防抖与去重
                    if (currentMtime > lastMtime || currentSize !== lastSize) {
                        lastMtime = currentMtime;
                        lastSize = currentSize;

                        ws.send(JSON.stringify({
                            event: 'change',
                            mtime: currentMtime,
                            size: currentSize
                        }));
                    }
                } catch (e) {
                    // 忽略原子写入覆盖时可能短暂产生的 ENOENT 错误
                }
            }
        });

        ws.on('close', () => {
            if (watcher) {
                watcher.close();
                watcher = null;
                console.log('[Watch] 仿真服务器释放 WS 监视资源:', targetPath);
            }
        });

        ws.on('error', (err) => {
            console.error('[Watch] WS 监视通信错误:', err);
            if (watcher) {
                watcher.close();
                watcher = null;
            }
        });
    } catch (err) {
        console.error('[Watch] 初始化监听器失败:', err);
        ws.send(JSON.stringify({ error: '监听初始化失败: ' + err.message }));
        ws.close();
    }
});

// 劫持 http upgrade 事件以支持 ws
server.on('upgrade', (request, socket, head) => {
    const pathname = url.parse(request.url).pathname;
    if (pathname === '/app/m-text-editor/api/terminal/ws') {
        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request);
        });
    } else if (pathname === '/app/m-text-editor/api/watch/ws') {
        watchWss.handleUpgrade(request, socket, head, (ws) => {
            watchWss.emit('connection', ws, request);
        });
    } else {
        socket.destroy();
    }
});

server.listen(PORT, () => {
    console.log(`Mock server is running at http://localhost:${PORT}`);
});
