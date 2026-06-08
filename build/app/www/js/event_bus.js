/**
 * event_bus.js - 全局事件总线，提供发布-订阅模式通信
 */
class EventBus {
    constructor() {
        this.listeners = new Map();
    }

    /**
     * 订阅事件
     */
    on(event, callback) {
        if (typeof callback !== 'function') {
            throw new TypeError('EventBus.on 需要函数回调');
        }

        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }

        const listeners = this.listeners.get(event);
        listeners.add(callback);

        let active = true;
        return () => {
            if (!active) return;
            active = false;
            this.off(event, callback);
        };
    }

    /**
     * 派发事件
     */
    emit(event, data) {
        const listeners = this.listeners.get(event);
        if (!listeners || listeners.size === 0) return;

        Array.from(listeners).forEach(cb => {
            try {
                cb(data);
            } catch (err) {
                console.error(`[EventBus] 事件 "${event}" 回调异常:`, err);
            }
        });
    }

    /**
     * 取消订阅事件
     */
    off(event, callback) {
        const listeners = this.listeners.get(event);
        if (!listeners) return;

        if (!callback) {
            this.listeners.delete(event);
            return;
        }

        listeners.delete(callback);
        if (listeners.size === 0) {
            this.listeners.delete(event);
        }
    }

    /**
     * 订阅一次性事件
     */
    once(event, callback) {
        const unsubscribe = this.on(event, (data) => {
            unsubscribe();
            callback(data);
        });
        return unsubscribe;
    }

    /**
     * 清理全部监听器
     */
    clear() {
        this.listeners.clear();
    }

    listenerCount(event) {
        return this.listeners.get(event)?.size || 0;
    }
}

export const eventBus = new EventBus();
