
// Módulo de Compras - Sistema Completo
class ComprasModule {
    constructor() {
        this.productos = [];
        this.proveedores = [];
        this.pedido = [];
        this.compras = [];
        this.currentTab = 'pedido';
        this.searchTimeout = null;
        this.searchSelectedIndex = -1;
        this.init();
    }

    async init() {
        console.log('📦 Inicializando módulo de compras...');

        // 1. Crear modales primero
        await this.crearModales();

        // 2. Cargar datos
        await this.cargarProductos();
        await this.cargarProveedores();
        await this.cargarCompras();

        // 3. Setup
        this.setupEventListeners();
        this.setupTabsSystem();
        this.actualizarEstadisticas();
        this.renderPedido();

        console.log('✅ Módulo de compras inicializado');
    }

    async crearModales() {
        // Verificar si los modales ya existen
        if (document.getElementById('modal-seleccion-producto')) {
            console.log('✅ Modales de compras ya existen');
            return;
        }

        console.log('📦 Creando modales de compras en el contenedor permanente...');

        let permanentContainer = document.getElementById('permanent-modals-container');
        if (!permanentContainer) {
            permanentContainer = document.createElement('div');
            permanentContainer.id = 'permanent-modals-container';
            permanentContainer.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 9999;';
            document.body.appendChild(permanentContainer);
        }

        try {
            // Cargar el HTML de los modales
            const response = await fetch('./modules/compras/compras-modals.html');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const modalsHTML = await response.text();

            // Crear un div temporal para parsear el HTML
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = modalsHTML;

            // Mover los modales al contenedor permanente
            while (tempDiv.firstChild) {
                permanentContainer.appendChild(tempDiv.firstChild);
            }

            console.log('✅ Modales de compras creados en contenedor permanente');

        } catch (error) {
            console.error('❌ Error cargando modales:', error);
            console.error('URL intentada:', './modules/compras/compras-modals.html');
        }
    }

