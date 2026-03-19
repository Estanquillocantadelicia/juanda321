// Módulo de Caja - Sistema Completo
class CajaModule {
    constructor() {
        this.cajaActual = null;
        this.ventas = [];
        this.movimientos = [];
        this.historialCajas = [];
        this.currentTab = 'turno-actual';
        this.horarioComercial = null;
        this.moduleId = 'caja';
        this.cierreLocal = false; // Flag para detectar cierre desde este dispositivo
        this.procesandoApertura = false; // Flag anti-doble-clic en apertura
        this.init();
    }

    async init() {
        console.log('💰 Inicializando módulo de caja...');

        this.showLoading();

        try {
            // Crear modales si no existen
            console.log('0️⃣ Asegurando que los modales existan...');
            await this.ensureModalsExist();

            // Cargar de forma secuencial para mejor diagnóstico
            console.log('1️⃣ Cargando horario comercial...');
            await this.cargarHorarioComercial();

            console.log('2️⃣ Cargando caja actual...');
            await this.cargarCajaActual();

            console.log('3️⃣ Cargando historial...');
            await this.cargarHistorial();

            console.log('4️⃣ Configurando event listeners...');
            this.setupEventListeners();

            console.log('4.5️⃣ Configurando event listeners de modales...');
            this.setupModalEventListeners();

            console.log('5️⃣ Configurando sincronización en tiempo real...');
            this.setupRealtimeSync();

            console.log('6️⃣ Configurando eventos globales...');
            this.setupGlobalEventListeners();

            console.log('7️⃣ Renderizando estado de caja...');
            this.renderEstadoCaja();

            console.log('✅ Módulo de caja inicializado correctamente');
        } catch (error) {
            console.error('❌ Error crítico inicializando módulo de caja:', error);
            console.error('Detalles del error:', {
                message: error.message,
                code: error.code,
                stack: error.stack
            });

            // Mostrar notificación con más contexto
            const mensaje = `Error al inicializar módulo de caja: ${error.message || 'Error desconocido'}`;
            this.showNotification(mensaje, 'error');

            // Renderizar estado básico aunque haya error
            try {
                this.renderEstadoCaja();
            } catch (renderError) {
                console.error('Error adicional al renderizar:', renderError);
            }
        } finally {
            this.hideLoading();
        }
    }

    async ensureModalsExist() {
        // Verificar si los modales ya existen en el contenedor permanente
        // También verificar el modal de resultado (puede faltar en cargas previas)
        if (document.getElementById('modal-apertura') && document.getElementById('modal-resultado-cierre')) {
            console.log('✅ Modales de caja ya existen en el DOM permanente');
            return;
        }

        // Si solo falta el modal de resultado, inyectarlo sin duplicar los demás
        if (document.getElementById('modal-apertura') && !document.getElementById('modal-resultado-cierre')) {
            const permanentContainer = document.getElementById('permanent-modals-container');
            if (permanentContainer) {
                const div = document.createElement('div');
                div.id = 'modal-resultado-cierre';
                div.className = 'modal-caja';
                div.innerHTML = `
                    <div class="modal-caja-wrapper">
                        <div class="modal-caja-content modal-resultado-content">
                            <div class="modal-caja-header modal-resultado-header">
                                <h2>Resultado del Arqueo</h2>
                            </div>
                            <div class="modal-caja-body" id="resultado-cierre-content"></div>
                        </div>
                    </div>`;
                permanentContainer.appendChild(div);
                console.log('✅ Modal de resultado inyectado en contenedor permanente');
            }
            return;
        }

        console.log('📦 Creando modales de caja en el contenedor permanente...');
        
        // Obtener el contenedor permanente
        const permanentContainer = document.getElementById('permanent-modals-container');
        if (!permanentContainer) {
            console.error('❌ Contenedor permanente no encontrado');
            return;
        }

        // Cargar el HTML de los modales
        try {
            const response = await fetch('./modules/caja/caja-modals.html');
            const modalsHTML = await response.text();
            
            // Crear un div temporal para parsear el HTML
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = modalsHTML;
            
            // Mover los modales al contenedor permanente
            while (tempDiv.firstChild) {
                permanentContainer.appendChild(tempDiv.firstChild);
            }
            
            console.log('✅ Modales de caja creados en contenedor permanente');
            
        } catch (error) {
            console.error('❌ Error cargando modales:', error);
        }
    }

    setupModalEventListeners() {
        console.log('🔧 Configurando event listeners de modales de caja...');
        
        // Modal Apertura
        const modalApertura = document.getElementById('modal-apertura');
        const closeApertura = document.getElementById('modal-apertura-close');
        const btnCancelarApertura = document.getElementById('btn-cancelar-apertura');

        if (closeApertura) {
            closeApertura.onclick = () => this.cerrarModalApertura();
        }

        if (btnCancelarApertura) {
            btnCancelarApertura.onclick = () => this.cerrarModalApertura();
        }

        if (modalApertura) {
            modalApertura.onclick = (e) => {
                if (e.target === modalApertura) {
                    this.cerrarModalApertura();
                }
            };
        }

        // Modal Cierre
        const modalCierre = document.getElementById('modal-cierre');
        const closeCierre = document.getElementById('modal-cierre-close');
        const btnCancelarCierre = document.getElementById('btn-cancelar-cierre');

        if (closeCierre) {
            closeCierre.onclick = () => this.cerrarModalCierre();
        }

        if (btnCancelarCierre) {
            btnCancelarCierre.onclick = () => this.cerrarModalCierre();
        }

        if (modalCierre) {
            modalCierre.onclick = (e) => {
                if (e.target === modalCierre) {
                    this.cerrarModalCierre();
                }
            };
        }

        // Modal Movimiento
        const modalMovimiento = document.getElementById('modal-movimiento');
        const closeMovimiento = document.getElementById('modal-movimiento-close');
        const btnCancelarMovimiento = document.getElementById('btn-cancelar-movimiento');

        if (closeMovimiento) {
            closeMovimiento.onclick = () => this.cerrarModalMovimiento();
        }

        if (btnCancelarMovimiento) {
            btnCancelarMovimiento.onclick = () => this.cerrarModalMovimiento();
        }

        if (modalMovimiento) {
            modalMovimiento.onclick = (e) => {
                if (e.target === modalMovimiento) {
                    this.cerrarModalMovimiento();
                }
            };
        }

        // Modal Detalle Caja
        const modalDetalleCaja = document.getElementById('modal-detalle-caja');
        const closeDetalleCaja = document.getElementById('modal-detalle-caja-close');

        if (closeDetalleCaja) {
            closeDetalleCaja.onclick = () => this.cerrarModalDetalleCaja();
        }

        if (modalDetalleCaja) {
            modalDetalleCaja.onclick = (e) => {
                if (e.target === modalDetalleCaja) {
                    this.cerrarModalDetalleCaja();
                }
            };
        }

        // Modal Resultado Cierre (arqueo ciego)
        const modalResultadoCierre = document.getElementById('modal-resultado-cierre');
        if (modalResultadoCierre) {
            modalResultadoCierre.onclick = (e) => {
                if (e.target === modalResultadoCierre) {
                    modalResultadoCierre.classList.remove('active');
                }
            };
        }

        console.log('✅ Event listeners de modales de caja configurados');
    }

    cerrarModalApertura() {
        const modal = document.getElementById('modal-apertura');
        if (modal) {
            modal.classList.remove('active');
            modal.style.cssText = '';
            const wrapper = modal.querySelector('.modal-caja-wrapper');
            const content = modal.querySelector('.modal-caja-content');
            if (wrapper) wrapper.style.cssText = '';
            if (content) content.style.cssText = '';
        }
    }

    cerrarModalCierre() {
        const modal = document.getElementById('modal-cierre');
        if (modal) {
            modal.classList.remove('active');
            modal.style.cssText = '';
            const wrapper = modal.querySelector('.modal-caja-wrapper');
            const content = modal.querySelector('.modal-caja-content');
            if (wrapper) wrapper.style.cssText = '';
            if (content) content.style.cssText = '';
        }
    }

    cerrarModalMovimiento() {
        const modal = document.getElementById('modal-movimiento');
        if (modal) {
            modal.classList.remove('active');
            modal.style.cssText = '';
            const wrapper = modal.querySelector('.modal-caja-wrapper');
            const content = modal.querySelector('.modal-caja-content');
            if (wrapper) wrapper.style.cssText = '';
            if (content) content.style.cssText = '';
        }
    }

    cerrarModalDetalleCaja() {
        const modal = document.getElementById('modal-detalle-caja');
        if (modal) {
            modal.classList.remove('active');
            modal.style.cssText = '';
            const wrapper = modal.querySelector('.modal-caja-wrapper');
            const content = modal.querySelector('.modal-caja-content');
            if (wrapper) wrapper.style.cssText = '';
            if (content) content.style.cssText = '';
        }
    }

    setupGlobalEventListeners() {
        if (!window.eventBus) {
            console.warn('⚠️ EventBus no disponible');
            return;
        }

        // Escuchar evento de venta completada
        this.unsubscribeVentaCompletada = window.eventBus.on('venta:completada', async (event) => {
            const data = event.detail;
            console.log('📡 Evento recibido en módulo de caja (venta completada):', data);
            await this.procesarEventoVenta(data, 'completada');
        }, this.moduleId);

        // Escuchar evento de venta cancelada
        this.unsubscribeVentaCancelada = window.eventBus.on('venta:cancelada', async (event) => {
            const data = event.detail;
            console.log('📡 Evento recibido en módulo de caja (venta cancelada):', data);
            await this.procesarEventoVenta(data, 'cancelada');
        }, this.moduleId);

        console.log('📡 Listeners de eventos globales configurados (ventas)');
    }

    async procesarEventoVenta(data, tipoEvento) {
        // Verificar si hay caja abierta
        if (!this.cajaActual) {
            console.log('ℹ️ No hay caja abierta, ignorando evento');
            return;
        }

        // Verificar si la venta es del mismo vendedor
        const userId = window.authSystem?.currentUser?.uid;
        if (data.vendedorId !== userId) {
            console.log('ℹ️ Venta de otro vendedor, ignorando');
            return;
        }

        try {
            // Si es una cancelación y el método fue EFECTIVO, registrar contra-movimiento
            if (tipoEvento === 'cancelada' && data.metodoPago?.toLowerCase() === 'efectivo') {
                console.log('💰 Reversando efectivo por venta cancelada:', data.folio);
                await this.registrarMovimientoCancelacion(data);
            }

            // Recargar datos
            await this.cargarVentasTurno();

            // Actualizar UI
            this.renderEstadoCaja();

            if (this.currentTab === 'turno-actual') {
                this.renderVentasTurno();
            }

            // Mostrar notificación
            const msg = tipoEvento === 'completada' 
                ? `✅ Nueva venta registrada: ${data.folio}`
                : `⚠️ Venta cancelada y efectivo reversado: ${data.folio}`;
            
            this.showNotification(msg, tipoEvento === 'completada' ? 'success' : 'warning');

        } catch (error) {
            console.error('❌ Error actualizando por evento:', error);
        }
    }

    async registrarMovimientoCancelacion(venta) {
        if (!this.cajaActual) return;

        try {
            const movimiento = {
                id: window.db.collection('cajas').doc().id,
                tipo: 'egreso',
                monto: parseFloat(venta.total),
                descripcion: `REVERSO VENTA CANCELADA - Folio: ${venta.folio}`,
                categoria: 'Cancelación',
                fecha: firebase.firestore.Timestamp.now(),
                vendedorId: venta.vendedorId,
                vendedorNombre: window.authSystem?.currentUser?.displayName || 'Vendedor',
                isAuto: true // Movimiento automático por el sistema
            };

            const nuevosMovimientos = [...(this.cajaActual.movimientos || []), movimiento];
            
            await window.db.collection('cajas').doc(this.cajaActual.id).update({
                movimientos: nuevosMovimientos,
                'metadatos.ultimaActualizacion': firebase.firestore.Timestamp.now()
            });

            console.log('✅ Movimiento de reverso registrado en caja');
        } catch (error) {
            console.error('❌ Error registrando reverso en caja:', error);
            throw error;
        }
    }

    setupRealtimeSync() {
        const userId = window.authSystem?.currentUser?.uid;
        if (!userId) return;

        // Escuchar cambios en la caja del usuario actual
        this.unsubscribeCaja = window.db.collection('cajas')
            .where('vendedorId', '==', userId)
            .where('estado', '==', 'abierta')
            .onSnapshot((snapshot) => {
                if (snapshot.empty) {
                    // La caja fue cerrada
                    if (this.cajaActual) {
                        // Solo mostrar notificación si NO fue un cierre local
                        if (!this.cierreLocal) {
                            console.log('🔒 Caja cerrada en otro dispositivo');
                            this.showNotification('Caja cerrada desde otro dispositivo', 'warning');
                        } else {
                            console.log('🔒 Caja cerrada localmente');
                        }

                        this.removeLocalStorage(`caja_abierta_${userId}`);
                        this.cajaActual = null;
                        this.ventas = [];
                        this.movimientos = [];

                        // Detener listeners
                        if (this.unsubscribeMovimientos) {
                            this.unsubscribeMovimientos();
                            this.unsubscribeMovimientos = null;
                        }
                        if (this.unsubscribeVentas) {
                            this.unsubscribeVentas();
                            this.unsubscribeVentas = null;
                        }

                        // Resetear flag después de usarlo
                        this.cierreLocal = false;

                        this.renderEstadoCaja();
                    }
                } else {
                    // Verificar si cambió el estado
                    const doc = snapshot.docs[0];
                    const nuevaCaja = { id: doc.id, ...doc.data() };

                    // Solo sincronizar si es una caja DIFERENTE (no la que acabamos de crear)
                    if (!this.cajaActual || this.cajaActual.id !== nuevaCaja.id) {
                        console.log('🔄 Caja detectada desde otro dispositivo/tab:', nuevaCaja.id);
                        this.cajaActual = nuevaCaja;
                        this.setLocalStorage(`caja_abierta_${userId}`, doc.id);
                        this.cargarVentasTurno();
                        this.cargarMovimientosTurno();
                        this.renderEstadoCaja();

                        // Recargar historial
                        this.cargarHistorial();

                        // Configurar listeners para la nueva caja
                        this.setupMovimientosListener();
                        this.setupVentasListener();
                    }
                }
            }, (error) => {
                console.error('Error en listener de caja:', error);
            });

        console.log('🔄 Sincronización en tiempo real activada');
    }

