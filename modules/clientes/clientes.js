
// Módulo de Clientes - Gestión profesional
class ClientesModule {
    constructor() {
        this.clientes = [];
        this.editingCliente = null;
        this.moduleId = 'clientes';
        this.stopRealtimeListener = null;
        this.init();
    }

    async init() {
        this.showLoading();
        
        try {
            await this.loadClientes();
            this.setupEventListeners();
            this.renderClientes();
            this.setupRealtimeListener();
            console.log('✅ Módulo de clientes inicializado');
        } catch (error) {
            console.error('Error en inicialización:', error);
            this.showNotification('Error al cargar clientes', 'error');
        } finally {
            this.hideLoading();
        }
    }

    setupEventListeners() {
        // Botón nuevo cliente
        document.getElementById('btn-nuevo-cliente').addEventListener('click', () => {
            this.openModal();
        });

        // Cerrar modales
        document.getElementById('modal-close').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('modal-detalle-close').addEventListener('click', () => {
            this.closeDetalleModal();
        });

        document.getElementById('btn-cancelar').addEventListener('click', () => {
            this.closeModal();
        });

        // Búsqueda
        document.getElementById('search-clientes').addEventListener('input', (e) => {
            this.filterClientes(e.target.value);
        });

        // Filtros
        document.getElementById('filter-tipo').addEventListener('change', () => {
            this.applyFilters();
        });

        document.getElementById('filter-orden').addEventListener('change', () => {
            this.applyFilters();
        });

        // Formulario
        document.getElementById('form-cliente').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveCliente();
        });

        // Validación de teléfono en tiempo real
        document.getElementById('cliente-telefono').addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '').substring(0, 10);
        });
    }

    async loadClientes() {
        try {
            const querySnapshot = await window.db.collection('clients')
                .orderBy('fechaRegistro', 'desc')
                .get();
            
            this.clientes = [];
            querySnapshot.forEach((doc) => {
                this.clientes.push({ id: doc.id, ...doc.data() });
            });
        } catch (error) {
            console.error('Error al cargar clientes:', error);
        }
    }

    setupRealtimeListener() {
        this.stopRealtimeListener = window.db.collection('clients')
            .onSnapshot((snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added') {
                        const exists = this.clientes.find(c => c.id === change.doc.id);
                        if (!exists) {
                            this.clientes.unshift({ id: change.doc.id, ...change.doc.data() });
                        }
                    }
                    if (change.type === 'modified') {
                        const index = this.clientes.findIndex(c => c.id === change.doc.id);
                        if (index !== -1) {
                            this.clientes[index] = { id: change.doc.id, ...change.doc.data() };
                        }
                    }
                    if (change.type === 'removed') {
                        this.clientes = this.clientes.filter(c => c.id !== change.doc.id);
                    }
                });
                this.renderClientes();
            });
    }

    renderClientes() {
        const container = document.getElementById('clientes-container');
        const emptyState = document.getElementById('empty-state');

        if (this.clientes.length === 0) {
            container.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        container.style.display = 'grid';
        emptyState.style.display = 'none';

        const html = this.clientes.map(cliente => {
            const iniciales = cliente.nombre.split(' ')
                .map(n => n[0])
                .join('')
                .substring(0, 2)
                .toUpperCase();

            const contacto = cliente.telefono || cliente.email || 'Sin contacto';

            return `
                <div class="cliente-card" onclick="clientesModule.verDetalle('${cliente.id}')">
                    <div class="cliente-card-header">
                        <div class="cliente-avatar">${iniciales}</div>
                        <div class="cliente-info">
                            <h3>${cliente.nombre}</h3>
                            <p>${contacto}</p>
                        </div>
                    </div>
                    
                    <span class="cliente-tipo-badge ${cliente.tipo}">
                        ${cliente.tipo === 'credito' ? '💳' : '💵'} 
                        ${cliente.tipo === 'credito' ? 'Crédito' : 'Efectivo'}
                    </span>

                    <div class="cliente-card-actions">
                        <button class="btn-card btn-editar" onclick="event.stopPropagation(); clientesModule.editCliente('${cliente.id}')">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px;">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                            Editar
                        </button>
                        <button class="btn-card btn-eliminar" onclick="event.stopPropagation(); clientesModule.deleteCliente('${cliente.id}')">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px;">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                <line x1="10" y1="11" x2="10" y2="17"></line>
                                <line x1="14" y1="11" x2="14" y2="17"></line>
                            </svg>
                            Eliminar
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    }

    filterClientes(searchTerm) {
        const filtered = this.clientes.filter(cliente => {
            const search = searchTerm.toLowerCase();
            return cliente.nombre.toLowerCase().includes(search) ||
                   (cliente.telefono && cliente.telefono.includes(search));
        });

        this.renderFilteredClientes(filtered);
    }

    applyFilters() {
        const tipo = document.getElementById('filter-tipo').value;
        const orden = document.getElementById('filter-orden').value;

        let filtered = [...this.clientes];

        // Filtrar por tipo
        if (tipo !== 'todos') {
            filtered = filtered.filter(c => c.tipo === tipo);
        }

        // Ordenar
        if (orden === 'nombre-asc') {
            filtered.sort((a, b) => a.nombre.localeCompare(b.nombre));
        } else if (orden === 'nombre-desc') {
            filtered.sort((a, b) => b.nombre.localeCompare(a.nombre));
        } else if (orden === 'reciente') {
            filtered.sort((a, b) => {
                const fechaA = a.fechaRegistro?.toDate() || new Date(0);
                const fechaB = b.fechaRegistro?.toDate() || new Date(0);
                return fechaB - fechaA;
            });
        }

        this.renderFilteredClientes(filtered);
    }

    renderFilteredClientes(clientesList) {
        const tempClientes = this.clientes;
        this.clientes = clientesList;
        this.renderClientes();
        this.clientes = tempClientes;
    }

    openModal() {
        this.editingCliente = null;
        document.getElementById('modal-title').textContent = '➕ Nuevo Cliente';
        document.getElementById('btn-guardar-text').textContent = 'Guardar Cliente';
        document.getElementById('form-cliente').reset();
        document.getElementById('modal-cliente').classList.add('active');
    }

    closeModal() {
        document.getElementById('modal-cliente').classList.remove('active');
        this.editingCliente = null;
    }

    closeDetalleModal() {
        document.getElementById('modal-detalle').classList.remove('active');
    }

    async editCliente(clienteId) {
        const cliente = this.clientes.find(c => c.id === clienteId);
        if (!cliente) return;

        this.editingCliente = cliente;
        document.getElementById('modal-title').textContent = '✏️ Editar Cliente';
        document.getElementById('btn-guardar-text').textContent = 'Actualizar';
        
        document.getElementById('cliente-nombre').value = cliente.nombre;
        document.getElementById('cliente-telefono').value = cliente.telefono || '';
        document.getElementById('cliente-email').value = cliente.email || '';
        document.getElementById('cliente-tipo').value = cliente.tipo;

        document.getElementById('modal-cliente').classList.add('active');
    }

    async saveCliente() {
        const nombre = document.getElementById('cliente-nombre').value.trim();
        const telefono = document.getElementById('cliente-telefono').value.trim();
        const email = document.getElementById('cliente-email').value.trim();
        const tipo = document.getElementById('cliente-tipo').value;

        // Validaciones
        if (nombre.length < 3) {
            this.showNotification('El nombre debe tener al menos 3 caracteres', 'warning');
            return;
        }

        if (telefono && telefono.length !== 10) {
            this.showNotification('El teléfono debe tener 10 dígitos', 'warning');
            return;
        }

        if (email && !this.validateEmail(email)) {
            this.showNotification('Email inválido', 'warning');
            return;
        }

        // Verificar duplicados (solo si es nuevo cliente)
        if (!this.editingCliente) {
            const existe = this.clientes.find(c => 
                c.nombre.toLowerCase() === nombre.toLowerCase() && 
                c.telefono === telefono
            );

            if (existe) {
                this.showNotification('Ya existe un cliente con ese nombre y teléfono', 'warning');
                return;
            }
        }

        this.showLoading();

        try {
            const clienteData = {
                nombre,
                telefono: telefono || '',
                email: email || '',
                tipo,
                metadata: {
                    totalCompras: 0,
                    deudaActual: 0,
                    ultimaCompra: null
                }
            };

            if (this.editingCliente) {
                // Actualizar
                await window.db.collection('clients').doc(this.editingCliente.id).update(clienteData);
                this.showNotification('✅ Cliente actualizado exitosamente', 'success');
            } else {
                // Crear nuevo
                clienteData.fechaRegistro = new Date();
                await window.db.collection('clients').add(clienteData);
                this.showNotification('✅ Cliente creado exitosamente', 'success');
            }

            this.closeModal();
            await this.loadClientes();
            this.renderClientes();

        } catch (error) {
            console.error('Error al guardar cliente:', error);
            this.showNotification('Error al guardar el cliente', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async deleteCliente(clienteId) {
        const cliente = this.clientes.find(c => c.id === clienteId);
        if (!cliente) return;

        const confirmacion = confirm(`¿Seguro que deseas eliminar a "${cliente.nombre}"?\n\nEsta acción no se puede deshacer.`);
        if (!confirmacion) return;

        this.showLoading();

        try {
            await window.db.collection('clients').doc(clienteId).delete();
            this.showNotification('✅ Cliente eliminado exitosamente', 'success');
            await this.loadClientes();
            this.renderClientes();
        } catch (error) {
            console.error('Error al eliminar cliente:', error);
            this.showNotification('Error al eliminar el cliente', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async verDetalle(clienteId) {
        const cliente = this.clientes.find(c => c.id === clienteId);
        if (!cliente) return;

        const html = `
            <div style="background: linear-gradient(135deg, #007AFF, #5856D6); color: white; padding: 32px; border-radius: 16px; margin-bottom: 24px;">
                <div style="font-size: 48px; margin-bottom: 16px; text-align: center;">
                    ${cliente.nombre.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                </div>
                <h2 style="margin: 0 0 8px 0; text-align: center;">${cliente.nombre}</h2>
                <p style="margin: 0; text-align: center; opacity: 0.9;">
                    ${cliente.tipo === 'credito' ? '💳 Cliente a Crédito' : '💵 Cliente de Contado'}
                </p>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px;">
                <div style="background: #F8F9FA; padding: 20px; border-radius: 12px;">
                    <div style="font-size: 24px; margin-bottom: 8px;">📱</div>
                    <div style="font-size: 12px; color: #6D6D80; margin-bottom: 4px;">Teléfono</div>
                    <div style="font-weight: 600;">${cliente.telefono || 'No registrado'}</div>
                </div>
                <div style="background: #F8F9FA; padding: 20px; border-radius: 12px;">
                    <div style="font-size: 24px; margin-bottom: 8px;">📧</div>
                    <div style="font-size: 12px; color: #6D6D80; margin-bottom: 4px;">Email</div>
                    <div style="font-weight: 600; font-size: 14px;">${cliente.email || 'No registrado'}</div>
                </div>
                <div style="background: #F8F9FA; padding: 20px; border-radius: 12px;">
                    <div style="font-size: 24px; margin-bottom: 8px;">📅</div>
                    <div style="font-size: 12px; color: #6D6D80; margin-bottom: 4px;">Registrado</div>
                    <div style="font-weight: 600;">${cliente.fechaRegistro?.toDate().toLocaleDateString() || 'N/A'}</div>
                </div>
            </div>

            <div style="text-align: center; padding: 24px;">
                <button onclick="clientesModule.editCliente('${cliente.id}'); clientesModule.closeDetalleModal();" 
                        style="background: linear-gradient(135deg, #007AFF, #5856D6); color: white; border: none; border-radius: 12px; padding: 14px 32px; font-weight: 600; cursor: pointer; margin-right: 12px;">
                    ✏️ Editar Cliente
                </button>
                <button onclick="clientesModule.closeDetalleModal();" 
                        style="background: #F2F2F7; color: #1D1D1F; border: none; border-radius: 12px; padding: 14px 32px; font-weight: 600; cursor: pointer;">
                    Cerrar
                </button>
            </div>
        `;

        document.getElementById('detalle-content').innerHTML = html;
        document.getElementById('modal-detalle').classList.add('active');
    }

    validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    showLoading() {
        document.getElementById('loading-overlay-clientes').classList.add('active');
    }

    hideLoading() {
        document.getElementById('loading-overlay-clientes').classList.remove('active');
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}</span>
                <span class="notification-message">${message}</span>
                <button class="notification-close">✕</button>
            </div>
        `;

        document.body.appendChild(notification);

        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.remove();
        });

        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }

    destroy() {
        if (this.stopRealtimeListener) {
            this.stopRealtimeListener();
        }
        console.log(`Módulo ${this.moduleId} descargado`);
    }
}

// Cargar el módulo
function loadClientesModule() {
    window.clientesModule = new ClientesModule();
}

window.loadClientesModule = loadClientesModule;
