package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"syscall"
	"time"

	"golang.org/x/net/websocket"
	"golang.org/x/text/encoding"
	"golang.org/x/text/transform"
)

// handleList 获取指定目录的子项列表
func handleList(w http.ResponseWriter, r *http.Request) {
	pathParam := r.URL.Query().Get("path")
	w.Header().Set("Content-Type", "application/json")

	if pathParam == "" {
		json.NewEncoder(w).Encode(ListResponse{Error: "缺少 path 参数"})
		return
	}

	path, err := cleanAndValidatePath(pathParam)
	if err != nil {
		errMsg := "无效的路径"
		if err == os.ErrPermission {
			errMsg = "禁止访问系统受保护目录"
		}
		json.NewEncoder(w).Encode(ListResponse{Error: errMsg})
		return
	}

	log.Printf("读取目录请求: %s", path)

	info, err := os.Stat(path)
	if err != nil {
		errMsg := err.Error()
		if os.IsNotExist(err) {
			errMsg = "目录不存在"
		}
		json.NewEncoder(w).Encode(ListResponse{Error: errMsg})
		return
	}
	if !info.IsDir() {
		json.NewEncoder(w).Encode(ListResponse{Error: "目标路径不是一个文件夹"})
		return
	}

	entries, err := os.ReadDir(path)
	if err != nil {
		json.NewEncoder(w).Encode(ListResponse{Error: "无法读取目录: " + err.Error()})
		return
	}

	var files []FileInfo
	for _, entry := range entries {
		name := entry.Name()

		fullPath := filepath.Join(path, name)
		var size int64 = 0
		var mtime int64 = 0
		isDir := entry.IsDir()
		isSymlink := entry.Type()&os.ModeSymlink != 0

		// 如果是软链接，尝试解析其指向的实际目标是否为目录
		if isSymlink {
			if targetInfo, err := os.Stat(fullPath); err == nil {
				isDir = targetInfo.IsDir()
			}
		}

		if info, err := entry.Info(); err == nil {
			size = info.Size()
			mtime = info.ModTime().Unix()
		}

		files = append(files, FileInfo{
			Name:      name,
			Path:      fullPath,
			IsDir:     isDir,
			Size:      size,
			Mtime:     mtime,
			IsSymlink: isSymlink,
		})
	}

	sort.Slice(files, func(i, j int) bool {
		if files[i].IsDir && !files[j].IsDir {
			return true
		}
		if !files[i].IsDir && files[j].IsDir {
			return false
		}
		return strings.ToLower(files[i].Name) < strings.ToLower(files[j].Name)
	})

	json.NewEncoder(w).Encode(ListResponse{
		Path:  path,
		Files: files,
	})
}

