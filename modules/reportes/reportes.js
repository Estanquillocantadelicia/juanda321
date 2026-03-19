
// Módulo de Reportes - Sistema Profesional de Análisis
class ReportesModule {
    constructor() {
        this.currentTab = 'resumen';
        this.periodoActual = 'semana';
        this.fechaInicio = null;
        this.fechaFin = null;
        this.charts = {};
        this.datos = {
            ventas: [],
            productos: [],
            creditos: [],
            clientes: [],
            compras: [],
            abonos: [],
            cajas: [],
            pagos: []
        };
        this.init();
    }

    async init() {
        console.log('📊 Inicializando módulo de reportes...');
        
        try {
            const tabsContainer = document.querySelector('.reportes-tabs');
            if (!tabsContainer) {
                console.error('❌ No se encontró el contenedor de tabs');
                return;
            }
            
            this.setupTabsSystem();
            this.setupEventListeners();
            this.setupDateFilters();
            await this.cargarTodosLosDatos();
            await this.actualizarReportes();
            
            console.log('✅ Módulo de reportes inicializado');
        } catch (error) {
            console.error('❌ Error inicializando módulo de reportes:', error);
            this.mostrarError('Error al inicializar el módulo de reportes');
        }
    }
    
    mostrarError(mensaje) {
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = 'padding: 40px; text-align: center; color: #FF3B30;';
            errorDiv.innerHTML = `
                <h3>⚠️ ${mensaje}</h3>
                <p style="margin-top: 16px; color: #6D6D80;">Por favor, recarga la página o contacta al administrador.</p>
            `;
            mainContent.appendChild(errorDiv);
        }
    }

    setupTabsSystem() {
        const tabs = document.querySelectorAll('.reportes-tab');
        const indicator = document.querySelector('.reportes-tabs .tab-indicator');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetTab = tab.dataset.tab;
                this.cambiarTab(targetTab, tab);
            });
        });

        const activeTab = document.querySelector('.reportes-tab.active');
        if (activeTab && indicator) {
            this.updateTabIndicator(activeTab, indicator);
        }
    }

    updateTabIndicator(activeTab, indicator, animate = true) {
        if (!activeTab || !indicator) return;

        const tabsContainer = activeTab.parentElement;
        const tabRect = activeTab.getBoundingClientRect();
        const containerRect = tabsContainer.getBoundingClientRect();

        const left = tabRect.left - containerRect.left;
        const width = tabRect.width;

        if (!animate) indicator.style.transition = 'none';

        indicator.style.width = `${width}px`;
        indicator.style.transform = `translateX(${left}px)`;

        if (!animate) {
            setTimeout(() => indicator.style.transition = '', 50);
        }
    }

    cambiarTab(tab, tabElement = null) {
        this.currentTab = tab;

        document.querySelectorAll('.reportes-tab').forEach(t => t.classList.remove('active'));
        
        const targetTabElement = tabElement || document.querySelector(`.reportes-tab[data-tab="${tab}"]`);
        if (targetTabElement) {
            targetTabElement.classList.add('active');
            const indicator = document.querySelector('.reportes-tabs .tab-indicator');
            if (indicator) this.updateTabIndicator(targetTabElement, indicator, true);
        }

        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        const tabContent = document.getElementById(`tab-${tab}`);
        if (tabContent) {
            tabContent.classList.add('active');
        }

        this.actualizarTabActual();
    }

    setupEventListeners() {
        const periodoSelect = document.getElementById('filtro-periodo-global');
        if (periodoSelect) {
            periodoSelect.addEventListener('change', (e) => {
                this.periodoActual = e.target.value;
                this.handlePeriodoChange();
            });
        }

        const btnAplicarFechas = document.getElementById('btn-aplicar-fechas');
        if (btnAplicarFechas) {
            btnAplicarFechas.addEventListener('click', () => {
                this.aplicarFechasPersonalizadas();
            });
        }

        const btnExportar = document.getElementById('btn-exportar-reporte');
        if (btnExportar) {
            btnExportar.addEventListener('click', () => {
                this.mostrarModalExportar();
            });
        }

        const modalClose = document.getElementById('modal-exportar-close');
        if (modalClose) {
            modalClose.addEventListener('click', () => {
                this.cerrarModalExportar();
            });
        }

        const exportPdf = document.getElementById('export-pdf');
        if (exportPdf) {
            exportPdf.addEventListener('click', () => this.exportarPDF());
        }

        const exportExcel = document.getElementById('export-excel');
        if (exportExcel) {
            exportExcel.addEventListener('click', () => this.exportarExcel());
        }

        const exportPrint = document.getElementById('export-print');
        if (exportPrint) {
            exportPrint.addEventListener('click', () => this.imprimir());
        }
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
            this.calcularFechasPorPeriodo();
            this.actualizarReportes();
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
            this.actualizarReportes();
        }
    }

    async cargarTodosLosDatos() {
        try {
            await Promise.all([
                this.cargarVentas(),
                this.cargarProductos(),
                this.cargarCreditos(),
                this.cargarClientes(),
                this.cargarCompras(),
                this.cargarMovimientosCaja(),
                this.cargarPagos()
            ]);
        } catch (error) {
            console.error('Error cargando datos:', error);
        }
    }

    async cargarVentas() {
        try {
            if (!window.db) return;
            
            const snapshot = await window.db.collection('sales')
                .orderBy('fecha', 'desc')
                .limit(1000)
                .get();
            
            this.datos.ventas = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                this.datos.ventas.push({
                    id: doc.id,
                    ...data,
                    fecha: data.fecha?.toDate ? data.fecha.toDate() : new Date(data.fecha)
                });
            });
            console.log(`📊 ${this.datos.ventas.length} ventas cargadas para reportes`);
        } catch (error) {
            console.error('Error cargando ventas:', error);
        }
    }

    async cargarProductos() {
        try {
            if (!window.db) return;
            
            const snapshot = await window.db.collection('products').get();
            
            this.datos.productos = [];
            snapshot.forEach(doc => {
                this.datos.productos.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            console.log(`📦 ${this.datos.productos.length} productos cargados para reportes`);
        } catch (error) {
            console.error('Error cargando productos:', error);
        }
    }

    async cargarCreditos() {
        try {
            if (!window.db) return;
            
            const ventasSnapshot = await window.db.collection('sales')
                .where('tipoPago', '==', 'credito')
                .get();
            
            this.datos.creditos = [];
            ventasSnapshot.forEach(doc => {
                const data = doc.data();
                this.datos.creditos.push({
                    id: doc.id,
                    ...data,
                    fecha: data.fecha?.toDate ? data.fecha.toDate() : new Date(data.fecha)
                });
            });
            
            const abonosSnapshot = await window.db.collection('abonos').get();
            this.datos.abonos = [];
            abonosSnapshot.forEach(doc => {
                const data = doc.data();
                this.datos.abonos.push({
                    id: doc.id,
                    ...data,
                    fecha: data.fecha?.toDate ? data.fecha.toDate() : new Date(data.fecha)
                });
            });
            
            console.log(`💳 ${this.datos.creditos.length} créditos y ${this.datos.abonos.length} abonos cargados`);
        } catch (error) {
            console.error('Error cargando créditos:', error);
        }
    }

    async cargarClientes() {
        try {
            if (!window.db) return;
            
            const snapshot = await window.db.collection('clients').get();
            
            this.datos.clientes = [];
            snapshot.forEach(doc => {
                this.datos.clientes.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            console.log(`👥 ${this.datos.clientes.length} clientes cargados para reportes`);
        } catch (error) {
            console.error('Error cargando clientes:', error);
        }
    }

    async cargarCompras() {
        try {
            if (!window.db) return;
            
            const snapshot = await window.db.collection('purchases')
                .orderBy('fecha', 'desc')
                .limit(500)
                .get();
            
            this.datos.compras = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                this.datos.compras.push({
                    id: doc.id,
                    ...data,
                    fecha: data.fecha?.toDate ? data.fecha.toDate() : new Date(data.fecha)
                });
            });
            console.log(`🛒 ${this.datos.compras.length} compras cargadas para reportes`);
        } catch (error) {
            console.error('Error cargando compras:', error);
        }
    }

    async cargarMovimientosCaja() {
        try {
            if (!window.db) return;
            
            const snapshot = await window.db.collection('cajas').get();
            
            this.datos.cajas = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                const movimientos = data.movimientos || [];
                
                movimientos.forEach(mov => {
                    this.datos.cajas.push({
                        ...mov,
                        fecha: mov.fecha?.toDate ? mov.fecha.toDate() : new Date(mov.fecha),
                        cajaId: doc.id
                    });
                });
            });
            console.log(`💼 ${this.datos.cajas.length} movimientos de caja cargados para reportes`);
        } catch (error) {
            console.error('Error cargando movimientos de caja:', error);
        }
    }

    async cargarPagos() {
        try {
            if (!window.db) return;
            
            const snapshot = await window.db.collection('pagos')
                .orderBy('fecha', 'desc')
                .limit(500)
                .get();
            
            this.datos.pagos = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                this.datos.pagos.push({
                    id: doc.id,
                    ...data,
                    fecha: data.fecha?.toDate ? data.fecha.toDate() : new Date(data.fecha)
                });
            });
            console.log(`💰 ${this.datos.pagos.length} movimientos de Caja Mayor cargados para reportes`);
        } catch (error) {
            console.error('Error cargando pagos:', error);
        }
    }

    filtrarPorFecha(datos) {
        if (!this.fechaInicio || !this.fechaFin) return datos;
        
        return datos.filter(item => {
            const fecha = item.fecha instanceof Date ? item.fecha : new Date(item.fecha);
            return fecha >= this.fechaInicio && fecha <= this.fechaFin;
        });
    }

    async actualizarReportes() {
        await this.actualizarResumen();
        this.actualizarTabActual();
    }

    actualizarTabActual() {
        switch (this.currentTab) {
            case 'resumen':
                this.actualizarResumen();
                break;
            case 'ventas':
                this.actualizarReporteVentas();
                break;
            case 'inventario':
                this.actualizarReporteInventario();
                break;
            case 'creditos':
                this.actualizarReporteCreditos();
                break;
        }
    }

    // Función para calcular utilidad de ventas que no tienen el campo guardado
    calcularUtilidadVenta(venta) {
        if (venta.utilidad !== undefined && venta.utilidad !== null && venta.utilidad !== 0) {
            return venta.utilidad;
        }

        let utilidadTotal = 0;
        const productos = venta.productos || venta.items || [];

        for (const item of productos) {
            if (item.costo !== undefined) {
                const utilidadItem = ((item.precioUnitario || 0) - (item.costo || 0)) * (item.cantidad || 1);
                utilidadTotal += utilidadItem;
            } else {
                const producto = this.datos.productos.find(p => p.id === item.productoId);
                if (!producto) continue;

                let costo = 0;
                const precioVenta = item.precioUnitario || item.subtotal / (item.cantidad || 1) || 0;

                if (producto.tipo === 'simple' || !item.tipo || item.tipo === 'simple') {
                    costo = producto.precio?.costo || 0;
                } else if (item.tipo === 'variante' || item.tipo === 'variante-opcion') {
                    const variantesArray = Array.isArray(producto.variantes) 
                        ? producto.variantes 
                        : Object.values(producto.variantes || {});
                    const variante = variantesArray[item.varianteIndex];
                    
                    if (item.opcionIndex !== undefined && variante?.opciones) {
                        const opcionesArray = Array.isArray(variante.opciones) 
                            ? variante.opciones 
                            : Object.values(variante.opciones || {});
                        const opcion = opcionesArray[item.opcionIndex];
                        costo = opcion?.precio?.costo || variante?.precio?.costo || 0;
                    } else {
                        costo = variante?.precio?.costo || 0;
                    }
                } else if (item.tipo === 'conversion') {
                    const conversionesArray = Array.isArray(producto.conversiones) 
                        ? producto.conversiones 
                        : Object.values(producto.conversiones || {});
                    const conversion = conversionesArray[item.conversionIndex];
                    costo = conversion?.precio?.costo || 0;
                }

                const utilidadItem = (precioVenta - costo) * (item.cantidad || 1);
                utilidadTotal += utilidadItem;
            }
        }

        return utilidadTotal;
    }

    // Función para obtener el stock real de un producto (considera variantes y opciones)
    getStockActual(producto) {
        if (!producto) return 0;
        
        if (producto.tipo === 'simple') {
            return producto.stock?.actual || producto.stock || 0;
        } else if (producto.tipo === 'variantes') {
            const variantesArray = Array.isArray(producto.variantes) 
                ? producto.variantes 
                : Object.values(producto.variantes || {});

            return variantesArray.reduce((sum, v) => {
                if (v?.opciones) {
                    const opcionesArray = Array.isArray(v.opciones) 
                        ? v.opciones 
                        : Object.values(v.opciones || {});
                    return sum + opcionesArray.reduce((s, o) => s + (o?.stock?.actual || 0), 0);
                }
                return sum + (v?.stock?.actual || 0);
            }, 0);
        } else if (producto.tipo === 'conversion') {
            return producto.stock?.actual || 0;
        }
        return producto.stock?.actual || producto.stock || 0;
    }

    // Función para obtener el costo promedio de un producto
    getCostoProducto(producto) {
        if (!producto) return 0;
        
        if (producto.tipo === 'simple') {
            return producto.precio?.costo || 0;
        } else if (producto.tipo === 'variantes') {
            const variantesArray = Array.isArray(producto.variantes) 
                ? producto.variantes 
                : Object.values(producto.variantes || {});
            
            let totalCosto = 0;
            let count = 0;
            
            variantesArray.forEach(v => {
                if (v?.opciones) {
                    const opcionesArray = Array.isArray(v.opciones) 
                        ? v.opciones 
                        : Object.values(v.opciones || {});
                    opcionesArray.forEach(o => {
                        if (o?.precio?.costo) {
                            totalCosto += o.precio.costo;
                            count++;
                        }
                    });
                } else if (v?.precio?.costo) {
                    totalCosto += v.precio.costo;
                    count++;
                }
            });
            
            return count > 0 ? totalCosto / count : 0;
        } else if (producto.tipo === 'conversion') {
            return producto.precio?.costo || 0;
        }
        return producto.precio?.costo || 0;
    }

    async actualizarResumen() {
        const ventasFiltradas = this.filtrarPorFecha(this.datos.ventas);
        
        const totalVentas = ventasFiltradas.reduce((sum, v) => sum + (v.total || 0), 0);
        const totalUtilidad = ventasFiltradas.reduce((sum, v) => sum + this.calcularUtilidadVenta(v), 0);
        const numTransacciones = ventasFiltradas.length;
        const ticketPromedio = numTransacciones > 0 ? totalVentas / numTransacciones : 0;

        // Calcular gastos totales del período
        const gastosDelPeriodo = this.calcularGastosTotalesValor();
        
        // Utilidad Libre = Utilidad de ventas - Gastos operativos
        const utilidadLibre = totalUtilidad - gastosDelPeriodo;

        this.actualizarElemento('kpi-ventas-total', this.formatearMoneda(totalVentas));
        this.actualizarElemento('kpi-utilidad-total', this.formatearMoneda(totalUtilidad));
        this.actualizarElemento('kpi-transacciones', numTransacciones.toLocaleString());
        this.actualizarElemento('kpi-ticket-promedio', this.formatearMoneda(ticketPromedio));
        
        // Actualizar nuevos KPIs
        this.actualizarElemento('kpi-gastos-total', this.formatearMoneda(gastosDelPeriodo));
        this.actualizarElemento('kpi-utilidad-libre', this.formatearMoneda(utilidadLibre));

        // Actualizar indicadores de tendencia
        this.actualizarTendencias(ventasFiltradas, totalVentas, totalUtilidad);

        this.renderChartVentasPeriodo(ventasFiltradas);
        this.renderChartMetodosPago(ventasFiltradas);
        this.renderTopProductos(ventasFiltradas);
        this.renderAlertas();
        this.renderResumenFinanciero(totalVentas, totalUtilidad, gastosDelPeriodo, utilidadLibre);
    }

    actualizarTendencias(ventasActuales, totalActual, utilidadActual) {
        // Calcular período anterior para comparación
        const diasPeriodo = Math.ceil((this.fechaFin - this.fechaInicio) / (1000 * 60 * 60 * 24)) + 1;
        const fechaInicioAnterior = new Date(this.fechaInicio);
        fechaInicioAnterior.setDate(fechaInicioAnterior.getDate() - diasPeriodo);
        const fechaFinAnterior = new Date(this.fechaInicio);
        fechaFinAnterior.setDate(fechaFinAnterior.getDate() - 1);
        fechaFinAnterior.setHours(23, 59, 59, 999);

        const ventasAnteriores = this.datos.ventas.filter(v => {
            const fecha = v.fecha instanceof Date ? v.fecha : new Date(v.fecha);
            return fecha >= fechaInicioAnterior && fecha <= fechaFinAnterior;
        });

        const totalAnterior = ventasAnteriores.reduce((sum, v) => sum + (v.total || 0), 0);
        const utilidadAnterior = ventasAnteriores.reduce((sum, v) => sum + this.calcularUtilidadVenta(v), 0);

        // Calcular porcentajes de cambio
        const cambioVentas = totalAnterior > 0 ? ((totalActual - totalAnterior) / totalAnterior * 100) : 0;
        const cambioUtilidad = utilidadAnterior > 0 ? ((utilidadActual - utilidadAnterior) / utilidadAnterior * 100) : 0;

        // Actualizar elementos de tendencia
        this.actualizarTendencia('kpi-ventas-trend', cambioVentas);
        this.actualizarTendencia('kpi-utilidad-trend', cambioUtilidad);
    }

    actualizarTendencia(elementId, porcentaje) {
        const element = document.getElementById(elementId);
        if (!element) return;

        const isPositive = porcentaje >= 0;
        const icon = isPositive 
            ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>'
            : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline></svg>';

        element.className = `kpi-trend ${isPositive ? 'positive' : 'negative'}`;
        element.innerHTML = `${icon}<span>${isPositive ? '+' : ''}${porcentaje.toFixed(1)}%</span>`;
    }

    renderResumenFinanciero(totalVentas, utilidadBruta, gastos, utilidadNeta) {
        const container = document.getElementById('resumen-financiero');
        if (!container) return;

        const margenBruto = totalVentas > 0 ? (utilidadBruta / totalVentas * 100) : 0;
        const margenNeto = totalVentas > 0 ? (utilidadNeta / totalVentas * 100) : 0;

        // Desglose de gastos
        const desglose = this.calcularDesgloseGastos();

        container.innerHTML = `
            <div class="financial-summary">
                <div class="financial-row header-row">
                    <span class="financial-label">Concepto</span>
                    <span class="financial-value">Monto</span>
                </div>
                <div class="financial-row">
                    <span class="financial-label">Ingresos por Ventas</span>
                    <span class="financial-value positive">${this.formatearMoneda(totalVentas)}</span>
                </div>
                <div class="financial-row">
                    <span class="financial-label">(-) Costo de Productos Vendidos</span>
                    <span class="financial-value negative">${this.formatearMoneda(totalVentas - utilidadBruta)}</span>
                </div>
                <div class="financial-row highlight">
                    <span class="financial-label">= Utilidad Bruta</span>
                    <span class="financial-value">${this.formatearMoneda(utilidadBruta)} <small>(${margenBruto.toFixed(1)}%)</small></span>
                </div>
                <div class="financial-divider"></div>
                <div class="financial-row sub-header">
                    <span class="financial-label">Gastos Operativos:</span>
                    <span class="financial-value"></span>
                </div>
                ${desglose.nomina > 0 ? `
                <div class="financial-row indent">
                    <span class="financial-label">Nómina</span>
                    <span class="financial-value negative">${this.formatearMoneda(desglose.nomina)}</span>
                </div>` : ''}
                ${desglose.proveedores > 0 ? `
                <div class="financial-row indent">
                    <span class="financial-label">Pagos a Proveedores</span>
                    <span class="financial-value negative">${this.formatearMoneda(desglose.proveedores)}</span>
                </div>` : ''}
                ${desglose.servicios > 0 ? `
                <div class="financial-row indent">
                    <span class="financial-label">Servicios y Otros</span>
                    <span class="financial-value negative">${this.formatearMoneda(desglose.servicios)}</span>
                </div>` : ''}
                ${desglose.arriendo > 0 ? `
                <div class="financial-row indent">
                    <span class="financial-label">Arriendo</span>
                    <span class="financial-value negative">${this.formatearMoneda(desglose.arriendo)}</span>
                </div>` : ''}
                ${desglose.otros > 0 ? `
                <div class="financial-row indent">
                    <span class="financial-label">Otros Gastos</span>
                    <span class="financial-value negative">${this.formatearMoneda(desglose.otros)}</span>
                </div>` : ''}
                <div class="financial-row">
                    <span class="financial-label">(-) Total Gastos</span>
                    <span class="financial-value negative">${this.formatearMoneda(gastos)}</span>
                </div>
                <div class="financial-divider"></div>
                <div class="financial-row final ${utilidadNeta >= 0 ? 'positive-bg' : 'negative-bg'}">
                    <span class="financial-label">= UTILIDAD NETA (Lo que te queda)</span>
                    <span class="financial-value ${utilidadNeta >= 0 ? 'positive' : 'negative'}">${this.formatearMoneda(utilidadNeta)}</span>
                </div>
                <div class="financial-row">
                    <span class="financial-label">Margen Neto</span>
                    <span class="financial-value">${margenNeto.toFixed(1)}%</span>
                </div>
            </div>
        `;
    }

    calcularDesgloseGastos() {
        const desglose = {
            nomina: 0,
            proveedores: 0,
            servicios: 0,
            arriendo: 0,
            otros: 0
        };

        // Pagos del módulo de pagos
        const pagosFiltrados = this.filtrarPorFecha(this.datos.pagos);
        pagosFiltrados.forEach(pago => {
            if (pago.tipo === 'nomina') {
                desglose.nomina += pago.monto || 0;
            } else if (pago.tipo === 'egreso') {
                const concepto = (pago.concepto || pago.descripcion || '').toLowerCase();
                if (concepto.includes('proveedor') || concepto.includes('mercancia')) {
                    desglose.proveedores += pago.monto || 0;
                } else if (concepto.includes('arriendo') || concepto.includes('alquiler')) {
                    desglose.arriendo += pago.monto || 0;
                } else if (concepto.includes('servicio') || concepto.includes('agua') || concepto.includes('luz') || concepto.includes('internet')) {
                    desglose.servicios += pago.monto || 0;
                } else {
                    desglose.otros += pago.monto || 0;
                }
            }
        });

        // Egresos de caja (excepto retiro-efectivo)
        const movimientosCajaFiltrados = this.filtrarPorFecha(this.datos.cajas);
        movimientosCajaFiltrados.forEach(mov => {
            if (mov.tipo === 'egreso' && mov.categoria !== 'retiro-efectivo') {
                desglose.otros += mov.monto || 0;
            }
        });

        return desglose;
    }

    renderChartVentasPeriodo(ventas) {
        const canvas = document.getElementById('chart-ventas-periodo');
        if (!canvas) return;

        if (this.charts.ventasPeriodo) {
            this.charts.ventasPeriodo.destroy();
        }

        const ventasPorDia = this.agruparVentasPorDia(ventas);
        const labels = Object.keys(ventasPorDia).sort();
        const dataVentas = labels.map(fecha => ventasPorDia[fecha].total);
        const dataUtilidad = labels.map(fecha => ventasPorDia[fecha].utilidad);

        const ctx = canvas.getContext('2d');
        this.charts.ventasPeriodo = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels.map(f => this.formatearFechaCorta(f)),
                datasets: [
                    {
                        label: 'Ventas',
                        data: dataVentas,
                        borderColor: '#34C759',
                        backgroundColor: 'rgba(52, 199, 89, 0.1)',
                        fill: true,
                        tension: 0.4,
                        borderWidth: 3,
                        pointRadius: 4,
                        pointBackgroundColor: '#34C759'
                    },
                    {
                        label: 'Utilidad',
                        data: dataUtilidad,
                        borderColor: '#007AFF',
                        backgroundColor: 'rgba(0, 122, 255, 0.1)',
                        fill: true,
                        tension: 0.4,
                        borderWidth: 3,
                        pointRadius: 4,
                        pointBackgroundColor: '#007AFF'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        align: 'end',
                        labels: {
                            usePointStyle: true,
                            padding: 20,
                            font: { size: 12, weight: '600' }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        titleFont: { size: 13, weight: '600' },
                        bodyFont: { size: 12 },
                        padding: 12,
                        cornerRadius: 8,
                        callbacks: {
                            label: (context) => {
                                return `${context.dataset.label}: ${this.formatearMoneda(context.raw)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { font: { size: 11 } }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(0,0,0,0.05)' },
                        ticks: {
                            font: { size: 11 },
                            callback: (value) => this.formatearMonedaCorta(value)
                        }
                    }
                }
            }
        });
    }

    renderChartMetodosPago(ventas) {
        const canvas = document.getElementById('chart-metodos-pago');
        if (!canvas) return;

        if (this.charts.metodosPago) {
            this.charts.metodosPago.destroy();
        }

        const metodos = {};
        ventas.forEach(v => {
            const metodo = v.metodoPago || v.metodo_pago || 'efectivo';
            metodos[metodo] = (metodos[metodo] || 0) + (v.total || 0);
        });

        const colores = {
            efectivo: '#34C759',
            tarjeta: '#007AFF',
            transferencia: '#5856D6',
            credito: '#FF9500'
        };

        const labels = Object.keys(metodos);
        const data = Object.values(metodos);
        const backgroundColors = labels.map(m => colores[m] || '#8E8E93');

        const ctx = canvas.getContext('2d');
        this.charts.metodosPago = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels.map(l => l.charAt(0).toUpperCase() + l.slice(1)),
                datasets: [{
                    data: data,
                    backgroundColor: backgroundColors,
                    borderWidth: 0,
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                            padding: 16,
                            font: { size: 12, weight: '600' }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        padding: 12,
                        cornerRadius: 8,
                        callbacks: {
                            label: (context) => {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((context.raw / total) * 100).toFixed(1);
                                return `${this.formatearMoneda(context.raw)} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    renderTopProductos(ventas) {
        const container = document.getElementById('top-products-list');
        if (!container) return;

        const productosVendidos = {};

        ventas.forEach(venta => {
            const items = venta.productos || venta.items || [];
            items.forEach(item => {
                const nombre = item.nombre || 'Sin nombre';
                if (!productosVendidos[nombre]) {
                    productosVendidos[nombre] = { nombre, cantidad: 0, total: 0 };
                }
                productosVendidos[nombre].cantidad += item.cantidad || 1;
                productosVendidos[nombre].total += item.subtotal || 0;
            });
        });

        const top5 = Object.values(productosVendidos)
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);

        if (top5.length === 0) {
            container.innerHTML = '<div class="empty-state-mini">Sin datos disponibles</div>';
            return;
        }

        container.innerHTML = top5.map((p, index) => `
            <div class="product-item">
                <span class="product-rank rank-${index + 1}">${index + 1}</span>
                <div class="product-info">
                    <div class="product-name">${this.truncarTexto(p.nombre, 25)}</div>
                    <div class="product-sales">${p.cantidad} unidades vendidas</div>
                </div>
                <span class="product-amount">${this.formatearMoneda(p.total)}</span>
            </div>
        `).join('');
    }

    renderAlertas() {
        const container = document.getElementById('system-alerts-list');
        if (!container) return;

        const alertas = [];

        // Alertas de stock bajo
        this.datos.productos.forEach(p => {
            const stockActual = this.getStockActual(p);
            const stockMinimo = p.stock?.minimo || 5;
            if (stockActual <= stockMinimo && stockActual > 0) {
                alertas.push({
                    tipo: 'warning',
                    title: `Stock bajo: ${p.nombre}`,
                    description: `Solo quedan ${stockActual} unidades`
                });
            } else if (stockActual === 0) {
                alertas.push({
                    tipo: 'danger',
                    title: `Agotado: ${p.nombre}`,
                    description: 'Sin stock disponible'
                });
            }
        });

        // Alerta de créditos vencidos
        const hoy = new Date();
        const creditosVencidos = this.datos.creditos.filter(c => {
            if (c.estado === 'pagado') return false;
            const fechaVenc = c.fechaVencimiento?.toDate ? c.fechaVencimiento.toDate() : new Date(c.fechaVencimiento);
            return fechaVenc < hoy;
        });

        if (creditosVencidos.length > 0) {
            const montoVencido = creditosVencidos.reduce((sum, c) => sum + (c.saldoPendiente || c.total || 0), 0);
            alertas.push({
                tipo: 'danger',
                title: `${creditosVencidos.length} créditos vencidos`,
                description: `Total: ${this.formatearMoneda(montoVencido)}`
            });
        }

        if (alertas.length === 0) {
            container.innerHTML = '<div class="empty-state-mini success">Sin alertas pendientes</div>';
            return;
        }

        container.innerHTML = alertas.slice(0, 5).map(alerta => `
            <div class="alert-item alert-${alerta.tipo}">
                <div class="alert-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                </div>
                <div class="alert-content">
                    <div class="alert-title">${alerta.title}</div>
                    <div class="alert-description">${alerta.description}</div>
                </div>
            </div>
        `).join('');
    }

    actualizarReporteVentas() {
        const ventasFiltradas = this.filtrarPorFecha(this.datos.ventas);

        const efectivo = ventasFiltradas.filter(v => (v.metodoPago || v.metodo_pago) === 'efectivo')
            .reduce((sum, v) => sum + (v.total || 0), 0);
        const tarjeta = ventasFiltradas.filter(v => (v.metodoPago || v.metodo_pago) === 'tarjeta')
            .reduce((sum, v) => sum + (v.total || 0), 0);
        const transferencia = ventasFiltradas.filter(v => (v.metodoPago || v.metodo_pago) === 'transferencia')
            .reduce((sum, v) => sum + (v.total || 0), 0);
        const credito = ventasFiltradas.filter(v => (v.metodoPago || v.metodo_pago) === 'credito')
            .reduce((sum, v) => sum + (v.total || 0), 0);

        this.actualizarElemento('stat-efectivo-total', this.formatearMoneda(efectivo));
        this.actualizarElemento('stat-tarjeta-total', this.formatearMoneda(tarjeta));
        this.actualizarElemento('stat-transferencia-total', this.formatearMoneda(transferencia));
        this.actualizarElemento('stat-credito-total', this.formatearMoneda(credito));

        this.renderChartUtilidadVsGastos(ventasFiltradas);
        this.renderChartVentasHora(ventasFiltradas);
        this.renderTablaVentasDiarias(ventasFiltradas);
    }

    renderChartUtilidadVsGastos(ventas) {
        const canvas = document.getElementById('chart-ingresos-gastos');
        if (!canvas) return;

        if (this.charts.ingresosGastos) {
            this.charts.ingresosGastos.destroy();
        }

        const ventasPorDia = this.agruparVentasPorDia(ventas);
        const gastosPorDia = this.calcularGastosTotales();

        const fechas = [...new Set([...Object.keys(ventasPorDia), ...Object.keys(gastosPorDia)])].sort();
        const utilidades = fechas.map(f => ventasPorDia[f]?.utilidad || 0);
        const gastos = fechas.map(f => gastosPorDia[f] || 0);

        const ctx = canvas.getContext('2d');
        this.charts.ingresosGastos = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: fechas.map(f => this.formatearFechaCorta(f)),
                datasets: [
                    {
                        label: 'Utilidad',
                        data: utilidades,
                        backgroundColor: 'rgba(52, 199, 89, 0.8)',
                        borderRadius: 6
                    },
                    {
                        label: 'Gastos',
                        data: gastos,
                        backgroundColor: 'rgba(255, 59, 48, 0.8)',
                        borderRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        align: 'end'
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => `${context.dataset.label}: ${this.formatearMoneda(context.raw)}`
                        }
                    }
                },
                scales: {
                    x: { grid: { display: false } },
                    y: {
                        beginAtZero: true,
                        ticks: { callback: (v) => this.formatearMonedaCorta(v) }
                    }
                }
            }
        });
    }

    renderChartVentasHora(ventas) {
        const canvas = document.getElementById('chart-ventas-hora');
        if (!canvas) return;

        if (this.charts.ventasHora) {
            this.charts.ventasHora.destroy();
        }

        const ventasPorHora = Array(24).fill(0);
        ventas.forEach(v => {
            const hora = v.fecha.getHours();
            ventasPorHora[hora] += v.total || 0;
        });

        const horasConVentas = ventasPorHora
            .map((total, hora) => ({ hora, total }))
            .filter(h => h.total > 0);

        if (horasConVentas.length === 0) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.font = '14px Arial';
            ctx.fillStyle = '#6D6D80';
            ctx.textAlign = 'center';
            ctx.fillText('Sin datos de ventas por hora', canvas.width / 2, canvas.height / 2);
            return;
        }

        const ctx = canvas.getContext('2d');
        this.charts.ventasHora = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: horasConVentas.map(h => `${h.hora}:00`),
                datasets: [{
                    label: 'Ventas',
                    data: horasConVentas.map(h => h.total),
                    backgroundColor: 'rgba(88, 86, 214, 0.8)',
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => this.formatearMoneda(context.raw)
                        }
                    }
                },
                scales: {
                    x: { grid: { display: false } },
                    y: {
                        beginAtZero: true,
                        ticks: { callback: (v) => this.formatearMonedaCorta(v) }
                    }
                }
            }
        });
    }

    renderTablaVentasDiarias(ventas) {
        const tbody = document.getElementById('tabla-ventas-diarias');
        if (!tbody) return;

        const ventasPorDia = this.agruparVentasPorDia(ventas);
        const fechasOrdenadas = Object.keys(ventasPorDia).sort().reverse();

        if (fechasOrdenadas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty-table">Sin datos para el período seleccionado</td></tr>';
            return;
        }

        tbody.innerHTML = fechasOrdenadas.map(fecha => {
            const datos = ventasPorDia[fecha];
            const ticketPromedio = datos.count > 0 ? datos.total / datos.count : 0;
            const fechaFormateada = new Date(fecha).toLocaleDateString('es-CO', { 
                weekday: 'short', 
                day: 'numeric', 
                month: 'short' 
            });

            return `
                <tr>
                    <td><strong>${fechaFormateada}</strong></td>
                    <td class="text-center">${datos.count}</td>
                    <td style="color: #34C759; font-weight: 600;">${this.formatearMoneda(datos.total)}</td>
                    <td style="color: #007AFF; font-weight: 600;">${this.formatearMoneda(datos.utilidad)}</td>
                    <td>${this.formatearMoneda(ticketPromedio)}</td>
                </tr>
            `;
        }).join('');
    }

    actualizarReporteInventario() {
        this.renderProductosStockBajo();
        this.renderChartInventarioCategoria();
        this.renderChartRotacion();
        this.renderTablaProductosVendidos();
    }

    renderProductosStockBajo() {
        const container = document.getElementById('stock-bajo-grid');
        const countElement = document.getElementById('stock-bajo-count');
        if (!container) return;

        const productosStockBajo = [];

        this.datos.productos.forEach(p => {
            const stockActual = this.getStockActual(p);
            const stockMinimo = p.stock?.minimo || 5;

            if (stockActual <= stockMinimo) {
                productosStockBajo.push({
                    nombre: p.nombre,
                    stockActual,
                    stockMinimo,
                    agotado: stockActual === 0
                });
            }
        });

        if (countElement) {
            countElement.textContent = productosStockBajo.length;
        }

        if (productosStockBajo.length === 0) {
            container.innerHTML = `
                <div class="empty-state-card">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    <span>Todos los productos tienen stock suficiente</span>
                </div>
            `;
            return;
        }

        container.innerHTML = productosStockBajo.map(p => `
            <div class="stock-alert-card ${p.agotado ? 'agotado' : ''}">
                <div class="stock-alert-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        ${p.agotado 
                            ? '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>'
                            : '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>'}
                    </svg>
                </div>
                <div class="stock-alert-content">
                    <div class="stock-alert-name">${this.truncarTexto(p.nombre, 25)}</div>
                    <div class="stock-alert-info">
                        <span class="stock-current">${p.agotado ? 'AGOTADO' : p.stockActual + ' unidades'}</span>
                        <span class="stock-min">/ Mínimo: ${p.stockMinimo}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    renderChartInventarioCategoria() {
        const canvas = document.getElementById('chart-inventario-categoria');
        if (!canvas) return;

        if (this.charts.inventarioCategoria) {
            this.charts.inventarioCategoria.destroy();
        }

        const categorias = {};
        this.datos.productos.forEach(p => {
            const categoria = p.categoria || 'Sin categoría';
            const stockActual = this.getStockActual(p);
            const costo = this.getCostoProducto(p);
            const valor = stockActual * costo;
            categorias[categoria] = (categorias[categoria] || 0) + valor;
        });

        const labels = Object.keys(categorias);
        const data = Object.values(categorias);
        const colores = ['#007AFF', '#34C759', '#FF9500', '#5856D6', '#FF3B30', '#AF52DE', '#00C7BE'];

        const ctx = canvas.getContext('2d');
        this.charts.inventarioCategoria = new Chart(ctx, {
            type: 'pie',
            data: {
                labels,
                datasets: [{
                    data,
                    backgroundColor: colores.slice(0, labels.length),
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { usePointStyle: true, padding: 12 }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => `${context.label}: ${this.formatearMoneda(context.raw)}`
                        }
                    }
                }
            }
        });
    }

    renderChartRotacion() {
        const canvas = document.getElementById('chart-rotacion');
        if (!canvas) return;

        if (this.charts.rotacion) {
            this.charts.rotacion.destroy();
        }

        const ventasFiltradas = this.filtrarPorFecha(this.datos.ventas);
        const ventasPorProducto = {};
        
        ventasFiltradas.forEach(venta => {
            const items = venta.items || venta.productos || [];
            items.forEach(item => {
                const id = item.productoId || item.id;
                if (id) {
                    ventasPorProducto[id] = (ventasPorProducto[id] || 0) + (item.cantidad || 1);
                }
            });
        });

        const productosConRotacion = this.datos.productos
            .map(p => ({
                nombre: p.nombre,
                rotacion: ventasPorProducto[p.id] || 0
            }))
            .sort((a, b) => b.rotacion - a.rotacion)
            .slice(0, 10);

        const ctx = canvas.getContext('2d');
        this.charts.rotacion = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: productosConRotacion.map(p => this.truncarTexto(p.nombre, 15)),
                datasets: [{
                    label: 'Unidades vendidas',
                    data: productosConRotacion.map(p => p.rotacion),
                    backgroundColor: 'rgba(0, 122, 255, 0.8)',
                    borderRadius: 6
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: { beginAtZero: true },
                    y: { grid: { display: false } }
                }
            }
        });
    }

    renderTablaProductosVendidos() {
        const tbody = document.getElementById('tabla-productos-vendidos');
        if (!tbody) return;

        const ventasFiltradas = this.filtrarPorFecha(this.datos.ventas);
        const productosVendidos = {};

        ventasFiltradas.forEach(venta => {
            const items = venta.items || venta.productos || [];
            items.forEach(item => {
                const id = item.productoId || item.id || item.nombre;
                if (!productosVendidos[id]) {
                    productosVendidos[id] = {
                        nombre: item.nombre || 'Sin nombre',
                        categoria: item.categoria || 'General',
                        unidades: 0,
                        total: 0,
                        productoId: item.productoId
                    };
                }
                productosVendidos[id].unidades += item.cantidad || 1;
                productosVendidos[id].total += item.subtotal || item.total || 0;
            });
        });

        const productos = Object.values(productosVendidos)
            .sort((a, b) => b.total - a.total)
            .slice(0, 15);

        if (productos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty-table">Sin datos para el período seleccionado</td></tr>';
            return;
        }

        tbody.innerHTML = productos.map(p => {
            const productoOriginal = this.datos.productos.find(pr => pr.id === p.productoId || pr.nombre === p.nombre);
            const stockActual = productoOriginal ? this.getStockActual(productoOriginal) : 'N/A';
            
            return `
                <tr>
                    <td><strong>${p.nombre}</strong></td>
                    <td>${p.categoria}</td>
                    <td class="text-center">${p.unidades}</td>
                    <td style="color: #34C759; font-weight: 600;">${this.formatearMoneda(p.total)}</td>
                    <td class="text-center">${stockActual}</td>
                </tr>
            `;
        }).join('');
    }

    actualizarReporteCreditos() {
        const creditosActivos = this.datos.creditos.filter(c => c.estado !== 'pagado');
        
        const carteraTotal = creditosActivos.reduce((sum, c) => sum + (c.saldoPendiente || c.monto || 0), 0);
        
        const hoy = new Date();
        const creditosVencidos = creditosActivos.filter(c => {
            const fechaVenc = c.fechaVencimiento?.toDate ? c.fechaVencimiento.toDate() : new Date(c.fechaVencimiento);
            return fechaVenc < hoy;
        });
        const montoVencido = creditosVencidos.reduce((sum, c) => sum + (c.saldoPendiente || c.monto || 0), 0);

        const pagosFiltrados = this.filtrarPorFecha(
            this.datos.creditos.flatMap(c => (c.pagos || []).map(p => ({...p, creditoId: c.id})))
        );
        const cobradoPeriodo = pagosFiltrados.reduce((sum, p) => sum + (p.monto || 0), 0);

        const clientesConCredito = new Set(creditosActivos.map(c => c.clienteId)).size;

        this.actualizarElemento('kpi-cartera-total', this.formatearMoneda(carteraTotal));
        this.actualizarElemento('kpi-vencidos', this.formatearMoneda(montoVencido));
        this.actualizarElemento('kpi-cobrado-periodo', this.formatearMoneda(cobradoPeriodo));
        this.actualizarElemento('kpi-clientes-credito', clientesConCredito);

        this.renderChartEstadoCartera(creditosActivos);
        this.renderChartCobranza();
        this.renderTablaClientesDeuda(creditosActivos);
    }

    renderChartEstadoCartera(creditos) {
        const canvas = document.getElementById('chart-estado-cartera');
        if (!canvas) return;

        if (this.charts.estadoCartera) {
            this.charts.estadoCartera.destroy();
        }

        const hoy = new Date();
        let vigentes = 0, vencidos = 0, proximos = 0;

        creditos.forEach(c => {
            const fechaVenc = c.fechaVencimiento?.toDate ? c.fechaVencimiento.toDate() : new Date(c.fechaVencimiento);
            const monto = c.saldoPendiente || c.monto || 0;
            const diasParaVencer = Math.ceil((fechaVenc - hoy) / (1000 * 60 * 60 * 24));

            if (diasParaVencer < 0) {
                vencidos += monto;
            } else if (diasParaVencer <= 7) {
                proximos += monto;
            } else {
                vigentes += monto;
            }
        });

        const ctx = canvas.getContext('2d');
        this.charts.estadoCartera = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Vigentes', 'Próximos a vencer', 'Vencidos'],
                datasets: [{
                    data: [vigentes, proximos, vencidos],
                    backgroundColor: ['#34C759', '#FF9500', '#FF3B30'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '60%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { usePointStyle: true, padding: 12 }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => `${context.label}: ${this.formatearMoneda(context.raw)}`
                        }
                    }
                }
            }
        });
    }

    renderChartCobranza() {
        const canvas = document.getElementById('chart-cobranza');
        if (!canvas) return;

        if (this.charts.cobranza) {
            this.charts.cobranza.destroy();
        }

        const pagos = this.datos.creditos.flatMap(c => 
            (c.pagos || []).map(p => ({
                ...p,
                fecha: p.fecha?.toDate ? p.fecha.toDate() : new Date(p.fecha)
            }))
        );

        const pagosFiltrados = this.filtrarPorFecha(pagos.map(p => ({ ...p, fecha: p.fecha })));
        const pagosPorDia = {};
        
        pagosFiltrados.forEach(p => {
            const fechaKey = p.fecha.toISOString().split('T')[0];
            pagosPorDia[fechaKey] = (pagosPorDia[fechaKey] || 0) + (p.monto || 0);
        });

        const fechas = Object.keys(pagosPorDia).sort();
        const montos = fechas.map(f => pagosPorDia[f]);

        const ctx = canvas.getContext('2d');
        this.charts.cobranza = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: fechas.map(f => this.formatearFechaCorta(f)),
                datasets: [{
                    label: 'Cobros',
                    data: montos,
                    backgroundColor: 'rgba(52, 199, 89, 0.8)',
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => this.formatearMoneda(context.raw)
                        }
                    }
                },
                scales: {
                    x: { grid: { display: false } },
                    y: {
                        beginAtZero: true,
                        ticks: { callback: (v) => this.formatearMonedaCorta(v) }
                    }
                }
            }
        });
    }

    renderTablaClientesDeuda(creditos) {
        const tbody = document.getElementById('tabla-clientes-deuda');
        if (!tbody) return;

        const deudaPorCliente = {};
        const hoy = new Date();

        creditos.forEach(c => {
            const clienteId = c.clienteId;
            if (!deudaPorCliente[clienteId]) {
                const cliente = this.datos.clientes.find(cl => cl.id === clienteId) || {};
                deudaPorCliente[clienteId] = {
                    nombre: cliente.nombre || c.clienteNombre || 'Cliente',
                    telefono: cliente.telefono || c.clienteTelefono || '-',
                    creditos: 0,
                    deudaTotal: 0,
                    tieneVencidos: false
                };
            }
            deudaPorCliente[clienteId].creditos++;
            deudaPorCliente[clienteId].deudaTotal += c.saldoPendiente || c.monto || 0;
            
            const fechaVenc = c.fechaVencimiento?.toDate ? c.fechaVencimiento.toDate() : new Date(c.fechaVencimiento);
            if (fechaVenc < hoy) {
                deudaPorCliente[clienteId].tieneVencidos = true;
            }
        });

        const clientes = Object.values(deudaPorCliente)
            .sort((a, b) => b.deudaTotal - a.deudaTotal)
            .slice(0, 15);

        if (clientes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty-table">Sin clientes con crédito activo</td></tr>';
            return;
        }

        tbody.innerHTML = clientes.map(c => `
            <tr>
                <td><strong>${c.nombre}</strong></td>
                <td>${c.telefono}</td>
                <td class="text-center">${c.creditos}</td>
                <td style="color: #FF3B30; font-weight: 600;">${this.formatearMoneda(c.deudaTotal)}</td>
                <td>
                    <span class="status-badge ${c.tieneVencidos ? 'status-vencido' : 'status-vigente'}">
                        ${c.tieneVencidos ? 'Vencido' : 'Vigente'}
                    </span>
                </td>
            </tr>
        `).join('');
    }

    // Utilidades
    agruparVentasPorDia(ventas) {
        const grupos = {};
        ventas.forEach(venta => {
            const fecha = venta.fecha instanceof Date ? venta.fecha : new Date(venta.fecha);
            const fechaKey = fecha.toISOString().split('T')[0];
            if (!grupos[fechaKey]) {
                grupos[fechaKey] = { total: 0, utilidad: 0, count: 0 };
            }
            grupos[fechaKey].total += venta.total || 0;
            grupos[fechaKey].utilidad += this.calcularUtilidadVenta(venta);
            grupos[fechaKey].count++;
        });
        return grupos;
    }

    agruparComprasPorDia(compras) {
        const grupos = {};
        compras.forEach(compra => {
            const fecha = compra.fecha instanceof Date ? compra.fecha : new Date(compra.fecha);
            const fechaKey = fecha.toISOString().split('T')[0];
            if (!grupos[fechaKey]) {
                grupos[fechaKey] = { total: 0, count: 0 };
            }
            grupos[fechaKey].total += compra.total || 0;
            grupos[fechaKey].count++;
        });
        return grupos;
    }

    calcularGastosTotales() {
        const gastosPorDia = {};

        // Egresos de caja (excepto retiro-efectivo)
        const movimientosCajaFiltrados = this.filtrarPorFecha(this.datos.cajas);
        movimientosCajaFiltrados.forEach(mov => {
            if (mov.tipo === 'egreso' && mov.categoria !== 'retiro-efectivo') {
                const fechaKey = mov.fecha.toISOString().split('T')[0];
                gastosPorDia[fechaKey] = (gastosPorDia[fechaKey] || 0) + (mov.monto || 0);
            }
        });

        // Egresos de Caja Mayor + Nómina
        const pagosFiltrados = this.filtrarPorFecha(this.datos.pagos);
        pagosFiltrados.forEach(pago => {
            if (pago.tipo === 'egreso' || pago.tipo === 'nomina') {
                const fechaKey = pago.fecha.toISOString().split('T')[0];
                gastosPorDia[fechaKey] = (gastosPorDia[fechaKey] || 0) + (pago.monto || 0);
            }
        });

        return gastosPorDia;
    }

    calcularGastosTotalesValor() {
        let total = 0;

        // Egresos de caja (excepto retiro-efectivo)
        const movimientosCajaFiltrados = this.filtrarPorFecha(this.datos.cajas);
        movimientosCajaFiltrados.forEach(mov => {
            if (mov.tipo === 'egreso' && mov.categoria !== 'retiro-efectivo') {
                total += mov.monto || 0;
            }
        });

        // Egresos de Caja Mayor + Nómina
        const pagosFiltrados = this.filtrarPorFecha(this.datos.pagos);
        pagosFiltrados.forEach(pago => {
            if (pago.tipo === 'egreso' || pago.tipo === 'nomina') {
                total += pago.monto || 0;
            }
        });

        return total;
    }

    formatearMoneda(valor) {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(valor || 0);
    }

    formatearMonedaCorta(valor) {
        if (valor >= 1000000) {
            return '$' + (valor / 1000000).toFixed(1) + 'M';
        } else if (valor >= 1000) {
            return '$' + (valor / 1000).toFixed(0) + 'K';
        }
        return '$' + valor;
    }

    formatearFecha(fechaStr) {
        const fecha = new Date(fechaStr);
        return fecha.toLocaleDateString('es-CO', {
            weekday: 'short',
            day: 'numeric',
            month: 'short'
        });
    }

    formatearFechaCorta(fechaStr) {
        const fecha = new Date(fechaStr);
        return fecha.toLocaleDateString('es-CO', {
            day: 'numeric',
            month: 'short'
        });
    }

    truncarTexto(texto, maxLength) {
        if (!texto) return '';
        if (texto.length <= maxLength) return texto;
        return texto.substring(0, maxLength) + '...';
    }

    actualizarElemento(id, valor) {
        const elemento = document.getElementById(id);
        if (elemento) {
            elemento.textContent = valor;
        }
    }

    mostrarModalExportar() {
        const modal = document.getElementById('modal-exportar');
        if (modal) modal.classList.add('active');
    }

    cerrarModalExportar() {
        const modal = document.getElementById('modal-exportar');
        if (modal) modal.classList.remove('active');
    }

    async exportarPDF() {
        this.cerrarModalExportar();
        this.mostrarNotificacion('Generando PDF...', 'info');
        
        setTimeout(() => {
            window.print();
            this.mostrarNotificacion('PDF listo para guardar', 'success');
        }, 500);
    }

    exportarExcel() {
        this.cerrarModalExportar();
        
        const ventasFiltradas = this.filtrarPorFecha(this.datos.ventas);
        const ventasPorDia = this.agruparVentasPorDia(ventasFiltradas);
        
        let csv = 'Fecha,Transacciones,Total Ventas,Utilidad,Ticket Promedio\n';
        Object.keys(ventasPorDia).sort().forEach(fecha => {
            const data = ventasPorDia[fecha];
            const ticketProm = data.count > 0 ? data.total / data.count : 0;
            csv += `${fecha},${data.count},${data.total},${data.utilidad},${ticketProm.toFixed(0)}\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `reporte_ventas_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();

        this.mostrarNotificacion('Archivo Excel descargado', 'success');
    }

    imprimir() {
        this.cerrarModalExportar();
        window.print();
    }

    mostrarNotificacion(mensaje, tipo = 'info') {
        const notif = document.createElement('div');
        notif.className = `notificacion notif-${tipo}`;
        notif.innerHTML = `<span>${mensaje}</span>`;
        notif.style.cssText = `
            position: fixed;
            bottom: 100px;
            right: 20px;
            padding: 16px 24px;
            background: ${tipo === 'success' ? '#34C759' : tipo === 'error' ? '#FF3B30' : '#007AFF'};
            color: white;
            border-radius: 12px;
            font-weight: 600;
            z-index: 9999;
            animation: slideInRight 0.3s ease;
            box-shadow: 0 4px 20px rgba(0,0,0,0.2);
        `;

        document.body.appendChild(notif);
        setTimeout(() => notif.remove(), 3000);
    }
}

// Función de inicialización global
function loadReportesModule() {
    console.log('🔄 Cargando módulo de reportes...');
    
    if (!window.db) {
        console.error('❌ Firebase no está inicializado');
        return null;
    }
    
    if (typeof Chart === 'undefined') {
        console.log('📦 Cargando Chart.js...');
        const script = document.createElement('script');
        script.id = 'chartjs-script';
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
        script.onload = () => {
            console.log('✅ Chart.js cargado');
            window.reportesModule = new ReportesModule();
        };
        script.onerror = () => {
            console.error('❌ Error cargando Chart.js');
        };
        document.head.appendChild(script);
    } else {
        console.log('✅ Chart.js ya disponible, inicializando módulo...');
        window.reportesModule = new ReportesModule();
    }
    
    return window.reportesModule;
}

if (typeof window !== 'undefined') {
    window.loadReportesModule = loadReportesModule;
}