    async setupVentasListener() {
        if (!this.cajaActual) {
            console.log('⚠️ No se puede configurar listener: no hay caja abierta');
            return;
        }

        const fechaApertura = this.cajaActual.fechaApertura.toDate();
        const fechaCierre = new Date(); // Ahora mismo
        console.log('🔧 Configurando listener de ventas desde:', fechaApertura.toLocaleString());

        // Detener listener anterior si existe
        if (this.unsubscribeVentas) {
            console.log('🛑 Deteniendo listener anterior de ventas');
            this.unsubscribeVentas();
        }

        // LISTENER ULTRA SIMPLIFICADO: Solo vendedorId (sin fecha ni estado)
        this.unsubscribeVentas = window.db.collection('sales')
            .where('vendedorId', '==', this.cajaActual.vendedorId)
            .onSnapshot((snapshot) => {
                console.log(`📡 ========== LISTENER SNAPSHOT RECIBIDO ==========`);
                console.log(`📡 Total documentos del vendedor: ${snapshot.docs.length}`);

                const ventasAnteriores = this.ventas.length;

                // Mapear TODAS las ventas del vendedor
                const todasLasVentas = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                console.log(`📋 Ventas totales del vendedor: ${todasLasVentas.length}`);

                // FILTRADO MANUAL: Solo ventas que NO estén canceladas y dentro del rango de fechas
                const timestampApertura = firebase.firestore.Timestamp.fromDate(fechaApertura);
                const timestampCierre = firebase.firestore.Timestamp.fromDate(fechaCierre);

                this.ventas = todasLasVentas.filter(venta => {
                    // 🚀 MEJORA PROFESIONAL: Considerar estado 'completada' o 'pendiente'
                    const esValida = venta.estado === 'completada' || venta.estado === 'pendiente';
                    const dentroRango = venta.fecha >= timestampApertura && venta.fecha <= timestampCierre;
                    return dentroRango; // Mantenemos el array para el historial, pero renderEstadoCaja filtrará las canceladas
                });

                console.log(`✅ Ventas COMPLETADAS del turno: ${this.ventas.length}`);
                this.ventas.forEach(v => {
                    console.log(`   ✓ ${v.folio}: $${v.total} (${v.metodoPago || v.tipoPago})`);
                });

                // Detectar cambios
                const ventasNuevas = this.ventas.length - ventasAnteriores;
                if (ventasNuevas > 0) {
                    console.log(`✨ ${ventasNuevas} VENTA(S) NUEVA(S) ✨`);
                    this.showNotification(`✅ ${ventasNuevas} nueva(s) venta(s) registrada(s)`, 'success');
                }

                console.log(`📊 Total ventas del turno: ${this.ventas.length}`);
                console.log(`================================================`);

                // Actualizar UI
                this.renderEstadoCaja();

                if (this.currentTab === 'turno-actual') {
                    this.renderVentasTurno();
                }
            }, (error) => {
                console.error('❌ ERROR EN LISTENER:', error);
            });

        console.log('👂✅ Listener activado (filtrado en memoria - NO requiere índices)');
    }

    setupMovimientosListener() {
        if (!this.cajaActual) return;

        // Detener listener anterior si existe
        if (this.unsubscribeMovimientos) {
            this.unsubscribeMovimientos();
        }

        // Escuchar cambios en el documento de la caja (incluye movimientos)
        this.unsubscribeMovimientos = window.db.collection('cajas')
            .doc(this.cajaActual.id)
            .onSnapshot((doc) => {
                if (doc.exists) {
                    const data = doc.data();
                    const movimientosActualizados = data.movimientos || [];

                    // Solo actualizar si hay cambios
                    if (JSON.stringify(movimientosActualizados) !== JSON.stringify(this.movimientos)) {
                        console.log(`🔄 Movimientos detectados: ${movimientosActualizados.length} total (antes: ${this.movimientos.length})`);

                        this.movimientos = movimientosActualizados;
                        this.cajaActual.movimientos = movimientosActualizados;

                        // ✅ IMPORTANTE: Actualizar SIEMPRE el estado de caja para reflejar cambios en efectivo
                        this.renderEstadoCaja();

                        // Actualizar UI si estamos en la pestaña de movimientos
                        if (this.currentTab === 'movimientos') {
                            this.renderMovimientos();
                        }

                        console.log(`✅ Tarjeta de efectivo actualizada`);
                    }
                }
            }, (error) => {
                console.error('Error en listener de movimientos:', error);
            });

        console.log('👂 Listener de movimientos activado para caja:', this.cajaActual.id);
    }

    setupEventListeners() {
        console.log('🔧 Configurando event listeners (con clonado de elementos para limpieza completa)');
        
        // 🔧 SOLUCIÓN ANTI-DUPLICACIÓN: Clonar elemento del formulario para eliminar TODOS los listeners
        const formMovimientoViejo = document.getElementById('form-movimiento');
        if (formMovimientoViejo) {
            const formMovimientoNuevo = formMovimientoViejo.cloneNode(true);
            formMovimientoViejo.parentNode.replaceChild(formMovimientoNuevo, formMovimientoViejo);
            console.log('🧹 Elemento del formulario clonado - todos los listeners antiguos eliminados');
        }
        
        // Setup tabs con indicador animado
        this.setupTabsSystem();

        // Handler para tabs
        this.handleTabClick = (e) => {
            this.cambiarTab(e.currentTarget.dataset.tab);
        };
        
        // Tabs
        this.tabButtons = document.querySelectorAll('.tab-btn');
        this.tabButtons.forEach(btn => {
            btn.addEventListener('click', this.handleTabClick);
        });

        // 🔧 SOLUCIÓN: Usar delegación de eventos para botones dinámicos (abrir/cerrar caja)
        // Estos botones se crean dinámicamente en renderEstadoCaja()
        this.handleContainerClick = (e) => {
            const btnAbrirCaja = e.target.closest('#btn-abrir-caja');
            const btnCerrarCaja = e.target.closest('#btn-cerrar-caja');
            
            if (btnAbrirCaja) {
                this.abrirModalApertura();
            } else if (btnCerrarCaja) {
                this.abrirModalCierre();
            }
        };
        
        // Agregar listener al contenedor (delegación de eventos)
        const estadoCajaContainer = document.getElementById('estado-caja-container');
        if (estadoCajaContainer) {
            this.estadoCajaContainer = estadoCajaContainer;
            estadoCajaContainer.addEventListener('click', this.handleContainerClick);
        }

        // Handlers para formularios
        this.handleFormAperturaSubmit = (e) => {
            e.preventDefault();
            this.procesarApertura();
        };
        
        this.handleFormCierreSubmit = (e) => {
            e.preventDefault();
            this.procesarCierre();
        };
        
        this.handleFormMovimientoSubmit = (e) => {
            e.preventDefault();
            this.procesarMovimiento();
        };

        // Formulario apertura
        const formApertura = document.getElementById('form-apertura');
        if (formApertura) {
            this.formApertura = formApertura;
            formApertura.addEventListener('submit', this.handleFormAperturaSubmit);
        }

        // Formulario cierre
        const formCierre = document.getElementById('form-cierre');
        if (formCierre) {
            this.formCierre = formCierre;
            formCierre.addEventListener('submit', this.handleFormCierreSubmit);
        }

        // Handler para cálculo de diferencia
        this.handleEfectivoRealInput = () => this.calcularDiferencia();
        
        // Cálculo de diferencia en tiempo real
        const efectivoReal = document.getElementById('efectivo-real');
        if (efectivoReal) {
            this.efectivoReal = efectivoReal;
            efectivoReal.addEventListener('input', this.handleEfectivoRealInput);
        }

        // Handlers para movimientos
        this.handleNuevoIngreso = () => this.abrirModalMovimiento('ingreso');
        this.handleNuevoEgreso = () => this.abrirModalMovimiento('egreso');
        
        // Botones de movimientos
        const btnNuevoIngreso = document.getElementById('btn-nuevo-ingreso');
        const btnNuevoEgreso = document.getElementById('btn-nuevo-egreso');

        if (btnNuevoIngreso) {
            this.btnNuevoIngreso = btnNuevoIngreso;
            btnNuevoIngreso.addEventListener('click', this.handleNuevoIngreso);
        }
        if (btnNuevoEgreso) {
            this.btnNuevoEgreso = btnNuevoEgreso;
            btnNuevoEgreso.addEventListener('click', this.handleNuevoEgreso);
        }

        // Formulario movimiento (AHORA con el elemento clonado sin listeners previos)
        const formMovimiento = document.getElementById('form-movimiento');
        if (formMovimiento) {
            this.formMovimiento = formMovimiento;
            formMovimiento.addEventListener('submit', this.handleFormMovimientoSubmit);
            console.log('✅ Nuevo listener del formulario de movimiento agregado (sin duplicados)');
        }

        // Handler para filtros
        this.handleFilterChange = () => this.aplicarFiltrosHistorial();
        
        // Filtros de historial
        const filterPeriodo = document.getElementById('filter-periodo-historial');
        const filterVendedor = document.getElementById('filter-vendedor-historial');
        const filterEstado = document.getElementById('filter-estado-historial');

        this.filterElements = [filterPeriodo, filterVendedor, filterEstado].filter(f => f);
        this.filterElements.forEach(filter => {
            filter.addEventListener('change', this.handleFilterChange);
        });
        
        console.log('✅ Event listeners configurados (sin acumulación de listeners)');
    }

    cleanupEventListeners() {
        // Remover listeners de tabs
        if (this.tabButtons) {
            this.tabButtons.forEach(btn => {
                if (this.handleTabClick) {
                    btn.removeEventListener('click', this.handleTabClick);
                }
            });
        }

        // Remover listener de contenedor
        if (this.estadoCajaContainer && this.handleContainerClick) {
            this.estadoCajaContainer.removeEventListener('click', this.handleContainerClick);
        }

        // Remover listeners de formularios
        if (this.formApertura && this.handleFormAperturaSubmit) {
            this.formApertura.removeEventListener('submit', this.handleFormAperturaSubmit);
        }

        if (this.formCierre && this.handleFormCierreSubmit) {
            this.formCierre.removeEventListener('submit', this.handleFormCierreSubmit);
        }

        if (this.formMovimiento && this.handleFormMovimientoSubmit) {
            this.formMovimiento.removeEventListener('submit', this.handleFormMovimientoSubmit);
        }

        // Remover listener de efectivo real
        if (this.efectivoReal && this.handleEfectivoRealInput) {
            this.efectivoReal.removeEventListener('input', this.handleEfectivoRealInput);
        }

        // Remover listeners de botones de movimientos
        if (this.btnNuevoIngreso && this.handleNuevoIngreso) {
            this.btnNuevoIngreso.removeEventListener('click', this.handleNuevoIngreso);
        }

        if (this.btnNuevoEgreso && this.handleNuevoEgreso) {
            this.btnNuevoEgreso.removeEventListener('click', this.handleNuevoEgreso);
        }

        // Remover listeners de filtros
        if (this.filterElements) {
            this.filterElements.forEach(filter => {
                if (this.handleFilterChange) {
                    filter.removeEventListener('change', this.handleFilterChange);
                }
            });
        }
    }

    setupModalCloseListeners() {
        // 🔧 SOLUCIÓN: Guardar referencias a los handlers para poder eliminarlos después
        this.modalCloseListeners = [];
        
        const modales = [
            'modal-apertura',
            'modal-cierre',
            'modal-movimiento',
            'modal-detalle-caja'
        ];

        modales.forEach(modalId => {
            const modal = document.getElementById(modalId);
            const closeBtn = document.getElementById(`${modalId}-close`);
            const cancelBtn = document.getElementById(`btn-cancelar-${modalId.replace('modal-', '')}`);

            if (closeBtn) {
                const handler = () => modal.classList.remove('active');
                closeBtn.addEventListener('click', handler);
                this.modalCloseListeners.push({ element: closeBtn, handler });
            }
            if (cancelBtn) {
                const handler = () => modal.classList.remove('active');
                cancelBtn.addEventListener('click', handler);
                this.modalCloseListeners.push({ element: cancelBtn, handler });
            }
        });
    }

    setupTabsSystem() {
        const tabs = document.querySelectorAll('.tab-btn');
        const indicator = document.querySelector('.tab-indicator');

        if (!indicator) return;

        // Aplicar permisos graduales - verificar acceso a pestaña de historial
        this.aplicarPermisosGraduales();

        // Inicializar el indicador en la primera pestaña activa
        const activeTab = document.querySelector('.tab-btn.active');
        if (activeTab) {
            this.updateTabIndicator(activeTab, indicator, false);
        }

        // Actualizar indicador al redimensionar la ventana
        window.addEventListener('resize', () => {
            const currentActiveTab = document.querySelector('.tab-btn.active');
            if (currentActiveTab && indicator) {
                this.updateTabIndicator(currentActiveTab, indicator, false);
            }
        });
    }
    
    aplicarPermisosGraduales() {
        const tienePermisoHistorial = window.authSystem?.hasSubPermission('caja', 'historial') ?? true;
        const tabHistorial = document.querySelector('.tab-btn[data-tab="historial"]');
        
        if (tabHistorial) {
            if (!tienePermisoHistorial) {
                tabHistorial.classList.add('disabled');
                tabHistorial.style.opacity = '0.4';
                tabHistorial.style.cursor = 'not-allowed';
                tabHistorial.title = 'No tienes permiso para ver el historial de cajas';
            } else {
                tabHistorial.classList.remove('disabled');
                tabHistorial.style.opacity = '';
                tabHistorial.style.cursor = '';
                tabHistorial.title = '';
            }
        }
    }

    updateTabIndicator(activeTab, indicator, animate = true) {
        if (!activeTab || !indicator) return;

        const tabsContainer = activeTab.parentElement;
        const tabRect = activeTab.getBoundingClientRect();
        const containerRect = tabsContainer.getBoundingClientRect();

        const left = tabRect.left - containerRect.left;
        const width = tabRect.width;

        if (!animate) {
            indicator.style.transition = 'none';
        }

        indicator.style.width = `${width}px`;
        indicator.style.transform = `translateX(${left}px)`;

        if (!animate) {
            setTimeout(() => {
                indicator.style.transition = '';
            }, 50);
        }
    }

