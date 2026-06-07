package main

import (
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/net/websocket"
)

// main PodNote 后端服务入口
func main() {
	appDest := os.Getenv("TRIM_APPDEST")
	if appDest == "" {
		log.Fatal("错误: 未检测到 TRIM_APPDEST 环境变量，请确保在应用容器内运行。")
	}

	appVer := os.Getenv("TRIM_APPVER")
	if appVer == "" {
		log.Fatal("错误: 未检测到 TRIM_APPVER 环境变量，请确保在应用容器内运行。")
	}

	socketPath := filepath.Join(appDest, "m-text-editor.sock")
	wwwDir := filepath.Join(appDest, "www")
	prefix := "/app/m-text-editor/"

	log.Printf("------------------------------------------------")
	log.Printf("PodNote 服务启动中...")
	log.Printf("版本: %s", appVer)
	log.Printf("Socket: %s", socketPath)
	log.Printf("Prefix: %s", prefix)
	log.Printf("------------------------------------------------")

	mux := http.NewServeMux()

	// 动态入口服务：处理静态网关和文件的版本号注入
	mux.HandleFunc(prefix, func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path

		// 1. 处理首页：注入样式、脚本及外部组件的版本后缀
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
			html = strings.ReplaceAll(html, "/plugins/inject_fnos.js", "/plugins/inject_fnos.js?v="+appVer)

			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.Write([]byte(html))
			return
		}

		// 处理样式网关：为 style.css 中的 @import 注入版本后缀
		if path == prefix+"style.css" {
			stylePath := filepath.Join(wwwDir, "style.css")
			content, err := os.ReadFile(stylePath)
			if err != nil {
				http.Error(w, "样式表文件未找到", 404)
				return
			}

			cssContent := string(content)
			cssContent = strings.ReplaceAll(cssContent, ".css');", ".css?v="+appVer+"');")
			cssContent = strings.ReplaceAll(cssContent, ".css\");", ".css?v="+appVer+"\");")

			w.Header().Set("Content-Type", "text/css; charset=utf-8")
			w.Write([]byte(cssContent))
			return
		}

		// 2. 处理业务脚本：为所有非 Monaco 的 JS 文件注入 ES 模块版本后缀
		if strings.HasSuffix(path, ".js") && !strings.Contains(path, "/vs/") {
			relPath := strings.TrimPrefix(path, prefix)
			fullPath := filepath.Join(wwwDir, relPath)

			absFullPath, errAbs := filepath.Abs(fullPath)
			absWwwDir, errWww := filepath.Abs(wwwDir)
			if errAbs != nil || errWww != nil || !strings.HasPrefix(absFullPath, absWwwDir+string(filepath.Separator)) {
				http.Error(w, "拒绝访问", 403)
				return
			}

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
	mux.HandleFunc(prefix+"api/read", handleRead)
	mux.HandleFunc(prefix+"api/save", handleSave)
	mux.HandleFunc(prefix+"api/settings", handleSettings)
	mux.HandleFunc(prefix+"api/create", handleCreate)
	mux.HandleFunc(prefix+"api/new", handleNewFile)
	mux.HandleFunc(prefix+"api/list", handleList)
	mux.Handle(prefix+"api/watch/ws", websocket.Handler(handleWatchWS))
	mux.Handle(prefix+"api/terminal/ws", websocket.Handler(handleTerminalWS))

	// 包装中间件链：管理员鉴权 -> Gzip 压缩 -> 缓存控制 -> 日志审计
	handler := adminAuthMiddleware(mux)
	handler = gzipMiddleware(handler)
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

	os.Chmod(socketPath, 0666)

	log.Printf("服务已就绪，正在接收请求...")
	if err := http.Serve(l, loggingMux); err != nil {
		log.Fatalf("服务意外终止: %v", err)
	}
}
