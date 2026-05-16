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
    
    // 启动定时轮询，每秒同步一次状态和日志
    if (!checkTimer) {
      checkPageState();
      checkTimer = setInterval(checkPageState, 1000);
    }
  } else {
    statusDoc.innerText = '已禁用';
    statusDoc.classList.remove('active');
    featArea.style.display = 'block'; // 保持可见
    
    // 1. 清理面板 UI 残留并设为“已停止”
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

    // 2. 停止轮询
    if (checkTimer) {
      clearInterval(checkTimer);
      checkTimer = null;
    }

    // 3. 主动尝试清理网页 DOM 上的标记 (双重保险)
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url.startsWith('http')) {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: () => {
            const ds = document.documentElement.dataset;
            delete ds.notepodReady;
            delete ds.notepodStatus;
            delete ds.notepodFeatures;
            delete ds.notepodLogs;
            window.__notepod_fnos_ready__ = false;
          }
        }).catch(() => {});
      }
    });
  }
}

// 检查当前飞牛页面的注入状态
function checkPageState() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0] || !tabs[0].url.startsWith('http')) return;

    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: () => {
        const status = document.documentElement.dataset.notepodStatus || 'inactive';
        const features = document.documentElement.dataset.notepodFeatures || '';
        const logs = document.documentElement.dataset.notepodLogs || '[]';
        return { status, features, logs };
      }
    }, (results) => {
      // 二次校验：如果此时插件已被手动关闭，则拒绝更新 UI
      if (!enabledDoc.checked) return;

      if (results && results[0] && results[0].result) {
        const data = results[0].result;
        
        if (data.status === 'active' || data.status === 'injected') {
          // 状态 4: 已就绪 (Ready)
          runStatus.innerText = '已就绪';
          runStatus.className = 'stat-value ready';
          
          const hasMenu = data.features.includes('menu');
          const hasToolbar = data.features.includes('toolbar');
          
          featMenu.innerText = hasMenu ? '已注入' : '等待中';
          featMenu.className = 'stat-value ' + (hasMenu ? 'ready' : 'wait');
          
          featToolbar.innerText = hasToolbar ? '已注入' : '等待中';
          featToolbar.className = 'stat-value ' + (hasToolbar ? 'ready' : 'wait');
          
          // 渲染日志
          updateLogs(data.logs);
        } else {
          // 状态 3: 正在连接 (Wait)
          runStatus.innerText = '正在连接...';
          runStatus.className = 'stat-value wait';
          featMenu.innerText = '等待中';
          featMenu.className = 'stat-value wait';
          featToolbar.innerText = '等待中';
          featToolbar.className = 'stat-value wait';
        }
      } else {
        // 状态 2: 未开启 (Inactive) - 非匹配页面或注入失败
        runStatus.innerText = '未激活';
        runStatus.className = 'stat-value stop';
        featMenu.innerText = '已停止';
        featMenu.className = 'stat-value stop';
        featToolbar.innerText = '已停止';
        featToolbar.className = 'stat-value stop';
        
        const logList = document.getElementById('log-list');
        if (logList && !logList.innerText.includes('监听')) {
          logList.innerHTML = '<div style="color: #718096;">// 当前页面未激活 NotePod++</div>';
        }
      }
    });
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
        if (log.s === 'sync') color = '#ce9178'; // 路径同步 - 橙色
        if (log.s === 'success') color = '#b5cea8'; // 成功 - 绿色
        if (log.s === 'error') color = '#f48771'; // 错误 - 红色
        
        return `<div style="margin-bottom: 4px;">
            <span style="color: #808080;">[${log.t}]</span> 
            <span style="color: ${color};">${log.m}</span>
        </div>`;
    }).join('');

    // 自动滚动到底部
    logList.scrollTop = logList.scrollHeight;
}

function showTip() {
  tipDoc.style.display = 'block';
  setTimeout(() => {
    tipDoc.style.display = 'none';
  }, 2000);
}

// 启动时检查一次
checkPageState();
