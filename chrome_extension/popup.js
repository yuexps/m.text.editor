const enabledDoc = document.getElementById('enabled');
const patternDoc = document.getElementById('pattern');
const statusDoc = document.getElementById('status');
const tipDoc = document.getElementById('save-tip');

// 加载初始状态
chrome.storage.local.get(['enabled', 'matchPattern'], (data) => {
  enabledDoc.checked = data.enabled !== false;
  patternDoc.value = data.matchPattern || 'fnos.net //默认允许的域名\n:5666,:5667 //默认允许的端口';
  updateStatus(enabledDoc.checked);
});

// 监听开关变化
enabledDoc.addEventListener('change', () => {
  const isEnabled = enabledDoc.checked;
  chrome.storage.local.set({ enabled: isEnabled });
  updateStatus(isEnabled);
  showTip();
});

// 监听输入框变化 (防抖处理)
let timer;
patternDoc.addEventListener('input', () => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    chrome.storage.local.set({ matchPattern: patternDoc.value });
    showTip();
  }, 500);
});

function updateStatus(active) {
  if (active) {
    statusDoc.innerText = '运行中';
    statusDoc.classList.add('active');
  } else {
    statusDoc.innerText = '已禁用';
    statusDoc.classList.remove('active');
  }
}

function showTip() {
  tipDoc.style.display = 'block';
  setTimeout(() => {
    tipDoc.style.display = 'none';
  }, 2000);
}
