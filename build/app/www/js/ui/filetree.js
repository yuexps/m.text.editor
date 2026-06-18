/**
 * filetree.js - 文件树渲染与交互管理
 */

import { Log, checkIsMobile, checkIsNarrowScreen } from '../utils.js';
import { AppContext } from '../context.js';
import { eventBus } from '../event_bus.js';
import { API } from '../api.js';
import { els } from './elements.js';
import { showPrompt } from './dialog.js';
import { showToast, updateStatus } from './feedback.js';
import { collapseSidebar } from './sidebar.js';

function getIconClass(name, isDir) {
    if (isDir) return 'icon-color-folder';
    const ext = name.split('.').pop().toLowerCase();
    const classMap = {
        'js': 'icon-color-js', 'ts': 'icon-color-js', 'jsx': 'icon-color-js', 'tsx': 'icon-color-js',
        'go': 'icon-color-go',
        'py': 'icon-color-py',
        'html': 'icon-color-html', 'vue': 'icon-color-html',
        'css': 'icon-color-css', 'scss': 'icon-color-css', 'less': 'icon-color-css',
        'json': 'icon-color-json', 'toml': 'icon-color-json',
        'md': 'icon-color-md',
        'sh': 'icon-color-sh', 'bash': 'icon-color-sh'
    };
    return classMap[ext] || '';
}

