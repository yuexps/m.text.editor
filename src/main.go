/**
 * NotePod++ Backend Server
 * -----------------------------------------------------------------------------
 * 核心功能：
 * 1. 提供 Monaco Editor 静态资源服务及 Gzip/Cache 优化。
 * 2. 处理文件读写 I/O，支持原子化保存和冲突检测。
 * 3. 智能探测文件编码（UTF-8, GBK 等）及语言 ID 识别。
 * -----------------------------------------------------------------------------
 */

package main

import (
	"compress/gzip"
	"encoding/json"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"unicode/utf8"

	"golang.org/x/text/encoding"
	"golang.org/x/text/encoding/charmap"
	"golang.org/x/text/encoding/simplifiedchinese"
	"golang.org/x/text/encoding/traditionalchinese"
	"golang.org/x/text/encoding/unicode"
	"golang.org/x/text/transform"
)

// =============================================================================
// [1] 全局模型定义
// =============================================================================

// Response 统一定义 API 返回的 JSON 结构
type Response struct {
	Content  string `json:"content,omitempty"`
	Mtime    int64  `json:"mtime,omitempty"`
	Size     int64  `json:"size,omitempty"`     // 文件字节大小
	Mode     string `json:"mode,omitempty"`     // 文件权限位
	Language string `json:"language,omitempty"` // 探测到的语言 ID
	Encoding string `json:"encoding,omitempty"` // 建议的编码转换
	Error    string `json:"error,omitempty"`    // 错误信息描述
}

// =============================================================================
// [2] 核心入口：服务初始化与监听
// =============================================================================

func main() {
	// [2.1] 基础环境变量加载 (飞牛系统注入)
	appDest := os.Getenv("TRIM_APPDEST")
	if appDest == "" {
		log.Fatal("错误: 未检测到 TRIM_APPDEST 环境变量")
	}

	appVer := os.Getenv("TRIM_APPVER")
	if appVer == "" {
		appVer = "1.0.0"
	}

	// [2.2] 路径规划
	socketPath := filepath.Join(appDest, "m-text-editor.sock")
	wwwDir := filepath.Join(appDest, "www")
	prefix := "/app/m-text-editor/"

	// [2.3] 启动日志
	log.Printf("------------------------------------------------")
	log.Printf("NotePod++ 服务启动中...")
	log.Printf("版本: %s", appVer)
	log.Printf("Socket: %s", socketPath)
	log.Printf("Prefix: %s", prefix)
	log.Printf("------------------------------------------------")

	// [2.4] 注册路由
	mux := http.NewServeMux()

	// 动态入口服务 (注入版本号以控制缓存)
	mux.HandleFunc(prefix, func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path

		// 1. 处理首页 index.html 的版本注入
		if path == prefix || path == prefix+"index.html" {
			indexPath := filepath.Join(wwwDir, "index.html")
			content, err := os.ReadFile(indexPath)
			if err != nil {
				http.Error(w, "首页文件未找到", 404)
				return
			}

			html := string(content)
			html = strings.ReplaceAll(html, "href=\"style.css\"", "href=\"style.css?v="+appVer+"\"")
			html = strings.ReplaceAll(html, "src=\"app.js\"", "src=\"app.js?v="+appVer+"\"")

			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.Write([]byte(html))
			return
		}

		// 2. 处理主脚本 app.js 的子模块版本注入
		if path == prefix+"app.js" {
			appJSPath := filepath.Join(wwwDir, "app.js")
			content, err := os.ReadFile(appJSPath)
			if err != nil {
				http.Error(w, "主脚本文件未找到", 404)
				return
			}

			jsContent := string(content)
			jsContent = strings.ReplaceAll(jsContent, ".js';", ".js?v="+appVer+"';")

			w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
			w.Write([]byte(jsContent))
			return
		}

		// 3. 其他非根路径请求交由文件服务器处理
		http.StripPrefix(prefix, http.FileServer(http.Dir(wwwDir))).ServeHTTP(w, r)
	})

	// 静态资源路由 (Monaco Core)
	fs := http.FileServer(http.Dir(wwwDir))
	mux.Handle(prefix+"vs/", http.StripPrefix(prefix, fs))

	// 业务 API 路由
	mux.HandleFunc(prefix+"api/read", handleRead)
	mux.HandleFunc(prefix+"api/save", handleSave)
	mux.HandleFunc(prefix+"api/create", handleCreate)

	// [2.5] 包装中间件链
	handler := gzipMiddleware(mux)
	handler = cacheMiddleware(handler)
	loggingMux := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("[HTTP] %s %s", r.Method, r.RequestURI)
		handler.ServeHTTP(w, r)
	})

	// [2.6] Unix Socket 监听
	os.RemoveAll(socketPath)
	l, err := net.Listen("unix", socketPath)
	if err != nil {
		log.Fatalf("无法监听 Unix Socket: %v", err)
	}
	defer l.Close()

	os.Chmod(socketPath, 0666) // 赋予网关访问权限

	log.Printf("服务就绪，等待请求...")
	if err := http.Serve(l, loggingMux); err != nil {
		log.Fatalf("服务终止: %v", err)
	}
}

