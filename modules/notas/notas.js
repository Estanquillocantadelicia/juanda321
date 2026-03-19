// Módulo de Notas Internas - Sistema de Post-its
class NotasModule {
    constructor() {
        this.notas = [];
        this.filtroActual = 'todas';
        this.notaSeleccionada = null;
        this.unsubscribeNotas = null;
        this.moduleId = 'notas';
        this.init();
    }

    async init() {
        console.log('📝 Inicializando módulo de notas...');

        try {
            await this.ensureModalsExist(); // Crear modales si no existen
            this.setupEventListeners();
            this.setupModalEventListeners(); // ✅ SIEMPRE configurar event listeners de modales
            await this.cargarNotas();
            this.setupRealtimeSync();
            console.log('✅ Módulo de notas inicializado correctamente');
        } catch (error) {
            console.error('❌ Error inicializando módulo de notas:', error);
            this.showNotification('Error al cargar las notas', 'error');
        }
    }

    async ensureModalsExist() {
        // Verificar si los modales ya existen en el contenedor permanente
        if (document.getElementById('modal-nueva-nota')) {
            console.log('✅ Modales de notas ya existen en el DOM permanente');
            return;
        }

        console.log('📦 Creando modales de notas en el contenedor permanente...');
        
        // Obtener el contenedor permanente
        const permanentContainer = document.getElementById('permanent-modals-container');
        if (!permanentContainer) {
            console.error('❌ Contenedor permanente no encontrado');
            return;
        }

        // Cargar el HTML de los modales
        try {
            const response = await fetch('./modules/notas/notas-modals.html');
            const modalsHTML = await response.text();
            
            // Crear un div temporal para parsear el HTML
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = modalsHTML;
            
            // Mover los modales al contenedor permanente
            while (tempDiv.firstChild) {
                permanentContainer.appendChild(tempDiv.firstChild);
            }
            
            console.log('✅ Modales de notas creados en contenedor permanente');
            
        } catch (error) {
            console.error('❌ Error cargando modales:', error);
        }
    }

