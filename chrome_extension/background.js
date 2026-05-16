// 设置点击图标时打开侧边栏
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => console.error(error));

// 监听标签页更新
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    chrome.storage.local.get(['enabled', 'matchPattern'], (data) => {
      const enabled = data.enabled !== false;
      const pattern = data.matchPattern || 'fnos.net //默认生效的域名\n:5666,:5777 //默认生效的端口';

      if (enabled) {
        // 仅匹配域名或 IP:端口部分
        if (pattern) {
          try {
            const urlObj = new URL(tab.url);
            const host = urlObj.host; // 获取 domain:port 部分
            const lines = pattern.split('\n');
            const keywords = [];
            lines.forEach(line => {
              // 1. 去掉注释 (# 或 //)
              const noComment = line.split('#')[0].split('//')[0];
              // 2. 在剩余内容中仅按英文逗号再次分割
              const items = noComment.split(',').map(i => i.trim()).filter(i => i);
              keywords.push(...items);
            });

            const isMatch = keywords.some(k => host.includes(k));
            if (!isMatch) return;
          } catch (e) {
            return;
          }
        }

        console.log(`[NotePod++ 拓展] 域名匹配成功，设置安装标记并准备注入: ${tab.url}`);
        
        // 1. 先注入“已安装”标记，供编辑器 index.html 检测
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: () => { window.__NOTEPOD_EXTENSION_INSTALLED__ = true; },
          world: 'MAIN'
        }).catch(() => {});

        const performInjection = () => {
          // 检查主页面中的存活标记（通过检查 DOM 元素属性）
          chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: () => !!document.documentElement.dataset.notepodReady,
          }).then(results => {
            const isReady = results && results[0] && results[0].result;
            if (!isReady) {
              // 1. 注入脚本文件到 MAIN
              chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['inject_fnos.js'],
                world: 'MAIN'
              }).then(() => {
                // 2. 注入成功后，在 DOM 上设置存活标记
                chrome.scripting.executeScript({
                  target: { tabId: tabId },
                  func: () => { 
                    document.documentElement.dataset.notepodReady = 'true';
                    window.__notepod_fnos_ready__ = true; 
                    
                    const html = document.documentElement;
                    let logs = [];
                    try { logs = JSON.parse(html.dataset.notepodLogs || "[]"); } catch(e) {}
                    logs.push({ t: new Date().toLocaleTimeString(), m: "插件核心已加载", s: "info" });
                    html.dataset.notepodLogs = JSON.stringify(logs);
                  },
                });
                console.log('%c[NotePod++ 拓展] 文件管理拓展脚本已成功注入', 'color: #4CAF50; font-weight: bold;');
              }).catch(err => console.error('[NotePod++ 拓展] 文件管理拓展脚本注入失败:', err));
            }
          });
        };

        // 立即执行注入
        performInjection();

        // 在 ISOLATED 环境运行监控器，每 30 秒检查一次 DOM 标记
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: () => {
            if (window.__notepod_monitor_active__) return;
            window.__notepod_monitor_active__ = true;

            setInterval(() => {
              // 检查 DOM 上的标记是否还在
              if (!document.documentElement.dataset.notepodReady) {
                chrome.runtime.sendMessage({ action: 'reinject' });
              }
            }, 30000);
          }
        }).catch(() => {});
      }
    });
  }
});

// 监听重连请求
chrome.runtime.onMessage.addListener((request, sender) => {
  if (request.action === 'reinject' && sender.tab) {
    const tabId = sender.tab.id;
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['inject_fnos.js'],
      world: 'MAIN'
    }).then(() => {
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => { 
          document.documentElement.dataset.notepodReady = 'true';
          window.__notepod_fnos_ready__ = true;
          
          const html = document.documentElement;
          let logs = [];
          try { logs = JSON.parse(html.dataset.notepodLogs || "[]"); } catch(e) {}
          logs.push({ t: new Date().toLocaleTimeString(), m: "检测到状态丢失，已自动重新注入", s: "info" });
          html.dataset.notepodLogs = JSON.stringify(logs);
        },
      });
    });
  }
});
