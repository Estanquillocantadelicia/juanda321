
// Sistema Centralizado de Manejo de Errores
class ErrorHandler {
    constructor() {
        this.errorLog = [];
        this.maxLogSize = 100;
        this.setupGlobalErrorHandlers();
    }

    // Configurar manejadores globales
    setupGlobalErrorHandlers() {
        // Capturar errores no manejados
        window.addEventListener('error', (event) => {
            this.handleError({
                type: 'runtime',
                message: event.message,
                source: event.filename,
                line: event.lineno,
                column: event.colno,
                error: event.error
            });
        });

        // Capturar promesas rechazadas no manejadas
        window.addEventListener('unhandledrejection', (event) => {
            this.handleError({
                type: 'promise',
                message: event.reason?.message || 'Promise rechazada',
                error: event.reason
            });
        });
    }

    // Manejar error y registrarlo
    handleError(errorInfo) {
        const errorEntry = {
            timestamp: new Date(),
            ...errorInfo,
            userAgent: navigator.userAgent,
            url: window.location.href
        };

        // Registrar en consola (desarrollo)
        console.error('🔴 Error capturado:', errorEntry);

        // Agregar al log
        this.errorLog.push(errorEntry);
        if (this.errorLog.length > this.maxLogSize) {
            this.errorLog.shift(); // Remover el más antiguo
        }

        // Mostrar notificación al usuario
        this.showUserNotification(errorInfo);

        // Opcional: Enviar a servidor de logs
        this.sendToServer(errorEntry);
    }

    // Mostrar notificación amigable al usuario
    showUserNotification(errorInfo) {
        const userMessage = this.getUserFriendlyMessage(errorInfo);
        
        if (window.eventBus) {
            window.eventBus.emit(window.APP_EVENTS.NOTIFICATION_SHOW, {
                message: userMessage,
                type: 'error'
            });
        } else {
            alert(userMessage);
        }
    }

    // Convertir error técnico en mensaje amigable
    getUserFriendlyMessage(errorInfo) {
        const errorMessages = {
            'NetworkError': 'Error de conexión. Verifica tu internet.',
            'permission-denied': 'No tienes permisos para esta operación.',
            'not-found': 'Recurso no encontrado.',
            'auth/user-not-found': 'Usuario no encontrado.',
            'auth/wrong-password': 'Contraseña incorrecta.',
            'auth/network-request-failed': 'Error de conexión. Verifica tu internet.'
        };

        const errorCode = errorInfo.error?.code || errorInfo.type;
        const errorMessage = errorInfo.error?.message || errorInfo.message;

        // Buscar mensaje personalizado
        for (const [key, value] of Object.entries(errorMessages)) {
            if (errorCode?.includes(key) || errorMessage?.includes(key)) {
                return value;
            }
        }

        // Mensaje genérico
        return 'Ocurrió un error inesperado. Por favor, intenta nuevamente.';
    }

    // Enviar error al servidor (opcional)
    async sendToServer(errorEntry) {
        // Solo en producción
        if (window.location.hostname === 'localhost') return;

        try {
            // Aquí puedes implementar el envío a tu backend
            // await fetch('/api/log-error', {
            //     method: 'POST',
            //     headers: { 'Content-Type': 'application/json' },
            //     body: JSON.stringify(errorEntry)
            // });
        } catch (error) {
            console.warn('No se pudo enviar error al servidor:', error);
        }
    }

    // Wrapper para funciones asíncronas
    async wrapAsync(fn, context = null) {
        try {
            return await fn();
        } catch (error) {
            this.handleError({
                type: 'async',
                message: error.message,
                error,
                context
            });
            throw error; // Re-lanzar para que el código pueda manejarlo también
        }
    }

    // Wrapper para operaciones de Firebase
    async wrapFirebaseOperation(operation, operationName) {
        try {
            return await operation();
        } catch (error) {
            this.handleError({
                type: 'firebase',
                operation: operationName,
                message: error.message,
                error
            });
            throw error;
        }
    }

    // Obtener log de errores
    getErrorLog() {
        return this.errorLog;
    }

    // Limpiar log de errores
    clearErrorLog() {
        this.errorLog = [];
    }
}

// Instancia global
window.errorHandler = new ErrorHandler();

console.log('🛡️ Sistema de manejo de errores activado');
