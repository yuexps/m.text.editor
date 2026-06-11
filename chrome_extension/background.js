// 设置点击图标时打开侧边栏
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => console.error(error));

// 校验 URL 是否匹配域名/端口配置
function isUrlAllowed(url, callback) {
  if (!url) {
    callback(false);
    return;
  }
  chrome.storage.local.get(['enabled', 'matchPattern'], (data) => {
    const enabled = data.enabled !== false;
    const pattern = data.matchPattern || 'fnos.net //默认生效的域名\n:5666,:5777 //默认生效的端口';
    if (!enabled) {
      callback(false);
      return;
    }
    if (!pattern) {
      callback(true);
      return;
    }
    try {
      const urlObj = new URL(url);
      const host = urlObj.host;
      const lines = pattern.split('\n');
      const keywords = [];
      lines.forEach(line => {
        const noComment = line.split('#')[0].split('//')[0].trim();
        if (!noComment) return;
        const items = noComment.split(',').map(i => i.trim()).filter(Boolean);
        keywords.push(...items);
      });
      const isMatch = keywords.some(k => {
        if (k.startsWith(':')) {
          return host.endsWith(k);
        }
        const hostname = urlObj.hostname;
        return hostname === k || hostname.endsWith('.' + k);
      });
      callback(isMatch);
    } catch (e) {
      callback(false);
    }
  });
}

// 监听标签页更新
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    isUrlAllowed(tab.url, (allowed) => {
      if (!allowed) return;

      console.log(`[PodNote 拓展] 域名匹配成功，设置安装标记并准备注入: ${tab.url}`);
      
      // 注入“已安装”标记，供编辑器 index.html 检测
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => { window.__PODNOTE_EXTENSION_INSTALLED__ = true; },
        world: 'MAIN'
      }).catch(() => {});

      const performInjection = () => {
        // 检查存活标记与注入锁以实现互斥
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: () => !!document.documentElement.dataset.podnoteReady || !!window.__podnote_injecting__,
        }).then(results => {
          const skip = results && results[0] && results[0].result;
          if (!skip) {
            // 加锁
            chrome.scripting.executeScript({
              target: { tabId: tabId },
              func: () => { window.__podnote_injecting__ = true; }
            }).then(() => {
              chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['inject_fnos.js'],
                world: 'MAIN'
              }).then(() => {
                // MAIN 更新状态
                chrome.scripting.executeScript({
                  target: { tabId: tabId },
                  func: () => { 
                    document.documentElement.dataset.podnoteReady = 'true';
                    window.__podnote_fnos_ready__ = true; 
                    window.__podnote_injecting__ = false;
                    
                    const html = document.documentElement;
                    let logs = [];
                    try { logs = JSON.parse(html.dataset.podnoteLogs || "[]"); } catch(e) {}
                    logs.push({ t: new Date().toLocaleTimeString(), m: "插件核心已加载", s: "info" });
                    html.dataset.podnoteLogs = JSON.stringify(logs);
                  },
                  world: 'MAIN'
                }).catch(() => {});

                // ISOLATED 桥接转发
                chrome.scripting.executeScript({
                  target: { tabId: tabId },
                  func: () => {
                    if (window.__podnote_bridge_installed__) return;
                    window.__podnote_bridge_installed__ = true;
                    window.addEventListener('podnote_status_event', (e) => {
                      chrome.runtime.sendMessage(e.detail).catch(() => {});
                    });
                  }
                }).catch(() => {});

                console.log('%c[PodNote 拓展] 文件管理拓展脚本已成功注入', 'color: #4CAF50; font-weight: bold;');
              }).catch(err => {
                console.error('[PodNote 拓展] 文件管理拓展脚本注入失败:', err);
                chrome.scripting.executeScript({
                  target: { tabId: tabId },
                  func: () => { window.__podnote_injecting__ = false; },
                  world: 'MAIN'
                }).catch(() => {});
              });
            });
          }
        });
      };

      performInjection();
    });
  }
});