export function createTreeItem(file, level) {
    const item = document.createElement('div');
    item.className = 'tree-item';
    item.setAttribute('data-path', file.path);
    item.setAttribute('data-is-dir', file.is_dir);
    item.setAttribute('data-size', file.size || 0);
    item.setAttribute('data-mtime', file.mtime || 0);
    if (file.is_symlink) {
        item.setAttribute('data-is-symlink', 'true');
    }
    item.style.paddingLeft = `${level * 12 + 12}px`;

    const arrow = document.createElement('span');
    arrow.className = 'tree-item-arrow';
    if (file.is_dir) {
        arrow.innerHTML = `<svg width="14" height="14" viewBox="0 0 16 16"><path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M10.072 8.024L5.707 3.659l.707-.707 5.072 5.072-5.072 5.072-.707-.707 4.365-4.365z"/></svg>`;
    }
    item.appendChild(arrow);

    const icon = document.createElement('span');
    icon.className = `tree-item-icon ${getIconClass(file.name, file.is_dir)}`;
    if (file.is_symlink) {
        icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h8v4h4v12zm-6-3c-1.1 0-2-.9-2-2V9.5c0-.28.22-.5.5-.5s.5.22.5.5V15h2V9.5a2.5 2.5 0 0 0-5 0V15c0 2.21 1.79 4 4 4s4-1.79 4-4v-4h-2v4c0 1.1-.9 2-2 2z" fill="currentColor"></path></svg>`;
    } else if (file.is_dir) {
        icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3v4a1 1 0 0 0 1 1h4"></path><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"></path><path d="M9 9h1"></path><path d="M9 13h6"></path><path d="M9 17h6"></path></g></svg>`;
    } else {
        const ext = file.name.split('.').pop().toLowerCase();
        if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) {
            icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 384 512"><path d="M369.9 97.9L286 14C277 5 264.8-.1 252.1-.1H48C21.5 0 0 21.5 0 48v416c0 26.5 21.5 48 48 48h288c26.5 0 48-21.5 48-48V131.9c0-12.7-5.1-25-14.1-34zM332.1 128H256V51.9l76.1 76.1zM48 464V48h160v104c0 13.3 10.7 24 24 24h104v288H48zm32-48h224V288l-23.5-23.5c-4.7-4.7-12.3-4.7-17 0L176 352l-39.5-39.5c-4.7-4.7-12.3-4.7-17 0L80 352v64zm48-240c-26.5 0-48 21.5-48 48s21.5 48 48 48s48-21.5 48-48s-21.5-48-48-48z" fill="currentColor"></path></svg>`;
        } else if (['mp3', 'wav', 'ogg'].includes(ext)) {
            icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3v4a1 1 0 0 0 1 1h4"></path><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"></path><circle cx="11" cy="16" r="1"></circle><path d="M12 16v-5l2 1"></path></g></svg>`;
        } else if (ext === 'pdf') {
            icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 384 512"><path d="M369.9 97.9L286 14C277 5 264.8-.1 252.1-.1H48C21.5 0 0 21.5 0 48v416c0 26.5 21.5 48 48 48h288c26.5 0 48-21.5 48-48V131.9c0-12.7-5.1-25-14.1-34zM332.1 128H256V51.9l76.1 76.1zM48 464V48h160v104c0 13.3 10.7 24 24 24h104v288H48zm250.2-143.7c-12.2-12-47-8.7-64.4-6.5c-17.2-10.5-28.7-25-36.8-46.3c3.9-16.1 10.1-40.6 5.4-56c-4.2-26.2-37.8-23.6-42.6-5.9c-4.4 16.1-.4 38.5 7 67.1c-10 23.9-24.9 56-35.4 74.4c-20 10.3-47 26.2-51 46.2c-3.3 15.8 26 55.2 76.1-31.2c22.4-7.4 46.8-16.5 68.4-20.1c18.9 10.2 41 17 55.8 17c25.5 0 28-28.2 17.5-38.7zm-198.1 77.8c5.1-13.7 24.5-29.5 30.4-35c-19 30.3-30.4 35.7-30.4 35zm81.6-190.6c7.4 0 6.7 32.1 1.8 40.8c-4.4-13.9-4.3-40.8-1.8-40.8zm-24.4 136.6c9.7-16.9 18-37 24.7-54.7c8.3 15.1 18.9 27.2 30.1 35.5c-20.8 4.3-38.9 13.1-54.8 19.2zm131.6-5s-5 6-37.3-7.8c35.1-2.6 40.9 5.4 37.3 7.8z" fill="currentColor"></path></svg>`;
        } else if (ext === 'docx') {
            icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 384 512"><path d="M369.9 97.9L286 14C277 5 264.8-.1 252.1-.1H48C21.5 0 0 21.5 0 48v416c0 26.5 21.5 48 48 48h288c26.5 0 48-21.5 48-48V131.9c0-12.7-5.1-25-14.1-34zM332.1 128H256V51.9l76.1 76.1zM48 464V48h160v104c0 13.3 10.7 24 24 24h104v288H48zm220.1-208c-5.7 0-10.6 4-11.7 9.5c-20.6 97.7-20.4 95.4-21 103.5c-.2-1.2-.4-2.6-.7-4.3c-.8-5.1.3.2-23.6-99.5c-1.3-5.4-6.1-9.2-11.7-9.2h-13.3c-5.5 0-10.3 3.8-11.7 9.1c-24.4 99-24 96.2-24.8 103.7c-.1-1.1-.2-2.5-.5-4.2c-.7-5.2-14.1-73.3-19.1-99c-1.1-5.6-6-9.7-11.8-9.7h-16.8c-7.8 0-13.5 7.3-11.7 14.8c8 32.6 26.7 109.5 33.2 136c1.3 5.4 6.1 9.1 11.7 9.1h25.2c5.5 0 10.3-3.7 11.6-9.1l17.9-71.4c1.5-6.2 2.5-12 3-17.3l2.9 17.3c.1.4 12.6 50.5 17.9 71.4c1.3 5.3 6.1 9.1 11.6 9.1h24.7c5.5 0 10.3-3.7 11.6-9.1c20.8-81.9 30.2-119 34.5-136c1.9-7.6-3.8-14.9-11.6-14.9h-15.8z" fill="currentColor"></path></svg>`;
        } else if (['md', 'markdown'].includes(ext)) {
            icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 1024 1024"><path d="M854.6 288.6L639.4 73.4c-6-6-14.1-9.4-22.6-9.4H192c-17.7 0-32 14.3-32 32v832c0 17.7 14.3 32 32 32h640c17.7 0 32-14.3 32-32V311.3c0-8.5-3.4-16.7-9.4-22.7zM790.2 326H602V137.8L790.2 326zm1.8 562H232V136h302v216a42 42 0 0 0 42 42h216v494zM429 481.2c-1.9-4.4-6.2-7.2-11-7.2h-35c-6.6 0-12 5.4-12 12v272c0 6.6 5.4 12 12 12h27.1c6.6 0 12-5.4 12-12V582.1l66.8 150.2a12 12 0 0 0 11 7.1H524c4.7 0 9-2.8 11-7.1l66.8-150.6V758c0 6.6 5.4 12 12 12H641c6.6 0 12-5.4 12-12V486c0-6.6-5.4-12-12-12h-34.7c-4.8 0-9.1 2.8-11 7.2l-83.1 191l-83.2-191z" fill="currentColor"></path></svg>`;
        } else if (['css', 'scss', 'less'].includes(ext)) {
            icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><g fill="none"><path d="M18 20.5a.5.5 0 0 0 .5-.5V10H14a2 2 0 0 1-2-2V3.5H6a.5.5 0 0 0-.5.5v10.627a3.482 3.482 0 0 0-1.5-.592V4a2 2 0 0 1 2-2h6.172c.028 0 .055.004.082.007c.02.003.04.006.059.007c.215.015.427.056.624.138c.057.024.112.056.166.087l.05.029l.047.024a.652.652 0 0 1 .081.044c.078.053.148.116.219.18a.63.63 0 0 0 .036.03a.491.491 0 0 1 .049.04l5.829 5.828A2 2 0 0 1 20 9.828V20a2 2 0 0 1-2 2h-1.736c.364-.413.615-.93.702-1.5H18zm-.622-12L13.5 4.621V8a.5.5 0 0 0 .5.5h3.378zm-5.326 12c.203.86.976 1.5 1.898 1.5h.1A1.95 1.95 0 0 0 16 20.05v-.234a1.75 1.75 0 0 0-.85-1.5l-1.529-.918a.25.25 0 0 1-.121-.214v-.234a.45.45 0 0 1 .45-.45h.1a.45.45 0 0 1 .45.45V17a.75.75 0 0 0 1.5 0v-.05A1.95 1.95 0 0 0 14.05 15h-.1A1.95 1.95 0 0 0 12 16.95v.234c0 .614.322 1.184.85 1.5l1.529.918a.25.25 0 0 1 .121.214v.234a.45.45 0 0 1-.45.45h-.1a.45.45 0 0 1-.45-.45V20a.75.75 0 0 0-1.5 0v.05c0 .155.018.305.052.45zM5.95 22l.05-.05V22h-.05zm1.297-1A1.938 1.938 0 0 1 7 20.05V20a.75.75 0 0 1 1.5 0v.05c0 .248.201.45.45.45h.1a.45.45 0 0 0 .45-.45v-.234a.25.25 0 0 0-.121-.214l-1.53-.918a1.75 1.75 0 0 1-.849-1.5v-.234A1.95 1.95 0 0 1 8.95 15h.1A1.95 1.95 0 0 1 11 16.95V17a.75.75 0 0 1-1.5 0v-.05a.45.45 0 0 0-.45-.45h-.1a.45.45 0 0 0-.45.45v.234c0 .088.046.169.121.214l1.53.918c.527.316.849.886.849 1.5v.234a1.957 1.957 0 0 1-.247.95a1.95 1.95 0 0 1-1.703 1h-.1a1.95 1.95 0 0 1-1.703-1zm-1.439-.538c.124-.296.192-.621.192-.962a.75.75 0 1 0-1.5 0a1 1 0 1 1-2 0v-2a1 1 0 1 1 2 0a.75.75 0 1 0 1.5 0a2.5 2.5 0 1 0-5 0v2a2.5 2.5 0 0 0 4.808.962z" fill="currentColor"></path></g></svg>`;
        } else if (['js', 'ts', 'jsx', 'tsx'].includes(ext)) {
            icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><g fill="none"><path d="M18 20.5h-7.034a2.939 2.939 0 0 1-.702 1.5H18a2 2 0 0 0 2-2V9.828a2 2 0 0 0-.586-1.414l-5.829-5.828a.491.491 0 0 0-.049-.04a.63.63 0 0 1-.036-.03a2.072 2.072 0 0 0-.219-.18a.652.652 0 0 0-.08-.044l-.048-.024l-.05-.029c-.054-.031-.109-.063-.166-.087a1.977 1.977 0 0 0-.624-.138c-.02-.001-.04-.004-.059-.007A.605.605 0 0 0 12.172 2H6a2 2 0 0 0-2 2v10.018a1.745 1.745 0 0 1 1.5.508V4a.5.5 0 0 1 .5-.5h6V8a2 2 0 0 0 2 2h4.5v10a.5.5 0 0 1-.5.5zm-.622-12H14a.5.5 0 0 1-.5-.5V4.621L17.378 8.5zM4.25 15a.75.75 0 0 1 .75.75V20a2 2 0 1 1-4 0v-.25a.75.75 0 0 1 1.5 0V20a.5.5 0 0 0 1 0v-4.25a.75.75 0 0 1 .75-.75zm3.7 0A1.95 1.95 0 0 0 6 16.95v.234c0 .614.323 1.184.85 1.5l1.529.918a.25.25 0 0 1 .121.214v.234a.45.45 0 0 1-.45.45h-.1a.45.45 0 0 1-.45-.45V20A.75.75 0 0 0 6 20v.05A1.95 1.95 0 0 0 7.95 22h.1A1.95 1.95 0 0 0 10 20.05v-.234a1.75 1.75 0 0 0-.85-1.5l-1.529-.918a.25.25 0 0 1-.121-.214v-.234a.45.45 0 0 1 .45-.45h.1a.45.45 0 0 1 .45.45V17a.75.75 0 0 0 1.5 0v-.05A1.95 1.95 0 0 0 8.05 15h-.1z" fill="currentColor"></path></g></svg>`;
        } else {
            icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3v4a1 1 0 0 0 1 1h4"></path><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"></path></g></svg>`;
        }
    }
    item.appendChild(icon);

    const label = document.createElement('span');
    label.className = 'tree-item-label';
    label.innerText = file.name;
    item.appendChild(label);

    return item;
}

export function renderFileTree(container, files, level = 0) {
    container.innerHTML = '';
    if (!files || files.length === 0) {
        container.innerHTML = '<div class="tree-empty-hint">此工作区为空</div>';
        return;
    }

    files.forEach(file => {
        const item = createTreeItem(file, level);
        container.appendChild(item);

        if (file.is_dir) {
            const childContainer = document.createElement('div');
            childContainer.className = 'tree-children';
            const safeId = btoa(encodeURIComponent(file.path)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
            childContainer.id = `children-${safeId}`;
            container.appendChild(childContainer);
        }
    });
}

/**
 * 刷新子目录内容
 */
async function refreshChildContainer(container, targetDir, level) {
    const data = await API.list(targetDir);
    container.innerHTML = '';
    if (data.files && data.files.length > 0) {
        data.files.forEach(file => {
            const subItem = createTreeItem(file, level);
            container.appendChild(subItem);
            if (file.is_dir) {
                const subChildContainer = document.createElement('div');
                subChildContainer.className = 'tree-children';
                const subSafeId = btoa(encodeURIComponent(file.path)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
                subChildContainer.id = `children-${subSafeId}`;
                container.appendChild(subChildContainer);
            }
        });
    } else {
        const indent = level * 12 + 12;
        container.innerHTML = '<div style="padding: 4px ' + indent + 'px; opacity: 0.3; font-size:12px; font-style: italic;">空文件夹</div>';
    }
}

/**
 * 新建文件流程
 */
export async function handleNewFileInTree() {
    const workspacePath = AppContext.state.workspacePath;
    if (!workspacePath) {
        showToast('尚未打开工作区', true);
        return;
    }

    let targetDir = workspacePath;
    const activeItem = els.fileTree.querySelector('.tree-item.active');
    if (activeItem) {
        const itemPath = activeItem.getAttribute('data-path');
        const isDir = activeItem.getAttribute('data-is-dir') === 'true';
        if (isDir) {
            targetDir = itemPath;
        } else {
            const lastSlash = Math.max(itemPath.lastIndexOf('/'), itemPath.lastIndexOf('\\'));
            if (lastSlash !== -1) {
                targetDir = itemPath.substring(0, lastSlash);
            }
        }
    }

    let container = els.fileTree;
    let level = 0;
    const isRoot = targetDir === workspacePath;

    if (!isRoot) {
        const safeId = btoa(encodeURIComponent(targetDir)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
        container = document.getElementById(`children-${safeId}`);

        const parentItem = Array.from(els.fileTree.querySelectorAll('.tree-item')).find(el => el.getAttribute('data-path') === targetDir);
        if (parentItem) {
            const currentPadding = parseInt(parentItem.style.paddingLeft) || 12;
            level = Math.floor((currentPadding - 12) / 12) + 1;
            const arrow = parentItem.querySelector('.tree-item-arrow');
            if (arrow) arrow.classList.add('expanded');
        }
        if (container) {
            container.classList.add('visible');
        }
    }

    if (checkIsMobile()) {
        const workspaceName = workspacePath.split(/[/\\]/).pop() || '工作区';
        let displayDir = '';
        if (targetDir === workspacePath) {
            displayDir = workspaceName;
        } else if (targetDir.startsWith(workspacePath)) {
            const rel = targetDir.substring(workspacePath.length).replace(/^[/\\]+/, '');
            displayDir = workspaceName + '/' + rel.replace(/\\/g, '/');
        } else {
            displayDir = targetDir.replace(/\\/g, '/');
        }

        const filename = await showPrompt(`请输入文件名 (./${displayDir}/)：`, '', '新建文件');
        if (!filename) return;

        const separator = targetDir.includes('\\') ? '\\' : '/';
        const filePath = targetDir.endsWith(separator) ? (targetDir + filename) : (targetDir + separator + filename);

        try {
            updateStatus('正在创建文件...');
            await API.newFile(filePath);
            showToast('文件创建成功');

            if (isRoot || !container) {
                eventBus.emit('workspace:refresh-request');
            } else {
                await refreshChildContainer(container, targetDir, level);
            }
            eventBus.emit('file:open-request', { path: filePath, isNew: true });
        } catch (err) {
            showToast('创建失败: ' + err.message, true);
            updateStatus('创建失败', '#f44336');
        }
        return;
    }

    if (!container) return;

    const emptyHint = container.querySelector('.tree-empty-hint') ||
        Array.from(container.children).find(el => el.innerText.includes('空文件夹') || el.innerText.includes('加载中'));
    if (emptyHint) {
        emptyHint.style.display = 'none';
    }

    const existingTemp = container.querySelector('.temp-new-file-item');
    if (existingTemp) {
        const input = existingTemp.querySelector('input');
        if (input) input.focus();
        return;
    }

    const tempItem = document.createElement('div');
    tempItem.className = 'tree-item temp-new-file-item';
    tempItem.style.paddingLeft = `${level * 12 + 12}px`;
    tempItem.innerHTML = `
        <span class="tree-item-arrow"></span>
        <span class="tree-item-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3v4a1 1 0 0 0 1 1h4"></path><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"></path></g></svg>
        </span>
        <input type="text" class="tree-item-input" placeholder="文件名" />
    `;

    container.insertBefore(tempItem, container.firstChild);

    const input = tempItem.querySelector('input');
    if (input) input.focus();

    let isSubmitting = false;
    let blurTimer = null;

    const cleanUp = () => {
        if (blurTimer) {
            clearTimeout(blurTimer);
            blurTimer = null;
        }
        input.onblur = null;
        input.onkeydown = null;
        if (tempItem.parentNode) tempItem.remove();
        if (emptyHint && container.children.length === 0) {
            emptyHint.style.display = '';
        }
    };

    const submitNewFile = async () => {
        const filename = input.value.trim();
        if (!filename) {
            showToast('文件名不能为空', true);
            cleanUp();
            return;
        }

        const separator = targetDir.includes('\\') ? '\\' : '/';
        const filePath = targetDir.endsWith(separator) ? (targetDir + filename) : (targetDir + separator + filename);

        try {
            isSubmitting = true;
            updateStatus('正在创建文件...');
            await API.newFile(filePath);
            showToast('文件创建成功');

            cleanUp();

            if (isRoot) {
                eventBus.emit('workspace:refresh-request');
            } else {
                await refreshChildContainer(container, targetDir, level);
            }

            eventBus.emit('file:open-request', { path: filePath, isNew: true });
        } catch (err) {
            Log.error('IO', '创建文件失败:', err);
            showToast('创建失败: ' + err.message, true);
            updateStatus('创建失败', '#f44336');
            cleanUp();
        } finally {
            isSubmitting = false;
        }
    };

    input.onkeydown = async (e) => {
        if (e.key === 'Enter') {
            input.onblur = null;
            input.disabled = true;
            await submitNewFile();
        } else if (e.key === 'Escape') {
            cleanUp();
        }
    };

    input.onblur = () => {
        blurTimer = setTimeout(() => {
            if (!isSubmitting) cleanUp();
        }, 150);
    };
}

/**
 * 初始化文件树交互事件（点击、新建、刷新）
 */
export function initFileTreeEvents(uiDisp) {
    // 文件树点击事件
    if (els.fileTree) {
        const handleFileTreeClick = async (e) => {
            const item = e.target.closest('.tree-item');
            if (!item || item.classList.contains('temp-new-file-item')) return;

            const path = item.getAttribute('data-path');
            const isDir = item.getAttribute('data-is-dir') === 'true';

            if (isDir) {
                els.fileTree.querySelectorAll('.tree-item').forEach(el => el.classList.remove('active'));
                item.classList.add('active');

                const arrow = item.querySelector('.tree-item-arrow');
                const safeId = btoa(encodeURIComponent(path)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
                const childContainer = document.getElementById(`children-${safeId}`);

                if (childContainer) {
                    const isVisible = childContainer.classList.contains('visible');
                    if (isVisible) {
                        childContainer.classList.remove('visible');
                        if (arrow) arrow.classList.remove('expanded');
                    } else {
                        childContainer.classList.add('visible');
                        if (arrow) arrow.classList.add('expanded');

                        if (childContainer.children.length === 0) {
                            const currentPadding = parseInt(item.style.paddingLeft) || 12;
                            const nextLevel = Math.floor((currentPadding - 12) / 12) + 1;
                            const indent = nextLevel * 12 + 12;

                            childContainer.innerHTML = "<div style=\"padding: 4px " + indent + "px; opacity: 0.5; font-size:12px;\">加载中...</div>";
                            try {
                                const data = await API.list(path);
                                childContainer.innerHTML = '';
                                if (data.files && data.files.length > 0) {
                                    data.files.forEach(file => {
                                        const subItem = createTreeItem(file, nextLevel);
                                        childContainer.appendChild(subItem);
                                        if (file.is_dir) {
                                            const subChildContainer = document.createElement('div');
                                            subChildContainer.className = 'tree-children';
                                            const subSafeId = btoa(encodeURIComponent(file.path)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
                                            subChildContainer.id = `children-${subSafeId}`;
                                            childContainer.appendChild(subChildContainer);
                                        }
                                    });
                                } else {
                                    childContainer.innerHTML = "<div style=\"padding: 4px " + indent + "px; opacity: 0.3; font-size:12px; font-style: italic;\">空文件夹</div>";
                                }
                            } catch (err) {
                                Log.error('Workspace', '加载子目录失败:', err);
                                childContainer.innerHTML = "<div style=\"padding: 4px " + indent + "px; color:#f44336; font-size:12px;\">加载失败</div>";
                            }
                        }
                    }
                }
            } else {
                els.fileTree.querySelectorAll('.tree-item').forEach(el => el.classList.remove('active'));
                const size = parseInt(item.getAttribute('data-size')) || 0;
                const mtime = parseInt(item.getAttribute('data-mtime')) || 0;
                eventBus.emit('file:open-request', { path, size, mtime });
                if (checkIsNarrowScreen()) {
                    collapseSidebar();
                }
            }
        };
        els.fileTree.addEventListener('click', handleFileTreeClick);
        uiDisp.add(() => els.fileTree.removeEventListener('click', handleFileTreeClick));
    }

    // 快捷创建按钮
    if (els.sidebarNewFileBtn) {
        const handleNewFileBtnClick = () => handleNewFileInTree();
        els.sidebarNewFileBtn.addEventListener('click', handleNewFileBtnClick);
        uiDisp.add(() => els.sidebarNewFileBtn.removeEventListener('click', handleNewFileBtnClick));
    }

    // 欢迎页新建文件按钮
    if (els.createPathBtn) {
        const handleCreatePathBtnClick = () => handleNewFileInTree();
        els.createPathBtn.addEventListener('click', handleCreatePathBtnClick);
        uiDisp.add(() => els.createPathBtn.removeEventListener('click', handleCreatePathBtnClick));
    }

    // 刷新按钮
    if (els.refreshTreeBtn) {
        const handleRefreshTreeBtnClick = () => {
            const workspacePath = AppContext.state.workspacePath;
            if (workspacePath) {
                eventBus.emit('workspace:refresh-request');
                showToast('工作区已刷新');
            } else {
                showToast('尚未打开工作区');
            }
        };
        els.refreshTreeBtn.addEventListener('click', handleRefreshTreeBtnClick);
        uiDisp.add(() => els.refreshTreeBtn.removeEventListener('click', handleRefreshTreeBtnClick));
    }
}

export { getIconClass };
