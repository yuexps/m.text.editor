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

	"golang.org/x/text/encoding"
	"golang.org/x/text/encoding/charmap"
	"golang.org/x/text/encoding/simplifiedchinese"
	"golang.org/x/text/encoding/traditionalchinese"
	"golang.org/x/text/encoding/unicode"
	"golang.org/x/text/transform"
)

func main() {
	// 飞牛系统注入的环境变量，应用安装根路径
	appDest := os.Getenv("TRIM_APPDEST")
	if appDest == "" {
		log.Fatal("错误: 未检测到 TRIM_APPDEST 环境变量")
	}

	socketPath := filepath.Join(appDest, "m-text-editor.sock")
	wwwDir := filepath.Join(appDest, "www")
	appVer := os.Getenv("TRIM_APPVER")
	if appVer == "" {
		appVer = "1.0.0" // 默认版本
	}

	// 路由前缀，需与 config 中的 gatewayPrefix 一致
	prefix := "/app/m-text-editor/"

	// 基础环境日志
	log.Printf("文本编辑器后端启动中...")
	log.Printf("应用版本: %s", appVer)
	log.Printf("应用根目录: %s", appDest)
	log.Printf("静态资源目录: %s", wwwDir)
	log.Printf("监听 Socket: %s", socketPath)

	// 清理旧 Socket
	os.RemoveAll(socketPath)

	mux := http.NewServeMux()

	// 1. 动态入口服务 (注入版本号)
	mux.HandleFunc(prefix, func(w http.ResponseWriter, r *http.Request) {
		// 如果不是直接访问根路径，交由静态服务器处理
		if r.URL.Path != prefix && r.URL.Path != prefix+"index.html" {
			http.StripPrefix(prefix, http.FileServer(http.Dir(wwwDir))).ServeHTTP(w, r)
			return
		}

		indexPath := filepath.Join(wwwDir, "index.html")
		content, err := os.ReadFile(indexPath)
		if err != nil {
			http.Error(w, "Index not found", 404)
			return
		}

		// 注入版本号到 app.js 和 style.css
		html := string(content)
		html = strings.ReplaceAll(html, "href=\"style.css\"", "href=\"style.css?v="+appVer+"\"")
		html = strings.ReplaceAll(html, "src=\"app.js\"", "src=\"app.js?v="+appVer+"\"")

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Write([]byte(html))
	})

	// 2. 静态文件服务 (vs/* 等)
	fs := http.FileServer(http.Dir(wwwDir))
	mux.Handle(prefix+"vs/", http.StripPrefix(prefix, fs))

	// 3. API: 读取文件内容
	mux.HandleFunc(prefix+"api/read", handleRead)

	// 4. API: 保存文件内容
	mux.HandleFunc(prefix+"api/save", handleSave)

	// 4. 包装Gzip中间件
	handler := gzipMiddleware(mux)

	// 5. 包装缓存中间件
	handler = cacheMiddleware(handler)

	// 6. 包装日志中间件
	loggingMux := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("[HTTP] %s %s", r.Method, r.RequestURI)
		handler.ServeHTTP(w, r)
	})

	// 创建监听
	l, err := net.Listen("unix", socketPath)
	if err != nil {
		log.Fatalf("无法监听 Unix Socket: %v", err)
	}
	defer l.Close()

	// 赋予网关访问权限
	os.Chmod(socketPath, 0666)

	log.Printf("服务就绪，网关前缀: %s", prefix)
	if err := http.Serve(l, loggingMux); err != nil {
		log.Fatalf("服务终止: %v", err)
	}
}

type Response struct {
	Content string `json:"content,omitempty"`
	Mtime   int64  `json:"mtime,omitempty"`
	Error   string `json:"error,omitempty"`
}

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
		return nil // 默认 UTF-8
	}
}

