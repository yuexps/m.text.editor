/**
 * NotePod++ Backend Server
 * -----------------------------------------------------------------------------
 * 核心功能：
 * 1. 提供 Monaco Editor 静态资源服务及 Gzip/Cache 性能优化。
 * 2. 处理文件读写 I/O，支持原子化保存、冲突检测及权限同步。
 * 3. 智能探测文件编码（UTF-8 优先，支持 GBK/Big5/UTF-16 探测）。
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
	"golang.org/x/text/encoding/simplifiedchinese"
	"golang.org/x/text/encoding/traditionalchinese"
	"golang.org/x/text/encoding/unicode"
	"golang.org/x/text/transform"

	"github.com/wlynxg/chardet"
)

// =============================================================================
// [1] 数据模型定义
// =============================================================================

// Response 定义了 API 返回的标准 JSON 结构
type Response struct {
	Content  string `json:"content,omitempty"`  // 文件内容（解压/转码后）
	Mtime    int64  `json:"mtime,omitempty"`    // 最后修改时间戳
	Size     int64  `json:"size,omitempty"`     // 文件原始字节大小
	Mode     string `json:"mode,omitempty"`     // 文件权限位描述
	Language string `json:"language,omitempty"` // 识别出的 Monaco 语言 ID
	Encoding string `json:"encoding,omitempty"` // 建议的编码（用于自动切换提示）
	Error    string `json:"error,omitempty"`    // 错误信息描述
}

// =============================================================================
// [2] 服务入口与路由配置
// =============================================================================

func main() {
	// 加载系统环境变量（由飞牛系统自动注入）
	appDest := os.Getenv("TRIM_APPDEST")
	if appDest == "" {
		log.Fatal("错误: 未检测到 TRIM_APPDEST 环境变量，请确保在应用容器内运行。")
	}

	appVer := os.Getenv("TRIM_APPVER")
	if appVer == "" {
		appVer = "1.0.0"
	}

	// 资源与 Socket 路径规划
	socketPath := filepath.Join(appDest, "m-text-editor.sock")
	wwwDir := filepath.Join(appDest, "www")
	prefix := "/app/m-text-editor/"

	log.Printf("------------------------------------------------")
	log.Printf("NotePod++ 服务启动中...")
	log.Printf("版本: %s", appVer)
	log.Printf("Socket: %s", socketPath)
	log.Printf("Prefix: %s", prefix)
	log.Printf("------------------------------------------------")

	mux := http.NewServeMux()

	// 动态入口服务：处理 index.html 和 app.js 的版本号注入，实现前端缓存控制
	mux.HandleFunc(prefix, func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path

		// 1. 处理首页：注入 style.css 和 app.js 的版本后缀
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

		// 2. 处理业务脚本：为所有非 Monaco 的 JS 文件注入 ES 模块版本后缀
		if strings.HasSuffix(path, ".js") && !strings.Contains(path, "/vs/") {
			relPath := strings.TrimPrefix(path, prefix)
			fullPath := filepath.Join(wwwDir, relPath)
			content, err := os.ReadFile(fullPath)
			if err != nil {
				http.Error(w, "主脚本文件未找到", 404)
				return
			}

			jsContent := string(content)
			jsContent = strings.ReplaceAll(jsContent, ".js';", ".js?v="+appVer+"';")
			jsContent = strings.ReplaceAll(jsContent, ".js\";", ".js?v="+appVer+"\";")

			w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
			w.Write([]byte(jsContent))
			return
		}

		// 3. 静态资源转发（处理 Monaco 编辑器核心资源）
		http.StripPrefix(prefix, http.FileServer(http.Dir(wwwDir))).ServeHTTP(w, r)
	})

	// 业务 API 路由
	mux.HandleFunc(prefix+"api/read", handleRead)     // 读取文件内容（含转码）
	mux.HandleFunc(prefix+"api/save", handleSave)     // 保存文件内容（原子写入）
	mux.HandleFunc(prefix+"api/create", handleCreate) // 新建文件预检

	// 包装中间件链：Gzip 压缩 -> 缓存控制 -> 日志审计
	handler := gzipMiddleware(mux)
	handler = cacheMiddleware(handler)
	loggingMux := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("[HTTP] %s %s", r.Method, r.RequestURI)
		handler.ServeHTTP(w, r)
	})

	// 创建并监听 Unix Socket
	os.RemoveAll(socketPath)
	l, err := net.Listen("unix", socketPath)
	if err != nil {
		log.Fatalf("无法监听 Unix Socket: %v", err)
	}
	defer l.Close()

	// 赋予网关对 Socket 的访问权限
	os.Chmod(socketPath, 0666)

	log.Printf("服务已就绪，正在接收请求...")
	if err := http.Serve(l, loggingMux); err != nil {
		log.Fatalf("服务意外终止: %v", err)
	}
}

// =============================================================================
// [3] API 处理器业务逻辑
// =============================================================================

// handleRead 读取指定路径的文件，并根据探测到的编码或用户指定的编码进行转码返回
func handleRead(w http.ResponseWriter, r *http.Request) {
	path, err := cleanAndValidatePath(r.URL.Query().Get("path"))
	encName := r.URL.Query().Get("encoding") // 用户强制指定的编码
	if err != nil {
		http.Error(w, "无效或缺失的路径", 400)
		return
	}

	log.Printf("读取请求: %s (参数编码: %s)", path, encName)

	// 1. 获取文件基础信息
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

	// 安全限制：禁止加载超过 10MB 的文本文件
	const maxFileSize = 10 * 1024 * 1024
	if info.Size() > maxFileSize {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(Response{Error: "文件超过 10MB，为保护编辑器性能，后端拒绝加载。"})
		return
	}

	// 2. 读取文件头部进行编码探测和二进制风险评估
	f, err := os.Open(path)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(Response{Error: "打开文件失败: " + err.Error()})
		return
	}
	defer f.Close()

	buf := make([]byte, 1024)
	n, _ := f.Read(buf)
	f.Seek(0, 0) // 重置指针以便后续读取

	// 执行智能探测
	detectedEnc := predictEncoding(buf[:n])
	isUTF16 := strings.HasPrefix(detectedEnc, "utf-16")

	// 风险检测：如果非 UTF-16 且包含 null 字节，则判定为无法安全编辑的二进制文件
	if n > 0 && !isUTF16 {
		for i := 0; i < n; i++ {
			if buf[i] == 0 {
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(Response{Error: "检测到二进制内容。为防止文件损坏，编辑器拒绝加载。"})
				return
			}
		}
	}

	// 3. 确定最终解码器
	finalEncName := encName
	if encName == "utf-8" || encName == "" {
		if detectedEnc != "" && detectedEnc != "utf-8" {
			finalEncName = detectedEnc
		}
	}

	var reader io.Reader = f
	enc := getEncoding(finalEncName)
	if enc != nil {
		reader = transform.NewReader(f, enc.NewDecoder())
	}

	// 4. 读取全文并转码
	content, err := io.ReadAll(reader)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(Response{Error: "内容读取/转码失败: " + err.Error()})
		return
	}

	// 构造编码建议：如果探测结果与当前请求编码不符，则下发建议
	encodingAdvice := ""
	if detectedEnc != "" && detectedEnc != strings.ToLower(encName) {
		encodingAdvice = detectedEnc
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(Response{
		Content:  string(content),
		Mtime:    info.ModTime().Unix(),
		Size:     info.Size(),
		Mode:     info.Mode().String(),
		Language: detectLanguage(path, buf[:n]),
		Encoding: encodingAdvice,
	})
}

// handleSave 将前端内容保存到文件，采用“临时文件+重命名”的原子写入策略，确保数据安全
func handleSave(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "仅支持 POST 请求", 405)
		return
	}

	var req struct {
		Path     string `json:"path"`
		Content  string `json:"content"`
		Encoding string `json:"encoding"`
		Mtime    int64  `json:"mtime"` // 客户端持有的最后修改时间，用于冲突检测
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "解析请求参数失败: "+err.Error(), 400)
		return
	}

	path, err := cleanAndValidatePath(req.Path)
	if err != nil {
		http.Error(w, "路径格式不正确", 400)
		return
	}
	req.Path = path

	log.Printf("保存请求: %s", path)

	// 1. 冲突检测（乐观锁）：如果服务端文件已被修改，则拒绝本次保存
	info, err := os.Stat(req.Path)
	if err == nil {
		if req.Mtime > 0 && info.ModTime().Unix() > req.Mtime {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(Response{Error: "文件已被外部修改。为防止内容覆盖，请刷新页面后重试。"})
			return
		}
	}

	// 2. 准备文件权限元数据
	var fileMode os.FileMode = 0644
	if err == nil {
		fileMode = info.Mode()
	}

	// 3. 执行原子化写入
	tmpPath := req.Path + ".tmp"
	f, err := os.OpenFile(tmpPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, fileMode)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(Response{Error: "创建临时文件失败: " + err.Error()})
		return
	}

	// 包装编码器（如果非 UTF-8，则在写入时转码）
	var writer io.Writer = f
	enc := getEncoding(req.Encoding)
	if enc != nil {
		// 使用 ReplaceUnsupported 包装，避免因包含目标编码不支持的字符（如在 Big5 中包含特殊 Unicode 字符）而导致保存失败
		writer = transform.NewWriter(f, encoding.ReplaceUnsupported(enc.NewEncoder()))
	}

	_, err = writer.Write([]byte(req.Content))

	// 4. 同步元数据：权限位、UID、GID
	if err == nil {
		f.Chmod(fileMode)
		if info != nil {
			if stat, ok := info.Sys().(*syscall.Stat_t); ok {
				if errChown := f.Chown(int(stat.Uid), int(stat.Gid)); errChown != nil {
					log.Printf("[Warn] 无法同步 UID/GID (%s): %v", req.Path, errChown)
				}
			}
		}
	}

	f.Close()

	if err != nil {
		os.Remove(tmpPath)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(Response{Error: "文件写入失败: " + err.Error()})
		return
	}

	// 5. 原子替换：重命名临时文件覆盖原文件
	if err := os.Rename(tmpPath, req.Path); err != nil {
		os.Remove(tmpPath)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(Response{Error: "原子替换（重命名）失败: " + err.Error()})
		return
	}

	// 返回最新的文件元数据以便前端更新缓存时间戳
	newInfo, _ := os.Stat(req.Path)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(Response{
		Content: "ok",
		Mtime:   newInfo.ModTime().Unix(),
		Size:    newInfo.Size(),
		Mode:    newInfo.Mode().String(),
	})
}

// handleCreate 处理新建文件时的预检请求
func handleCreate(w http.ResponseWriter, r *http.Request) {
	path, err := cleanAndValidatePath(r.URL.Query().Get("path"))
	if err != nil {
		http.Error(w, "路径无效", 400)
		return
	}

	_, err = os.Stat(path)
	if err == nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(Response{Error: "目标文件已存在，请直接打开。"})
		return
	}

	if !os.IsNotExist(err) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(Response{Error: "文件预检异常: " + err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(Response{
		Content:  "ok",
		Language: detectLanguage(path, nil),
	})
}

// =============================================================================
// [4] HTTP 中间件逻辑
// =============================================================================

// gzipMiddleware 为静态资源及 API 响应提供透明的 Gzip 压缩支持
func gzipMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 增加 Vary 响应头以兼容 CDN 和代理缓存
		w.Header().Add("Vary", "Accept-Encoding")

		// 如果客户端不支持 gzip，则直通
		if !strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") {
			next.ServeHTTP(w, r)
			return
		}

		ext := filepath.Ext(r.URL.Path)
		isAPI := strings.Contains(r.URL.Path, "/api/")
		// 仅对文本类资源进行压缩
		if ext == ".js" || ext == ".css" || ext == ".html" || isAPI {
			w.Header().Set("Content-Encoding", "gzip")
			w.Header().Del("Content-Length") // 启用分块传输
			gz := gzip.NewWriter(w)
			defer gz.Close()
			next.ServeHTTP(gzipResponseWriter{Writer: gz, ResponseWriter: w}, r)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// cacheMiddleware 处理静态资源的 HTTP 缓存策略
func cacheMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		if strings.Contains(path, "/vs/") {
			// Monaco 核心库文件：强缓存一年，不可变
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		} else if strings.HasSuffix(path, ".css") || strings.HasSuffix(path, ".js") {
			if r.URL.Query().Get("v") != "" {
				// 带版本号的业务脚本：强缓存 30 天
				w.Header().Set("Cache-Control", "public, max-age=2592000, immutable")
			} else {
				// 普通请求：缓存 1 天
				w.Header().Set("Cache-Control", "public, max-age=86400")
			}
		}
		next.ServeHTTP(w, r)
	})
}

// gzipResponseWriter 包装标准 http.ResponseWriter 以支持 Gzip 写入
type gzipResponseWriter struct {
	io.Writer
	http.ResponseWriter
}

func (w gzipResponseWriter) Write(b []byte) (int, error) {
	return w.Writer.Write(b)
}

// =============================================================================
// [5] 业务辅助工具函数
// =============================================================================

// cleanAndValidatePath 对输入路径进行规范化和安全性预检
func cleanAndValidatePath(path string) (string, error) {
	if path == "" {
		return "", os.ErrInvalid
	}
	return filepath.Clean(path), nil
}

// detectLanguage 根据文件扩展名或头部 Shebang 标记识别语言类型
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

	// 特殊文件名判定
	filename := strings.ToLower(filepath.Base(path))
	if filename == "dockerfile" {
		return "dockerfile"
	}
	if filename == "makefile" {
		return "makefile"
	}

	//Shebang (#!) 判定
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

// predictEncoding 探测字节内容的字符编码
// 遵循“UTF-8 绝对优先”的策略，若非 UTF-8，则使用 chardet 在指定编码列表中取置信度最高者。
func predictEncoding(raw []byte) string {
	if len(raw) == 0 {
		return "utf-8"
	}

	// 策略 1: 合法 UTF-8 校验 (最高优先级)
	if utf8.Valid(raw) {
		return "utf-8"
	}

	// 策略 2: 使用 chardet 探测相似度
	results := chardet.DetectAll(raw)

	// 目标编码列表映射 (对应前端 ENCODING_LIST)
	targetMap := map[string]string{
		"UTF-8":    "utf-8",
		"GB2312":   "gb18030", // GBK映射
		"GB18030":  "gb18030",
		"UTF-16LE": "utf-16le",
		"UTF-16BE": "utf-16be",
		"BIG5":     "big5",
	}

	var bestID string
	maxConfidence := -1.0

	for _, res := range results {
		charset := strings.ToUpper(res.Charset)
		if id, ok := targetMap[charset]; ok {
			if res.Confidence > maxConfidence {
				maxConfidence = res.Confidence
				bestID = id
			}
		}
	}

	if bestID != "" && maxConfidence > 0.1 {
		return bestID
	}

	return "utf-8"
}

// getEncoding 根据名称返回对应的 golang.org/x/text 编码对象
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
	default:
		return nil
	}
}
