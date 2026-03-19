// Módulo de Ventas - Sistema Completo
class VentasModule {
    constructor() {
        this.productos = [];
        this.clientes = [];
        this.carrito = []; // Carrito activo actual
        this.carritos = []; // Array de todos los carritos
        this.carritoActivo = 0; // Índice del carrito activo
        this.ventas = [];
        this.currentTab = 'pos';
        this.searchTimeout = null;
        this.contadorCarritos = 1;
        this.modoEdicionPreciosActivo = false; // Nuevo: control de edición temporal
        this.sessionListener = null; // Listener de sesión activa
        this.carritoAutorizadoId = null; // ID del carrito específico autorizado
        this.expiracionTimer = null; // Timer de expiración de 5 minutos
        this.tabId = this.generarTabId(); // ID único para esta pestaña
        this.periodoActual = 'semana'; // Período para filtro de fechas
        this.fechaInicio = null; // Fecha de inicio para filtro
        this.fechaFin = null; // Fecha de fin para filtro
        this.init();
    }

    async init() {
        console.log('🛒 Inicializando módulo de ventas...');

        // ✅ CREAR MODALES PRIMERO
        await this.crearModales();

        // ✅ CONFIGURAR EVENT LISTENERS DE MODALES
        this.setupModalEventListeners();
        
        // Reiniciar atajos cada vez que se carga el módulo para asegurar que el listener esté activo
        this.setupKeyboardShortcuts();

        // ✅ RENDERIZAR UI INMEDIATAMENTE (sin esperar datos)
        this.cargarCarritosGuardados(); // Cargar carritos desde localStorage
        this.renderCarritosTabs(); // Renderizar pestañas de carritos PRIMERO
        this.renderCarrito(); // Mostrar carrito vacío o guardado
        this.setupEventListeners();
        this.setupTabsSystem(); // Sistema de pestañas con indicador animado

        // 🔄 CARGAR DATOS EN SEGUNDO PLANO (sin bloquear UI)
        Promise.all([
            this.cargarProductos(),
            this.cargarClientes(),
            this.cargarVentas(),
            this.verificarCajaAbierta()
        ]).then(() => {
            console.log('✅ Datos del módulo cargados');
            this.actualizarEstadisticas();
            this.actualizarEstadoVentas();
            this.actualizarVisibilidadBotones();
        });

        this.setupConfiguracionListener();
        this.setupCajaListener(); // Escuchar cambios en caja
        this.setupSesionEdicionListener(); // Escuchar autorizaciones de edición
        this.setupBeforeUnloadListener(); // Detectar cierre de pestaña
        this.setupLogoutListener(); // Detectar cierre de sesión
        this.limpiarSesionesExpiradas(); // Limpiar sesiones antiguas al iniciar
        
        // Actualizar visibilidad de botones cuando la autenticación cambia
        if (window.eventBus) {
            window.eventBus.on('authStateChanged', (detail) => {
                this.usuarioActual = detail.user;
                this.actualizarVisibilidadBotones();
            });
        }

        // Configurar filtros de fecha
        this.setupDateFilters();

        // Actualizar visibilidad del botón con pequeño delay para asegurar DOM
        setTimeout(() => this.actualizarVisibilidadBotones(), 100);

        console.log('✅ Módulo de ventas inicializado (UI lista)');
    }

    setupDateFilters() {
        const hoy = new Date();
        const inicioSemana = new Date(hoy);
        inicioSemana.setDate(hoy.getDate() - hoy.getDay());
        
        this.fechaInicio = inicioSemana;
        this.fechaFin = hoy;

        const fechaInicioInput = document.getElementById('fecha-inicio');
        const fechaFinInput = document.getElementById('fecha-fin');

        if (fechaInicioInput) {
            fechaInicioInput.valueAsDate = this.fechaInicio;
        }
        if (fechaFinInput) {
            fechaFinInput.valueAsDate = this.fechaFin;
        }
    }

    handlePeriodoChange() {
        const dateRangeCustom = document.getElementById('date-range-custom');

        if (this.periodoActual === 'personalizado') {
            if (dateRangeCustom) dateRangeCustom.style.display = 'flex';
        } else {
            if (dateRangeCustom) dateRangeCustom.style.display = 'none';
            if (this.periodoActual !== 'todo') {
                this.calcularFechasPorPeriodo();
            }
            this.renderHistorial();
        }
    }

    calcularFechasPorPeriodo() {
        const hoy = new Date();
        hoy.setHours(23, 59, 59, 999);
        
        switch (this.periodoActual) {
            case 'hoy':
                this.fechaInicio = new Date(hoy);
                this.fechaInicio.setHours(0, 0, 0, 0);
                this.fechaFin = hoy;
                break;
            case 'ayer':
                this.fechaInicio = new Date(hoy);
                this.fechaInicio.setDate(hoy.getDate() - 1);
                this.fechaInicio.setHours(0, 0, 0, 0);
                this.fechaFin = new Date(this.fechaInicio);
                this.fechaFin.setHours(23, 59, 59, 999);
                break;
            case 'semana':
                this.fechaInicio = new Date(hoy);
                this.fechaInicio.setDate(hoy.getDate() - hoy.getDay());
                this.fechaInicio.setHours(0, 0, 0, 0);
                this.fechaFin = hoy;
                break;
            case 'mes':
                this.fechaInicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
                this.fechaFin = hoy;
                break;
            case 'trimestre':
                this.fechaInicio = new Date(hoy);
                this.fechaInicio.setMonth(hoy.getMonth() - 3);
                this.fechaInicio.setHours(0, 0, 0, 0);
                this.fechaFin = hoy;
                break;
            case 'año':
                this.fechaInicio = new Date(hoy.getFullYear(), 0, 1);
                this.fechaFin = hoy;
                break;
        }
    }

    aplicarFechasPersonalizadas() {
        const fechaInicioInput = document.getElementById('fecha-inicio');
        const fechaFinInput = document.getElementById('fecha-fin');

        if (fechaInicioInput && fechaFinInput) {
            this.fechaInicio = new Date(fechaInicioInput.value);
            this.fechaFin = new Date(fechaFinInput.value);
            this.fechaFin.setHours(23, 59, 59, 999);
            this.renderHistorial();
        }
    }

    actualizarVisibilidadBotones() {
        const btnDescargar = document.getElementById('btn-descargar-excel');
        if (!btnDescargar) return;
        
        // Obtener usuario actual de window.authSystem o de this.usuarioActual
        const usuarioActual = window.authSystem?.currentUser || this.usuarioActual;
        
        // Solo mostrar el botón si el usuario es administrador
        if (usuarioActual?.rol === 'administrador') {
            btnDescargar.style.display = 'flex';
            console.log('✅ Botón de descarga Excel visible para administrador');
        } else {
            btnDescargar.style.display = 'none';
            console.log('🔒 Botón de descarga Excel oculto (no es administrador)');
        }
    }

    setupConfiguracionListener() {
        // Escuchar cambios en la configuración de horario usando EventBus global
        if (window.eventBus) {
            window.eventBus.on('horarioComercialActualizado', async (data) => {
                console.log('🔄 Horario comercial actualizado:', data);
                console.log('📊 Recargando historial de ventas y estadísticas...');

                // Recargar ventas y actualizar vista
                await this.cargarVentas();

                if (this.currentTab === 'historial') {
                    await this.renderHistorial();
                }

                await this.actualizarEstadisticas();

                console.log('✅ Historial actualizado con nuevo horario comercial');
            });
        }
    }

    async verificarCajaAbierta() {
        const userId = window.authSystem?.currentUser?.uid;
        if (!userId) {
            this.cajaAbierta = false;
            this.actualizarEstadoVentas();
            return;
        }

        try {
            const querySnapshot = await window.db.collection('cajas')
                .where('vendedorId', '==', userId)
                .where('estado', '==', 'abierta')
                .limit(1)
                .get();

            this.cajaAbierta = !querySnapshot.empty;

            if (this.cajaAbierta) {
                const doc = querySnapshot.docs[0];
                this.cajaActual = { id: doc.id, ...doc.data() };
                console.log('✅ Caja abierta detectada, ventas habilitadas');
            } else {
                this.cajaActual = null;
                console.log('⚠️ No hay caja abierta, ventas bloqueadas');
            }

            this.actualizarEstadoVentas();
        } catch (error) {
            console.error('Error verificando caja:', error);
            this.cajaAbierta = false;
            this.actualizarEstadoVentas();
        }
    }

    setupCajaListener() {
        const userId = window.authSystem?.currentUser?.uid;
        if (!userId) return;

        // Escuchar cambios en tiempo real del estado de caja
        this.unsubscribeCaja = window.db.collection('cajas')
            .where('vendedorId', '==', userId)
            .where('estado', '==', 'abierta')
            .onSnapshot((snapshot) => {
                const cajaAnterior = this.cajaAbierta;
                this.cajaAbierta = !snapshot.empty;

                if (snapshot.empty) {
                    this.cajaActual = null;
                } else {
                    const doc = snapshot.docs[0];
                    this.cajaActual = { id: doc.id, ...doc.data() };
                }

                // Solo mostrar notificación si cambió el estado
                if (cajaAnterior !== this.cajaAbierta) {
                    if (this.cajaAbierta) {
                        this.showNotification('✅ Caja abierta - Ventas habilitadas', 'success');
                    } else {
                        this.showNotification('⚠️ Caja cerrada - Ventas bloqueadas', 'warning');
                    }
                }

                this.actualizarEstadoVentas();
            }, (error) => {
                console.error('Error en listener de caja:', error);
            });

        console.log('👂 Listener de estado de caja activado');
    }

    setupSesionEdicionListener() {
        const userId = window.authSystem?.currentUser?.uid;
        if (!userId) return;

        // Escuchar sesiones activas de edición de precios para este vendedor
        this.sessionListener = window.db.collection('sesiones_precio_temporal')
            .where('vendedorId', '==', userId)
            .where('activo', '==', true)
            .onSnapshot(async (snapshot) => {
                if (!snapshot.empty) {
                    const sesion = snapshot.docs[0].data();
                    const sesionId = snapshot.docs[0].id;
                    const carritoIdAutorizado = sesion.carritoId;

                    // 🔴 VERIFICAR SI LA SESIÓN HA EXPIRADO
                    if (this.verificarSesionExpirada(sesion)) {
                        console.log('⏰ Sesión expirada detectada en listener, desactivando...');
                        
                        // Desactivar sesión expirada en Firebase
                        try {
                            await window.db.collection('sesiones_precio_temporal').doc(sesionId).update({
                                activo: false,
                                fechaDesactivacion: firebase.firestore.Timestamp.now(),
                                motivoDesactivacion: 'Expiración automática (verificación en listener)'
                            });
                        } catch (err) {
                            console.error('Error desactivando sesión expirada:', err);
                        }
                        
                        // Limpiar estado local
                        this.modoEdicionPreciosActivo = false;
                        this.sesionActualId = null;
                        this.carritoAutorizadoId = null;
                        this.detenerTimerExpiracion();
                        this.actualizarBotonEdicionPrecios();
                        this.renderCarrito();
                        return;
                    }

                    // Guardar el ID del carrito autorizado y la sesión
                    this.sesionActualId = sesionId;
                    this.carritoAutorizadoId = String(carritoIdAutorizado); // Asegurar tipo string

                    // Verificar si el carrito ACTIVO es el autorizado (comparar como strings)
                    const carritoActualId = String(this.carritos[this.carritoActivo]?.id || '');
                    const esCarritoAutorizado = carritoActualId === this.carritoAutorizadoId;

                    if (esCarritoAutorizado && !this.modoEdicionPreciosActivo) {
                        this.modoEdicionPreciosActivo = true;
                        this.solicitudPendiente = false;
                        this.showNotification('💰 Autorización concedida - Puedes editar precios en este carrito', 'success');
                        
                        // Iniciar timer de expiración de 5 minutos
                        this.iniciarTimerExpiracion();
                        
                        // Actualizar tabId en Firebase para rastrear esta pestaña
                        try {
                            await window.db.collection('sesiones_precio_temporal').doc(sesionId).update({
                                tabId: this.tabId
                            });
                        } catch (err) {
                            console.error('Error actualizando tabId:', err);
                        }
                        
                        this.actualizarBotonEdicionPrecios();
                        this.renderCarrito();
                    } else if (!esCarritoAutorizado && this.modoEdicionPreciosActivo) {
                        // El carrito activo NO es el autorizado, desactivar modo edición
                        this.modoEdicionPreciosActivo = false;
                        this.actualizarBotonEdicionPrecios();
                        this.renderCarrito();
                    }

                    console.log(`🔐 Sesión activa para carrito: ${sesion.carritoNombre || carritoIdAutorizado}`);
                } else {
                    // No hay sesiones activas
                    if (this.modoEdicionPreciosActivo || this.carritoAutorizadoId) {
                        this.modoEdicionPreciosActivo = false;
                        this.sesionActualId = null;
                        this.carritoAutorizadoId = null;
                        this.detenerTimerExpiracion();
                        this.showNotification('🔒 Modo edición de precios desactivado', 'info');
                        this.actualizarBotonEdicionPrecios();
                        this.renderCarrito();
                    }
                }
            }, (error) => {
                console.error('Error en listener de sesión:', error);
            });

        // Escuchar solicitudes pendientes del vendedor
        this.solicitudListener = window.db.collection('solicitudes_edicion_precio')
            .where('vendedorId', '==', userId)
            .where('estado', '==', 'pendiente')
            .onSnapshot((snapshot) => {
                this.solicitudPendiente = !snapshot.empty;
                if (snapshot.empty && !this.modoEdicionPreciosActivo) {
                    this.solicitudPendiente = false;
                }
                this.actualizarBotonEdicionPrecios();
            }, (error) => {
                console.error('Error en listener de solicitudes:', error);
            });

        console.log('👂 Listener de sesiones de edición activado');
    }

    actualizarBotonEdicionPrecios() {
        const btn = document.getElementById('btn-solicitar-edicion');
        if (!btn) return;

        const userRole = window.authSystem?.currentUser?.rol;
        const textSpan = btn.querySelector('.btn-text');

        // ✅ ADMINISTRADORES: Modo edición directo (sin solicitar autorización)
        if (userRole === 'administrador') {
            btn.style.display = 'inline-flex';
            btn.classList.remove('pendiente');
            btn.classList.toggle('activo', this.modoEdicionPreciosActivo);

            if (this.modoEdicionPreciosActivo) {
                if (textSpan) textSpan.textContent = '✏️ Editando precios';
                btn.disabled = false; // Puede desactivar cuando quiera
            } else {
                if (textSpan) textSpan.textContent = '💰 Editar precios';
                btn.disabled = false;
            }
            this.removerBotonCancelarSolicitud();
            return;
        }

        // ✅ VENDEDORES/SUPERVISORES: Solicitar autorización
        btn.style.display = 'inline-flex';
        btn.classList.remove('pendiente', 'activo');

        if (this.modoEdicionPreciosActivo) {
            btn.classList.add('activo');
            if (textSpan) textSpan.textContent = 'Editando precios';
            btn.disabled = true;
        } else if (this.solicitudPendiente) {
            btn.classList.add('pendiente');
            if (textSpan) textSpan.textContent = 'Esperando...';
            btn.disabled = true;
            
            // Agregar botón para cancelar solicitud
            this.agregarBotonCancelarSolicitud();
        } else {
            if (textSpan) textSpan.textContent = 'Editar precios';
            btn.disabled = false;
            this.removerBotonCancelarSolicitud();
        }
    }