// handleRead 读取文件并进行转码
func handleRead(w http.ResponseWriter, r *http.Request) {
	path, err := cleanAndValidatePath(r.URL.Query().Get("path"))
	encName := r.URL.Query().Get("encoding")
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		errMsg := "无效或缺失的路径"
		if err == os.ErrPermission {
			errMsg = "禁止访问系统受保护目录"
		}
		json.NewEncoder(w).Encode(Response{Error: errMsg})
		return
	}

	log.Printf("读取请求: %s (参数编码: %s)", path, encName)

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
	if info.IsDir() {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(Response{Error: "目标路径是一个文件夹，编辑器仅支持打开文件。"})
		return
	}

	// 若请求 raw=true，直接输出原始二进制文件流
	if r.URL.Query().Get("raw") == "true" {
		w.Header().Set("Content-Disposition", "inline")
		http.ServeFile(w, r, path)
		return
	}

	const maxEditSize = 20 * 1024 * 1024
	const maxLoadSize = 50 * 1024 * 1024
	const tailSize = 2 * 1024 * 1024

	isTruncated := false
	isHugeFile := false

	f, err := os.Open(path)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(Response{Error: "打开文件失败: " + err.Error()})
		return
	}
	defer f.Close()

	var readOffset int64 = 0
	fileSize := info.Size()

	if fileSize > maxLoadSize {
		isTruncated = true
		readOffset = fileSize - tailSize
		if _, err := f.Seek(readOffset, io.SeekStart); err != nil {
			readOffset = 0
			f.Seek(0, io.SeekStart)
		}
	} else if fileSize > maxEditSize {
		isHugeFile = true
	}

	buf := make([]byte, 1024)
	n, _ := f.Read(buf)
	f.Seek(readOffset, io.SeekStart)

	detectedEnc := predictEncoding(buf[:n])
	isUTF16 := strings.HasPrefix(detectedEnc, "utf-16")

	if n > 0 && !isUTF16 {
		for i := 0; i < n; i++ {
			if buf[i] == 0 {
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(Response{Error: "检测到二进制内容。为防止文件损坏，编辑器拒绝加载。"})
				return
			}
		}
	}

	finalEncName := encName
	if encName == "utf-8" || encName == "" {
		if detectedEnc != "" && detectedEnc != "utf-8" {
			finalEncName = detectedEnc
		}
	}

	var reader io.Reader = f
	if isTruncated {
		reader = io.LimitReader(f, tailSize)
	}

	enc := getEncoding(finalEncName)
	if enc != nil {
		reader = transform.NewReader(reader, enc.NewDecoder())
	}

	content, err := io.ReadAll(reader)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(Response{Error: "内容读取/转码失败: " + err.Error()})
		return
	}

	contentStr := string(content)
	if isTruncated {
		if idx := strings.Index(contentStr, "\n"); idx != -1 {
			contentStr = contentStr[idx+1:]
		}
	}

	encodingAdvice := ""
	if detectedEnc != "" && detectedEnc != strings.ToLower(encName) {
		encodingAdvice = detectedEnc
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(Response{
		Content:     contentStr,
		Mtime:       info.ModTime().Unix(),
		Size:        info.Size(),
		Mode:        info.Mode().String(),
		Language:    detectLanguage(path, buf[:n]),
		Encoding:    encodingAdvice,
		IsTruncated: isTruncated,
		IsHugeFile:  isHugeFile,
	})
}

