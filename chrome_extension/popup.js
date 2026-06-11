const enabledDoc = document.getElementById('enabled');
const patternDoc = document.getElementById('pattern');
const statusDoc = document.getElementById('status');
const tipDoc = document.getElementById('save-tip');

// 详细状态元素
const featArea = document.getElementById('features-area');
const runStatus = document.getElementById('run-status');
const featMenu = document.getElementById('feat-menu');
const featToolbar = document.getElementById('feat-toolbar');

// 加载初始状态
chrome.storage.local.get(['enabled', 'matchPattern'], (data) => {
  enabledDoc.checked = data.enabled !== false;
  patternDoc.value = data.matchPattern || 'fnos.net //默认生效的域名\n:5666,:5667 //默认生效的端口';
  updateStatus(enabledDoc.checked);
});

// 监听开关变化
enabledDoc.addEventListener('change', () => {
  const isEnabled = enabledDoc.checked;
  chrome.storage.local.set({ enabled: isEnabled }, () => {
      // 状态保存后，刷新当前页面以应用更改
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
              chrome.tabs.reload(tabs[0].id);
          }
      });
  });
  updateStatus(isEnabled);
  showTip();
});

// 监听输入框变化
let timer;
patternDoc.addEventListener('input', () => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    chrome.storage.local.set({ matchPattern: patternDoc.value });
    showTip();
  }, 500);
});

let checkTimer = null;

function updateStatus(active) {
  if (active) {
    statusDoc.innerText = '运行中';
    statusDoc.classList.add('active');
    featArea.style.display = 'block'; 
    checkPageState();
  } else {
    statusDoc.innerText = '已禁用';
    statusDoc.classList.remove('active');
    featArea.style.display = 'block'; 
    
    runStatus.innerText = '已停止';
    runStatus.className = 'stat-value stop'; 
    featMenu.innerText = '已停止';
    featMenu.className = 'stat-value stop';
    featToolbar.innerText = '已停止';
    featToolbar.className = 'stat-value stop';
    const logList = document.getElementById('log-list');
    if (logList) logList.innerHTML = '<div style="color: #718096;">// 插件已禁用</div>';
    const logCount = document.getElementById('log-count');
    if (logCount) logCount.innerText = '0';

    if (checkTimer) {
      clearInterval(checkTimer);
      checkTimer = null;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url.startsWith('http')) {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: () => {
            const ds = document.documentElement.dataset;
            delete ds.podnoteReady;
            delete ds.podnoteStatus;
            delete ds.podnoteFeatures;
            delete ds.podnoteLogs;
            window.__podnote_fnos_ready__ = false;
          }
        }).catch(() => {});
      }
    });
  }
}

function renderPageState(status, features, logs) {
  if (status === 'active' || status === 'injected') {
    runStatus.innerText = '已就绪';
    runStatus.className = 'stat-value ready';
    
    const hasMenu = features.includes('menu');
    const hasToolbar = features.includes('toolbar');
    
    featMenu.innerText = hasMenu ? '已注入' : '等待中';
    featMenu.className = 'stat-value ' + (hasMenu ? 'ready' : 'wait');
    
    featToolbar.innerText = hasToolbar ? '已注入' : '等待中';
    featToolbar.className = 'stat-value ' + (hasToolbar ? 'ready' : 'wait');
    
    updateLogs(logs);
  } else {
    runStatus.innerText = '正在连接...';
    runStatus.className = 'stat-value wait';
    featMenu.innerText = '等待中';
    featMenu.className = 'stat-value wait';
    featToolbar.innerText = '等待中';
    featToolbar.className = 'stat-value wait';
  }
}

function checkPageState() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0] || !tabs[0].url.startsWith('http')) return;

    isUrlAllowed(tabs[0].url, (allowed) => {
      if (!allowed) {
        runStatus.innerText = '未激活';
        runStatus.className = 'stat-value stop';
        featMenu.innerText = '已停止';
        featMenu.className = 'stat-value stop';
        featToolbar.innerText = '已停止';
        featToolbar.className = 'stat-value stop';
        const logList = document.getElementById('log-list');
        if (logList) logList.innerHTML = '<div style="color: #718096;">// 当前页面未激活 PodNote</div>';
        const logCount = document.getElementById('log-count');
        if (logCount) logCount.innerText = '0';
        return;
      }

      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: () => {
          const status = document.documentElement.dataset.podnoteStatus || 'inactive';
          const features = document.documentElement.dataset.podnoteFeatures || '';
          const logs = document.documentElement.dataset.podnoteLogs || '[]';
          return { status, features, logs };
        }
      }, (results) => {
        if (!enabledDoc.checked) return;

        if (results && results[0] && results[0].result) {
          const data = results[0].result;
          renderPageState(data.status, data.features, data.logs);
        } else {
          runStatus.innerText = '未激活';
          runStatus.className = 'stat-value stop';
          featMenu.innerText = '已停止';
          featMenu.className = 'stat-value stop';
          featToolbar.innerText = '已停止';
          featToolbar.className = 'stat-value stop';
          
          const logList = document.getElementById('log-list');
          logList.innerHTML = '<div style="color: #718096;">// 当前页面未激活 PodNote</div>';
        }
      });
    });
  });
}

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

function updateLogs(logsJson) {
  const logList = document.getElementById('log-list');
  const logCount = document.getElementById('log-count');
  if (!logList) return;

  let logs = [];
  try { logs = JSON.parse(logsJson); } catch(e) { return; }

  logCount.innerText = logs.length;
  
  if (logs.length === 0) {
    logList.innerHTML = '<div style="color: #6a9955;">// 暂无日志...</div>';
    return;
  }

  logList.innerHTML = logs.map(log => {
    let color = '#d4d4d4';
    if (log.s === 'sync') color = '#ce9178';
    if (log.s === 'success') color = '#b5cea8';
    if (log.s === 'error') color = '#f48771';
    
    return `<div style="margin-bottom: 4px;">
        <span style="color: #808080;">[${log.t}]</span> 
        <span style="color: ${color};">${log.m}</span>
    </div>`;
  }).join('');

  logList.scrollTop = logList.scrollHeight;
}

function showTip() {
  tipDoc.style.display = 'block';
  setTimeout(() => {
    tipDoc.style.display = 'none';
  }, 2000);
}

// 监听来自网页端的主动事件广播
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.action === 'status_update') {
    if (!enabledDoc.checked) return;

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && sender.tab && sender.tab.id === tabs[0].id) {
        isUrlAllowed(tabs[0].url, (allowed) => {
          if (allowed) {
            renderPageState(message.status, message.features, message.logs);
          }
        });
      }
    });
  }
});

checkPageState();
