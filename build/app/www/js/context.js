/**
 * context.js - 统一维护全局共享状态
 */
import { eventBus } from './event_bus.js';

export const AppContext = {
    state: {
        currentPath: '',
        workspacePath: '',
        currentEncoding: 'utf-8',
        originalEncoding: 'utf-8',
        originalContent: '',
        lastMtime: 0,
        lastSize: 0,
        isEditMode: false,
        isProcessing: false,
    },

    /**
     * 更新状态并分发变更事件
     */
    update(newState) {
        Object.assign(this.state, newState);
        eventBus.emit('state:changed', this.state);
    }
};