func handleRead(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Query().Get("path")
	encName := r.URL.Query().Get("encoding")
	if path == "" {
		http.Error(w, "Missing path", 400)
		return
	}

	log.Printf("读取文件: %s (编码: %s)", path, encName)

	// 后端检查文件大小
	info, err := os.Stat(path)
	if err != nil {
		log.Printf("获取文件信息失败: %v", err)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(Response{Error: err.Error()})
		return
	}

	const maxFileSize = 10 * 1024 * 1024 // 10MB
	if info.Size() > maxFileSize {
		log.Printf("拒绝读取: 文件过大 (%d 字节)", info.Size())
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(Response{Error: "文件超过 10MB，后端拒绝加载以保护性能"})
		return
	}

	f, err := os.Open(path)
	if err != nil {
		log.Printf("打开文件失败: %v", err)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(Response{Error: err.Error()})
		return
	}
	defer f.Close()

	// 简单的二进制检测 (读取前 1KB)
	buf := make([]byte, 1024)
	n, _ := f.Read(buf)
	f.Seek(0, 0) // 重置指针
	if n > 0 {
		for i := 0; i < n; i++ {
			if buf[i] == 0 {
				log.Printf("检测到二进制文件: %s", path)
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(Response{Error: "检测到二进制内容，为防止损坏，编辑器拒绝加载。"})
				return
			}
		}
	}

	var reader io.Reader = f
	enc := getEncoding(encName)
	if enc != nil {
		reader = transform.NewReader(f, enc.NewDecoder())
	}

	content, err := io.ReadAll(reader)
	if err != nil {
		log.Printf("读取失败: %v", err)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(Response{Error: err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(Response{
		Content: string(content),
		Mtime:   info.ModTime().Unix(),
	})
}

func handleSave(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", 405)
		return
	}

	var req struct {
		Path     string `json:"path"`
		Content  string `json:"content"`
		Encoding string `json:"encoding"`
		Mtime    int64  `json:"mtime"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), 400)
		return
	}

	log.Printf("保存文件: %s (编码: %s)", req.Path, req.Encoding)

	// 冲突检测
	info, err := os.Stat(req.Path)
	if err == nil {
		if req.Mtime > 0 && info.ModTime().Unix() > req.Mtime {
			log.Printf("拒绝保存: 文件冲突 (%s)", req.Path)
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(Response{Error: "文件已被外部修改，为防止内容覆盖，请刷新页面后再试。"})
			return
		}
	}

	// 原子写入：先写入临时文件，再重命名
	tmpPath := req.Path + ".tmp"
	f, err := os.OpenFile(tmpPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0644)
	if err != nil {
		log.Printf("创建临时文件失败: %v", err)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(Response{Error: err.Error()})
		return
	}

	var writer io.Writer = f
	enc := getEncoding(req.Encoding)
	if enc != nil {
		writer = transform.NewWriter(f, enc.NewEncoder())
	}

	_, err = writer.Write([]byte(req.Content))
	f.Close() // 必须先关闭才能重命名

	if err != nil {
		log.Printf("写入失败: %v", err)
		os.Remove(tmpPath)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(Response{Error: err.Error()})
		return
	}

	// 重命名覆盖原文件
	if err := os.Rename(tmpPath, req.Path); err != nil {
		log.Printf("重命名失败: %v", err)
		os.Remove(tmpPath)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(Response{Error: err.Error()})
		return
	}

	// 保存成功后返回最新的 Mtime
	newInfo, _ := os.Stat(req.Path)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(Response{Content: "ok", Mtime: newInfo.ModTime().Unix()})
}

type gzipResponseWriter struct {
	io.Writer
	http.ResponseWriter
}

func (w gzipResponseWriter) Write(b []byte) (int, error) {
	return w.Writer.Write(b)
}

// 为所有文本和 JS/CSS 资源启用 Gzip 压缩
func gzipMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") {
			next.ServeHTTP(w, r)
			return
		}

		ext := filepath.Ext(r.URL.Path)
		isAPI := strings.Contains(r.URL.Path, "/api/")
		if ext == ".js" || ext == ".css" || ext == ".html" || isAPI {
			w.Header().Del("Content-Length") // 压缩后长度变化，必须删除原长度
			w.Header().Set("Content-Encoding", "gzip")
			gz := gzip.NewWriter(w)
			defer gz.Close()
			next.ServeHTTP(gzipResponseWriter{Writer: gz, ResponseWriter: w}, r)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// 为 Monaco Editor 等静态资源设置强缓存
func cacheMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		// 1. 对 vs/ 目录下的 Monaco 核心资源设置 1 年强缓存
		if strings.Contains(path, "/vs/") {
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		} else if strings.HasSuffix(path, ".css") || strings.HasSuffix(path, ".js") {
			// 2. 检查是否有版本号控制 (URL 带有 v= 参数)
			if r.URL.Query().Get("v") != "" {
				// 有版本号时，设置较长的缓存（如 30 天），因为版本更新会改变 URL
				w.Header().Set("Cache-Control", "public, max-age=2592000, immutable")
			} else {
				// 无版本号时，设置较短的缓存
				w.Header().Set("Cache-Control", "public, max-age=86400")
			}
		}
		next.ServeHTTP(w, r)
	})
}