    setupEventListeners() {
        const btnNuevaNota = document.getElementById('btn-nueva-nota');

        if (btnNuevaNota) {
            btnNuevaNota.addEventListener('click', () => this.abrirModalNuevaNota());
        }

        document.querySelectorAll('.filtro-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.filtroActual = e.currentTarget.dataset.filtro;
                this.renderNotas();
            });
        });
    }

    setupModalEventListeners() {
        console.log('🔧 Configurando event listeners de modales...');
        
        // Event listeners del modal de nueva nota
        const modalNuevaNota = document.getElementById('modal-nueva-nota');
        const closeNuevaNota = document.getElementById('modal-nueva-nota-close');
        const btnCancelarNota = document.getElementById('btn-cancelar-nota');
        const formNuevaNota = document.getElementById('form-nueva-nota');
        const notaContenido = document.getElementById('nota-contenido');

        if (closeNuevaNota) {
            closeNuevaNota.addEventListener('click', () => this.cerrarModalNuevaNota());
        }

        if (btnCancelarNota) {
            btnCancelarNota.addEventListener('click', () => this.cerrarModalNuevaNota());
        }

        if (formNuevaNota) {
            formNuevaNota.addEventListener('submit', (e) => this.crearNota(e));
        }

        if (notaContenido) {
            notaContenido.addEventListener('input', (e) => {
                const count = e.target.value.length;
                document.getElementById('char-count').textContent = count;
            });
        }

        if (modalNuevaNota) {
            modalNuevaNota.addEventListener('click', (e) => {
                if (e.target === modalNuevaNota) {
                    this.cerrarModalNuevaNota();
                }
            });
        }

        // Event listeners del modal de ver nota
        const modalVerNota = document.getElementById('modal-ver-nota');
        const closeVerNota = document.getElementById('modal-ver-nota-close');
        const btnMarcarLeida = document.getElementById('btn-marcar-leida');
        const btnEliminarNota = document.getElementById('btn-eliminar-nota');

        if (closeVerNota) {
            closeVerNota.addEventListener('click', () => this.cerrarModalVerNota());
        }

        if (btnMarcarLeida) {
            btnMarcarLeida.addEventListener('click', () => this.marcarComoLeida());
        }

        if (btnEliminarNota) {
            btnEliminarNota.addEventListener('click', () => this.eliminarNota());
        }

        if (modalVerNota) {
            modalVerNota.addEventListener('click', (e) => {
                if (e.target === modalVerNota) {
                    this.cerrarModalVerNota();
                }
            });
        }

        console.log('✅ Event listeners de modales configurados');
    }

    setupRealtimeSync() {
        if (this.unsubscribeNotas) {
            this.unsubscribeNotas();
        }

        const ahora = new Date();
        ahora.setDate(ahora.getDate() - 7);

        this.unsubscribeNotas = window.db.collection('notas_internas')
            .where('fechaCreacion', '>=', ahora)
            .orderBy('fechaCreacion', 'desc')
            .onSnapshot((snapshot) => {
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'added') {
                        const nuevaNota = { id: change.doc.id, ...change.doc.data() };
                        const existe = this.notas.find(n => n.id === nuevaNota.id);
                        if (!existe) {
                            this.notas.unshift(nuevaNota);
                        }
                    } else if (change.type === 'modified') {
                        const index = this.notas.findIndex(n => n.id === change.doc.id);
                        if (index !== -1) {
                            this.notas[index] = { id: change.doc.id, ...change.doc.data() };
                        }
                    } else if (change.type === 'removed') {
                        this.notas = this.notas.filter(n => n.id !== change.doc.id);
                    }
                });
                this.renderNotas();
                this.actualizarBadge();
            }, (error) => {
                console.error('Error en sincronización de notas:', error);
            });
    }

    async cargarNotas() {
        const userId = window.authSystem?.currentUser?.uid;
        const userRole = window.authSystem?.currentUser?.rol || window.authSystem?.currentUser?.role || 'vendedor';

        const ahora = new Date();
        ahora.setDate(ahora.getDate() - 7);

        const snapshot = await window.db.collection('notas_internas')
            .where('fechaCreacion', '>=', ahora)
            .orderBy('fechaCreacion', 'desc')
            .get();

        this.notas = [];

        snapshot.forEach(doc => {
            const nota = { id: doc.id, ...doc.data() };

            if (this.esVisibleParaUsuario(nota, userId, userRole)) {
                this.notas.push(nota);
            }
        });

        this.renderNotas();
        this.actualizarBadge();
    }

    esVisibleParaUsuario(nota, userId, userRole) {
        if (nota.destinatario === 'todos') return true;
        if (nota.destinatario === userRole) return true;
        if (nota.autorId === userId) return true;
        return false;
    }

    getNotasFiltradas() {
        const userId = window.authSystem?.currentUser?.uid;
        const userRole = window.authSystem?.currentUser?.rol || window.authSystem?.currentUser?.role || 'vendedor';

        let notasFiltradas = this.notas.filter(nota => 
            this.esVisibleParaUsuario(nota, userId, userRole) && 
            !this.yaLeyoNota(nota, userId)
        );

        switch (this.filtroActual) {
            case 'para-mi':
                notasFiltradas = notasFiltradas.filter(nota => 
                    nota.destinatario === userRole || 
                    (nota.destinatario === 'todos' && nota.autorId !== userId)
                );
                break;
            case 'mis-notas':
                notasFiltradas = notasFiltradas.filter(nota => nota.autorId === userId);
                break;
            case 'urgentes':
                notasFiltradas = notasFiltradas.filter(nota => nota.prioridad === 'urgente');
                break;
        }

        return notasFiltradas;
    }

    yaLeyoNota(nota, userId) {
        if (!nota.leidaPor) return false;
        return nota.leidaPor.includes(userId);
    }

    renderNotas() {
        const tablero = document.getElementById('notas-tablero');
        const emptyState = document.getElementById('notas-empty');

        if (!tablero) return;

        const notasFiltradas = this.getNotasFiltradas();

        if (notasFiltradas.length === 0) {
            tablero.innerHTML = '';
            if (emptyState) emptyState.style.display = 'flex';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';

        tablero.innerHTML = notasFiltradas.map(nota => this.renderNota(nota)).join('');

        tablero.querySelectorAll('.nota-postit').forEach(element => {
            element.addEventListener('click', () => {
                const notaId = element.dataset.notaId;
                this.abrirModalVerNota(notaId);
            });
        });
    }

    renderNota(nota) {
        const fechaCreacion = nota.fechaCreacion?.toDate ? nota.fechaCreacion.toDate() : new Date(nota.fechaCreacion);
        const tiempoRelativo = this.getTiempoRelativo(fechaCreacion);
        const autorNombre = nota.autorNombre && nota.autorNombre.trim() ? nota.autorNombre.trim() : 'Sistema';
        const iniciales = this.getIniciales(autorNombre);
        const userId = window.authSystem?.currentUser?.uid;
        const lecturas = nota.leidaPor ? nota.leidaPor.length : 0;

        return `
            <div class="nota-postit ${nota.color || 'amarillo'}" data-nota-id="${nota.id}">
                ${nota.prioridad === 'urgente' ? '<span class="nota-urgente-badge">⚡ Urgente</span>' : ''}
                <div class="nota-contenido">${this.escapeHtml(nota.contenido)}</div>
                <div class="nota-footer">
                    <div class="nota-autor">
                        <span class="nota-autor-avatar">${iniciales}</span>
                        <div class="nota-autor-info">
                            <span class="nota-autor-nombre">${autorNombre}</span>
                            <span class="nota-tiempo">${tiempoRelativo}</span>
                        </div>
                    </div>
                    ${lecturas > 0 ? `
                        <div class="nota-lecturas">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                            <span>${lecturas}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    abrirModalNuevaNota() {
        const modal = document.getElementById('modal-nueva-nota');
        if (modal) {
            // Reset completo: modal, wrapper y content
            modal.style.cssText = '';
            const wrapper = modal.querySelector('.modal-notas-wrapper');
            const content = modal.querySelector('.modal-notas-content');
            
            if (wrapper) wrapper.style.cssText = '';
            if (content) content.style.cssText = '';
            
            // Activar modal
            modal.classList.add('active');
            
            // Forzar reflow
            void modal.offsetHeight;
            
            document.getElementById('nota-contenido').focus();
        }
    }

    cerrarModalNuevaNota() {
        const modal = document.getElementById('modal-nueva-nota');
        if (modal) {
            modal.classList.remove('active');
            document.getElementById('form-nueva-nota').reset();
            document.getElementById('char-count').textContent = '0';
        }
    }

    abrirModalVerNota(notaId) {
        const nota = this.notas.find(n => n.id === notaId);
        if (!nota) return;

        this.notaSeleccionada = nota;

        const modal = document.getElementById('modal-ver-nota');
        const contenido = document.getElementById('nota-detalle-content');
        const btnEliminar = document.getElementById('btn-eliminar-nota');
        const btnMarcarLeida = document.getElementById('btn-marcar-leida');

        const userId = window.authSystem?.currentUser?.uid;
        const esAutor = nota.autorId === userId;
        const yaLeida = this.yaLeyoNota(nota, userId);

        const fechaCreacion = nota.fechaCreacion?.toDate ? nota.fechaCreacion.toDate() : new Date(nota.fechaCreacion);
        const fechaFormateada = fechaCreacion.toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const autorNombre = nota.autorNombre && nota.autorNombre.trim() ? nota.autorNombre.trim() : 'Sistema';
        const iniciales = this.getIniciales(autorNombre);

        contenido.innerHTML = `
            <div class="nota-detalle-header">
                <div class="nota-detalle-avatar">${iniciales}</div>
                <div class="nota-detalle-info">
                    <h3>${autorNombre}</h3>
                    <span>${fechaFormateada}</span>
                </div>
            </div>
            <div class="nota-detalle-mensaje ${nota.color || 'amarillo'}">
                ${this.escapeHtml(nota.contenido)}
            </div>
            <div class="nota-detalle-meta">
                ${nota.prioridad === 'urgente' ? `
                    <span class="meta-item" style="color: #FF3B30;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                        Urgente
                    </span>
                ` : ''}
                <span class="meta-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                    ${this.getDestinatarioTexto(nota.destinatario)}
                </span>
                ${nota.leidaPor && nota.leidaPor.length > 0 ? `
                    <span class="meta-item">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                        ${nota.leidaPor.length} lectura${nota.leidaPor.length > 1 ? 's' : ''}
                    </span>
                ` : ''}
                ${nota.autoEliminar ? `
                    <span class="meta-item">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        Auto-eliminar en 24h
                    </span>
                ` : ''}
            </div>
        `;

        if (btnEliminar) {
            btnEliminar.style.display = esAutor ? 'flex' : 'none';
        }

        if (btnMarcarLeida) {
            if (esAutor || yaLeida) {
                btnMarcarLeida.textContent = 'Cerrar';
                btnMarcarLeida.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                    Cerrar
                `;
            } else {
                btnMarcarLeida.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    Entendido
                `;
            }
        }

        if (modal) {
            // Reset completo: modal, wrapper y content
            modal.style.cssText = '';
            const wrapper = modal.querySelector('.modal-notas-wrapper');
            const content = modal.querySelector('.modal-notas-content');
            
            if (wrapper) wrapper.style.cssText = '';
            if (content) content.style.cssText = '';
            
            // Activar modal
            modal.classList.add('active');
            
            // Forzar reflow
            void modal.offsetHeight;
        }
    }

    cerrarModalVerNota() {
        const modal = document.getElementById('modal-ver-nota');
        if (modal) {
            modal.classList.remove('active');
            this.notaSeleccionada = null;
        }
    }

    async crearNota(e) {
        e.preventDefault();

        const contenido = document.getElementById('nota-contenido').value.trim();
        const color = document.querySelector('input[name="nota-color"]:checked')?.value || 'amarillo';
        const prioridad = document.querySelector('input[name="nota-prioridad"]:checked')?.value || 'normal';
        const destinatario = document.getElementById('nota-destinatario').value;
        const autoEliminar = document.getElementById('nota-auto-eliminar').checked;

        if (!contenido) {
            this.showNotification('Escribe un mensaje para la nota', 'warning');
            return;
        }

        const userId = window.authSystem?.currentUser?.uid;
        const userName = window.authSystem?.userData?.nombre || 
                        window.authSystem?.currentUser?.displayName || 
                        'Usuario';

        try {
            const nuevaNota = {
                contenido,
                color,
                prioridad,
                destinatario,
                autoEliminar,
                autorId: userId,
                autorNombre: userName,
                fechaCreacion: firebase.firestore.FieldValue.serverTimestamp(),
                leidaPor: [],
                activa: true
            };

            if (autoEliminar) {
                const fechaExpiracion = new Date();
                fechaExpiracion.setHours(fechaExpiracion.getHours() + 24);
                nuevaNota.fechaExpiracion = fechaExpiracion;
            }

            await window.db.collection('notas_internas').add(nuevaNota);

            this.showNotification('Nota creada exitosamente', 'success');
            this.cerrarModalNuevaNota();

        } catch (error) {
            console.error('Error creando nota:', error);
            this.showNotification('Error al crear la nota', 'error');
        }
    }

    async marcarComoLeida() {
        if (!this.notaSeleccionada) {
            this.cerrarModalVerNota();
            return;
        }

        const userId = window.authSystem?.currentUser?.uid;
        const nota = this.notaSeleccionada;

        if (nota.autorId === userId || this.yaLeyoNota(nota, userId)) {
            this.cerrarModalVerNota();
            return;
        }

        try {
            await window.db.collection('notas_internas').doc(nota.id).update({
                leidaPor: firebase.firestore.FieldValue.arrayUnion(userId)
            });

            this.showNotification('Nota marcada como leída', 'success');
            this.cerrarModalVerNota();

        } catch (error) {
            console.error('Error marcando nota como leída:', error);
            this.showNotification('Error al marcar la nota', 'error');
        }
    }

    async eliminarNota() {
        if (!this.notaSeleccionada) return;

        const confirmar = confirm('¿Estás seguro de eliminar esta nota?');
        if (!confirmar) return;

        try {
            await window.db.collection('notas_internas').doc(this.notaSeleccionada.id).delete();

            this.showNotification('Nota eliminada', 'success');
            this.cerrarModalVerNota();

        } catch (error) {
            console.error('Error eliminando nota:', error);
            this.showNotification('Error al eliminar la nota', 'error');
        }
    }

    actualizarBadge() {
        const userId = window.authSystem?.currentUser?.uid;
        const userRole = window.authSystem?.currentUser?.rol || window.authSystem?.currentUser?.role || 'vendedor';

        const notasSinLeer = this.notas.filter(nota => 
            this.esVisibleParaUsuario(nota, userId, userRole) && 
            !this.yaLeyoNota(nota, userId) &&
            nota.autorId !== userId
        ).length;

        if (window.eventBus) {
            window.eventBus.emit('notas:badge', { count: notasSinLeer });
        }

        const menuBadge = document.querySelector('[data-module="notas"] .module-badge');
        if (menuBadge) {
            menuBadge.textContent = notasSinLeer;
            menuBadge.style.display = notasSinLeer > 0 ? 'flex' : 'none';
        }
    }

    getDestinatarioTexto(destinatario) {
        const textos = {
            'todos': 'Todos',
            'administrador': 'Administradores',
            'vendedor': 'Vendedores'
        };
        return textos[destinatario] || destinatario;
    }

    getTiempoRelativo(fecha) {
        const ahora = new Date();
        const diff = ahora - fecha;
        const minutos = Math.floor(diff / 60000);
        const horas = Math.floor(diff / 3600000);
        const dias = Math.floor(diff / 86400000);

        if (minutos < 1) return 'Ahora';
        if (minutos < 60) return `Hace ${minutos} min`;
        if (horas < 24) return `Hace ${horas}h`;
        if (dias < 7) return `Hace ${dias} día${dias > 1 ? 's' : ''}`;
        return fecha.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    }

    getIniciales(nombre) {
        return nombre
            .split(' ')
            .map(palabra => palabra.charAt(0).toUpperCase())
            .slice(0, 2)
            .join('');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML.replace(/\n/g, '<br>');
    }

    showNotification(message, type = 'info') {
        if (window.showNotification) {
            window.showNotification(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }

    destroy() {
        if (this.unsubscribeNotas) {
            this.unsubscribeNotas();
            this.unsubscribeNotas = null;
        }
        console.log('📝 Módulo de notas destruido');
    }
}

window.notasModuleInstance = null;

function loadNotasModule() {
    if (window.notasModuleInstance) {
        window.notasModuleInstance.destroy();
    }
    window.notasModuleInstance = new NotasModule();
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { NotasModule, loadNotasModule };
}
