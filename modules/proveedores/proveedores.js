
// Módulo de Proveedores - Lógica independiente
class ProveedoresModule {
    constructor() {
        this.proveedores = [];
        this.editingProveedor = null;
        this.moduleId = 'proveedores';
        this.stopRealtimeListener = null;
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadProveedores();
        this.renderProveedores();
        this.setupRealtimeListener();
    }

    setupEventListeners() {
        // Botón nuevo proveedor
        document.getElementById('btn-nuevo-proveedor').addEventListener('click', () => {
            this.openModal();
        });

        // Cerrar modal
        document.getElementById('modal-close').addEventListener('click', () => {
            this.closeModal();
        });

        // Búsqueda
        document.getElementById('search-proveedores').addEventListener('input', (e) => {
            this.filterProveedores(e.target.value);
        });

        // Filtros
        document.getElementById('filter-estado').addEventListener('change', () => {
            this.applyFilters();
        });

        // Envío del formulario
        document.getElementById('form-proveedor').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProveedor();
        });
    }

    async loadProveedores() {
        try {
            // 🚀 OPTIMIZACIÓN: Usar caché para reducir queries
            if (window.cacheManager) {
                this.proveedores = await window.cacheManager.getOrFetch('proveedores_cache', async () => {
                    const querySnapshot = await window.db.collection('providers').get();
                    const proveedores = [];
                    
                    querySnapshot.forEach((doc) => {
                        proveedores.push({
                            id: doc.id,
                            ...doc.data()
                        });
                    });
                    
                    return proveedores;
                });
            } else {
                // Fallback si cache-manager no está disponible
                const querySnapshot = await window.db.collection('providers').get();
                this.proveedores = [];
                
                querySnapshot.forEach((doc) => {
                    this.proveedores.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });
            }
            
            console.log(`✅ ${this.proveedores.length} proveedores cargados`);
        } catch (error) {
            console.error('Error al cargar proveedores:', error);
            this.showNotification('Error al cargar proveedores', 'error');
        }
    }

    renderProveedores(proveedores = this.proveedores) {
        const tbody = document.getElementById('proveedores-table-body');
        
        if (proveedores.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px; color: #6D6D80;">
                        No hay proveedores registrados
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = proveedores.map(proveedor => `
            <tr>
                <td>
                    <div class="proveedor-info">
                        <div class="proveedor-avatar">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="1" y="3" width="15" height="13"></rect>
                                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                                <circle cx="5.5" cy="18.5" r="2.5"></circle>
                                <circle cx="18.5" cy="18.5" r="2.5"></circle>
                            </svg>
                        </div>
                        <div class="proveedor-nombre">
                            ${proveedor.nombre || 'Sin nombre'}
                        </div>
                    </div>
                </td>
                <td>${proveedor.telefono || 'No especificado'}</td>
                <td>${proveedor.email || 'No especificado'}</td>
                <td>
                    <span class="estado-badge estado-${proveedor.metadata?.status || 'active'}">
                        ${proveedor.metadata?.status === 'active' ? 'Activo' : 'Inactivo'}
                    </span>
                </td>
                <td>${this.formatDate(proveedor.metadata?.createdAt)}</td>
                <td>
                    <div class="acciones-proveedor">
                        <button class="btn-accion btn-editar" onclick="proveedoresModule.editProveedor('${proveedor.id}')" title="Editar">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button class="btn-accion btn-eliminar" onclick="proveedoresModule.deleteProveedor('${proveedor.id}')" title="Eliminar">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                <line x1="10" y1="11" x2="10" y2="17"></line>
                                <line x1="14" y1="11" x2="14" y2="17"></line>
                            </svg>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    formatDate(timestamp) {
        if (!timestamp) return 'No especificado';
        
        try {
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            return new Intl.DateTimeFormat('es-ES', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            }).format(date);
        } catch (error) {
            return 'Fecha inválida';
        }
    }

    filterProveedores(searchTerm) {
        const filtered = this.proveedores.filter(proveedor => {
            const nombre = proveedor.nombre?.toLowerCase() || '';
            const email = proveedor.email?.toLowerCase() || '';
            const search = searchTerm.toLowerCase();
            
            return nombre.includes(search) || email.includes(search);
        });
        
        this.renderProveedores(filtered);
    }

    applyFilters() {
        const estadoFilter = document.getElementById('filter-estado').value;
        const searchTerm = document.getElementById('search-proveedores').value;

        let filtered = this.proveedores;

        if (estadoFilter) {
            filtered = filtered.filter(proveedor => proveedor.metadata?.status === estadoFilter);
        }

        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            filtered = filtered.filter(proveedor => {
                const nombre = proveedor.nombre?.toLowerCase() || '';
                const email = proveedor.email?.toLowerCase() || '';
                return nombre.includes(search) || email.includes(search);
            });
        }

        this.renderProveedores(filtered);
    }

    openModal(proveedor = null) {
        this.editingProveedor = proveedor;
        
        const modal = document.getElementById('modal-proveedor');
        const title = document.getElementById('modal-title');
        
        if (proveedor) {
            title.textContent = 'Editar Proveedor';
            this.populateForm(proveedor);
        } else {
            title.textContent = 'Nuevo Proveedor';
            this.resetForm();
        }
        
        modal.classList.add('active');
    }

    closeModal() {
        const modal = document.getElementById('modal-proveedor');
        modal.classList.remove('active');
        this.resetForm();
    }

    resetForm() {
        document.getElementById('form-proveedor').reset();
        this.editingProveedor = null;
    }

    populateForm(proveedor) {
        document.getElementById('nombre').value = proveedor.nombre || '';
        document.getElementById('telefono').value = proveedor.telefono || '';
        document.getElementById('email').value = proveedor.email || '';
        document.getElementById('direccion').value = proveedor.direccion || '';
    }

    async saveProveedor() {
        this.showLoading();
        
        try {
            const formData = new FormData(document.getElementById('form-proveedor'));
            
            // 🛡️ SANITIZACIÓN DE DATOS
            const proveedorData = {
                nombre: window.inputSanitizer ? window.inputSanitizer.sanitizeText(formData.get('nombre')) : formData.get('nombre'),
                telefono: window.inputSanitizer ? window.inputSanitizer.sanitizeText(formData.get('telefono')) : formData.get('telefono'),
                email: window.inputSanitizer ? window.inputSanitizer.sanitizeEmail(formData.get('email')) : formData.get('email'),
                direccion: window.inputSanitizer ? window.inputSanitizer.sanitizeText(formData.get('direccion')) : formData.get('direccion')
            };

            if (this.editingProveedor) {
                // Actualizar proveedor existente
                proveedorData.metadata = {
                    ...this.editingProveedor.metadata,
                    status: 'active',
                    updatedAt: new Date(),
                    updatedBy: window.authSystem?.currentUser?.uid || 'unknown'
                };
                
                await window.db.collection('providers').doc(this.editingProveedor.id).update(proveedorData);
                this.showNotification('Proveedor actualizado correctamente', 'success');
            } else {
                // Crear nuevo proveedor
                proveedorData.metadata = {
                    status: 'active',
                    createdAt: new Date(),
                    createdBy: window.authSystem?.currentUser?.uid || 'unknown'
                };
                
                await window.db.collection('providers').add(proveedorData);
                this.showNotification('Proveedor creado correctamente', 'success');
            }

            await this.loadProveedores();
            this.renderProveedores();
            this.closeModal();
            
        } catch (error) {
            console.error('Error al guardar proveedor:', error);
            console.error('Detalles del error:', error.message);
            this.showNotification(`Error al guardar proveedor: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async editProveedor(proveedorId) {
        const proveedor = this.proveedores.find(p => p.id === proveedorId);
        if (proveedor) {
            this.openModal(proveedor);
        }
    }

    async deleteProveedor(proveedorId) {
        if (!confirm('¿Estás seguro de que quieres eliminar este proveedor?')) {
            return;
        }

        this.showLoading();
        
        try {
            await window.db.collection('providers').doc(proveedorId).delete();
            await this.loadProveedores();
            this.renderProveedores();
            this.showNotification('Proveedor eliminado correctamente', 'success');
        } catch (error) {
            console.error('Error al eliminar proveedor:', error);
            this.showNotification('Error al eliminar proveedor', 'error');
        } finally {
            this.hideLoading();
        }
    }

    // 🔄 LISTENER EN TIEMPO REAL
    setupRealtimeListener() {
        if (!window.realtimeSync) return;
        
        this.stopRealtimeListener = window.realtimeSync.listenToCollection(
            'providers',
            (changes) => {
                if (changes.added.length > 0 || changes.modified.length > 0 || changes.removed.length > 0) {
                    this.loadProveedores().then(() => {
                        this.renderProveedores();
                        this.showNotification('Lista de proveedores actualizada', 'info');
                    });
                }
            },
            'proveedores'
        );
    }

    showLoading() {
        document.getElementById('loading-overlay').classList.add('active');
    }

    hideLoading() {
        document.getElementById('loading-overlay').classList.remove('active');
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">
                    ${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}
                </span>
                <span class="notification-message">${message}</span>
                <button class="notification-close">✕</button>
            </div>
        `;

        if (!document.querySelector('#notification-styles')) {
            const styles = document.createElement('style');
            styles.id = 'notification-styles';
            styles.textContent = `
                .notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    min-width: 300px;
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
                    z-index: 10002;
                    animation: slideInFromRight 0.3s ease-out;
                }
                .notification-content {
                    display: flex;
                    align-items: center;
                    padding: 16px;
                    gap: 12px;
                }
                .notification-success { border-left: 4px solid #34C759; }
                .notification-error { border-left: 4px solid #FF3B30; }
                .notification-info { border-left: 4px solid #007AFF; }
                .notification-message { flex: 1; font-weight: 500; }
                .notification-close {
                    background: none;
                    border: none;
                    cursor: pointer;
                    padding: 4px;
                    border-radius: 4px;
                }
                @keyframes slideInFromRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(styles);
        }

        document.body.appendChild(notification);

        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            notification.remove();
        });

        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }

    destroy() {
        // Detener listener en tiempo real
        if (this.stopRealtimeListener) {
            this.stopRealtimeListener();
        }

        this.closeModal();
        console.log(`Módulo ${this.moduleId} descargado correctamente`);
    }
}

// Cargar el módulo
function loadProveedoresModule() {
    window.proveedoresModule = new ProveedoresModule();
}

window.loadProveedoresModule = loadProveedoresModule;
