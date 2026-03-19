
// Sistema de Sincronización en Tiempo Real
class RealtimeSync {
    constructor() {
        this.activeListeners = new Map();
        this.moduleCallbacks = new Map();
    }

    // Escuchar cambios en una colección
    listenToCollection(collectionName, callback, moduleId = null) {
        // Evitar duplicados
        const listenerId = `${collectionName}_${moduleId || 'global'}`;
        
        if (this.activeListeners.has(listenerId)) {
            console.log(`⚠️ Ya existe un listener para ${collectionName}`);
            return;
        }

        // Crear listener de Firestore
        const unsubscribe = window.db.collection(collectionName)
            .onSnapshot(
                (snapshot) => {
                    const changes = {
                        added: [],
                        modified: [],
                        removed: []
                    };

                    snapshot.docChanges().forEach((change) => {
                        const data = {
                            id: change.doc.id,
                            ...change.doc.data()
                        };

                        if (change.type === 'added') {
                            changes.added.push(data);
                        } else if (change.type === 'modified') {
                            changes.modified.push(data);
                        } else if (change.type === 'removed') {
                            changes.removed.push(data);
                        }
                    });

                    // Llamar callback solo si hay cambios
                    if (changes.added.length > 0 || changes.modified.length > 0 || changes.removed.length > 0) {
                        callback(changes);
                    }
                },
                (error) => {
                    console.error(`❌ Error en listener de ${collectionName}:`, error);
                }
            );

        // Guardar listener
        this.activeListeners.set(listenerId, {
            unsubscribe,
            collectionName,
            moduleId
        });

        console.log(`👂 Listener activo para: ${collectionName}`);

        // Retornar función para detener el listener
        return () => this.stopListener(listenerId);
    }

    // Detener un listener específico
    stopListener(listenerId) {
        const listener = this.activeListeners.get(listenerId);
        
        if (listener) {
            listener.unsubscribe();
            this.activeListeners.delete(listenerId);
            console.log(`🔇 Listener detenido: ${listenerId}`);
        }
    }

    // Detener todos los listeners de un módulo
    stopModuleListeners(moduleId) {
        for (const [listenerId, listener] of this.activeListeners.entries()) {
            if (listener.moduleId === moduleId) {
                this.stopListener(listenerId);
            }
        }
    }

    // Detener todos los listeners
    stopAllListeners() {
        for (const [listenerId] of this.activeListeners.entries()) {
            this.stopListener(listenerId);
        }
    }

    // Obtener listeners activos
    getActiveListeners() {
        return Array.from(this.activeListeners.keys());
    }
}

// Instancia global
window.realtimeSync = new RealtimeSync();

console.log('🔄 Sistema de sincronización en tiempo real activado');
