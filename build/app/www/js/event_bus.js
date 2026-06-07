/**
 * event_bus.js - 全局事件总线，提供发布-订阅模式通信
 */
class EventBus {
    constructor() {
        this.listeners = {};
    }

    /**
     * 订阅事件
     */
    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    /**
     * 派发事件
     */
    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(cb => cb(data));
        }
    }

    /**
     * 取消订阅事件
     */
    off(event, callback) {
        if (!this.listeners[event]) return;
        if (!callback) {
            delete this.listeners[event];
            return;
        }
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
}

export const eventBus = new EventBus();