    setupTabsSystem() {
        const tabs = document.querySelectorAll('.compras-tab');
        const indicator = document.querySelector('.tab-indicator');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetTab = tab.dataset.tab;
                this.cambiarTab(targetTab, tab);
            });
        });

        const activeTab = document.querySelector('.compras-tab.active');
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

    setupEventListeners() {
        // Búsqueda de productos
        const searchInput = document.getElementById('pedido-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchSelectedIndex = -1;
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

            searchInput.addEventListener('keydown', (e) => {
                const dropdown = document.getElementById('productos-resultados');
                if (!dropdown || !dropdown.classList.contains('active')) return;
                const items = dropdown.querySelectorAll('.producto-card');
                if (!items.length) return;

                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    this.searchSelectedIndex = Math.min(this.searchSelectedIndex + 1, items.length - 1);
                    this._highlightSearchItem(items);
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    this.searchSelectedIndex = Math.max(this.searchSelectedIndex - 1, -1);
                    this._highlightSearchItem(items);
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (this.searchSelectedIndex >= 0 && items[this.searchSelectedIndex]) {
                        items[this.searchSelectedIndex].click();
                    } else if (items.length === 1) {
                        items[0].click();
                    }
                } else if (e.key === 'Escape') {
                    this.hideResultados();
                    this.searchSelectedIndex = -1;
                }
            });
        }

        // Cerrar dropdown
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-container')) {
                this.hideResultados();
                this.searchSelectedIndex = -1;
            }
        });

        // Limpiar pedido
        const btnLimpiar = document.getElementById('btn-limpiar-pedido');
        if (btnLimpiar) {
            btnLimpiar.addEventListener('click', () => this.limpiarPedido());
        }

        // Procesar compra
        const btnProcesar = document.getElementById('btn-procesar-compra');
        if (btnProcesar) {
            btnProcesar.addEventListener('click', () => this.procesarCompra());
        }

        // Modal de selección
        const modalClose = document.getElementById('modal-seleccion-close');
        if (modalClose) {
            modalClose.addEventListener('click', () => this.cerrarModalSeleccion());
        }

        // Modal de detalle
        const modalDetalleClose = document.getElementById('modal-detalle-close');
        if (modalDetalleClose) {
            modalDetalleClose.addEventListener('click', () => {
                const m = document.getElementById('modal-detalle-compra');
                if (m) {
                    m.classList.remove('active');
                    const pc = document.getElementById('permanent-modals-container');
                    if (pc && m.parentElement !== pc) pc.appendChild(m);
                }
            });
        }

        // Modal de edición de precios
        const modalEditarPreciosClose = document.getElementById('modal-editar-precios-close');
        if (modalEditarPreciosClose) {
            modalEditarPreciosClose.addEventListener('click', () => this.cerrarModalEditarPrecios());
        }

        const btnCancelarEditarPrecios = document.getElementById('btn-cancelar-editar-precios');
        if (btnCancelarEditarPrecios) {
            btnCancelarEditarPrecios.addEventListener('click', () => this.cerrarModalEditarPrecios());
        }

        const btnGuardarEditarPrecios = document.getElementById('btn-guardar-editar-precios');
        if (btnGuardarEditarPrecios) {
            btnGuardarEditarPrecios.addEventListener('click', () => this.guardarPreciosEditados());
        }

        // Modal de anular compra
        const modalAnularClose = document.getElementById('modal-anular-close');
        if (modalAnularClose) {
            modalAnularClose.addEventListener('click', () => this.cerrarModalAnularCompra());
        }

        const btnCancelarAnular = document.getElementById('btn-cancelar-anular');
        if (btnCancelarAnular) {
            btnCancelarAnular.addEventListener('click', () => this.cerrarModalAnularCompra());
        }

        const btnConfirmarAnular = document.getElementById('btn-confirmar-anular');
        if (btnConfirmarAnular) {
            btnConfirmarAnular.addEventListener('click', () => this.anularCompra());
        }

        // Filtros de historial
        const historialSearch = document.getElementById('historial-search');
        if (historialSearch) {
            historialSearch.addEventListener('input', (e) => {
                this.filtrarHistorial(e.target.value);
            });
        }

        const filterPeriodo = document.getElementById('filter-periodo');
        const filterProveedor = document.getElementById('filter-proveedor');

        [filterPeriodo, filterProveedor].forEach(filter => {
            if (filter) {
                filter.addEventListener('change', () => this.aplicarFiltrosHistorial());
            }
        });
    }

    cambiarTab(tab, tabElement = null) {
        this.currentTab = tab;

        document.querySelectorAll('.compras-tab').forEach(t => t.classList.remove('active'));
        
        const targetTabElement = tabElement || document.querySelector(`.compras-tab[data-tab="${tab}"]`);
        if (targetTabElement) {
            targetTabElement.classList.add('active');
            const indicator = document.querySelector('.tab-indicator');
            if (indicator) this.updateTabIndicator(targetTabElement, indicator, true);
        }

        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById(`tab-${tab}`).classList.add('active');

        if (tab === 'historial') {
            this.renderHistorial();
        } else if (tab === 'estadisticas') {
            this.actualizarEstadisticas();
        }
    }

    async cargarProductos() {
        try {
            // 🚀 OPTIMIZACIÓN: Usar caché para reducir queries a Firebase
            if (window.cacheManager) {
                this.productos = await window.cacheManager.getOrFetch('productos_cache', async () => {
                    const snapshot = await window.db.collection('products').get();
                    return snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                });
            } else {
                // Fallback si cache-manager no está disponible
                const snapshot = await window.db.collection('products').get();
                this.productos = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
            }
            console.log(`📦 ${this.productos.length} productos cargados`);
        } catch (error) {
            console.error('Error cargando productos:', error);
            this.productos = [];
        }
    }

    async cargarProveedores() {
        try {
            const snapshot = await window.db.collection('providers').get();
            this.proveedores = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            const selectProveedor = document.getElementById('select-proveedor');
            const filterProveedor = document.getElementById('filter-proveedor');

            if (selectProveedor) {
                selectProveedor.innerHTML = '<option value="">Seleccionar proveedor</option>';
                this.proveedores.forEach(proveedor => {
                    const option = document.createElement('option');
                    option.value = proveedor.id;
                    option.textContent = proveedor.nombre;
                    selectProveedor.appendChild(option);
                });
            }

            if (filterProveedor) {
                filterProveedor.innerHTML = '<option value="">Todos los proveedores</option>';
                this.proveedores.forEach(proveedor => {
                    const option = document.createElement('option');
                    option.value = proveedor.id;
                    option.textContent = proveedor.nombre;
                    filterProveedor.appendChild(option);
                });
            }

            console.log(`🚚 ${this.proveedores.length} proveedores cargados`);
        } catch (error) {
            console.error('Error cargando proveedores:', error);
            this.proveedores = [];
        }
    }

    async cargarCompras() {
        try {
            // 🚀 OPTIMIZACIÓN: Usar caché para reducir queries a Firebase
            if (window.cacheManager) {
                this.compras = await window.cacheManager.getOrFetch('compras_cache', async () => {
                    const snapshot = await window.db.collection('purchases')
                        .orderBy('fecha', 'desc')
                        .limit(100)
                        .get();
                    return snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                });
            } else {
                // Fallback si cache-manager no está disponible
                const snapshot = await window.db.collection('purchases')
                    .orderBy('fecha', 'desc')
                    .limit(100)
                    .get();
                this.compras = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
            }
            console.log(`💰 ${this.compras.length} compras cargadas`);
        } catch (error) {
            console.error('Error cargando compras:', error);
            this.compras = [];
        }
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

            let puntuacion = 0;
            let coincide = false;

            if (nombreProducto === search) {
                puntuacion = 1000; coincide = true;
            } else if (nombreProducto.startsWith(search)) {
                puntuacion = 500; coincide = true;
            } else if (nombreProducto.includes(search)) {
                puntuacion = 300; coincide = true;
            } else if (codigoProducto.includes(search)) {
                puntuacion = 400; coincide = true;
            } else if (this._fuzzyMatch(nombreProducto, search)) {
                puntuacion = 200; coincide = true;
            }

            // Buscar en variantes y sus códigos
            if (producto.tipo === 'variantes' && producto.variantes) {
                const variantesArray = Array.isArray(producto.variantes)
                    ? producto.variantes : Object.values(producto.variantes || {});
                variantesArray.forEach(v => {
                    const nv = v.nombre?.toLowerCase() || '';
                    const cv = v.codigoBarras?.toLowerCase() || '';
                    if (nv.includes(search) || cv.includes(search)) {
                        puntuacion = Math.max(puntuacion, 350); coincide = true;
                    }
                });
            }

            if (coincide) {
                resultados.push({ producto, puntuacion });
            }
        });

        resultados.sort((a, b) => b.puntuacion - a.puntuacion);
        this.mostrarResultados(resultados.map(r => r.producto));
    }

    _fuzzyMatch(text, search) {
        if (search.length < 3) return false;
        let searchIndex = 0, matchCount = 0;
        for (let i = 0; i < text.length && searchIndex < search.length; i++) {
            if (text[i] === search[searchIndex]) { matchCount++; searchIndex++; }
        }
        const tolerance = Math.min(2, Math.floor(search.length / 3));
        return (search.length - matchCount) <= tolerance;
    }

    _highlightSearchItem(items) {
        items.forEach((item, i) => {
            item.classList.toggle('search-highlighted', i === this.searchSelectedIndex);
            if (i === this.searchSelectedIndex) {
                item.scrollIntoView({ block: 'nearest' });
            }
        });
    }

    mostrarResultados(resultados) {
        const dropdown = document.getElementById('productos-resultados');
        if (!dropdown) return;

        if (resultados.length === 0) {
            dropdown.innerHTML = '<div style="padding: 20px; text-align: center; color: #6D6D80;">No se encontraron productos</div>';
            dropdown.classList.add('active');
            return;
        }

        const formatter = window.currencyFormatter;

        dropdown.innerHTML = resultados.slice(0, 10).map(producto => {
            const iconoTipo = producto.tipo === 'simple' ? '📦' : 
                             producto.tipo === 'variantes' ? '🔀' : '🔄';
            const tipoLabel = producto.tipo === 'simple' ? '' : 
                             producto.tipo === 'variantes' ? ' (Variantes)' : ' (Conversiones)';
            
            let precio = producto.precio?.costo || 0;
            
            // Calcular stock según el tipo de producto
            let stockInfo = '';
            if (producto.tipo === 'simple') {
                const stock = producto.stock?.actual || 0;
                stockInfo = `📦 Stock: ${stock}`;
            } else if (producto.tipo === 'variantes') {
                const variantesArray = Array.isArray(producto.variantes) 
                    ? producto.variantes 
                    : Object.values(producto.variantes || {});
                const stockTotal = variantesArray.reduce((sum, v) => sum + (v.stock?.actual || 0), 0);
                stockInfo = `📦 Stock Total: ${stockTotal}`;
            } else if (producto.tipo === 'conversion') {
                const conversionesArray = Array.isArray(producto.conversiones) 
                    ? producto.conversiones 
                    : Object.values(producto.conversiones || {});
                const totalCantidad = conversionesArray.reduce((sum, c) => sum + (c.cantidad || 0), 0);
                stockInfo = `📦 Total: ${totalCantidad} ${producto.unidadBase || 'unidades'}`;
            }

            return `
                <div class="producto-card" onclick='comprasModule.seleccionarProducto(${JSON.stringify(producto).replace(/'/g, "\\'")})'>
                    <span class="producto-icon">${iconoTipo}</span>
                    <div class="producto-info">
                        <div class="producto-nombre">${producto.nombre}${tipoLabel}</div>
                        <div class="producto-stock">${stockInfo}</div>
                    </div>
                    <div style="text-align: right;">
                        <div class="producto-precio">${formatter ? formatter.format(precio) : '$' + precio.toFixed(2)}</div>
                    </div>
                </div>
            `;
        }).join('');

        dropdown.classList.add('active');
    }

    seleccionarProducto(producto) {
        this.hideResultados();

        // Validación estricta de proveedor
        const selectProveedor = document.getElementById('select-proveedor');
        const proveedorActual = selectProveedor.value;

        if (!producto.proveedor) {
            this.showNotification('⚠️ Este producto no tiene proveedor asignado. Asígnalo desde Inventario.', 'warning');
            return;
        }

        // Si ya hay productos en el pedido, validar mismo proveedor
        if (this.pedido.length > 0 && proveedorActual && proveedorActual !== producto.proveedor) {
            const proveedorNombreActual = this.proveedores.find(p => p.id === proveedorActual)?.nombre || 'actual';
            this.showNotification(
                `❌ No puedes mezclar proveedores en el mismo pedido. El pedido actual es de "${proveedorNombreActual}". Para agregar productos de otro proveedor, limpia el pedido primero.`,
                'error'
            );
            return;
        }

        // Auto-seleccionar el proveedor del producto (solo si es el primero o está vacío)
        if (!proveedorActual || this.pedido.length === 0) {
            selectProveedor.value = producto.proveedor;
            selectProveedor.disabled = true; // Bloquear cambio de proveedor mientras hay productos
            this.showNotification(`🚚 Proveedor: ${producto.proveedorNombre || 'Seleccionado'}`, 'info');
        }

        if (producto.tipo === 'simple') {
            const precio = producto.precio?.costo || 0;
            this.agregarAlPedido({
                producto,
                tipo: 'simple',
                precio,
                nombre: producto.nombre
            });
        } else {
            this.abrirModalSeleccion(producto);
        }
    }

    abrirModalSeleccion(producto) {
        const modal = document.getElementById('modal-seleccion-producto') || document.querySelector('.modal-compras#modal-seleccion-producto');
        const title = document.getElementById('seleccion-producto-nombre');
        const content = document.getElementById('seleccion-producto-content');

        title.textContent = producto.nombre;

        if (producto.tipo === 'variantes') {
            const variantesArray = Array.isArray(producto.variantes) 
                ? producto.variantes 
                : Object.values(producto.variantes || {});

            content.innerHTML = variantesArray.map((variante, vIdx) => {
                const opcionesArray = variante.opciones 
                    ? (Array.isArray(variante.opciones) ? variante.opciones : Object.values(variante.opciones || {}))
                    : [];

                const precio = variante.precio?.costo || 0;
                const varianteStock = variante.stock?.actual || 0;

                if (opcionesArray.length > 0) {
                    const opcionesHTML = opcionesArray.map((opcion, oIdx) => {
                        const opcionStock = opcion.stock?.actual || 0;
                        return `
                            <div class="opcion-seleccion" 
                                 onclick='comprasModule.seleccionarVarianteOpcion(${JSON.stringify(producto).replace(/'/g, "\\'")}, ${vIdx}, ${oIdx})'>
                                <div class="opcion-info">
                                    <div class="opcion-nombre">• ${opcion.nombre}</div>
                                    <div class="opcion-stock" style="font-size: 0.85rem; color: #6D6D80; margin-top: 4px;">📦 Stock: ${opcionStock}</div>
                                </div>
                                <span class="opcion-precio">${window.currencyFormatter?.format(precio) || '$' + precio.toFixed(2)}</span>
                            </div>
                        `;
                    }).join('');

                    return `
                        <div class="variante-grupo">
                            <h4 style="color: #FF9500; margin-bottom: 12px;">📦 ${variante.nombre}</h4>
                            ${opcionesHTML}
                        </div>
                    `;
                } else {
                    return `
                        <div class="variante-seleccion" 
                             onclick='comprasModule.seleccionarVariante(${JSON.stringify(producto).replace(/'/g, "\\'")}, ${vIdx})'>
                            <div class="variante-info">
                                <div class="variante-nombre">📦 ${variante.nombre}</div>
                                <div class="variante-stock" style="font-size: 0.85rem; color: #6D6D80; margin-top: 4px;">Stock: ${varianteStock}</div>
                            </div>
                            <span class="variante-precio">${window.currencyFormatter?.format(precio) || '$' + precio.toFixed(2)}</span>
                        </div>
                    `;
                }
            }).join('');

        } else if (producto.tipo === 'conversion') {
            const conversionesArray = Array.isArray(producto.conversiones) 
                ? producto.conversiones 
                : Object.values(producto.conversiones || {});

            content.innerHTML = conversionesArray.map((conversion, cIdx) => {
                const precio = conversion.precio?.costo || 0;

                return `
                    <div class="conversion-seleccion" 
                         onclick='comprasModule.seleccionarConversion(${JSON.stringify(producto).replace(/'/g, "\\'")}, ${cIdx})'>
                        <div class="conversion-info">
                            <div class="conversion-nombre">🔄 ${conversion.tipo}</div>
                            <div class="conversion-stock">${conversion.cantidad} ${producto.unidadBase}</div>
                        </div>
                        <span class="conversion-precio">${window.currencyFormatter?.format(precio) || '$' + precio.toFixed(2)}</span>
                    </div>
                `;
            }).join('');
        }

        if (modal) {
            if (modal.parentElement !== document.body) document.body.appendChild(modal);
            modal.style.cssText = '';
            modal.classList.add('active');
            document.getElementById('pedido-search').value = '';
        }
    }

    seleccionarVariante(producto, varianteIndex) {
        const variantesArray = Array.isArray(producto.variantes) 
            ? producto.variantes 
            : Object.values(producto.variantes || {});
        const variante = variantesArray[varianteIndex];
        const precio = variante.precio?.costo || 0;

        this.agregarAlPedido({
            producto,
            tipo: 'variante-simple',
            varianteIndex,
            variante,
            precio,
            nombre: `${producto.nombre} - ${variante.nombre}`
        });

        this.cerrarModalSeleccion();
    }

    seleccionarVarianteOpcion(producto, varianteIndex, opcionIndex) {
        const variantesArray = Array.isArray(producto.variantes) 
            ? producto.variantes 
            : Object.values(producto.variantes || {});
        const variante = variantesArray[varianteIndex];
        const opcionesArray = Array.isArray(variante.opciones) 
            ? variante.opciones 
            : Object.values(variante.opciones || {});
        const opcion = opcionesArray[opcionIndex];
        const precio = variante.precio?.costo || 0;

        this.agregarAlPedido({
            producto,
            tipo: 'variante-opcion',
            varianteIndex,
            opcionIndex,
            variante,
            opcion,
            precio,
            nombre: `${producto.nombre} - ${variante.nombre} - ${opcion.nombre}`
        });

        this.cerrarModalSeleccion();
    }

    seleccionarConversion(producto, conversionIndex) {
        const conversionesArray = Array.isArray(producto.conversiones) 
            ? producto.conversiones 
            : Object.values(producto.conversiones || {});
        const conversion = conversionesArray[conversionIndex];
        const precio = conversion.precio?.costo || 0;

        this.agregarAlPedido({
            producto,
            tipo: 'conversion',
            conversionIndex,
            conversion,
            precio,
            nombre: `${producto.nombre} - ${conversion.tipo}`
        });

        this.cerrarModalSeleccion();
    }

    cerrarModalSeleccion() {
        const modal = document.getElementById('modal-seleccion-producto');
        if (modal) {
            modal.classList.remove('active');
            const pc = document.getElementById('permanent-modals-container');
            if (pc && modal.parentElement !== pc) pc.appendChild(modal);
        }
    }

    hideResultados() {
        const dropdown = document.getElementById('productos-resultados');
        if (dropdown) dropdown.classList.remove('active');
    }

    agregarAlPedido(item) {
        const existente = this.pedido.find(p => 
            p.producto.id === item.producto.id && 
            p.tipo === item.tipo &&
            (item.tipo === 'variante-opcion' ? p.opcionIndex === item.opcionIndex && p.varianteIndex === item.varianteIndex : true) &&
            (item.tipo === 'variante-simple' ? p.varianteIndex === item.varianteIndex : true) &&
            (item.tipo === 'conversion' ? p.conversionIndex === item.conversionIndex : true)
        );

        if (existente) {
            existente.cantidad++;
            existente.subtotal = existente.cantidad * existente.precioUnitario;
        } else {
            this.pedido.unshift({
                ...item,
                cantidad: 1,
                precioUnitario: item.precio,
                subtotal: item.precio
            });
        }

        this.renderPedido();
        this.hideResultados();
        document.getElementById('pedido-search').value = '';
    }

    renderPedido() {
        const container = document.getElementById('pedido-items');
        const btnProcesar = document.getElementById('btn-procesar-compra');

        if (this.pedido.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <rect x="1" y="3" width="15" height="13"></rect>
                            <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                            <circle cx="5.5" cy="18.5" r="2.5"></circle>
                            <circle cx="18.5" cy="18.5" r="2.5"></circle>
                        </svg>
                    </div>
                    <p>El pedido está vacío</p>
                </div>
            `;
            btnProcesar.disabled = true;
            this.actualizarTotales();
            return;
        }

        container.innerHTML = this.pedido.map((item, idx) => {
            const precioModificado = item.preciosEditados ? '💰' : '';
            return `
            <div class="pedido-item">
                <div style="flex: 1;">
                    <div class="pedido-item-info">
                        <div class="pedido-item-nombre">${precioModificado} ${item.nombre}</div>
                        ${item.preciosEditados ? '<small style="color: #FF9500;">Precios personalizados</small>' : ''}
                    </div>
                    <div class="pedido-item-cantidad">
                        <label style="font-size: 0.8rem; color: #6D6D80;">Cantidad:</label>
                        <input type="number" 
                               id="cantidad-input-${idx}"
                               class="cantidad-input" 
                               value="${item.cantidad}" 
                               min="1" 
                               onchange="comprasModule.actualizarCantidad(${idx}, this.value)"
                               onkeyup="if(event.key==='Enter') comprasModule.actualizarCantidad(${idx}, this.value)">
                    </div>
                </div>
                <div style="text-align: right;">
                    <div class="pedido-item-precio">${window.currencyFormatter?.format(item.subtotal) || '$' + item.subtotal.toFixed(2)}</div>
                    <div style="display: flex; gap: 4px; margin-top: 6px;">
                        <button class="btn-editar-precio" onclick="comprasModule.abrirModalEditarPrecios(${idx})" title="Editar precios">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="12" y1="1" x2="12" y2="23"></line>
                                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                            </svg>
                        </button>
                        <button class="btn-remove-item" onclick="comprasModule.eliminarDelPedido(${idx})" title="Eliminar producto">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        `;
        }).join('');

        btnProcesar.disabled = this.pedido.length === 0;
        this.actualizarTotales();
    }

    abrirModalEditarPrecios(itemIndex) {
        const itemActual = this.pedido[itemIndex];
        if (!itemActual) return;

        this.itemEditandoPrecios = itemIndex;

        // Obtener precios actuales (editados o del producto)
        let precios = itemActual.preciosEditados || {
            costo: itemActual.precio || 0,
            publico: itemActual.producto.precio?.publico || 0,
            mayorista: itemActual.producto.precio?.mayorista || 0
        };

        // Si es variante u opción, obtener precios específicos
        if (itemActual.tipo === 'variante-simple' && itemActual.variante) {
            if (!itemActual.preciosEditados) {
                precios.costo = itemActual.variante.precio?.costo || 0;
                precios.publico = itemActual.variante.precio?.publico || 0;
                precios.mayorista = itemActual.variante.precio?.mayorista || 0;
            }
        } else if (itemActual.tipo === 'variante-opcion' && itemActual.variante) {
            if (!itemActual.preciosEditados) {
                precios.costo = itemActual.variante.precio?.costo || 0;
                precios.publico = itemActual.variante.precio?.publico || 0;
                precios.mayorista = itemActual.variante.precio?.mayorista || 0;
            }
        } else if (itemActual.tipo === 'conversion' && itemActual.conversion) {
            if (!itemActual.preciosEditados) {
                precios.costo = itemActual.conversion.precio?.costo || 0;
                precios.publico = itemActual.conversion.precio?.publico || 0;
                precios.mayorista = itemActual.conversion.precio?.mayorista || 0;
            }
        }

        // Llenar modal
        document.getElementById('editar-precio-producto-nombre').textContent = itemActual.nombre;
        document.getElementById('editar-precio-costo').value = precios.costo;
        document.getElementById('editar-precio-publico').value = precios.publico;
        document.getElementById('editar-precio-mayorista').value = precios.mayorista;

        const modalEditar = document.getElementById('modal-editar-precios');
        if (modalEditar) {
            if (modalEditar.parentElement !== document.body) document.body.appendChild(modalEditar);
            modalEditar.style.cssText = '';
            modalEditar.classList.add('active');
        }
    }

    cerrarModalEditarPrecios() {
        const modal = document.getElementById('modal-editar-precios');
        if (modal) {
            modal.classList.remove('active');
            const pc = document.getElementById('permanent-modals-container');
            if (pc && modal.parentElement !== pc) pc.appendChild(modal);
        }
        this.itemEditandoPrecios = null;
    }

    guardarPreciosEditados() {
        if (this.itemEditandoPrecios === null) return;

        const precioCosto = parseFloat(document.getElementById('editar-precio-costo').value);
        const precioPublico = parseFloat(document.getElementById('editar-precio-publico').value);
        const precioMayorista = parseFloat(document.getElementById('editar-precio-mayorista').value);

        if (!precioCosto || precioCosto <= 0 || !precioPublico || !precioMayorista) {
            this.showNotification('Ingresa precios válidos', 'warning');
            return;
        }

        const item = this.pedido[this.itemEditandoPrecios];
        
        if (!item) {
            console.error('❌ Item no encontrado en el pedido al guardar precios');
            this.cerrarModalEditarPrecios();
            return;
        }
        
        // Guardar precios editados temporalmente
        item.preciosEditados = {
            costo: precioCosto,
            publico: precioPublico,
            mayorista: precioMayorista
        };

        // Actualizar precio unitario del item con el nuevo costo
        item.precioUnitario = precioCosto;
        item.precio = precioCosto;
        item.subtotal = item.cantidad * precioCosto;

        this.showNotification('💰 Precios actualizados. Se aplicarán al inventario al procesar la compra', 'success');
        this.cerrarModalEditarPrecios();
        this.renderPedido();
    }

    cambiarCantidad(index, cambio) {
        const item = this.pedido[index];
        const nuevaCantidad = item.cantidad + cambio;

        if (nuevaCantidad <= 0) {
            this.eliminarDelPedido(index);
            return;
        }

        item.cantidad = nuevaCantidad;
        item.subtotal = item.cantidad * item.precioUnitario;
        this.renderPedido();
    }

    actualizarCantidad(index, nuevaCantidad) {
        const item = this.pedido[index];
        nuevaCantidad = parseInt(nuevaCantidad) || 1;

        if (nuevaCantidad <= 0) {
            this.eliminarDelPedido(index);
            return;
        }

        item.cantidad = nuevaCantidad;
        item.subtotal = item.cantidad * item.precioUnitario;
        this.renderPedido();
    }

    eliminarDelPedido(index) {
        this.pedido.splice(index, 1);
        
        // Si ya no hay productos, habilitar selector de proveedor
        if (this.pedido.length === 0) {
            const selectProveedor = document.getElementById('select-proveedor');
            if (selectProveedor) {
                selectProveedor.value = '';
                selectProveedor.disabled = false;
            }
        }
        
        this.renderPedido();
    }

    limpiarPedido() {
        if (this.pedido.length === 0) return;
        if (confirm('¿Limpiar todo el pedido?')) {
            this.pedido = [];
            
            // Habilitar nuevamente el selector de proveedor
            const selectProveedor = document.getElementById('select-proveedor');
            if (selectProveedor) {
                selectProveedor.value = '';
                selectProveedor.disabled = false;
            }
            
            this.renderPedido();
            this.showNotification('🧹 Pedido limpiado. Puedes seleccionar otro proveedor.', 'info');
        }
    }

    actualizarTotales() {
        const subtotal = this.pedido.reduce((sum, item) => sum + item.subtotal, 0);

        document.getElementById('pedido-subtotal').textContent = 
            window.currencyFormatter?.format(subtotal) || '$' + subtotal.toFixed(2);
        document.getElementById('pedido-total').textContent = 
            window.currencyFormatter?.format(subtotal) || '$' + subtotal.toFixed(2);
    }

    async procesarCompra() {
        if (this.pedido.length === 0) {
            this.showNotification('El pedido está vacío', 'warning');
            return;
        }

        const proveedorId = document.getElementById('select-proveedor').value;
        if (!proveedorId) {
            this.showNotification('Debes seleccionar un proveedor', 'error');
            return;
        }

        const proveedor = this.proveedores.find(p => p.id === proveedorId);
        if (!proveedor) {
            this.showNotification('Proveedor no encontrado', 'error');
            return;
        }

        // Validación estricta: TODOS los productos deben ser del mismo proveedor
        const productosInvalidos = this.pedido.filter(item => 
            !item.producto.proveedor || item.producto.proveedor !== proveedorId
        );

        if (productosInvalidos.length > 0) {
            const nombresInvalidos = productosInvalidos.map(item => item.nombre).join(', ');
            this.showNotification(
                `❌ ERROR: Hay productos que no pertenecen a ${proveedor.nombre}: ${nombresInvalidos}. Elimínalos del pedido.`,
                'error'
            );
            return;
        }

        const metodoPago = document.getElementById('metodo-pago-compra').value;
        const notas = document.getElementById('notas-pedido').value;
        const total = this.pedido.reduce((sum, item) => sum + item.subtotal, 0);

        this.showLoading();

        try {
            const folio = `C-${Date.now()}`;
            const ahora = new Date();

            const compraData = {
                folio: folio,
                fecha: firebase.firestore.Timestamp.fromDate(ahora),
                productos: this.pedido.map(item => ({
                    productoId: item.producto.id,
                    nombre: item.nombre,
                    cantidad: item.cantidad,
                    precioUnitario: item.precioUnitario,
                    subtotal: item.subtotal,
                    tipo: item.tipo,
                    ...(item.varianteIndex !== undefined && { varianteIndex: item.varianteIndex }),
                    ...(item.opcionIndex !== undefined && { opcionIndex: item.opcionIndex }),
                    ...(item.conversionIndex !== undefined && { conversionIndex: item.conversionIndex })
                })),
                total: total,
                proveedor: {
                    id: proveedorId,
                    nombre: proveedor.nombre
                },
                metodoPago: metodoPago,
                notas: notas,
                recibidoPor: window.authSystem?.currentUser?.nombre || 'Sistema',
                recibidoPorId: window.authSystem?.currentUser?.uid || 'system',
                metadata: {
                    createdAt: firebase.firestore.Timestamp.fromDate(ahora),
                    createdBy: window.authSystem?.currentUser?.uid || 'system'
                }
            };

            // Guardar compra
            const compraRef = await window.db.collection('purchases').add(compraData);

            // Actualizar inventario (cantidades y precios)
            await this.actualizarInventario(this.pedido);

            this.showNotification('✅ Compra registrada exitosamente', 'success');
            
            this.pedido = [];
            document.getElementById('notas-pedido').value = '';
            
            // Habilitar selector de proveedor para siguiente pedido
            const selectProveedor = document.getElementById('select-proveedor');
            if (selectProveedor) {
                selectProveedor.value = '';
                selectProveedor.disabled = false;
            }
            
            this.renderPedido();
            await this.cargarCompras();
            this.actualizarEstadisticas();

        } catch (error) {
            console.error('Error procesando compra:', error);
            this.showNotification('❌ Error al procesar la compra', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async actualizarInventario(items) {
        this.showLoading();
        try {
            // 1. Agrupar items por producto para evitar conflictos de escritura (batches de Firestore)
            const productosAgrupados = items.reduce((acc, item) => {
                const id = item.producto.id;
                if (!acc[id]) acc[id] = [];
                acc[id].push(item);
                return acc;
            }, {});

            const batch = window.db.batch();

            for (const [productoId, itemsProducto] of Object.entries(productosAgrupados)) {
                const productoRef = window.db.collection('products').doc(productoId);
                const productoDoc = await productoRef.get();
                
                if (!productoDoc.exists) {
                    console.warn(`⚠️ Producto ${productoId} no encontrado, saltando...`);
                    continue;
                }

                const productoOriginal = productoDoc.data();
                const updateData = {};
                
                // Procesar todos los cambios para este producto específico
                for (const item of itemsProducto) {
                    const cantidad = parseInt(item.cantidad) || 0;

                    if (item.tipo === 'simple') {
                        const stockActual = (updateData['stock.actual'] !== undefined) 
                            ? updateData['stock.actual'] 
                            : (productoOriginal.stock?.actual || 0);
                        
                        updateData['stock.actual'] = stockActual + cantidad;

                        if (item.preciosEditados) {
                            updateData['precio.costo'] = Number(item.preciosEditados.costo);
                            updateData['precio.publico'] = Number(item.preciosEditados.publico);
                            updateData['precio.mayorista'] = Number(item.preciosEditados.mayorista);
                        }

                    } else if (item.tipo === 'variante-simple' || item.tipo === 'variante-opcion') {
                        // Usamos copia local del array de variantes para cambios múltiples en el mismo producto
                        if (!updateData.variantes) {
                            updateData.variantes = Array.isArray(productoOriginal.variantes) 
                                ? [...productoOriginal.variantes] 
                                : Object.values(productoOriginal.variantes || {});
                        }

                        const vIdx = item.varianteIndex;
                        if (updateData.variantes[vIdx]) {
                            if (item.tipo === 'variante-simple') {
                                const stockActual = (updateData.variantes[vIdx].stock?.actual || 0);
                                updateData.variantes[vIdx].stock = {
                                    ...updateData.variantes[vIdx].stock,
                                    actual: stockActual + cantidad
                                };
                            } else {
                                // variante-opcion
                                const oIdx = item.opcionIndex;
                                if (!updateData.variantes[vIdx].opciones) updateData.variantes[vIdx].opciones = [];
                                
                                const opciones = Array.isArray(updateData.variantes[vIdx].opciones)
                                    ? [...updateData.variantes[vIdx].opciones]
                                    : Object.values(updateData.variantes[vIdx].opciones || {});
                                
                                if (opciones[oIdx]) {
                                    const stockActual = (opciones[oIdx].stock?.actual || 0);
                                    opciones[oIdx].stock = {
                                        ...opciones[oIdx].stock,
                                        actual: stockActual + cantidad
                                    };
                                    updateData.variantes[vIdx].opciones = opciones;
                                }
                            }

                            // Actualizar precio de la variante si se editó
                            if (item.preciosEditados) {
                                updateData.variantes[vIdx].precio = {
                                    ...updateData.variantes[vIdx].precio,
                                    costo: Number(item.preciosEditados.costo),
                                    publico: Number(item.preciosEditados.publico),
                                    mayorista: Number(item.preciosEditados.mayorista)
                                };
                            }
                        }

                    } else if (item.tipo === 'conversion') {
                        const stockActualBase = (updateData['stock.actual'] !== undefined)
                            ? updateData['stock.actual']
                            : (productoOriginal.stock?.actual || 0);
                        
                        const conversiones = updateData.conversiones || (Array.isArray(productoOriginal.conversiones) 
                            ? [...productoOriginal.conversiones] 
                            : Object.values(productoOriginal.conversiones || {}));

                        const cIdx = item.conversionIndex;
                        if (conversiones[cIdx]) {
                            const factor = Number(conversiones[cIdx].cantidad) || 1;
                            updateData['stock.actual'] = stockActualBase + (cantidad * factor);

                            if (item.preciosEditados) {
                                conversiones[cIdx].precio = {
                                    ...conversiones[cIdx].precio,
                                    costo: Number(item.preciosEditados.costo),
                                    publico: Number(item.preciosEditados.publico),
                                    mayorista: Number(item.preciosEditados.mayorista)
                                };
                                updateData.conversiones = conversiones;
                            }
                        }
                    }
                }

                // Aplicar todos los cambios acumulados para este producto
                if (Object.keys(updateData).length > 0) {
                    batch.update(productoRef, updateData);
                }
            }

            await batch.commit();
            console.log('✅ Inventario actualizado correctamente agrupando por producto');

        } catch (error) {
            console.error('❌ Error en actualizarInventario:', error);
            throw error; // Re-lanzar para que lo capture procesarCompra
        }
    }

    async actualizarEstadisticas() {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        const comprasHoy = this.compras.filter(c => {
            const fechaCompra = c.fecha?.toDate ? c.fecha.toDate() : new Date(c.fecha);
            return fechaCompra >= hoy;
        });

        const totalHoy = comprasHoy.reduce((sum, c) => sum + (c.total || 0), 0);
        const productosRecibidos = comprasHoy.reduce((sum, c) => sum + (c.productos?.length || 0), 0);

        const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        const comprasMes = this.compras.filter(c => {
            const fechaCompra = c.fecha?.toDate ? c.fecha.toDate() : new Date(c.fecha);
            return fechaCompra >= primerDiaMes;
        });

        const totalMes = comprasMes.reduce((sum, c) => sum + (c.total || 0), 0);

        const proveedoresActivosMes = new Set(comprasMes.map(c => c.proveedor?.id)).size;

        const formatter = window.currencyFormatter;

        document.getElementById('stat-compras-hoy').textContent = 
            formatter ? formatter.format(totalHoy) : '$' + totalHoy.toFixed(2);
        document.getElementById('stat-compras-hoy-count').textContent = 
            `${comprasHoy.length} ${comprasHoy.length === 1 ? 'pedido' : 'pedidos'}`;

        document.getElementById('stat-productos-recibidos').textContent = productosRecibidos;
        document.getElementById('stat-proveedores-activos').textContent = proveedoresActivosMes;

        document.getElementById('stat-compras-mes').textContent = 
            formatter ? formatter.format(totalMes) : '$' + totalMes.toFixed(2);
        document.getElementById('stat-compras-mes-count').textContent = 
            `${comprasMes.length} ${comprasMes.length === 1 ? 'pedido' : 'pedidos'}`;
    }

    async renderHistorial() {
        const tbody = document.getElementById('historial-table-body');
        
        if (this.compras.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 40px; color: #6D6D80;">
                        No hay compras registradas
                    </td>
                </tr>
            `;
            return;
        }

        const formatter = window.currencyFormatter;

        tbody.innerHTML = this.compras.map(compra => {
            const fecha = compra.fecha?.toDate ? compra.fecha.toDate() : new Date(compra.fecha);
            const fechaStr = fecha.toLocaleDateString('es-ES');
            const horaStr = fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
            const estaAnulada = compra.anulada === true;

            return `
                <tr style="${estaAnulada ? 'opacity: 0.6; background: #FFF5F5;' : ''}">
                    <td>
                        <span class="folio-badge" style="${estaAnulada ? 'background: #FF3B30;' : ''}">${compra.folio}</span>
                        ${estaAnulada ? '<br><small style="color: #FF3B30; font-weight: 600;">❌ ANULADA</small>' : ''}
                    </td>
                    <td>${fechaStr}<br><small>${horaStr}</small></td>
                    <td>${compra.proveedor?.nombre || 'Sin proveedor'}</td>
                    <td>${compra.productos?.length || 0}</td>
                    <td><strong style="${estaAnulada ? 'color: #FF3B30; text-decoration: line-through;' : ''}">${formatter ? formatter.format(compra.total) : '$' + compra.total.toFixed(2)}</strong></td>
                    <td>${this.formatMetodoPago(compra.metodoPago)}</td>
                    <td>${compra.recibidoPor || '-'}</td>
                    <td>
                        <div class="historial-acciones-wrapper">
                            <button class="btn-accion btn-editar" onclick="comprasModule.toggleAccionesHistorial('${compra.id}', this)" title="Acciones">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="5" r="1"></circle>
                                    <circle cx="12" cy="12" r="1"></circle>
                                    <circle cx="12" cy="19" r="1"></circle>
                                </svg>
                            </button>
                            <div class="historial-acciones-dropdown" id="acciones-${compra.id}" style="display:none;">
                                <button class="historial-accion-item" onclick="comprasModule.cerrarAccionesHistorial(); comprasModule.verDetalleCompra('${compra.id}')">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;">
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                        <circle cx="12" cy="12" r="3"></circle>
                                    </svg>
                                    Ver detalle
                                </button>
                                ${!estaAnulada ? `
                                <button class="historial-accion-item historial-accion-danger" onclick="comprasModule.cerrarAccionesHistorial(); comprasModule.abrirModalAnularCompra('${compra.id}')">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;">
                                        <polyline points="3 6 5 6 21 6"></polyline>
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                    </svg>
                                    Anular compra
                                </button>` : ''}
                            </div>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    formatMetodoPago(metodo) {
        const metodos = {
            'efectivo': 'Efectivo',
            'tarjeta': 'Tarjeta',
            'transferencia': 'Transferencia',
            'credito': 'Crédito'
        };
        return metodos[metodo] || metodo;
    }

    toggleAccionesHistorial(compraId, btn) {
        const dropdown = document.getElementById(`acciones-${compraId}`);
        if (!dropdown) return;
        const isVisible = dropdown.style.display !== 'none';
        this.cerrarAccionesHistorial();
        if (!isVisible) {
            dropdown.style.display = 'block';
            // Cerrar al hacer click fuera
            setTimeout(() => {
                const handler = (e) => {
                    if (!e.target.closest('.historial-acciones-wrapper')) {
                        this.cerrarAccionesHistorial();
                        document.removeEventListener('click', handler);
                    }
                };
                document.addEventListener('click', handler);
            }, 0);
        }
    }

    cerrarAccionesHistorial() {
        document.querySelectorAll('.historial-acciones-dropdown').forEach(d => {
            d.style.display = 'none';
        });
    }

    verDetalleCompra(compraId) {
        const compra = this.compras.find(c => c.id === compraId);
        if (!compra) return;

        const modal = document.getElementById('modal-detalle-compra');
        const content = document.getElementById('detalle-compra-content');
        const formatter = window.currencyFormatter;

        const fecha = compra.fecha?.toDate ? compra.fecha.toDate() : new Date(compra.fecha);
        const estaAnulada = compra.anulada === true;

        content.innerHTML = `
            <div style="background: linear-gradient(135deg, ${estaAnulada ? '#FF3B30, #FF1744' : '#FF9500, #FF8C00'}); color: white; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                <h4 style="margin: 0 0 10px 0;">Folio: ${compra.folio} ${estaAnulada ? '❌ ANULADA' : ''}</h4>
                <p style="margin: 0; opacity: 0.9;">${fecha.toLocaleString('es-ES')}</p>
            </div>

            ${estaAnulada ? `
                <div style="background: #FFE5E5; border-left: 4px solid #FF3B30; padding: 12px; border-radius: 8px; margin-bottom: 20px;">
                    <strong style="color: #FF3B30;">⚠️ Compra Anulada</strong>
                    <p style="margin: 8px 0 0 0; color: #6D6D80;">
                        ${compra.motivoAnulacion || 'Sin motivo especificado'}<br>
                        <small>Anulada el ${compra.fechaAnulacion?.toDate ? compra.fechaAnulacion.toDate().toLocaleString('es-ES') : 'Fecha no disponible'}</small>
                    </p>
                </div>
            ` : ''}

            <div style="margin-bottom: 20px;">
                <h4>Proveedor</h4>
                <p><strong>${compra.proveedor?.nombre || 'Sin proveedor'}</strong></p>
            </div>

            <div style="margin-bottom: 20px;">
                <h4>Productos</h4>
                ${compra.productos.map(p => `
                    <div style="background: #F8F9FA; padding: 12px; border-radius: 8px; margin-bottom: 8px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                            <strong>${p.nombre}</strong>
                            <span>${formatter ? formatter.format(p.subtotal) : '$' + p.subtotal.toFixed(2)}</span>
                        </div>
                        <div style="font-size: 0.9rem; color: #6D6D80;">
                            Cantidad: ${p.cantidad} × ${formatter ? formatter.format(p.precioUnitario) : '$' + p.precioUnitario.toFixed(2)}
                        </div>
                    </div>
                `).join('')}
            </div>

            <div style="background: #F8F9FA; padding: 16px; border-radius: 12px; margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>Método de Pago:</span>
                    <strong>${this.formatMetodoPago(compra.metodoPago)}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; padding-top: 8px; border-top: 2px solid #E5E5E7;">
                    <strong>TOTAL:</strong>
                    <strong style="font-size: 1.2rem; color: ${estaAnulada ? '#FF3B30' : '#FF9500'};">${formatter ? formatter.format(compra.total) : '$' + compra.total.toFixed(2)}</strong>
                </div>
            </div>

            ${compra.notas ? `
                <div style="margin-top: 20px;">
                    <h4>Notas</h4>
                    <p style="background: #F8F9FA; padding: 12px; border-radius: 8px;">${compra.notas}</p>
                </div>
            ` : ''}

            <div style="margin-top: 20px; font-size: 0.85rem; color: #6D6D80;">
                <p>Recibido por: ${compra.recibidoPor || 'Sistema'}</p>
            </div>

            ${!estaAnulada ? `
                <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #E5E5E7;">
                    <button onclick="comprasModule.abrirModalAnularCompra('${compraId}')" 
                            style="background: #FF3B30; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; width: 100%; font-weight: 600;">
                        🗑️ Anular Compra
                    </button>
                    <small style="display: block; margin-top: 8px; color: #6D6D80; text-align: center;">
                        Esta acción revertirá el inventario y no se podrá deshacer
                    </small>
                </div>
            ` : ''}
        `;

        if (modal) {
            if (modal.parentElement !== document.body) document.body.appendChild(modal);
            modal.style.cssText = '';
            modal.classList.add('active');
        }
    }

    abrirModalAnularCompra(compraId) {
        this.compraParaAnular = compraId;
        // Cerrar modal de detalle si estaba abierto
        const detalle = document.getElementById('modal-detalle-compra');
        if (detalle) detalle.classList.remove('active');

        const modal = document.getElementById('modal-anular-compra');
        if (modal) {
            if (modal.parentElement !== document.body) document.body.appendChild(modal);
            modal.style.cssText = '';
            modal.classList.add('active');
            const motivoInput = document.getElementById('motivo-anulacion');
            if (motivoInput) motivoInput.value = '';
        }
    }

    cerrarModalAnularCompra() {
        const modal = document.getElementById('modal-anular-compra');
        if (modal) {
            modal.classList.remove('active');
            const permanentContainer = document.getElementById('permanent-modals-container');
            if (permanentContainer && modal.parentElement !== permanentContainer) {
                permanentContainer.appendChild(modal);
            }
        }
        this.compraParaAnular = null;
    }

    async anularCompra() {
        if (!this.compraParaAnular) return;

        const motivo = document.getElementById('motivo-anulacion')?.value.trim() || '';
        if (!motivo) {
            this.showNotification('⚠️ Debes ingresar un motivo para anular la compra', 'warning');
            return;
        }

        if (!confirm('¿Estás seguro de anular esta compra?\n\n⚠️ ADVERTENCIA:\n- Se revertirá el inventario\n- Esta acción NO se puede deshacer\n- Quedará registrada para auditoría')) {
            return;
        }

        this.showLoading();

        try {
            const compra = this.compras.find(c => c.id === this.compraParaAnular);
            if (!compra) {
                this.showNotification('❌ Compra no encontrada', 'error');
                return;
            }

            const batch = window.db.batch();

            // 1. REVERTIR INVENTARIO
            for (const item of compra.productos) {
                const productoRef = window.db.collection('products').doc(item.productoId);
                const productoDoc = await productoRef.get();
                
                if (!productoDoc.exists) {
                    console.warn('⚠️ Producto no encontrado, saltando:', item.productoId);
                    continue;
                }

                const producto = productoDoc.data();
                const cantidad = item.cantidad;
                const updateData = {};

                if (item.tipo === 'simple') {
                    const stockActual = producto.stock?.actual || 0;
                    const nuevoStock = stockActual - cantidad;
                    updateData['stock.actual'] = Math.max(0, nuevoStock); // No permitir stock negativo
                    batch.update(productoRef, updateData);

                } else if (item.tipo === 'variante-simple') {
                    const variantesArray = Array.isArray(producto.variantes) 
                        ? producto.variantes 
                        : Object.values(producto.variantes || {});
                    const variante = variantesArray[item.varianteIndex];
                    const stockActual = variante?.stock?.actual || 0;
                    const nuevoStock = stockActual - cantidad;
                    updateData[`variantes.${item.varianteIndex}.stock.actual`] = Math.max(0, nuevoStock);
                    batch.update(productoRef, updateData);

                } else if (item.tipo === 'variante-opcion') {
                    const variantesArray = Array.isArray(producto.variantes) 
                        ? producto.variantes 
                        : Object.values(producto.variantes || {});
                    const variante = variantesArray[item.varianteIndex];
                    const opcionesArray = Array.isArray(variante?.opciones) 
                        ? variante.opciones 
                        : Object.values(variante?.opciones || {});
                    const opcion = opcionesArray[item.opcionIndex];
                    const stockActual = opcion?.stock?.actual || 0;
                    const nuevoStock = stockActual - cantidad;
                    updateData[`variantes.${item.varianteIndex}.opciones.${item.opcionIndex}.stock.actual`] = Math.max(0, nuevoStock);
                    batch.update(productoRef, updateData);

                } else if (item.tipo === 'conversion') {
                    const conversionesArray = Array.isArray(producto.conversiones) 
                        ? producto.conversiones 
                        : Object.values(producto.conversiones || {});
                    const conversion = conversionesArray[item.conversionIndex];
                    const cantidadUnidadBase = cantidad * conversion.cantidad;
                    const stockActual = producto.stock?.actual || 0;
                    const nuevoStock = stockActual - cantidadUnidadBase;
                    updateData['stock.actual'] = Math.max(0, nuevoStock);
                    batch.update(productoRef, updateData);
                }
            }

            // 2. MARCAR COMPRA COMO ANULADA
            const compraRef = window.db.collection('purchases').doc(this.compraParaAnular);
            batch.update(compraRef, {
                anulada: true,
                motivoAnulacion: motivo,
                fechaAnulacion: firebase.firestore.Timestamp.fromDate(new Date()),
                anuladaPor: window.authSystem?.currentUser?.uid || 'system',
                anuladaPorNombre: window.authSystem?.currentUser?.nombre || 'Sistema'
            });

            await batch.commit();

            this.showNotification('✅ Compra anulada exitosamente. El inventario ha sido revertido.', 'success');
            
            await this.cargarCompras();
            this.renderHistorial();
            this.actualizarEstadisticas();
            this.cerrarModalAnularCompra();

        } catch (error) {
            console.error('❌ Error anulando compra:', error);
            this.showNotification('❌ Error al anular la compra: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    filtrarHistorial(searchTerm) {
        // Implementar filtrado
    }

    aplicarFiltrosHistorial() {
        // Implementar filtros
    }

    showLoading() {
        document.getElementById('loading-overlay-compras').classList.add('active');
    }

    hideLoading() {
        document.getElementById('loading-overlay-compras').classList.remove('active');
    }

    showNotification(message, type = 'info') {
        console.log(message);
        // Usar sistema de notificaciones global si existe
        if (window.showNotification) {
            window.showNotification(message, type);
        } else {
            alert(message);
        }
    }
}

// Cargar el módulo
function loadComprasModule() {
    window.comprasModule = new ComprasModule();
}

window.loadComprasModule = loadComprasModule;