    agregarBotonCancelarSolicitud() {
        if (document.getElementById('btn-cancelar-solicitud')) return;
        
        const btn = document.getElementById('btn-solicitar-edicion');
        if (!btn) return;
        
        const cancelBtn = document.createElement('button');
        cancelBtn.id = 'btn-cancelar-solicitud';
        cancelBtn.className = 'btn-cancelar-solicitud-compact';
        cancelBtn.title = 'Cancelar solicitud';
        cancelBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
            <span class="btn-text-compact">Cancelar</span>
        `;
        cancelBtn.onclick = () => this.cancelarSolicitudPendiente();
        
        btn.parentNode.insertBefore(cancelBtn, btn.nextSibling);
    }

    removerBotonCancelarSolicitud() {
        const cancelBtn = document.getElementById('btn-cancelar-solicitud');
        if (cancelBtn) cancelBtn.remove();
    }

    async cancelarSolicitudPendiente() {
        const userId = window.authSystem?.currentUser?.uid;
        if (!userId) return;

        if (!confirm('¿Cancelar la solicitud de autorización?')) return;

        try {
            console.log('🗑️ Buscando solicitudes del usuario (pendientes o aprobadas)...');
            
            // Buscar solicitudes pendientes O aprobadas (para casos donde ya fue aprobada pero aún está activa)
            const solicitudesSnapshot = await window.db.collection('solicitudes_edicion_precio')
                .where('vendedorId', '==', userId)
                .where('estado', 'in', ['pendiente', 'aprobada'])
                .get();

            if (solicitudesSnapshot.empty) {
                // Si no hay solicitudes pendientes/aprobadas, desactivar el modo edición local
                if (this.modoEdicionPreciosActivo) {
                    this.modoEdicionPreciosActivo = false;
                    this.sesionActualId = null;
                    this.solicitudPendiente = false;
                    this.actualizarBotonEdicionPrecios();
                    this.renderCarrito();
                    this.showNotification('🔒 Modo edición desactivado', 'info');
                } else {
                    this.showNotification('No se encontraron solicitudes activas', 'info');
                }
                return;
            }

            // Cancelar todas las solicitudes del usuario
            const batch = window.db.batch();
            solicitudesSnapshot.docs.forEach(doc => {
                batch.update(doc.ref, {
                    estado: 'cancelada',
                    fechaCancelacion: firebase.firestore.Timestamp.now(),
                    canceladaPor: userId
                });
            });

            // Desactivar sesiones activas del vendedor
            const sesionesSnapshot = await window.db.collection('sesiones_precio_temporal')
                .where('vendedorId', '==', userId)
                .where('activo', '==', true)
                .get();

            sesionesSnapshot.docs.forEach(doc => {
                batch.update(doc.ref, {
                    activo: false,
                    fechaDesactivacion: firebase.firestore.Timestamp.now(),
                    canceladaPorVendedor: true
                });
            });

            await batch.commit();

            // Desactivar modo edición localmente
            this.modoEdicionPreciosActivo = false;
            this.sesionActualId = null;
            this.solicitudPendiente = false;
            this.actualizarBotonEdicionPrecios();
            this.renderCarrito();

            this.showNotification(`✅ Solicitud cancelada - Modo edición desactivado`, 'success');
            console.log(`✅ ${solicitudesSnapshot.size} solicitudes canceladas y modo edición desactivado`);

        } catch (error) {
            console.error('Error cancelando solicitudes:', error);
            this.showNotification('❌ Error al cancelar solicitudes', 'error');
        }
    }

    // ⏱️ TIMER DE EXPIRACIÓN - 5 minutos máximo
    iniciarTimerExpiracion() {
        this.detenerTimerExpiracion(); // Limpiar cualquier timer anterior
        
        const TIEMPO_EXPIRACION = 5 * 60 * 1000; // 5 minutos en milisegundos
        
        console.log('⏱️ Timer de expiración iniciado (5 minutos)');
        
        this.expiracionTimer = setTimeout(async () => {
            console.log('⏰ Tiempo de autorización expirado');
            await this.desactivarSesionActual('Tiempo de autorización expirado (5 minutos)');
        }, TIEMPO_EXPIRACION);
    }

    detenerTimerExpiracion() {
        if (this.expiracionTimer) {
            clearTimeout(this.expiracionTimer);
            this.expiracionTimer = null;
            console.log('⏱️ Timer de expiración detenido');
        }
    }

    // 🔒 DESACTIVAR SESIÓN ACTUAL EN FIREBASE
    async desactivarSesionActual(motivo = 'Sesión cerrada') {
        if (!this.sesionActualId) return;

        try {
            await window.db.collection('sesiones_precio_temporal').doc(this.sesionActualId).update({
                activo: false,
                fechaDesactivacion: firebase.firestore.Timestamp.now(),
                motivoDesactivacion: motivo
            });
            
            console.log(`🔒 Sesión desactivada: ${motivo}`);
            this.showNotification(`🔒 ${motivo}`, 'info');
            
            // Limpiar estado local
            this.modoEdicionPreciosActivo = false;
            this.sesionActualId = null;
            this.carritoAutorizadoId = null;
            this.detenerTimerExpiracion();
            this.actualizarBotonEdicionPrecios();
            this.renderCarrito();
            
        } catch (error) {
            console.error('Error desactivando sesión:', error);
        }
    }

    // 🆔 GENERAR ID ÚNICO PARA ESTA PESTAÑA
    generarTabId() {
        // Verificar si ya existe un tabId en sessionStorage (para esta pestaña)
        let tabId = sessionStorage.getItem('ventas_tab_id');
        if (!tabId) {
            tabId = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            sessionStorage.setItem('ventas_tab_id', tabId);
        }
        console.log('🆔 Tab ID:', tabId);
        return tabId;
    }

    // 🚪 DETECTAR CIERRE DE PESTAÑA
    setupBeforeUnloadListener() {
        window.addEventListener('beforeunload', (event) => {
            // Si hay una sesión activa, desactivarla sincrónicamente
            if (this.sesionActualId) {
                console.log('🚪 Pestaña cerrándose - desactivando sesión...');
                
                // Usar sendBeacon para enviar datos antes de cerrar (más confiable)
                // Como Firebase no soporta sendBeacon directamente, usamos fetch con keepalive
                try {
                    // Desactivar localmente primero
                    this.modoEdicionPreciosActivo = false;
                    this.carritoAutorizadoId = null;
                    this.detenerTimerExpiracion();
                    
                    // Intentar desactivar en Firebase (puede no completarse si la pestaña se cierra muy rápido)
                    window.db.collection('sesiones_precio_temporal').doc(this.sesionActualId).update({
                        activo: false,
                        fechaDesactivacion: firebase.firestore.Timestamp.now(),
                        motivoDesactivacion: 'Pestaña cerrada'
                    }).catch(err => console.error('Error en beforeunload:', err));
                    
                } catch (error) {
                    console.error('Error en beforeunload:', error);
                }
            }
        });
        
        console.log('🚪 Listener de cierre de pestaña configurado');
    }

    // 🔑 DETECTAR CIERRE DE SESIÓN (LOGOUT)
    setupLogoutListener() {
        // Escuchar el evento de cambio de autenticación
        document.addEventListener('authStateChanged', async (e) => {
            if (!e.detail?.authenticated) {
                // Usuario cerró sesión
                console.log('🔑 Usuario deslogueado - desactivando sesión de edición...');
                if (this.sesionActualId) {
                    await this.desactivarSesionActual('Cierre de sesión');
                }
            }
        });
        
        console.log('🔑 Listener de logout configurado');
    }

    // 🧹 LIMPIAR SESIONES EXPIRADAS (al iniciar y periódicamente)
    async limpiarSesionesExpiradas() {
        const userId = window.authSystem?.currentUser?.uid;
        if (!userId) return;

        try {
            const ahora = new Date();
            
            // 🔴 IMPORTANTE: Buscar TODAS las sesiones activas (no solo las del usuario actual)
            // Esto garantiza que cualquier cliente puede limpiar sesiones expiradas de otros usuarios
            const sesionesSnapshot = await window.db.collection('sesiones_precio_temporal')
                .where('activo', '==', true)
                .get();

            if (sesionesSnapshot.empty) return;

            const batch = window.db.batch();
            let sesionesExpiradas = 0;

            sesionesSnapshot.docs.forEach(doc => {
                const data = doc.data();
                const expiresAt = data.expiresAt?.toDate();
                
                // Si tiene expiresAt y ya pasó, o si no tiene expiresAt y pasaron más de 10 minutos desde la autorización
                const fechaAutorizacion = data.fechaAutorizacion?.toDate();
                const tiempoLimite = expiresAt || (fechaAutorizacion ? new Date(fechaAutorizacion.getTime() + 10 * 60 * 1000) : null);
                
                if (tiempoLimite && ahora > tiempoLimite) {
                    batch.update(doc.ref, {
                        activo: false,
                        fechaDesactivacion: firebase.firestore.Timestamp.now(),
                        motivoDesactivacion: 'Expiración automática (limpieza global)'
                    });
                    sesionesExpiradas++;
                    console.log(`🧹 Sesión expirada detectada: ${doc.id} (vendedor: ${data.vendedorId})`);
                }
            });

            if (sesionesExpiradas > 0) {
                await batch.commit();
                console.log(`🧹 ${sesionesExpiradas} sesiones expiradas limpiadas globalmente`);
            }
            
            // Verificar si el usuario actual tenía sesión expirada y actualizar estado local
            const miSesionExpirada = sesionesSnapshot.docs.some(doc => {
                const data = doc.data();
                if (data.vendedorId !== userId) return false;
                const expiresAt = data.expiresAt?.toDate();
                const fechaAutorizacion = data.fechaAutorizacion?.toDate();
                const tiempoLimite = expiresAt || (fechaAutorizacion ? new Date(fechaAutorizacion.getTime() + 10 * 60 * 1000) : null);
                return tiempoLimite && ahora > tiempoLimite;
            });
            
            if (miSesionExpirada && this.modoEdicionPreciosActivo) {
                this.modoEdicionPreciosActivo = false;
                this.sesionActualId = null;
                this.carritoAutorizadoId = null;
                this.actualizarBotonEdicionPrecios();
                this.renderCarrito();
            }

        } catch (error) {
            console.error('Error limpiando sesiones expiradas:', error);
        }
        
        // 🔄 CONFIGURAR LIMPIEZA PERIÓDICA (cada 30 segundos)
        if (!this.limpiezaPeriodicaTimer) {
            this.limpiezaPeriodicaTimer = setInterval(() => {
                this.limpiarSesionesExpiradas();
            }, 30 * 1000); // Cada 30 segundos
            console.log('🔄 Limpieza periódica de sesiones configurada (cada 30s)');
        }
    }

    // ✅ VERIFICAR SI UNA SESIÓN ESTÁ EXPIRADA
    verificarSesionExpirada(sesionData) {
        if (!sesionData) return true;
        
        const ahora = new Date();
        const expiresAt = sesionData.expiresAt?.toDate();
        
        if (expiresAt && ahora > expiresAt) {
            return true; // Sesión expirada
        }
        
        // Si no tiene expiresAt, verificar con fechaAutorizacion + 10 minutos
        const fechaAutorizacion = sesionData.fechaAutorizacion?.toDate();
        if (fechaAutorizacion) {
            const limiteAntiguo = new Date(fechaAutorizacion.getTime() + 10 * 60 * 1000);
            if (ahora > limiteAntiguo) {
                return true; // Más de 10 minutos desde autorización
            }
        }
        
        return false; // Sesión válida
    }

    async solicitarAutorizacionEdicion() {
        const userId = window.authSystem?.currentUser?.uid;
        const userName = window.authSystem?.currentUser?.nombre;
        const userRole = window.authSystem?.currentUser?.rol;

        if (!userId) {
            alert('Error: Usuario no autenticado');
            return;
        }

        // 🔑 ADMINISTRADORES: Activar/desactivar modo edición directamente
        if (userRole === 'administrador') {
            if (this.modoEdicionPreciosActivo) {
                // Desactivar modo edición
                this.modoEdicionPreciosActivo = false;
                this.showNotification('🔒 Modo edición de precios desactivado', 'info');
            } else {
                // Activar modo edición
                if (this.carrito.length === 0) {
                    alert('⚠️ Agrega productos al carrito antes de editar precios');
                    return;
                }
                this.modoEdicionPreciosActivo = true;
                this.showNotification('💰 Modo edición de precios activado', 'success');
            }
            this.actualizarBotonEdicionPrecios();
            this.renderCarrito();
            return;
        }

        // 📡 VENDEDORES/SUPERVISORES: Solicitar autorización
        if (this.modoEdicionPreciosActivo) {
            this.showNotification('Ya tienes autorización para editar precios', 'info');
            return;
        }

        if (this.solicitudPendiente) {
            this.showNotification('Ya tienes una solicitud pendiente', 'warning');
            return;
        }

        if (this.carrito.length === 0) {
            alert('⚠️ Agrega productos al carrito antes de solicitar autorización');
            return;
        }

        try {
            const solicitud = {
                vendedorId: userId,
                vendedor: userName || 'Vendedor',
                carritoId: this.carritos[this.carritoActivo].id,
                carritoNombre: this.carritos[this.carritoActivo].nombre,
                itemsEnCarrito: this.carrito.length,
                productos: this.carrito.map(item => ({
                    nombre: item.nombre,
                    cantidad: item.cantidad,
                    precioActual: item.precioUnitario
                })),
                totalCarrito: this.carrito.reduce((sum, item) => sum + item.subtotal, 0),
                estado: 'pendiente',
                fechaSolicitud: firebase.firestore.Timestamp.now()
            };

            console.log('📡 Enviando solicitud de edición de precios...');
            console.log('📋 Datos de la solicitud:', {
                vendedorId: solicitud.vendedorId,
                vendedor: solicitud.vendedor,
                carritoNombre: solicitud.carritoNombre,
                itemsEnCarrito: solicitud.itemsEnCarrito,
                totalCarrito: solicitud.totalCarrito,
                estado: solicitud.estado
            });

            const docRef = await window.db.collection('solicitudes_edicion_precio').add(solicitud);
            
            console.log('✅ Solicitud guardada con ID:', docRef.id);
            
            // Verificar que se guardó correctamente
            const verificacion = await docRef.get();
            if (verificacion.exists) {
                console.log('✅ Verificación: Solicitud guardada correctamente en Firestore');
                console.log('📊 Estado de la solicitud:', verificacion.data().estado);
            } else {
                console.error('❌ ERROR: Solicitud no se guardó correctamente');
            }
            
            this.solicitudPendiente = true;
            this.actualizarBotonEdicionPrecios();
            this.showNotification('📡 Solicitud enviada - Esperando autorización del administrador', 'info');
            console.log('✅ Solicitud de autorización enviada y verificada');

        } catch (error) {
            console.error('❌ Error enviando solicitud:', error);
            console.error('Código de error:', error.code);
            console.error('Mensaje:', error.message);
            alert('❌ Error enviando solicitud: ' + error.message);
        }
    }

    actualizarEstadoVentas() {
        const btnProcesar = document.getElementById('btn-procesar-venta');
        const alertaCaja = document.getElementById('alerta-sin-caja');

        if (!this.cajaAbierta) {
            // Bloquear ventas
            if (btnProcesar) {
                btnProcesar.disabled = true;
                btnProcesar.style.opacity = '0.5';
                btnProcesar.style.cursor = 'not-allowed';
            }

            // Mostrar alerta
            if (alertaCaja) {
                alertaCaja.style.display = 'flex';
            }
        } else {
            // Habilitar ventas (si hay productos en carrito)
            if (btnProcesar) {
                btnProcesar.disabled = this.carrito.length === 0;
                btnProcesar.style.opacity = '1';
                btnProcesar.style.cursor = 'pointer';
            }

            // Ocultar alerta
            if (alertaCaja) {
                alertaCaja.style.display = 'none';
            }
        }
    }

    actualizarVisibilidadSelectores() {
        const tipoVenta = document.getElementById('tipo-venta').value;
        const metodoPago = document.getElementById('metodo-venta').value;
        const clientePersonalizadoGroup = document.getElementById('cliente-personalizado-group');
        const clienteCreditoGroup = document.getElementById('cliente-credito-group');

        // Mostrar selector de cliente personalizado SOLO si tipo de venta es "personalizado"
        if (tipoVenta === 'personalizado') {
            clientePersonalizadoGroup.style.display = 'block';
        } else {
            clientePersonalizadoGroup.style.display = 'none';
        }

        // Mostrar selector de cliente a crédito SOLO si:
        // - Método de pago es "credito" Y
        // - Tipo de venta NO es "personalizado" (puede ser público o mayorista)
        if (metodoPago === 'credito' && tipoVenta !== 'personalizado') {
            clienteCreditoGroup.style.display = 'block';
        } else {
            clienteCreditoGroup.style.display = 'none';
        }
    }

    setupTabsSystem() {
        const tabs = document.querySelectorAll('.ventas-tab');
        const indicator = document.querySelector('.tab-indicator');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetTab = tab.dataset.tab;
                this.cambiarTab(targetTab, tab);
            });
        });

        // Inicializar el indicador en la primera pestaña
        const activeTab = document.querySelector('.ventas-tab.active');
        if (activeTab && indicator) {
            this.updateTabIndicator(activeTab, indicator);
        }

        // Actualizar indicador al redimensionar la ventana
        window.addEventListener('resize', () => {
            const currentActiveTab = document.querySelector('.ventas-tab.active');
            if (currentActiveTab && indicator) {
                this.updateTabIndicator(currentActiveTab, indicator, false);
            }
        });
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

    // ========== GESTIÓN DE CARRITOS MÚLTIPLES ==========
    
    cargarCarritosGuardados() {
        try {
            const carritosSaved = localStorage.getItem('ventasCarritos');
            if (carritosSaved) {
                const data = JSON.parse(carritosSaved);
                this.carritos = data.carritos || [];
                this.carritoActivo = data.carritoActivo || 0;
                this.contadorCarritos = data.contadorCarritos || 1;
                
                // Si hay carritos guardados, cargar el activo
                if (this.carritos.length > 0) {
                    this.carrito = this.carritos[this.carritoActivo]?.items || [];
                    console.log(`✅ ${this.carritos.length} carritos recuperados desde localStorage`);
                } else {
                    // Si no hay carritos, crear uno por defecto
                    this.crearNuevoCarrito();
                }
            } else {
                // Primera vez - crear carrito inicial
                this.crearNuevoCarrito();
            }
        } catch (error) {
            console.error('Error cargando carritos:', error);
            this.crearNuevoCarrito();
        }
    }

    guardarCarritos() {
        try {
            // Actualizar el carrito activo antes de guardar
            if (this.carritos[this.carritoActivo]) {
                this.carritos[this.carritoActivo].items = this.carrito;
                this.carritos[this.carritoActivo].fechaModificacion = new Date().toISOString();
            }

            const data = {
                carritos: this.carritos,
                carritoActivo: this.carritoActivo,
                contadorCarritos: this.contadorCarritos,
                timestamp: new Date().toISOString()
            };
            localStorage.setItem('ventasCarritos', JSON.stringify(data));
        } catch (error) {
            console.error('Error guardando carritos:', error);
        }
    }

    crearNuevoCarrito() {
        // Detectar si es móvil o escritorio - Límite 10 en desktop, 5 en móvil
        const isMobile = window.innerWidth <= 768;
        const maxCarritos = isMobile ? 5 : 10;

        // Validar límite de carritos
        if (this.carritos.length >= maxCarritos) {
            alert(`⚠️ Límite alcanzado: Máximo ${maxCarritos} carritos abiertos.\n\nCierra un carrito antes de crear uno nuevo.`);
            return;
        }

        // Encontrar el número más bajo disponible
        const numerosUsados = this.carritos.map(c => {
            const match = c.nombre.match(/Carrito (\d+)/);
            return match ? parseInt(match[1]) : 0;
        });
        
        let numeroDisponible = 1;
        while (numerosUsados.includes(numeroDisponible)) {
            numeroDisponible++;
        }

        const nuevoCarrito = {
            id: Date.now(),
            nombre: `Carrito ${numeroDisponible}`,
            items: [],
            fechaCreacion: new Date().toISOString(),
            fechaModificacion: new Date().toISOString(),
            tipoVenta: 'publico',
            metodoPago: 'efectivo'
        };

        this.carritos.push(nuevoCarrito);
        this.carritoActivo = this.carritos.length - 1;
        this.carrito = [];
        
        // Actualizar contador solo si es necesario
        if (numeroDisponible >= this.contadorCarritos) {
            this.contadorCarritos = numeroDisponible + 1;
        }
        
        this.guardarCarritos();
        this.renderCarritosTabs();
        this.renderCarrito();
        
        console.log(`✅ Nuevo carrito creado: ${nuevoCarrito.nombre} (${this.carritos.length}/${maxCarritos})`);
    }

    cambiarCarrito(index) {
        if (index < 0 || index >= this.carritos.length) return;

        // Guardar carrito actual antes de cambiar
        if (this.carritos[this.carritoActivo]) {
            this.carritos[this.carritoActivo].items = this.carrito;
        }

        // Cambiar al nuevo carrito
        this.carritoActivo = index;
        this.carrito = this.carritos[index]?.items || [];

        // Restaurar configuración del carrito
        const carritoData = this.carritos[index];
        if (carritoData) {
            document.getElementById('tipo-venta').value = carritoData.tipoVenta || 'publico';
            document.getElementById('metodo-venta').value = carritoData.metodoPago || 'efectivo';
            this.actualizarVisibilidadSelectores();
        }

        // 🔐 VERIFICAR SI EL NUEVO CARRITO ES EL AUTORIZADO (comparar como strings)
        if (this.carritoAutorizadoId) {
            const esCarritoAutorizado = String(carritoData?.id) === this.carritoAutorizadoId;
            this.modoEdicionPreciosActivo = esCarritoAutorizado;
            this.actualizarBotonEdicionPrecios();
            
            if (!esCarritoAutorizado) {
                console.log('🔒 Cambio a carrito sin autorización de edición');
            } else {
                console.log('✅ Cambio a carrito con autorización de edición activa');
            }
        }

        this.guardarCarritos();
        this.renderCarritosTabs();
        this.renderCarrito();
        
        console.log(`🔄 Cambiado a: ${carritoData.nombre}`);
    }

    cerrarCarrito(index, event) {
        event.stopPropagation();

        if (this.carritos.length === 1) {
            // No permitir cerrar el último carrito
            alert('Debe haber al menos un carrito abierto');
            return;
        }

        const carritoACerrar = this.carritos[index];
        if (carritoACerrar.items.length > 0) {
            if (!confirm(`¿Cerrar "${carritoACerrar.nombre}"? Se perderán ${carritoACerrar.items.length} productos.`)) {
                return;
            }
        }

        // 🔐 SI SE ESTÁ CERRANDO EL CARRITO AUTORIZADO, DESACTIVAR SESIÓN (comparar como strings)
        if (this.carritoAutorizadoId && String(carritoACerrar.id) === this.carritoAutorizadoId) {
            this.desactivarSesionActual('Carrito cerrado');
        }

        // Eliminar carrito
        this.carritos.splice(index, 1);

        // Ajustar carrito activo
        if (this.carritoActivo >= this.carritos.length) {
            this.carritoActivo = this.carritos.length - 1;
        } else if (this.carritoActivo > index) {
            this.carritoActivo--;
        }

        // Cargar el nuevo carrito activo
        this.carrito = this.carritos[this.carritoActivo]?.items || [];

        this.guardarCarritos();
        this.renderCarritosTabs();
        this.renderCarrito();
    }

    renombrarCarrito(index) {
        const carritoData = this.carritos[index];
        const nuevoNombre = prompt('Nuevo nombre del carrito:', carritoData.nombre);
        
        if (nuevoNombre && nuevoNombre.trim()) {
            carritoData.nombre = nuevoNombre.trim();
            this.guardarCarritos();
            this.renderCarritosTabs();
        }
    }

    renderCarritosTabs() {
        const container = document.getElementById('carritos-tabs-container');
        if (!container) return;

        // Detectar límite según dispositivo
        const isMobile = window.innerWidth <= 768;
        const maxCarritos = isMobile ? 5 : 10;
        const limiteAlcanzado = this.carritos.length >= maxCarritos;

        const html = `
            <div class="carritos-tabs-scroll">
                <div class="carritos-tab-indicator"></div>
                ${this.carritos.map((carrito, index) => {
                    const itemsCount = carrito.items.length;
                    const isActive = index === this.carritoActivo;
                    const tipoIcon = this.getTipoVentaIcon(carrito.tipoVenta);
                    
                    // Extraer número del nombre del carrito (ej: "Carrito 1" -> "1")
                    const numeroCarrito = carrito.nombre.match(/\d+/)?.[0] || (index + 1);
                    
                    return `
                        <div class="carrito-tab ${isActive ? 'active' : ''}" 
                             data-carrito-index="${index}"
                             onclick="ventasModule.cambiarCarrito(${index})"
                             ondblclick="ventasModule.renombrarCarrito(${index})"
                             title="${carrito.nombre}${itemsCount > 0 ? ` (${itemsCount} items)` : ''}">
                            <div class="carrito-tab-info">
                                <span class="carrito-tab-icon">${tipoIcon}</span>
                                ${!isActive ? `
                                    <span class="carrito-tab-numero">${numeroCarrito}</span>
                                ` : `
                                    <span class="carrito-tab-nombre">${carrito.nombre}</span>
                                    ${itemsCount > 0 ? `<span class="carrito-tab-badge">${itemsCount}</span>` : ''}
                                `}
                            </div>
                            ${this.carritos.length > 1 ? `
                                <button class="carrito-tab-close" 
                                        onclick="ventasModule.cerrarCarrito(${index}, event)"
                                        title="Cerrar carrito">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </button>
                            ` : ''}
                        </div>
                    `;
                }).join('')}
                ${!limiteAlcanzado ? `
                    <button class="carrito-tab-nuevo" 
                            onclick="ventasModule.crearNuevoCarrito()" 
                            title="Nuevo carrito">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                    </button>
                ` : ''}
            </div>
        `;

        container.innerHTML = html;
        
        // Actualizar indicador animado
        this.updateCarritoTabIndicator();
        
        // Hacer scroll al carrito activo si está fuera de vista
        this.scrollToActiveCarrito();
    }

    updateCarritoTabIndicator(animate = true) {
        const activeTab = document.querySelector('.carrito-tab.active');
        const indicator = document.querySelector('.carritos-tab-indicator');
        
        if (!activeTab || !indicator) return;

        const tabsContainer = activeTab.parentElement;
        const tabRect = activeTab.getBoundingClientRect();
        const containerRect = tabsContainer.getBoundingClientRect();

        const left = tabRect.left - containerRect.left + tabsContainer.scrollLeft;
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

    scrollToActiveCarrito() {
        const activeTab = document.querySelector('.carrito-tab.active');
        const scrollContainer = document.querySelector('.carritos-tabs-scroll');
        
        if (!activeTab || !scrollContainer) return;

        const tabRect = activeTab.getBoundingClientRect();
        const containerRect = scrollContainer.getBoundingClientRect();
        
        // Calcular si el tab está fuera de vista
        const tabLeft = activeTab.offsetLeft;
        const tabRight = tabLeft + activeTab.offsetWidth;
        const containerScrollLeft = scrollContainer.scrollLeft;
        const containerWidth = scrollContainer.offsetWidth;
        
        if (tabLeft < containerScrollLeft) {
            // Tab está a la izquierda, hacer scroll hacia la izquierda
            scrollContainer.scrollTo({
                left: tabLeft - 20,
                behavior: 'smooth'
            });
        } else if (tabRight > containerScrollLeft + containerWidth) {
            // Tab está a la derecha, hacer scroll hacia la derecha
            scrollContainer.scrollTo({
                left: tabRight - containerWidth + 20,
                behavior: 'smooth'
            });
        }
    }

    getTipoVentaIcon(tipo) {
        const iconos = {
            'publico': `<svg class="carrito-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="9" cy="21" r="1"></circle>
                <circle cx="20" cy="21" r="1"></circle>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
            </svg>`,
            'mayorista': `<svg class="carrito-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>`,
            'personalizado': `<svg class="carrito-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>`
        };
        return iconos[tipo] || iconos['publico'];
    }

    async crearModales() {
        if (document.getElementById('modal-seleccion-producto')) {
            console.log('✅ Modales de ventas ya existen');
            return;
        }

        console.log('📦 Creando modales de ventas en el contenedor permanente...');

        let permanentContainer = document.getElementById('permanent-modals-container');
        if (!permanentContainer) {
            permanentContainer = document.createElement('div');
            permanentContainer.id = 'permanent-modals-container';
            permanentContainer.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 9999;';
            document.body.appendChild(permanentContainer);
        }

        try {
            const response = await fetch('./modules/ventas/ventas-modals.html');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const modalsHTML = await response.text();

            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = modalsHTML;

            while (tempDiv.firstChild) {
                permanentContainer.appendChild(tempDiv.firstChild);
            }

            console.log('✅ Modales de ventas creados en contenedor permanente');
        } catch (error) {
            console.error('❌ Error cargando modales:', error);
        }
    }

    setupModalEventListeners() {
        console.log('🔧 Configurando event listeners de modales...');

        // Modal de selección de producto
        const modalSeleccionClose = document.getElementById('modal-seleccion-close');
        if (modalSeleccionClose) {
            modalSeleccionClose.addEventListener('click', () => this.cerrarModalSeleccion());
        }

        // Modal de detalle de venta
        const modalDetalleClose = document.getElementById('modal-detalle-close');
        if (modalDetalleClose) {
            modalDetalleClose.addEventListener('click', () => {
                const modal = document.getElementById('modal-detalle-venta');
                if (modal) modal.classList.remove('active');
            });
        }

        // Modal de efectivo
        const modalEfectivoClose = document.getElementById('modal-efectivo-close');
        if (modalEfectivoClose) {
            modalEfectivoClose.addEventListener('click', () => {
                const modal = document.getElementById('modal-efectivo');
                if (modal) modal.classList.remove('active');
            });
        }

        // Modal de cancelar venta
        const modalCancelarClose = document.getElementById('modal-cancelar-close');
        if (modalCancelarClose) {
            modalCancelarClose.addEventListener('click', () => this.cerrarModalCancelarVenta());
        }

        console.log('✅ Event listeners de modales configurados');
    }

    setupKeyboardShortcuts() {
        // Remover listener anterior si existe para evitar duplicados
        if (this._keyboardHandler) {
            window.removeEventListener('keydown', this._keyboardHandler, true);
        }

        this._keyboardHandler = async (e) => {
            const activeElement = document.activeElement;
            const isInput = activeElement.tagName === 'INPUT' || 
                           activeElement.tagName === 'TEXTAREA' || 
                           activeElement.isContentEditable;
            
            // Si estamos en el buscador de productos (pos-search), no interceptar flechas ni enter
            if (activeElement.id === 'pos-search') return;

            // ESC: Cerrar modales (prioridad alta)
            if (e.key === 'Escape') {
                if (isInput) {
                    activeElement.blur();
                    return;
                }
                const modalActivo = document.querySelector('.modal.active, .modal-inventario.active');
                if (modalActivo) {
                    e.preventDefault();
                    e.stopPropagation();
                    const btnClose = modalActivo.querySelector('.close-modal, .btn-close, .modal-inventario-close, .btn-secondary');
                    if (btnClose) btnClose.click();
                    else modalActivo.classList.remove('active');
                }
                return;
            }

            // ENTER: Procesar o Confirmar
            if (e.key === 'Enter') {
                if (isInput && activeElement.id !== 'monto-pagado') return;

                const modalCobro = document.getElementById('modal-cobro');
                const modalConfirm = document.getElementById('modal-confirm-venta');
                const modalEfectivo = document.getElementById('modal-efectivo');
                const modalCredito = document.getElementById('modal-credito');
                
                let targetBtn = null;
                if (modalConfirm?.classList.contains('active')) {
                    targetBtn = document.getElementById('btn-confirm-venta-action');
                } else if (modalEfectivo?.classList.contains('active')) {
                    targetBtn = document.getElementById('btn-confirmar-pago-efectivo');
                } else if (modalCredito?.classList.contains('active')) {
                    targetBtn = document.getElementById('btn-confirmar-credito');
                } else if (modalCobro?.classList.contains('active')) {
                    const metodoActivo = this.getMetodoPagoActivo();
                    if (metodoActivo === 'efectivo') targetBtn = document.getElementById('btn-pagar-efectivo');
                    else if (metodoActivo === 'credito') targetBtn = document.getElementById('btn-pagar-credito');
                    else {
                        e.preventDefault();
                        this.mostrarConfirmacionVenta(metodoActivo);
                        return;
                    }
                } else if (this.carrito.length > 0 && !isInput) {
                    targetBtn = document.getElementById('btn-cobrar');
                }

                if (targetBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    targetBtn.click();
                }
                return;
            }

            // TECLA /: Enfocar buscador de productos
            if (e.key === '/' && !isInput) {
                e.preventDefault();
                e.stopPropagation();
                const search = document.getElementById('pos-search');
                if (search) search.focus();
                return;
            }

            // FLECHAS: Solo fuera de inputs y sin modales activos
            if (!isInput && !document.querySelector('.modal.active')) {
                if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                    if (this.carrito.length > 0) {
                        e.preventDefault();
                        e.stopPropagation();
                        const lastIdx = this.carrito.length - 1;
                        const paso = e.shiftKey ? 10 : 1; // Shift para ±10
                        const cambio = e.key === 'ArrowUp' ? paso : -paso;
                        this.cambiarCantidad(lastIdx, cambio);
                    }
                }
            }
        };

        // Usar capture phase y window para máxima prioridad
        window.addEventListener('keydown', this._keyboardHandler, true);
        console.log('⌨️ Atajos de teclado vinculados globalmente');
    }

    getMetodoPagoActivo() {
        const metodos = document.querySelectorAll('.metodo-pago-item');
        let activo = 'efectivo';
        metodos.forEach(m => {
            if (m.classList.contains('active')) {
                activo = m.dataset.metodo;
            }
        });
        return activo;
    }

    mostrarConfirmacionVenta(metodo) {
        let modalConfirm = document.getElementById('modal-confirm-venta');
        if (!modalConfirm) {
            modalConfirm = document.createElement('div');
            modalConfirm.id = 'modal-confirm-venta';
            modalConfirm.className = 'modal';
            document.body.appendChild(modalConfirm);
        }

        const total = this.carrito.reduce((s, i) => s + (i.subtotal || 0), 0);
        const fmt = v => window.currencyFormatter?.format(v) || '$' + Number(v).toFixed(2);
        const numProductos = this.carrito.reduce((s, i) => s + (i.cantidad || 0), 0);
        const iconos = { tarjeta: '💳', transferencia: '🏦', credito: '📋' };
        const etiquetas = { tarjeta: 'Tarjeta', transferencia: 'Transferencia', credito: 'Crédito' };
        const icono = iconos[metodo] || '💰';
        const etiqueta = etiquetas[metodo] || metodo;

        modalConfirm.innerHTML = `
            <div class="modal-content modal-confirm-content">
                <div class="modal-confirm-header">
                    <span class="modal-confirm-icono">${icono}</span>
                    <h3 class="modal-confirm-titulo">Confirmar venta</h3>
                    <button class="modal-close" onclick="this.closest('.modal').classList.remove('active')">✕</button>
                </div>
                <div class="modal-confirm-body">
                    <div class="modal-confirm-fila">
                        <span class="modal-confirm-label">Método de pago</span>
                        <span class="modal-confirm-valor">${icono} ${etiqueta}</span>
                    </div>
                    <div class="modal-confirm-fila">
                        <span class="modal-confirm-label">Productos</span>
                        <span class="modal-confirm-valor">${numProductos} unidad${numProductos !== 1 ? 'es' : ''}</span>
                    </div>
                    <div class="modal-confirm-fila modal-confirm-total">
                        <span class="modal-confirm-label">Total</span>
                        <span class="modal-confirm-valor-total">${fmt(total)}</span>
                    </div>
                </div>
                <div class="modal-confirm-footer">
                    <button class="modal-confirm-btn-cancelar" onclick="document.getElementById('modal-confirm-venta').classList.remove('active')">
                        Cancelar
                    </button>
                    <button id="btn-confirm-venta-action" class="modal-confirm-btn-ok">
                        Confirmar venta
                    </button>
                </div>
            </div>
        `;

        document.getElementById('btn-confirm-venta-action').onclick = async () => {
            modalConfirm.classList.remove('active');
            await this.confirmarVenta();
        };

        modalConfirm.classList.add('active');

        // Enfocar el botón confirmar para que Enter lo dispare
        setTimeout(() => document.getElementById('btn-confirm-venta-action')?.focus(), 50);
    }

    setupEventListeners() {
        // Atajos de teclado profesionales
        this.setupKeyboardShortcuts();
        // Los tabs ahora se manejan en setupTabsSystem()

        // Filtro de período
        const filterPeriodo = document.getElementById('filter-periodo');
        if (filterPeriodo) {
            filterPeriodo.addEventListener('change', (e) => {
                this.periodoActual = e.target.value;
                this.handlePeriodoChange();
            });
        }

        // Aplicar fechas personalizadas
        const btnAplicarFechas = document.getElementById('btn-aplicar-fechas');
        if (btnAplicarFechas) {
            btnAplicarFechas.addEventListener('click', () => {
                this.aplicarFechasPersonalizadas();
            });
        }

        // Búsqueda de productos
        const searchInput = document.getElementById('pos-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                clearTimeout(this.searchTimeout);
                this.searchTimeout = setTimeout(() => {
                    this.buscarProductos(e.target.value);
                }, 300);
            });

            searchInput.addEventListener('focus', () => {
                if (searchInput.value.length >= 2) {
                    this.buscarProductos(searchInput.value);
                }
            });
        }

        // Cerrar dropdown al hacer click fuera
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-container')) {
                this.hideResultados();
            }
        });

        // Limpiar carrito
        const btnLimpiar = document.getElementById('btn-limpiar-carrito');
        if (btnLimpiar) {
            btnLimpiar.addEventListener('click', () => this.limpiarCarrito());
        }

        // Tipo de venta
        const tipoVenta = document.getElementById('tipo-venta');
        if (tipoVenta) {
            tipoVenta.addEventListener('change', () => {
                this.actualizarVisibilidadSelectores();
                this.actualizarPreciosCarrito();
            });
        }

        // Cliente personalizado - actualizar precios
        const selectClientePersonalizado = document.getElementById('select-cliente-personalizado');
        if (selectClientePersonalizado) {
            selectClientePersonalizado.addEventListener('change', () => this.actualizarPreciosCarrito());
        }

        // Método de pago
        const metodoVenta = document.getElementById('metodo-venta');
        if (metodoVenta) {
            metodoVenta.addEventListener('change', () => {
                this.actualizarVisibilidadSelectores();
            });
        }

        // Procesar venta (remover listener anterior si existe para evitar duplicados)
        const btnProcesar = document.getElementById('btn-procesar-venta');
        if (btnProcesar) {
            // Clonar el botón para eliminar todos los listeners anteriores
            const newBtn = btnProcesar.cloneNode(true);
            btnProcesar.parentNode.replaceChild(newBtn, btnProcesar);

            // Agregar listener limpio
            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.procesarVenta();
            });
        }

        // Modal de selección de producto
        const modalSeleccionClose = document.getElementById('modal-seleccion-close');
        if (modalSeleccionClose) {
            modalSeleccionClose.addEventListener('click', () => this.cerrarModalSeleccion());
        }

        // Modal de detalle de venta
        const modalDetalleClose = document.getElementById('modal-detalle-close');
        if (modalDetalleClose) {
            modalDetalleClose.addEventListener('click', () => {
                document.getElementById('modal-detalle-venta').classList.remove('active');
            });
        }

        // Filtros de historial - Búsqueda de texto
        const historialSearch = document.getElementById('historial-search');
        if (historialSearch) {
            historialSearch.addEventListener('input', (e) => {
                this.filtrarHistorial(e.target.value);
            });
        }

        // Filtros de tipo de venta y estado
        const filterTipoVenta = document.getElementById('filter-tipo-venta');
        const filterEstado = document.getElementById('filter-estado');

        [filterTipoVenta, filterEstado].forEach(filter => {
            if (filter) {
                filter.addEventListener('change', () => this.aplicarFiltrosHistorial());
            }
        });
    }

    cambiarTab(tab, tabElement = null) {
        this.currentTab = tab;

        // Actualizar pestañas activas
        document.querySelectorAll('.ventas-tab').forEach(t => {
            t.classList.remove('active');
        });

        const targetTabElement = tabElement || document.querySelector(`.ventas-tab[data-tab="${tab}"]`);
        if (targetTabElement) {
            targetTabElement.classList.add('active');

            // Actualizar indicador animado
            const indicator = document.querySelector('.tab-indicator');
            if (indicator) {
                this.updateTabIndicator(targetTabElement, indicator, true);
            }
        }

        // Actualizar contenido
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`tab-${tab}`).classList.add('active');

        if (tab === 'historial') {
            this.renderHistorial();
        } else if (tab === 'estadisticas') {
            this.actualizarEstadisticas();
        }
    }

    async cargarProductos() {
        try {
            // Indicador visual de carga
            const searchInput = document.getElementById('pos-search');
            if (searchInput) {
                searchInput.placeholder = 'Cargando productos...';
                searchInput.disabled = true;
            }

            const snapshot = await window.db.collection('products').get();
            this.productos = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            console.log(`📦 ${this.productos.length} productos cargados`);

            // Habilitar búsqueda
            if (searchInput) {
                searchInput.placeholder = 'Buscar producto por nombre o código de barras...';
                searchInput.disabled = false;
            }
        } catch (error) {
            console.error('Error cargando productos:', error);
            this.productos = [];
        }
    }

    async cargarClientes() {
        try {
            const snapshot = await window.db.collection('clients').get();
            this.clientes = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Cargar clientes en selector de crédito
            const selectClienteCredito = document.getElementById('select-cliente-credito');
            if (selectClienteCredito) {
                selectClienteCredito.innerHTML = '<option value="">Seleccionar cliente</option>';
                this.clientes.forEach(cliente => {
                    const option = document.createElement('option');
                    option.value = cliente.id;
                    option.textContent = cliente.nombre;
                    selectClienteCredito.appendChild(option);
                });
            }

            // Cargar clientes con precios personalizados
            await this.cargarClientesPersonalizados();

            console.log(`👥 ${this.clientes.length} clientes cargados`);
        } catch (error) {
            console.error('Error cargando clientes:', error);
            this.clientes = [];
        }
    }

    async cargarClientesPersonalizados() {
        try {
            // Obtener todos los clientes que tienen precios especiales activos
            const preciosSnapshot = await window.db.collection('customPrices')
                .where('activo', '==', true)
                .get();

            const clientesConPrecios = new Set();
            preciosSnapshot.forEach(doc => {
                const data = doc.data();
                if (data.clienteId) {
                    clientesConPrecios.add(data.clienteId);
                }
            });

            const selectClientePersonalizado = document.getElementById('select-cliente-personalizado');
            if (selectClientePersonalizado) {
                selectClientePersonalizado.innerHTML = '<option value="">Seleccionar cliente</option>';
                
                this.clientes
                    .filter(cliente => clientesConPrecios.has(cliente.id))
                    .forEach(cliente => {
                        const option = document.createElement('option');
                        option.value = cliente.id;
                        option.textContent = cliente.nombre;
                        selectClientePersonalizado.appendChild(option);
                    });
            }

            console.log(`⭐ ${clientesConPrecios.size} clientes con precios personalizados`);
        } catch (error) {
            console.error('Error cargando clientes personalizados:', error);
        }
    }

    async cargarVentas() {
        try {
            const snapshot = await window.db.collection('sales')
                .orderBy('fecha', 'desc')
                .limit(100)
                .get();
            this.ventas = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            console.log(`💰 ${this.ventas.length} ventas cargadas`);
        } catch (error) {
            console.error('Error cargando ventas:', error);

            // Detectar error de índice
            if (error.code === 'failed-precondition') {
                console.error(`
🔴 ÍNDICE FALTANTE: La colección 'sales' necesita un índice en el campo 'fecha'.
Visita: https://console.firebase.google.com/project/app-estanquillo/firestore/indexes
                `);
            }

            this.ventas = [];
        }
    }

    async obtenerConfiguracionHorario() {
        try {
            const configDoc = await window.db.collection('configuracion').doc('general').get();
            if (configDoc.exists) {
                const config = configDoc.data();
                return config.horarioComercial || {
                    horaInicio: '09:00',
                    horaFin: '07:00',
                    esDiaSiguiente: true
                };
            }
        } catch (error) {
            console.error('Error obteniendo configuración de horario:', error);
        }

        // Valores por defecto
        return {
            horaInicio: '09:00',
            horaFin: '07:00',
            esDiaSiguiente: true
        };
    }

    calcularDiaComercialActual(horario) {
        const { horaInicio, horaFin, esDiaSiguiente } = horario;
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

        // Si la hora actual es antes de la hora de inicio, retroceder un día
        if (ahora < inicio) {
            inicio.setDate(inicio.getDate() - 1);
            fin.setDate(fin.getDate() - 1);
        }

        return { inicio, fin };
    }

    filtrarVentasPorDiaComercial(ventas, inicio, fin) {
        return ventas.filter(venta => {
            const fechaVenta = venta.fecha?.toDate ? venta.fecha.toDate() : new Date(venta.fecha);
            return fechaVenta >= inicio && fechaVenta < fin;
        });
    }

    async buscarProductos(searchTerm) {
        if (!searchTerm || searchTerm.length < 1) {
            this.hideResultados();
            return;
        }

        const search = searchTerm.toLowerCase().trim();
        const resultados = [];

        this.productos.forEach(producto => {
            const nombreProducto = producto.nombre?.toLowerCase() || '';
            const codigoProducto = producto.codigo?.toLowerCase() || '';

            // Búsqueda inteligente con puntuación
            let puntuacion = 0;
            let coincide = false;

            // Coincidencia exacta en nombre (mayor prioridad)
            if (nombreProducto === search) {
                puntuacion = 1000;
                coincide = true;
            }
            // Comienza con el término de búsqueda
            else if (nombreProducto.startsWith(search)) {
                puntuacion = 500;
                coincide = true;
            }
            // Contiene el término de búsqueda
            else if (nombreProducto.includes(search)) {
                puntuacion = 300;
                coincide = true;
            }
            // Coincidencia en código de barras
            else if (codigoProducto.includes(search)) {
                puntuacion = 400;
                coincide = true;
            }
            // Búsqueda difusa (fuzzy) - permite errores de tipeo
            else if (this.fuzzyMatch(nombreProducto, search)) {
                puntuacion = 200;
                coincide = true;
            }

            // También buscar en códigos de variantes
            if (producto.tipo === 'variantes' && producto.variantes) {
                const variantesArray = Array.isArray(producto.variantes) 
                    ? producto.variantes 
                    : Object.values(producto.variantes || {});
                
                variantesArray.forEach(v => {
                    const nombreVariante = v.nombre?.toLowerCase() || '';
                    const codigoVariante = v.codigoBarras?.toLowerCase() || '';
                    
                    if (nombreVariante.includes(search) || codigoVariante.includes(search)) {
                        puntuacion = Math.max(puntuacion, 350);
                        coincide = true;
                    }

                    // Buscar en opciones
                    if (v.opciones) {
                        const opcionesArray = Array.isArray(v.opciones) 
                            ? v.opciones 
                            : Object.values(v.opciones || {});
                        opcionesArray.forEach(o => {
                            const nombreOpcion = o.nombre?.toLowerCase() || '';
                            const codigoOpcion = o.codigoBarras?.toLowerCase() || '';
                            if (nombreOpcion.includes(search) || codigoOpcion.includes(search)) {
                                puntuacion = Math.max(puntuacion, 350);
                                coincide = true;
                            }
                        });
                    }
                });
            }

            if (coincide) {
                const stockTotal = this.calcularStockTotal(producto);
                const tieneStock = stockTotal > 0;
                
                resultados.push({
                    producto,
                    stockTotal,
                    tieneStock,
                    puntuacion
                });
            }
        });

        // Ordenar por puntuación (mayor a menor) y luego por disponibilidad
        resultados.sort((a, b) => {
            if (a.tieneStock !== b.tieneStock) {
                return b.tieneStock ? 1 : -1; // Con stock primero
            }
            return b.puntuacion - a.puntuacion;
        });

        await this.mostrarResultados(resultados, search);
    }

    // Búsqueda difusa (fuzzy matching) - permite 1-2 caracteres de diferencia
    fuzzyMatch(text, search) {
        if (search.length < 3) return false;
        
        let searchIndex = 0;
        let matchCount = 0;
        
        for (let i = 0; i < text.length && searchIndex < search.length; i++) {
            if (text[i] === search[searchIndex]) {
                matchCount++;
                searchIndex++;
            }
        }
        
        // Permitir hasta 2 caracteres de diferencia
        const tolerance = Math.min(2, Math.floor(search.length / 3));
        return (search.length - matchCount) <= tolerance;
    }

    productoTieneStock(producto) {
        if (producto.tipo === 'simple') {
            return (producto.stock?.actual || 0) > 0;
        } else if (producto.tipo === 'variantes') {
            const variantesArray = Array.isArray(producto.variantes) 
                ? producto.variantes 
                : Object.values(producto.variantes || {});
            return variantesArray.some(v => {
                if (v.opciones) {
                    const opcionesArray = Array.isArray(v.opciones) 
                        ? v.opciones 
                        : Object.values(v.opciones || {});
                    return opcionesArray.some(o => (o.stock?.actual || 0) > 0);
                }
                return (v.stock?.actual || 0) > 0;
            });
        } else if (producto.tipo === 'conversion') {
            return (producto.stock?.actual || 0) > 0;
        }
        return false;
    }

    calcularStockTotal(producto) {
        if (producto.tipo === 'simple') {
            return producto.stock?.actual || 0;
        } else if (producto.tipo === 'variantes') {
            const variantesArray = Array.isArray(producto.variantes) 
                ? producto.variantes 
                : Object.values(producto.variantes || {});
            return variantesArray.reduce((sum, v) => {
                if (v.opciones) {
                    const opcionesArray = Array.isArray(v.opciones) 
                        ? v.opciones 
                        : Object.values(v.opciones || {});
                    return sum + opcionesArray.reduce((s, o) => s + (o.stock?.actual || 0), 0);
                }
                return sum + (v.stock?.actual || 0);
            }, 0);
        } else if (producto.tipo === 'conversion') {
            return producto.stock?.actual || 0;
        }
        return 0;
    }

    async mostrarResultados(resultados, searchTerm = '') {
        const dropdown = document.getElementById('productos-resultados');
        if (!dropdown) return;

        if (resultados.length === 0) {
            dropdown.innerHTML = `
                <div class="search-empty-state">
                    <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <circle cx="11" cy="11" r="8"></circle>
                        <path d="m21 21-4.35-4.35"></path>
                    </svg>
                    <p>No se encontraron productos</p>
                </div>
            `;
            dropdown.classList.add('active');
            return;
        }

        const tipoVenta = document.getElementById('tipo-venta').value;
        const selectClientePersonalizado = document.getElementById('select-cliente-personalizado');
        const clienteId = (tipoVenta === 'personalizado' && selectClientePersonalizado) ? selectClientePersonalizado.value : null;
        const formatter = window.currencyFormatter;

        // Separar productos con stock y sin stock
        const conStock = resultados.filter(r => r.tieneStock);
        const sinStock = resultados.filter(r => !r.tieneStock);

        let html = '';

        // Mostrar productos con stock primero
        if (conStock.length > 0) {
            const resultadosConPrecio = await Promise.all(conStock.slice(0, 8).map(async item => {
                return await this.renderProductoResultado(item, searchTerm, tipoVenta, clienteId, formatter, false);
            }));
            html += resultadosConPrecio.join('');
        }

        // Mostrar productos sin stock con separador visual
        if (sinStock.length > 0 && conStock.length > 0) {
            html += `
                <div class="search-separator">
                    <svg class="separator-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="15" y1="9" x2="9" y2="15"></line>
                        <line x1="9" y1="9" x2="15" y2="15"></line>
                    </svg>
                    <span>Sin stock disponible</span>
                </div>
            `;
        }

        if (sinStock.length > 0) {
            const resultadosSinStock = await Promise.all(sinStock.slice(0, 5).map(async item => {
                return await this.renderProductoResultado(item, searchTerm, tipoVenta, clienteId, formatter, true);
            }));
            html += resultadosSinStock.join('');
        }

        dropdown.innerHTML = html;
        dropdown.classList.add('active');
    }

    async renderProductoResultado(item, searchTerm, tipoVenta, clienteId, formatter, sinStock) {
        // Iconos SVG según tipo de producto
        const iconoSVG = this.getProductoIconoSVG(item.producto.tipo);
        
        // Resaltar coincidencias en el nombre
        const nombreResaltado = this.resaltarCoincidencias(item.producto.nombre, searchTerm);

        let precioMostrar = '';
        let badgeTipo = '';

        // Badge de tipo de producto
        if (item.producto.tipo === 'variantes') {
            badgeTipo = '<span class="producto-badge badge-variantes">Variantes</span>';
        } else if (item.producto.tipo === 'conversion') {
            badgeTipo = '<span class="producto-badge badge-conversion">Conversión</span>';
        }

        // Para productos simples, mostrar precio según tipo de venta
        if (item.producto.tipo === 'simple') {
            let precio = item.producto.precio?.publico || 0;

            if (tipoVenta === 'mayorista') {
                precio = item.producto.precio?.mayorista || item.producto.precio?.publico || 0;
            } else if (tipoVenta === 'personalizado' && clienteId) {
                const itemTemp = {
                    producto: item.producto,
                    tipo: 'simple'
                };
                const precioEspecial = await this.buscarPrecioEspecial(clienteId, itemTemp);
                if (precioEspecial !== null) {
                    precio = precioEspecial;
                }
            }

            precioMostrar = `<div class="producto-precio-value">${formatter ? formatter.format(precio) : '$' + precio.toFixed(2)}</div>`;
        } else if (item.producto.tipo === 'variantes') {
            if (tipoVenta === 'personalizado' && clienteId) {
                precioMostrar = '<div class="producto-precio-multi"><svg class="precio-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>Precios especiales</div>';
            } else {
                precioMostrar = '<div class="producto-precio-multi">Varios precios</div>';
            }
        } else {
            if (tipoVenta === 'personalizado' && clienteId) {
                precioMostrar = '<div class="producto-precio-multi"><svg class="precio-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>Precios especiales</div>';
            } else {
                precioMostrar = '<div class="producto-precio-multi">Varios precios</div>';
            }
        }

        const stockClass = sinStock ? 'sin-stock' : 'con-stock';
        const stockBadge = sinStock ? 
            '<span class="stock-badge stock-agotado"><svg class="stock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>Agotado</span>' :
            `<span class="stock-badge stock-disponible"><svg class="stock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>${item.stockTotal}</span>`;

        return `
            <div class="producto-card-modern ${stockClass}" onclick='${!sinStock ? `ventasModule.seleccionarProducto(${JSON.stringify(item.producto).replace(/'/g, "\\'")})` : ''}'>
                <div class="producto-icon-modern">
                    ${iconoSVG}
                </div>
                <div class="producto-info-modern">
                    <div class="producto-header-modern">
                        <div class="producto-nombre-modern">${nombreResaltado}</div>
                        ${badgeTipo}
                    </div>
                    <div class="producto-footer-modern">
                        ${stockBadge}
                        ${precioMostrar}
                    </div>
                </div>
                ${!sinStock ? `
                <div class="producto-action-modern">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                </div>
                ` : ''}
            </div>
        `;
    }

    getProductoIconoSVG(tipo) {
        const iconos = {
            'simple': `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                </svg>
            `,
            'variantes': `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="7" height="7"></rect>
                    <rect x="14" y="3" width="7" height="7"></rect>
                    <rect x="14" y="14" width="7" height="7"></rect>
                    <rect x="3" y="14" width="7" height="7"></rect>
                </svg>
            `,
            'conversion': `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="23 4 23 10 17 10"></polyline>
                    <polyline points="1 20 1 14 7 14"></polyline>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                </svg>
            `
        };
        return iconos[tipo] || iconos['simple'];
    }

    resaltarCoincidencias(texto, termino) {
        if (!termino || termino.length < 1) return texto;
        
        const regex = new RegExp(`(${this.escapeRegex(termino)})`, 'gi');
        return texto.replace(regex, '<mark>$1</mark>');
    }

    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    seleccionarProducto(producto) {
        this.hideResultados();

        if (producto.tipo === 'simple') {
            // Producto simple - agregar directamente
            const tipoVenta = document.getElementById('tipo-venta').value;
            const precio = tipoVenta === 'mayorista' 
                ? (producto.precio?.mayorista || producto.precio?.publico || 0)
                : (producto.precio?.publico || 0);

            this.agregarAlCarrito({
                producto,
                tipo: 'simple',
                stock: producto.stock?.actual || 0,
                precio,
                nombre: producto.nombre
            });
        } else {
            // Abrir modal de selección para variantes o conversiones
            this.abrirModalSeleccion(producto);
        }
    }

    abrirModalSeleccion(producto) {
        const modal = document.getElementById('modal-seleccion-producto');
        const title = document.getElementById('seleccion-producto-nombre');
        const content = document.getElementById('seleccion-producto-content');

        // Guardar referencia al producto en la instancia para que los botones puedan accederlo
        this._modalProducto = producto;

        title.textContent = producto.nombre;

        const tipoVenta = document.getElementById('tipo-venta').value;
        const fmt = v => window.currencyFormatter?.format(v) || '$' + Number(v).toFixed(2);

        if (producto.tipo === 'variantes') {
            const variantesArray = Array.isArray(producto.variantes)
                ? producto.variantes
                : Object.values(producto.variantes || {});

            content.innerHTML = variantesArray.map((variante, vIdx) => {
                const opcionesArray = variante.opciones
                    ? (Array.isArray(variante.opciones) ? variante.opciones : Object.values(variante.opciones || {}))
                    : [];

                if (opcionesArray.length > 0) {
                    // ── Variante con opciones: acordeón de dos niveles ──────────────
                    const opcionesHTML = opcionesArray.map((opcion, oIdx) => {
                        const stockOpcion = opcion.stock?.actual || 0;
                        const sinStock = stockOpcion === 0;
                        const precioOpcion = tipoVenta === 'mayorista'
                            ? (opcion.precio?.mayorista || variante.precio?.mayorista || variante.precio?.publico || 0)
                            : (opcion.precio?.publico || variante.precio?.publico || 0);

                        return `
                            <div class="opcion-seleccion ${sinStock ? 'sin-stock' : ''}"
                                ${!sinStock ? `onclick="ventasModule.seleccionarVarianteOpcion(${vIdx}, ${oIdx}, null, true)"` : ''}>
                                <div class="opcion-info">
                                    <div class="opcion-nombre">• ${opcion.nombre}</div>
                                    <div class="opcion-stock">Stock: ${stockOpcion}${sinStock ? ' (Agotado)' : ''}</div>
                                </div>
                                <div class="opcion-derecha">
                                    <span class="opcion-precio">${fmt(precioOpcion)}</span>
                                    ${!sinStock ? `
                                        <button class="btn-agregar-sel" id="bop-${vIdx}-${oIdx}"
                                            onclick="event.stopPropagation(); ventasModule.seleccionarVarianteOpcion(${vIdx}, ${oIdx}, 'bop-${vIdx}-${oIdx}')">
                                            + Agregar
                                        </button>
                                    ` : ''}
                                </div>
                            </div>
                        `;
                    }).join('');

                    return `
                        <div class="variante-grupo-sel" id="vg-${vIdx}">
                            <div class="variante-header-sel" onclick="document.getElementById('vg-${vIdx}').classList.toggle('abierto')">
                                <div class="variante-header-info-sel">
                                    <span class="variante-icono-sel">📦</span>
                                    <span class="variante-nombre-sel">${variante.nombre}</span>
                                    <span class="variante-badge-opciones">${opcionesArray.length} opciones</span>
                                </div>
                                <svg class="variante-chevron-sel" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="6 9 12 15 18 9"></polyline>
                                </svg>
                            </div>
                            <div class="variante-opciones-panel-sel">
                                ${opcionesHTML}
                            </div>
                        </div>
                    `;
                } else {
                    // ── Variante sin opciones: fila directa con botón Agregar ──────
                    const stockVariante = variante.stock?.actual || 0;
                    const sinStock = stockVariante === 0;
                    const precio = tipoVenta === 'mayorista'
                        ? (variante.precio?.mayorista || variante.precio?.publico || 0)
                        : (variante.precio?.publico || 0);

                    return `
                        <div class="variante-seleccion ${sinStock ? 'sin-stock' : ''}"
                            ${!sinStock ? `onclick="ventasModule.seleccionarVariante(${vIdx}, null, true)"` : ''}>
                            <div class="variante-info">
                                <div class="variante-nombre">📦 ${variante.nombre}</div>
                                <div class="variante-stock">Stock: ${stockVariante}${sinStock ? ' (Agotado)' : ''}</div>
                            </div>
                            <div class="opcion-derecha">
                                <span class="variante-precio">${fmt(precio)}</span>
                                ${!sinStock ? `
                                    <button class="btn-agregar-sel" id="bv-${vIdx}"
                                        onclick="event.stopPropagation(); ventasModule.seleccionarVariante(${vIdx}, 'bv-${vIdx}')">
                                        + Agregar
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    `;
                }
            }).join('');

        } else if (producto.tipo === 'conversion') {
            const conversionesArray = Array.isArray(producto.conversiones)
                ? producto.conversiones
                : Object.values(producto.conversiones || {});

            content.innerHTML = conversionesArray.map((conversion, cIdx) => {
                const stockDisponible = Math.floor((producto.stock?.actual || 0) / conversion.cantidad);
                const sinStock = stockDisponible === 0;
                const precio = tipoVenta === 'mayorista'
                    ? (conversion.precio?.mayorista || conversion.precio?.publico || 0)
                    : (conversion.precio?.publico || 0);

                return `
                    <div class="conversion-seleccion ${sinStock ? 'sin-stock' : ''}"
                        ${!sinStock ? `onclick="ventasModule.seleccionarConversion(${cIdx}, null, true)"` : ''}>
                        <div class="conversion-info">
                            <div class="conversion-nombre">🔄 ${conversion.tipo}</div>
                            <div class="conversion-stock">
                                ${conversion.cantidad} ${producto.unidadBase} | Stock: ${stockDisponible}${sinStock ? ' (Agotado)' : ''}
                            </div>
                        </div>
                        <div class="opcion-derecha">
                            <span class="conversion-precio">${fmt(precio)}</span>
                            ${!sinStock ? `
                                <button class="btn-agregar-sel" id="bc-${cIdx}"
                                    onclick="event.stopPropagation(); ventasModule.seleccionarConversion(${cIdx}, 'bc-${cIdx}')">
                                    + Agregar
                                </button>
                            ` : ''}
                        </div>
                    </div>
                `;
            }).join('');
        }

        modal.classList.add('active');
        document.getElementById('pos-search').value = '';
    }

    // Flash visual en botón de agregar para confirmar sin cerrar el modal
    _flashBtnAgregar(btnId) {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        const original = btn.innerHTML;
        btn.innerHTML = '✓';
        btn.classList.add('btn-agregar-sel--ok');
        setTimeout(() => {
            btn.innerHTML = original;
            btn.classList.remove('btn-agregar-sel--ok');
        }, 800);
    }

    seleccionarVariante(varianteIndex, btnId, cerrar = false) {
        const producto = this._modalProducto;
        if (!producto) return;

        const variantesArray = Array.isArray(producto.variantes)
            ? producto.variantes
            : Object.values(producto.variantes || {});
        const variante = variantesArray[varianteIndex];
        const tipoVenta = document.getElementById('tipo-venta').value;
        const precio = tipoVenta === 'mayorista'
            ? (variante.precio?.mayorista || variante.precio?.publico || 0)
            : (variante.precio?.publico || 0);

        this.agregarAlCarrito({
            producto,
            tipo: 'variante-simple',
            varianteIndex,
            variante,
            stock: variante.stock?.actual || 0,
            precio,
            nombre: `${producto.nombre} - ${variante.nombre}`
        });

        if (btnId) this._flashBtnAgregar(btnId);
        if (cerrar) this.cerrarModalSeleccion();
    }

    seleccionarVarianteOpcion(varianteIndex, opcionIndex, btnId, cerrar = false) {
        const producto = this._modalProducto;
        if (!producto) return;

        const variantesArray = Array.isArray(producto.variantes)
            ? producto.variantes
            : Object.values(producto.variantes || {});
        const variante = variantesArray[varianteIndex];
        const opcionesArray = Array.isArray(variante.opciones)
            ? variante.opciones
            : Object.values(variante.opciones || {});
        const opcion = opcionesArray[opcionIndex];
        const tipoVenta = document.getElementById('tipo-venta').value;
        const precio = tipoVenta === 'mayorista'
            ? (opcion.precio?.mayorista || variante.precio?.mayorista || variante.precio?.publico || 0)
            : (opcion.precio?.publico || variante.precio?.publico || 0);

        this.agregarAlCarrito({
            producto,
            tipo: 'variante-opcion',
            varianteIndex,
            opcionIndex,
            variante,
            opcion,
            stock: opcion.stock?.actual || 0,
            precio,
            nombre: `${producto.nombre} - ${variante.nombre} - ${opcion.nombre}`
        });

        if (btnId) this._flashBtnAgregar(btnId);
        if (cerrar) this.cerrarModalSeleccion();
    }

    seleccionarConversion(conversionIndex, btnId, cerrar = false) {
        const producto = this._modalProducto;
        if (!producto) return;

        const conversionesArray = Array.isArray(producto.conversiones)
            ? producto.conversiones
            : Object.values(producto.conversiones || {});
        const conversion = conversionesArray[conversionIndex];
        const stockDisponible = Math.floor((producto.stock?.actual || 0) / conversion.cantidad);
        const tipoVenta = document.getElementById('tipo-venta').value;
        const precio = tipoVenta === 'mayorista'
            ? (conversion.precio?.mayorista || conversion.precio?.publico || 0)
            : (conversion.precio?.publico || 0);

        this.agregarAlCarrito({
            producto,
            tipo: 'conversion',
            conversionIndex,
            conversion,
            stock: stockDisponible,
            precio,
            nombre: `${producto.nombre} - ${conversion.tipo} (${conversion.cantidad} ${producto.unidadBase})`
        });

        if (btnId) this._flashBtnAgregar(btnId);
        if (cerrar) this.cerrarModalSeleccion();
    }

    cerrarModalSeleccion() {
        document.getElementById('modal-seleccion-producto').classList.remove('active');
        this._modalProducto = null;
    }

    hideResultados() {
        const dropdown = document.getElementById('productos-resultados');
        if (dropdown) {
            dropdown.classList.remove('active');
        }
    }

    async buscarPrecioEspecial(clienteId, item) {
        try {
            const query = window.db.collection('customPrices')
                .where('clienteId', '==', clienteId)
                .where('productoId', '==', item.producto.id)
                .where('activo', '==', true);

            const snapshot = await query.get();

            if (snapshot.empty) return null;

            // Buscar el precio que coincida exactamente con la configuración del item
            for (const doc of snapshot.docs) {
                const precio = doc.data();

                // Producto simple
                if (item.tipo === 'simple' && precio.tipoProducto === 'simple') {
                    console.log(`✅ Precio especial encontrado para producto simple: ${precio.precioEspecial}`);
                    return precio.precioEspecial;
                }

                // Variante sin opción
                if (item.tipo === 'variante-simple' && 
                    precio.varianteIndex === item.varianteIndex &&
                    precio.opcionIndex === undefined) {
                    console.log(`✅ Precio especial encontrado para variante simple: ${precio.precioEspecial}`);
                    return precio.precioEspecial;
                }

                // Variante con opción
                if (item.tipo === 'variante-opcion' &&
                    precio.varianteIndex === item.varianteIndex &&
                    precio.opcionIndex === item.opcionIndex) {
                    console.log(`✅ Precio especial encontrado para variante-opción: ${precio.precioEspecial}`);
                    return precio.precioEspecial;
                }

                // Conversión
                if (item.tipo === 'conversion' &&
                    precio.conversionIndex === item.conversionIndex) {
                    console.log(`✅ Precio especial encontrado para conversión: ${precio.precioEspecial}`);
                    return precio.precioEspecial;
                }
            }

            return null;
        } catch (error) {
            console.error('Error buscando precio especial:', error);
            return null;
        }
    }

    async agregarAlCarrito(item) {
        const tipoVenta = document.getElementById('tipo-venta').value;
        let precioFinal = item.precio; // Precio base (público)

        // 1. Si es tipo de venta PERSONALIZADO
        if (tipoVenta === 'personalizado') {
            const selectClientePersonalizado = document.getElementById('select-cliente-personalizado');
            const clienteId = selectClientePersonalizado ? selectClientePersonalizado.value : null;

            if (clienteId && item.producto?.id) {
                const precioEspecial = await this.buscarPrecioEspecial(clienteId, item);
                if (precioEspecial !== null) {
                    precioFinal = precioEspecial;
                    console.log(`⭐ Usando precio personalizado: ${precioFinal} para cliente ${clienteId}`);
                }
            }
        }
        // 2. Si es tipo de venta MAYORISTA
        else if (tipoVenta === 'mayorista') {
            const precioMayorista = item.producto.precio?.mayorista || item.precio;
            if (precioMayorista !== null) {
                precioFinal = precioMayorista;
            }
        }
        // 3. Si es PÚBLICO, usa el precio base (ya asignado)


        // Buscar si ya existe en el carrito
        const existente = this.carrito.find(c => 
            c.producto.id === item.producto.id && 
            c.tipo === item.tipo &&
            (item.tipo === 'variante-opcion' ? c.opcionIndex === item.opcionIndex && c.varianteIndex === item.varianteIndex : true) &&
            (item.tipo === 'variante-simple' ? c.varianteIndex === item.varianteIndex : true) &&
            (item.tipo === 'conversion' ? c.conversionIndex === item.conversionIndex : true)
        );

        if (existente) {
            if (existente.cantidad < item.stock) {
                existente.cantidad++;
                existente.precioUnitario = precioFinal; // Asegurar que el precio se actualice si cambia
                existente.subtotal = existente.cantidad * existente.precioUnitario;
            } else {
                alert('Stock insuficiente');
                return;
            }
        } else {
            this.carrito.push({
                ...item,
                cantidad: 1,
                precioUnitario: precioFinal,
                subtotal: precioFinal
            });
        }

        this.renderCarrito();
        this.hideResultados();
        document.getElementById('pos-search').value = '';
    }

    renderCarrito() {
        const container = document.getElementById('carrito-items');
        const btnProcesar = document.getElementById('btn-procesar-venta');

        if (this.carrito.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="9" cy="21" r="1"></circle>
                            <circle cx="20" cy="21" r="1"></circle>
                            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                        </svg>
                    </div>
                    <p>El carrito está vacío</p>
                </div>
            `;
            btnProcesar.disabled = true;
            this.actualizarTotales();
            this.guardarCarritos(); // Guardar cambios
            this.renderCarritosTabs(); // Actualizar pestañas
            return;
        }

        // Mostrar más reciente primero — el último agregado aparece arriba
        const carritoRevertido = [...this.carrito].reverse();
        const lastIdx = this.carrito.length - 1; // índice del más reciente en el array original

        container.innerHTML = carritoRevertido.map((item, revIdx) => {
            const idx = this.carrito.length - 1 - revIdx; // índice original para cambiarCantidad/eliminar
            const esUltimo = idx === lastIdx; // resaltar el último agregado

            return `
            <div class="carrito-item ${this.modoEdicionPreciosActivo ? 'modo-edicion' : ''} ${esUltimo ? 'carrito-item--activo' : ''}">
                <div style="flex: 1;">
                    <div class="carrito-item-info">
                        <div class="carrito-item-nombre">
                            ${esUltimo ? '<span class="carrito-item-activo-dot" title="↑↓ para cantidad"></span>' : ''}
                            ${item.nombre}
                        </div>
                        <div class="carrito-item-detalle">Stock: ${item.stock}</div>
                    </div>
                    <div class="carrito-item-cantidad">
                        <button class="cantidad-btn" onclick="ventasModule.cambiarCantidad(${idx}, -1)">-</button>
                        <span class="cantidad-valor">${item.cantidad}</span>
                        <button class="cantidad-btn" onclick="ventasModule.cambiarCantidad(${idx}, 1)">+</button>
                    </div>
                    ${this.modoEdicionPreciosActivo ? `
                        <div class="precio-editable-container">
                            <label style="font-size: 0.75rem; color: #666;">Precio Unit.:</label>
                            <input 
                                type="number" 
                                class="precio-editable-input"
                                value="${item.precioUnitario}"
                                step="100"
                                min="0"
                                onchange="ventasModule.editarPrecioItem(${idx}, this.value)"
                                style="width: 100px; padding: 4px 8px; border: 2px solid #FF9500; border-radius: 6px;"
                            >
                        </div>
                    ` : ''}
                </div>
                <div style="text-align: right;">
                    <div class="carrito-item-precio">${window.currencyFormatter?.format(item.subtotal) || '$' + item.subtotal.toFixed(2)}</div>
                    ${this.modoEdicionPreciosActivo ? `<div style="font-size: 0.7rem; color: #FF9500;">✏️ Editable</div>` : ''}
                    <button class="btn-remove-item" onclick="ventasModule.eliminarDelCarrito(${idx})">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                    </button>
                </div>
            </div>
        `;
        }).join('');

        // Solo habilitar si hay caja abierta Y hay items en carrito
        btnProcesar.disabled = !this.cajaAbierta || this.carrito.length === 0;
        this.actualizarTotales();
        this.actualizarEstadoVentas(); // Actualizar estado según caja
        this.guardarCarritos(); // Guardar cambios automáticamente
        this.renderCarritosTabs(); // Actualizar pestañas con nuevos contadores
    }

    cambiarCantidad(index, cambio) {
        const item = this.carrito[index];
        const nuevaCantidad = item.cantidad + cambio;

        if (nuevaCantidad <= 0) {
            this.eliminarDelCarrito(index);
            return;
        }

        if (nuevaCantidad > item.stock) {
            alert('Stock insuficiente');
            return;
        }

        item.cantidad = nuevaCantidad;
        item.subtotal = item.cantidad * item.precioUnitario;
        this.renderCarrito();
    }

    eliminarDelCarrito(index) {
        this.carrito.splice(index, 1);
        this.renderCarrito();
    }

    editarPrecioItem(index, nuevoPrecio) {
        if (!this.modoEdicionPreciosActivo) {
            alert('⚠️ No tienes autorización para editar precios');
            this.renderCarrito();
            return;
        }

        const precio = parseFloat(nuevoPrecio);
        if (isNaN(precio) || precio < 0) {
            alert('❌ Precio inválido');
            this.renderCarrito();
            return;
        }

        const item = this.carrito[index];
        const precioAnterior = item.precioUnitario;

        item.precioUnitario = precio;
        item.subtotal = item.cantidad * precio;

        console.log(`💰 Precio editado: ${item.nombre} - $${precioAnterior} → $${precio}`);
        
        this.renderCarrito();
        this.showNotification(`✅ Precio actualizado: ${item.nombre}`, 'success');
    }

    limpiarCarrito() {
        if (this.carrito.length === 0) return;

        if (confirm('¿Limpiar todo el carrito?')) {
            // 🔐 SI ES EL CARRITO AUTORIZADO, DESACTIVAR SESIÓN (comparar como strings)
            const carritoActualId = String(this.carritos[this.carritoActivo]?.id || '');
            if (this.carritoAutorizadoId && carritoActualId === this.carritoAutorizadoId) {
                this.desactivarSesionActual('Carrito limpiado');
            }

            this.carrito = [];
            this.renderCarrito();
        }
    }

    actualizarTotales() {
        const subtotal = this.carrito.reduce((sum, item) => sum + item.subtotal, 0);

        document.getElementById('carrito-subtotal').textContent = 
            window.currencyFormatter?.format(subtotal) || '$' + subtotal.toFixed(2);

        document.getElementById('carrito-total').textContent = 
            window.currencyFormatter?.format(subtotal) || '$' + subtotal.toFixed(2);
    }

    async actualizarPreciosCarrito() {
        const tipoVenta = document.getElementById('tipo-venta').value;

        // Usar Promise.all para esperar que todos los precios se actualicen
        await Promise.all(this.carrito.map(async (item) => {
            let precioBase = item.precio; // Precio público por defecto

            // 1. Si es tipo de venta PERSONALIZADO
            if (tipoVenta === 'personalizado') {
                const selectClientePersonalizado = document.getElementById('select-cliente-personalizado');
                const clienteId = selectClientePersonalizado ? selectClientePersonalizado.value : null;

                if (clienteId && item.producto?.id) {
                    const precioEspecial = await this.buscarPrecioEspecial(clienteId, item);
                    if (precioEspecial !== null) {
                        precioBase = precioEspecial;
                        console.log(`⭐ Precio personalizado aplicado en carrito: ${precioBase}`);
                    }
                }
            }
            // 2. Si es tipo de venta MAYORISTA
            else if (tipoVenta === 'mayorista') {
                precioBase = item.producto.precio?.mayorista || item.precio;
            }
            // 3. Si es PÚBLICO, usa el precio base (ya asignado)

            item.precioUnitario = precioBase;
            item.subtotal = item.cantidad * precioBase;
        }));

        // Renderizar carrito después de actualizar todos los precios
        this.renderCarrito();
    }

    async procesarVenta() {
        console.log('🔍 DEBUG - Iniciando procesarVenta');
        console.log('📊 Estado del carrito:', {
            carritoActivo: this.carritoActivo,
            totalCarritos: this.carritos.length,
            carritoLength: this.carrito?.length,
            carritoItems: this.carrito
        });

        // 1. SINCRONIZAR CARRITO ACTIVO ANTES DE VALIDAR (CRÍTICO FIX)
        // Validar que tenemos carrito y que el índice es válido
        if (this.carritos && this.carritos.length > 0 && this.carritoActivo >= 0 && this.carritoActivo < this.carritos.length) {
            const carritoData = this.carritos[this.carritoActivo];
            if (carritoData && carritoData.items) {
                this.carrito = [...carritoData.items]; // Hacer copia para evitar problemas de referencia
                console.log('🔄 Carrito sincronizado con datos guardados:', this.carrito.length, 'items');
            }
        } else {
            console.error('❌ ERROR: Estado de carritos inválido:', {
                carritos: this.carritos?.length,
                carritoActivo: this.carritoActivo,
                indices_válidos: this.carritos?.length > 0
            });
        }

        // 2. Evitar procesamiento múltiple
        const btnProcesar = document.getElementById('btn-procesar-venta');
        if (btnProcesar?.disabled) {
            console.log('⚠️ Venta ya en proceso, ignorando click duplicado');
            return;
        }

        // 3. VALIDAR CAJA ABIERTA (CRÍTICO)
        if (!this.cajaAbierta) {
            alert('❌ No puedes procesar ventas sin una caja abierta.\n\nPor favor, abre una caja en el módulo de Caja antes de realizar ventas.');
            console.log('⚠️ Intento de venta sin caja abierta bloqueado');
            return;
        }

        // 4. VALIDAR CARRITO (después de sincronizar)
        if (!this.carrito || this.carrito.length === 0) {
            console.log('⚠️ Carrito vacío detectado:', {
                carrito: this.carrito,
                length: this.carrito?.length,
                estado: this.carritos[this.carritoActivo]
            });
            alert('❌ El carrito está vacío. Agrega productos antes de procesar la venta.');
            return;
        }

        // 3. VALIDAR FORMULARIO
        const metodo = document.getElementById('metodo-venta')?.value;
        const tipoVenta = document.getElementById('tipo-venta')?.value;

        if (!metodo || !tipoVenta) {
            alert('❌ Error: Selecciona el método de pago y tipo de venta');
            return;
        }

        // 4. SI ES EFECTIVO, ABRIR MODAL DE CAMBIO
        if (metodo === 'efectivo') {
            this.abrirModalEfectivo();
            return;
        }

        // Si NO es efectivo, mostrar confirmación antes de procesar
        this.mostrarConfirmacionVenta(metodo);
    }

    abrirModalEfectivo() {
        const modal = document.getElementById('modal-efectivo');
        const total = this.carrito.reduce((sum, item) => sum + (item.subtotal || 0), 0);
        const formatter = window.currencyFormatter;

        // Mostrar total
        document.getElementById('efectivo-total-display').textContent = 
            formatter ? formatter.format(total) : '$' + total.toFixed(2);

        // Resetear campos
        document.getElementById('efectivo-monto-recibido').value = '';
        document.getElementById('efectivo-cambio-display').textContent = 
            formatter ? formatter.format(0) : '$0.00';
        document.getElementById('cambio-status').textContent = '';
        document.getElementById('btn-confirmar-efectivo').disabled = true;

        const cambioCard = document.getElementById('cambio-card');
        cambioCard.classList.remove('insuficiente', 'exacto');

        // Event listeners para botones rápidos
        document.querySelectorAll('.btn-monto-rapido').forEach(btn => {
            btn.onclick = () => {
                const monto = parseFloat(btn.dataset.monto);
                document.getElementById('efectivo-monto-recibido').value = monto;
                this.calcularCambio();
            };
        });

        // Event listener para input de monto recibido
        const inputMonto = document.getElementById('efectivo-monto-recibido');
        inputMonto.oninput = () => this.calcularCambio();

        // Event listeners para botones del modal
        document.getElementById('btn-cancelar-efectivo').onclick = () => {
            modal.classList.remove('active');
        };

        document.getElementById('modal-efectivo-close').onclick = () => {
            modal.classList.remove('active');
        };

        document.getElementById('btn-confirmar-efectivo').onclick = async () => {
            modal.classList.remove('active');
            await this.confirmarVenta();
        };

        modal.classList.add('active');
        setTimeout(() => inputMonto.focus(), 300);
    }

    calcularCambio() {
        const total = this.carrito.reduce((sum, item) => sum + (item.subtotal || 0), 0);
        const montoRecibido = parseFloat(document.getElementById('efectivo-monto-recibido').value) || 0;
        const cambio = montoRecibido - total;
        const formatter = window.currencyFormatter;

        const cambioCard = document.getElementById('cambio-card');
        const cambioDisplay = document.getElementById('efectivo-cambio-display');
        const cambioStatus = document.getElementById('cambio-status');
        const btnConfirmar = document.getElementById('btn-confirmar-efectivo');

        cambioDisplay.textContent = formatter ? formatter.format(Math.abs(cambio)) : '$' + Math.abs(cambio).toFixed(2);

        if (cambio < 0) {
            // Monto insuficiente
            cambioCard.classList.add('insuficiente');
            cambioCard.classList.remove('exacto');
            cambioStatus.textContent = '⚠️ Monto insuficiente';
            btnConfirmar.disabled = true;
        } else if (cambio === 0) {
            // Monto exacto
            cambioCard.classList.add('exacto');
            cambioCard.classList.remove('insuficiente');
            cambioStatus.textContent = '✓ Monto exacto';
            btnConfirmar.disabled = false;
        } else {
            // Cambio a devolver
            cambioCard.classList.remove('insuficiente', 'exacto');
            cambioStatus.textContent = '✓ Devolver cambio al cliente';
            btnConfirmar.disabled = false;
        }
    }

    async confirmarVenta() {
        const btnProcesar = document.getElementById('btn-procesar-venta');
        const metodo = document.getElementById('metodo-venta')?.value;
        const tipoVenta = document.getElementById('tipo-venta')?.value;

        // DESHABILITAR BOTÓN INMEDIATAMENTE para evitar clics duplicados
        if (btnProcesar) {
            btnProcesar.disabled = true;
            btnProcesar.innerHTML = '<span>Procesando...</span>';
        }

        // CLONAR CARRITO (ahora sabemos que tiene items)
        const itemsVenta = JSON.parse(JSON.stringify(this.carrito));

        let clienteData = null;

        // 4. OBTENER CLIENTE (puede ser de tipo personalizado o de crédito)
        if (tipoVenta === 'personalizado') {
            const selectClientePersonalizado = document.getElementById('select-cliente-personalizado');
            const clienteId = selectClientePersonalizado?.value;
            
            if (!clienteId) {
                alert('❌ Debes seleccionar un cliente para venta con precio personalizado');
                if (btnProcesar) {
                    btnProcesar.disabled = false;
                    btnProcesar.textContent = 'Procesar Venta';
                }
                return;
            }

            const cliente = this.clientes.find(c => c.id === clienteId);
            if (!cliente) {
                alert('❌ Cliente no encontrado');
                if (btnProcesar) {
                    btnProcesar.disabled = false;
                    btnProcesar.textContent = 'Procesar Venta';
                }
                return;
            }

            clienteData = {
                id: clienteId,
                nombre: cliente.nombre,
                tipo: metodo === 'credito' ? 'credito' : 'personalizado'
            };
        } else if (metodo === 'credito') {
            // Solo para crédito sin tipo personalizado
            const selectClienteCredito = document.getElementById('select-cliente-credito');
            const clienteId = selectClienteCredito?.value;
            
            if (!clienteId) {
                alert('❌ Debes seleccionar un cliente para venta a crédito');
                if (btnProcesar) {
                    btnProcesar.disabled = false;
                    btnProcesar.textContent = 'Procesar Venta';
                }
                return;
            }

            const cliente = this.clientes.find(c => c.id === clienteId);
            if (!cliente) {
                alert('❌ Cliente no encontrado');
                if (btnProcesar) {
                    btnProcesar.disabled = false;
                    btnProcesar.textContent = 'Procesar Venta';
                }
                return;
            }

            clienteData = {
                id: clienteId,
                nombre: cliente.nombre,
                tipo: 'credito'
            };
        }

        // 5. CALCULAR TOTAL Y UTILIDAD
        const total = itemsVenta.reduce((sum, item) => sum + (item.subtotal || 0), 0);

        if (total <= 0) {
            alert('❌ El total de la venta debe ser mayor a cero');
            return;
        }

        // Calcular utilidad de la venta antes de guardar
        let utilidadVenta = 0;
        for (const item of itemsVenta) {
            const producto = this.productos.find(p => p.id === item.producto?.id);
            if (!producto) continue;

            let costo = 0;
            const precioVenta = item.precioUnitario || 0;

            if (item.tipo === 'simple') {
                costo = producto.precio?.costo || 0;

            } else if (item.tipo === 'variante-simple' || item.tipo === 'variante' || item.tipo === 'variante-opcion') {
                const variantesArray = Array.isArray(producto.variantes)
                    ? producto.variantes
                    : Object.values(producto.variantes || {});
                const variante = variantesArray[item.varianteIndex];

                if (item.opcionIndex !== undefined && variante?.opciones) {
                    // variante-opcion: costo de la opción específica
                    const opcionesArray = Array.isArray(variante.opciones)
                        ? variante.opciones
                        : Object.values(variante.opciones || {});
                    const opcion = opcionesArray[item.opcionIndex];
                    costo = opcion?.precio?.costo || variante?.precio?.costo || 0;
                } else {
                    // variante-simple: costo de la variante
                    costo = variante?.precio?.costo || 0;
                }

            } else if (item.tipo === 'conversion') {
                const conversionesArray = Array.isArray(producto.conversiones)
                    ? producto.conversiones
                    : Object.values(producto.conversiones || {});
                const conversion = conversionesArray[item.conversionIndex];
                // El costo real de cada conversión está en conversion.precio.costo.
                // No usar producto.precio.costo (es null para conversiones por diseño).
                costo = conversion?.precio?.costo || 0;
            }

            utilidadVenta += (precioVenta - costo) * (item.cantidad || 1);
        }

        // 6. MOSTRAR LOADING
        const loadingOverlay = document.getElementById('loading-overlay-ventas');
        if (loadingOverlay) loadingOverlay.classList.add('active');

        try {
            console.log('🔄 Iniciando procesamiento de venta...', {
                total,
                items: itemsVenta.length,
                metodo,
                tipoVenta
            });

            // 7. PREPARAR ESTRUCTURA DE VENTA (Compatible con reglas de Firestore)
            const folio = `V-${Date.now()}`;
            const ahora = new Date();

            const venta = {
                // ✅ Campos requeridos por Firestore rules
                folio: folio,
                fecha: firebase.firestore.Timestamp.fromDate(ahora),
                productos: itemsVenta.map(item => {
                    const producto = {
                        productoId: item.producto?.id || 'unknown',
                        nombre: item.nombre || 'Producto sin nombre',
                        cantidad: item.cantidad || 0,
                        precioUnitario: item.precioUnitario || 0,
                        subtotal: item.subtotal || 0,
                        tipo: item.tipo || 'simple',
                        costo: 0
                    };

                    // Obtener costo del producto para guardarlo
                    const prod = this.productos.find(p => p.id === item.producto?.id);
                    if (prod) {
                        if (item.tipo === 'simple') {
                            producto.costo = prod.precio?.costo || 0;
                        } else if (item.tipo === 'variante-simple' || item.tipo === 'variante' || item.tipo === 'variante-opcion') {
                            const variantesArr = Array.isArray(prod.variantes) ? prod.variantes : Object.values(prod.variantes || {});
                            const variante = variantesArr[item.varianteIndex];
                            if (item.opcionIndex !== undefined && variante?.opciones) {
                                // variante-opcion: usar el costo de la opción específica
                                const opcionesArr = Array.isArray(variante.opciones) ? variante.opciones : Object.values(variante.opciones || {});
                                producto.costo = opcionesArr[item.opcionIndex]?.precio?.costo || variante?.precio?.costo || 0;
                            } else {
                                // variante-simple: usar el costo de la variante
                                producto.costo = variante?.precio?.costo || 0;
                            }
                        } else if (item.tipo === 'conversion') {
                            const conversionesArr = Array.isArray(prod.conversiones) ? prod.conversiones : Object.values(prod.conversiones || {});
                            producto.costo = conversionesArr[item.conversionIndex]?.precio?.costo || 0;
                        }
                    }

                    // Solo agregar índices si existen (no undefined)
                    if (item.varianteIndex !== undefined) producto.varianteIndex = item.varianteIndex;
                    if (item.opcionIndex !== undefined) producto.opcionIndex = item.opcionIndex;
                    if (item.conversionIndex !== undefined) producto.conversionIndex = item.conversionIndex;

                    return producto;
                }),
                total: total,
                utilidad: utilidadVenta,
                estado: metodo === 'credito' ? 'pendiente' : 'completada',

                // Campos adicionales SIN undefined
                vendedor: (window.authSystem?.currentUser?.nombre) || 'Sistema',
                vendedorId: (window.authSystem?.currentUser?.uid) || 'system',
                cliente: clienteData || {},
                tipoVenta: tipoVenta,
                tipoPago: metodo,
                metodoPago: metodo,
                saldoPendiente: metodo === 'credito' ? total : 0,
                abonos: [],
                metadata: {
                    createdAt: firebase.firestore.Timestamp.fromDate(ahora),
                    createdBy: (window.authSystem?.currentUser?.uid) || 'system'
                }
            };

            // Validar estructura antes de enviar
            console.log('📋 Estructura de venta a guardar:', {
                campos: Object.keys(venta),
                productosCount: venta.productos.length,
                total: venta.total
            });

            // 8. GUARDAR VENTA EN FIRESTORE
            console.log('💾 ========== GUARDANDO VENTA EN FIRESTORE ==========');
            console.log('📋 Estructura de venta a guardar:', JSON.stringify({
                folio: venta.folio,
                estado: venta.estado,
                total: venta.total,
                metodoPago: venta.metodoPago,
                tipoPago: venta.tipoPago,
                vendedorId: venta.vendedorId,
                productosCount: venta.productos.length,
                fecha: venta.fecha.toDate().toISOString()
            }, null, 2));

            const ventaRef = await window.db.collection('sales').add(venta);
            console.log('✅ Venta guardada con ID:', ventaRef.id);

            // VERIFICACIÓN INMEDIATA: Leer la venta recién guardada
            const ventaGuardada = await ventaRef.get();
            console.log('🔍 VERIFICACIÓN - Venta guardada en Firebase:', {
                id: ventaGuardada.id,
                estado: ventaGuardada.data().estado,
                total: ventaGuardada.data().total,
                metodoPago: ventaGuardada.data().metodoPago,
                tipoPago: ventaGuardada.data().tipoPago
            });
            console.log('===================================================');

            // 9. ACTUALIZAR INVENTARIO
            console.log('📦 Actualizando inventario...');
            await this.actualizarInventario(itemsVenta);
            console.log('✅ Inventario actualizado');

            // 10. DESACTIVAR SESIÓN DE EDICIÓN SI ESTÁ ACTIVA
            if (this.modoEdicionPreciosActivo && this.sesionActualId) {
                await window.db.collection('sesiones_precio_temporal').doc(this.sesionActualId).update({
                    activo: false,
                    fechaDesactivacion: firebase.firestore.Timestamp.now()
                });
                console.log('🔒 Sesión de edición desactivada automáticamente');
            }

            // 11. LIMPIAR EL CARRITO ACTIVO (después de confirmar todo)
            this.carrito = [];
            if (this.carritos[this.carritoActivo]) {
                this.carritos[this.carritoActivo].items = [];
            }
            this.guardarCarritos();
            this.renderCarrito();
            this.renderCarritosTabs();

            // 11. RECARGAR DATOS
            await this.cargarVentas();
            await this.cargarProductos(); // Recargar productos con stock actualizado
            this.actualizarEstadisticas();

            // 12. NOTIFICAR ÉXITO
            this.showNotification('✅ Venta exitosa', 'success');
            console.log('✅ Venta completada:', folio);

            // 13. REGISTRAR INGRESO EN CAJA MAYOR (si es transferencia o tarjeta)
            if (metodo === 'transferencia' || metodo === 'tarjeta') {
                console.log(`💳 Venta con ${metodo} detectada - registrando ingreso en Caja Mayor...`);
                
                try {
                    const userId = window.authSystem?.currentUser?.uid;
                    const userName = window.authSystem?.currentUser?.nombre || 'Sistema';
                    
                    const ingresoData = {
                        tipo: 'ingreso',
                        concepto: `Venta ${folio} - ${metodo === 'transferencia' ? 'Transferencia' : 'Tarjeta'}`,
                        monto: total,
                        categoria: metodo === 'transferencia' ? 'transferencia-venta' : 'tarjeta-venta',
                        observaciones: `Venta automática. Cliente: ${clienteData?.nombre || 'Público general'}. Vendedor: ${userName}`,
                        fecha: firebase.firestore.Timestamp.fromDate(ahora),
                        registradoPor: userId,
                        registradoPorNombre: userName,
                        origenVenta: ventaRef.id,
                        folio: folio
                    };

                    await window.db.collection('pagos').add(ingresoData);
                    console.log(`✅ Ingreso automático registrado en Caja Mayor: ${window.currencyFormatter ? window.currencyFormatter.format(total) : '$' + total.toFixed(2)}`);
                } catch (errorPagos) {
                    console.error('⚠️ Error registrando ingreso en Caja Mayor:', errorPagos);
                    // No bloqueamos la venta si falla el registro en Pagos
                    this.showNotification('⚠️ Venta completada, pero falló registro en Caja Mayor', 'warning');
                }
            }

            // 14. NOTIFICAR VENTA COMPLETADA (Sistema de eventos global)
            console.log('📡 Emitiendo evento global: venta completada');

            // Emitir evento global para que TODOS los módulos se enteren
            if (window.eventBus) {
                window.eventBus.emit('venta:completada', {
                    ventaId: ventaRef.id,
                    folio: folio,
                    total: total,
                    metodoPago: metodo,
                    vendedorId: window.authSystem?.currentUser?.uid,
                    timestamp: ahora
                });
                console.log('✅ Evento global emitido exitosamente');
            }

            // Sincronización directa SOLO si el módulo de caja está cargado
            if (window.cajaModule) {
                console.log('🔄 Módulo de caja detectado, forzando actualización inmediata...');
                try {
                    await window.cajaModule.cargarVentasTurno();
                    window.cajaModule.renderEstadoCaja();

                    if (window.cajaModule.currentTab === 'turno-actual') {
                        window.cajaModule.renderVentasTurno();
                    }

                    console.log('✅ Módulo de caja actualizado instantáneamente');
                } catch (syncError) {
                    console.error('⚠️ Error en sincronización directa:', syncError);
                    console.log('ℹ️ El listener en tiempo real actualizará la vista automáticamente');
                }
            } else {
                console.log('ℹ️ Módulo de caja no cargado actualmente - listeners en tiempo real activos');
            }

            // 15. LIMPIAR FORMULARIO
            const tipoVentaSelect = document.getElementById('tipo-venta');
            const metodoSelect = document.getElementById('metodo-venta');
            const selectClientePersonalizado = document.getElementById('select-cliente-personalizado');
            const selectClienteCredito = document.getElementById('select-cliente-credito');
            const clientePersonalizadoGroup = document.getElementById('cliente-personalizado-group');
            const clienteCreditoGroup = document.getElementById('cliente-credito-group');

            // Reset de selectores
            if (tipoVentaSelect) tipoVentaSelect.value = 'publico';
            if (metodoSelect) metodoSelect.value = 'efectivo';
            if (selectClientePersonalizado) selectClientePersonalizado.value = '';
            if (selectClienteCredito) selectClienteCredito.value = '';
            
            // Ocultar grupos
            if (clientePersonalizadoGroup) clientePersonalizadoGroup.style.display = 'none';
            if (clienteCreditoGroup) clienteCreditoGroup.style.display = 'none';

        } catch (error) {
            console.error('❌ Error crítico procesando venta:', error);
            console.error('Código de error:', error.code);
            console.error('Mensaje:', error.message);

            // Mensajes de error específicos y detallados
            let mensajeError = 'Error al procesar la venta';

            if (error.code === 'permission-denied') {
                mensajeError = `❌ Error de permisos de Firestore\n\n` +
                    `Motivo: Las reglas de seguridad rechazaron la operación.\n\n` +
                    `Solución:\n` +
                    `1. Ve a Firebase Console → Firestore → Reglas\n` +
                    `2. Asegúrate que la regla de 'sales' permite 'items' (no 'productos')\n` +
                    `3. Verifica que el campo 'estado' esté incluido\n\n` +
                    `Usuario actual: ${window.authSystem?.currentUser?.email || 'No autenticado'}`;
            } else if (error.code === 'unavailable') {
                mensajeError = '❌ Error de conexión: Verifica tu internet e intenta nuevamente.';
            } else if (error.code === 'failed-precondition') {
                mensajeError = `❌ Error de validación de Firestore\n\nLa venta no cumple con los requisitos.\nRevisa las reglas de seguridad.`;
            } else if (error.message) {
                mensajeError = `❌ Error: ${error.message}\n\nCódigo: ${error.code || 'Desconocido'}`;
            }

            alert(mensajeError);

            // NO limpiar el carrito si hay error - el usuario puede reintentar
            console.log('⚠️ Carrito preservado para reintento');
            console.log('Items en carrito:', this.carrito.length);

        } finally {
            // Restaurar botón de procesar
            if (btnProcesar) {
                btnProcesar.disabled = false;
                btnProcesar.innerHTML = `
                    <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="12" y1="1" x2="12" y2="23"></line>
                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                    </svg>
                    <span>Procesar Venta</span>
                `;
            }
            if (loadingOverlay) loadingOverlay.classList.remove('active');
        }
    }

    async actualizarInventario(items) {
        if (!items || items.length === 0) {
            console.warn('⚠️ No hay items para actualizar inventario');
            return;
        }

        try {
            console.log('📦 Iniciando consolidación de inventario para actualización atómica...');
            
            // 1. Agrupar items por productoId para evitar sobreescrituras (Race Conditions)
            const itemsPorProducto = items.reduce((acc, item) => {
                const id = item.producto?.id;
                if (!id) return acc;
                if (!acc[id]) acc[id] = [];
                acc[id].push(item);
                return acc;
            }, {});

            const batch = window.db.batch();
            const actualizacionesLog = [];

            // 2. Procesar cada producto de forma atómica
            for (const productoId in itemsPorProducto) {
                const productoRef = window.db.collection('products').doc(productoId);
                const productoDoc = await productoRef.get();

                if (!productoDoc.exists) {
                    console.error(`❌ Producto no encontrado: ${productoId}`);
                    continue;
                }

                const productoData = productoDoc.data();
                const itemsDelProducto = itemsPorProducto[productoId];
                
                // Clonar datos para modificarlos con seguridad
                let dataActualizada = JSON.parse(JSON.stringify(productoData));
                let huboCambios = false;

                for (const item of itemsDelProducto) {
                    // Normalizar tipo (corregir 'variante' a 'variante-simple' o detectar por estructura)
                    let tipoEfectivo = item.tipo;
                    if (tipoEfectivo === 'variante') {
                        tipoEfectivo = item.opcionIndex !== undefined ? 'variante-opcion' : 'variante-simple';
                    }

                    if (tipoEfectivo === 'simple') {
                        const stockActual = dataActualizada.stock?.actual || 0;
                        const nuevoStock = stockActual - item.cantidad;
                        if (!dataActualizada.stock) dataActualizada.stock = {};
                        dataActualizada.stock.actual = nuevoStock;
                        huboCambios = true;
                        actualizacionesLog.push(`${item.nombre} (Simple): ${stockActual} → ${nuevoStock}`);

                    } else if (tipoEfectivo === 'variante-simple' || tipoEfectivo === 'variante') {
                        const variantesArray = Array.isArray(dataActualizada.variantes) 
                            ? dataActualizada.variantes 
                            : Object.values(dataActualizada.variantes || {});

                        if (variantesArray[item.varianteIndex]) {
                            const stockActual = variantesArray[item.varianteIndex].stock?.actual || 0;
                            const nuevoStock = stockActual - item.cantidad;
                            if (!variantesArray[item.varianteIndex].stock) variantesArray[item.varianteIndex].stock = {};
                            variantesArray[item.varianteIndex].stock.actual = nuevoStock;
                            dataActualizada.variantes = variantesArray;
                            huboCambios = true;
                            actualizacionesLog.push(`${item.nombre} (Variante): ${stockActual} → ${nuevoStock}`);
                        }

                    } else if (tipoEfectivo === 'variante-opcion') {
                        const variantesArray = Array.isArray(dataActualizada.variantes) 
                            ? dataActualizada.variantes 
                            : Object.values(dataActualizada.variantes || {});

                        if (variantesArray[item.varianteIndex]) {
                            const opcionesArray = Array.isArray(variantesArray[item.varianteIndex].opciones) 
                                ? variantesArray[item.varianteIndex].opciones 
                                : Object.values(variantesArray[item.varianteIndex].opciones || {});

                            if (opcionesArray[item.opcionIndex]) {
                                const stockActual = opcionesArray[item.opcionIndex].stock?.actual || 0;
                                const nuevoStock = stockActual - item.cantidad;
                                if (!opcionesArray[item.opcionIndex].stock) opcionesArray[item.opcionIndex].stock = {};
                                opcionesArray[item.opcionIndex].stock.actual = nuevoStock;
                                variantesArray[item.varianteIndex].opciones = opcionesArray;
                                dataActualizada.variantes = variantesArray;
                                huboCambios = true;
                                actualizacionesLog.push(`${item.nombre} (Opción): ${stockActual} → ${nuevoStock}`);
                            }
                        }

                    } else if (tipoEfectivo === 'conversion') {
                        const cantidadBase = (item.conversion?.cantidad || 0) * (item.cantidad || 0);
                        const stockActual = dataActualizada.stock?.actual || 0;
                        const nuevoStock = stockActual - cantidadBase;
                        if (!dataActualizada.stock) dataActualizada.stock = {};
                        dataActualizada.stock.actual = nuevoStock;
                        huboCambios = true;
                        actualizacionesLog.push(`${item.nombre} (Conversión): ${stockActual} → ${nuevoStock} (-${cantidadBase} base)`);
                    }
                }

                if (huboCambios) {
                    batch.update(productoRef, dataActualizada);
                }
            }

            console.log('📦 Aplicando batch de inventario:', actualizacionesLog);
            await batch.commit();
            console.log('✅ Inventario actualizado correctamente con método de consolidación atómica');

        } catch (error) {
            console.error('❌ Error crítico actualizando inventario:', error);
            throw error;
        }
    }

    async actualizarEstadisticas() {
        console.log('📊 Actualizando estadísticas de ventas...');

        // Obtener configuración de horario comercial
        const horario = await this.obtenerConfiguracionHorario();
        const { inicio, fin } = this.calcularDiaComercialActual(horario);

        console.log('📅 Día comercial:', { inicio, fin });

        // Filtrar ventas del día comercial actual
        const ventasHoy = this.filtrarVentasPorDiaComercial(this.ventas, inicio, fin).filter(v => 
            v.estado === 'completada' || v.estado === 'pendiente'
        );

        console.log(`✅ Ventas del día comercial: ${ventasHoy.length}`);

        // Calcular totales solo de ventas completadas para efectivo/tarjeta/transferencia
        const ventasCompletadasHoy = ventasHoy.filter(v => v.estado === 'completada');
        const totalHoy = ventasCompletadasHoy.reduce((sum, v) => sum + (v.total || 0), 0);
        const efectivoHoy = ventasCompletadasHoy.filter(v => v.metodoPago === 'efectivo' || v.tipoPago === 'efectivo').reduce((sum, v) => sum + (v.total || 0), 0);
        const tarjetaHoy = ventasCompletadasHoy.filter(v => v.metodoPago === 'tarjeta' || v.tipoPago === 'tarjeta').reduce((sum, v) => sum + (v.total || 0), 0);
        const transferenciaHoy = ventasCompletadasHoy.filter(v => v.metodoPago === 'transferencia' || v.tipoPago === 'transferencia').reduce((sum, v) => sum + (v.total || 0), 0);

        // Crédito hoy - incluir pendientes
        const creditoHoy = ventasHoy.filter(v => 
            v.metodoPago === 'credito' || v.tipoPago === 'credito'
        ).reduce((sum, v) => sum + (v.total || 0), 0);

        // Créditos pendientes (todos los que tengan saldo pendiente)
        const creditosPendientes = this.ventas.filter(v => 
            (v.metodoPago === 'credito' || v.tipoPago === 'credito') && 
            v.estado === 'pendiente' &&
            (v.saldoPendiente || 0) > 0
        ).reduce((sum, v) => sum + (v.saldoPendiente || v.total || 0), 0);

        // Ventas del mes
        const inicioMes = new Date();
        inicioMes.setDate(1);
        inicioMes.setHours(0, 0, 0, 0);
        const ventasMes = this.ventas.filter(v => {
            const fecha = v.fecha?.toDate ? v.fecha.toDate() : new Date(v.fecha);
            return fecha >= inicioMes && v.estado === 'completada';
        });
        const totalMes = ventasMes.reduce((sum, v) => sum + (v.total || 0), 0);

        // Ticket promedio
        const ticketPromedio = ventasCompletadasHoy.length > 0 ? totalHoy / ventasCompletadasHoy.length : 0;

        // Calcular utilidad del día
        let utilidadHoy = 0;
        for (const venta of ventasCompletadasHoy) {
            const utilidad = await this.calcularUtilidadVenta(venta);
            utilidadHoy += utilidad;
        }

        // Clientes únicos atendidos hoy
        const clientesUnicos = new Set();
        ventasHoy.forEach(v => {
            if (v.cliente?.id) clientesUnicos.add(v.cliente.id);
        });

        console.log('💰 Totales calculados:', {
            totalHoy,
            efectivoHoy,
            tarjetaHoy,
            transferenciaHoy,
            creditoHoy,
            creditosPendientes,
            totalMes,
            ticketPromedio,
            utilidadHoy,
            clientesAtendidos: clientesUnicos.size
        });

        const formatter = window.currencyFormatter;

        // Actualizar cards de estadísticas usando los IDs específicos
        const elements = {
            ventasHoy: document.getElementById('stat-ventas-hoy'),
            ventasHoyCount: document.getElementById('stat-ventas-hoy-count'),
            efectivo: document.getElementById('stat-efectivo'),
            tarjeta: document.getElementById('stat-tarjeta'),
            transferencia: document.getElementById('stat-transferencia'),
            credito: document.getElementById('stat-credito'),
            creditosPendientes: document.getElementById('stat-creditos-pendientes'),
            ventasMes: document.getElementById('stat-ventas-mes'),
            ventasMesCount: document.getElementById('stat-ventas-mes-count'),
            ticketPromedio: document.getElementById('stat-ticket-promedio'),
            utilidadDia: document.getElementById('stat-utilidad-dia'),
            clientesAtendidos: document.getElementById('stat-clientes-atendidos')
        };

        // Actualizar valores
        if (elements.ventasHoy) {
            elements.ventasHoy.textContent = formatter?.format(totalHoy) || '$' + totalHoy.toFixed(2);
        }
        if (elements.ventasHoyCount) {
            elements.ventasHoyCount.textContent = `${ventasCompletadasHoy.length} transacciones`;
        }
        if (elements.efectivo) {
            elements.efectivo.textContent = formatter?.format(efectivoHoy) || '$' + efectivoHoy.toFixed(2);
        }
        if (elements.tarjeta) {
            elements.tarjeta.textContent = formatter?.format(tarjetaHoy) || '$' + tarjetaHoy.toFixed(2);
        }
        if (elements.transferencia) {
            elements.transferencia.textContent = formatter?.format(transferenciaHoy) || '$' + transferenciaHoy.toFixed(2);
        }
        if (elements.credito) {
            elements.credito.textContent = formatter?.format(creditoHoy) || '$' + creditoHoy.toFixed(2);
        }
        if (elements.creditosPendientes) {
            elements.creditosPendientes.textContent = formatter?.format(creditosPendientes) || '$' + creditosPendientes.toFixed(2);
        }
        if (elements.ventasMes) {
            elements.ventasMes.textContent = formatter?.format(totalMes) || '$' + totalMes.toFixed(2);
        }
        if (elements.ventasMesCount) {
            elements.ventasMesCount.textContent = `${ventasMes.length} transacciones`;
        }
        if (elements.ticketPromedio) {
            elements.ticketPromedio.textContent = formatter?.format(ticketPromedio) || '$' + ticketPromedio.toFixed(2);
        }
        if (elements.utilidadDia) {
            elements.utilidadDia.textContent = formatter?.format(utilidadHoy) || '$' + utilidadHoy.toFixed(2);
        }
        if (elements.clientesAtendidos) {
            elements.clientesAtendidos.textContent = clientesUnicos.size.toString();
        }

        console.log('✅ Estadísticas actualizadas correctamente');
    }

    async calcularUtilidadVenta(venta) {
        let utilidadTotal = 0;
        const productos = venta.productos || venta.items || [];

        for (const item of productos) {
            const precioVenta = item.precioUnitario || 0;

            // ── FUENTE PRIMARIA ──────────────────────────────────────────────────────
            // El campo `costo` se guarda en Firestore en el momento exacto de la venta.
            // Es el dato más confiable: refleja los precios reales al vender aunque
            // el inventario haya cambiado después.
            // costo > 0: descarta 0s incorrectos guardados por bug anterior en variante-simple
            if (item.costo !== undefined && item.costo !== null && item.costo > 0) {
                utilidadTotal += (precioVenta - item.costo) * (item.cantidad || 1);
                continue;
            }

            // ── FUENTE SECUNDARIA ────────────────────────────────────────────────────
            // Recálculo desde el inventario actual — solo para ventas antiguas que no
            // tengan el campo `costo` guardado (registros anteriores a esta corrección).
            const producto = this.productos.find(p => p.id === item.productoId);
            if (!producto) continue;

            let costo = 0;

            if (item.tipo === 'simple') {
                costo = producto.precio?.costo || 0;

            } else if (item.tipo === 'variante-simple') {
                const variantesArray = Array.isArray(producto.variantes)
                    ? producto.variantes
                    : Object.values(producto.variantes || {});
                const variante = variantesArray[item.varianteIndex];
                costo = variante?.precio?.costo || 0;

            } else if (item.tipo === 'variante-opcion') {
                const variantesArray = Array.isArray(producto.variantes)
                    ? producto.variantes
                    : Object.values(producto.variantes || {});
                const variante = variantesArray[item.varianteIndex];
                // Usar el costo de la opción específica; si no existe, el de la variante
                const opcionesArray = Array.isArray(variante?.opciones)
                    ? variante.opciones
                    : Object.values(variante?.opciones || {});
                const opcion = opcionesArray[item.opcionIndex];
                costo = opcion?.precio?.costo || variante?.precio?.costo || 0;

            } else if (item.tipo === 'conversion') {
                // Para conversiones, producto.precio es null por diseño.
                // El costo real está en cada unidad de conversión.
                const conversionesArray = Array.isArray(producto.conversiones)
                    ? producto.conversiones
                    : Object.values(producto.conversiones || {});
                const conversion = conversionesArray[item.conversionIndex];
                costo = conversion?.precio?.costo || 0;
            }

            utilidadTotal += (precioVenta - costo) * (item.cantidad || 1);
        }

        return utilidadTotal;
    }

    async renderHistorial() {
        const tbody = document.getElementById('historial-table-body');

        if (this.ventas.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="11" style="text-align: center; padding: 40px; color: #6D6D80;">
                        No hay ventas registradas
                    </td>
                </tr>
            `;
            return;
        }

        // Aplicar filtros directamente
        await this.aplicarFiltrosHistorial();
    }

    async verDetalleVenta(ventaId) {
        // Buscar venta de forma más robusta - convertir a string para comparación
        const venta = this.ventas.find(v => String(v.id) === String(ventaId));
        if (!venta) {
            console.error('❌ Venta no encontrada. ID buscado:', ventaId, 'IDs disponibles:', this.ventas.map(v => v.id));
            alert('Venta no encontrada');
            return;
        }

        const fecha = venta.fecha?.toDate ? venta.fecha.toDate() : new Date(venta.fecha);
        const cliente = this.clientes.find(c => c.id === venta.cliente?.id);
        const productos = venta.productos || venta.items || [];
        const formatter = window.currencyFormatter;

        const modal = document.getElementById('modal-detalle-venta');
        const content = document.getElementById('detalle-venta-content');

        content.innerHTML = `
            <div style="display: grid; gap: 20px;">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; padding: 16px; background: #F8F9FA; border-radius: 12px;">
                    <div>
                        <div style="color: #6D6D80; font-size: 0.9rem; margin-bottom: 4px;">Folio</div>
                        <div style="font-weight: 600; color: #007AFF;">${venta.folio}</div>
                    </div>
                    <div>
                        <div style="color: #6D6D80; font-size: 0.9rem; margin-bottom: 4px;">Fecha</div>
                        <div style="font-weight: 600;">${fecha.toLocaleDateString()} ${fecha.toLocaleTimeString()}</div>
                    </div>
                    <div>
                        <div style="color: #6D6D80; font-size: 0.9rem; margin-bottom: 4px;">Cliente</div>
                        <div style="font-weight: 600;">${cliente?.nombre || venta.cliente?.nombre || 'N/A'}</div>
                    </div>
                    <div>
                        <div style="color: #6D6D80; font-size: 0.9rem; margin-bottom: 4px;">Vendedor</div>
                        <div style="font-weight: 600;">${venta.vendedor}</div>
                    </div>
                    <div>
                        <div style="color: #6D6D80; font-size: 0.9rem; margin-bottom: 4px;">Tipo</div>
                        <div style="font-weight: 600; text-transform: capitalize;">${venta.tipoVenta}</div>
                    </div>
                    <div>
                        <div style="color: #6D6D80; font-size: 0.9rem; margin-bottom: 4px;">Método de Pago</div>
                        <div style="font-weight: 600; text-transform: capitalize;">${venta.metodoPago}</div>
                    </div>
                    <div>
                        <div style="color: #6D6D80; font-size: 0.9rem; margin-bottom: 4px;">Estado</div>
                        <div><span class="estado-badge estado-${venta.estado}">${venta.estado}</span></div>
                    </div>
                </div>

                <div>
                    <h4 style="margin-bottom: 12px;">Productos</h4>
                    <div style="border: 1px solid #E5E5E7; border-radius: 8px; overflow: hidden;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead style="background: #F8F9FA;">
                                <tr>
                                    <th style="padding: 12px; text-align: left; border-bottom: 1px solid #E5E5E7;">Producto</th>
                                    <th style="padding: 12px; text-align: center; border-bottom: 1px solid #E5E5E7;">Cantidad</th>
                                    <th style="padding: 12px; text-align: right; border-bottom: 1px solid #E5E5E7;">Precio Unit.</th>
                                    <th style="padding: 12px; text-align: right; border-bottom: 1px solid #E5E5E7;">Subtotal</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${productos.map(item => `
                                    <tr>
                                        <td style="padding: 12px; border-bottom: 1px solid #F2F2F7;">${item.nombre}</td>
                                        <td style="padding: 12px; text-align: center; border-bottom: 1px solid #F2F2F7;">${item.cantidad}</td>
                                        <td style="padding: 12px; text-align: right; border-bottom: 1px solid #F2F2F7;">${formatter ? formatter.format(item.precioUnitario) : '$' + item.precioUnitario.toFixed(2)}</td>
                                        <td style="padding: 12px; text-align: right; border-bottom: 1px solid #F2F2F7;">${formatter ? formatter.format(item.subtotal) : '$' + item.subtotal.toFixed(2)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div style="display: flex; justify-content: flex-end; padding: 16px; background: #F8F9FA; border-radius: 12px;">
                    <div style="text-align: right;">
                        <div style="color: #6D6D80; margin-bottom: 8px;">Total de la venta</div>
                        <div style="font-size: 1.5rem; font-weight: 700; color: #007AFF;">
                            ${formatter ? formatter.format(venta.total) : '$' + venta.total.toFixed(2)}
                        </div>
                    </div>
                </div>
            </div>
        `;

        modal.classList.add('active');
    }

    abrirModalCancelarVenta(ventaId) {
        // Buscar venta de forma más robusta - convertir a string para comparación
        const venta = this.ventas.find(v => String(v.id) === String(ventaId));
        if (!venta) {
            console.error('❌ Venta no encontrada. ID buscado:', ventaId, 'IDs disponibles:', this.ventas.map(v => v.id));
            alert('Venta no encontrada');
            return;
        }

        if (venta.estado === 'cancelada') {
            alert('Esta venta ya está cancelada');
            return;
        }

        this.ventaSeleccionada = ventaId;
        const modal = document.getElementById('modal-cancelar-venta');
        modal.classList.add('active');

        // Configurar listeners para botones de cancelación
        const btnConfirmar = document.getElementById('btn-confirmar-cancelacion');
        const btnCancelar = document.getElementById('btn-cancelar-cancelacion');
        const btnClose = document.getElementById('modal-cancelar-close');

        const confirmarHandler = () => this.confirmarCancelacionVenta();
        const cancelarHandler = () => this.cerrarModalCancelarVenta();

        btnConfirmar.removeEventListener('click', confirmarHandler);
        btnCancelar.removeEventListener('click', cancelarHandler);
        btnClose.removeEventListener('click', cancelarHandler);

        btnConfirmar.addEventListener('click', confirmarHandler);
        btnCancelar.addEventListener('click', cancelarHandler);
        btnClose.addEventListener('click', cancelarHandler);
    }

    async confirmarCancelacionVenta() {
        const motivo = document.getElementById('motivo-cancelacion').value.trim();

        if (!motivo) {
            alert('Debes ingresar un motivo de cancelación');
            return;
        }

        const venta = this.ventas.find(v => String(v.id) === String(this.ventaSeleccionada));
        if (!venta) {
            console.error('❌ Venta no encontrada:', this.ventaSeleccionada);
            alert('Venta no encontrada');
            return;
        }

        try {
            console.log('🔄 Iniciando cancelación de venta con consolidación atómica...', venta.folio);
            const batch = window.db.batch();
            const itemsVenta = venta.productos || venta.items || [];

            // 1. Agrupar items por productoId para evitar sobreescrituras (Race Conditions)
            const itemsPorProducto = itemsVenta.reduce((acc, item) => {
                const id = item.productoId;
                if (!id) return acc;
                if (!acc[id]) acc[id] = [];
                acc[id].push(item);
                return acc;
            }, {});

            const actualizacionesLog = [];

            // 2. Procesar cada producto de forma atómica para la devolución
            for (const productoId in itemsPorProducto) {
                const productoRef = window.db.collection('products').doc(productoId);
                const productoDoc = await productoRef.get();

                if (!productoDoc.exists) {
                    console.error(`❌ Producto no encontrado para devolución: ${productoId}`);
                    continue;
                }

                const productoData = productoDoc.data();
                const itemsDelProducto = itemsPorProducto[productoId];
                
                let dataActualizada = JSON.parse(JSON.stringify(productoData));
                let huboCambios = false;

                for (const item of itemsDelProducto) {
                    // Normalizar tipo de forma robusta
                    let tipoEfectivo = item.tipo;
                    
                    // CORRECCIÓN: Si el tipo es 'variante', determinar si es simple o con opción
                    if (tipoEfectivo === 'variante') {
                        tipoEfectivo = (item.opcionIndex !== undefined && item.opcionIndex !== null) 
                            ? 'variante-opcion' 
                            : 'variante-simple';
                    }

                    if (tipoEfectivo === 'simple') {
                        const stockActual = dataActualizada.stock?.actual || 0;
                        const nuevoStock = stockActual + item.cantidad;
                        if (!dataActualizada.stock) dataActualizada.stock = {};
                        dataActualizada.stock.actual = nuevoStock;
                        huboCambios = true;
                        actualizacionesLog.push(`${item.nombre} (Simple): ${stockActual} → ${nuevoStock}`);

                    } else if (tipoEfectivo === 'variante-simple' || tipoEfectivo === 'variante') {
                        // Asegurar que usamos el índice de variante correcto
                        const vIndex = item.varianteIndex;
                        const variantesArray = Array.isArray(dataActualizada.variantes) 
                            ? dataActualizada.variantes 
                            : Object.values(dataActualizada.variantes || {});

                        if (vIndex !== undefined && vIndex !== null && variantesArray[vIndex]) {
                            const stockActual = variantesArray[vIndex].stock?.actual || 0;
                            const nuevoStock = stockActual + item.cantidad;
                            if (!variantesArray[vIndex].stock) variantesArray[vIndex].stock = {};
                            variantesArray[vIndex].stock.actual = nuevoStock;
                            dataActualizada.variantes = variantesArray;
                            huboCambios = true;
                            actualizacionesLog.push(`${item.nombre} (Variante [${vIndex}]): ${stockActual} → ${nuevoStock}`);
                        } else {
                            console.warn(`⚠️ No se encontró la variante en el índice ${vIndex} para el producto ${item.nombre}`);
                        }

                    } else if (tipoEfectivo === 'variante-opcion') {
                        const vIndex = item.varianteIndex;
                        const oIndex = item.opcionIndex;
                        const variantesArray = Array.isArray(dataActualizada.variantes) 
                            ? dataActualizada.variantes 
                            : Object.values(dataActualizada.variantes || {});

                        if (vIndex !== undefined && vIndex !== null && variantesArray[vIndex]) {
                            const opcionesArray = Array.isArray(variantesArray[vIndex].opciones) 
                                ? variantesArray[vIndex].opciones 
                                : Object.values(variantesArray[vIndex].opciones || {});

                            if (oIndex !== undefined && oIndex !== null && opcionesArray[oIndex]) {
                                const stockActual = opcionesArray[oIndex].stock?.actual || 0;
                                const nuevoStock = stockActual + item.cantidad;
                                if (!opcionesArray[oIndex].stock) opcionesArray[oIndex].stock = {};
                                opcionesArray[oIndex].stock.actual = nuevoStock;
                                variantesArray[vIndex].opciones = opcionesArray;
                                dataActualizada.variantes = variantesArray;
                                huboCambios = true;
                                actualizacionesLog.push(`${item.nombre} (Opción [${vIndex}][${oIndex}]): ${stockActual} → ${nuevoStock}`);
                            } else {
                                console.warn(`⚠️ No se encontró la opción en el índice ${oIndex} para la variante ${vIndex} del producto ${item.nombre}`);
                            }
                        } else {
                            console.warn(`⚠️ No se encontró la variante en el índice ${vIndex} para el producto ${item.nombre}`);
                        }

                    } else if (tipoEfectivo === 'conversion') {
                        const cantidadBase = (item.conversion?.cantidad || 0) * (item.cantidad || 0);
                        const stockActual = dataActualizada.stock?.actual || 0;
                        const nuevoStock = stockActual + cantidadBase;
                        if (!dataActualizada.stock) dataActualizada.stock = {};
                        dataActualizada.stock.actual = nuevoStock;
                        huboCambios = true;
                        actualizacionesLog.push(`${item.nombre} (Conversión): ${stockActual} → ${nuevoStock} (+${cantidadBase} base)`);
                    }
                }

                if (huboCambios) {
                    batch.update(productoRef, dataActualizada);
                }
            }

            // 3. Actualizar estado de la venta
            const ventaRef = window.db.collection('sales').doc(this.ventaSeleccionada);
            batch.update(ventaRef, {
                estado: 'cancelada',
                motivoCancelacion: motivo,
                fechaCancelacion: firebase.firestore.Timestamp.now(),
                canceladoPor: (window.authSystem?.currentUser?.uid) || 'system'
            });

            console.log('📦 Aplicando devoluciones en batch:', actualizacionesLog);
            await batch.commit();

            // 🚀 NOTIFICAR AL SISTEMA DE CAJA (Evento Global)
            if (window.eventBus) {
                window.eventBus.emit('venta:cancelada', {
                    ventaId: this.ventaSeleccionada,
                    folio: venta.folio,
                    total: venta.total,
                    metodoPago: venta.metodoPago,
                    vendedorId: venta.vendedorId,
                    fechaCancelacion: new Date()
                });
            }

            alert('✅ Venta cancelada exitosamente. El stock ha sido devuelto al inventario y el movimiento ha sido reversado en caja.');

            // Recargar datos
            await this.cargarVentas();
            await this.cargarProductos();
            this.renderHistorial();
            this.actualizarEstadisticas();
            this.cerrarModalCancelarVenta();

        } catch (error) {
            console.error('❌ Error crítico cancelando venta:', error);
            alert('❌ Error al cancelar la venta: ' + error.message);
        }
    }

    cerrarModalCancelarVenta() {
        const modal = document.getElementById('modal-cancelar-venta');
        modal.classList.remove('active');
        document.getElementById('motivo-cancelacion').value = '';
        this.ventaSeleccionada = null;
    }

    filtrarHistorial(searchTerm) {
        clearTimeout(this.filtroTimeout);
        this.filtroTimeout = setTimeout(() => {
            this.aplicarFiltrosHistorial();
        }, 300);
    }

    async aplicarFiltrosHistorial() {
        const searchTerm = document.getElementById('historial-search')?.value.toLowerCase() || '';
        const tipoVenta = document.getElementById('filter-tipo-venta')?.value || '';
        const estado = document.getElementById('filter-estado')?.value || '';

        let ventasFiltradas = [...this.ventas];

        // 1. Filtrar por rango de fechas (se omite si el período es "Todas las fechas")
        if (this.periodoActual !== 'todo' && this.fechaInicio && this.fechaFin) {
            ventasFiltradas = ventasFiltradas.filter(v => {
                const fecha = v.fecha?.toDate ? v.fecha.toDate() : new Date(v.fecha);
                return fecha >= this.fechaInicio && fecha <= this.fechaFin;
            });
        }

        // 2. Filtrar por búsqueda de texto (folio, cliente, vendedor y nombres de productos)
        if (searchTerm) {
            ventasFiltradas = ventasFiltradas.filter(venta => {
                const folio = (venta.folio || '').toLowerCase();
                const cliente = (venta.cliente?.nombre || '').toLowerCase();
                const vendedor = (venta.vendedor || '').toLowerCase();
                const productos = (venta.productos || venta.items || [])
                    .map(p => (p.nombre || '').toLowerCase())
                    .join(' ');

                return folio.includes(searchTerm) ||
                       cliente.includes(searchTerm) ||
                       vendedor.includes(searchTerm) ||
                       productos.includes(searchTerm);
            });
        }

        // 3. Filtrar por tipo de venta
        if (tipoVenta) {
            ventasFiltradas = ventasFiltradas.filter(v => v.tipoVenta === tipoVenta);
        }

        // 4. Filtrar por estado
        if (estado) {
            ventasFiltradas = ventasFiltradas.filter(v => v.estado === estado);
        }

        // Renderizar con las ventas filtradas
        await this.renderHistorialFiltrado(ventasFiltradas);
    }

    async renderHistorialFiltrado(ventasFiltradas) {
        const tbody = document.getElementById('historial-table-body');

        if (ventasFiltradas.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="11" style="text-align: center; padding: 40px; color: #6D6D80;">
                        No se encontraron ventas con los filtros aplicados
                    </td>
                </tr>
            `;
            return;
        }

        // Calcular utilidades para las ventas filtradas
        const ventasConUtilidad = await Promise.all(
            ventasFiltradas.map(async venta => {
                const utilidad = await this.calcularUtilidadVenta(venta);
                return { ...venta, utilidad };
            })
        );

        // Verificar permiso para cancelar ventas
        const tienePermisoCancelar = window.authSystem?.hasSubPermission('ventas', 'cancelarVenta') ?? true;
        
        tbody.innerHTML = ventasConUtilidad.map(venta => {
            const fecha = venta.fecha?.toDate ? venta.fecha.toDate() : new Date(venta.fecha);
            const cliente = this.clientes.find(c => c.id === venta.cliente?.id);
            const puedeEliminar = (venta.estado === 'completada' || venta.estado === 'pendiente') && tienePermisoCancelar;
            const utilidadColor = venta.utilidad >= 0 ? '#34C759' : '#FF3B30';

            return `
                <tr>
                    <td><span class="folio-badge">${venta.folio}</span></td>
                    <td>${fecha.toLocaleDateString()} ${fecha.toLocaleTimeString()}</td>
                    <td>${venta.vendedor}</td>
                    <td>${cliente?.nombre || venta.cliente?.nombre || 'N/A'}</td>
                    <td>${venta.tipoVenta}</td>
                    <td>${(venta.productos?.length || venta.items?.length || 0)}</td>
                    <td>${window.currencyFormatter?.format(venta.total) || '$' + venta.total.toFixed(2)}</td>
                    <td style="color: ${utilidadColor}; font-weight: 600;">${window.currencyFormatter?.format(venta.utilidad) || '$' + venta.utilidad.toFixed(2)}</td>
                    <td>${venta.metodoPago}</td>
                    <td><span class="estado-badge estado-${venta.estado}">${venta.estado}</span></td>
                    <td>
                        <div class="acciones-usuario">
                            <button 
                                class="btn-accion btn-editar" 
                                onclick="ventasModule.verDetalleVenta('${venta.id}')"
                                title="Ver detalle">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                    <circle cx="12" cy="12" r="3"></circle>
                                </svg>
                            </button>
                            ${puedeEliminar ? `
                                <button 
                                    class="btn-accion btn-eliminar" 
                                    onclick="ventasModule.abrirModalCancelarVenta('${venta.id}')"
                                    title="Cancelar venta">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    destroy() {
        // Detener listener de caja si existe
        if (this.unsubscribeCaja) {
            this.unsubscribeCaja();
            console.log('🔄 Listener de caja detenido');
        }
        console.log('🛒 Módulo de ventas descargado');
    }

    async descargarHistorialExcel() {
        try {
            // Validar que el usuario sea administrador
            const usuarioActual = window.authSystem?.currentUser || this.usuarioActual;
            if (usuarioActual?.rol !== 'administrador') {
                this.showNotification('❌ Solo administradores pueden descargar el historial en Excel', 'error');
                return;
            }

            // Mostrar notificación de carga
            this.showNotification('⏳ Preparando descarga de historial completo...', 'info');

            // 🚀 SOLUCIÓN PROFESIONAL: Descargar TODAS las ventas del rango de fechas desde Firebase
            // Ignoramos this.ventas porque tiene un limit(100)
            let query = window.db.collection('sales').orderBy('fecha', 'desc');
            if (this.periodoActual !== 'todo' && this.fechaInicio && this.fechaFin) {
                query = query
                    .where('fecha', '>=', firebase.firestore.Timestamp.fromDate(this.fechaInicio))
                    .where('fecha', '<=', firebase.firestore.Timestamp.fromDate(this.fechaFin));
            }
            const snapshot = await query.get();

            if (snapshot.empty) {
                this.showNotification('ℹ️ No hay ventas registradas en el rango de fechas seleccionado', 'info');
                return;
            }

            const ventasTotalesRango = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Obtener filtros adicionales
            const searchTerm = document.getElementById('historial-search')?.value.toLowerCase() || '';
            const tipoVenta = document.getElementById('filter-tipo-venta')?.value || '';
            const estado = document.getElementById('filter-estado')?.value || '';

            let ventasFiltradas = [...ventasTotalesRango];

            // 2. Filtrar por búsqueda de texto (folio, cliente, vendedor y nombres de productos)
            if (searchTerm) {
                ventasFiltradas = ventasFiltradas.filter(venta => {
                    const folio = (venta.folio || '').toLowerCase();
                    const cliente = (venta.cliente?.nombre || '').toLowerCase();
                    const vendedor = (venta.vendedor || '').toLowerCase();
                    const productos = (venta.productos || venta.items || [])
                        .map(p => (p.nombre || '').toLowerCase())
                        .join(' ');
                    return folio.includes(searchTerm) ||
                           cliente.includes(searchTerm) ||
                           vendedor.includes(searchTerm) ||
                           productos.includes(searchTerm);
                });
            }

            // 3. Filtrar por tipo de venta
            if (tipoVenta) {
                ventasFiltradas = ventasFiltradas.filter(v => v.tipoVenta === tipoVenta);
            }

            // 4. Filtrar por estado
            if (estado) {
                ventasFiltradas = ventasFiltradas.filter(v => v.estado === estado);
            }

            if (ventasFiltradas.length === 0) {
                this.showNotification('ℹ️ No hay ventas que coincidan con los filtros de búsqueda', 'info');
                return;
            }

            // Preparar datos para Excel
            const datosExcel = await Promise.all(
                ventasFiltradas.map(async venta => {
                    const fecha = venta.fecha?.toDate ? venta.fecha.toDate() : new Date(venta.fecha);
                    const cliente = this.clientes.find(c => c.id === venta.cliente?.id);
                    const utilidad = await this.calcularUtilidadVenta(venta);
                    const total = venta.total || 0;
                    const cantidadProductos = (venta.productos?.length || venta.items?.length || 0);

                    return {
                        'Folio': venta.folio,
                        'Fecha': fecha.toLocaleDateString(),
                        'Hora': fecha.toLocaleTimeString(),
                        'Vendedor': venta.vendedor,
                        'Cliente': cliente?.nombre || venta.cliente?.nombre || 'N/A',
                        'Tipo Venta': venta.tipoVenta,
                        'Cantidad Productos': cantidadProductos,
                        'Total': total,
                        'Utilidad': utilidad,
                        'Método Pago': venta.metodoPago,
                        'Estado': venta.estado
                    };
                })
            );

            // Enviar datos al servidor para generar Excel
            const response = await fetch('/api/descargar-historial-excel', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ datos: datosExcel })
            });

            if (!response.ok) {
                throw new Error('Error al generar el archivo');
            }

            // Descargar archivo
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            
            const ahora = new Date();
            const nombreArchivo = `Historial_Ventas_${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}.xlsx`;
            
            link.href = url;
            link.download = nombreArchivo;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            this.showNotification(`✅ Se descargó el historial con ${ventasFiltradas.length} venta(s)`, 'success');

        } catch (error) {
            console.error('❌ Error al descargar:', error);
            this.showNotification(`❌ Error al descargar: ${error.message}`, 'error');
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
}

// Inicializar módulo
let ventasModule = null;

function loadVentasModule() {
    ventasModule = new VentasModule();
}

// Auto-inicializar si ya está en el DOM
if (document.getElementById('tab-pos')) {
    loadVentasModule();
}