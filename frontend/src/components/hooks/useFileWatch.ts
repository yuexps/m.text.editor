import { useEffect, useRef } from "react";
import { useAppStore } from "../../store/useAppStore";
import { API } from "../../services/api";

export const useFileWatch = (
  editorRef: React.MutableRefObject<any>,
  isIgnoringChangeRef: React.MutableRefObject<boolean>
) => {
  const activeTabPath = useAppStore((state) => state.activeTabPath);
  const isEditMode = useAppStore((state) => state.isEditMode);
  const readOnlyTail = useAppStore((state) => state.settings.readOnlyTail);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<any>(null);
  const reconnectAttemptsRef = useRef(0);
  const activeTabPathRef = useRef(activeTabPath);

  activeTabPathRef.current = activeTabPath;

  useEffect(() => {
    // 仅在只读模式且开启了 readOnlyTail，并且当前有活动文件时，才开启实时监视
    const shouldWatch = activeTabPath && !isEditMode && readOnlyTail;

    if (!shouldWatch) {
      cleanupWatch();
      return;
    }

    connectWatch(activeTabPath);

    return () => {
      cleanupWatch();
    };
  }, [activeTabPath, isEditMode, readOnlyTail]);

  const cleanupWatch = () => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (socketRef.current) {
      try {
        const ws = socketRef.current;
        (ws as any).isClosing = true;
        ws.close();
      } catch (e) {}
      socketRef.current = null;
    }
    reconnectAttemptsRef.current = 0;
  };

  const connectWatch = (filePath: string) => {
    cleanupWatch();

    const wsUrl = API.getWatchWSUrl(filePath);

    try {
      console.log("[Watch] 建立 WebSocket 实时监控连接:", filePath);
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        if (socketRef.current !== ws) return;
        console.log("[Watch] WebSocket 实时监控连接已建立");
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = async (event) => {
        if (socketRef.current !== ws) return;
        if (activeTabPathRef.current !== filePath || isEditMode) {
          ws.close();
          return;
        }

        try {
          const data = JSON.parse(event.data);
          if (data.error) {
            console.error("[Watch] 后端监视推送错误:", data.error);
            return;
          }

          if (data.event === "change") {
            const currentTab = useAppStore.getState().tabs.find(t => t.path === filePath);
            if (!currentTab) return;

            // 只有物理文件的 mtime 或 size 确实改变了，才执行重载
            if (data.mtime > currentTab.mtime || data.size !== currentTab.content.length) {
              console.log("[Watch] 文件发生变更，执行重载中...");

              const fileData = await API.read(filePath, currentTab.encoding);
              if (socketRef.current !== ws || activeTabPathRef.current !== filePath || isEditMode) return;

              const editor = editorRef.current;
              if (editor) {
                isIgnoringChangeRef.current = true;

                // 判断重载前滚动条是否在底部（30px 容差）
                const scrollHeight = editor.getScrollHeight();
                const scrollTop = editor.getScrollTop();
                const layoutInfo = editor.getLayoutInfo();
                const clientHeight = layoutInfo ? layoutInfo.height : 0;
                const isAtBottom = scrollTop + clientHeight >= scrollHeight - 30;

                // 强制更新编辑器内容
                editor.setValue(fileData.content);

                // 更新 Zustand 状态，避免标脏
                useAppStore.getState().saveTabMetadata(filePath, fileData.mtime, false, fileData.content);

                isIgnoringChangeRef.current = false;

                // 若此前在底部，则自动向下滚动追踪 (Tail)
                if (isAtBottom) {
                  setTimeout(() => {
                    const model = editor.getModel();
                    if (model && activeTabPathRef.current === filePath) {
                      editor.revealLine(model.getLineCount());
                    }
                  }, 50);
                }
              }
            }
          }
        } catch (err) {
          console.error("[Watch] 解析监控消息失败:", err);
        }
      };

      ws.onclose = () => {
        if (socketRef.current !== ws) return;
        socketRef.current = null;
        if (!(ws as any).isClosing) {
          scheduleReconnect(filePath);
        }
      };

      ws.onerror = (err) => {
        if (socketRef.current !== ws) return;
        console.error("[Watch] WebSocket 实时监控连接出错:", err);
      };
    } catch (e) {
      console.error("[Watch] 创建 WebSocket 失败:", e);
    }
  };

  const scheduleReconnect = (filePath: string) => {
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    if (reconnectAttemptsRef.current >= 5) {
      console.warn("[Watch] 实时监控重连已达最大上限");
      return;
    }

    reconnectAttemptsRef.current++;
    const delay = Math.min(2000 * reconnectAttemptsRef.current, 10000);

    reconnectTimerRef.current = setTimeout(() => {
      if (activeTabPathRef.current === filePath && !isEditMode && readOnlyTail) {
        connectWatch(filePath);
      }
    }, delay);
  };
};