// =============================================================================
// [3] API 处理器函数
// =============================================================================

// handleRead 处理文件读取请求
func handleRead(w http.ResponseWriter, r *http.Request) {
	path, err := cleanAndValidatePath(r.URL.Query().Get("path"))
	encName := r.URL.Query().Get("encoding")
	if err != nil {
		http.Error(w, "无效或缺失的路径", 400)
		return
	}

	log.Printf("读取请求: %s (编码: %s)", path, encName)

	// 1. 基础状态检查
	info, err := os.Stat(path)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		errMsg := err.Error()
		if os.IsNotExist(err) {
			errMsg = "文件不存在，请检查路径是否正确。"
		}
		json.NewEncoder(w).Encode(Response{Error: errMsg})
		return
	}

	// 限制文件大小 (10MB)
	const maxFileSize = 10 * 1024 * 1024
	if info.Size() > maxFileSize {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(Response{Error: "文件超过 10MB，后端拒绝加载以保护性能"})
		return
	}

	// 2. 打开并检测二进制风险
	f, err := os.Open(path)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(Response{Error: "打开文件失败: " + err.Error()})
		return
	}
	defer f.Close()

	buf := make([]byte, 1024)
	n, _ := f.Read(buf)
	f.Seek(0, 0)
	if n > 0 {
		for i := 0; i < n; i++ {
			if buf[i] == 0 {
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(Response{Error: "检测到二进制内容，为防止损坏，编辑器拒绝加载。"})
				return
			}
		}
	}

	// 3. 编码解码处理
	var reader io.Reader = f
	enc := getEncoding(encName)
	if enc != nil {
		reader = transform.NewReader(f, enc.NewDecoder())
	}

	content, err := io.ReadAll(reader)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(Response{Error: "读取内容失败: " + err.Error()})
		return
	}

	// 4. 构建返回数据 (自动探测编码建议)
	suggestedEnc := predictEncoding(buf)
	encodingAdvice := ""
	if suggestedEnc != "" && suggestedEnc != strings.ToLower(encName) {
		encodingAdvice = suggestedEnc
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(Response{
		Content:  string(content),
		Mtime:    info.ModTime().Unix(),
		Size:     info.Size(),
		Mode:     info.Mode().String(),
		Language: detectLanguage(path, buf),
		Encoding: encodingAdvice,
	})
}

