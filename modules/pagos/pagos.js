
// Módulo de Pagos - Gestión Financiera Profesional
class PagosModule {
    constructor() {
        this.efectivoTotal = 0;
        this.movimientos = [];
        this.usuarios = [];
        this.currentTab = 'resumen';
        this.calendarioMes = new Date().getMonth();
        this.calendarioAnio = new Date().getFullYear();
        this.moduleId = 'pagos';
        this.diasSeleccionados = new Set();
        this.modoMultiPago = false;
        this.pagosMultipago = []; // ✨ Array para almacenar pagos temporales
        this.batchId = null; // ✨ ID de lote para agrupar pagos
        this.init();
    }

    async init() {
        console.log('💰 Inicializando módulo de pagos...');
        
        this.showLoading();
        
        try {
            await this.ensureModalsExist(); // ✅ Crear modales si no existen
            await this.cargarConfiguracion();
            await this.cargarMovimientos();
            await this.cargarUsuarios();
            
            this.setupEventListeners();
            this.setupModalEventListeners(); // ✅ SIEMPRE configurar event listeners de modales
            this.setupTabsSystem();
            this.actualizarEstadisticas();
            this.renderUltimosMovimientos();
            this.renderCalendario();
            
            // 🚀 SINCRONIZACIÓN DE ABONOS ANTIGUOS (One-time check)
            this.sincronizarAbonosAntiguos();
            
            console.log('✅ Módulo de pagos inicializado');
        } catch (error) {
            console.error('Error inicializando módulo de pagos:', error);
            this.showNotification('Error al cargar el módulo de pagos', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async ensureModalsExist() {
        // Verificar si los modales ya existen en el contenedor permanente
        if (document.getElementById('modal-movimiento')) {
            console.log('✅ Modales de pagos ya existen en el DOM permanente');
            return;
        }

        console.log('📦 Creando modales de pagos en el contenedor permanente...');
        
        // Obtener el contenedor permanente
        const permanentContainer = document.getElementById('permanent-modals-container');
        if (!permanentContainer) {
            console.error('❌ Contenedor permanente no encontrado');
            return;
        }

        // Cargar el HTML de los modales
        try {
            const response = await fetch('./modules/pagos/pagos-modals.html');
            const modalsHTML = await response.text();
            
            // Crear un div temporal para parsear el HTML
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = modalsHTML;
            
            // Mover los modales al contenedor permanente
            while (tempDiv.firstChild) {
                permanentContainer.appendChild(tempDiv.firstChild);
            }
            
            console.log('✅ Modales de pagos creados en contenedor permanente');
            
        } catch (error) {
            console.error('❌ Error cargando modales:', error);
        }
    }

    setupModalEventListeners() {
        console.log('🔧 Configurando event listeners de modales de pagos...');
        
        const formMovimiento = document.getElementById('form-movimiento');
        if (formMovimiento) {
            // Eliminar listeners previos para evitar duplicidad
            const newForm = formMovimiento.cloneNode(true);
            formMovimiento.parentNode.replaceChild(newForm, formMovimiento);
            
            newForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.guardarMovimiento();
            });
        }

        const modalMovimiento = document.getElementById('modal-movimiento');
        const closeMovimiento = document.getElementById('modal-movimiento-close');
        const btnCancelarMovimiento = document.getElementById('btn-cancelar-movimiento');

        if (closeMovimiento) {
            closeMovimiento.onclick = () => this.cerrarModal('modal-movimiento');
        }

        if (btnCancelarMovimiento) {
            btnCancelarMovimiento.onclick = () => this.cerrarModal('modal-movimiento');
        }

        if (modalMovimiento) {
            modalMovimiento.onclick = (e) => {
                if (e.target === modalMovimiento) {
                    this.cerrarModal('modal-movimiento');
                }
            };
        }

        // Event listeners del modal de nómina MULTIPAGO
        const btnAgregarPago = document.getElementById('btn-agregar-pago');
        const btnGuardarMultipago = document.getElementById('btn-guardar-multipago');
        const closeNomina = document.getElementById('modal-nomina-close');
        const btnCancelarNomina = document.getElementById('btn-cancelar-nomina');
        const modalNomina = document.getElementById('modal-pago-nomina');

        if (closeNomina) closeNomina.onclick = () => this.cerrarModal('modal-pago-nomina');
        if (btnCancelarNomina) btnCancelarNomina.onclick = () => this.cerrarModal('modal-pago-nomina');
        if (btnAgregarPago) btnAgregarPago.onclick = () => this.agregarPagoMultipago();
        if (btnGuardarMultipago) btnGuardarMultipago.onclick = () => this.guardarPagosMultipago();
        if (modalNomina) {
            modalNomina.onclick = (e) => {
                if (e.target === modalNomina) this.cerrarModal('modal-pago-nomina');
            };
        }

        console.log('✅ Event listeners de modales de pagos configurados (Anti-duplicidad)');
    }

    setupEventListeners() {
        console.log('👂 Configurando event listeners de pagos...');
        
        // Tabs
        document.querySelectorAll('.pagos-tab').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.cambiarTab(e.currentTarget.dataset.tab);
            });
        });

        // 🛠️ FIX PROFESIONAL: Delegación de eventos ultra-robusta
        // El problema era que el listener se perdía al recargar el módulo o se duplicaba.
        // Usamos un patrón de delegación única para asegurar consistencia.
        if (this.clickListener) {
            document.removeEventListener('click', this.clickListener);
        }

        this.clickListener = (e) => {
            const btnIngreso = e.target.closest('#btn-nuevo-ingreso');
            const btnEgreso = e.target.closest('#btn-nuevo-egreso');
            
            if (btnIngreso) {
                e.preventDefault();
                e.stopPropagation();
                console.log('📥 Click en Nuevo Ingreso (Delegación)');
                this.abrirModalMovimiento('ingreso');
            } else if (btnEgreso) {
                e.preventDefault();
                e.stopPropagation();
                console.log('📤 Click en Nuevo Egreso (Delegación)');
                this.abrirModalMovimiento('egreso');
            }
        };

        document.addEventListener('click', this.clickListener);

        // Calendario
        document.getElementById('btn-mes-anterior')?.addEventListener('click', () => {
            this.calendarioMes--;
            if (this.calendarioMes < 0) {
                this.calendarioMes = 11;
                this.calendarioAnio--;
            }
            this.renderCalendario();
        });

        document.getElementById('btn-mes-siguiente')?.addEventListener('click', () => {
            this.calendarioMes++;
            if (this.calendarioMes > 11) {
                this.calendarioMes = 0;
                this.calendarioAnio++;
            }
            this.renderCalendario();
        });

        // Filtros de historial
        document.getElementById('filter-tipo-movimiento')?.addEventListener('change', () => {
            this.aplicarFiltros();
        });

        document.getElementById('filter-periodo')?.addEventListener('change', () => {
            this.aplicarFiltros();
        });

        document.getElementById('search-historial')?.addEventListener('input', () => {
            this.aplicarFiltros();
        });

        // Fecha actual por defecto en modal de nómina
        const fechaPagoInput = document.getElementById('fecha-pago-nomina');
        if (fechaPagoInput) {
            fechaPagoInput.value = new Date().toISOString().split('T')[0];
        }
    }

    cerrarModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            // Limpiar formulario si es el de movimiento
            if (modalId === 'modal-movimiento') {
                const form = document.getElementById('form-movimiento');
                if (form) form.reset();
            }
        }
    }

    setupTabsSystem() {
        const tabs = document.querySelectorAll('.pagos-tab');
        const indicator = document.querySelector('.tab-indicator');
        
        if (!indicator) return;

        const activeTab = document.querySelector('.pagos-tab.active');
        if (activeTab) {
            this.updateTabIndicator(activeTab, indicator, false);
        }

        window.addEventListener('resize', () => {
            const currentActiveTab = document.querySelector('.pagos-tab.active');
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

    cambiarTab(tab) {
        this.currentTab = tab;

        document.querySelectorAll('.pagos-tab').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const targetTab = document.querySelector(`[data-tab="${tab}"]`);
        if (targetTab) {
            targetTab.classList.add('active');
            
            const indicator = document.querySelector('.tab-indicator');
            if (indicator) {
                this.updateTabIndicator(targetTab, indicator, true);
            }
        }

        document.querySelectorAll('.pagos-tab-content').forEach(content => {
            content.classList.remove('active');
        });
        
        const targetContent = document.getElementById(`tab-${tab}`);
        if (targetContent) {
            setTimeout(() => {
                targetContent.classList.add('active');
            }, 150);
        }

        if (tab === 'historial') {
            this.renderHistorial();
        } else if (tab === 'nomina') {
            this.renderCalendario();
            this.renderHistorialNomina();
        }
    }

    async cargarConfiguracion() {
        try {
            const doc = await window.db.collection('configuracion').doc('general').get();
            
            if (doc.exists) {
                const config = doc.data();
                this.efectivoTotal = config.pagos?.efectivoInicial || 0;
            } else {
                this.efectivoTotal = 0;
            }

            this.actualizarDisplayEfectivo();
        } catch (error) {
            console.error('Error cargando configuración de pagos:', error);
        }
    }

    async cargarMovimientos() {
        try {
            const querySnapshot = await window.db.collection('pagos')
                .orderBy('fecha', 'desc')
                .get();

            this.movimientos = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            console.log(`✅ ${this.movimientos.length} movimientos cargados`);
        } catch (error) {
            console.error('Error cargando movimientos:', error);
            this.movimientos = [];
        }
    }

    async cargarUsuarios() {
        try {
            const querySnapshot = await window.db.collection('users').get();
            
            this.usuarios = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            this.renderSelectEmpleados();
        } catch (error) {
            console.error('Error cargando usuarios:', error);
            this.usuarios = [];
        }
    }

    renderSelectEmpleados() {
        const select = document.getElementById('empleado-multipago-select');
        if (!select) return;

        select.innerHTML = '<option value="">Seleccionar empleado</option>';
        
        this.usuarios.forEach(usuario => {
            const nombre = usuario.personalInfo?.nombre || 'Sin nombre';
            select.innerHTML += `<option value="${usuario.id}">${nombre}</option>`;
        });
    }

    actualizarEstadisticas() {
        const totalIngresos = this.movimientos
            .filter(m => m.tipo === 'ingreso')
            .reduce((sum, m) => sum + (m.monto || 0), 0);

        const totalEgresos = this.movimientos
            .filter(m => m.tipo === 'egreso')
            .reduce((sum, m) => sum + (m.monto || 0), 0);

        const totalNomina = this.movimientos
            .filter(m => m.tipo === 'nomina')
            .reduce((sum, m) => sum + (m.monto || 0), 0);

        const formatter = window.currencyFormatter;

        if (document.getElementById('total-ingresos')) {
            document.getElementById('total-ingresos').textContent = formatter 
                ? formatter.format(totalIngresos) 
                : '$' + totalIngresos.toFixed(2);
        }

        if (document.getElementById('total-egresos')) {
            document.getElementById('total-egresos').textContent = formatter 
                ? formatter.format(totalEgresos) 
                : '$' + totalEgresos.toFixed(2);
        }

        if (document.getElementById('total-nomina')) {
            document.getElementById('total-nomina').textContent = formatter 
                ? formatter.format(totalNomina) 
                : '$' + totalNomina.toFixed(2);
        }

        // Calcular efectivo total
        this.efectivoTotal = (this.efectivoTotal || 0) + totalIngresos - totalEgresos - totalNomina;
        this.actualizarDisplayEfectivo();

        // Stats de nómina
        const pagosMes = this.movimientos.filter(m => {
            if (m.tipo !== 'nomina') return false;
            const fecha = m.fecha.toDate();
            return fecha.getMonth() === new Date().getMonth() && 
                   fecha.getFullYear() === new Date().getFullYear();
        });

        if (document.getElementById('pagos-mes')) {
            document.getElementById('pagos-mes').textContent = formatter 
                ? formatter.format(pagosMes.reduce((sum, m) => sum + m.monto, 0))
                : '$' + pagosMes.reduce((sum, m) => sum + m.monto, 0).toFixed(2);
        }

        if (document.getElementById('total-empleados')) {
            document.getElementById('total-empleados').textContent = this.usuarios.length;
        }
    }

    actualizarDisplayEfectivo() {
        const formatter = window.currencyFormatter;
        const displayElement = document.getElementById('efectivo-total');
        
        if (displayElement) {
            displayElement.textContent = formatter 
                ? formatter.format(this.efectivoTotal) 
                : '$' + this.efectivoTotal.toFixed(2);
        }
    }

    renderUltimosMovimientos() {
        const container = document.getElementById('ultimos-movimientos-list');
        if (!container) return;

        const ultimos = this.movimientos.slice(0, 5);

        if (ultimos.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #6D6D80;">
                    No hay movimientos registrados
                </div>
            `;
            return;
        }

        const formatter = window.currencyFormatter;

        container.innerHTML = ultimos.map(mov => {
            const fecha = mov.fecha.toDate();
            const iconClass = mov.tipo === 'ingreso' ? 'ingreso' : mov.tipo === 'egreso' ? 'egreso' : 'nomina';
            const icon = mov.tipo === 'ingreso' ? '📈' : mov.tipo === 'egreso' ? '📉' : '👤';
            const montoClass = mov.tipo === 'ingreso' ? 'positivo' : 'negativo';
            const signo = mov.tipo === 'ingreso' ? '+' : '-';

            return `
                <div class="movimiento-item">
                    <div class="movimiento-info">
                        <div class="movimiento-icon ${iconClass}">${icon}</div>
                        <div class="movimiento-detalles">
                            <h4>${mov.concepto}</h4>
                            <p>${fecha.toLocaleDateString('es-MX')} • ${mov.categoria || 'Sin categoría'}</p>
                        </div>
                    </div>
                    <div class="movimiento-monto ${montoClass}">
                        ${signo}${formatter ? formatter.format(mov.monto) : '$' + mov.monto.toFixed(2)}
                    </div>
                </div>
            `;
        }).join('');
    }

    abrirModalMovimiento(tipo) {
        const modal = document.getElementById('modal-movimiento');
        const title = document.getElementById('modal-movimiento-title');
        
        if (modal) {
            // Reset completo: modal, wrapper y content (igual que notas y créditos)
            modal.style.cssText = '';
            const wrapper = modal.querySelector('.modal-pagos-wrapper');
            const content = modal.querySelector('.modal-pagos-content');
            
            if (wrapper) wrapper.style.cssText = '';
            if (content) content.style.cssText = '';
            
            // Resetear formulario
            document.getElementById('tipo-movimiento').value = tipo;
            document.getElementById('concepto-movimiento').value = '';
            document.getElementById('monto-movimiento').value = '';
            document.getElementById('observaciones-movimiento').value = '';
            document.getElementById('categoria-movimiento').value = '';
            
            title.textContent = tipo === 'ingreso' ? 'Nuevo Ingreso' : 'Nuevo Egreso';
            
            // Activar modal
            modal.classList.add('active');
            
            // Forzar reflow
            void modal.offsetHeight;
        }
    }

    async guardarMovimiento() {
        if (this.isSaving) return; // 🛡️ Bloqueo de re-entrada (evita doble click)
        
        const btnGuardar = document.querySelector('#form-movimiento button[type="submit"]');
        if (btnGuardar) {
            btnGuardar.disabled = true;
            btnGuardar.innerHTML = '<span>Procesando...</span>';
        }

        this.isSaving = true;
        this.showLoading();

        try {
            const tipo = document.getElementById('tipo-movimiento').value;
            const concepto = document.getElementById('concepto-movimiento').value.trim();
            const monto = parseFloat(document.getElementById('monto-movimiento').value);
            const categoria = document.getElementById('categoria-movimiento').value;
            const observaciones = document.getElementById('observaciones-movimiento').value.trim();

            if (!concepto || isNaN(monto) || monto <= 0) {
                throw new Error('Por favor completa todos los campos correctamente');
            }

            const userId = window.authSystem?.currentUser?.uid || 'unknown';
            const userName = window.authSystem?.currentUser?.nombre || 'Sistema';

            const movimiento = {
                tipo,
                concepto,
                monto,
                categoria,
                observaciones,
                fecha: firebase.firestore.Timestamp.fromDate(new Date()),
                registradoPor: userId,
                registradoPorNombre: userName,
                metadata: {
                    createdAt: new Date(),
                    device: navigator.userAgent
                }
            };

            await window.db.collection('pagos').add(movimiento);

            this.cerrarModal('modal-movimiento');
            await this.cargarMovimientos();
            this.actualizarEstadisticas();
            this.renderUltimosMovimientos();
            
            if (this.currentTab === 'historial') {
                this.renderHistorial();
            }

            this.showNotification(`${tipo === 'ingreso' ? 'Ingreso' : 'Egreso'} registrado correctamente`, 'success');
        } catch (error) {
            console.error('Error guardando movimiento:', error);
            this.showNotification(error.message || 'Error al guardar el movimiento', 'error');
        } finally {
            this.isSaving = false;
            if (btnGuardar) {
                btnGuardar.disabled = false;
                btnGuardar.innerHTML = '<span>Guardar Movimiento</span>';
            }
            this.hideLoading();
        }
    }

    agregarPagoMultipago() {
        const empleadoId = document.getElementById('empleado-multipago-select').value;
        const monto = parseFloat(document.getElementById('monto-multipago-input').value);

        if (!empleadoId || !monto || monto <= 0) {
            this.showNotification('Por favor completa todos los campos', 'error');
            return;
        }

        if (!this.fechaDiaSeleccionado) {
            this.showNotification('Error: fecha no válida', 'error');
            return;
        }

        const empleado = this.usuarios.find(u => u.id === empleadoId);
        const empleadoNombre = empleado?.personalInfo?.nombre || 'Desconocido';
        const fechaString = this.getLocalDateString(this.fechaDiaSeleccionado);

        this.pagosMultipago.push({
            empleadoId,
            empleadoNombre,
            fecha: fechaString,
            monto
        });

        document.getElementById('empleado-multipago-select').value = '';
        document.getElementById('monto-multipago-input').value = '';

        this.renderTablaPagosMultipago();
    }

    eliminarPagoMultipago(index) {
        this.pagosMultipago.splice(index, 1);
        this.renderTablaPagosMultipago();
    }

    renderTablaPagosMultipago() {
        const tbody = document.getElementById('tabla-pagos-agregados');
        const totalElement = document.getElementById('total-multipago');
        const btnGuardar = document.getElementById('btn-guardar-multipago');
        const formatter = window.currencyFormatter;

        const pagosExistentes = this.movimientos.filter(m => {
            if (m.tipo !== 'nomina' || !this.fechaDiaSeleccionado) return false;
            const fechaPago = m.fecha.toDate();
            return fechaPago.getDate() === this.fechaDiaSeleccionado.getDate() && 
                   fechaPago.getMonth() === this.fechaDiaSeleccionado.getMonth() &&
                   fechaPago.getFullYear() === this.fechaDiaSeleccionado.getFullYear();
        });

        let html = '';
        let totalNuevos = 0; // Solo suma los nuevos pagos

        // Mostrar pagos existentes (NO se suman en el total)
        if (pagosExistentes.length > 0) {
            html += pagosExistentes.map(pago => {
                const fechaPago = pago.fecha.toDate();
                const fechaFormato = fechaPago.toLocaleDateString('es-MX');
                return `
                    <tr style="border-bottom: 1px solid #E8E8F0; background: #F5F5FA;">
                        <td style="padding: 8px; color: #007AFF; font-weight: 600;">${pago.empleadoNombre}</td>
                        <td style="padding: 8px; font-size: 0.9rem; color: #666;">${fechaFormato}</td>
                        <td style="padding: 8px; text-align: right; color: #007AFF; font-weight: 600;">$${pago.monto.toFixed(2)}</td>
                        <td style="padding: 8px; text-align: center;">
                            <span style="color: #34C759; font-size: 0.8rem; font-weight: 600;">✓</span>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        // Mostrar pagos nuevos a agregar (ESTOS si se suman)
        if (this.pagosMultipago.length > 0) {
            html += this.pagosMultipago.map((pago, index) => {
                totalNuevos += pago.monto;
                return `
                    <tr style="border-bottom: 1px solid #E8E8F0;">
                        <td style="padding: 8px;">${pago.empleadoNombre}</td>
                        <td style="padding: 8px; font-size: 0.9rem; color: #34C759; font-weight: 600;">${pago.fecha}</td>
                        <td style="padding: 8px; text-align: right; color: #34C759; font-weight: 600;">$${pago.monto.toFixed(2)}</td>
                        <td style="padding: 8px; text-align: center;">
                            <button type="button" onclick="window.pagosModule.eliminarPagoMultipago(${index})" style="background: #FF3B30; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">
                                Eliminar
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        if (html === '') {
            html = `<tr style="text-align: center; color: #6D6D80;"><td colspan="4" style="padding: 20px;">Sin pagos para este día</td></tr>`;
        }

        tbody.innerHTML = html;
        totalElement.textContent = formatter ? formatter.format(totalNuevos) : '$' + totalNuevos.toFixed(2);
        btnGuardar.disabled = this.pagosMultipago.length === 0;
    }

    parseDateCorrectly(dateString) {
        const [year, month, day] = dateString.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        return date;
    }

    async guardarPagosMultipago() {
        if (this.pagosMultipago.length === 0) {
            this.showNotification('Debes agregar al menos un pago', 'error');
            return;
        }

        this.showLoading();

        try {
            const userId = window.authSystem?.currentUser?.uid;
            const userName = window.authSystem?.currentUser?.nombre || 'Sistema';
            this.batchId = `batch_${Date.now()}`;
            const cantidadPagos = this.pagosMultipago.length;

            for (const pago of this.pagosMultipago) {
                const fechaPago = this.parseDateCorrectly(pago.fecha);
                const pagoDoc = {
                    tipo: 'nomina',
                    concepto: `Pago a ${pago.empleadoNombre}`,
                    monto: pago.monto,
                    categoria: 'nomina',
                    observaciones: '',
                    fecha: firebase.firestore.Timestamp.fromDate(fechaPago),
                    empleadoId: pago.empleadoId,
                    empleadoNombre: pago.empleadoNombre,
                    registradoPor: userId,
                    registradoPorNombre: userName,
                    batchId: this.batchId
                };

                await window.db.collection('pagos').add(pagoDoc);
            }

            this.pagosMultipago = [];
            this.batchId = null;
            this.cerrarModal('modal-pago-nomina');
            await this.cargarMovimientos();
            this.actualizarEstadisticas();
            this.renderCalendario();
            this.renderHistorialNomina();

            this.showNotification(`✅ ${cantidadPagos} pagos registrados correctamente`, 'success');
        } catch (error) {
            console.error('Error guardando pagos de nómina:', error);
            this.showNotification('Error al registrar los pagos', 'error');
        } finally {
            this.hideLoading();
        }
    }

    renderCalendario() {
        const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                       'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

        document.getElementById('calendario-mes-actual').textContent = 
            `${meses[this.calendarioMes]} ${this.calendarioAnio}`;

        const container = document.getElementById('calendario-dias-container');
        if (!container) return;

        const primerDia = new Date(this.calendarioAnio, this.calendarioMes, 1);
        const ultimoDia = new Date(this.calendarioAnio, this.calendarioMes + 1, 0);
        const diasMes = ultimoDia.getDate();
        const primerDiaSemana = primerDia.getDay();

        // Días del mes anterior
        const ultimoDiaMesAnterior = new Date(this.calendarioAnio, this.calendarioMes, 0).getDate();
        const diasMesAnterior = primerDiaSemana;

        let html = '';

        // Días del mes anterior
        for (let i = diasMesAnterior - 1; i >= 0; i--) {
            html += `<div class="calendario-dia otro-mes">${ultimoDiaMesAnterior - i}</div>`;
        }

        // Días del mes actual
        const hoy = new Date();
        const pagosPorDia = this.movimientos.filter(m => m.tipo === 'nomina');

        for (let dia = 1; dia <= diasMes; dia++) {
            const fecha = new Date(this.calendarioAnio, this.calendarioMes, dia);
            const fechaKey = fecha.toDateString();
            const esHoy = fechaKey === hoy.toDateString();
            const estaSeleccionado = this.diasSeleccionados.has(fechaKey);
            const tienePago = pagosPorDia.some(p => {
                const fechaPago = p.fecha.toDate();
                return fechaPago.getDate() === dia && 
                       fechaPago.getMonth() === this.calendarioMes &&
                       fechaPago.getFullYear() === this.calendarioAnio;
            });

            let classes = 'calendario-dia';
            if (esHoy) classes += ' hoy';
            if (tienePago) classes += ' con-pago';
            if (estaSeleccionado) classes += ' seleccionado';

            html += `<div class="${classes}" data-fecha="${fechaKey}">${dia}</div>`;
        }

        container.innerHTML = html;

        // Event listeners para los días - Click simple abre modal
        container.querySelectorAll('.calendario-dia:not(.otro-mes)').forEach(dia => {
            dia.addEventListener('click', (e) => {
                const fechaKey = dia.dataset.fecha;
                if (fechaKey) {
                    const [year, month, day] = fechaKey.split(' ');
                    const fecha = new Date(year, new Date(`${month} 1`).getMonth(), parseInt(day));
                    this.abrirModalPagoNomina(fecha);
                }
            });
        });
    }

    actualizarBotonPagar() {
        // Mostrar/ocultar botón de pago múltiple si hay días seleccionados
        const btnPagarMultiple = document.getElementById('btn-pagar-nomina-multiple');
        if (btnPagarMultiple) {
            if (this.diasSeleccionados.size > 1) {
                btnPagarMultiple.style.display = 'flex';
                btnPagarMultiple.textContent = `Pagar ${this.diasSeleccionados.size} días`;
            } else {
                btnPagarMultiple.style.display = 'none';
            }
        }
    }

    getLocalDateString(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    abrirModalPagoNomina(fecha) {
        const modal = document.getElementById('modal-pago-nomina');
        
        if (modal) {
            // Limpiar pagos multipago
            this.pagosMultipago = [];
            this.batchId = null;
            this.fechaDiaSeleccionado = fecha;
            
            // Renderizar contenido ANTES de mostrar el modal
            this.renderPagosDelDia(fecha);
            this.renderTablaPagosMultipago();
            
            // Inicializar fecha por defecto con zona horaria correcta
            const fechaInput = document.getElementById('fecha-multipago-input');
            if (fechaInput && fecha) {
                fechaInput.value = this.getLocalDateString(fecha);
                fechaInput.disabled = false; // Permitir cambiar la fecha
                // Cuando cambie la fecha, actualizar fechaDiaSeleccionado
                fechaInput.addEventListener('change', (e) => {
                    if (e.target.value) {
                        const [year, month, day] = e.target.value.split('-');
                        this.fechaDiaSeleccionado = new Date(year, month - 1, day);
                    }
                });
            }
            
            // Mostrar modal con contenido ya renderizado
            modal.classList.add('active');
            void modal.offsetHeight;
        }
    }

    renderPagosDelDia(fecha) {
        const pagosDelDia = this.movimientos.filter(m => {
            if (m.tipo !== 'nomina') return false;
            const fechaPago = m.fecha.toDate();
            return fechaPago.getDate() === fecha.getDate() && 
                   fechaPago.getMonth() === fecha.getMonth() &&
                   fechaPago.getFullYear() === fecha.getFullYear();
        });

        const tbody = document.getElementById('tabla-pagos-agregados');
        if (!tbody) return;

        if (pagosDelDia.length === 0) {
            tbody.innerHTML = `<tr style="text-align: center; color: #6D6D80;"><td colspan="4" style="padding: 20px;">Sin pagos para este día</td></tr>`;
            return;
        }

        const formatter = window.currencyFormatter;
        let total = 0;
        tbody.innerHTML = pagosDelDia.map((pago, index) => {
            total += pago.monto;
            return `
                <tr style="border-bottom: 1px solid #E8E8F0; background: #F5F5FA;">
                    <td style="padding: 8px; color: #007AFF; font-weight: 600;">${pago.empleadoNombre}</td>
                    <td style="padding: 8px; font-size: 0.9rem; color: #666;">Ya registrado</td>
                    <td style="padding: 8px; text-align: right; color: #007AFF; font-weight: 600;">$${pago.monto.toFixed(2)}</td>
                    <td style="padding: 8px; text-align: center;">
                        <span style="color: #34C759; font-size: 0.8rem; font-weight: 600;">✓</span>
                    </td>
                </tr>
            `;
        }).join('');

        // Mostrar total
        const totalElement = document.getElementById('total-multipago');
        if (totalElement) {
            totalElement.textContent = formatter ? formatter.format(total) : '$' + total.toFixed(2);
        }
    }

    renderHistorial() {
        const tbody = document.getElementById('historial-movimientos-body');
        if (!tbody) return;

        if (this.movimientos.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 40px; color: #6D6D80;">
                        No hay movimientos registrados
                    </td>
                </tr>
            `;
            return;
        }

        const formatter = window.currencyFormatter;

        tbody.innerHTML = this.movimientos.map(mov => {
            const fecha = mov.fecha.toDate();
            const tipoBadge = mov.tipo === 'ingreso' ? 
                '<span style="background: #D1F4E0; color: #0A6E3B; padding: 4px 12px; border-radius: 12px; font-size: 0.85rem; font-weight: 600;">Ingreso</span>' :
                mov.tipo === 'egreso' ?
                '<span style="background: #F8D7DA; color: #842029; padding: 4px 12px; border-radius: 12px; font-size: 0.85rem; font-weight: 600;">Egreso</span>' :
                '<span style="background: #CFE2FF; color: #084298; padding: 4px 12px; border-radius: 12px; font-size: 0.85rem; font-weight: 600;">Nómina</span>';

            const montoColor = mov.tipo === 'ingreso' ? '#34C759' : '#FF3B30';
            const signo = mov.tipo === 'ingreso' ? '+' : '-';

            return `
                <tr>
                    <td>${fecha.toLocaleDateString('es-MX')}</td>
                    <td>${tipoBadge}</td>
                    <td>${mov.concepto}</td>
                    <td style="color: ${montoColor}; font-weight: 700;">
                        ${signo}${formatter ? formatter.format(mov.monto) : '$' + mov.monto.toFixed(2)}
                    </td>
                    <td>${mov.registradoPorNombre || 'Sistema'}</td>
                </tr>
            `;
        }).join('');
    }

    async sincronizarAbonosAntiguos() {
        // Usar una clave más específica para asegurar que corra al menos una vez tras la corrección
        const syncKey = 'abonos_sincronizados_v2'; 
        if (localStorage.getItem(syncKey)) return;

        console.log('🔄 Iniciando sincronización de abonos antiguos...');
        try {
            // 1. Obtener todos los abonos (asegurando que db esté disponible)
            const db = window.db;
            if (!db) {
                console.warn('⚠️ Base de datos no disponible para sincronización');
                return;
            }

            const abonosSnapshot = await db.collection('abonos').get();
            if (abonosSnapshot.empty) {
                console.log('ℹ️ No hay abonos para sincronizar.');
                localStorage.setItem(syncKey, 'true');
                return;
            }

            // 2. Obtener todos los pagos existentes que sean abonos para evitar duplicados
            const pagosSnapshot = await db.collection('pagos').where('categoria', '==', 'Abonos Créditos').get();
            const referenciasExistentes = new Set();
            pagosSnapshot.forEach(doc => {
                const data = doc.data();
                if (data.referenciaId) referenciasExistentes.add(data.referenciaId);
            });

            const batch = db.batch();
            let count = 0;

            for (const doc of abonosSnapshot.docs) {
                const abono = doc.data();
                if (!referenciasExistentes.has(doc.id)) {
                    const nuevoPagoRef = db.collection('pagos').doc();
                    
                    // Normalizar fecha
                    let fechaAbono = abono.fecha;
                    if (!fechaAbono) {
                        fechaAbono = firebase.firestore.Timestamp.now();
                    }

                    batch.set(nuevoPagoRef, {
                        tipo: 'ingreso',
                        concepto: `Sincronización: Abono de ${abono.clienteNombre || 'Cliente'} (Venta: ${abono.folioVenta || 'N/A'})`,
                        monto: parseFloat(abono.monto) || 0,
                        categoria: 'Abonos Créditos',
                        observaciones: abono.notas || 'Sincronización de abono antiguo',
                        fecha: fechaAbono,
                        registradoPor: abono.recibidoPor || 'system',
                        registradoPorNombre: abono.recibidoPorNombre || 'Sistema',
                        referenciaId: doc.id,
                        ventaId: abono.ventaId || null,
                        metadata: { 
                            sincronizado: true, 
                            fechaSincronizacion: firebase.firestore.Timestamp.now() 
                        }
                    });
                    count++;
                }
            }

            if (count > 0) {
                await batch.commit();
                console.log(`✅ Se sincronizaron ${count} abonos antiguos a la caja mayor.`);
                
                // Forzar recarga de datos en el módulo
                await this.cargarMovimientos();
                this.actualizarEstadisticas();
                this.renderUltimosMovimientos();
                
                if (this.currentTab === 'historial') {
                    this.renderHistorial();
                }
                
                this.showNotification(`✅ Se sincronizaron ${count} abonos antiguos con la caja mayor`, 'success');
            } else {
                console.log('ℹ️ Todos los abonos ya estaban sincronizados.');
            }

            localStorage.setItem(syncKey, 'true');
        } catch (error) {
            console.error('❌ Error sincronizando abonos antiguos:', error);
        }
    }

    renderHistorialNomina() {
        const tbody = document.getElementById('historial-nomina-body');
        if (!tbody) return;

        const pagosNomina = this.movimientos.filter(m => m.tipo === 'nomina');

        if (pagosNomina.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; padding: 40px; color: #6D6D80;">
                        No hay pagos de nómina registrados
                    </td>
                </tr>
            `;
            return;
        }

        const formatter = window.currencyFormatter;

        tbody.innerHTML = pagosNomina.map(pago => {
            const fecha = pago.fecha.toDate();
            const isBatch = pago.batchId ? ' (Lote)' : '';
            return `
                <tr>
                    <td>${fecha.toLocaleDateString('es-MX')}</td>
                    <td>${pago.empleadoNombre}${isBatch}</td>
                    <td style="color: #007AFF; font-weight: 700;">
                        ${formatter ? formatter.format(pago.monto) : '$' + pago.monto.toFixed(2)}
                    </td>
                    <td>${pago.observaciones || '-'}</td>
                </tr>
            `;
        }).join('');
    }

    aplicarFiltros() {
        const tipoFiltro = document.getElementById('filter-tipo-movimiento')?.value || '';
        const periodoFiltro = document.getElementById('filter-periodo')?.value || 'todos';
        const busqueda = document.getElementById('search-historial')?.value.toLowerCase() || '';

        let movimientosFiltrados = [...this.movimientos];

        // Filtrar por tipo
        if (tipoFiltro) {
            movimientosFiltrados = movimientosFiltrados.filter(m => m.tipo === tipoFiltro);
        }

        // Filtrar por período
        if (periodoFiltro !== 'todos') {
            const ahora = new Date();
            movimientosFiltrados = movimientosFiltrados.filter(m => {
                const fecha = m.fecha.toDate();
                
                if (periodoFiltro === 'hoy') {
                    return fecha.toDateString() === ahora.toDateString();
                } else if (periodoFiltro === 'semana') {
                    const unaSemanaAtras = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000);
                    return fecha >= unaSemanaAtras;
                } else if (periodoFiltro === 'mes') {
                    return fecha.getMonth() === ahora.getMonth() && 
                           fecha.getFullYear() === ahora.getFullYear();
                }
                
                return true;
            });
        }

        // Filtrar por búsqueda
        if (busqueda) {
            movimientosFiltrados = movimientosFiltrados.filter(m => 
                m.concepto.toLowerCase().includes(busqueda) ||
                (m.observaciones && m.observaciones.toLowerCase().includes(busqueda))
            );
        }

        // Renderizar
        const tbody = document.getElementById('historial-movimientos-body');
        if (!tbody) return;

        if (movimientosFiltrados.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 40px; color: #6D6D80;">
                        No se encontraron movimientos con los filtros aplicados
                    </td>
                </tr>
            `;
            return;
        }

        const formatter = window.currencyFormatter;

        tbody.innerHTML = movimientosFiltrados.map(mov => {
            const fecha = mov.fecha.toDate();
            const tipoBadge = mov.tipo === 'ingreso' ? 
                '<span style="background: #D1F4E0; color: #0A6E3B; padding: 4px 12px; border-radius: 12px; font-size: 0.85rem; font-weight: 600;">Ingreso</span>' :
                mov.tipo === 'egreso' ?
                '<span style="background: #F8D7DA; color: #842029; padding: 4px 12px; border-radius: 12px; font-size: 0.85rem; font-weight: 600;">Egreso</span>' :
                '<span style="background: #CFE2FF; color: #084298; padding: 4px 12px; border-radius: 12px; font-size: 0.85rem; font-weight: 600;">Nómina</span>';

            const montoColor = mov.tipo === 'ingreso' ? '#34C759' : '#FF3B30';
            const signo = mov.tipo === 'ingreso' ? '+' : '-';

            return `
                <tr>
                    <td>${fecha.toLocaleDateString('es-MX')}</td>
                    <td>${tipoBadge}</td>
                    <td>${mov.concepto}</td>
                    <td style="color: ${montoColor}; font-weight: 700;">
                        ${signo}${formatter ? formatter.format(mov.monto) : '$' + mov.monto.toFixed(2)}
                    </td>
                    <td>${mov.registradoPorNombre || 'Sistema'}</td>
                </tr>
            `;
        }).join('');
    }

    showLoading() {
        document.getElementById('loading-overlay-pagos')?.classList.add('active');
    }

    hideLoading() {
        document.getElementById('loading-overlay-pagos')?.classList.remove('active');
    }

    showNotification(message, type = 'info') {
        if (window.eventBus) {
            window.eventBus.emit(window.APP_EVENTS.NOTIFICATION_SHOW, { message, type });
        } else {
            alert(message);
        }
    }

    destroy() {
        // Limpiar listener de clicks para evitar fugas de memoria y duplicados
        if (this.clickListener) {
            document.removeEventListener('click', this.clickListener);
            this.clickListener = null;
        }
        console.log('💰 Módulo de pagos descargado');
    }
}

// Inicializar módulo
function loadPagosModule() {
    window.pagosModule = new PagosModule();
}

window.loadPagosModule = loadPagosModule;
