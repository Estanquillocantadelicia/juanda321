
// Módulo de Configuración - Sistema Profesional
class ConfiguracionModule {
    constructor() {
        this.config = {
            negocio: {},
            horarioComercial: {
                horaInicio: '09:00',
                horaFin: '07:00',
                esDiaSiguiente: true
            },
            notificaciones: {},
            avanzado: {}
        };
        this.init();
    }

    async init() {
        console.log('⚙️ Inicializando módulo de configuración...');
        
        await this.cargarConfiguracion();
        this.setupEventListeners();
        this.renderConfiguracion();
        this.actualizarEstadoDiaComercial();
        
        console.log('✅ Módulo de configuración inicializado');
    }

    setupEventListeners() {
        // Tabs con indicador animado
        const tabs = document.querySelectorAll('.config-tab-btn');
        const indicator = document.querySelector('.tab-indicator');

        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.cambiarTab(e.currentTarget.dataset.tab, tab);
            });
        });

        // Inicializar posición del indicador
        const activeTab = document.querySelector('.config-tab-btn.active');
        if (activeTab && indicator) {
            this.updateTabIndicator(activeTab, indicator, false);
        }

        // Actualizar indicador en resize
        window.addEventListener('resize', () => {
            const currentActiveTab = document.querySelector('.config-tab-btn.active');
            if (currentActiveTab && indicator) {
                this.updateTabIndicator(currentActiveTab, indicator, false);
            }
        });

        // Horario - Actualizar preview en tiempo real
        const horaInicio = document.getElementById('hora-inicio');
        const horaFin = document.getElementById('hora-fin');
        const esDiaSiguiente = document.getElementById('es-dia-siguiente');

        if (horaInicio) horaInicio.addEventListener('change', () => this.actualizarPreviewHorario());
        if (horaFin) horaFin.addEventListener('change', () => this.actualizarPreviewHorario());
        if (esDiaSiguiente) esDiaSiguiente.addEventListener('change', () => this.actualizarPreviewHorario());

        // Botones de guardado
        const btnGuardarGeneral = document.getElementById('btn-guardar-general');
        const btnGuardarHorario = document.getElementById('btn-guardar-horario');
        const btnGuardarNotif = document.getElementById('btn-guardar-notificaciones');
        
        if (btnGuardarGeneral) btnGuardarGeneral.addEventListener('click', () => this.guardarGeneral());
        if (btnGuardarHorario) btnGuardarHorario.addEventListener('click', () => this.guardarHorario());
        if (btnGuardarNotif) btnGuardarNotif.addEventListener('click', () => this.guardarNotificaciones());

        // Botones avanzados
        const btnLimpiarCache = document.getElementById('btn-limpiar-cache');
        const btnResetear = document.getElementById('btn-resetear-config');
        const btnResetDatos = document.getElementById('btn-reset-datos');
        const btnSeleccionarTodo = document.getElementById('btn-seleccionar-todo');
        
        if (btnLimpiarCache) btnLimpiarCache.addEventListener('click', () => this.limpiarCache());
        if (btnResetear) btnResetear.addEventListener('click', () => this.resetearConfiguracion());
        if (btnResetDatos) btnResetDatos.addEventListener('click', () => this.resetearDatos());
        if (btnSeleccionarTodo) btnSeleccionarTodo.addEventListener('click', () => this.toggleSeleccionarTodo());
    }

    cambiarTab(tab, tabElement = null) {
        // Actualizar botones
        document.querySelectorAll('.config-tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        const targetTabElement = tabElement || document.querySelector(`[data-tab="${tab}"]`);
        if (targetTabElement) {
            targetTabElement.classList.add('active');

            // Animar indicador
            const indicator = document.querySelector('.tab-indicator');
            if (indicator) {
                this.updateTabIndicator(targetTabElement, indicator, true);
            }
        }

        // Actualizar contenido con animación
        document.querySelectorAll('.config-tab-content').forEach(content => {
            content.classList.remove('active');
        });

        const targetContent = document.getElementById(`tab-${tab}`);
        if (targetContent) {
            setTimeout(() => {
                targetContent.classList.add('active');
            }, 150);
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

    async cargarConfiguracion() {
        try {
            const doc = await window.db.collection('configuracion').doc('general').get();
            
            if (doc.exists) {
                this.config = { ...this.config, ...doc.data() };
            } else {
                // Crear configuración por defecto
                await this.guardarConfiguracionDefecto();
            }

            // Cargar estado actual de cajas abiertas
            this.actualizarEstadoCajasAbiertas();
        } catch (error) {
            console.error('Error cargando configuración:', error);
        }
    }

    renderConfiguracion() {
        // Renderizar datos generales
        const nombreNegocio = document.getElementById('nombre-negocio');
        const direccion = document.getElementById('direccion-negocio');
        const telefono = document.getElementById('telefono-negocio');
        const moneda = document.getElementById('moneda');
        const iva = document.getElementById('iva');

        if (nombreNegocio) nombreNegocio.value = this.config.negocio?.nombre || '';
        if (direccion) direccion.value = this.config.negocio?.direccion || '';
        if (telefono) telefono.value = this.config.negocio?.telefono || '';
        if (moneda) moneda.value = this.config.negocio?.moneda || 'MXN';
        if (iva) iva.value = this.config.negocio?.iva || 16;

        // Renderizar límite de cajas
        const maxCajas = document.getElementById('max-cajas-abiertas');
        if (maxCajas) maxCajas.value = this.config.caja?.maxCajasAbiertas || 1;

        // Renderizar efectivo inicial de pagos
        const efectivoInicial = document.getElementById('efectivo-inicial-pagos');
        if (efectivoInicial) efectivoInicial.value = this.config.pagos?.efectivoInicial || 0;

        // Renderizar horario
        const horaInicio = document.getElementById('hora-inicio');
        const horaFin = document.getElementById('hora-fin');
        const esDiaSiguiente = document.getElementById('es-dia-siguiente');

        if (horaInicio) horaInicio.value = this.config.horarioComercial?.horaInicio || '09:00';
        if (horaFin) horaFin.value = this.config.horarioComercial?.horaFin || '07:00';
        if (esDiaSiguiente) esDiaSiguiente.checked = this.config.horarioComercial?.esDiaSiguiente !== false;

        this.actualizarPreviewHorario();
    }

    actualizarPreviewHorario() {
        const horaInicio = document.getElementById('hora-inicio')?.value || '09:00';
        const horaFin = document.getElementById('hora-fin')?.value || '07:00';
        const esDiaSiguiente = document.getElementById('es-dia-siguiente')?.checked || false;

        const preview = document.getElementById('preview-horario');
        if (preview) {
            const inicioFormatted = this.formatearHora(horaInicio);
            const finFormatted = this.formatearHora(horaFin);
            const diaSiguienteText = esDiaSiguiente ? ' (día siguiente)' : '';
            preview.textContent = `${inicioFormatted} - ${finFormatted}${diaSiguienteText}`;
        }

        this.actualizarEstadoDiaComercial();
    }

    formatearHora(hora24) {
        const [hours, minutes] = hora24.split(':');
        const h = parseInt(hours);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        return `${h12.toString().padStart(2, '0')}:${minutes} ${ampm}`;
    }

    actualizarEstadoDiaComercial() {
        const ahora = new Date();
        const horaInicio = document.getElementById('hora-inicio')?.value || '09:00';
        const horaFin = document.getElementById('hora-fin')?.value || '07:00';
        const esDiaSiguiente = document.getElementById('es-dia-siguiente')?.checked || false;

        const { inicio, fin } = this.calcularDiaComercial(horaInicio, horaFin, esDiaSiguiente, ahora);

        const fechaInicioEl = document.getElementById('fecha-inicio-actual');
        const fechaFinEl = document.getElementById('fecha-fin-actual');
        const estadoEl = document.getElementById('estado-comercial');

        if (fechaInicioEl) {
            fechaInicioEl.textContent = inicio.toLocaleString('es-MX', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }

        if (fechaFinEl) {
            fechaFinEl.textContent = fin.toLocaleString('es-MX', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }

        if (estadoEl) {
            const estaAbierto = ahora >= inicio && ahora < fin;
            estadoEl.textContent = estaAbierto ? 'Abierto' : 'Cerrado';
            estadoEl.className = 'badge ' + (estaAbierto ? 'badge-success' : 'badge-danger');
        }
    }

    calcularDiaComercial(horaInicio, horaFin, esDiaSiguiente, ahora = new Date()) {
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

    async guardarGeneral() {
        const loading = document.getElementById('loading-overlay-config');
        if (loading) loading.classList.add('active');

        try {
            const nombreNegocio = document.getElementById('nombre-negocio')?.value || '';
            const direccion = document.getElementById('direccion-negocio')?.value || '';
            const telefono = document.getElementById('telefono-negocio')?.value || '';
            const moneda = document.getElementById('moneda')?.value || 'MXN';
            const iva = parseFloat(document.getElementById('iva')?.value) || 16;
            const maxCajasAbiertas = parseInt(document.getElementById('max-cajas-abiertas')?.value) || 1;
            const efectivoInicialPagos = parseFloat(document.getElementById('efectivo-inicial-pagos')?.value) || 0;

            this.config.negocio = { nombre: nombreNegocio, direccion, telefono, moneda, iva };
            this.config.caja = { maxCajasAbiertas };
            this.config.pagos = { efectivoInicial: efectivoInicialPagos };

            await window.db.collection('configuracion').doc('general').set(this.config, { merge: true });

            if (window.authSystem && nombreNegocio) {
                window.authSystem.updateBusinessName(nombreNegocio);
                console.log('🔄 Nombre del negocio actualizado en authSystem:', nombreNegocio);
                
                if (!window.authSystem.isAuthenticated) {
                    const oldOverlay = document.querySelector('.login-overlay');
                    if (oldOverlay) {
                        oldOverlay.remove();
                    }
                    await window.authSystem.showLoginScreen();
                }
            }

            if (window.eventBus) {
                window.eventBus.emit('configuracionActualizada', {
                    nombreNegocio,
                    direccion,
                    telefono,
                    moneda,
                    iva
                });
            }

            alert('✅ Configuración general guardada correctamente');
        } catch (error) {
            console.error('Error guardando configuración general:', error);
            alert('❌ Error al guardar la configuración');
        } finally {
            if (loading) loading.classList.remove('active');
        }
    }

    async guardarHorario() {
        const loading = document.getElementById('loading-overlay-config');
        if (loading) loading.classList.add('active');

        try {
            const horaInicio = document.getElementById('hora-inicio')?.value || '09:00';
            const horaFin = document.getElementById('hora-fin')?.value || '07:00';
            const esDiaSiguiente = document.getElementById('es-dia-siguiente')?.checked || false;

            console.log('💾 Guardando horario comercial:', { horaInicio, horaFin, esDiaSiguiente });

            // Actualizar configuración local
            this.config.horarioComercial = { 
                horaInicio, 
                horaFin, 
                esDiaSiguiente 
            };

            // Guardar en Firestore
            await window.db.collection('configuracion').doc('general').set({
                horarioComercial: {
                    horaInicio,
                    horaFin,
                    esDiaSiguiente
                }
            }, { merge: true });

            console.log('✅ Horario guardado en Firestore');

            // Notificar a otros módulos del cambio (EventBus global)
            if (window.eventBus) {
                window.eventBus.emit('horarioComercialActualizado', {
                    horaInicio,
                    horaFin,
                    esDiaSiguiente
                });
                console.log('📡 Evento horarioComercialActualizado emitido');
            }

            // Forzar recarga del módulo de ventas si está activo
            if (window.ventasModule) {
                console.log('🔄 Recargando historial de ventas...');
                await window.ventasModule.cargarVentas();
                if (window.ventasModule.currentTab === 'historial') {
                    await window.ventasModule.renderHistorial();
                }
                await window.ventasModule.actualizarEstadisticas();
            }

            alert('✅ Horario comercial guardado correctamente\n\nEl historial de ventas se ha actualizado con el nuevo horario.');
        } catch (error) {
            console.error('❌ Error guardando horario:', error);
            console.error('Código de error:', error.code);
            console.error('Mensaje:', error.message);
            
            let mensajeError = '❌ Error al guardar el horario';
            if (error.code === 'permission-denied') {
                mensajeError += '\n\nError de permisos. Verifica tu autenticación.';
            } else if (error.message) {
                mensajeError += `\n\n${error.message}`;
            }
            
            alert(mensajeError);
        } finally {
            if (loading) loading.classList.remove('active');
        }
    }

    async guardarNotificaciones() {
        const loading = document.getElementById('loading-overlay-config');
        if (loading) loading.classList.add('active');

        try {
            const notifStockBajo = document.getElementById('notif-stock-bajo')?.checked || false;
            const notifCreditos = document.getElementById('notif-creditos')?.checked || false;
            const notifVentas = document.getElementById('notif-ventas')?.checked || false;

            this.config.notificaciones = {
                stockBajo: notifStockBajo,
                creditos: notifCreditos,
                ventas: notifVentas
            };

            await window.db.collection('configuracion').doc('general').set(this.config, { merge: true });

            alert('✅ Preferencias de notificaciones guardadas');
        } catch (error) {
            console.error('Error guardando notificaciones:', error);
            alert('❌ Error al guardar las preferencias');
        } finally {
            if (loading) loading.classList.remove('active');
        }
    }

    async guardarConfiguracionDefecto() {
        const configDefecto = {
            negocio: {
                nombre: 'Mi Estanquillo',
                direccion: '',
                telefono: '',
                moneda: 'MXN',
                iva: 16
            },
            caja: {
                maxCajasAbiertas: 1
            },
            horarioComercial: {
                horaInicio: '09:00',
                horaFin: '07:00',
                esDiaSiguiente: true
            },
            notificaciones: {
                stockBajo: true,
                creditos: true,
                ventas: true
            },
            avanzado: {
                debug: false,
                syncAuto: true
            }
        };

        await window.db.collection('configuracion').doc('general').set(configDefecto);
        this.config = configDefecto;
    }

    async actualizarEstadoCajasAbiertas() {
        try {
            const cajasSnapshot = await window.db.collection('cajas')
                .where('estado', '==', 'abierta')
                .get();

            const cajasAbiertas = cajasSnapshot.size;
            const maxCajas = this.config.caja?.maxCajasAbiertas || 1;

            const countElement = document.getElementById('cajas-abiertas-count');
            if (countElement) {
                countElement.textContent = `${cajasAbiertas} / ${maxCajas} cajas abiertas`;
                countElement.style.color = cajasAbiertas >= maxCajas ? '#FF3B30' : '#007AFF';
            }
        } catch (error) {
            console.error('Error actualizando estado de cajas:', error);
        }
    }

    // Método público para validar si se puede abrir una nueva caja
    async puedeAbrirNuevaCaja() {
        try {
            const cajasSnapshot = await window.db.collection('cajas')
                .where('estado', '==', 'abierta')
                .get();

            const cajasAbiertas = cajasSnapshot.size;
            const maxCajas = this.config.caja?.maxCajasAbiertas || 1;

            return cajasAbiertas < maxCajas;
        } catch (error) {
            console.error('Error verificando límite de cajas:', error);
            return true; // En caso de error, permitir apertura
        }
    }

    limpiarCache() {
        if (confirm('¿Estás seguro de limpiar el caché local?\n\nEsto puede mejorar el rendimiento pero requerirá volver a cargar algunos datos.')) {
            localStorage.clear();
            sessionStorage.clear();
            alert('✅ Caché local limpiado correctamente');
            location.reload();
        }
    }

    toggleSeleccionarTodo() {
        const checkboxes = document.querySelectorAll('.reset-checkbox');
        const todosSeleccionados = Array.from(checkboxes).every(cb => cb.checked);
        
        checkboxes.forEach(cb => {
            cb.checked = !todosSeleccionados;
        });
    }

    async resetearDatos() {
        const checkboxes = {
            'reset-ventas': { collection: 'sales', nombre: 'Ventas' },
            'reset-cajas': { collection: ['cajas', 'cajas_activas'], nombre: 'Cajas' },
            'reset-abonos': { collection: 'abonos', nombre: 'Abonos' },
            'reset-pagos': { collection: 'pagos', nombre: 'Pagos' },
            'reset-productos': { collection: 'products', nombre: 'Productos' },
            'reset-clientes': { collection: 'clients', nombre: 'Clientes' },
            'reset-proveedores': { collection: 'providers', nombre: 'Proveedores' },
            'reset-compras': { collection: 'purchases', nombre: 'Compras' }
        };

        // Verificar qué colecciones están seleccionadas
        const seleccionadas = [];
        for (const [id, info] of Object.entries(checkboxes)) {
            const checkbox = document.getElementById(id);
            if (checkbox && checkbox.checked) {
                seleccionadas.push(info);
            }
        }

        if (seleccionadas.length === 0) {
            alert('⚠️ No has seleccionado ninguna colección para eliminar');
            return;
        }

        // Construir mensaje de confirmación
        const listaColecciones = seleccionadas.map(info => `  • ${info.nombre}`).join('\n');
        const mensaje = `⚠️ ADVERTENCIA: Esta acción es IRREVERSIBLE\n\nSe eliminarán TODOS los datos de:\n\n${listaColecciones}\n\n¿Estás completamente seguro?\n\nEscribe "CONFIRMAR" para continuar:`;

        const confirmacion = prompt(mensaje);
        
        if (confirmacion !== 'CONFIRMAR') {
            alert('❌ Operación cancelada');
            return;
        }

        const loading = document.getElementById('loading-overlay-config');
        if (loading) loading.classList.add('active');

        try {
            let totalEliminados = 0;

            for (const info of seleccionadas) {
                const collections = Array.isArray(info.collection) ? info.collection : [info.collection];
                
                for (const collectionName of collections) {
                    console.log(`🗑️ Eliminando colección: ${collectionName}`);
                    const eliminados = await this.eliminarColeccion(collectionName);
                    totalEliminados += eliminados;
                    console.log(`✅ ${eliminados} documentos eliminados de ${collectionName}`);
                }
            }

            alert(`✅ Reinicio completado exitosamente\n\n${totalEliminados} documentos eliminados\n\nLa página se recargará ahora.`);
            location.reload();

        } catch (error) {
            console.error('❌ Error durante el reinicio:', error);
            alert(`❌ Error al eliminar datos:\n\n${error.message}`);
        } finally {
            if (loading) loading.classList.remove('active');
        }
    }

    async eliminarColeccion(nombreColeccion) {
        const batchSize = 100;
        let totalEliminados = 0;

        const eliminarLote = async () => {
            const snapshot = await window.db.collection(nombreColeccion)
                .limit(batchSize)
                .get();

            if (snapshot.empty) {
                return 0;
            }

            const batch = window.db.batch();
            snapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });

            await batch.commit();
            return snapshot.size;
        };

        let eliminados;
        do {
            eliminados = await eliminarLote();
            totalEliminados += eliminados;
        } while (eliminados === batchSize);

        return totalEliminados;
    }

    async resetearConfiguracion() {
        if (confirm('⚠️ ¿Estás seguro de restaurar la configuración por defecto?\n\nEsta acción no se puede deshacer.')) {
            try {
                await this.guardarConfiguracionDefecto();
                alert('✅ Configuración restaurada correctamente');
                location.reload();
            } catch (error) {
                console.error('Error reseteando configuración:', error);
                alert('❌ Error al restaurar la configuración');
            }
        }
    }

    // Método público para obtener el horario comercial (usado por otros módulos)
    obtenerHorarioComercial() {
        return this.config.horarioComercial;
    }

    // Método público para obtener el rango del día comercial actual
    obtenerDiaComercialActual() {
        const { horaInicio, horaFin, esDiaSiguiente } = this.config.horarioComercial;
        return this.calcularDiaComercial(horaInicio, horaFin, esDiaSiguiente);
    }

    destroy() {
        console.log('⚙️ Módulo de configuración descargado');
    }
}

// Inicializar módulo
let configuracionModule = null;

function loadConfiguracionModule() {
    configuracionModule = new ConfiguracionModule();
    
    // Hacer disponible globalmente para que otros módulos puedan consultarlo
    window.configuracionModule = configuracionModule;
}

// Auto-inicializar si ya está en el DOM
if (document.querySelector('.configuracion-module')) {
    loadConfiguracionModule();
}
