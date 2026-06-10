package main

import (
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"os/user"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"
	"unicode/utf8"

	"github.com/creack/pty"
	"github.com/wlynxg/chardet"
	"golang.org/x/net/websocket"
	"golang.org/x/text/encoding"
	"golang.org/x/text/encoding/simplifiedchinese"
	"golang.org/x/text/encoding/traditionalchinese"
	"golang.org/x/text/encoding/unicode"
)

// writeFileAtomic 原子写入文件：临时文件写入 → 权限同步 → 落盘 → 原子重命名
func writeFileAtomic(targetPath string, fileMode os.FileMode, ownerInfo os.FileInfo, writeFn func(io.Writer) error) error {
	tmpPath := fmt.Sprintf("%s.%d.tmp", targetPath, time.Now().UnixNano())
	f, err := os.OpenFile(tmpPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, fileMode)
	if err != nil {
		return fmt.Errorf("创建临时文件失败: %w", err)
	}

	if err := writeFn(f); err != nil {
		f.Close()
		os.Remove(tmpPath)
		return fmt.Errorf("写入内容失败: %w", err)
	}

	f.Chmod(fileMode)
	if ownerInfo != nil {
		if stat, ok := ownerInfo.Sys().(*syscall.Stat_t); ok {
			if errChown := f.Chown(int(stat.Uid), int(stat.Gid)); errChown != nil {
				log.Printf("[Warn] 无法同步 UID/GID (%s): %v", targetPath, errChown)
			}
		}
	}

	if errSync := f.Sync(); errSync != nil {
		log.Printf("[Warn] 无法物理同步落盘 (%s): %v", targetPath, errSync)
	}
	f.Close()

	if err := os.Rename(tmpPath, targetPath); err != nil {
		os.Remove(tmpPath)
		return fmt.Errorf("原子替换失败: %w", err)
	}
	return nil
}

// cleanAndValidatePath 安全校验绝对路径，防范目录逃逸
func cleanAndValidatePath(path string) (string, error) {
	if path == "" {
		return "", os.ErrInvalid
	}
	cleaned := filepath.Clean(path)

	// 解析符号链接以防符号链接逃逸
	if evalPath, err := filepath.EvalSymlinks(cleaned); err == nil {
		cleaned = evalPath
	}

	absPath, err := filepath.Abs(cleaned)
	if err != nil {
		return "", err
	}

	appDest := os.Getenv("TRIM_APPDEST")
	if appDest != "" {
		absAppDest, err := filepath.Abs(appDest)
		if err == nil {
			// 禁止读取或篡改应用自身的资源目录
			if absPath == absAppDest || strings.HasPrefix(absPath, absAppDest+string(filepath.Separator)) {
				return "", os.ErrPermission
			}
		}
	}
	return absPath, nil
}

// detectLanguage 依据扩展名或 Shebang 识别语言
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
		".dart": "dart", ".clojure": "clojure", ".coffee": "coffee",
		".ex": "elixir", ".exs": "elixir", ".fs": "fsharp", ".jl": "julia",
		".kt": "kotlin", ".kts": "kotlin", ".pas": "pascal", ".scala": "scala",
		".swift": "swift", ".tcl": "tcl", ".vb": "vb", ".vbs": "vb",
		".graphql": "graphql", ".proto": "protobuf", ".pug": "pug", ".r": "r", ".sol": "solidity",
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

// predictEncoding 探测字符编码
func predictEncoding(raw []byte) string {
	if len(raw) == 0 {
		return "utf-8"
	}

	if utf8.Valid(raw) {
		return "utf-8"
	}

	results := chardet.DetectAll(raw)

	targetMap := map[string]string{
		"UTF-8":    "utf-8",
		"GB2312":   "gb18030",
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

	if bestID != "" && maxConfidence > 0.5 {
		return bestID
	}

	return "utf-8"
}

// getEncoding 获取 text 字符编码转换器
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

// startPty 启动 PTY 并在 WS 间转发数据
func startPty(ws *websocket.Conn, colsStr, rowsStr string, userParam string, username string) {
	cols := 80
	rows := 24
	if c, err := strconv.Atoi(colsStr); err == nil && c > 0 {
		cols = c
	}
	if r, err := strconv.Atoi(rowsStr); err == nil && r > 0 {
		rows = r
	}

	cmd := exec.Command("/bin/bash")
	cmd.Env = append(os.Environ(), "TERM=xterm-256color", "LANG=zh_CN.UTF-8", "LC_ALL=zh_CN.UTF-8")

	var workDir string

	if userParam == "current" && username != "" {
		u, err := user.Lookup(username)
		if err == nil {
			uidInt, errUid := strconv.Atoi(u.Uid)
			gidInt, errGid := strconv.Atoi(u.Gid)
			if errUid == nil && errGid == nil {
				cmd.SysProcAttr = &syscall.SysProcAttr{
					Credential: &syscall.Credential{
						Uid: uint32(uidInt),
						Gid: uint32(gidInt),
					},
				}
				cmd.Env = append(cmd.Env,
					"HOME="+u.HomeDir,
					"USER="+u.Username,
					"LOGNAME="+u.Username,
				)
				workDir = u.HomeDir
				log.Printf("[Terminal] 已切换终端执行用户为 (Username: %s, UID: %d, GID: %d, Home: %s)", username, uidInt, gidInt, u.HomeDir)
			}
		} else {
			log.Printf("[Terminal] 查找用户失败 (username=%s): %v", username, err)
		}
	}

	if workDir == "" {
		workDir = "/root"
	}

	if _, err := os.Stat(workDir); err == nil {
		cmd.Dir = workDir
	}

	ptyFile, err := pty.StartWithSize(cmd, &pty.Winsize{Cols: uint16(cols), Rows: uint16(rows)})
	if err != nil {
		log.Printf("[Terminal] PTY 启动失败: %v", err)
		websocket.Message.Send(ws, "无法启动终端: "+err.Error())
		return
	}
	defer ptyFile.Close()

	defer func() {
		if cmd.Process != nil {
			cmd.Process.Kill()
		}
	}()

	// 转发 WS 输入并处理窗口尺寸变更及心跳
	go func() {
		defer ws.Close()
		for {
			// 90秒内无任何交互（含客户端心跳）则超时断开，防套接字挂起与协程泄露
			_ = ws.SetReadDeadline(time.Now().Add(90 * time.Second))
			var msg string
			err := websocket.Message.Receive(ws, &msg)
			if err != nil {
				break
			}
			if after, found := strings.CutPrefix(msg, "\x00resize:"); found {
				parts := strings.Split(after, ",")
				if len(parts) == 2 {
					cVal, errC := strconv.Atoi(parts[0])
					rVal, errR := strconv.Atoi(parts[1])
					if errC == nil && errR == nil && cVal > 0 && rVal > 0 {
						_ = pty.Setsize(ptyFile, &pty.Winsize{Cols: uint16(cVal), Rows: uint16(rVal)})
					}
				}
			} else if msg == "\x00ping" {
				_ = websocket.Message.Send(ws, "\x00pong")
			} else {
				_, _ = ptyFile.Write([]byte(msg))
			}
		}
	}()

	// 读取 PTY 写入 WS
	_, _ = io.Copy(ws, ptyFile)
	log.Printf("[Terminal] PTY 会话结束")
}
