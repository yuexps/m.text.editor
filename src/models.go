package main

// Response 定义标准 API 响应结构
type Response struct {
	Content  string `json:"content,omitempty"`  // 文件内容（解压/转码后）
	Mtime    int64  `json:"mtime,omitempty"`    // 最后修改时间戳
	Size     int64  `json:"size,omitempty"`     // 文件原始字节大小
	Mode     string `json:"mode,omitempty"`     // 文件权限位描述
	Language string `json:"language,omitempty"` // Monaco 语言 ID
	Encoding string `json:"encoding,omitempty"` // 建议的编码
	Error    string `json:"error,omitempty"`    // 错误信息描述
}

// FileInfo 定义目录项元数据
type FileInfo struct {
	Name      string `json:"name"`
	Path      string `json:"path"`
	IsDir     bool   `json:"is_dir"`
	Size      int64  `json:"size"`
	Mtime     int64  `json:"mtime"`
	IsSymlink bool   `json:"is_symlink"` // 是否是符号链接
}

// ListResponse 定义目录列表响应结构
type ListResponse struct {
	Path  string     `json:"path,omitempty"`
	Files []FileInfo `json:"files,omitempty"`
	Error string     `json:"error,omitempty"`
}