// handleSave 原子写入保存文件内容
func handleSave(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "仅支持 POST 请求", 405)
		return
	}

	var req struct {
		Path     string `json:"path"`
		Content  string `json:"content"`
		Encoding string `json:"encoding"`
		Mtime    int64  `json:"mtime"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "解析请求参数失败: "+err.Error(), 400)
		return
	}

	path, err := cleanAndValidatePath(req.Path)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		errMsg := "路径格式不正确"
		if err == os.ErrPermission {
			errMsg = "禁止修改系统受保护目录"
		}
		json.NewEncoder(w).Encode(Response{Error: errMsg})
		return
	}
	req.Path = path

	log.Printf("保存请求: %s", path)

	info, err := os.Stat(req.Path)
	if err == nil {
		if info.IsDir() {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(Response{Error: "目标路径是一个文件夹，无法保存为文件。"})
			return
		}
		if req.Mtime == 0 {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(Response{Error: "目标文件已存在。为防止内容覆盖，请刷新页面或更改路径后重试。"})
			return
		}
		if req.Mtime > 0 && info.ModTime().Unix() > req.Mtime {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(Response{Error: "文件已被外部修改。为防止内容覆盖，请刷新页面后重试。"})
			return
		}
	}

	var fileMode os.FileMode = 0644
	if err == nil {
		fileMode = info.Mode()
	}

	err = writeFileAtomic(req.Path, fileMode, info, func(wr io.Writer) error {
		var writer io.Writer = wr
		enc := getEncoding(req.Encoding)
		if enc != nil {
			writer = transform.NewWriter(wr, encoding.ReplaceUnsupported(enc.NewEncoder()))
		}
		_, writeErr := writer.Write([]byte(req.Content))
		return writeErr
	})
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(Response{Error: err.Error()})
		return
	}

	newInfo, _ := os.Stat(req.Path)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(Response{
		Content: "ok",
		Mtime:   newInfo.ModTime().Unix(),
		Size:    newInfo.Size(),
		Mode:    newInfo.Mode().String(),
	})
}

// handleCreate 处理新建文件预检
func handleCreate(w http.ResponseWriter, r *http.Request) {
	path, err := cleanAndValidatePath(r.URL.Query().Get("path"))
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		errMsg := "路径无效"
		if err == os.ErrPermission {
			errMsg = "禁止在此系统目录中创建文件"
		}
		json.NewEncoder(w).Encode(Response{Error: errMsg})
		return
	}

	info, err := os.Stat(path)
	if err == nil {
		w.Header().Set("Content-Type", "application/json")
		errMsg := "目标文件已存在，请直接打开。"
		if info.IsDir() {
			errMsg = "目标路径是一个文件夹，无法在此处创建同名文件。"
		}
		json.NewEncoder(w).Encode(Response{Error: errMsg})
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

// handleNewFile 执行物理空文件创建
func handleNewFile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "仅支持 POST 请求", 405)
		return
	}

	var req struct {
		Path string `json:"path"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "解析请求参数失败: "+err.Error(), 400)
		return
	}

	path, err := cleanAndValidatePath(req.Path)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		errMsg := "路径无效"
		if err == os.ErrPermission {
			errMsg = "禁止在此系统目录中创建文件"
		}
		json.NewEncoder(w).Encode(Response{Error: errMsg})
		return
	}

	parentDir := filepath.Dir(path)
	if _, err := os.Stat(parentDir); os.IsNotExist(err) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(Response{Error: "目标目录不存在。"})
		return
	}

	if info, err := os.Stat(path); err == nil {
		w.Header().Set("Content-Type", "application/json")
		errMsg := "文件已存在。"
		if info.IsDir() {
			errMsg = "目标路径是一个文件夹，无法在此处创建同名文件。"
		}
		json.NewEncoder(w).Encode(Response{Error: errMsg})
		return
	}

	f, err := os.Create(path)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(Response{Error: "文件创建失败: " + err.Error()})
		return
	}
	f.Close()

	// 继承父目录属主（回退至 1000）
	uid, gid := 1000, 1000
	if parentInfo, errDir := os.Stat(parentDir); errDir == nil {
		if stat, ok := parentInfo.Sys().(*syscall.Stat_t); ok && stat.Uid != 0 {
			uid, gid = int(stat.Uid), int(stat.Gid)
		}
	}
	if errChown := syscall.Chown(path, uid, gid); errChown != nil {
		log.Printf("[Warn] 无法同步新建文件属主 (%s): %v", path, errChown)
	}

	log.Printf("物理文件创建成功并同步权限: %s (UID:%d, GID:%d)", path, uid, gid)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(Response{
		Content: "ok",
		Mtime:   0,
	})
}

// handleWatchWS 建立 WebSocket 文件变化监控
func handleWatchWS(ws *websocket.Conn) {
	defer ws.Close()

	pathParam := ws.Request().URL.Query().Get("path")
	path, err := cleanAndValidatePath(pathParam)
	if err != nil {
		websocket.JSON.Send(ws, map[string]string{"error": "无效的路径"})
		return
	}

	info, err := os.Stat(path)
	if err != nil {
		websocket.JSON.Send(ws, map[string]string{"error": "监听的文件不存在"})
		return
	}

	lastMtime := info.ModTime().Unix()
	lastSize := info.Size()

	log.Printf("[Watch] 开启 WebSocket 文件监控: %s (mtime: %d, size: %d)", path, lastMtime, lastSize)

	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	// reader goroutine: 检测客户端断开。
	// 生命周期保证: 主函数退出时 defer ws.Close() 会导致 ws.Read 返回错误，goroutine 随即退出。
	done := make(chan struct{})
	go func() {
		buf := make([]byte, 8)
		for {
			_, errRead := ws.Read(buf)
			if errRead != nil {
				close(done)
				return
			}
		}
	}()

	for {
		select {
		case <-done:
			log.Printf("[Watch] 客户端断开连接，释放监控资源: %s", path)
			return
		case <-ticker.C:
			currentInfo, errStat := os.Stat(path)
			if errStat != nil {
				websocket.JSON.Send(ws, map[string]string{"error": "文件已被外部删除"})
				return
			}

			currentMtime := currentInfo.ModTime().Unix()
			currentSize := currentInfo.Size()

			if currentMtime > lastMtime || currentSize != lastSize {
				lastMtime = currentMtime
				lastSize = currentSize

				errSend := websocket.JSON.Send(ws, map[string]interface{}{
					"event": "change",
					"mtime": currentMtime,
					"size":  currentSize,
				})
				if errSend != nil {
					log.Printf("[Watch] 发送变更通知失败，客户端已关闭: %v", errSend)
					return
				}
			}
		}
	}
}