// handleSave 处理文件保存请求 (原子写入逻辑)
func handleSave(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "不支持的请求方法", 405)
		return
	}

	var req struct {
		Path     string `json:"path"`
		Content  string `json:"content"`
		Encoding string `json:"encoding"`
		Mtime    int64  `json:"mtime"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "解析请求数据失败: "+err.Error(), 400)
		return
	}

	path, err := cleanAndValidatePath(req.Path)
	if err != nil {
		http.Error(w, "无效路径", 400)
		return
	}
	req.Path = path

	log.Printf("保存请求: %s", path)

	// 1. 冲突检测 (Optimistic Locking)
	info, err := os.Stat(req.Path)
	if err == nil {
		if req.Mtime > 0 && info.ModTime().Unix() > req.Mtime {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(Response{Error: "文件已被外部修改，为防止内容覆盖，请刷新页面后再试。"})
			return
		}
	}

	// 2. 准备写入权限
	var fileMode os.FileMode = 0644
	if err == nil {
		fileMode = info.Mode()
	}

	// 3. 执行原子化写入流程
	tmpPath := req.Path + ".tmp"
	f, err := os.OpenFile(tmpPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, fileMode)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(Response{Error: "创建临时文件失败: " + err.Error()})
		return
	}

	var writer io.Writer = f
	enc := getEncoding(req.Encoding)
	if enc != nil {
		writer = transform.NewWriter(f, enc.NewEncoder())
	}

	_, err = writer.Write([]byte(req.Content))

	// 在确定写入成功后，且在关闭文件句柄前，恢复权限和所有者
	if err == nil {
		f.Chmod(fileMode)
		if info != nil {
			if stat, ok := info.Sys().(*syscall.Stat_t); ok {
				f.Chown(int(stat.Uid), int(stat.Gid))
			}
		}
	}

	f.Close()

	if err != nil {
		os.Remove(tmpPath)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(Response{Error: "写入文件失败: " + err.Error()})
		return
	}

	// 重命名覆盖原文件
	if err := os.Rename(tmpPath, req.Path); err != nil {
		os.Remove(tmpPath)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(Response{Error: "重命名(原子替换)失败: " + err.Error()})
		return
	}

	// 4. 返回最新的文件元数据
	newInfo, _ := os.Stat(req.Path)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(Response{
		Content: "ok",
		Mtime:   newInfo.ModTime().Unix(),
		Size:    newInfo.Size(),
		Mode:    newInfo.Mode().String(),
	})
}

// handleCreate 处理新建文件请求的路径预检
func handleCreate(w http.ResponseWriter, r *http.Request) {
	path, err := cleanAndValidatePath(r.URL.Query().Get("path"))
	if err != nil {
		http.Error(w, "无效或缺失的路径", 400)
		return
	}

	_, err = os.Stat(path)
	if err == nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(Response{Error: "文件已存在，请直接打开该文件。"})
		return
	}

	if !os.IsNotExist(err) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(Response{Error: "预检文件状态失败: " + err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(Response{
		Content:  "ok",
		Language: detectLanguage(path, nil),
	})
}

// =============================================================================
// [4] 中间件辅助函数
// =============================================================================

type gzipResponseWriter struct {
	io.Writer
	http.ResponseWriter
}

func (w gzipResponseWriter) Write(b []byte) (int, error) {
	return w.Writer.Write(b)
}

func gzipMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") {
			next.ServeHTTP(w, r)
			return
		}

		ext := filepath.Ext(r.URL.Path)
		isAPI := strings.Contains(r.URL.Path, "/api/")
		if ext == ".js" || ext == ".css" || ext == ".html" || isAPI {
			w.Header().Del("Content-Length")
			w.Header().Set("Content-Encoding", "gzip")
			gz := gzip.NewWriter(w)
			defer gz.Close()
			next.ServeHTTP(gzipResponseWriter{Writer: gz, ResponseWriter: w}, r)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func cacheMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		if strings.Contains(path, "/vs/") {
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		} else if strings.HasSuffix(path, ".css") || strings.HasSuffix(path, ".js") {
			if r.URL.Query().Get("v") != "" {
				w.Header().Set("Cache-Control", "public, max-age=2592000, immutable")
			} else {
				w.Header().Set("Cache-Control", "public, max-age=86400")
			}
		}
		next.ServeHTTP(w, r)
	})
}

// =============================================================================
// [5] 业务逻辑工具函数
// =============================================================================

// cleanAndValidatePath 路径清理与安全预校验
func cleanAndValidatePath(path string) (string, error) {
	if path == "" {
		return "", os.ErrInvalid
	}
	return filepath.Clean(path), nil
}

// detectLanguage 智能语言 ID 探测 (后缀 + Shebang)
func detectLanguage(path string, firstLine []byte) string {
	ext := strings.ToLower(filepath.Ext(path))
	extMap := map[string]string{
		".js": "javascript", ".ts": "typescript", ".jsx": "javascript", ".tsx": "typescript",
		".html": "html", ".css": "css", ".scss": "scss", ".less": "less", ".vue": "html",
		".json": "json", ".md": "markdown", ".go": "go", ".py": "python",
		".c": "c", ".cpp": "cpp", ".h": "c", ".hpp": "cpp", ".cs": "csharp",
		".java": "java", ".php": "php", ".sql": "sql", ".rs": "rust", ".rb": "ruby",
		".lua": "lua", ".sh": "shell", ".bash": "shell", ".zsh": "shell", ".ps1": "powershell",
		".yml": "yaml", ".yaml": "yaml", ".xml": "xml", ".dockerfile": "dockerfile",
		".ini": "ini", ".conf": "ini", ".properties": "ini", ".toml": "toml",
		".makefile": "makefile", ".mk": "makefile", ".gradle": "gradle",
	}
	if lang, ok := extMap[ext]; ok {
		return lang
	}

	filename := strings.ToLower(filepath.Base(path))
	if filename == "dockerfile" {
		return "dockerfile"
	}
	if filename == "makefile" {
		return "makefile"
	}

	lineStr := string(firstLine)
	if strings.HasPrefix(lineStr, "#!") {
		lineStr = strings.ToLower(lineStr)
		if strings.Contains(lineStr, "python") {
			return "python"
		}
		if strings.Contains(lineStr, "sh") || strings.Contains(lineStr, "bash") {
			return "shell"
		}
		if strings.Contains(lineStr, "node") {
			return "javascript"
		}
		if strings.Contains(lineStr, "php") {
			return "php"
		}
		if strings.Contains(lineStr, "perl") {
			return "perl"
		}
	}
	return "plaintext"
}

// predictEncoding 探测字节内容的编码 (对应 getEncoding 支持列表)
func predictEncoding(raw []byte) string {
	if len(raw) == 0 {
		return "utf-8"
	}

	// 1. BOM 强特征检测
	if len(raw) >= 3 && raw[0] == 0xEF && raw[1] == 0xBB && raw[2] == 0xBF {
		return "utf-8"
	}
	if len(raw) >= 2 {
		if raw[0] == 0xFF && raw[1] == 0xFE {
			return "utf-16le"
		}
		if raw[0] == 0xFE && raw[1] == 0xFF {
			return "utf-16be"
		}
	}

	// 2. 无 BOM 的 UTF-16 启发式检测 (空字节分布)
	if len(raw) >= 4 {
		nullAtEven, nullAtOdd := true, true
		checkLen := len(raw)
		if checkLen > 100 {
			checkLen = 100
		}
		for i := 0; i < checkLen; i++ {
			if i%2 == 0 && raw[i] != 0 {
				nullAtEven = false
			}
			if i%2 != 0 && raw[i] != 0 {
				nullAtOdd = false
			}
		}
		if nullAtEven && !nullAtOdd {
			return "utf-16be"
		}
		if nullAtOdd && !nullAtEven {
			return "utf-16le"
		}
	}

	// 3. 合法 UTF-8 校验
	if utf8.Valid(raw) {
		return "utf-8"
	}

	// 4. 并行扫描 GB18030(含GBK)、Big5、Windows-1252
	isGB, isBig5 := true, true
	gbNonAscii, big5NonAscii := 0, 0
	hasHighBit := false

	for i := 0; i < len(raw); {
		b := raw[i]
		if b <= 0x7F {
			i++
			continue
		}
		hasHighBit = true

		// GB18030/GBK 校验
		if isGB {
			// 检查是否为 GB18030 的 4 字节序列: [81-FE][30-39][81-FE][30-39]
			if i+3 < len(raw) && b >= 0x81 && b <= 0xFE &&
				raw[i+1] >= 0x30 && raw[i+1] <= 0x39 &&
				raw[i+2] >= 0x81 && raw[i+2] <= 0xFE &&
				raw[i+3] >= 0x30 && raw[i+3] <= 0x39 {
				gbNonAscii += 4
				i += 4
				continue
			}
			// 检查是否为 GBK 的 2 字节序列: [81-FE][40-FE]
			if i+1 < len(raw) && b >= 0x81 && b <= 0xFE &&
				((raw[i+1] >= 0x40 && raw[i+1] <= 0x7E) || (raw[i+1] >= 0x80 && raw[i+1] <= 0xFE)) {
				gbNonAscii += 2
			} else {
				isGB = false
			}
		}

		// Big5 校验: [A1-F9][40-7E, A1-FE]
		if isBig5 {
			if i+1 < len(raw) && b >= 0xA1 && b <= 0xF9 &&
				((raw[i+1] >= 0x40 && raw[i+1] <= 0x7E) || (raw[i+1] >= 0xA1 && raw[i+1] <= 0xFE)) {
				big5NonAscii += 2
			} else {
				isBig5 = false
			}
		}

		i += 2
		if !isGB && !isBig5 {
			break
		}
	}

	// 5. 最终判定
	if isGB && gbNonAscii > 0 {
		// 如果匹配到 GB 序列，由于 GB18030 兼容 GBK，我们统一返回 "gb18030" 
		// 这样可以获得最大的字符集支持
		if !isBig5 || gbNonAscii >= big5NonAscii {
			return "gb18030"
		}
	}
	if isBig5 && big5NonAscii > 0 {
		return "big5"
	}

	// 6. 如果既不是 UTF-8 也不是 CJK，但存在高位字符，则极有可能是 Windows-1252 (西欧语言)
	if hasHighBit {
		return "windows-1252"
	}

	return ""
}

// getEncoding 获取字符编码转换器
func getEncoding(name string) encoding.Encoding {
	switch name {
	case "gbk":
		return simplifiedchinese.GBK
	case "gb18030":
		return simplifiedchinese.GB18030
	case "big5":
		return traditionalchinese.Big5
	case "utf-16le":
		return unicode.UTF16(unicode.LittleEndian, unicode.IgnoreBOM)
	case "utf-16be":
		return unicode.UTF16(unicode.BigEndian, unicode.IgnoreBOM)
	case "windows-1252":
		return charmap.Windows1252
	default:
		return nil
	}
}