    cambiarTab(tab) {
        // Verificar si la pestaña está deshabilitada
        const targetTab = document.querySelector(`[data-tab="${tab}"]`);
        if (targetTab && targetTab.classList.contains('disabled')) {
            // Verificar si es por permisos o por caja cerrada
            if (tab === 'historial' && !window.authSystem?.hasSubPermission('caja', 'historial')) {
                this.showNotification('No tienes permiso para acceder al historial de cajas', 'warning');
            } else {
                this.showNotification('Debes abrir una caja para acceder a movimientos', 'warning');
            }
            return;
        }

        this.currentTab = tab;

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        if (targetTab) {
            targetTab.classList.add('active');

            // Actualizar indicador animado
            const indicator = document.querySelector('.tab-indicator');
            if (indicator) {
                this.updateTabIndicator(targetTab, indicator, true);
            }
        }

        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });

        const targetContent = document.getElementById(`tab-${tab}`);
        if (targetContent) {
            setTimeout(() => {
                targetContent.classList.add('active');
            }, 150);
        }

        if (tab === 'movimientos') {
            this.renderMovimientos();
        } else if (tab === 'historial') {
            this.renderHistorial();
        }
    }

    async cargarHorarioComercial() {
        try {
            const configDoc = await window.db.collection('configuracion').doc('general').get();
            if (configDoc.exists) {
                const config = configDoc.data();
                this.horarioComercial = config.horarioComercial || {
                    horaInicio: '09:00',
                    horaFin: '07:00',
                    esDiaSiguiente: true
                };
            } else {
                this.horarioComercial = {
                    horaInicio: '09:00',
                    horaFin: '07:00',
                    esDiaSiguiente: true
                };
            }
        } catch (error) {
            console.error('Error cargando horario comercial:', error);
            this.horarioComercial = {
                horaInicio: '09:00',
                horaFin: '07:00',
                esDiaSiguiente: true
            };
        }
    }

    calcularDiaComercialActual() {
        const { horaInicio, horaFin, esDiaSiguiente } = this.horarioComercial;
        const ahora = new Date();

        const [horaInicioH, horaInicioM] = horaInicio.split(':').map(Number);
        const [horaFinH, horaFinM] = horaFin.split(':').map(Number);

        let inicio = new Date(ahora);
        inicio.setHours(horaInicioH, horaInicioM, 0, 0);

        let fin = new Date(ahora);
        fin.setHours(horaFinH, horaFinM, 0, 0);

        if (esDiaSiguiente) {
            fin.setDate(fin.getDate() + 1);
        }

        if (ahora < inicio) {
            inicio.setDate(inicio.getDate() - 1);
            fin.setDate(fin.getDate() - 1);
        }

        return { inicio, fin };
    }

    async verificarCierreAutomatico(caja) {
        if (!this.horarioComercial) {
            console.warn('⚠️ No hay horario comercial configurado');
            return false;
        }

        const ahora = new Date();
        const fechaApertura = caja.fechaApertura.toDate();
        
        // Calcular el horario comercial basado en la fecha de apertura
        const { horaInicio, horaFin, esDiaSiguiente } = this.horarioComercial;
        const [horaFinH, horaFinM] = horaFin.split(':').map(Number);

        // Calcular hora de cierre esperada
        let horaCierreEsperada = new Date(fechaApertura);
        horaCierreEsperada.setHours(horaFinH, horaFinM, 0, 0);

        if (esDiaSiguiente) {
            horaCierreEsperada.setDate(horaCierreEsperada.getDate() + 1);
        }

        // Agregar margen de tolerancia de 2 horas
        const margenTolerancia = 2 * 60 * 60 * 1000; // 2 horas en milisegundos
        const horaCierreConMargen = new Date(horaCierreEsperada.getTime() + margenTolerancia);

        const debeCerrarse = ahora > horaCierreConMargen;

        if (debeCerrarse) {
            console.log('⏰ Caja debe cerrarse automáticamente:', {
                apertura: fechaApertura.toLocaleString('es-MX'),
                cierreEsperado: horaCierreEsperada.toLocaleString('es-MX'),
                cierreConMargen: horaCierreConMargen.toLocaleString('es-MX'),
                horaActual: ahora.toLocaleString('es-MX')
            });
        }

        return debeCerrarse;
    }

    async cerrarCajaAutomaticamente(caja) {
        try {
            console.log('🤖 Iniciando cierre automático de caja:', caja.id);

            // Cargar ventas del turno para calcular totales
            const fechaApertura = caja.fechaApertura.toDate();
            const ahora = new Date();

            const ventasSnapshot = await window.db.collection('sales')
                .where('vendedorId', '==', caja.vendedorId)
                .get();

            const timestampApertura = firebase.firestore.Timestamp.fromDate(fechaApertura);
            const timestampAhora = firebase.firestore.Timestamp.fromDate(ahora);

            const ventas = ventasSnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(venta => {
                    const esCompletada = venta.estado === 'completada';
                    const dentroRango = venta.fecha >= timestampApertura && venta.fecha <= timestampAhora;
                    return esCompletada && dentroRango;
                });

            // Calcular efectivo
            const efectivoVentas = ventas
                .filter(v => (v.metodoPago || v.tipoPago) === 'efectivo')
                .reduce((sum, v) => sum + (v.total || 0), 0);

            const movimientos = caja.movimientos || [];
            const ingresos = movimientos
                .filter(m => m.tipo === 'ingreso')
                .reduce((sum, m) => sum + (m.monto || 0), 0);

            const egresos = movimientos
                .filter(m => m.tipo === 'egreso')
                .reduce((sum, m) => sum + (m.monto || 0), 0);

            const efectivoEsperado = caja.montoInicial + efectivoVentas + ingresos - egresos;
            const totalVentas = ventas.reduce((sum, v) => sum + (v.total || 0), 0);

            // Actualizar caja en Firebase
            await window.db.collection('cajas').doc(caja.id).update({
                estado: 'cerrada',
                fechaCierre: firebase.firestore.Timestamp.fromDate(ahora),
                efectivoEsperado,
                efectivoReal: efectivoEsperado, // Asumimos que está cuadrado
                diferencia: 0,
                notasCierre: '⏰ Cierre automático por fin de turno. Sistema asume efectivo cuadrado.',
                totalVentas,
                cantidadVentas: ventas.length,
                cierreAutomatico: true
            });

            // Limpiar documento de lock para permitir nueva apertura
            try {
                await window.db.collection('cajas_activas').doc(caja.vendedorId).update({
                    cajaAbertaId: null,
                    ultimaActualizacion: firebase.firestore.FieldValue.serverTimestamp()
                });
                console.log('🔓 Documento de lock limpiado (cierre automático)');
            } catch (lockError) {
                console.warn('⚠️ Error limpiando lock (no crítico):', lockError.message);
            }

            console.log('✅ Caja cerrada automáticamente:', {
                id: caja.id,
                vendedor: caja.vendedor,
                efectivoEsperado,
                totalVentas,
                cantidadVentas: ventas.length
            });

        } catch (error) {
            console.error('❌ Error en cierre automático:', error);
            throw error;
        }
    }

    iniciarVerificacionHorario() {
        // Detener verificación anterior si existe
        if (this.intervalVerificacionHorario) {
            clearInterval(this.intervalVerificacionHorario);
        }

        // Verificar cada 30 minutos si la caja debe cerrarse
        this.intervalVerificacionHorario = setInterval(async () => {
            if (!this.cajaActual) {
                clearInterval(this.intervalVerificacionHorario);
                return;
            }

            const debeCerrarse = await this.verificarCierreAutomatico(this.cajaActual);

            if (debeCerrarse) {
                console.log('🕐 Hora de cierre detectada - cerrando caja...');
                
                // Activar flag de cierre local
                this.cierreLocal = true;
                
                await this.cerrarCajaAutomaticamente(this.cajaActual);
                
                const userId = window.authSystem?.currentUser?.uid;
                if (userId) {
                    this.removeLocalStorage(`caja_abierta_${userId}`);
                }

                this.cajaActual = null;
                this.ventas = [];
                this.movimientos = [];

                // Detener listeners
                if (this.unsubscribeMovimientos) {
                    this.unsubscribeMovimientos();
                    this.unsubscribeMovimientos = null;
                }
                if (this.unsubscribeVentas) {
                    this.unsubscribeVentas();
                    this.unsubscribeVentas = null;
                }

                this.renderEstadoCaja();
                
                this.showNotification('⏰ Caja cerrada automáticamente por fin de turno', 'info');
                
                // Detener verificación
                clearInterval(this.intervalVerificacionHorario);
            }
        }, 30 * 60 * 1000); // 30 minutos

        console.log('⏰ Verificación automática de horario activada (cada 30 min)');
    }

    async cargarCajaActual() {
        try {
            const userId = window.authSystem?.currentUser?.uid;
            if (!userId) {
                console.log('ℹ️ No hay usuario autenticado');
                return;
            }

            console.log('🔍 Buscando caja abierta para usuario:', userId);

            // Intentar consulta optimizada primero
            let querySnapshot;
            try {
                querySnapshot = await window.db.collection('cajas')
                    .where('vendedorId', '==', userId)
                    .where('estado', '==', 'abierta')
                    .orderBy('fechaApertura', 'desc')
                    .limit(1)
                    .get();
            } catch (queryError) {
                // Si falla por índice faltante, usar consulta alternativa sin orderBy
                console.warn('⚠️ Usando consulta alternativa (sin índice compuesto)');
                querySnapshot = await window.db.collection('cajas')
                    .where('vendedorId', '==', userId)
                    .where('estado', '==', 'abierta')
                    .limit(1)
                    .get();
            }

            if (!querySnapshot.empty) {
                const doc = querySnapshot.docs[0];
                const cajaData = {
                    id: doc.id,
                    ...doc.data()
                };

                // 🔒 VERIFICAR SI LA CAJA DEBE CERRARSE AUTOMÁTICAMENTE
                const debeCerrarse = await this.verificarCierreAutomatico(cajaData);
                
                if (debeCerrarse) {
                    console.log('🕐 Caja fuera de horario comercial - cerrando automáticamente...');
                    await this.cerrarCajaAutomaticamente(cajaData);
                    
                    // Limpiar localStorage
                    this.removeLocalStorage(`caja_abierta_${userId}`);
                    this.cajaActual = null;
                    
                    this.showNotification('⏰ La caja se cerró automáticamente por fin de turno', 'info');
                    return;
                }

                // Caja válida dentro del horario
                // Verificar ANTES de sincronizar si esta caja ya estaba registrada en este dispositivo
                const cajaYaEnEsteDispositivo = this.getLocalStorage(`caja_abierta_${userId}`) === doc.id;

                this.cajaActual = cajaData;

                // Sincronizar localStorage con Firebase
                this.setLocalStorage(`caja_abierta_${userId}`, doc.id);

                console.log('📦 Cargando ventas y movimientos iniciales...');
                await this.cargarVentasTurno();
                await this.cargarMovimientosTurno();

                const dispositivo = this.detectarDispositivo();
                console.log('✅ Caja abierta encontrada (', dispositivo, '):', this.cajaActual.id);

                // IMPORTANTE: Activar listeners INMEDIATAMENTE después de cargar la caja
                console.log('🎯 Activando listeners de sincronización en tiempo real...');
                this.setupVentasListener();
                this.setupMovimientosListener();

                // Configurar verificación periódica de horario
                this.iniciarVerificacionHorario();

                // Solo mostrar notificación si la caja fue detectada desde OTRO dispositivo/pestaña
                // Si ya estaba en localStorage = recarga normal del mismo dispositivo, sin notificación
                if (!cajaYaEnEsteDispositivo) {
                    this.mostrarNotificacionMultiDispositivo();
                }
            } else {
                // No hay caja abierta en Firebase
                this.cajaActual = null;

                // Limpiar localStorage si había algo guardado
                const cajaLocalGuardada = this.getLocalStorage(`caja_abierta_${userId}`);
                if (cajaLocalGuardada) {
                    console.log('🧹 Limpiando localStorage (caja cerrada en Firebase)');
                    this.removeLocalStorage(`caja_abierta_${userId}`);
                }

                console.log('ℹ️ No hay caja abierta');
            }
        } catch (error) {
            console.error('❌ Error cargando caja actual:', error);

            // Detectar si es un error de índice faltante (solo log, sin alerta)
            if (error.code === 'failed-precondition') {
                console.warn(`
⚠️ ÍNDICE COMPUESTO RECOMENDADO (opcional)

La consulta a 'cajas' funcionaría más rápido con un índice compuesto.

Para optimizar (opcional):
1. Ve a: https://console.firebase.google.com/project/app-estanquillo/firestore/indexes
2. Crea índice: cajas -> vendedorId (Asc) + estado (Asc)

El sistema continúa funcionando normalmente usando cache local.
                `);
            }

            // Fallback: intentar recuperar desde localStorage si Firebase falla
            const userId = window.authSystem?.currentUser?.uid;
            const cajaIdGuardada = this.getLocalStorage(`caja_abierta_${userId}`);

            if (cajaIdGuardada) {
                console.log('⚠️ Firebase falló, intentando recuperar desde localStorage...');
                try {
                    const cajaDoc = await window.db.collection('cajas').doc(cajaIdGuardada).get();
                    if (cajaDoc.exists && cajaDoc.data().estado === 'abierta') {
                        this.cajaActual = {
                            id: cajaDoc.id,
                            ...cajaDoc.data()
                        };
                        await this.cargarVentasTurno();
                        await this.cargarMovimientosTurno();
                        console.log('✅ Caja recuperada desde localStorage como fallback');
                        return;
                    }
                } catch (fallbackError) {
                    console.error('❌ Fallback también falló:', fallbackError);
                }
            }

            this.cajaActual = null;
        }
    }

    detectarDispositivo() {
        const width = window.innerWidth;
        if (width <= 768) return '📱 Móvil';
        if (width <= 1024) return '📱 Tablet';
        return '💻 Escritorio';
    }

    mostrarNotificacionMultiDispositivo() {
        if (!this.cajaActual) return;

        const fechaApertura = this.cajaActual.fechaApertura.toDate();
        const horaApertura = fechaApertura.toLocaleTimeString('es-MX', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        const mensaje = `🔓 Sesión de caja sincronizada\nAbierta a las ${horaApertura}`;

        // Mostrar notificación discreta
        setTimeout(() => {
            this.showNotification(mensaje, 'info');
        }, 500);
    }

    async cargarVentasTurno() {
        if (!this.cajaActual) {
            this.ventas = [];
            return;
        }

        try {
            const fechaApertura = this.cajaActual.fechaApertura.toDate();
            const ahora = new Date();

            // CONSULTA MÁS SIMPLE: Solo vendedorId (filtrar fecha y estado en memoria)
            const querySnapshot = await window.db.collection('sales')
                .where('vendedorId', '==', this.cajaActual.vendedorId)
                .get();

            // FILTRADO MANUAL: Filtrar por fecha Y estado en memoria
            const timestampApertura = firebase.firestore.Timestamp.fromDate(fechaApertura);
            const timestampAhora = firebase.firestore.Timestamp.fromDate(ahora);

            this.ventas = querySnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(venta => {
                    const esValida = venta.estado === 'completada' || venta.estado === 'pendiente';
                    const dentroRango = venta.fecha >= timestampApertura && venta.fecha <= timestampAhora;
                    return esValida && dentroRango;
                });

            console.log(`✅ ${this.ventas.length} ventas completadas del turno (de ${querySnapshot.size} ventas totales del vendedor)`);
        } catch (error) {
            console.error('Error cargando ventas del turno:', error);
            this.ventas = [];
        }
    }

    async cargarMovimientosTurno() {
        if (!this.cajaActual) {
            this.movimientos = [];
            return;
        }

        try {
            // Los movimientos ahora están dentro del documento de caja
            this.movimientos = this.cajaActual.movimientos || [];
            console.log(`✅ ${this.movimientos.length} movimientos cargados desde caja`);
        } catch (error) {
            console.error('Error cargando movimientos:', error);
            this.movimientos = [];
        }
    }

    async cargarHistorial() {
        try {
            let querySnapshot;

            try {
                // Intentar consulta con orderBy
                querySnapshot = await window.db.collection('cajas')
                    .orderBy('fechaApertura', 'desc')
                    .limit(50)
                    .get();
            } catch (queryError) {
                // Si falla, cargar sin ordenar
                console.warn('⚠️ Cargando historial sin ordenar (índice no disponible)');
                querySnapshot = await window.db.collection('cajas')
                    .limit(50)
                    .get();

                // Ordenar manualmente en memoria
                const docs = querySnapshot.docs.sort((a, b) => {
                    const fechaA = a.data().fechaApertura?.toDate() || new Date(0);
                    const fechaB = b.data().fechaApertura?.toDate() || new Date(0);
                    return fechaB - fechaA;
                });

                // Crear snapshot simulado ordenado
                querySnapshot.docs = docs;
            }

            this.historialCajas = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            console.log(`✅ ${this.historialCajas.length} cajas en historial cargadas`);

            // Cargar vendedores únicos para el filtro
            this.cargarVendedoresFiltro();
        } catch (error) {
            console.error('❌ Error cargando historial de cajas:', error);
            this.historialCajas = [];
        }
    }

    // 🧹 Método para limpiar cajas duplicadas (ejecutar solo cuando sea necesario)
    async limpiarCajasDuplicadas() {
        try {
            console.log('🧹 Buscando cajas duplicadas...');
            
            const userId = window.authSystem?.currentUser?.uid;
            const cajasAbiertas = await window.db.collection('cajas')
                .where('vendedorId', '==', userId)
                .where('estado', '==', 'abierta')
                .get();

            if (cajasAbiertas.size <= 1) {
                console.log('✅ No hay duplicados');
                return;
            }

            // Ordenar por fecha y mantener solo la primera
            const cajas = cajasAbiertas.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .sort((a, b) => a.fechaApertura.toMillis() - b.fechaApertura.toMillis());

            const cajaValida = cajas[0];
            const cajasAEliminar = cajas.slice(1);

            console.log(`🗑️ Eliminando ${cajasAEliminar.length} caja(s) duplicada(s)...`);

            for (const caja of cajasAEliminar) {
                await window.db.collection('cajas').doc(caja.id).delete();
                console.log(`✅ Eliminada caja duplicada: ${caja.id}`);
            }

            // Actualizar estado local
            this.cajaActual = cajaValida;
            await this.cargarHistorial();
            this.renderEstadoCaja();

            this.showNotification(`🧹 ${cajasAEliminar.length} caja(s) duplicada(s) eliminadas`, 'success');

        } catch (error) {
            console.error('❌ Error limpiando duplicados:', error);
            this.showNotification('❌ Error al limpiar duplicados', 'error');
        }
    }

    cargarVendedoresFiltro() {
        const selectVendedor = document.getElementById('filter-vendedor-historial');
        if (!selectVendedor) return;

        // Obtener vendedores únicos del historial
        const vendedoresUnicos = new Map();
        this.historialCajas.forEach(caja => {
            if (caja.vendedorId && caja.vendedor) {
                vendedoresUnicos.set(caja.vendedorId, caja.vendedor);
            }
        });

        // Generar opciones
        let options = '<option value="">Todos</option>';
        vendedoresUnicos.forEach((nombre, id) => {
            options += `<option value="${id}">${nombre}</option>`;
        });

        selectVendedor.innerHTML = options;
    }

    renderEstadoCaja() {
        const container = document.getElementById('estado-caja-container');
        const statsContainer = document.getElementById('stats-turno');
        const ventasContainer = document.getElementById('ventas-turno-container');

        if (!this.cajaActual) {
            container.innerHTML = `
                <div class="estado-caja cerrada">
                    <div class="estado-header">
                        <div class="estado-title">
                            🔒 Caja Cerrada
                            <span class="estado-badge">Sin turno activo</span>
                        </div>
                    </div>
                    <p style="margin: 16px 0; opacity: 0.9;">No hay una caja abierta en este momento. Abre una caja para comenzar tu turno.</p>
                    <div class="estado-actions">
                        <button class="btn btn-primary" id="btn-abrir-caja">
                            <span class="icon">🔓</span> Abrir Caja
                        </button>
                    </div>
                </div>
            `;
            statsContainer.style.display = 'none';
            ventasContainer.style.display = 'none';

            // Deshabilitar pestaña de movimientos
            this.actualizarEstadoPestanas(false);

            // 🔧 NO re-attachear evento - ya está configurado en setupEventListeners()
            // El botón se crea dinámicamente pero el evento se delegará desde el contenedor
            return;
        }


        // Total de ventas (todos los métodos de pago) - SOLO PARA ESTADÍSTICAS
        // 🚀 FILTRO PROFESIONAL: Excluir ventas canceladas del cálculo de caja
        const ventasValidas = this.ventas.filter(v => v.estado !== 'cancelada');
        
        const totalVentas = ventasValidas.reduce((sum, v) => sum + (v.total || 0), 0);

        // ✅ DISCRIMINAR VENTAS POR MÉTODO DE PAGO
        // Usar trim() y toLowerCase() para evitar problemas de formato
        const getMetodo = (v) => (v.metodoPago || v.tipoPago || 'efectivo').toString().toLowerCase().trim();

        const efectivoVentas = ventasValidas
            .filter(v => getMetodo(v) === 'efectivo')
            .reduce((sum, v) => sum + (v.total || 0), 0);

        const tarjetaVentas = this.ventas
            .filter(v => getMetodo(v) === 'tarjeta')
            .reduce((sum, v) => sum + (v.total || 0), 0);

        const transferenciaVentas = this.ventas
            .filter(v => getMetodo(v) === 'transferencia')
            .reduce((sum, v) => sum + (v.total || 0), 0);

        const creditoVentas = this.ventas
            .filter(v => getMetodo(v) === 'credito')
            .reduce((sum, v) => sum + (v.total || 0), 0);

        // Movimientos (ingresos/egresos adicionales)
        const ingresos = this.movimientos
            .filter(m => m.tipo === 'ingreso')
            .reduce((sum, m) => sum + (m.monto || 0), 0);

        const egresos = this.movimientos
            .filter(m => m.tipo === 'egreso')
            .reduce((sum, m) => sum + (m.monto || 0), 0);

        // 💰 EFECTIVO FÍSICO EN CAJA = Solo efectivo + ingresos - egresos
        const efectivoFisico = this.cajaActual.montoInicial + efectivoVentas + ingresos - egresos;

        // 📊 DINERO TOTAL DEL TURNO = Efectivo físico + ventas con otros métodos (para control)
        const dineroTotal = efectivoFisico + tarjetaVentas + transferenciaVentas + creditoVentas;

        console.log('💵 DESGLOSE DE CAJA:', {
            montoInicial: this.cajaActual.montoInicial,
            efectivoVentas,
            tarjetaVentas,
            transferenciaVentas,
            creditoVentas,
            ingresos,
            egresos,
            efectivoFisico: efectivoFisico,
            dineroTotal: dineroTotal,
            movimientosCount: this.movimientos.length
        });

        const fechaApertura = this.cajaActual.fechaApertura.toDate();
        const isAdmin = window.authSystem?.currentUser?.rol === 'administrador';
        const formatter = window.currencyFormatter;

        container.innerHTML = `
            <div class="estado-caja">
                <div class="estado-header">
                    <div class="estado-title">
                        🔓 Caja Abierta
                        <span class="estado-badge">Turno activo</span>
                    </div>
                </div>
                <div class="estado-info">
                    <div class="info-item">
                        <span class="info-label">Vendedor</span>
                        <span class="info-value">${this.cajaActual.vendedor}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Apertura</span>
                        <span class="info-value">${fechaApertura.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    ${isAdmin ? `
                    <div class="info-item">
                        <span class="info-label">Monto Inicial</span>
                        <span class="info-value">${formatter ? formatter.format(this.cajaActual.montoInicial) : '$' + this.cajaActual.montoInicial.toFixed(2)}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">💵 Efectivo en Caja</span>
                        <span class="info-value" style="color: #34C759; font-weight: 700;">${formatter ? formatter.format(efectivoFisico) : '$' + efectivoFisico.toFixed(2)}</span>
                        <small style="opacity: 0.7; font-size: 0.85rem;">Efectivo físico + ingresos - egresos</small>
                    </div>
                    
                    <div class="metodos-pago-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(0,0,0,0.1);">
                        <div class="info-item compact">
                            <span class="info-label">💳 Tarjeta</span>
                            <span class="info-value">${formatter ? formatter.format(tarjetaVentas) : '$' + tarjetaVentas.toFixed(2)}</span>
                        </div>
                        <div class="info-item compact">
                            <span class="info-label">📱 Transf.</span>
                            <span class="info-value">${formatter ? formatter.format(transferenciaVentas) : '$' + transferenciaVentas.toFixed(2)}</span>
                        </div>
                        <div class="info-item compact">
                            <span class="info-label">📝 Crédito</span>
                            <span class="info-value" style="color: #FF9500;">${formatter ? formatter.format(creditoVentas) : '$' + creditoVentas.toFixed(2)}</span>
                        </div>
                        <div class="info-item compact">
                            <span class="info-label">📊 Total Turno</span>
                            <span class="info-value" style="font-weight: 700;">${formatter ? formatter.format(dineroTotal) : '$' + dineroTotal.toFixed(2)}</span>
                        </div>
                    </div>
                    ` : `
                    <div class="info-item">
                        <span class="info-label">Estado de Turno</span>
                        <span class="info-value" style="color: #FF9500; font-weight: 700;">Protegido 🔒</span>
                        <small style="opacity: 0.7; font-size: 0.85rem;">Información financiera oculta por seguridad</small>
                    </div>
                    `}
                </div>
                <div class="estado-actions" style="margin-top: 20px;">
                    <button class="btn btn-danger" id="btn-cerrar-caja">
                        <span class="icon">🔒</span> Cerrar Turno y Entregar
                    </button>
                </div>
            </div>
        `;

        // Actualizar stats (solo si el contenedor existe, lo cual suele ser solo para admin en el HTML)
        const totalEfectivoEl = document.getElementById('total-efectivo');
        const totalVentasEl = document.getElementById('total-ventas');
        const totalIngresosEl = document.getElementById('total-ingresos');
        const totalEgresosEl = document.getElementById('total-egresos');

        if (isAdmin) {
            if (totalEfectivoEl) totalEfectivoEl.textContent = formatter ? formatter.format(efectivoFisico) : '$' + efectivoFisico.toFixed(2);
            if (totalVentasEl) totalVentasEl.textContent = formatter ? formatter.format(totalVentas) : '$' + totalVentas.toFixed(2);
            if (totalIngresosEl) totalIngresosEl.textContent = formatter ? formatter.format(ingresos) : '$' + ingresos.toFixed(2);
            if (totalEgresosEl) totalEgresosEl.textContent = formatter ? formatter.format(egresos) : '$' + egresos.toFixed(2);
            statsContainer.style.display = 'grid';
        } else {
            statsContainer.style.display = 'none';
        }

        // Actualizar desglose adicional en consola para verificación
        console.log('💳 DESGLOSE POR MÉTODO DE PAGO:', {
            efectivo: efectivoVentas,
            tarjeta: tarjetaVentas,
            transferencia: transferenciaVentas,
            credito: creditoVentas
        });

        statsContainer.style.display = 'grid';
        ventasContainer.style.display = 'block';

        // Habilitar pestaña de movimientos
        this.actualizarEstadoPestanas(true);

        this.renderVentasTurno();

        // 🔧 NO re-attachear evento - usaremos delegación de eventos desde el contenedor
    }

    actualizarEstadoPestanas(cajaAbierta) {
        const tabMovimientos = document.querySelector('[data-tab="movimientos"]');

        if (!tabMovimientos) return;

        if (cajaAbierta) {
            // Habilitar pestaña de movimientos
            tabMovimientos.classList.remove('disabled');
        } else {
            // Deshabilitar pestaña de movimientos
            tabMovimientos.classList.add('disabled');

            // Si está en la pestaña de movimientos, cambiar a turno actual
            if (this.currentTab === 'movimientos') {
                this.cambiarTab('turno-actual');
            }
        }
    }

    renderVentasTurno() {
        const tbody = document.getElementById('ventas-turno-body');
        const formatter = window.currencyFormatter;

        if (this.ventas.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 40px; color: #6D6D80;">
                        No hay ventas en este turno
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.ventas.map(venta => {
            const fecha = venta.fecha.toDate();
            const formatter = window.currencyFormatter;
            return `
                <tr>
                    <td>
                        <div>
                            <svg class="row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                            </svg>
                            <span>${venta.folio}</span>
                        </div>
                    </td>
                    <td>
                        <div>
                            <svg class="row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="12 6 12 12 16 14"></polyline>
                            </svg>
                            <span>${fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                    </td>
                    <td>
                        <div>
                            <svg class="row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                            <span>${venta.cliente?.nombre || 'Público general'}</span>
                        </div>
                    </td>
                    <td>
                        <span class="badge badge-${(venta.metodoPago || venta.tipoPago || 'efectivo').toString().toLowerCase() === 'credito' ? 'warning' : 'info'}">
                            ${(venta.metodoPago || venta.tipoPago || 'Efectivo').toString().toUpperCase()}
                        </span>
                    </td>
                    <td>
                        <div style="font-weight: 600; color: #1C1C1E;">
                            ${formatter ? formatter.format(venta.total) : '$' + (venta.total || 0).toFixed(2)}
                        </div>
                    </td>
                    <td>
                        <button class="btn-icon" onclick="window.ventasModule.verDetalleVenta('${venta.id}')" title="Ver detalle">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    abrirModalApertura() {
        const modal = document.getElementById('modal-apertura');
        if (!modal) return;

        // Reset completo de estilos
        modal.style.cssText = '';
        const wrapper = modal.querySelector('.modal-caja-wrapper');
        const content = modal.querySelector('.modal-caja-content');
        if (wrapper) wrapper.style.cssText = '';
        if (content) content.style.cssText = '';

        document.getElementById('form-apertura').reset();

        // Resetear calculadora
        this.resetearCalculadora('apertura');

        // Configurar calculadora de apertura
        this.setupCalculadora('apertura');

        modal.classList.add('active');
    }

    async verificarLimiteCajasGlobal() {
        try {
            // 1. Obtener configuración de límite de cajas
            const configDoc = await window.db.collection('configuracion').doc('general').get();
            const maxCajasAbiertas = configDoc.exists ? (configDoc.data().maxCajasAbiertas || 1) : 1;
            
            console.log('📊 Límite de cajas configurado:', maxCajasAbiertas);
            
            // 2. Contar cajas abiertas actualmente
            const cajasAbiertasSnapshot = await window.db.collection('cajas')
                .where('estado', '==', 'abierta')
                .get();
            
            const cajasAbiertas = cajasAbiertasSnapshot.docs.map(doc => ({
                id: doc.id,
                vendedor: doc.data().vendedor,
                vendedorId: doc.data().vendedorId,
                fechaApertura: doc.data().fechaApertura
            }));
            
            const totalCajasAbiertas = cajasAbiertas.length;
            console.log('📊 Cajas abiertas actualmente:', totalCajasAbiertas, cajasAbiertas);
            
            // 3. Verificar si el usuario actual ya tiene caja abierta
            const userId = window.authSystem?.currentUser?.uid;
            const cajaUsuario = cajasAbiertas.find(c => c.vendedorId === userId);
            
            if (cajaUsuario) {
                // El usuario ya tiene caja, permitir (se sincronizará)
                return {
                    permitido: true,
                    yaAbierta: true,
                    mensaje: 'Ya tienes una caja abierta'
                };
            }
            
            // 4. Verificar límite global
            if (totalCajasAbiertas >= maxCajasAbiertas) {
                // Obtener nombres de vendedores con cajas abiertas
                const vendedoresConCaja = cajasAbiertas.map(c => c.vendedor).join(', ');
                
                return {
                    permitido: false,
                    yaAbierta: false,
                    mensaje: `No se puede abrir caja. Ya hay ${totalCajasAbiertas} caja(s) abierta(s) (límite: ${maxCajasAbiertas}).\n\nVendedor(es) con caja abierta:\n${vendedoresConCaja}`,
                    cajasAbiertas: cajasAbiertas,
                    limite: maxCajasAbiertas
                };
            }
            
            // 5. Hay espacio para abrir nueva caja
            return {
                permitido: true,
                yaAbierta: false,
                mensaje: `Espacio disponible: ${totalCajasAbiertas}/${maxCajasAbiertas} cajas abiertas`
            };
            
        } catch (error) {
            console.error('❌ Error verificando límite de cajas:', error);
            // En caso de error, permitir apertura (fail-safe)
            return {
                permitido: true,
                yaAbierta: false,
                mensaje: 'Error verificando límite, intentando apertura...'
            };
        }
    }

    async procesarApertura() {
        // 🔒 PROTECCIÓN 1: Lock local anti-doble-clic
        if (this.procesandoApertura) {
            console.log('⚠️ Apertura ya en proceso, ignorando...');
            return;
        }

        this.procesandoApertura = true;
        console.log('🔒 Lock de apertura activado');

        // 🔒 PROTECCIÓN 2: Deshabilitar botón inmediatamente
        const btnSubmit = document.querySelector('#form-apertura button[type="submit"]');
        if (btnSubmit) {
            btnSubmit.disabled = true;
            btnSubmit.textContent = 'Verificando disponibilidad...';
        }

        try {
            this.showLoading();

            // 🔒 PROTECCIÓN 3: Verificar límite global de cajas ANTES de intentar abrir
            console.log('🔍 Verificando límite global de cajas...');
            const verificacion = await this.verificarLimiteCajasGlobal();
            
            if (!verificacion.permitido) {
                // No hay espacio para más cajas
                console.log('⛔ Límite de cajas alcanzado:', verificacion.mensaje);
                this.hideLoading();
                this.showNotification(`⛔ ${verificacion.mensaje}`, 'error');
                alert(`⛔ Límite de cajas alcanzado\n\n${verificacion.mensaje}`);
                
                // Cerrar modal y liberar locks
                this.cerrarModalApertura();
                this.procesandoApertura = false;
                if (btnSubmit) {
                    btnSubmit.disabled = false;
                    btnSubmit.textContent = 'Abrir Caja';
                }
                return; // Salir sin abrir caja
            }
            
            console.log('✅ Verificación de límite pasada:', verificacion.mensaje);
            
            if (btnSubmit) {
                btnSubmit.textContent = 'Abriendo caja...';
            }

            const montoInicial = parseFloat(document.getElementById('monto-inicial').value) || 0;
            const notas = document.getElementById('notas-apertura').value;
            const userId = window.authSystem?.currentUser?.uid;
            const userName = window.authSystem?.currentUser?.nombre;

            if (montoInicial < 0) {
                throw new Error('El monto inicial no puede ser negativo');
            }

            // 🔒 PROTECCIÓN 3: Usar TRANSACCIÓN ATÓMICA de Firebase con documento de lock único
            // Esta solución previene duplicados multi-dispositivo usando un documento único por vendedor
            console.log('🔐 Ejecutando apertura con transacción atómica mejorada...');
            
            // Usar documento único de control por vendedor para garantizar atomicidad
            const lockDocRef = window.db.collection('cajas_activas').doc(userId);
            
            const resultado = await window.db.runTransaction(async (transaction) => {
                // ✅ CORRECTO: Leer documento específico (NO query) dentro de la transacción
                const lockDoc = await transaction.get(lockDocRef);
                
                // Verificar si ya existe una caja abierta
                if (lockDoc.exists && lockDoc.data().cajaAbertaId) {
                    const cajaAbertaId = lockDoc.data().cajaAbertaId;
                    console.log('🔍 Verificando caja abierta registrada:', cajaAbertaId);
                    
                    // Verificar que la caja aún existe y está abierta
                    const cajaRef = window.db.collection('cajas').doc(cajaAbertaId);
                    const cajaDoc = await transaction.get(cajaRef);
                    
                    if (cajaDoc.exists && cajaDoc.data().estado === 'abierta') {
                        console.log('⚠️ Caja ya abierta detectada en transacción:', cajaAbertaId);
                        return {
                            existe: true,
                            caja: { id: cajaDoc.id, ...cajaDoc.data() }
                        };
                    } else {
                        // La caja referenciada no existe o está cerrada, limpiar el lock
                        console.log('🧹 Limpiando referencia de caja cerrada/inexistente');
                        transaction.update(lockDocRef, { cajaAbertaId: null, ultimaActualizacion: firebase.firestore.FieldValue.serverTimestamp() });
                    }
                }
                
                // No existe caja abierta, crear nueva
                const nuevaCajaRef = window.db.collection('cajas').doc();
                const nuevaCaja = {
                    vendedorId: userId,
                    vendedor: userName,
                    montoInicial,
                    fechaApertura: firebase.firestore.Timestamp.fromDate(new Date()),
                    estado: 'abierta',
                    notasApertura: notas,
                    horarioComercial: this.horarioComercial,
                    movimientos: []
                };
                
                // Crear la caja y actualizar el documento de lock en la misma transacción
                transaction.set(nuevaCajaRef, nuevaCaja);
                transaction.set(lockDocRef, {
                    vendedorId: userId,
                    cajaAbertaId: nuevaCajaRef.id,
                    ultimaActualizacion: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                
                console.log('💾 Nueva caja creada en transacción:', nuevaCajaRef.id);
                console.log('🔒 Documento de lock actualizado');
                
                return {
                    existe: false,
                    caja: { id: nuevaCajaRef.id, ...nuevaCaja }
                };
            });

            // Procesar resultado de la transacción
            if (resultado.existe) {
                // Ya existía una caja abierta
                const cajaEnLS = this.getLocalStorage(`caja_abierta_${userId}`) || '';
                const esOtroDispositivo = cajaEnLS !== resultado.caja.id;
                this.cajaActual = resultado.caja;
                await this.cargarVentasTurno();
                await this.cargarMovimientosTurno();
                this.cerrarModalApertura();
                this.renderEstadoCaja();
                if (esOtroDispositivo) {
                    this.showNotification('⚠️ Ya tienes una caja abierta desde otro dispositivo. Sesión sincronizada.', 'warning');
                } else {
                    this.showNotification('ℹ️ Ya tienes una caja abierta en este dispositivo.', 'info');
                }
                console.log('✅ Sincronizado con caja existente:', resultado.caja.id);
            } else {
                // Caja creada exitosamente
                this.cajaActual = resultado.caja;
                this.ventas = [];
                this.movimientos = [];

                // Guardar en localStorage
                try {
                    localStorage.setItem(`caja_abierta_${userId}`, resultado.caja.id);
                    console.log('💾 Caja guardada en localStorage:', resultado.caja.id);
                } catch (e) {
                    console.warn('⚠️ No se pudo guardar en localStorage:', e.message);
                }

                // Activar listeners
                this.setupVentasListener();
                this.setupMovimientosListener();

                // Cerrar modal y actualizar UI
                this.cerrarModalApertura();
                this.renderEstadoCaja();

                this.showNotification('Caja abierta exitosamente', 'success');
                console.log('✅ Caja creada exitosamente:', resultado.caja.id);
            }

        } catch (error) {
            console.error('❌ Error abriendo caja:', error);
            this.showNotification(`❌ ${error.message}`, 'error');
        } finally {
            this.hideLoading();
            
            // 🔓 Liberar lock y rehabilitar botón
            this.procesandoApertura = false;
            const btnSubmit = document.querySelector('#form-apertura button[type="submit"]');
            if (btnSubmit) {
                btnSubmit.disabled = false;
                btnSubmit.textContent = 'Abrir Caja';
            }
            console.log('🔓 Lock de apertura liberado');
        }
    }

    abrirModalCierre() {
        if (!this.cajaActual) return;

        const modal = document.getElementById('modal-cierre');
        if (!modal) return;

        const isAdmin = window.authSystem?.currentUser?.rol === 'administrador';
        const formatter = window.currencyFormatter;

        // Reset completo de estilos
        modal.style.cssText = '';
        const wrapper = modal.querySelector('.modal-caja-wrapper');
        const content = modal.querySelector('.modal-caja-content');
        if (wrapper) wrapper.style.cssText = '';
        if (content) content.style.cssText = '';

        const efectivoVentas = this.ventas
            .filter(v => v.metodoPago === 'efectivo' || v.tipoPago === 'efectivo')
            .reduce((sum, v) => sum + (v.total || 0), 0);

        const ingresos = this.movimientos
            .filter(m => m.tipo === 'ingreso')
            .reduce((sum, m) => sum + (m.monto || 0), 0);

        const egresos = this.movimientos
            .filter(m => m.tipo === 'egreso')
            .reduce((sum, m) => sum + (m.monto || 0), 0);

        const efectivoEsperado = this.cajaActual.montoInicial + efectivoVentas + ingresos - egresos;

        // Cierre ciego: nadie ve el efectivo esperado durante el conteo
        // El resumen comparativo se muestra SOLO después de cerrar la caja
        const resumenTurno = modal.querySelector('.resumen-turno-cierre');
        if (resumenTurno) {
            resumenTurno.style.display = 'none';
        }

        // Guardar el valor numérico esperado en un atributo data
        const resumenEsperadoEl = document.getElementById('resumen-esperado');
        resumenEsperadoEl.textContent = formatter ? formatter.format(efectivoEsperado) : '$' + efectivoEsperado.toFixed(2);
        resumenEsperadoEl.dataset.valor = efectivoEsperado;

        document.getElementById('resumen-inicial').textContent = formatter ? formatter.format(this.cajaActual.montoInicial) : '$' + this.cajaActual.montoInicial.toFixed(2);
        document.getElementById('resumen-ventas-efectivo').textContent = formatter ? formatter.format(efectivoVentas) : '$' + efectivoVentas.toFixed(2);
        document.getElementById('resumen-ingresos').textContent = formatter ? formatter.format(ingresos) : '$' + ingresos.toFixed(2);
        document.getElementById('resumen-egresos').textContent = formatter ? formatter.format(egresos) : '$' + egresos.toFixed(2);

        document.getElementById('form-cierre').reset();
        document.getElementById('diferencia-alert').style.display = 'none';

        // Resetear calculadora
        this.resetearCalculadora('cierre');

        // Configurar calculadora de cierre
        this.setupCalculadora('cierre');

        modal.classList.add('active');
    }

    calcularDiferencia() {
        const efectivoReal = parseFloat(document.getElementById('efectivo-real').value) || 0;
        const alert = document.getElementById('diferencia-alert');
        const formatter = window.currencyFormatter;

        // ARQUEO CIEGO: Nunca mostrar la diferencia durante el conteo.
        // Solo confirmar visualmente que se está ingresando un monto.
        if (efectivoReal === 0) {
            alert.style.display = 'none';
            return;
        }

        alert.style.display = 'block';
        alert.className = 'diferencia-alert info';
        const totalFormateado = formatter ? formatter.format(efectivoReal) : '$' + efectivoReal.toFixed(2);
        alert.innerHTML = `🧾 Total contado: <strong>${totalFormateado}</strong> — El resultado del arqueo se mostrará al cerrar`;
    }

    async procesarCierre() {
        // ✅ PROTECCIÓN ANTI-DOBLE-ENVÍO
        if (this.procesandoCierre) {
            console.log('⚠️ Ya hay un cierre en proceso, ignorando...');
            return;
        }

        this.procesandoCierre = true;
        this.showLoading();

        // Deshabilitar botón de envío inmediatamente
        const btnSubmit = document.querySelector('#form-cierre button[type="submit"]');
        if (btnSubmit) {
            btnSubmit.disabled = true;
            btnSubmit.textContent = 'Cerrando...';
        }

        try {
            const efectivoReal = parseFloat(document.getElementById('efectivo-real').value) || 0;
            const notas = document.getElementById('notas-cierre').value;
            const efectivoEsperado = parseFloat(document.getElementById('resumen-esperado').dataset.valor) || 0;
            const diferencia = efectivoReal - efectivoEsperado;

            // Capturar desglose por denominaciones
            const desgloseConteo = {};
            document.querySelectorAll('.denom-cantidad-cierre').forEach(input => {
                const cantidad = parseInt(input.value) || 0;
                if (cantidad > 0) {
                    desgloseConteo[input.dataset.valor] = cantidad;
                }
            });

            const userId = window.authSystem?.currentUser?.uid;

            if (!this.cajaActual || !this.cajaActual.id) {
                console.error('⚠️ No hay caja activa para cerrar');
                this.procesandoCierre = false;
                this.hideLoading();
                if (btnSubmit) {
                    btnSubmit.disabled = false;
                    btnSubmit.textContent = 'Cerrar Caja';
                }
                this.showNotification('❌ No hay caja abierta para cerrar', 'error');
                return;
            }

            // Activar flag de cierre local ANTES de actualizar Firebase
            this.cierreLocal = true;

            console.log('💾 Cerrando caja en Firestore:', this.cajaActual.id);
            await window.db.collection('cajas').doc(this.cajaActual.id).update({
                estado: 'cerrada',
                fechaCierre: firebase.firestore.Timestamp.fromDate(new Date()),
                efectivoEsperado,
                efectivoReal,
                diferencia,
                notasCierre: notas,
                desgloseConteo,
                totalVentas: this.ventas.reduce((sum, v) => sum + (v.total || 0), 0),
                cantidadVentas: this.ventas.length,
                desglosePagos: {
                    efectivo: this.ventas.filter(v => (v.metodoPago || v.tipoPago || 'efectivo').toString().toLowerCase().trim() === 'efectivo').reduce((s, v) => s + (v.total || 0), 0),
                    tarjeta: this.ventas.filter(v => (v.metodoPago || v.tipoPago || '').toString().toLowerCase().trim() === 'tarjeta').reduce((s, v) => s + (v.total || 0), 0),
                    transferencia: this.ventas.filter(v => (v.metodoPago || v.tipoPago || '').toString().toLowerCase().trim() === 'transferencia').reduce((s, v) => s + (v.total || 0), 0),
                    credito: this.ventas.filter(v => (v.metodoPago || v.tipoPago || '').toString().toLowerCase().trim() === 'credito').reduce((s, v) => s + (v.total || 0), 0)
                }
            });

            console.log('✅ Caja cerrada en Firestore');

            // Limpiar documento de lock para permitir nueva apertura
            if (userId) {
                try {
                    await window.db.collection('cajas_activas').doc(userId).update({
                        cajaAbertaId: null,
                        ultimaActualizacion: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    console.log('🔓 Documento de lock limpiado');
                } catch (lockError) {
                    console.warn('⚠️ Error limpiando lock (no crítico):', lockError.message);
                }
            }

            // Limpiar localStorage al cerrar caja
            if (userId) {
                this.removeLocalStorage(`caja_abierta_${userId}`);
                console.log('🗑️ Caja removida de localStorage');
            }

            // ✅ NO actualizar manualmente el historial
            // El listener en tiempo real se encargará de reflejar los cambios automáticamente
            console.log('ℹ️ El historial se actualizará automáticamente vía sincronización en tiempo real');

            this.cajaActual = null;
            this.ventas = [];
            this.movimientos = [];

            this.cerrarModalCierre();
            this.renderEstadoCaja();

            // Si estamos en la pestaña de historial, actualizar la vista
            if (this.currentTab === 'historial') {
                this.renderHistorial();
                console.log('🔄 Vista de historial actualizada');
            }

            // Mostrar resultado del arqueo (revela efectivo esperado vs contado)
            this.mostrarResultadoCierre(efectivoReal, efectivoEsperado, diferencia, desgloseConteo);

        } catch (error) {
            console.error('❌ Error cerrando caja:', error);
            this.showNotification(`❌ Error al cerrar la caja: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
            this.procesandoCierre = false;

            // Rehabilitar botón
            const btnSubmit = document.querySelector('#form-cierre button[type="submit"]');
            if (btnSubmit) {
                btnSubmit.disabled = false;
                btnSubmit.textContent = 'Cerrar Caja';
            }
        }
    }

    mostrarResultadoCierre(efectivoReal, efectivoEsperado, diferencia, desgloseConteo) {
        const formatter = window.currencyFormatter;
        const fmt = v => formatter ? formatter.format(v) : '$' + v.toFixed(2);
        const isAdmin = window.authSystem?.currentUser?.rol === 'administrador';

        // Determinar estado del arqueo
        const absDiff = Math.abs(diferencia);
        let estadoClase, estadoIcono, estadoTexto;
        if (absDiff < 1) {
            estadoClase = 'resultado-ok';
            estadoIcono = '✅';
            estadoTexto = 'Caja cuadrada';
        } else if (diferencia > 0) {
            estadoClase = 'resultado-sobrante';
            estadoIcono = '⚠️';
            estadoTexto = `Sobrante: ${fmt(diferencia)}`;
        } else {
            estadoClase = 'resultado-faltante';
            estadoIcono = '❌';
            estadoTexto = `Faltante: ${fmt(absDiff)}`;
        }

        // Construir desglose de denominaciones
        const NOMBRES_DENOM = {
            200000: '$200.000', 100000: '$100.000', 50000: '$50.000',
            20000: '$20.000', 10000: '$10.000', 5000: '$5.000',
            2000: '$2.000', 1000: '$1.000', 500: '$500',
            200: '$200', 100: '$100', 50: '$50'
        };
        const denomKeys = Object.keys(desgloseConteo || {}).sort((a, b) => b - a);
        const desglosHtml = denomKeys.length > 0 ? `
            <div class="resultado-desglose">
                <h4 class="resultado-desglose-titulo">Desglose del conteo</h4>
                <div class="resultado-desglose-grid">
                    ${denomKeys.map(k => {
                        const cant = desgloseConteo[k];
                        const subtotal = parseInt(k) * cant;
                        return `<div class="resultado-denom-fila">
                            <span class="resultado-denom-nombre">${NOMBRES_DENOM[k] || ('$' + parseInt(k).toLocaleString('es-CO'))}</span>
                            <span class="resultado-denom-cant">× ${cant}</span>
                            <span class="resultado-denom-sub">${fmt(subtotal)}</span>
                        </div>`;
                    }).join('')}
                </div>
            </div>` : '';

        // Construir contenido del modal
        const adminContent = isAdmin ? `
            <div class="resultado-comparativo">
                <div class="resultado-fila">
                    <span class="resultado-fila-label">Efectivo esperado</span>
                    <span class="resultado-fila-valor">${fmt(efectivoEsperado)}</span>
                </div>
                <div class="resultado-fila">
                    <span class="resultado-fila-label">Efectivo contado</span>
                    <span class="resultado-fila-valor">${fmt(efectivoReal)}</span>
                </div>
                <div class="resultado-fila resultado-fila-diferencia ${estadoClase}">
                    <span class="resultado-fila-label">Diferencia</span>
                    <span class="resultado-fila-valor">${diferencia >= 0 ? '+' : ''}${fmt(diferencia)}</span>
                </div>
            </div>
            ${desglosHtml}` : `
            <div class="resultado-vendedor-msg">
                <p>Tu conteo ha sido registrado correctamente.</p>
                <p>El administrador revisará el arqueo y te informará si hay alguna diferencia.</p>
            </div>`;

        const modal = document.getElementById('modal-resultado-cierre');
        if (!modal) {
            this.showNotification('✅ Caja cerrada exitosamente', 'success');
            return;
        }

        const content = document.getElementById('resultado-cierre-content');
        if (content) {
            content.innerHTML = `
                <div class="resultado-estado ${estadoClase}">
                    <span class="resultado-estado-icono">${estadoIcono}</span>
                    <div>
                        <div class="resultado-estado-titulo">Caja cerrada exitosamente</div>
                        <div class="resultado-estado-sub">${estadoTexto}</div>
                    </div>
                </div>
                ${adminContent}
                <div class="resultado-cierre-footer">
                    <button class="btn btn-primary" id="btn-cerrar-resultado">Aceptar</button>
                </div>
            `;
        }

        modal.classList.add('active');

        const btnCerrar = document.getElementById('btn-cerrar-resultado');
        if (btnCerrar) {
            btnCerrar.addEventListener('click', () => {
                modal.classList.remove('active');
            }, { once: true });
        }
    }

    abrirModalMovimiento(tipo) {
        if (!this.cajaActual) {
            alert('Debes tener una caja abierta para registrar movimientos');
            return;
        }

        const modal = document.getElementById('modal-movimiento');
        if (!modal) return;

        // Reset completo de estilos
        modal.style.cssText = '';
        const wrapper = modal.querySelector('.modal-caja-wrapper');
        const content = modal.querySelector('.modal-caja-content');
        if (wrapper) wrapper.style.cssText = '';
        if (content) content.style.cssText = '';

        document.getElementById('tipo-movimiento').value = tipo;
        document.getElementById('modal-movimiento-title').innerHTML = 
            tipo === 'ingreso' ? 'Nuevo Ingreso' : 'Nuevo Egreso';
        
        // Cargar categorías según el tipo
        const selectCategoria = document.getElementById('categoria-movimiento');
        if (tipo === 'egreso') {
            selectCategoria.innerHTML = `
                <option value="">Selecciona una categoria</option>
                <option value="servicios">Servicios</option>
                <option value="renta">Renta</option>
                <option value="factura">Factura</option>
                <option value="retiro-efectivo">Retiro de Efectivo</option>
                <option value="otros">Otros</option>
            `;
        } else {
            selectCategoria.innerHTML = `
                <option value="">Selecciona una categoria</option>
                <option value="venta-externa">Venta Externa</option>
                <option value="propinas">Propinas</option>
                <option value="deposito">Deposito</option>
                <option value="otros">Otros</option>
            `;
        }
        
        document.getElementById('form-movimiento').reset();
        document.getElementById('tipo-movimiento').value = tipo; // Restaurar después del reset
        
        // Ocultar campo de concepto inicialmente
        document.getElementById('concepto-group').style.display = 'none';
        document.getElementById('concepto-movimiento').removeAttribute('required');
        
        // Configurar listener para mostrar/ocultar concepto
        this.setupConceptoListener();
        
        modal.classList.add('active');
    }

    setupConceptoListener() {
        const selectCategoria = document.getElementById('categoria-movimiento');
        const conceptoGroup = document.getElementById('concepto-group');
        const conceptoInput = document.getElementById('concepto-movimiento');
        
        // Remover listener anterior si existe
        selectCategoria.removeEventListener('change', this.categoriaChangeHandler);
        
        // Crear y guardar nuevo handler
        this.categoriaChangeHandler = () => {
            if (selectCategoria.value === 'otros') {
                conceptoGroup.style.display = 'block';
                conceptoInput.setAttribute('required', 'required');
            } else {
                conceptoGroup.style.display = 'none';
                conceptoInput.removeAttribute('required');
                conceptoInput.value = '';
            }
        };
        
        selectCategoria.addEventListener('change', this.categoriaChangeHandler);
    }

    async procesarMovimiento() {
        // 🛡️ PROTECCIÓN ANTI-DUPLICACIÓN ROBUSTA
        const ahora = Date.now();
        
        // Si ya hay un movimiento en proceso O si el último procesamiento fue hace menos de 3 segundos
        if (this.procesandoMovimiento) {
            console.log('⚠️ BLOQUEADO: Ya hay un movimiento en proceso');
            return;
        }
        
        if (this.ultimoProcesamientoMovimiento && (ahora - this.ultimoProcesamientoMovimiento) < 3000) {
            console.log('⚠️ BLOQUEADO: Último procesamiento fue hace ' + (ahora - this.ultimoProcesamientoMovimiento) + 'ms (mínimo 3000ms)');
            return;
        }

        this.procesandoMovimiento = true;
        this.ultimoProcesamientoMovimiento = ahora;
        console.log('🔒 Procesamiento de movimiento iniciado - timestamp: ' + ahora);
        
        this.showLoading();

        // Deshabilitar botón de envío inmediatamente
        const btnSubmit = document.querySelector('#form-movimiento button[type="submit"]');
        if (btnSubmit) {
            btnSubmit.disabled = true;
            btnSubmit.textContent = 'Registrando...';
        }

        try {
            const tipo = document.getElementById('tipo-movimiento').value;
            const monto = parseFloat(document.getElementById('monto-movimiento').value) || 0;
            const categoria = document.getElementById('categoria-movimiento').value;
            const conceptoInput = document.getElementById('concepto-movimiento').value;
            const notas = document.getElementById('notas-movimiento').value;

            if (monto <= 0) {
                alert('El monto debe ser mayor a cero');
                this.hideLoading();
                this.procesandoMovimiento = false;
                if (btnSubmit) {
                    btnSubmit.disabled = false;
                    btnSubmit.textContent = 'Registrar';
                }
                return;
            }

            // Si categoría es "otros", usar el concepto ingresado, sino usar la categoría como concepto
            let concepto;
            if (categoria === 'otros') {
                concepto = conceptoInput;
                if (!concepto) {
                    alert('Debes ingresar un concepto cuando seleccionas "Otros"');
                    this.hideLoading();
                    this.procesandoMovimiento = false;
                    if (btnSubmit) {
                        btnSubmit.disabled = false;
                        btnSubmit.textContent = 'Registrar';
                    }
                    return;
                }
            } else {
                // Convertir categoría a texto legible
                const categoriasTexto = {
                    'servicios': 'Servicios',
                    'renta': 'Renta',
                    'factura': 'Factura',
                    'retiro-efectivo': 'Retiro de Efectivo',
                    'venta-externa': 'Venta Externa',
                    'propinas': 'Propinas',
                    'deposito': 'Depósito'
                };
                concepto = categoriasTexto[categoria] || categoria;
            }

            const userId = window.authSystem?.currentUser?.uid;
            const userName = window.authSystem?.currentUser?.nombre || 'Sistema';

            const movimiento = {
                tipo,
                concepto,
                monto,
                categoria,
                notas,
                fecha: firebase.firestore.Timestamp.fromDate(new Date()),
                vendedorId: this.cajaActual.vendedorId,
                vendedor: this.cajaActual.vendedor,
                id: window.db.collection('cajas').doc().id // Generar ID único para el movimiento
            };

            // Obtener movimientos actuales
            const movimientosActuales = this.cajaActual.movimientos || [];

            // Agregar nuevo movimiento al array
            movimientosActuales.push(movimiento);

            // Actualizar documento de caja con el nuevo array de movimientos
            await window.db.collection('cajas').doc(this.cajaActual.id).update({
                movimientos: movimientosActuales
            });

            console.log('✅ Movimiento guardado en array de caja - sincronización automática activa');

            // Cerrar modal ANTES de procesar el retiro (para evitar doble envío)
            this.cerrarModalMovimiento();

            // 🔥 Si es un retiro de efectivo, registrar ingreso en módulo de Pagos
            if (categoria === 'retiro-efectivo' && tipo === 'egreso') {
                console.log('💰 Retiro de efectivo detectado - registrando ingreso en Caja Mayor...');

                try {
                    // 🛡️ SOLUCIÓN DEFINITIVA: Usar el ID del movimiento como ID del documento en pagos
                    // Esto garantiza IDEMPOTENCIA - si ya existe, simplemente lo sobrescribe (no duplica)
                    const idDocumentoPagos = `retiro_${movimiento.id}`;
                    
                    const movimientoPagos = {
                        tipo: 'ingreso',
                        concepto: `${concepto} (desde Caja)`,
                        monto,
                        categoria: 'retiro-efectivo',
                        observaciones: `Retiro de caja de ${this.cajaActual.vendedor}. ${notas || ''}`,
                        fecha: firebase.firestore.Timestamp.fromDate(new Date()),
                        registradoPor: userId,
                        registradoPorNombre: userName,
                        origenCaja: this.cajaActual.id,
                        origenVendedor: this.cajaActual.vendedor,
                        idMovimientoCaja: movimiento.id
                    };

                    // 🔑 CLAVE: Usar setDoc con merge:false para garantizar idempotencia
                    // Si el documento ya existe, esta operación es un no-op (no crea duplicado)
                    await window.db.collection('pagos').doc(idDocumentoPagos).set(movimientoPagos);
                    console.log('✅ Ingreso registrado en Caja Mayor (Doc ID: ' + idDocumentoPagos + ')');
                    this.showNotification('✅ Retiro registrado en Caja y Caja Mayor', 'success');
                } catch (errorPagos) {
                    console.error('⚠️ Error registrando en Caja Mayor:', errorPagos);
                    this.showNotification('⚠️ Retiro registrado en Caja, pero falló sincronización con Caja Mayor', 'warning');
                }
            } else {
                this.showNotification(`✅ ${tipo === 'ingreso' ? 'Ingreso' : 'Egreso'} registrado exitosamente`, 'success');
            }

        } catch (error) {
            console.error('❌ Error registrando movimiento:', error);
            this.showNotification('❌ Error al registrar el movimiento', 'error');
        } finally {
            this.hideLoading();
            this.procesandoMovimiento = false;

            // Rehabilitar botón
            const btnSubmit = document.querySelector('#form-movimiento button[type="submit"]');
            if (btnSubmit) {
                btnSubmit.disabled = false;
                btnSubmit.textContent = 'Registrar';
            }
        }
    }

    renderMovimientos() {
        const tbody = document.getElementById('movimientos-table-body');
        const formatter = window.currencyFormatter;

        if (this.movimientos.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px; color: #6D6D80;">
                        No hay movimientos registrados
                    </td>
                </tr>
            `;
            return;
        }

        // Ordenar movimientos por fecha descendente
        const movimientosOrdenados = [...this.movimientos].sort((a, b) => {
            const fechaA = a.fecha?.toDate ? a.fecha.toDate() : new Date(a.fecha);
            const fechaB = b.fecha?.toDate ? b.fecha.toDate() : new Date(b.fecha);
            return fechaB - fechaA;
        });

        tbody.innerHTML = movimientosOrdenados.map(mov => {
            const fecha = mov.fecha?.toDate ? mov.fecha.toDate() : new Date(mov.fecha);
            return `
                <tr>
                    <td>
                        <div>
                            <svg class="row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="12 6 12 12 16 14"></polyline>
                            </svg>
                            <span>${fecha.toLocaleString('es-MX')}</span>
                        </div>
                    </td>
                    <td>
                        <span class="badge badge-${mov.tipo === 'ingreso' ? 'success' : 'danger'}">
                            ${mov.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}
                        </span>
                    </td>
                    <td>
                        <div>
                            <svg class="row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                            </svg>
                            <span>${mov.concepto}</span>
                        </div>
                    </td>
                    <td>
                        <div>
                            <svg class="row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="12" y1="1" x2="12" y2="23"></line>
                                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                            </svg>
                            <span>${formatter ? formatter.format(mov.monto) : '$' + mov.monto.toFixed(2)}</span>
                        </div>
                    </td>
                    <td>
                        <div>
                            <svg class="row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                            <span>${mov.vendedor}</span>
                        </div>
                    </td>
                    <td>
                        <button class="btn-icon" onclick="window.cajaModule.verDetalleMovimiento('${mov.id}')" title="Ver detalle">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    renderHistorial(cajasFiltradas = null) {
        const tbody = document.getElementById('historial-cajas-body');
        const formatter = window.currencyFormatter;

        const cajasAMostrar = cajasFiltradas || this.historialCajas;

        if (cajasAMostrar.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 40px; color: #6D6D80;">
                        No hay cajas que coincidan con los filtros
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = cajasAMostrar.map(caja => {
            const fechaApertura = caja.fechaApertura.toDate();
            const diferencia = caja.diferencia || 0;
            const diferenciaClass = diferencia === 0 ? 'success' : diferencia > 0 ? 'warning' : 'danger';

            return `
                <tr>
                    <td>
                        <div>
                            <svg class="row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                <line x1="16" y1="2" x2="16" y2="6"></line>
                                <line x1="8" y1="2" x2="8" y2="6"></line>
                                <line x1="3" y1="10" x2="21" y2="10"></line>
                            </svg>
                            <span>${fechaApertura.toLocaleDateString('es-MX')}</span>
                        </div>
                    </td>
                    <td>
                        <div>
                            <svg class="row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                            <span>${caja.vendedor}</span>
                        </div>
                    </td>
                    <td>
                        <div>
                            <svg class="row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="12" y1="1" x2="12" y2="23"></line>
                                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                            </svg>
                            <span>${formatter ? formatter.format(caja.montoInicial) : '$' + caja.montoInicial.toFixed(2)}</span>
                        </div>
                    </td>
                    <td>
                        <div>
                            <svg class="row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="9" cy="21" r="1"></circle>
                                <circle cx="20" cy="21" r="1"></circle>
                                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                            </svg>
                            <span>${formatter ? formatter.format(caja.totalVentas || 0) : '$' + (caja.totalVentas || 0).toFixed(2)}</span>
                        </div>
                    </td>
                    <td>
                        <div>
                            <svg class="row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="12" y1="1" x2="12" y2="23"></line>
                                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                            </svg>
                            <span>${caja.estado === 'cerrada' ? (formatter ? formatter.format(caja.efectivoReal) : '$' + caja.efectivoReal.toFixed(2)) : '-'}</span>
                        </div>
                    </td>
                    <td><span class="badge badge-${diferenciaClass}">${formatter ? formatter.format(diferencia) : '$' + diferencia.toFixed(2)}</span></td>
                    <td><span class="badge badge-${caja.estado === 'abierta' ? 'success' : 'secondary'}">${caja.estado}</span></td>
                    <td>
                        <button class="btn-icon" onclick="window.cajaModule.verDetalleCaja('${caja.id}')" title="Ver detalle">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    aplicarFiltrosHistorial() {
        const periodo = document.getElementById('filter-periodo-historial')?.value || 'todos';
        const vendedorId = document.getElementById('filter-vendedor-historial')?.value || '';
        const estado = document.getElementById('filter-estado-historial')?.value || '';

        let cajasFiltradas = [...this.historialCajas];

        // Filtro por periodo
        if (periodo !== 'todos') {
            const ahora = new Date();
            const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 0, 0, 0);
            const finHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 23, 59, 59);

            cajasFiltradas = cajasFiltradas.filter(caja => {
                const fechaCaja = caja.fechaApertura.toDate();

                switch (periodo) {
                    case 'hoy':
                        return fechaCaja >= inicioHoy && fechaCaja <= finHoy;

                    case 'semana':
                        const inicioSemana = new Date(ahora);
                        inicioSemana.setDate(ahora.getDate() - ahora.getDay());
                        inicioSemana.setHours(0, 0, 0, 0);
                        return fechaCaja >= inicioSemana;

                    case 'mes':
                        const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1, 0, 0, 0);
                        return fechaCaja >= inicioMes;

                    default:
                        return true;
                }
            });
        }

        // Filtro por vendedor
        if (vendedorId) {
            cajasFiltradas = cajasFiltradas.filter(caja => caja.vendedorId === vendedorId);
        }

        // Filtro por estado
        if (estado) {
            cajasFiltradas = cajasFiltradas.filter(caja => caja.estado === estado);
        }

        // Renderizar con las cajas filtradas
        this.renderHistorial(cajasFiltradas);
    }

    async verDetalleCaja(cajaId) {
        try {
            this.showLoading();

            // Validar ID
            if (!cajaId) {
                this.showNotification('❌ ID de caja inválido', 'error');
                this.hideLoading();
                return;
            }

            console.log('📋 Cargando detalle de caja:', cajaId);

            // Obtener datos de la caja
            const cajaDoc = await window.db.collection('cajas').doc(cajaId).get();
            if (!cajaDoc.exists) {
                this.showNotification('❌ Caja no encontrada', 'error');
                this.hideLoading();
                return;
            }

            const caja = { id: cajaDoc.id, ...cajaDoc.data() };
            const formatter = window.currencyFormatter;

            // Obtener ventas de esta caja - CONSULTA SIMPLIFICADA (sin índice compuesto)
            let ventas = [];
            try {
                const fechaCierre = caja.fechaCierre || firebase.firestore.Timestamp.now();

                // CONSULTA SIMPLE: Solo por vendedorId (filtrar fecha en memoria)
                const ventasSnapshot = await window.db.collection('sales')
                    .where('vendedorId', '==', caja.vendedorId)
                    .get();

                // FILTRAR EN MEMORIA: Por rango de fechas y estado
                ventas = ventasSnapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter(v => {
                        const esValida = v.estado === 'completada' || v.estado === 'pendiente';
                        const dentroRango = v.fecha >= caja.fechaApertura && v.fecha <= fechaCierre;
                        return esValida && dentroRango;
                    });

                console.log(`✅ ${ventas.length} ventas completadas cargadas para caja ${cajaId} (de ${ventasSnapshot.size} totales del vendedor)`);
            } catch (ventasError) {
                console.error('Error cargando ventas:', ventasError);
                ventas = [];
            }

            // Obtener movimientos del array dentro de la caja
            const movimientos = caja.movimientos || [];

            // ✅ CALCULAR TOTALES POR MÉTODO DE PAGO
            const getMetodo = (v) => (v.metodoPago || v.tipoPago || 'efectivo').toString().toLowerCase().trim();
            
            const totalVentas = ventas.reduce((sum, v) => sum + (v.total || 0), 0);
            const efectivoVentas = ventas.filter(v => getMetodo(v) === 'efectivo').reduce((sum, v) => sum + (v.total || 0), 0);
            const tarjetaVentas = ventas.filter(v => getMetodo(v) === 'tarjeta').reduce((sum, v) => sum + (v.total || 0), 0);
            const transferenciaVentas = ventas.filter(v => getMetodo(v) === 'transferencia').reduce((sum, v) => sum + (v.total || 0), 0);
            const creditoVentas = ventas.filter(v => getMetodo(v) === 'credito').reduce((sum, v) => sum + (v.total || 0), 0);

            console.log('💰 Totales por método:', {
                efectivo: efectivoVentas,
                tarjeta: tarjetaVentas,
                transferencia: transferenciaVentas,
                credito: creditoVentas,
                total: totalVentas
            });

            const ingresos = movimientos
                .filter(m => m.tipo === 'ingreso')
                .reduce((sum, m) => sum + (m.monto || 0), 0);

            const egresos = movimientos
                .filter(m => m.tipo === 'egreso')
                .reduce((sum, m) => sum + (m.monto || 0), 0);

            // Renderizar modal
            const fechaApertura = caja.fechaApertura.toDate();
            const fechaCierre = caja.fechaCierre ? caja.fechaCierre.toDate() : null;
            const diferencia = caja.diferencia || 0;
            const diferenciaClass = diferencia === 0 ? 'success' : diferencia > 0 ? 'warning' : 'danger';

            const contenido = `
                <div style="padding: 24px;">
                    <div class="summary-card" style="margin-bottom: 24px;">
                        <h4>Información General</h4>
                        <div class="summary-item">
                            <span>Vendedor:</span>
                            <span>${caja.vendedor}</span>
                        </div>
                        <div class="summary-item">
                            <span>Fecha Apertura:</span>
                            <span>${fechaApertura.toLocaleString('es-MX')}</span>
                        </div>
                        ${fechaCierre ? `
                        <div class="summary-item">
                            <span>Fecha Cierre:</span>
                            <span>${fechaCierre.toLocaleString('es-MX')}</span>
                        </div>
                        ` : ''}
                        <div class="summary-item">
                            <span>Estado:</span>
                            <span class="badge badge-${caja.estado === 'abierta' ? 'success' : 'secondary'}">${caja.estado}</span>
                        </div>
                    </div>

                    <div class="summary-card" style="margin-bottom: 24px;">
                        <h4>Resumen Financiero</h4>
                        <div class="summary-item">
                            <span>Monto Inicial:</span>
                            <span>${formatter ? formatter.format(caja.montoInicial) : '$' + caja.montoInicial.toFixed(2)}</span>
                        </div>
                        <div class="summary-item total">
                            <span>Ventas Totales:</span>
                            <span style="font-size: 1.1rem; font-weight: 700;">${formatter ? formatter.format(totalVentas) : '$' + totalVentas.toFixed(2)}</span>
                        </div>
                    </div>

                    <div class="summary-card" style="margin-bottom: 24px;">
                        <h4>Desglose de Ventas por Método de Pago</h4>
                        <div class="summary-item">
                            <span>💵 Efectivo:</span>
                            <span class="badge badge-success">${formatter ? formatter.format(efectivoVentas) : '$' + efectivoVentas.toFixed(2)}</span>
                        </div>
                        <div class="summary-item">
                            <span>💳 Tarjeta:</span>
                            <span class="badge badge-warning">${formatter ? formatter.format(tarjetaVentas) : '$' + tarjetaVentas.toFixed(2)}</span>
                        </div>
                        <div class="summary-item">
                            <span>🏦 Transferencia:</span>
                            <span class="badge badge-info">${formatter ? formatter.format(transferenciaVentas) : '$' + transferenciaVentas.toFixed(2)}</span>
                        </div>
                        <div class="summary-item">
                            <span>📝 Crédito:</span>
                            <span class="badge badge-secondary">${formatter ? formatter.format(creditoVentas) : '$' + creditoVentas.toFixed(2)}</span>
                        </div>
                    </div>

                    <div class="summary-card" style="margin-bottom: 24px;">
                        <h4>Otros Movimientos</h4>
                        <div class="summary-item">
                            <span>📈 Ingresos Extra:</span>
                            <span>${formatter ? formatter.format(ingresos) : '$' + ingresos.toFixed(2)}</span>
                        </div>
                        <div class="summary-item">
                            <span>📉 Egresos:</span>
                            <span>${formatter ? formatter.format(egresos) : '$' + egresos.toFixed(2)}</span>
                        </div>
                        ${caja.estado === 'cerrada' ? `
                        <div class="summary-item">
                            <span>Efectivo Esperado:</span>
                            <span>${formatter ? formatter.format(caja.efectivoEsperado) : '$' + caja.efectivoEsperado.toFixed(2)}</span>
                        </div>
                        <div class="summary-item">
                            <span>Efectivo Real:</span>
                            <span>${formatter ? formatter.format(caja.efectivoReal) : '$' + caja.efectivoReal.toFixed(2)}</span>
                        </div>
                        <div class="summary-item total">
                            <span>Diferencia:</span>
                            <span class="badge badge-${diferenciaClass}">${formatter ? formatter.format(diferencia) : '$' + diferencia.toFixed(2)}</span>
                        </div>
                        ` : ''}
                    </div>

                    ${caja.notasApertura || caja.notasCierre ? `
                    <div class="summary-card" style="margin-bottom: 24px;">
                        <h4>Notas</h4>
                        ${caja.notasApertura ? `
                        <div class="summary-item" style="flex-direction: column; align-items: flex-start;">
                            <span style="font-weight: 600;">Apertura:</span>
                            <span style="opacity: 0.8;">${caja.notasApertura}</span>
                        </div>
                        ` : ''}
                        ${caja.notasCierre ? `
                        <div class="summary-item" style="flex-direction: column; align-items: flex-start;">
                            <span style="font-weight: 600;">Cierre:</span>
                            <span style="opacity: 0.8;">${caja.notasCierre}</span>
                        </div>
                        ` : ''}
                    </div>
                    ` : ''}

                    <div class="summary-card">
                        <h4>Desglose de Ventas (${ventas.length})</h4>
                        ${ventas.length > 0 ? `
                        <div style="max-height: 250px; overflow-y: auto;">
                            <table class="data-table" style="font-size: 0.85rem; width: 100%;">
                                <thead style="position: sticky; top: 0; background: white; z-index: 1;">
                                    <tr>
                                        <th style="padding: 8px;">Folio</th>
                                        <th style="padding: 8px;">Método</th>
                                        <th style="padding: 8px; text-align: right;">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${ventas.map(v => `
                                        <tr>
                                            <td style="padding: 8px;">${v.folio}</td>
                                            <td style="padding: 8px;">
                                                <span class="badge badge-${(v.metodoPago || v.tipoPago) === 'efectivo' ? 'success' : 'warning'}" style="font-size: 0.75rem;">
                                                    ${v.metodoPago || v.tipoPago || 'efectivo'}
                                                </span>
                                            </td>
                                            <td style="padding: 8px; text-align: right; font-weight: 600;">
                                                ${formatter ? formatter.format(v.total) : '$' + v.total.toFixed(2)}
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                        ` : '<p style="text-align: center; color: #6D6D80; margin: 16px 0;">No hay ventas</p>'}
                    </div>

                    ${movimientos.length > 0 ? `
                    <div class="summary-card" style="margin-top: 24px;">
                        <h4>Movimientos (${movimientos.length})</h4>
                        <div style="max-height: 200px; overflow-y: auto;">
                            ${movimientos.map(m => `
                                <div class="summary-item" style="font-size: 0.9rem;">
                                    <span>
                                        <span class="badge badge-${m.tipo === 'ingreso' ? 'success' : 'danger'}" style="font-size: 0.75rem;">
                                            ${m.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}
                                        </span>
                                        ${m.concepto}
                                    </span>
                                    <span>${formatter ? formatter.format(m.monto) : '$' + m.monto.toFixed(2)}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}
                </div>
            `;

            document.getElementById('detalle-caja-content').innerHTML = contenido;
            document.getElementById('modal-detalle-caja').classList.add('active');

        } catch (error) {
            console.error('❌ Error cargando detalle de caja:', error);
            console.error('Detalles completos del error:', {
                code: error.code,
                message: error.message,
                stack: error.stack,
                cajaId
            });

            let mensaje = '❌ Error al cargar el detalle';
            if (error.code === 'permission-denied') {
                mensaje = '❌ No tienes permisos para ver esta caja';
            } else if (error.code === 'unavailable') {
                mensaje = '❌ Error de conexión, intenta nuevamente';
            } else if (error.code === 'failed-precondition') {
                mensaje = '❌ Error de consulta en la base de datos';
            } else {
                mensaje = `❌ Error: ${error.message || 'Desconocido'}`;
            }

            this.showNotification(mensaje, 'error');
        } finally {
            this.hideLoading();
        }
    }

    verDetalleMovimiento(movimientoId) {
        try {
            const movimiento = this.movimientos.find(m => m.id === movimientoId);

            if (!movimiento) {
                this.showNotification('❌ Movimiento no encontrado', 'error');
                return;
            }

            const fecha = movimiento.fecha?.toDate ? movimiento.fecha.toDate() : new Date(movimiento.fecha);
            const formatter = window.currencyFormatter;

            const contenido = `
                <div style="padding: 24px;">
                    <div class="summary-card">
                        <h4>Detalle del Movimiento</h4>
                        <div class="summary-item">
                            <span>Tipo:</span>
                            <span class="badge badge-${movimiento.tipo === 'ingreso' ? 'success' : 'danger'}">
                                ${movimiento.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}
                            </span>
                        </div>
                        <div class="summary-item">
                            <span>Concepto:</span>
                            <span>${movimiento.concepto}</span>
                        </div>
                        <div class="summary-item">
                            <span>Monto:</span>
                            <span style="font-weight: 700; font-size: 1.2rem;">
                                ${formatter ? formatter.format(movimiento.monto) : '$' + movimiento.monto.toFixed(2)}
                            </span>
                        </div>
                        <div class="summary-item">
                            <span>Categoría:</span>
                            <span>${movimiento.categoria || 'Sin categoría'}</span>
                        </div>
                        <div class="summary-item">
                            <span>Fecha:</span>
                            <span>${fecha.toLocaleString('es-MX')}</span>
                        </div>
                        <div class="summary-item">
                            <span>Responsable:</span>
                            <span>${movimiento.vendedor}</span>
                        </div>
                        ${movimiento.notas ? `
                        <div class="summary-item" style="flex-direction: column; align-items: flex-start; margin-top: 12px;">
                            <span style="font-weight: 600;">Notas:</span>
                            <span style="opacity: 0.8; margin-top: 4px;">${movimiento.notas}</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
            `;

            document.getElementById('detalle-caja-content').innerHTML = contenido;
            document.getElementById('modal-detalle-caja').classList.add('active');

        } catch (error) {
            console.error('Error mostrando detalle de movimiento:', error);
            this.showNotification('❌ Error al mostrar el detalle', 'error');
        }
    }

    showLoading() {
        document.getElementById('loading-overlay-caja').classList.add('active');
    }

    hideLoading() {
        document.getElementById('loading-overlay-caja').classList.remove('active');
    }

    setupCalculadora(tipo) {
        const selector = tipo === 'apertura' ? '.denom-cantidad' : '.denom-cantidad-cierre';
        const totalSelector = tipo === 'apertura' ? '.denom-total' : '.denom-total-cierre';
        const inputs = document.querySelectorAll(selector);
        const formatter = window.currencyFormatter;

        inputs.forEach((input, index) => {
            const totalSpan = document.querySelectorAll(totalSelector)[index];

            input.addEventListener('input', () => {
                const cantidad = parseInt(input.value) || 0;
                const valor = parseInt(input.dataset.valor);
                const total = cantidad * valor;

                // Actualizar total de la denominación
                totalSpan.textContent = formatter ? formatter.format(total) : '$' + total.toFixed(2);

                // Calcular total general
                this.calcularTotalDenominaciones(tipo);
            });
        });

        // Botón de resetear
        const btnReset = document.getElementById(`btn-reset-${tipo}`);
        if (btnReset) {
            btnReset.addEventListener('click', () => this.resetearCalculadora(tipo));
        }
    }

    calcularTotalDenominaciones(tipo) {
        const selector = tipo === 'apertura' ? '.denom-cantidad' : '.denom-cantidad-cierre';
        const inputs = document.querySelectorAll(selector);
        const formatter = window.currencyFormatter;
        let total = 0;

        inputs.forEach(input => {
            const cantidad = parseInt(input.value) || 0;
            const valor = parseInt(input.dataset.valor);
            total += cantidad * valor;
        });

        // Actualizar total calculado
        const totalElement = document.getElementById(`total-${tipo}`);
        if (totalElement) {
            totalElement.textContent = formatter ? formatter.format(total) : '$' + total.toFixed(2);
        }

        // Actualizar input principal
        const inputPrincipal = tipo === 'apertura' 
            ? document.getElementById('monto-inicial')
            : document.getElementById('efectivo-real');

        if (inputPrincipal) {
            inputPrincipal.value = total.toFixed(2);

            // Si es cierre, recalcular diferencia
            if (tipo === 'cierre') {
                this.calcularDiferencia();
            }
        }
    }

    resetearCalculadora(tipo) {
        const selector = tipo === 'apertura' ? '.denom-cantidad' : '.denom-cantidad-cierre';
        const totalSelector = tipo === 'apertura' ? '.denom-total' : '.denom-total-cierre';
        const inputs = document.querySelectorAll(selector);
        const totales = document.querySelectorAll(totalSelector);

        // Limpiar inputs
        inputs.forEach(input => {
            input.value = '';
        });

        // Limpiar totales
        totales.forEach(total => {
            total.textContent = '$0';
        });

        // Limpiar total general
        const totalElement = document.getElementById(`total-${tipo}`);
        if (totalElement) {
            totalElement.textContent = '$0';
        }

        // Limpiar input principal
        const inputPrincipal = tipo === 'apertura' 
            ? document.getElementById('monto-inicial')
            : document.getElementById('efectivo-real');

        if (inputPrincipal) {
            inputPrincipal.value = '';
        }

        // Si es cierre, ocultar alerta de diferencia
        if (tipo === 'cierre') {
            document.getElementById('diferencia-alert').style.display = 'none';
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span>${message}</span>
                <button class="notification-close">✕</button>
            </div>
        `;
        document.body.appendChild(notification);
        notification.querySelector('.notification-close').addEventListener('click', () => notification.remove());
        setTimeout(() => notification.remove(), 5000);
    }

    // Métodos para localStorage con soporte para Safari (silencioso)
    getLocalStorage(key) {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            // Safari en modo privado bloquea localStorage
            // Continuar sin localStorage (Firestore es la fuente de verdad)
            return null;
        }
    }

    setLocalStorage(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            // Safari en modo privado: ignorar silenciosamente
            // Firestore maneja la persistencia principal
        }
    }

    removeLocalStorage(key) {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            // Ignorar errores de localStorage
        }
    }

    destroy() {
        console.log('🧹 Iniciando limpieza del módulo de caja...');
        
        // Detener verificación de horario
        if (this.intervalVerificacionHorario) {
            clearInterval(this.intervalVerificacionHorario);
            console.log('⏰ Verificación de horario detenida');
        }
        
        // 🔧 SOLUCIÓN ANTI-DUPLICACIÓN: Eliminar todos los event listeners del DOM
        
        // Eliminar listeners de tabs
        if (this.tabButtons && this.handleTabClick) {
            this.tabButtons.forEach(btn => {
                btn.removeEventListener('click', this.handleTabClick);
            });
            console.log('✅ Listeners de tabs eliminados');
        }
        
        // Eliminar listener de delegación de eventos del contenedor
        if (this.estadoCajaContainer && this.handleContainerClick) {
            this.estadoCajaContainer.removeEventListener('click', this.handleContainerClick);
            console.log('✅ Listener de delegación de eventos eliminado');
        }
        
        // Eliminar listeners de formularios
        if (this.formApertura && this.handleFormAperturaSubmit) {
            this.formApertura.removeEventListener('submit', this.handleFormAperturaSubmit);
            console.log('✅ Listener del formulario de apertura eliminado');
        }
        if (this.formCierre && this.handleFormCierreSubmit) {
            this.formCierre.removeEventListener('submit', this.handleFormCierreSubmit);
        }
        if (this.formMovimiento && this.handleFormMovimientoSubmit) {
            this.formMovimiento.removeEventListener('submit', this.handleFormMovimientoSubmit);
        }
        
        // Eliminar listener de efectivo real
        if (this.efectivoReal && this.handleEfectivoRealInput) {
            this.efectivoReal.removeEventListener('input', this.handleEfectivoRealInput);
        }
        
        // Eliminar listeners de botones de movimientos
        if (this.btnNuevoIngreso && this.handleNuevoIngreso) {
            this.btnNuevoIngreso.removeEventListener('click', this.handleNuevoIngreso);
        }
        if (this.btnNuevoEgreso && this.handleNuevoEgreso) {
            this.btnNuevoEgreso.removeEventListener('click', this.handleNuevoEgreso);
        }
        
        // Eliminar listeners de filtros
        if (this.filterElements && this.handleFilterChange) {
            this.filterElements.forEach(filter => {
                filter.removeEventListener('change', this.handleFilterChange);
            });
        }
        
        // Limpiar listeners de modales (si se guardaron)
        if (this.modalCloseListeners) {
            this.modalCloseListeners.forEach(({ element, handler }) => {
                element.removeEventListener('click', handler);
            });
        }
        
        console.log('✅ Todos los event listeners del DOM eliminados');
        
        // Detener listeners de sincronización en tiempo real de Firebase
        if (this.unsubscribeCaja) {
            this.unsubscribeCaja();
            console.log('🔄 Listener de caja detenido');
        }
        if (this.unsubscribeMovimientos) {
            this.unsubscribeMovimientos();
            console.log('🔄 Listener de movimientos detenido');
        }
        if (this.unsubscribeVentas) {
            this.unsubscribeVentas();
            console.log('🔄 Listener de ventas detenido');
        }
        if (this.unsubscribeVentaCompletada) {
            this.unsubscribeVentaCompletada();
            console.log('📡 Listener de eventos globales detenido');
        }

        // Limpiar eventos del módulo en EventBus
        if (window.eventBus && this.moduleId) {
            window.eventBus.cleanupModule(this.moduleId);
        }

        console.log('💰 Módulo de caja descargado completamente');
    }
}

// Inicializar módulo con patrón singleton para evitar instancias duplicadas
window.cajaModule = null;

function loadCajaModule() {
    // 🔧 SOLUCIÓN ANTI-DUPLICACIÓN: Destruir instancia anterior si existe
    if (window.cajaModule && typeof window.cajaModule.destroy === 'function') {
        console.log('⚠️ Detectada instancia anterior del módulo, destruyendo...');
        window.cajaModule.destroy();
        window.cajaModule = null;
    }
    
    // Crear nueva instancia solo si no existe
    if (!window.cajaModule) {
        console.log('✨ Creando nueva instancia del módulo de caja');
        window.cajaModule = new CajaModule();
    } else {
        console.log('ℹ️ Reutilizando instancia existente del módulo de caja');
    }
    
    return window.cajaModule;
}

// ============= FUNCIÓN GLOBAL PARA VERIFICAR CIERRE AUTOMÁTICO =============
// Esta función se ejecuta GLOBALMENTE antes de cargar cualquier módulo
async function verificarYCerrarCajasVencidas() {
    try {
        const userId = window.authSystem?.currentUser?.uid;
        if (!userId) {
            console.log('ℹ️ No hay usuario autenticado para verificar cajas');
            return;
        }

        console.log('🔍 Verificando cajas vencidas globalmente...');

        // Obtener horario comercial de configuración
        const configSnap = await window.db.collection('configuracion')
            .where('type', '==', 'horario_comercial')
            .limit(1)
            .get();

        if (configSnap.empty) {
            console.log('⚠️ No hay horario comercial configurado');
            return;
        }

        const horarioConfig = configSnap.docs[0].data();
        const horarioComercial = horarioConfig.horarioComercial || {
            horaInicio: '09:00',
            horaFin: '07:00',
            esDiaSiguiente: true
        };

        // Buscar cajas abiertas del usuario
        let cajaQuery = window.db.collection('cajas')
            .where('vendedorId', '==', userId)
            .where('estado', '==', 'abierta');

        let querySnapshot = await cajaQuery.get().catch(() => {
            // Fallback sin índice
            return window.db.collection('cajas')
                .where('vendedorId', '==', userId)
                .get();
        });

        const cajasAbiertas = querySnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(caja => caja.estado === 'abierta');

        if (cajasAbiertas.length === 0) {
            console.log('✅ No hay cajas abiertas que verificar');
            return;
        }

        console.log(`🔎 Encontradas ${cajasAbiertas.length} cajas abiertas, verificando...`);

        // Verificar cada caja
        for (const caja of cajasAbiertas) {
            const fechaApertura = caja.fechaApertura.toDate();
            const ahora = new Date();
            const [horaFinH, horaFinM] = horarioComercial.horaFin.split(':').map(Number);

            // Calcular hora de cierre esperada
            let horaCierreEsperada = new Date(fechaApertura);
            horaCierreEsperada.setHours(horaFinH, horaFinM, 0, 0);

            if (horarioComercial.esDiaSiguiente) {
                horaCierreEsperada.setDate(horaCierreEsperada.getDate() + 1);
            }

            // Margen de 2 horas
            const margenTolerancia = 2 * 60 * 60 * 1000;
            const horaCierreConMargen = new Date(horaCierreEsperada.getTime() + margenTolerancia);

            if (ahora > horaCierreConMargen) {
                console.log(`🕐 Caja vencida detectada: ${caja.id}, procediendo a cierre automático...`);
                
                // Cargar ventas para cálculos
                const ventasSnapshot = await window.db.collection('sales')
                    .where('vendedorId', '==', caja.vendedorId)
                    .get();

                const timestampApertura = firebase.firestore.Timestamp.fromDate(fechaApertura);
                const timestampAhora = firebase.firestore.Timestamp.fromDate(ahora);

                const ventas = ventasSnapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter(venta => {
                        const esCompletada = venta.estado === 'completada';
                        const dentroRango = venta.fecha >= timestampApertura && venta.fecha <= timestampAhora;
                        return esCompletada && dentroRango;
                    });

                // Calcular efectivo
                const efectivoVentas = ventas
                    .filter(v => (v.metodoPago || v.tipoPago) === 'efectivo')
                    .reduce((sum, v) => sum + (v.total || 0), 0);

                const movimientos = caja.movimientos || [];
                const ingresos = movimientos
                    .filter(m => m.tipo === 'ingreso')
                    .reduce((sum, m) => sum + (m.monto || 0), 0);

                const egresos = movimientos
                    .filter(m => m.tipo === 'egreso')
                    .reduce((sum, m) => sum + (m.monto || 0), 0);

                const efectivoEsperado = (caja.montoInicial || 0) + efectivoVentas + ingresos - egresos;

                // Cerrar caja automáticamente
                await window.db.collection('cajas').doc(caja.id).update({
                    estado: 'cerrada',
                    fechaCierre: firebase.firestore.Timestamp.now(),
                    efectivoReal: efectivoEsperado,
                    totalVentas: ventas.length,
                    notasCierre: '⏰ Cierre automático por fin de turno (iniciado globalmente).',
                    cierreAutomatico: true
                });

                console.log(`✅ Caja ${caja.id} cerrada automáticamente globalmente`);
            }
        }

    } catch (error) {
        console.error('❌ Error en verificación global de cajas:', error);
    }
}

// Hacer función disponible globalmente
window.verificarYCerrarCajasVencidas = verificarYCerrarCajasVencidas;

if (document.querySelector('.caja-module')) {
    loadCajaModule();
}