// handleTerminalWS 建立 WebSocket 终端会话连接
func handleTerminalWS(ws *websocket.Conn) {
	defer ws.Close()
	q := ws.Request().URL.Query()
	colsStr := q.Get("cols")
	rowsStr := q.Get("rows")
	userParam := q.Get("user")
	workspace := q.Get("workspace")
	isAdminStr := ws.Request().Header.Get("X-Trim-Isadmin")
	username := ws.Request().Header.Get("X-Trim-Username")

	if os.Getenv("TRIM_APPDEST") != "" {
		if isAdminStr != "true" {
			log.Printf("[Terminal] 拒绝连接: 用户 %s 不是管理员", username)
			websocket.Message.Send(ws, "拒绝访问: 仅限系统管理员使用终端")
			return
		}
	}

	log.Printf("[Terminal] 新的 WebSocket 终端连接. cols=%s, rows=%s, user=%s, username=%s, workspace=%s", colsStr, rowsStr, userParam, username, workspace)
	startPty(ws, colsStr, rowsStr, userParam, username, workspace)
}

// getSettingsPath 获取配置物理路径
func getSettingsPath(client string) (string, error) {
	pkgVar := os.Getenv("TRIM_PKGVAR")
	if pkgVar == "" {
		return "", fmt.Errorf("TRIM_PKGVAR 环境变量未设置")
	}
	filename := "settings.json"
	if client == "mobile" {
		filename = "settings_mobile.json"
	}
	return filepath.Join(pkgVar, filename), nil
}

// handleSettings 处理云端配置读写
func handleSettings(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	client := r.URL.Query().Get("client")
	settingsPath, err := getSettingsPath(client)
	if err != nil {
		log.Printf("[Settings] 获取路径失败: %v", err)
		json.NewEncoder(w).Encode(Response{Error: err.Error()})
		return
	}

	if r.Method == http.MethodGet {
		if _, err := os.Stat(settingsPath); os.IsNotExist(err) {
			w.Write([]byte("{}"))
			return
		}

		content, err := os.ReadFile(settingsPath)
		if err != nil {
			log.Printf("[Settings] 读取配置失败: %v", err)
			json.NewEncoder(w).Encode(Response{Error: "读取配置失败: " + err.Error()})
			return
		}
		w.Write(content)
		return
	}

	if r.Method == http.MethodPost {
		var req map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			log.Printf("[Settings] 解析 JSON 失败: %v", err)
			json.NewEncoder(w).Encode(Response{Error: "解析配置失败: " + err.Error()})
			return
		}

		parentDir := filepath.Dir(settingsPath)
		if err := os.MkdirAll(parentDir, 0755); err != nil {
			log.Printf("[Settings] 创建配置目录失败: %v", err)
			json.NewEncoder(w).Encode(Response{Error: "创建配置目录失败: " + err.Error()})
			return
		}

		err := writeFileAtomic(settingsPath, 0644, nil, func(w io.Writer) error {
			encoder := json.NewEncoder(w)
			encoder.SetIndent("", "  ")
			return encoder.Encode(req)
		})
		if err != nil {
			log.Printf("[Settings] 保存配置失败: %v", err)
			json.NewEncoder(w).Encode(Response{Error: err.Error()})
			return
		}
		log.Printf("[Settings] 配置已保存: %s", settingsPath)
		json.NewEncoder(w).Encode(Response{Content: "ok"})
		return
	}

	http.Error(w, "仅支持 GET 和 POST", http.StatusMethodNotAllowed)
}


