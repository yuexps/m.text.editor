package main

import (
	"compress/gzip"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

// gzipPool 缓存 Gzip 压缩器以重用内存
var gzipPool = sync.Pool{
	New: func() interface{} {
		w, _ := gzip.NewWriterLevel(io.Discard, gzip.BestSpeed)
		return w
	},
}

// adminAuthMiddleware 校验管理员身份
func adminAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		isAdminStr := r.Header.Get("X-Trim-Isadmin")

		// 生产环境下进行管理员校验
		if os.Getenv("TRIM_APPDEST") != "" {
			if isAdminStr != "true" {
				log.Printf("[Auth] 拒绝访问 %s: 用户不是管理员", r.URL.Path)
				http.Error(w, "拒绝访问: 仅限系统管理员使用此应用", http.StatusForbidden)
				return
			}
		}

		next.ServeHTTP(w, r)
	})
}

// gzipMiddleware 开启透明 Gzip 压缩
func gzipMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 忽略 WebSocket 升级请求
		if strings.ToLower(r.Header.Get("Upgrade")) == "websocket" || strings.HasSuffix(r.URL.Path, "/api/terminal/ws") {
			next.ServeHTTP(w, r)
			return
		}

		w.Header().Add("Vary", "Accept-Encoding")

		if !strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") {
			next.ServeHTTP(w, r)
			return
		}

		ext := filepath.Ext(r.URL.Path)
		isAPI := strings.Contains(r.URL.Path, "/api/")
		if ext == ".js" || ext == ".css" || ext == ".html" || isAPI {
			w.Header().Set("Content-Encoding", "gzip")
			w.Header().Del("Content-Length")
			gz := gzipPool.Get().(*gzip.Writer)
			gz.Reset(w)
			defer func() {
				gz.Close()
				gzipPool.Put(gz)
			}()
			next.ServeHTTP(gzipResponseWriter{Writer: gz, ResponseWriter: w}, r)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// cacheMiddleware 管理 HTTP 缓存策略
func cacheMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		if strings.Contains(path, "/vs/") {
			// Monaco 核心资源强缓存一年
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		} else if strings.HasSuffix(path, ".css") || strings.HasSuffix(path, ".js") {
			if r.URL.Query().Get("v") != "" {
				// 带版本号的资源强缓存 30 天
				w.Header().Set("Cache-Control", "public, max-age=2592000, immutable")
			} else {
				// 普通业务资源缓存 1 天
				w.Header().Set("Cache-Control", "public, max-age=86400")
			}
		}
		next.ServeHTTP(w, r)
	})
}

// gzipResponseWriter 包装 http.ResponseWriter 接口
type gzipResponseWriter struct {
	io.Writer
	http.ResponseWriter
}

func (w gzipResponseWriter) Write(b []byte) (int, error) {
	return w.Writer.Write(b)
}
