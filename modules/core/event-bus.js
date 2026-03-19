
// Sistema de eventos global para comunicación entre módulos
class GlobalEventBus {
    constructor() {
        this.events = new EventTarget();
        this.listeners = new Map();
    }

    // Suscribirse a eventos
    on(eventName, callback, moduleId = null) {
        const listener = { callback, moduleId };
        
        if (!this.listeners.has(eventName)) {
            this.listeners.set(eventName, []);
        }
        
        this.listeners.get(eventName).push(listener);
        this.events.addEventListener(eventName, callback);
        
        return () => this.off(eventName, callback);
    }

    // Eliminar suscripción
    off(eventName, callback) {
        this.events.removeEventListener(eventName, callback);
        
        if (this.listeners.has(eventName)) {
            const listeners = this.listeners.get(eventName);
            const index = listeners.findIndex(l => l.callback === callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }

    // Emitir evento
    emit(eventName, data = null) {
        const event = new CustomEvent(eventName, { detail: data });
        this.events.dispatchEvent(event);
    }

    // Limpiar eventos de un módulo específico
    cleanupModule(moduleId) {
        for (const [eventName, listeners] of this.listeners.entries()) {
            const filteredListeners = listeners.filter(l => l.moduleId !== moduleId);
            this.listeners.set(eventName, filteredListeners);
        }
    }
}

// Instancia global
window.eventBus = new GlobalEventBus();

// Eventos predefinidos para tu aplicación
const APP_EVENTS = {
    USER_CREATED: 'user:created',
    USER_UPDATED: 'user:updated',
    USER_DELETED: 'user:deleted',
    INVENTORY_UPDATED: 'inventory:updated',
    SALE_COMPLETED: 'sale:completed',
    VENTA_COMPLETADA: 'venta:completada', // Nuevo evento específico
    MODULE_LOADED: 'module:loaded',
    MODULE_UNLOADED: 'module:unloaded',
    NOTIFICATION_SHOW: 'notification:show'
};

window.APP_EVENTS = APP_EVENTS;
