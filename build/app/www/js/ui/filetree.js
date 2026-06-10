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
        icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3v4a1 1 0 0 0 1 1h4"></path><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"></path></g></svg>`;
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
                item.classList.add('active');
                eventBus.emit('file:open-request', { path });
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
