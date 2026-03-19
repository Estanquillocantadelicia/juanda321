// Módulo de Inventario - Lógica profesional
class InventarioModule {
    constructor() {
        this.productos = [];
        this.categorias = [];
        this.proveedores = [];
        this.editingProducto = null;
        this.currentStep = 1;
        this.currentTipoProducto = 'simple';
        this.varianteCounter = 0;
        this.conversionCounter = 0;
        this.moduleId = 'inventario';
        this.isProcessing = false; // Bloqueo de transacciones

        this.preciosEspeciales = [];
        this.clientesPreciosSeleccionado = null;
        this.productoEditandoPrecio = null;

        this._listenerAbortController = null;

        this.init();
    }

    async init() {
        console.log('📦 Iniciando módulo de inventario...');
        this.showLoading();

        try {
            // 1. Verificar que Firebase esté disponible
            if (!window.db) {
                throw new Error('Firebase no está inicializado');
            }

            // 2. Crear modales Y cargar datos EN PARALELO (sin espera innecesaria)
            const [, dataLoaded] = await Promise.all([
                this.ensureModalsExist(),
                Promise.all([
                    this.loadCategorias(),
                    this.loadProveedores(),
                    this.loadProductos()
                ])
            ]);
            console.log('✅ Modales verificados y datos cargados:', {
                productos: this.productos.length,
                categorias: this.categorias.length,
                proveedores: this.proveedores.length
            });

            // 3. Configurar tabs Y renderizar UI EN PARALELO (sin delays artificiales)
            this.setupTabsSystem();
            this.populateCategorias();
            this.populateProveedores();
            this.renderProductos();
            this.renderDashboardStats();
            this.aplicarPermisosGraduales();
            console.log('✅ UI renderizada');

            // 4. Configurar listeners (requestAnimationFrame para no bloquear)
            requestAnimationFrame(() => {
                this.setupEventListeners();
                this.setupSimulacionPedidos();
                console.log('✅ Event listeners configurados');
            });
            
            // 5. Activar listeners en tiempo real (asincrónico, no bloquea)
            this.setupRealtimeListeners();
            
            console.log('✅ Módulo de inventario inicializado correctamente');
        } catch (error) {
            console.error('❌ Error en inicialización:', error);
            this.showNotification('Error al cargar el módulo: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async ensureModalsExist() {
        // Verificar si los modales ya existen en el contenedor permanente
        if (document.getElementById('modal-producto')) {
            console.log('✅ Modales de inventario ya existen en el DOM permanente');
            return;
        }

        console.log('📦 Creando modales de inventario en el contenedor permanente...');
        
        // Obtener el contenedor permanente
        let permanentContainer = document.getElementById('permanent-modals-container');
        if (!permanentContainer) {
            console.log('⚠️ Contenedor permanente no existe, creándolo...');
            permanentContainer = document.createElement('div');
            permanentContainer.id = 'permanent-modals-container';
            permanentContainer.style.position = 'fixed';
            permanentContainer.style.top = '0';
            permanentContainer.style.left = '0';
            permanentContainer.style.width = '100%';
            permanentContainer.style.height = '100%';
            permanentContainer.style.pointerEvents = 'none';
            permanentContainer.style.zIndex = '99998';
            document.body.appendChild(permanentContainer);
        }

        // Cargar el HTML de los modales
        try {
            const response = await fetch('./modules/inventario/inventario-modals.html');
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
            
            console.log('✅ Modales de inventario creados en contenedor permanente');
            
        } catch (error) {
            console.error('❌ Error cargando modales:', error);
            console.error('URL intentada:', './modules/inventario/inventario-modals.html');
        }
    }

    setupTabsSystem() {
        const tabs = document.querySelectorAll('.inventario-tab');
        const indicator = document.querySelector('.tab-indicator');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetTab = tab.dataset.tab;
                this.switchTab(targetTab, tab);
            });
        });

        const activeTab = document.querySelector('.inventario-tab.active');
        if (activeTab && indicator) {
            this.updateTabIndicator(activeTab, indicator);
        }

        window.addEventListener('resize', () => {
            const currentActiveTab = document.querySelector('.inventario-tab.active');
            if (currentActiveTab && indicator) {
                this.updateTabIndicator(currentActiveTab, indicator, false);
            }
        });
    }

    aplicarPermisosGraduales() {
        const tienePermisoSimulacion = window.authSystem?.hasSubPermission('inventario', 'simulacion') ?? true;
        const tienePermisoPreciosClientes = window.authSystem?.hasSubPermission('inventario', 'preciosClientes') ?? true;
        const tienePermisoNuevoProducto = window.authSystem?.hasSubPermission('inventario', 'nuevoProducto') ?? true;
        const tienePermisoCategorias = window.authSystem?.hasSubPermission('inventario', 'categorias') ?? true;

        const tabSimulacion = document.querySelector('.inventario-tab[data-tab="simulacion"]');
        if (tabSimulacion) {
            if (!tienePermisoSimulacion) {
                tabSimulacion.classList.add('disabled');
                tabSimulacion.style.opacity = '0.4';
                tabSimulacion.style.cursor = 'not-allowed';
                tabSimulacion.title = 'No tienes permiso para acceder a simulación de pedidos';
            } else {
                tabSimulacion.classList.remove('disabled');
                tabSimulacion.style.opacity = '';
                tabSimulacion.style.cursor = '';
                tabSimulacion.title = '';
            }
        }

        const tabPreciosClientes = document.querySelector('.inventario-tab[data-tab="precios-clientes"]');
        if (tabPreciosClientes) {
            if (!tienePermisoPreciosClientes) {
                tabPreciosClientes.classList.add('disabled');
                tabPreciosClientes.style.opacity = '0.4';
                tabPreciosClientes.style.cursor = 'not-allowed';
                tabPreciosClientes.title = 'No tienes permiso para ver precios especiales de clientes';
            } else {
                tabPreciosClientes.classList.remove('disabled');
                tabPreciosClientes.style.opacity = '';
                tabPreciosClientes.style.cursor = '';
                tabPreciosClientes.title = '';
            }
        }

        const btnNuevoProducto = document.getElementById('btn-nuevo-producto');
        if (btnNuevoProducto) {
            if (!tienePermisoNuevoProducto) {
                btnNuevoProducto.classList.add('disabled');
                btnNuevoProducto.style.opacity = '0.4';
                btnNuevoProducto.style.cursor = 'not-allowed';
                btnNuevoProducto.title = 'No tienes permiso para crear productos';
                btnNuevoProducto.disabled = true;
            } else {
                btnNuevoProducto.classList.remove('disabled');
                btnNuevoProducto.style.opacity = '';
                btnNuevoProducto.style.cursor = '';
                btnNuevoProducto.title = '';
                btnNuevoProducto.disabled = false;
            }
        }

        const btnCategorias = document.getElementById('btn-gestionar-categorias');
        if (btnCategorias) {
            if (!tienePermisoCategorias) {
                btnCategorias.classList.add('disabled');
                btnCategorias.style.opacity = '0.4';
                btnCategorias.style.cursor = 'not-allowed';
                btnCategorias.title = 'No tienes permiso para gestionar categorías';
                btnCategorias.disabled = true;
            } else {
                btnCategorias.classList.remove('disabled');
                btnCategorias.style.opacity = '';
                btnCategorias.style.cursor = '';
                btnCategorias.title = '';
                btnCategorias.disabled = false;
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

    switchTab(tabName, tabElement = null) {
        if (tabName === 'simulacion') {
            const tienePermiso = window.authSystem?.hasSubPermission('inventario', 'simulacion') ?? true;
            if (!tienePermiso) {
                this.showNotification('No tienes permiso para acceder a simulación de pedidos', 'error');
                return;
            }
        }

        if (tabName === 'precios-clientes') {
            const tienePermiso = window.authSystem?.hasSubPermission('inventario', 'preciosClientes') ?? true;
            if (!tienePermiso) {
                this.showNotification('No tienes permiso para ver precios especiales de clientes', 'error');
                return;
            }
        }

        document.querySelectorAll('.inventario-tab').forEach(tab => {
            tab.classList.remove('active');
        });

        const targetTabElement = tabElement || document.querySelector(`[data-tab="${tabName}"]`);
        if (targetTabElement) {
            targetTabElement.classList.add('active');

            const indicator = document.querySelector('.tab-indicator');
            if (indicator) {
                this.updateTabIndicator(targetTabElement, indicator, true);
            }
        }

        document.querySelectorAll('.inventario-tab-content').forEach(content => {
            content.classList.remove('active');
        });

        const targetContent = document.getElementById(`tab-${tabName}`);
        if (targetContent) {
            setTimeout(() => {
                targetContent.classList.add('active');
            }, 150);
        }

        if (tabName === 'simulacion') {
            this.renderProveedoresSimulacion();
        }

        if (tabName === 'precios-clientes') {
            this.setupPreciosClientesTab();
        }
    }

    renderTablaSimulacion(productos) {
        const emptyState = document.getElementById('simulacion-empty-state');
        const table = document.getElementById('simulacion-table');
        const tbody = document.getElementById('simulacion-table-body');
        const footer = document.getElementById('simulacion-table-footer');

        if (emptyState) emptyState.classList.add('hidden');
        if (table) table.classList.remove('hidden');
        if (footer) footer.classList.remove('hidden');

        let rows = [];

        productos.forEach(producto => {
            if (producto.tipo === 'simple') {
                // PRODUCTO SIMPLE
                const stockActual = producto.stock?.actual || 0;
                const precioCosto = producto.precio?.costo || 0;
                const stockClass = stockActual <= (producto.stock?.minimo || 5) ? 'stock-bajo' : 'stock-normal';

                rows.push(`
                    <tr data-producto-id="${producto.id}">
                        <td><div class="producto-nombre">📦 ${producto.nombre}</div></td>
                        <td><span class="producto-tipo tipo-simple">Simple</span></td>
                        <td><span class="stock-value ${stockClass}">${stockActual}</span></td>
                        <td><span class="precio-costo">${window.currencyFormatter ? window.currencyFormatter.format(precioCosto) : '$' + precioCosto.toFixed(2)}</span></td>
                        <td>
                            <input type="number" class="cantidad-input" min="0" step="1" value="0"
                                data-producto-id="${producto.id}" data-precio="${precioCosto}"
                                onchange="inventarioModule.actualizarCantidadSimulacion('${producto.id}', this.value, ${precioCosto})" />
                        </td>
                        <td><span class="subtotal-value" id="sim-subtotal-${producto.id}">$0.00</span></td>
                    </tr>
                `);

            } else if (producto.tipo === 'variantes') {
                // PRODUCTO CON VARIANTES
                const variantesArray = Array.isArray(producto.variantes) 
                    ? producto.variantes 
                    : Object.values(producto.variantes || {});

                variantesArray.forEach((variante, vIdx) => {
                    const precioCosto = variante.precio?.costo || 0;

                    if (variante.opciones) {
                        // VARIANTE CON OPCIONES - Mostrar cada opción
                        const opcionesArray = Array.isArray(variante.opciones) 
                            ? variante.opciones 
                            : Object.values(variante.opciones || {});

                        opcionesArray.forEach((opcion, oIdx) => {
                            const stockActual = opcion.stock?.actual || 0;
                            const stockClass = stockActual <= (variante.stock?.minimo || 5) ? 'stock-bajo' : 'stock-normal';
                            const itemId = `${producto.id}-v${vIdx}-o${oIdx}`;

                            rows.push(`
                                <tr data-producto-id="${itemId}" class="fila-opcion">
                                    <td>
                                        <div class="producto-nombre-jerarquia">
                                            <span class="icono-jerarquia">└─</span>
                                            <span class="nombre-principal">${producto.nombre}</span>
                                            <span class="badge-variante">${variante.nombre}</span>
                                            <span class="badge-opcion">${opcion.nombre}</span>
                                        </div>
                                    </td>
                                    <td><span class="producto-tipo tipo-variante-opcion">Opción</span></td>
                                    <td><span class="stock-value ${stockClass}">${stockActual}</span></td>
                                    <td><span class="precio-costo">${window.currencyFormatter ? window.currencyFormatter.format(precioCosto) : '$' + precioCosto.toFixed(2)}</span></td>
                                    <td>
                                        <input type="number" class="cantidad-input" min="0" step="1" value="0"
                                            data-producto-id="${itemId}" 
                                            data-producto-base-id="${producto.id}"
                                            data-variante-idx="${vIdx}"
                                            data-opcion-idx="${oIdx}"
                                            data-precio="${precioCosto}"
                                            onchange="inventarioModule.actualizarCantidadSimulacion('${itemId}', this.value, ${precioCosto})" />
                                    </td>
                                    <td><span class="subtotal-value" id="sim-subtotal-${itemId}">$0.00</span></td>
                                </tr>
                            `);
                        });

                    } else {
                        // VARIANTE SIN OPCIONES
                        const stockActual = variante.stock?.actual || 0;
                        const stockClass = stockActual <= (variante.stock?.minimo || 5) ? 'stock-bajo' : 'stock-normal';
                        const itemId = `${producto.id}-v${vIdx}`;

                        rows.push(`
                            <tr data-producto-id="${itemId}" class="fila-variante">
                                <td>
                                    <div class="producto-nombre-jerarquia">
                                        <span class="icono-jerarquia">└─</span>
                                        <span class="nombre-principal">${producto.nombre}</span>
                                        <span class="badge-variante">${variante.nombre}</span>
                                    </div>
                                </td>
                                <td><span class="producto-tipo tipo-variante">Variante</span></td>
                                <td><span class="stock-value ${stockClass}">${stockActual}</span></td>
                                <td><span class="precio-costo">${window.currencyFormatter ? window.currencyFormatter.format(precioCosto) : '$' + precioCosto.toFixed(2)}</span></td>
                                <td>
                                    <input type="number" class="cantidad-input" min="0" step="1" value="0"
                                        data-producto-id="${itemId}"
                                        data-producto-base-id="${producto.id}"
                                        data-variante-idx="${vIdx}"
                                        data-precio="${precioCosto}"
                                        onchange="inventarioModule.actualizarCantidadSimulacion('${itemId}', this.value, ${precioCosto})" />
                                </td>
                                <td><span class="subtotal-value" id="sim-subtotal-${itemId}">$0.00</span></td>
                            </tr>
                        `);
                    }
                });

            } else if (producto.tipo === 'conversion') {
                // PRODUCTO CON CONVERSIÓN - Solo mostrar UNIDAD BASE (lo que se compra al proveedor)
                const stockActual = producto.stock?.actual || 0;
                const stockClass = stockActual <= (producto.stock?.minimo || 5) ? 'stock-bajo' : 'stock-normal';

                // Usar el precio de costo de la primera conversión como referencia
                const conversionesArray = Array.isArray(producto.conversiones) 
                    ? producto.conversiones 
                    : Object.values(producto.conversiones || {});
                const precioCostoUnidad = conversionesArray.length > 0 
                    ? (conversionesArray[0].precio?.costo || 0) / conversionesArray[0].cantidad 
                    : 0;

                rows.push(`
                    <tr data-producto-id="${producto.id}">
                        <td>
                            <div class="producto-nombre">
                                📦 ${producto.nombre}
                                <span class="badge-conversion" style="margin-left: 8px;">${producto.unidadBase}</span>
                            </div>
                        </td>
                        <td><span class="producto-tipo tipo-conversion">Conversión</span></td>
                        <td><span class="stock-value ${stockClass}">${stockActual}</span></td>
                        <td><span class="precio-costo">${window.currencyFormatter ? window.currencyFormatter.format(precioCostoUnidad) : '$' + precioCostoUnidad.toFixed(2)}</span></td>
                        <td>
                            <input type="number" class="cantidad-input" min="0" step="1" value="0"
                                data-producto-id="${producto.id}" data-precio="${precioCostoUnidad}"
                                onchange="inventarioModule.actualizarCantidadSimulacion('${producto.id}', this.value, ${precioCostoUnidad})" />
                        </td>
                        <td><span class="subtotal-value" id="sim-subtotal-${producto.id}">$0.00</span></td>
                    </tr>
                `);
            }
        });

        if (tbody) tbody.innerHTML = rows.join('');
    }

    actualizarCantidadSimulacion(itemId, cantidad, precio) {
        const cantidadNum = parseInt(cantidad) || 0;

        if (cantidadNum > 0) {
            this.pedidoSimulacion.set(itemId, {
                cantidad: cantidadNum,
                precio: precio
            });
        } else {
            this.pedidoSimulacion.delete(itemId);
        }

        const subtotal = cantidadNum * precio;
        const subtotalElement = document.getElementById(`sim-subtotal-${itemId}`);
        if (subtotalElement) {
            subtotalElement.textContent = window.currencyFormatter ? 
                window.currencyFormatter.format(subtotal) : '$' + subtotal.toFixed(2);
        }

        this.actualizarTotalesSimulacion();
        this.actualizarResumenSimulacion();
    }

    actualizarTotalesSimulacion() {
        let totalPedido = 0;

        this.pedidoSimulacion.forEach((item, itemId) => {
            totalPedido += item.cantidad * item.precio;
        });

        const totalElement = document.getElementById('simulacion-total-pedido');
        if (totalElement) {
            totalElement.textContent = window.currencyFormatter ? 
                window.currencyFormatter.format(totalPedido) : '$' + totalPedido.toFixed(2);
        }
    }

    actualizarResumenSimulacion() {
        const resumen = document.getElementById('simulacion-resumen');
        const tituloResumen = document.getElementById('simulacion-resumen-titulo');
        const labelNombre = document.getElementById('simulacion-label-nombre');
        const proveedorNombre = document.getElementById('simulacion-proveedor-nombre');
        const cantidadProductos = document.getElementById('simulacion-cantidad-productos');
        const total = document.getElementById('simulacion-total');

        if (!this.proveedorSimulacionSeleccionado && !this.clienteSimulacionSeleccionado) {
            if (resumen) resumen.classList.add('hidden');
            return;
        }

        if (resumen) resumen.classList.remove('hidden');

        // Actualizar títulos según tipo
        if (this.tipoSimulacion === 'proveedor') {
            if (tituloResumen) tituloResumen.textContent = '📊 Resumen del Pedido';
            if (labelNombre) labelNombre.textContent = 'Proveedor:';
            if (proveedorNombre) proveedorNombre.textContent = this.proveedorSimulacionSeleccionado?.nombre || '-';
        } else {
            if (tituloResumen) tituloResumen.textContent = '🛒 Resumen de Productos';
            if (labelNombre) labelNombre.textContent = 'Cliente:';
            if (proveedorNombre) proveedorNombre.textContent = this.clienteSimulacionSeleccionado?.nombre || '-';
        }

        if (cantidadProductos) cantidadProductos.textContent = this.pedidoSimulacion.size;

        let totalPedido = 0;
        this.pedidoSimulacion.forEach((item, itemId) => {
            totalPedido += item.cantidad * item.precio;
        });

        if (total) {
            total.textContent = window.currencyFormatter ? 
                window.currencyFormatter.format(totalPedido) : '$' + totalPedido.toFixed(2);
        }
    }

    limpiarSimulacion() {
        this.proveedorSimulacionSeleccionado = null;
        this.clienteSimulacionSeleccionado = null;
        this.preciosClienteSimulacion = [];
        this.pedidoSimulacion.clear();

        const selectProveedor = document.getElementById('simulacion-select-proveedor');
        if (selectProveedor) selectProveedor.value = '';

        const selectCliente = document.getElementById('simulacion-select-cliente-pedido');
        if (selectCliente) selectCliente.value = '';

        this.mostrarEmptyStateSimulacion();

        const resumen = document.getElementById('simulacion-resumen');
        if (resumen) resumen.classList.add('hidden');

        this.deshabilitarBotonesSimulacion();
    }

    mostrarEmptyStateSimulacion() {
        const emptyState = document.getElementById('simulacion-empty-state');
        const table = document.getElementById('simulacion-table');
        const footer = document.getElementById('simulacion-table-footer');

        if (emptyState) emptyState.classList.remove('hidden');
        if (table) table.classList.add('hidden');
        if (footer) footer.classList.add('hidden');
    }

    habilitarBotonesSimulacion() {
        const btnLimpiar = document.getElementById('btn-limpiar-simulacion');
        const btnExportar = document.getElementById('btn-exportar-simulacion');
        if (btnLimpiar) btnLimpiar.disabled = false;
        if (btnExportar) btnExportar.disabled = false;
    }

    deshabilitarBotonesSimulacion() {
        const btnLimpiar = document.getElementById('btn-limpiar-simulacion');
        const btnExportar = document.getElementById('btn-exportar-simulacion');
        if (btnLimpiar) btnLimpiar.disabled = true;
        if (btnExportar) btnExportar.disabled = true;
    }

    exportarSimulacion() {
        if (this.pedidoSimulacion.size === 0) {
            this.showNotification('No hay productos en el pedido para exportar', 'warning');
            return;
        }

        let contenido = `╔═══════════════════════════════════════════════════════════╗\n`;
        contenido += `║           SIMULACIÓN DE PEDIDO A PROVEEDOR                ║\n`;
        contenido += `╚═══════════════════════════════════════════════════════════╝\n\n`;
        contenido += `Proveedor: ${this.proveedorSimulacionSeleccionado.nombre}\n`;
        contenido += `Fecha: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}\n\n`;
        contenido += `═══════════════════════════════════════════════════════════\n`;
        contenido += `PRODUCTOS SOLICITADOS:\n`;
        contenido += `═══════════════════════════════════════════════════════════\n\n`;

        let total = 0;
        let itemCount = 0;

        this.pedidoSimulacion.forEach((item, itemId) => {
            const input = document.querySelector(`input[data-producto-id="${itemId}"]`);
            const productoBaseId = input?.dataset.productoBaseId || itemId;
            const producto = this.productos.find(p => p.id === productoBaseId);

            if (producto) {
                itemCount++;
                const subtotal = item.cantidad * item.precio;
                total += subtotal;

                // Determinar tipo de producto y mostrar detalles
                if (itemId.includes('-v') && itemId.includes('-o')) {
                    // Variante con opción
                    const vIdx = parseInt(input.dataset.varianteIdx);
                    const oIdx = parseInt(input.dataset.opcionIdx);
                    const variantesArray = Array.isArray(producto.variantes) 
                        ? producto.variantes 
                        : Object.values(producto.variantes || {});
                    const variante = variantesArray[vIdx];
                    const opcionesArray = Array.isArray(variante?.opciones) 
                        ? variante.opciones 
                        : Object.values(variante?.opciones || {});
                    const opcion = opcionesArray[oIdx];

                    contenido += `${itemCount}. ${producto.nombre}\n`;
                    contenido += `   Variante: ${variante.nombre}\n`;
                    contenido += `   Opción: ${opcion.nombre}\n`;
                    if (opcion.codigoBarras) contenido += `   Código: ${opcion.codigoBarras}\n`;

                } else if (itemId.includes('-v')) {
                    // Variante sin opción
                    const vIdx = parseInt(input.dataset.varianteIdx);
                    const variantesArray = Array.isArray(producto.variantes) 
                        ? producto.variantes 
                        : Object.values(producto.variantes || {});
                    const variante = variantesArray[vIdx];

                    contenido += `${itemCount}. ${producto.nombre}\n`;
                    contenido += `   Variante: ${variante.nombre}\n`;
                    if (variante.codigoBarras) contenido += `   Código: ${variante.codigoBarras}\n`;

                } else if (itemId.includes('-c')) {
                    // Conversión
                    const cIdx = parseInt(input.dataset.conversionIdx);
                    const conversionesArray = Array.isArray(producto.conversiones) 
                        ? producto.conversiones 
                        : Object.values(producto.conversiones || {});
                    const conversion = conversionesArray[cIdx];

                    contenido += `${itemCount}. ${producto.nombre}\n`;
                    contenido += `   Unidad: ${conversion.tipo} (${conversion.cantidad} ${producto.unidadBase})\n`;

                } else {
                    // Simple
                    contenido += `${itemCount}. ${producto.nombre}\n`;
                    if (producto.codigo) contenido += `   Código: ${producto.codigo}\n`;
                }

                contenido += `   Cantidad: ${item.cantidad} unidades\n`;
                contenido += `   Precio unitario: ${window.currencyFormatter ? window.currencyFormatter.format(item.precio) : '$' + item.precio.toFixed(2)}\n`;
                contenido += `   Subtotal: ${window.currencyFormatter ? window.currencyFormatter.format(subtotal) : '$' + subtotal.toFixed(2)}\n\n`;
            }
        });

        contenido += `═══════════════════════════════════════════════════════════\n`;
        contenido += `RESUMEN DEL PEDIDO:\n`;
        contenido += `═══════════════════════════════════════════════════════════\n`;
        contenido += `Total de items diferentes: ${itemCount}\n`;
        contenido += `TOTAL A PAGAR: ${window.currencyFormatter ? window.currencyFormatter.format(total) : '$' + total.toFixed(2)}\n\n`;

        const blob = new Blob([contenido], { type: 'text/plain;charset=utf-8' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const nombreArchivo = `pedido_${this.proveedorSimulacionSeleccionado.nombre.replace(/\s+/g, '_')}_${Date.now()}.txt`;
        a.download = nombreArchivo;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        this.showNotification('Pedido exportado exitosamente como ' + nombreArchivo, 'success');
    }

    setupSimulacionPedidos() {
        this.pedidoSimulacion = new Map();
        this.proveedorSimulacionSeleccionado = null;
        this.clienteSimulacionSeleccionado = null;
        this.tipoSimulacion = 'proveedor'; // 'proveedor' o 'cliente'
        this.preciosClienteSimulacion = [];

        // Tabs de tipo de simulación
        document.querySelectorAll('.tipo-sim-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.cambiarTipoSimulacion(tab.dataset.tipo);
            });
        });

        const selectProveedor = document.getElementById('simulacion-select-proveedor');
        if (selectProveedor) {
            selectProveedor.addEventListener('change', (e) => {
                this.seleccionarProveedorSimulacion(e.target.value);
            });
        }

        const selectCliente = document.getElementById('simulacion-select-cliente-pedido');
        if (selectCliente) {
            selectCliente.addEventListener('change', (e) => {
                this.seleccionarClienteSimulacion(e.target.value);
            });
        }

        const btnLimpiar = document.getElementById('btn-limpiar-simulacion');
        if (btnLimpiar) {
            btnLimpiar.addEventListener('click', () => this.limpiarSimulacion());
        }

        const btnExportar = document.getElementById('btn-exportar-simulacion');
        if (btnExportar) {
            btnExportar.addEventListener('click', () => this.exportarSimulacion());
        }

        // Cargar clientes al inicio
        this.cargarClientesSimulacion();
    }

    cambiarTipoSimulacion(tipo) {
        this.tipoSimulacion = tipo;
        this.limpiarSimulacion();

        // Actualizar tabs activos
        document.querySelectorAll('.tipo-sim-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tipo === tipo);
        });

        // Mostrar/ocultar selectores
        const selectorProveedor = document.getElementById('selector-proveedor-container');
        const selectorCliente = document.getElementById('selector-cliente-container');
        const emptyText = document.getElementById('simulacion-empty-text');
        const precioHeader = document.getElementById('simulacion-precio-header');

        console.log('🔄 Cambiando tipo de simulación a:', tipo);

        if (tipo === 'proveedor') {
            // Mostrar solo selector de proveedor
            if (selectorProveedor) {
                selectorProveedor.classList.remove('hidden');
                console.log('✅ Selector de proveedor VISIBLE');
            }
            if (selectorCliente) {
                selectorCliente.classList.add('hidden');
                console.log('❌ Selector de cliente OCULTO');
            }
            if (emptyText) emptyText.textContent = 'Selecciona un proveedor para simular un pedido';
            if (precioHeader) precioHeader.textContent = 'Precio Costo';
        } else {
            // Mostrar solo selector de cliente
            if (selectorProveedor) {
                selectorProveedor.classList.add('hidden');
                console.log('❌ Selector de proveedor OCULTO');
            }
            if (selectorCliente) {
                selectorCliente.classList.remove('hidden');
                console.log('✅ Selector de cliente VISIBLE');
            }
            if (emptyText) emptyText.textContent = 'Selecciona un cliente para ver sus productos con precios personalizados';
            if (precioHeader) precioHeader.textContent = 'Precio Especial';
        }
    }

    async cargarClientesSimulacion() {
        try {
            const snapshot = await window.db.collection('clients').get();
            const clientes = [];
            snapshot.forEach(doc => {
                clientes.push({ id: doc.id, ...doc.data() });
            });

            const select = document.getElementById('simulacion-select-cliente-pedido');
            if (select) {
                select.innerHTML = '<option value="">-- Seleccione un cliente --</option>';
                clientes.forEach(cliente => {
                    const option = document.createElement('option');
                    option.value = cliente.id;
                    option.textContent = cliente.nombre;
                    select.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error cargando clientes:', error);
        }
    }

    async seleccionarClienteSimulacion(clienteId) {
        if (!clienteId) {
            this.limpiarSimulacion();
            return;
        }

        this.showLoading();

        try {
            // Cargar cliente
            const clienteDoc = await window.db.collection('clients').doc(clienteId).get();
            if (!clienteDoc.exists) {
                this.showNotification('Cliente no encontrado', 'error');
                this.hideLoading();
                return;
            }

            this.clienteSimulacionSeleccionado = { id: clienteDoc.id, ...clienteDoc.data() };

            // Cargar precios especiales del cliente
            const preciosSnapshot = await window.db.collection('customPrices')
                .where('clienteId', '==', clienteId)
                .where('activo', '==', true)
                .get();

            this.preciosClienteSimulacion = [];
            preciosSnapshot.forEach(doc => {
                this.preciosClienteSimulacion.push({ id: doc.id, ...doc.data() });
            });

            if (this.preciosClienteSimulacion.length === 0) {
                this.showNotification('Este cliente no tiene productos con precios personalizados', 'warning');
                this.mostrarEmptyStateSimulacion();
                this.hideLoading();
                return;
            }

            // Renderizar productos con precios personalizados
            this.pedidoSimulacion.clear();
            this.renderTablaSimulacionCliente();
            this.actualizarResumenSimulacion();
            this.habilitarBotonesSimulacion();

        } catch (error) {
            console.error('Error:', error);
            this.showNotification('Error al cargar productos del cliente', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async renderTablaSimulacionCliente() {
        const emptyState = document.getElementById('simulacion-empty-state');
        const table = document.getElementById('simulacion-table');
        const tbody = document.getElementById('simulacion-table-body');
        const footer = document.getElementById('simulacion-table-footer');

        if (emptyState) emptyState.classList.add('hidden');
        if (table) table.classList.remove('hidden');
        if (footer) footer.classList.remove('hidden');

        let rows = [];

        console.log('📋 Renderizando productos con precios especiales:', this.preciosClienteSimulacion.length);

        // Agrupar precios por producto
        for (const precio of this.preciosClienteSimulacion) {
            const producto = this.productos.find(p => p.id === precio.productoId);
            if (!producto) {
                console.warn('⚠️ Producto no encontrado:', precio.productoId);
                continue;
            }

            const stockActual = this.obtenerStockPorPrecio(producto, precio);
            const stockClass = stockActual <= 5 ? 'stock-bajo' : 'stock-normal';
            const precioEspecial = precio.precioEspecial || 0;

            // Generar itemId según tipo de precio
            let itemId = producto.id;
            let nombreCompleto = producto.nombre;
            let tipoLabel = this.getTipoLabel(producto.tipo);

            if (precio.tipoProducto === 'variante-simple' && precio.varianteIndex !== undefined) {
                const variantesArray = Array.isArray(producto.variantes) ? producto.variantes : Object.values(producto.variantes || {});
                const variante = variantesArray[precio.varianteIndex];
                itemId = `${producto.id}-v${precio.varianteIndex}`;
                nombreCompleto = `${producto.nombre} - ${variante?.nombre || 'Variante'}`;
            } else if (precio.tipoProducto === 'variante-opcion' && precio.varianteIndex !== undefined && precio.opcionIndex !== undefined) {
                const variantesArray = Array.isArray(producto.variantes) ? producto.variantes : Object.values(producto.variantes || {});
                const variante = variantesArray[precio.varianteIndex];
                const opcionesArray = Array.isArray(variante?.opciones) ? variante.opciones : Object.values(variante?.opciones || {});
                const opcion = opcionesArray[precio.opcionIndex];
                itemId = `${producto.id}-v${precio.varianteIndex}-o${precio.opcionIndex}`;
                nombreCompleto = `${producto.nombre} - ${variante?.nombre || 'Variante'} - ${opcion?.nombre || 'Opción'}`;
            } else if (precio.tipoProducto === 'conversion' && precio.conversionIndex !== undefined) {
                const conversionesArray = Array.isArray(producto.conversiones) ? producto.conversiones : Object.values(producto.conversiones || {});
                const conversion = conversionesArray[precio.conversionIndex];
                itemId = `${producto.id}-c${precio.conversionIndex}`;
                nombreCompleto = `${producto.nombre} - ${conversion?.tipo || 'Conversión'}`;
            }

            rows.push(`
                <tr data-producto-id="${itemId}">
                    <td>
                        <div class="producto-nombre">📦 ${nombreCompleto}</div>
                    </td>
                    <td><span class="producto-tipo tipo-simple">${tipoLabel}</span></td>
                    <td><span class="stock-value ${stockClass}">${stockActual}</span></td>
                    <td><span class="precio-costo" style="color: #34C759; font-weight: 600;">${window.currencyFormatter ? window.currencyFormatter.format(precioEspecial) : '$' + precioEspecial.toFixed(2)}</span></td>
                    <td>
                        <input type="number" class="cantidad-input" min="0" step="1" value="0"
                            data-producto-id="${itemId}" data-precio="${precioEspecial}"
                            onchange="inventarioModule.actualizarCantidadSimulacion('${itemId}', this.value, ${precioEspecial})" />
                    </td>
                    <td><span class="subtotal-value" id="sim-subtotal-${itemId}">$0.00</span></td>
                </tr>
            `);
        }

        console.log('✅ Filas generadas:', rows.length);
        if (tbody) tbody.innerHTML = rows.join('');
    }

    obtenerStockPorPrecio(producto, precio) {
        if (precio.tipoProducto === 'simple') {
            return producto.stock?.actual || 0;
        } else if (precio.tipoProducto === 'variante-simple' && precio.varianteIndex !== undefined) {
            const variantesArray = Array.isArray(producto.variantes) ? producto.variantes : Object.values(producto.variantes || {});
            const variante = variantesArray[precio.varianteIndex];
            return variante?.stock?.actual || 0;
        } else if (precio.tipoProducto === 'variante-opcion' && precio.varianteIndex !== undefined && precio.opcionIndex !== undefined) {
            const variantesArray = Array.isArray(producto.variantes) ? producto.variantes : Object.values(producto.variantes || {});
            const variante = variantesArray[precio.varianteIndex];
            const opcionesArray = Array.isArray(variante?.opciones) ? variante.opciones : Object.values(variante?.opciones || {});
            const opcion = opcionesArray[precio.opcionIndex];
            return opcion?.stock?.actual || 0;
        } else if (precio.tipoProducto === 'conversion' && precio.conversionIndex !== undefined) {
            return producto.stock?.actual || 0;
        }
        return 0;
    }

    getTipoLabel(tipo) {
        const labels = {
            'simple': 'Simple',
            'variantes': 'Variantes',
            'conversion': 'Conversión'
        };
        return labels[tipo] || tipo;
    }

    // ==================== SISTEMA DE PRECIOS ESPECIALES ====================

    async setupPreciosClientesTab() {
        // Estado de filtros
        this.filtrosPrecios = { texto: '', categoria: '', proveedor: '', soloAsignados: false };

        // Cargar clientes para el selector
        await this.loadClientesForPrecios();

        // Selector de cliente
        const selectCliente = document.getElementById('precios-select-cliente');
        if (selectCliente) {
            selectCliente.addEventListener('change', (e) => {
                this.seleccionarClientePrecios(e.target.value);
            });
        }

        // Búsqueda de texto
        const searchInput = document.getElementById('search-productos-precios');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filtrosPrecios.texto = e.target.value.trim().toLowerCase();
                this.aplicarFiltrosPrecios();
            });
        }

        // Filtro de categoría
        const filterCategoria = document.getElementById('precios-filter-categoria');
        if (filterCategoria) {
            filterCategoria.addEventListener('change', (e) => {
                this.filtrosPrecios.categoria = e.target.value;
                this.aplicarFiltrosPrecios();
            });
        }

        // Filtro de proveedor
        const filterProveedor = document.getElementById('precios-filter-proveedor');
        if (filterProveedor) {
            filterProveedor.addEventListener('change', (e) => {
                this.filtrosPrecios.proveedor = e.target.value;
                this.aplicarFiltrosPrecios();
            });
        }

        // Toggle solo asignados
        const btnSoloAsignados = document.getElementById('btn-solo-asignados');
        if (btnSoloAsignados) {
            btnSoloAsignados.addEventListener('click', () => {
                const activo = btnSoloAsignados.dataset.activo !== 'true';
                btnSoloAsignados.dataset.activo = String(activo);
                btnSoloAsignados.classList.toggle('activo', activo);
                this.filtrosPrecios.soloAsignados = activo;
                this.aplicarFiltrosPrecios();
            });
        }

        // Modal eventos
        const btnCancelar = document.getElementById('btn-cancelar-precio');
        const btnGuardar = document.getElementById('btn-guardar-precio');
        const modalClose = document.getElementById('modal-precio-close');
        const inputPrecio = document.getElementById('input-precio-especial');

        if (btnCancelar) btnCancelar.addEventListener('click', () => this.cerrarModalPrecio());
        if (modalClose) modalClose.addEventListener('click', () => this.cerrarModalPrecio());
        if (btnGuardar) btnGuardar.addEventListener('click', () => this.guardarPrecioEspecial());

        if (inputPrecio) {
            inputPrecio.addEventListener('input', (e) => {
                const precio = parseFloat(e.target.value) || 0;
                document.getElementById('comp-precio-especial').textContent = 
                    window.currencyFormatter?.format(precio) || '$' + precio.toFixed(2);
            });
        }
    }

    async loadClientesForPrecios() {
        try {
            const snapshot = await window.db.collection('clients').get();
            const clientes = [];
            snapshot.forEach(doc => {
                clientes.push({ id: doc.id, ...doc.data() });
            });

            const select = document.getElementById('precios-select-cliente');
            if (select) {
                select.innerHTML = '<option value="">-- Seleccione un cliente --</option>';
                clientes.forEach(cliente => {
                    const option = document.createElement('option');
                    option.value = cliente.id;
                    option.textContent = cliente.nombre;
                    select.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error cargando clientes:', error);
        }
    }

    async loadPreciosEspeciales(clienteId) {
        try {
            const snapshot = await window.db.collection('customPrices')
                .where('clienteId', '==', clienteId)
                .where('activo', '==', true)
                .get();

            this.preciosEspeciales = [];
            snapshot.forEach(doc => {
                this.preciosEspeciales.push({ id: doc.id, ...doc.data() });
            });

            console.log(`✅ ${this.preciosEspeciales.length} precios especiales cargados para cliente`);
        } catch (error) {
            console.error('Error cargando precios especiales:', error);
            this.preciosEspeciales = [];
        }
    }

    async seleccionarClientePrecios(clienteId) {
        if (!clienteId) {
            this.mostrarEmptyStatePrecios();
            return;
        }

        this.clientesPreciosSeleccionado = clienteId;
        this.showLoading();

        try {
            await this.loadPreciosEspeciales(clienteId);

            const cliente = await window.db.collection('clients').doc(clienteId).get();
            if (cliente.exists) {
                document.getElementById('precios-cliente-nombre').textContent = cliente.data().nombre;
            }

            this.renderTablaPreciosClientes();
            this.mostrarResumenPrecios();
        } catch (error) {
            console.error('Error:', error);
            this.showNotification('Error al cargar precios del cliente', 'error');
        } finally {
            this.hideLoading();
        }
    }

    renderTablaPreciosClientes() {
        const emptyState = document.getElementById('precios-empty-state');
        const table = document.getElementById('precios-table');

        if (!this.clientesPreciosSeleccionado) {
            this.mostrarEmptyStatePrecios();
            return;
        }

        if (emptyState) emptyState.classList.add('hidden');
        if (table) table.classList.remove('hidden');

        // Mostrar barra de filtros
        const filtrosBar = document.getElementById('precios-filtros');
        if (filtrosBar) filtrosBar.classList.remove('hidden');

        // Poblar selectores de categoría y proveedor con los valores presentes en los productos
        this.poblarFiltrosPrecios();

        // Renderizar con filtros actuales
        this.aplicarFiltrosPrecios();
    }

    poblarFiltrosPrecios() {
        const categoriasEnProductos = new Set();
        const proveedoresEnProductos = new Set();

        this.productos.forEach(p => {
            if (p.categoria) categoriasEnProductos.add(p.categoria);
            if (p.proveedor) proveedoresEnProductos.add(p.proveedor);
        });

        const selectCat = document.getElementById('precios-filter-categoria');
        if (selectCat) {
            const valorActual = selectCat.value;
            selectCat.innerHTML = '<option value="">Todas las categorías</option>';
            this.categorias
                .filter(c => categoriasEnProductos.has(c.id))
                .forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c.id;
                    opt.textContent = c.nombre;
                    if (c.id === valorActual) opt.selected = true;
                    selectCat.appendChild(opt);
                });
        }

        const selectProv = document.getElementById('precios-filter-proveedor');
        if (selectProv) {
            const valorActual = selectProv.value;
            selectProv.innerHTML = '<option value="">Todos los proveedores</option>';
            this.proveedores
                .filter(p => proveedoresEnProductos.has(p.id))
                .forEach(p => {
                    const opt = document.createElement('option');
                    opt.value = p.id;
                    opt.textContent = p.nombre;
                    if (p.id === valorActual) opt.selected = true;
                    selectProv.appendChild(opt);
                });
        }
    }

    aplicarFiltrosPrecios() {
        const tbody = document.getElementById('precios-table-body');
        if (!tbody || !this.clientesPreciosSeleccionado) return;

        const { texto, categoria, proveedor, soloAsignados } = this.filtrosPrecios || {};

        const rows = [];

        this.productos.forEach(producto => {
            // Filtro por categoría
            if (categoria && producto.categoria !== categoria) return;
            // Filtro por proveedor
            if (proveedor && producto.proveedor !== proveedor) return;
            // Filtro por texto
            if (texto && !producto.nombre?.toLowerCase().includes(texto)) return;

            if (producto.tipo === 'simple') {
                const tienePrecio = this.preciosEspeciales.some(p =>
                    p.productoId === producto.id && p.tipoProducto === 'simple');
                if (soloAsignados && !tienePrecio) return;
                rows.push(this.renderFilaPrecioSimple(producto));
            } else if (producto.tipo === 'variantes') {
                const filas = this.renderFilasPrecioVariantes(producto, soloAsignados, texto);
                rows.push(...filas);
            } else if (producto.tipo === 'conversion') {
                const filas = this.renderFilasPrecioConversiones(producto, soloAsignados, texto);
                rows.push(...filas);
            }
        });

        tbody.innerHTML = rows.join('');

        // Mostrar vacío si no hay resultados
        const noResults = document.getElementById('precios-no-results');
        if (noResults) {
            noResults.style.display = rows.length === 0 ? 'block' : 'none';
        } else if (rows.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-secondary);">Sin resultados para los filtros aplicados</td></tr>`;
        }
    }

    renderFilaPrecioSimple(producto) {
        const precioCosto = producto.precio?.costo || 0;
        const precioPublico = producto.precio?.publico || 0;
        const precioMayorista = producto.precio?.mayorista || 0;

        const precioEspecial = this.preciosEspeciales.find(p => 
            p.productoId === producto.id && 
            p.tipoProducto === 'simple'
        );

        const tienePrecio = !!precioEspecial;
        const valorEspecial = precioEspecial?.precioEspecial || 0;

        // Calcular porcentaje de ganancia
        let porcentajeGanancia = 0;
        if (tienePrecio && precioCosto > 0) {
            porcentajeGanancia = ((valorEspecial - precioCosto) / precioCosto) * 100;
        }

        return `
            <tr data-producto-id="${producto.id}">
                <td>
                    <div class="producto-nombre">📦 ${producto.nombre}</div>
                </td>
                <td><span class="precio-value">${window.currencyFormatter?.format(precioCosto) || '$' + precioCosto.toFixed(2)}</span></td>
                <td><span class="precio-value">${window.currencyFormatter?.format(precioPublico) || '$' + precioPublico.toFixed(2)}</span></td>
                <td><span class="precio-value">${window.currencyFormatter?.format(precioMayorista) || '$' + precioMayorista.toFixed(2)}</span></td>
                <td>
                    <span class="precio-especial-value ${tienePrecio ? 'activo' : ''}">
                        ${tienePrecio ? (window.currencyFormatter?.format(valorEspecial) || '$' + valorEspecial.toFixed(2)) : 'Sin asignar'}
                    </span>
                </td>
                <td>
                    ${tienePrecio ? `<span class="porcentaje-ganancia ${porcentajeGanancia >= 0 ? 'positivo' : 'negativo'}">${porcentajeGanancia >= 0 ? '+' : ''}${porcentajeGanancia.toFixed(1)}%</span>` : '<span class="porcentaje-ganancia sin-dato">-</span>'}
                </td>
                <td>
                    <span class="badge-precio ${tienePrecio ? 'activo' : 'inactivo'}">
                        ${tienePrecio ? '✓ Asignado' : '○ Sin precio'}
                    </span>
                </td>
                <td>
                    <button class="btn-accion btn-precio" 
                            onclick="inventarioModule.abrirModalAsignarPrecio('${producto.id}', 'simple')"
                            title="${tienePrecio ? 'Editar' : 'Asignar'} precio">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="1" x2="12" y2="23"></line>
                            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                        </svg>
                    </button>
                    ${tienePrecio ? `
                        <button class="btn-accion btn-eliminar" 
                                onclick="inventarioModule.eliminarPrecioEspecial('${precioEspecial.id}')"
                                title="Eliminar precio">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    ` : ''}
                </td>
            </tr>
        `;
    }

    renderFilasPrecioVariantes(producto, soloAsignados = false, texto = '') {
        const rows = [];
        const variantesArray = Array.isArray(producto.variantes) 
            ? producto.variantes 
            : Object.values(producto.variantes || {});

        variantesArray.forEach((variante, vIdx) => {
            const precioCosto = variante?.precio?.costo || 0;
            const precioPublico = variante?.precio?.publico || 0;
            const precioMayorista = variante?.precio?.mayorista || 0;

            if (variante.opciones) {
                // Variante con opciones
                const opcionesArray = Array.isArray(variante.opciones) 
                    ? variante.opciones 
                    : Object.values(variante.opciones || {});

                opcionesArray.forEach((opcion, oIdx) => {
                    const itemId = `${producto.id}-v${vIdx}-o${oIdx}`;
                    const precioEspecial = this.preciosEspeciales.find(p => 
                        p.productoId === producto.id && 
                        p.varianteIndex === vIdx &&
                        p.opcionIndex === oIdx
                    );

                    const tienePrecio = !!precioEspecial;
                    if (soloAsignados && !tienePrecio) return;

                    const valorEspecial = precioEspecial?.precioEspecial || 0;

                    // Calcular porcentaje de ganancia
                    let porcentajeGanancia = 0;
                    if (tienePrecio && precioCosto > 0) {
                        porcentajeGanancia = ((valorEspecial - precioCosto) / precioCosto) * 100;
                    }

                    rows.push(`
                        <tr data-producto-id="${itemId}" class="fila-opcion">
                            <td>
                                <div class="producto-nombre-jerarquia">
                                    <span class="icono-jerarquia">└─</span>
                                    <span class="nombre-principal">${producto.nombre}</span>
                                    <span class="badge-variante">${variante.nombre}</span>
                                    <span class="badge-opcion">${opcion.nombre}</span>
                                </div>
                            </td>
                            <td><span class="precio-value">${window.currencyFormatter?.format(precioCosto) || '$' + precioCosto.toFixed(2)}</span></td>
                            <td><span class="precio-value">${window.currencyFormatter?.format(precioPublico) || '$' + precioPublico.toFixed(2)}</span></td>
                            <td><span class="precio-value">${window.currencyFormatter?.format(precioMayorista) || '$' + precioMayorista.toFixed(2)}</span></td>
                            <td>
                                <span class="precio-especial-value ${tienePrecio ? 'activo' : ''}">
                                    ${tienePrecio ? (window.currencyFormatter?.format(valorEspecial) || '$' + valorEspecial.toFixed(2)) : 'Sin asignar'}
                                </span>
                            </td>
                            <td>
                                ${tienePrecio ? `<span class="porcentaje-ganancia ${porcentajeGanancia >= 0 ? 'positivo' : 'negativo'}">${porcentajeGanancia >= 0 ? '+' : ''}${porcentajeGanancia.toFixed(1)}%</span>` : '<span class="porcentaje-ganancia sin-dato">-</span>'}
                            </td>
                            <td>
                                <span class="badge-precio ${tienePrecio ? 'activo' : 'inactivo'}">
                                    ${tienePrecio ? '✓ Asignado' : '○ Sin precio'}
                                </span>
                            </td>
                            <td>
                                <button class="btn-accion btn-precio" 
                                        onclick="inventarioModule.abrirModalAsignarPrecio('${producto.id}', 'variante-opcion', ${vIdx}, ${oIdx})"
                                        title="${tienePrecio ? 'Editar' : 'Asignar'} precio">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <line x1="12" y1="1" x2="12" y2="23"></line>
                                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                                    </svg>
                                </button>
                                ${tienePrecio ? `
                                    <button class="btn-accion btn-eliminar" 
                                            onclick="inventarioModule.eliminarPrecioEspecial('${precioEspecial.id}')"
                                            title="Eliminar precio">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <polyline points="3 6 5 6 21 6"></polyline>
                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                        </svg>
                                    </button>
                                ` : ''}
                            </td>
                        </tr>
                    `);
                });
            } else {
                // Variante sin opciones
                const itemId = `${producto.id}-v${vIdx}`;
                const precioEspecial = this.preciosEspeciales.find(p => 
                    p.productoId === producto.id && 
                    p.varianteIndex === vIdx &&
                    p.opcionIndex === undefined
                );

                const tienePrecio = !!precioEspecial;
                if (soloAsignados && !tienePrecio) return;

                const valorEspecial = precioEspecial?.precioEspecial || 0;

                // Calcular porcentaje de ganancia
                let porcentajeGanancia = 0;
                if (tienePrecio && precioCosto > 0) {
                    porcentajeGanancia = ((valorEspecial - precioCosto) / precioCosto) * 100;
                }

                rows.push(`
                    <tr data-producto-id="${itemId}" class="fila-variante">
                        <td>
                            <div class="producto-nombre-jerarquia">
                                <span class="icono-jerarquia">└─</span>
                                <span class="nombre-principal">${producto.nombre}</span>
                                <span class="badge-variante">${variante.nombre}</span>
                            </div>
                        </td>
                        <td><span class="precio-value">${window.currencyFormatter?.format(precioCosto) || '$' + precioCosto.toFixed(2)}</span></td>
                        <td><span class="precio-value">${window.currencyFormatter?.format(precioPublico) || '$' + precioPublico.toFixed(2)}</span></td>
                        <td><span class="precio-value">${window.currencyFormatter?.format(precioMayorista) || '$' + precioMayorista.toFixed(2)}</span></td>
                        <td>
                            <span class="precio-especial-value ${tienePrecio ? 'activo' : ''}">
                                ${tienePrecio ? (window.currencyFormatter?.format(valorEspecial) || '$' + valorEspecial.toFixed(2)) : 'Sin asignar'}
                            </span>
                        </td>
                        <td>
                            ${tienePrecio ? `<span class="porcentaje-ganancia ${porcentajeGanancia >= 0 ? 'positivo' : 'negativo'}">${porcentajeGanancia >= 0 ? '+' : ''}${porcentajeGanancia.toFixed(1)}%</span>` : '<span class="porcentaje-ganancia sin-dato">-</span>'}
                        </td>
                        <td>
                            <span class="badge-precio ${tienePrecio ? 'activo' : 'inactivo'}">
                                ${tienePrecio ? '✓ Asignado' : '○ Sin precio'}
                            </span>
                        </td>
                        <td>
                            <button class="btn-accion btn-precio" 
                                    onclick="inventarioModule.abrirModalAsignarPrecio('${producto.id}', 'variante-simple', ${vIdx})"
                                    title="${tienePrecio ? 'Editar' : 'Asignar'} precio">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="12" y1="1" x2="12" y2="23"></line>
                                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                                </svg>
                            </button>
                            ${tienePrecio ? `
                                <button class="btn-accion btn-eliminar" 
                                        onclick="inventarioModule.eliminarPrecioEspecial('${precioEspecial.id}')"
                                        title="Eliminar precio">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="3 6 5 6 21 6"></polyline>
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                    </svg>
                                </button>
                            ` : ''}
                        </td>
                    </tr>
                `);
            }
        });

        return rows;
    }

    renderFilasPrecioConversiones(producto, soloAsignados = false, texto = '') {
        const rows = [];
        const conversionesArray = Array.isArray(producto.conversiones) 
            ? producto.conversiones 
            : Object.values(producto.conversiones || {});

        conversionesArray.forEach((conversion, cIdx) => {
            const precioCosto = conversion?.precio?.costo || 0;
            const precioPublico = conversion?.precio?.publico || 0;
            const precioMayorista = conversion?.precio?.mayorista || 0;

            const itemId = `${producto.id}-c${cIdx}`;
            const precioEspecial = this.preciosEspeciales.find(p => 
                p.productoId === producto.id && 
                p.conversionIndex === cIdx
            );

            const tienePrecio = !!precioEspecial;
            if (soloAsignados && !tienePrecio) return;

            const valorEspecial = precioEspecial?.precioEspecial || 0;

            // Calcular porcentaje de ganancia
            let porcentajeGanancia = 0;
            if (tienePrecio && precioCosto > 0) {
                porcentajeGanancia = ((valorEspecial - precioCosto) / precioCosto) * 100;
            }

            rows.push(`
                <tr data-producto-id="${itemId}" class="fila-conversion">
                    <td>
                        <div class="producto-nombre">
                            📦 ${producto.nombre}
                            <span class="badge-conversion">${conversion.tipo}</span>
                        </div>
                    </td>
                    <td><span class="precio-value">${window.currencyFormatter?.format(precioCosto) || '$' + precioCosto.toFixed(2)}</span></td>
                    <td><span class="precio-value">${window.currencyFormatter?.format(precioPublico) || '$' + precioPublico.toFixed(2)}</span></td>
                    <td><span class="precio-value">${window.currencyFormatter?.format(precioMayorista) || '$' + precioMayorista.toFixed(2)}</span></td>
                    <td>
                        <span class="precio-especial-value ${tienePrecio ? 'activo' : ''}">
                            ${tienePrecio ? (window.currencyFormatter?.format(valorEspecial) || '$' + valorEspecial.toFixed(2)) : 'Sin asignar'}
                        </span>
                    </td>
                    <td>
                        ${tienePrecio ? `<span class="porcentaje-ganancia ${porcentajeGanancia >= 0 ? 'positivo' : 'negativo'}">${porcentajeGanancia >= 0 ? '+' : ''}${porcentajeGanancia.toFixed(1)}%</span>` : '<span class="porcentaje-ganancia sin-dato">-</span>'}
                    </td>
                    <td>
                        <span class="badge-precio ${tienePrecio ? 'activo' : 'inactivo'}">
                            ${tienePrecio ? '✓ Asignado' : '○ Sin precio'}
                        </span>
                    </td>
                    <td>
                        <button class="btn-accion btn-precio" 
                                onclick="inventarioModule.abrirModalAsignarPrecio('${producto.id}', 'conversion', null, null, ${cIdx})"
                                title="${tienePrecio ? 'Editar' : 'Asignar'} precio">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="12" y1="1" x2="12" y2="23"></line>
                                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                            </svg>
                        </button>
                        ${tienePrecio ? `
                            <button class="btn-accion btn-eliminar" 
                                    onclick="inventarioModule.eliminarPrecioEspecial('${precioEspecial.id}')"
                                    title="Eliminar precio">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                            </button>
                        ` : ''}
                    </td>
                </tr>
            `);
        });

        return rows;
    }

    abrirModalAsignarPrecio(productoId, tipo, varianteIndex = null, opcionIndex = null, conversionIndex = null) {
        const producto = this.productos.find(p => p.id === productoId);
        if (!producto) return;

        this.productoEditandoPrecio = {
            productoId,
            tipo,
            varianteIndex,
            opcionIndex,
            conversionIndex,
            producto
        };

        // Obtener precios según tipo
        let precioPublico = 0;
        let precioMayorista = 0;
        let nombreCompleto = producto.nombre;

        if (tipo === 'simple') {
            precioPublico = producto.precio?.publico || 0;
            precioMayorista = producto.precio?.mayorista || 0;
        } else if (tipo === 'variante-simple') {
            const variantesArray = Array.isArray(producto.variantes) ? producto.variantes : Object.values(producto.variantes || {});
            const variante = variantesArray[varianteIndex];
            precioPublico = variante?.precio?.publico || 0;
            precioMayorista = variante?.precio?.mayorista || 0;
            nombreCompleto = `${producto.nombre} - ${variante.nombre}`;
        } else if (tipo === 'variante-opcion') {
            const variantesArray = Array.isArray(producto.variantes) ? producto.variantes : Object.values(producto.variantes || {});
            const variante = variantesArray[varianteIndex];
            const opcionesArray = Array.isArray(variante?.opciones) ? variante.opciones : Object.values(variante?.opciones || {});
            const opcion = opcionesArray[opcionIndex];
            precioPublico = variante?.precio?.publico || 0;
            precioMayorista = variante?.precio?.mayorista || 0;
            nombreCompleto = `${producto.nombre} - ${variante.nombre} - ${opcion.nombre}`;
        } else if (tipo === 'conversion') {
            const conversionesArray = Array.isArray(producto.conversiones) ? producto.conversiones : Object.values(producto.conversiones || {});
            const conversion = conversionesArray[conversionIndex];
            precioPublico = conversion?.precio?.publico || 0;
            precioMayorista = conversion?.precio?.mayorista || 0;
            nombreCompleto = `${producto.nombre} - ${conversion.tipo}`;
        }

        // Llenar modal
        document.getElementById('precio-producto-nombre').textContent = nombreCompleto;
        document.getElementById('comp-precio-publico').textContent = 
            window.currencyFormatter?.format(precioPublico) || '$' + precioPublico.toFixed(2);
        document.getElementById('comp-precio-mayorista').textContent = 
            window.currencyFormatter?.format(precioMayorista) || '$' + precioMayorista.toFixed(2);

        // Buscar precio especial existente
        let precioExistente = this.preciosEspeciales.find(p => {
            if (p.productoId !== productoId) return false;
            if (tipo === 'simple') return p.tipoProducto === 'simple';
            if (tipo === 'variante-simple') return p.varianteIndex === varianteIndex && p.opcionIndex === undefined;
            if (tipo === 'variante-opcion') return p.varianteIndex === varianteIndex && p.opcionIndex === opcionIndex;
            if (tipo === 'conversion') return p.conversionIndex === conversionIndex;
            return false;
        });

        if (precioExistente) {
            document.getElementById('input-precio-especial').value = precioExistente.precioEspecial;
            document.getElementById('input-notas-precio').value = precioExistente.notas || '';
            document.getElementById('comp-precio-especial').textContent = 
                window.currencyFormatter?.format(precioExistente.precioEspecial) || '$' + precioExistente.precioEspecial.toFixed(2);
        } else {
            document.getElementById('input-precio-especial').value = '';
            document.getElementById('input-notas-precio').value = '';
            document.getElementById('comp-precio-especial').textContent = '$0.00';
        }

        const modal = document.getElementById('modal-precio-especial');
        if (modal) {
            // Mover el modal directamente al body elimina cualquier interferencia
            // de contenedores padre (permanent-modals-container tiene position:fixed
            // que en algunos navegadores afecta el posicionamiento de hijos fixed).
            if (modal.parentElement !== document.body) {
                document.body.appendChild(modal);
            }
            modal.style.cssText = '';
            modal.classList.add('active');
            void modal.offsetHeight;
        }
    }

    cerrarModalPrecio() {
        const modal = document.getElementById('modal-precio-especial');
        if (modal) {
            modal.classList.remove('active');
            this.productoEditandoPrecio = null;
            // Devolver al contenedor permanente
            const permanentContainer = document.getElementById('permanent-modals-container');
            if (permanentContainer && modal.parentElement !== permanentContainer) {
                permanentContainer.appendChild(modal);
            }
        }
    }

    async guardarPrecioEspecial() {
        if (!this.productoEditandoPrecio || !this.clientesPreciosSeleccionado) return;

        const precioEspecial = parseFloat(document.getElementById('input-precio-especial').value);
        const notas = document.getElementById('input-notas-precio').value.trim();

        if (!precioEspecial || precioEspecial <= 0) {
            this.showNotification('Ingresa un precio válido', 'warning');
            return;
        }

        this.showLoading();

        try {
            const { productoId, tipo, varianteIndex, opcionIndex, conversionIndex } = this.productoEditandoPrecio;

            // Obtener el usuario actual correctamente
            const currentUser = window.authSystem?.getCurrentUser();
            const userId = currentUser?.uid || 'system';

            const precioData = {
                clienteId: this.clientesPreciosSeleccionado,
                productoId,
                tipoProducto: tipo,
                precioEspecial,
                notas,
                activo: true,
                ultimaActualizacion: new Date(),
                actualizadoPor: userId
            };

            // Agregar índices según tipo
            if (varianteIndex !== null) precioData.varianteIndex = varianteIndex;
            if (opcionIndex !== null) precioData.opcionIndex = opcionIndex;
            if (conversionIndex !== null) precioData.conversionIndex = conversionIndex;

            // Buscar si ya existe
            let precioExistente = this.preciosEspeciales.find(p => {
                if (p.productoId !== productoId) return false;
                if (tipo === 'simple') return p.tipoProducto === 'simple';
                if (tipo === 'variante-simple') return p.varianteIndex === varianteIndex && p.opcionIndex === undefined;
                if (tipo === 'variante-opcion') return p.varianteIndex === varianteIndex && p.opcionIndex === opcionIndex;
                if (tipo === 'conversion') return p.conversionIndex === conversionIndex;
                return false;
            });

            if (precioExistente) {
                await window.db.collection('customPrices').doc(precioExistente.id).update(precioData);
                this.showNotification('✅ Precio actualizado exitosamente', 'success');
            } else {
                const currentUser = window.authSystem?.getCurrentUser();
                precioData.fechaCreacion = new Date();
                precioData.creadoPor = currentUser?.uid || 'system';
                await window.db.collection('customPrices').add(precioData);
                this.showNotification('✅ Precio asignado exitosamente', 'success');
            }

            await this.loadPreciosEspeciales(this.clientesPreciosSeleccionado);
            this.renderTablaPreciosClientes();
            this.mostrarResumenPrecios();
            this.cerrarModalPrecio();

        } catch (error) {
            console.error('Error guardando precio:', error);
            this.showNotification('Error al guardar el precio', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async eliminarPrecioEspecial(precioId) {
        if (!confirm('¿Eliminar este precio especial?')) return;

        this.showLoading();

        try {
            await window.db.collection('customPrices').doc(precioId).delete();
            this.showNotification('✅ Precio eliminado', 'success');

            await this.loadPreciosEspeciales(this.clientesPreciosSeleccionado);
            this.renderTablaPreciosClientes();
            this.mostrarResumenPrecios();
        } catch (error) {
            console.error('Error:', error);
            this.showNotification('Error al eliminar', 'error');
        } finally {
            this.hideLoading();
        }
    }

    mostrarEmptyStatePrecios() {
        const emptyState = document.getElementById('precios-empty-state');
        const table = document.getElementById('precios-table');
        const resumen = document.getElementById('precios-resumen');
        const filtros = document.getElementById('precios-filtros');

        if (emptyState) emptyState.classList.remove('hidden');
        if (table) table.classList.add('hidden');
        if (resumen) resumen.classList.add('hidden');
        if (filtros) filtros.classList.add('hidden');
    }

    mostrarResumenPrecios() {
        const resumen = document.getElementById('precios-resumen');
        const totalProductos = document.getElementById('precios-total-productos');

        if (resumen) resumen.classList.remove('hidden');
        if (totalProductos) totalProductos.textContent = this.preciosEspeciales.length;
    }

    filtrarProductosPrecios(searchTerm) {
        if (!this.filtrosPrecios) this.filtrosPrecios = { texto: '', categoria: '', proveedor: '', soloAsignados: false };
        this.filtrosPrecios.texto = (searchTerm || '').toLowerCase().trim();
        this.aplicarFiltrosPrecios();
    }

    renderProveedoresSimulacion() {
        const select = document.getElementById('simulacion-select-proveedor');
        if (!select) return;

        select.innerHTML = '<option value="">-- Seleccione un proveedor --</option>';

        if (this.proveedores.length === 0) {
            select.innerHTML += '<option value="" disabled>No hay proveedores disponibles</option>';
            return;
        }

        this.proveedores.forEach(proveedor => {
            const option = document.createElement('option');
            option.value = proveedor.id;
            option.textContent = proveedor.nombre;
            select.appendChild(option);
        });
    }

    seleccionarProveedorSimulacion(proveedorId) {
        if (!proveedorId) {
            this.limpiarSimulacion();
            return;
        }

        this.proveedorSimulacionSeleccionado = this.proveedores.find(p => p.id === proveedorId);
        if (!this.proveedorSimulacionSeleccionado) return;

        const productosFiltrados = this.productos.filter(p => p.proveedor === proveedorId);

        if (productosFiltrados.length === 0) {
            this.showNotification('Este proveedor no tiene productos asignados', 'warning');
            this.mostrarEmptyStateSimulacion();
            return;
        }

        this.pedidoSimulacion.clear();
        this.renderTablaSimulacion(productosFiltrados);
        this.actualizarResumenSimulacion();
        this.habilitarBotonesSimulacion();
    }

    // Agregar opción a una variante específica
    agregarOpcion(varianteIndex) {
        const container = document.getElementById(`opciones-container-${varianteIndex}`);
        const opcionIndex = container.children.length;

        const opcionHTML = `
            <div class="opcion-item" data-opcion="${opcionIndex}">
                <div class="form-row">
                    <div class="form-group">
                        <label>Nombre de la Opción *</label>
                        <input type="text" name="variante_${varianteIndex}_opcion_nombre_${opcionIndex}" placeholder="Ej: Cola, Rojo" required>
                    </div>
                    <div class="form-group">
                        <label>Código de Barras</label>
                        <input type="text" name="variante_${varianteIndex}_opcion_codigo_${opcionIndex}" placeholder="Ej: 7501234567892">
                        <small>Opcional</small>
                    </div>
                </div>
                <div class="form-group">
                    <label>Stock Inicial *</label>
                    <input type="number" name="variante_${varianteIndex}_opcion_stock_${opcionIndex}" min="0" required>
                </div>
                <button type="button" class="btn-remove-opcion" onclick="inventarioModule.removeOpcion(${varianteIndex}, ${opcionIndex})">Eliminar Opción</button>
            </div>
        `;

        container.insertAdjacentHTML('beforeend', opcionHTML);
    }

    removeOpcion(varianteIndex, opcionIndex) {
        const opcion = document.querySelector(`#opciones-container-${varianteIndex} [data-opcion="${opcionIndex}"]`);
        if (opcion) opcion.remove();
    }

    // Expandir/colapsar detalles de producto
    toggleProductDetails(productoId) {
        const detailRows = document.querySelectorAll(`.detail-row-${productoId}`);
        const toggleBtn = document.getElementById(`toggle-${productoId}`);

        if (detailRows.length === 0) return;

        const isHidden = detailRows[0].classList.contains('hidden');
        
        detailRows.forEach(row => {
            if (isHidden) {
                row.classList.remove('hidden');
            } else {
                row.classList.add('hidden');
            }
        });

        toggleBtn.textContent = isHidden ? '▼' : '▶';
    }

    setupRealtimeListeners() {
        // Escuchar cambios en productos en tiempo real
        if (window.realtimeSync) {
            window.realtimeSync.listenToCollection('products', (changes) => {
                // Actualizar solo los cambios, no toda la tabla
                this.handleProductChanges(changes);
            }, this.moduleId);

            window.realtimeSync.listenToCollection('categories', async (changes) => {
                await this.loadCategorias();
                this.populateCategorias();
            }, this.moduleId);
        }
    }

    handleProductChanges(changes) {
        let needsRerender = false;

        if (changes.added.length > 0) {
            changes.added.forEach(producto => {
                if (!this.productos.find(p => p.id === producto.id)) {
                    this.productos.push(producto);
                    needsRerender = true;
                }
            });
        }

        if (changes.modified.length > 0) {
            changes.modified.forEach(producto => {
                const index = this.productos.findIndex(p => p.id === producto.id);
                if (index !== -1) {
                    this.productos[index] = producto;
                    needsRerender = true;
                }
            });
        }

        if (changes.removed.length > 0) {
            changes.removed.forEach(producto => {
                const index = this.productos.findIndex(p => p.id === producto.id);
                if (index !== -1) {
                    this.productos.splice(index, 1);
                    needsRerender = true;
                }
            });
        }

        if (needsRerender) {
            this.renderProductos();
            this.renderDashboardStats();
        }
    }

    // Generar un ID único determinista para evitar duplicados
    generateDeterministicId(nombre, tipo, codigo = '') {
        const cleanName = nombre.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const cleanCodigo = (codigo || '').toLowerCase().replace(/[^a-z0-9]/g, '-');
        const suffix = cleanCodigo || Math.random().toString(36).substring(2, 7);
        return `prod-${tipo}-${cleanName}-${suffix}`;
    }

    async guardarProducto(e) {
        if (e) e.preventDefault();
        
        // Guardia contra doble envío (clic rápido o listeners duplicados)
        if (this.isProcessing) return;
        this.isProcessing = true;

        const isEditing = this.editingProducto !== null;

        // Busca el botón submit visible en pantalla (hay uno por tipo de producto)
        const btnGuardar = [...document.querySelectorAll('#form-producto button[type="submit"]')]
            .find(btn => btn.offsetParent !== null) || null;
        const originalText = btnGuardar ? btnGuardar.innerHTML : '';

        const resetBtn = () => {
            this.isProcessing = false;
            if (btnGuardar) {
                btnGuardar.disabled = false;
                btnGuardar.innerHTML = originalText;
            }
        };

        if (btnGuardar) {
            btnGuardar.disabled = true;
            btnGuardar.innerHTML = `<span><i class="fas fa-spinner fa-spin"></i> ${isEditing ? 'Actualizando...' : 'Guardando...'}</span>`;
        }
        
        try {
            const form = document.getElementById('form-producto');
            const formData = new FormData(form);
            const tipo = this.currentTipoProducto;
            
            const nombre = formData.get('nombre')?.trim();
            const codigo = formData.get('codigo')?.trim() || '';
            const categoria = formData.get('categoria');
            const proveedor = formData.get('proveedor');

            if (!nombre || !categoria || !proveedor) {
                this.showNotification('Faltan campos obligatorios', 'error');
                resetBtn();
                return;
            }

            // Verificar que el proveedor existe
            const proveedorObj = this.proveedores.find(p => p.id === proveedor);
            if (!proveedorObj) {
                this.showNotification('El proveedor seleccionado no existe', 'error');
                resetBtn();
                return;
            }

            this.showLoading();

            // ID determinista para nuevos productos: doc().set() es idempotente
            const productId = isEditing ? this.editingProducto.id : this.generateDeterministicId(nombre, tipo, codigo);

            let productoData = {
                nombre: window.inputSanitizer ? window.inputSanitizer.sanitizeText(nombre) : nombre,
                codigo,
                categoria,
                proveedor,
                proveedorNombre: proveedorObj.nombre || '',
                tipo
            };

            // Validar contenido mínimo según tipo
            if (tipo === 'variantes') {
                const container = document.getElementById('variantes-container');
                if (!container || container.querySelectorAll('.variante-item').length === 0) {
                    this.showNotification('Agrega al menos una variante antes de guardar', 'error');
                    resetBtn();
                    return;
                }
            } else if (tipo === 'conversion') {
                const container = document.getElementById('conversiones-container');
                if (!container || container.querySelectorAll('[data-conversion]').length === 0) {
                    this.showNotification('Agrega al menos una unidad de conversión antes de guardar', 'error');
                    resetBtn();
                    return;
                }
            }

            // Lógica específica por tipo — limpiamos campos del resto de tipos
            if (tipo === 'simple') {
                productoData.precio = {
                    costo: parseFloat(formData.get('precioCosto')) || 0,
                    publico: parseFloat(formData.get('precioPublico')) || 0,
                    mayorista: parseFloat(formData.get('precioMayorista')) || 0
                };
                productoData.stock = {
                    actual: parseFloat(formData.get('stockInicial')) || 0,
                    minimo: parseFloat(formData.get('stockMinimo')) || 0
                };
                productoData.variantes = null;
                productoData.conversiones = null;
                productoData.unidadBase = null;
            } else if (tipo === 'variantes') {
                productoData.variantes = this.getVariantesFromForm();
                productoData.precio = null;
                productoData.conversiones = null;
                productoData.unidadBase = null;
            } else if (tipo === 'conversion') {
                productoData.unidadBase = formData.get('unidadBase') || 'unidad';
                productoData.conversiones = this.getConversionesFromForm();
                const stockActualInput = formData.get('stockInicialConversion') || formData.get('stock-inicial-conversion');
                const stockMinInput = formData.get('stockMinimoConversion') || formData.get('stock-minimo-conversion');
                productoData.stock = {
                    actual: parseFloat(stockActualInput) || 0,
                    minimo: parseFloat(stockMinInput) || 0
                };
                productoData.precio = null;
                productoData.variantes = null;
            }

            // Metadata
            if (!isEditing) {
                productoData.metadata = {
                    createdAt: new Date(),
                    createdBy: window.authSystem?.currentUser?.uid || 'unknown',
                    status: 'active'
                };
            } else {
                productoData.metadata = {
                    ...(this.editingProducto.metadata || {}),
                    updatedAt: new Date(),
                    updatedBy: window.authSystem?.currentUser?.uid || 'unknown'
                };
            }

            // Guardar en Firestore (doc().set() es idempotente: mismos datos = mismo resultado)
            await window.db.collection('products').doc(productId).set(productoData);

            // Actualizar array local directamente — evita recargar toda la colección
            // y previene el doble-render que ocurre cuando el listener realtime también dispara
            if (isEditing) {
                const index = this.productos.findIndex(p => p.id === productId);
                if (index !== -1) {
                    this.productos[index] = { id: productId, ...productoData };
                }
            } else {
                // Deduplicar por si el listener realtime ya lo añadió antes
                if (!this.productos.find(p => p.id === productId)) {
                    this.productos.push({ id: productId, ...productoData });
                }
            }

            // Invalidar caché
            if (window.cacheManager && typeof window.cacheManager.invalidate === 'function') {
                window.cacheManager.invalidate('productos_cache');
            }

            this.showNotification(isEditing ? 'Producto actualizado correctamente' : 'Producto creado correctamente', 'success');
            this.closeModal();
            this.renderProductos();
            this.renderDashboardStats();

        } catch (error) {
            console.error('Error al guardar:', error);
            this.showNotification('Error al guardar: ' + error.message, 'error');
        } finally {
            resetBtn();
            this.hideLoading();
        }
    }

    getVariantesFromForm() {
        const variantes = [];
        const container = document.getElementById('variantes-container');
        const varianteItems = container.querySelectorAll('.variante-item');
        
        varianteItems.forEach(item => {
            const idx = item.dataset.index;
            const tieneOpciones = document.querySelector(`input[name="variante_tiene_opciones_${idx}"]`)?.checked;
            
            const variante = {
                nombre: document.querySelector(`input[name="variante_nombre_${idx}"]`)?.value || '',
                codigoBarras: document.querySelector(`input[name="variante_codigo_${idx}"]`)?.value || '',
                precio: {
                    costo: parseFloat(document.querySelector(`input[name="variante_costo_${idx}"]`)?.value) || 0,
                    publico: parseFloat(document.querySelector(`input[name="variante_publico_${idx}"]`)?.value) || 0,
                    mayorista: parseFloat(document.querySelector(`input[name="variante_mayorista_${idx}"]`)?.value) || 0
                },
                stock: {
                    minimo: parseFloat(document.querySelector(`input[name="variante_minimo_${idx}"]`)?.value) || 0
                }
            };

            if (tieneOpciones) {
                variante.opciones = [];
                const opcionesContainer = document.getElementById(`opciones-container-${idx}`);
                if (opcionesContainer) {
                    // Seleccionar los ítems de opción dentro de este contenedor específico
                    const opcionItems = opcionesContainer.querySelectorAll('.opcion-item');
                    opcionItems.forEach(opItem => {
                        const opIdx = opItem.dataset.opcion; // Usar el atributo correcto 'data-opcion'
                        const opNombre = document.querySelector(`input[name="variante_${idx}_opcion_nombre_${opIdx}"]`)?.value;
                        if (opNombre) {
                            variante.opciones.push({
                                nombre: opNombre,
                                codigoBarras: document.querySelector(`input[name="variante_${idx}_opcion_codigo_${opIdx}"]`)?.value || '',
                                stock: {
                                    actual: parseFloat(document.querySelector(`input[name="variante_${idx}_opcion_stock_${opIdx}"]`)?.value) || 0
                                }
                            });
                        }
                    });
                }
                // El stock actual de la variante es la suma de sus opciones
                variante.stock.actual = variante.opciones.reduce((sum, opt) => sum + (opt.stock.actual || 0), 0);
            } else {
                variante.stock.actual = parseFloat(document.querySelector(`input[name="variante_stock_${idx}"]`)?.value) || 0;
            }
            
            variantes.push(variante);
        });
        
        return variantes;
    }

    getConversionesFromForm() {
        const conversiones = [];
        const container = document.getElementById('conversiones-container');
        const items = container.querySelectorAll('[data-conversion]');
        
        items.forEach((item, arrayIndex) => {
            const idx = item.dataset.conversion;

            // Preservar el ID original cuando se edita para no romper referencias en ventas
            let conversionId;
            if (this.editingProducto?.conversiones) {
                const convArray = Array.isArray(this.editingProducto.conversiones)
                    ? this.editingProducto.conversiones
                    : Object.values(this.editingProducto.conversiones);
                conversionId = convArray[arrayIndex]?.id || `c-${idx}-${Date.now()}`;
            } else {
                conversionId = `c-${idx}-${Date.now()}`;
            }

            conversiones.push({
                id: conversionId,
                tipo: document.querySelector(`input[name="conversion_nombre_${idx}"]`)?.value || '',
                cantidad: parseFloat(document.querySelector(`input[name="conversion_cantidad_${idx}"]`)?.value) || 1,
                precio: {
                    costo: parseFloat(document.querySelector(`input[name="conversion_costo_${idx}"]`)?.value) || 0,
                    publico: parseFloat(document.querySelector(`input[name="conversion_publico_${idx}"]`)?.value) || 0,
                    mayorista: parseFloat(document.querySelector(`input[name="conversion_mayorista_${idx}"]`)?.value) || 0
                }
            });
        });
        
        return conversiones;
    }

    setupEventListeners() {
        // Cancelar listeners anteriores antes de registrar nuevos
        // Esto evita que al recargar el módulo se acumulen listeners duplicados sobre el mismo DOM
        if (this._listenerAbortController) {
            this._listenerAbortController.abort();
        }
        this._listenerAbortController = new AbortController();
        const signal = this._listenerAbortController.signal;

        // Mejorar UX de tabla en móvil
        this.setupTableScrollIndicator();

        // Listeners para checkboxes de filas - tiempo real
        const tableBody = document.getElementById('productos-table-body');
        if (tableBody) {
            const checkboxes = tableBody.querySelectorAll('.row-checkbox');
            checkboxes.forEach(checkbox => {
                checkbox.addEventListener('change', () => this.updateBulkDeleteButton(), { signal });
            });
        }

        // Botones principales
        const btnNuevoProducto = document.getElementById('btn-nuevo-producto');
        const btnGestionarCategorias = document.getElementById('btn-gestionar-categorias');
        
        if (btnNuevoProducto) {
            btnNuevoProducto.addEventListener('click', () => this.openModal(), { signal });
        }
        if (btnGestionarCategorias) {
            btnGestionarCategorias.addEventListener('click', () => this.openCategoriasModal(), { signal });
        }

        // Modal producto
        const modalClose = document.getElementById('modal-close');
        if (modalClose) {
            modalClose.addEventListener('click', () => this.closeModal(), { signal });
        }

        // Modal categorías
        const modalCategoriasClose = document.getElementById('modal-categorias-close');
        const btnAgregarCategoria = document.getElementById('btn-agregar-categoria');
        
        if (modalCategoriasClose) {
            modalCategoriasClose.addEventListener('click', () => this.closeCategoriasModal(), { signal });
        }
        if (btnAgregarCategoria) {
            btnAgregarCategoria.addEventListener('click', () => this.agregarCategoria(), { signal });
        }

        // Búsqueda y filtros
        const searchProductos = document.getElementById('search-productos');
        const filterCategoria = document.getElementById('filter-categoria');
        const filterProveedor = document.getElementById('filter-proveedor');
        const filterTipo = document.getElementById('filter-tipo');
        const filterStock = document.getElementById('filter-stock');
        
        if (searchProductos) {
            searchProductos.addEventListener('input', (e) => this.filterProductos(e.target.value), { signal });
        }
        if (filterCategoria) {
            filterCategoria.addEventListener('change', () => this.applyFilters(), { signal });
        }
        if (filterProveedor) {
            filterProveedor.addEventListener('change', () => this.applyFilters(), { signal });
        }
        if (filterTipo) {
            filterTipo.addEventListener('change', () => this.applyFilters(), { signal });
        }
        if (filterStock) {
            filterStock.addEventListener('change', () => this.applyFilters(), { signal });
        }

        // Navegación del formulario
        const btnSiguienteTipo = document.getElementById('btn-siguiente-tipo');
        const btnAtrasInfo = document.getElementById('btn-atras-info');
        const btnSiguienteInfo = document.getElementById('btn-siguiente-info');
        const btnAtrasSimple = document.getElementById('btn-atras-simple');
        const btnAtrasVariantes = document.getElementById('btn-atras-variantes');
        const btnAtrasConversion = document.getElementById('btn-atras-conversion');
        
        if (btnSiguienteTipo) btnSiguienteTipo.addEventListener('click', () => this.nextStepFromTipo(), { signal });
        if (btnAtrasInfo) btnAtrasInfo.addEventListener('click', () => this.showStep(1), { signal });
        if (btnSiguienteInfo) btnSiguienteInfo.addEventListener('click', () => this.nextStepFromInfo(), { signal });
        if (btnAtrasSimple) btnAtrasSimple.addEventListener('click', () => this.showStep(2), { signal });
        if (btnAtrasVariantes) btnAtrasVariantes.addEventListener('click', () => this.showStep(2), { signal });
        if (btnAtrasConversion) btnAtrasConversion.addEventListener('click', () => this.showStep(2), { signal });

        // Tipo de producto
        document.querySelectorAll('input[name="tipoProducto"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.currentTipoProducto = e.target.value;
            }, { signal });
        });

        // Variantes y conversiones
        const btnAgregarVariante = document.getElementById('btn-agregar-variante');
        const btnAgregarConversion = document.getElementById('btn-agregar-conversion');
        
        if (btnAgregarVariante) {
            btnAgregarVariante.addEventListener('click', () => this.agregarVariante(), { signal });
        }
        if (btnAgregarConversion) {
            btnAgregarConversion.addEventListener('click', () => this.agregarConversion(), { signal });
        }

        // Cálculo de utilidad (incluye mayorista para mostrar su margen en tiempo real)
        ['precio-costo', 'precio-publico', 'precio-mayorista'].forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('input', () => this.calcularUtilidad(), { signal });
            }
        });

        // Submit del formulario - un solo listener activo gracias al AbortController
        const formProducto = document.getElementById('form-producto');
        if (formProducto) {
            formProducto.addEventListener('submit', (e) => this.guardarProducto(e), { signal });
        }
        
        console.log('✅ Event listeners configurados correctamente');
    }

    async loadCategorias() {
        try {
            console.log('📂 Cargando categorías...');
            if (!window.db) throw new Error('Firebase no disponible');
            
            const querySnapshot = await window.db.collection('categories').get();
            this.categorias = [];
            querySnapshot.forEach((doc) => {
                this.categorias.push({ id: doc.id, ...doc.data() });
            });
            console.log(`✅ ${this.categorias.length} categorías cargadas`);
        } catch (error) {
            console.error('❌ Error al cargar categorías:', error);
            this.categorias = [];
            throw error;
        }
    }

    async loadProveedores() {
        try {
            console.log('🚚 Cargando proveedores...');
            if (!window.db) throw new Error('Firebase no disponible');
            
            const querySnapshot = await window.db.collection('providers').get();
            this.proveedores = [];
            querySnapshot.forEach((doc) => {
                this.proveedores.push({ id: doc.id, ...doc.data() });
            });
            console.log(`✅ ${this.proveedores.length} proveedores cargados`);
        } catch (error) {
            console.error('❌ Error al cargar proveedores:', error);
            this.proveedores = [];
            throw error;
        }
    }

    async loadProductos() {
        try {
            console.log('📦 Cargando productos...');
            if (!window.db) throw new Error('Firebase no disponible');
            
            // 🚀 OPTIMIZACIÓN: Renderizado ultra-veloz
            if (window.cacheManager) {
                const cached = await window.cacheManager.get('productos_cache');
                if (cached && cached.length > 0) {
                    this.productos = cached.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
                    // Renderizado inicial inmediato
                    this.renderProductos();
                    this.renderDashboardStats();
                    console.log('⚡ UI cargada instantáneamente desde caché');
                }
            }

            // Carga real desde Firebase
            const querySnapshot = await window.db.collection('products').get();
            const productos = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            this.productos = productos.sort((a, b) => {
                const nombreA = (a.nombre || '').toLowerCase();
                const nombreB = (b.nombre || '').toLowerCase();
                return nombreA.localeCompare(nombreB);
            });

            // Actualizar caché para la próxima vez
            if (window.cacheManager) {
                await window.cacheManager.set('productos_cache', this.productos);
            }

            // Refrescar UI con datos frescos de Firebase
            this.renderProductos();
            this.renderDashboardStats();
            
            console.log(`✅ ${this.productos.length} productos actualizados desde la nube`);
        } catch (error) {
            console.error('❌ Error al cargar productos:', error);
            if (this.productos.length === 0) {
                this.showNotification('Error de conexión al cargar inventario', 'error');
            }
        }
    }

    renderProductos(productos = this.productos) {
        const tbody = document.getElementById('productos-table-body');
        const headerCheckboxContainer = document.getElementById('header-checkbox-container');

        const tienePermisoEditar = window.authSystem?.hasSubPermission('inventario', 'editarProducto') ?? true;
        const tienePermisoEliminar = window.authSystem?.hasSubPermission('inventario', 'eliminarProducto') ?? true;
        const tienePermisoEliminarMasivo = window.authSystem?.hasSubPermission('inventario', 'eliminarMasivo') ?? true;

        // Controlar checkbox de "seleccionar todo" basado en permisos
        if (headerCheckboxContainer) {
            headerCheckboxContainer.innerHTML = '';
            
            if (tienePermisoEliminarMasivo) {
                const checkInput = document.createElement('input');
                checkInput.type = 'checkbox';
                checkInput.id = 'check-all-products';
                checkInput.title = 'Seleccionar todos';
                checkInput.style.cursor = 'pointer';
                checkInput.style.width = '20px';
                checkInput.style.height = '20px';
                checkInput.style.verticalAlign = 'middle';
                checkInput.style.accentColor = 'var(--primary-color)';
                
                // Event listener - DOM está listo
                checkInput.addEventListener('change', (e) => {
                    const isChecked = e.target.checked;
                    const checkboxes = document.querySelectorAll('.row-checkbox');
                    checkboxes.forEach(cb => {
                        cb.checked = isChecked;
                    });
                    this.updateBulkDeleteButton();
                });
                
                headerCheckboxContainer.appendChild(checkInput);
            }
        }

        if (productos.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="15" style="text-align: center; padding: 40px; color: #6D6D80;">
                        No hay productos registrados
                    </td>
                </tr>
            `;
            return;
        }

        let totalCosto = 0;
        let totalPublico = 0;
        let totalMayorista = 0;

        const rows = productos.map(producto => {
            const categoria = this.categorias.find(c => c.id === producto.categoria);
            const stockStatus = this.getStockStatus(producto);
            const stockActual = this.getStockActual(producto);

            // Determinar qué mostrar según tipo de producto
            let precioCosto, precioPublico, precioMayorista;
            let utilidadPublicoTexto, utilidadMayoristaTexto;
            let esRango = false;

            if (producto.tipo === 'simple') {
                // Producto simple - mostrar precios normales
                const costo = producto.precio?.costo || 0;
                const publico = producto.precio?.publico || 0;
                const mayorista = producto.precio?.mayorista || 0;
                
                precioCosto = window.currencyFormatter ? window.currencyFormatter.format(costo) : '$' + costo.toFixed(2);
                precioPublico = window.currencyFormatter ? window.currencyFormatter.format(publico) : '$' + publico.toFixed(2);
                precioMayorista = window.currencyFormatter ? window.currencyFormatter.format(mayorista) : '$' + mayorista.toFixed(2);
                
                const utilidadPublico = publico - costo;
                const utilidadMayorista = mayorista - costo;
                
                utilidadPublicoTexto = window.currencyFormatter ? window.currencyFormatter.format(utilidadPublico) : '$' + utilidadPublico.toFixed(2);
                utilidadMayoristaTexto = window.currencyFormatter ? window.currencyFormatter.format(utilidadMayorista) : '$' + utilidadMayorista.toFixed(2);
            } else if (producto.tipo === 'variantes') {
                // Producto con variantes - mostrar "-" ya que las filas hijas tienen la info
                precioCosto = '-';
                precioPublico = '-';
                precioMayorista = '-';
                utilidadPublicoTexto = '-';
                utilidadMayoristaTexto = '-';
            } else if (producto.tipo === 'conversion') {
                // Producto con conversión - mostrar precio por unidad base
                const conversionesArray = Array.isArray(producto.conversiones) 
                    ? producto.conversiones 
                    : Object.values(producto.conversiones || {});
                
                if (conversionesArray.length > 0) {
                    const primeraConversion = conversionesArray[0];
                    const costoUnidad = (primeraConversion.precio?.costo || 0) / primeraConversion.cantidad;
                    const publicoUnidad = (primeraConversion.precio?.publico || 0) / primeraConversion.cantidad;
                    const mayoristaUnidad = (primeraConversion.precio?.mayorista || 0) / primeraConversion.cantidad;
                    
                    precioCosto = window.currencyFormatter ? window.currencyFormatter.format(costoUnidad) : '$' + costoUnidad.toFixed(2);
                    precioPublico = window.currencyFormatter ? window.currencyFormatter.format(publicoUnidad) : '$' + publicoUnidad.toFixed(2);
                    precioMayorista = window.currencyFormatter ? window.currencyFormatter.format(mayoristaUnidad) : '$' + mayoristaUnidad.toFixed(2);
                    
                    const utilidadPublico = publicoUnidad - costoUnidad;
                    const utilidadMayorista = mayoristaUnidad - costoUnidad;
                    
                    utilidadPublicoTexto = window.currencyFormatter ? window.currencyFormatter.format(utilidadPublico) : '$' + utilidadPublico.toFixed(2);
                    utilidadMayoristaTexto = window.currencyFormatter ? window.currencyFormatter.format(utilidadMayorista) : '$' + utilidadMayorista.toFixed(2);
                } else {
                    precioCosto = '$0.00';
                    precioPublico = '$0.00';
                    precioMayorista = '$0.00';
                    utilidadPublicoTexto = '$0.00';
                    utilidadMayoristaTexto = '$0.00';
                }
            }

            // Calcular subtotales REALES según tipo de producto
            const valoresReales = this.calcularValoresReales(producto);
            const subtotalCosto = valoresReales.subtotalCosto;

            totalCosto += subtotalCosto;
            totalPublico += subtotalCosto + valoresReales.utilidadPublico;
            totalMayorista += subtotalCosto + valoresReales.utilidadMayorista;

            // Convertir a array si viene como objeto
            const variantesArray = Array.isArray(producto.variantes) 
                ? producto.variantes 
                : Object.values(producto.variantes || {});

            const tieneVariantes = producto.tipo === 'variantes' && variantesArray.length > 0;
            const tieneOpciones = tieneVariantes && variantesArray.some(v => {
                const opcionesArray = Array.isArray(v?.opciones) 
                    ? v.opciones 
                    : Object.values(v?.opciones || {});
                return opcionesArray.length > 0;
            });

            const proveedor = this.proveedores.find(p => p.id === producto.proveedor);

            // Calcular porcentajes de ganancia (solo para productos simples y conversión)
            let porcentajePublico = 0;
            let porcentajeMayorista = 0;
            
            if (producto.tipo === 'simple') {
                const costo = producto.precio?.costo || 0;
                const publico = producto.precio?.publico || 0;
                const mayorista = producto.precio?.mayorista || 0;
                
                if (costo > 0) {
                    porcentajePublico = ((publico - costo) / costo) * 100;
                    porcentajeMayorista = ((mayorista - costo) / costo) * 100;
                }
            } else if (producto.tipo === 'conversion') {
                const conversionesArray = Array.isArray(producto.conversiones) 
                    ? producto.conversiones 
                    : Object.values(producto.conversiones || {});
                
                if (conversionesArray.length > 0) {
                    const primeraConversion = conversionesArray[0];
                    const costoUnidad = (primeraConversion.precio?.costo || 0) / primeraConversion.cantidad;
                    const publicoUnidad = (primeraConversion.precio?.publico || 0) / primeraConversion.cantidad;
                    const mayoristaUnidad = (primeraConversion.precio?.mayorista || 0) / primeraConversion.cantidad;
                    
                    if (costoUnidad > 0) {
                        porcentajePublico = ((publicoUnidad - costoUnidad) / costoUnidad) * 100;
                        porcentajeMayorista = ((mayoristaUnidad - costoUnidad) / costoUnidad) * 100;
                    }
                }
            }

            const mainRow = `
                <tr data-id="${producto.id}">
                    ${tienePermisoEliminarMasivo ? `
                    <td>
                        <input type="checkbox" class="row-checkbox" value="${producto.id}" onchange="inventarioModule.updateBulkDeleteButton()">
                    </td>
                    ` : ''}
                    <td>
                        ${tieneVariantes || tieneOpciones ? `<button class="btn-toggle" id="toggle-${producto.id}" onclick="inventarioModule.toggleProductDetails('${producto.id}')">▶</button>` : ''}
                    </td>
                    <td>
                        <div class="producto-info">
                            <div class="producto-avatar">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                                    <line x1="12" y1="22.08" x2="12" y2="12"></line>
                                </svg>
                            </div>
                            <div class="producto-nombre">${producto.nombre || 'Sin nombre'}</div>
                        </div>
                    </td>
                    <td>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <svg class="row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                                <line x1="7" y1="7" x2="7.01" y2="7"></line>
                            </svg>
                            <span>${categoria?.nombre || 'Sin categoría'}</span>
                        </div>
                    </td>
                    <td>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <svg class="row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="1" y="3" width="15" height="13"></rect>
                                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                                <circle cx="5.5" cy="18.5" r="2.5"></circle>
                                <circle cx="18.5" cy="18.5" r="2.5"></circle>
                            </svg>
                            <span>${proveedor?.nombre || 'Sin proveedor'}</span>
                        </div>
                    </td>
                    <td>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <svg class="row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                                <polyline points="2 17 12 22 22 17"></polyline>
                                <polyline points="2 12 12 17 22 12"></polyline>
                            </svg>
                            <span>${this.getTipoLabel(producto.tipo)}</span>
                        </div>
                    </td>
                    <td>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <svg class="row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="12" y1="1" x2="12" y2="23"></line>
                                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                            </svg>
                            <span>${precioCosto}</span>
                        </div>
                    </td>
                    <td>
                        <div class="precio-con-porcentaje">
                            ${producto.tipo !== 'variantes' ? `
                                <span class="precio-badge ${porcentajePublico >= 0 ? 'ganancia-positiva' : 'ganancia-negativa'}">
                                    ${porcentajePublico >= 0 ? '+' : ''}${porcentajePublico.toFixed(1)}%
                                </span>
                            ` : ''}
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <svg class="row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="9" cy="21" r="1"></circle>
                                    <circle cx="20" cy="21" r="1"></circle>
                                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                                </svg>
                                <span>${precioPublico}</span>
                            </div>
                        </div>
                    </td>
                    <td>
                        <div class="precio-con-porcentaje">
                            ${producto.tipo !== 'variantes' ? `
                                <span class="precio-badge ${porcentajeMayorista >= 0 ? 'ganancia-positiva' : 'ganancia-negativa'}">
                                    ${porcentajeMayorista >= 0 ? '+' : ''}${porcentajeMayorista.toFixed(1)}%
                                </span>
                            ` : ''}
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <svg class="row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="9" cy="7" r="4"></circle>
                                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                </svg>
                                <span>${precioMayorista}</span>
                            </div>
                        </div>
                    </td>
                    <td>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <svg class="row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="20" x2="18" y2="10"></line>
                                <line x1="12" y1="20" x2="12" y2="4"></line>
                                <line x1="6" y1="20" x2="6" y2="14"></line>
                            </svg>
                            <span>${stockActual}</span>
                        </div>
                    </td>
                    <td>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <svg class="row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="12" y1="1" x2="12" y2="23"></line>
                                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                            </svg>
                            <strong>${window.currencyFormatter ? window.currencyFormatter.format(subtotalCosto) : '$' + subtotalCosto.toFixed(2)}</strong>
                        </div>
                    </td>
                    <td style="color: #34C759;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <svg class="row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                            <span>${utilidadPublicoTexto}</span>
                        </div>
                    </td>
                    <td style="color: #007AFF;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <svg class="row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="12" y1="1" x2="12" y2="23"></line>
                                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                                <polyline points="20 17 22 15 20 13"></polyline>
                                <polyline points="4 7 2 9 4 11"></polyline>
                            </svg>
                            <span>${utilidadMayoristaTexto}</span>
                        </div>
                    </td>
                    <td>
                        ${producto.tipo === 'variantes' ? '<span style="color: #6D6D80;">-</span>' : `
                        <span class="estado-badge estado-${stockStatus.class}">
                            <svg class="badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                            ${stockStatus.label}
                        </span>
                        `}
                    </td>
                    <td>
                        <div class="acciones-producto">
                            ${tienePermisoEditar ? `
                            <button class="btn-accion btn-editar" onclick="inventarioModule.editProducto('${producto.id}')" title="Editar">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                            </button>
                            ` : ''}
                            ${tienePermisoEliminar ? `
                            <button class="btn-accion btn-eliminar" onclick="inventarioModule.deleteProducto('${producto.id}')" title="Eliminar">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                    <line x1="10" y1="11" x2="10" y2="17"></line>
                                    <line x1="14" y1="11" x2="14" y2="17"></line>
                                </svg>
                            </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;

            // Filas de detalles expandibles - cada variante/opción en su propia fila completa
            let detailsRows = '';
            if (tieneVariantes) {
                variantesArray.forEach((variante, vIdx) => {
                    const opcionesArray = Array.isArray(variante?.opciones) 
                        ? variante.opciones 
                        : Object.values(variante?.opciones || {});

                    const precioCostoVar = variante?.precio?.costo || 0;
                    const precioPublicoVar = variante?.precio?.publico || 0;
                    const precioMayoristaVar = variante?.precio?.mayorista || 0;

                    const porcentajePublicoVar = precioCostoVar > 0 ? ((precioPublicoVar - precioCostoVar) / precioCostoVar) * 100 : 0;
                    const porcentajeMayoristaVar = precioCostoVar > 0 ? ((precioMayoristaVar - precioCostoVar) / precioCostoVar) * 100 : 0;

                    if (opcionesArray.length > 0) {
                        opcionesArray.forEach((opcion, oIdx) => {
                            const stockOpcion = opcion.stock?.actual || 0;
                            const stockStatusOpcion = stockOpcion <= (variante.stock?.minimo || 5) ? 
                                { class: 'bajo', label: 'Stock Bajo' } : 
                                { class: 'normal', label: 'Disponible' };
                            
                            const subtotalCostoOpcion = precioCostoVar * stockOpcion;
                            const utilidadPublicoOpcion = (precioPublicoVar - precioCostoVar) * stockOpcion;
                            const utilidadMayoristaOpcion = (precioMayoristaVar - precioCostoVar) * stockOpcion;

                            detailsRows += `
                                <tr class="detail-row detail-row-${producto.id} hidden fila-opcion">
                                    <td></td>
                                    <td>
                                        <div class="producto-info">
                                            <div class="producto-avatar" style="opacity: 0.5; transform: scale(0.8);">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                    <circle cx="12" cy="12" r="10"></circle>
                                                    <line x1="12" y1="8" x2="12" y2="12"></line>
                                                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                                </svg>
                                            </div>
                                            <div class="producto-nombre" style="font-size: 0.95rem;">
                                                <div>${producto.nombre}</div>
                                                <div style="display: flex; align-items: center; gap: 6px; margin-top: 4px;">
                                                    <span class="badge-variante" style="font-size: 10px;">${variante.nombre}</span>
                                                    <span class="badge-opcion" style="font-size: 10px;">${opcion.nombre}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <div style="display: flex; align-items: center; gap: 8px;">
                                            <svg class="row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                                                <line x1="7" y1="7" x2="7.01" y2="7"></line>
                                            </svg>
                                            <span>${categoria?.nombre || 'Sin categoría'}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div style="display: flex; align-items: center; gap: 8px;">
                                            <svg class="row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                <rect x="1" y="3" width="15" height="13"></rect>
                                                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                                                <circle cx="5.5" cy="18.5" r="2.5"></circle>
                                                <circle cx="18.5" cy="18.5" r="2.5"></circle>
                                            </svg>
                                            <span>${proveedor?.nombre || 'Sin proveedor'}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div style="display: flex; align-items: center; gap: 8px;">
                                            <svg class="row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                                                <polyline points="2 17 12 22 22 17"></polyline>
                                                <polyline points="2 12 12 17 22 12"></polyline>
                                            </svg>
                                            <span style="font-size: 0.85rem;">Opción</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div style="display: flex; align-items: center; gap: 8px;">
                                            <svg class="row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                <line x1="12" y1="1" x2="12" y2="23"></line>
                                                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                                            </svg>
                                            <span>${window.currencyFormatter ? window.currencyFormatter.format(precioCostoVar) : '$' + precioCostoVar.toFixed(2)}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div class="precio-con-porcentaje">
                                            <span class="precio-badge ${porcentajePublicoVar >= 0 ? 'ganancia-positiva' : 'ganancia-negativa'}">
                                                ${porcentajePublicoVar >= 0 ? '+' : ''}${porcentajePublicoVar.toFixed(1)}%
                                            </span>
                                            <div style="display: flex; align-items: center; gap: 8px;">
                                                <svg class="row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                    <circle cx="9" cy="21" r="1"></circle>
                                                    <circle cx="20" cy="21" r="1"></circle>
                                                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                                                </svg>
                                                <span>${window.currencyFormatter ? window.currencyFormatter.format(precioPublicoVar) : '$' + precioPublicoVar.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <div class="precio-con-porcentaje">
                                            <span class="precio-badge ${porcentajeMayoristaVar >= 0 ? 'ganancia-positiva' : 'ganancia-negativa'}">
                                                ${porcentajeMayoristaVar >= 0 ? '+' : ''}${porcentajeMayoristaVar.toFixed(1)}%
                                            </span>
                                            <div style="display: flex; align-items: center; gap: 8px;">
                                                <svg class="row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                                    <circle cx="9" cy="7" r="4"></circle>
                                                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                                </svg>
                                                <span>${window.currencyFormatter ? window.currencyFormatter.format(precioMayoristaVar) : '$' + precioMayoristaVar.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <div style="display: flex; align-items: center; gap: 8px;">
                                            <svg class="row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                <line x1="18" y1="20" x2="18" y2="10"></line>
                                                <line x1="12" y1="20" x2="12" y2="4"></line>
                                                <line x1="6" y1="20" x2="6" y2="14"></line>
                                            </svg>
                                            <span>${stockOpcion}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div style="display: flex; align-items: center; gap: 8px;">
                                            <svg class="row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                <line x1="12" y1="1" x2="12" y2="23"></line>
                                                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                                            </svg>
                                            <strong>${window.currencyFormatter ? window.currencyFormatter.format(subtotalCostoOpcion) : '$' + subtotalCostoOpcion.toFixed(2)}</strong>
                                        </div>
                                    </td>
                                    <td style="color: #34C759;">
                                        <div style="display: flex; align-items: center; gap: 8px;">
                                            <svg class="row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                <polyline points="20 6 9 17 4 12"></polyline>
                                            </svg>
                                            <span>${window.currencyFormatter ? window.currencyFormatter.format(utilidadPublicoOpcion) : '$' + utilidadPublicoOpcion.toFixed(2)}</span>
                                        </div>
                                    </td>
                                    <td style="color: #007AFF;">
                                        <div style="display: flex; align-items: center; gap: 8px;">
                                            <svg class="row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                <line x1="12" y1="1" x2="12" y2="23"></line>
                                                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                                                <polyline points="20 17 22 15 20 13"></polyline>
                                                <polyline points="4 7 2 9 4 11"></polyline>
                                            </svg>
                                            <span>${window.currencyFormatter ? window.currencyFormatter.format(utilidadMayoristaOpcion) : '$' + utilidadMayoristaOpcion.toFixed(2)}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span class="estado-badge estado-${stockStatusOpcion.class}">
                                            <svg class="badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                <polyline points="20 6 9 17 4 12"></polyline>
                                            </svg>
                                            ${stockStatusOpcion.label}
                                        </span>
                                    </td>
                                    <td>
                                        <div class="acciones-producto">
                                            <button class="btn-accion btn-editar" onclick="inventarioModule.editProducto('${producto.id}')" title="Editar">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                </svg>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `;
                        });
                    } else {
                        const stockVar = variante.stock?.actual || 0;
                        const stockStatusVar = stockVar <= (variante.stock?.minimo || 5) ? 
                            { class: 'bajo', label: 'Stock Bajo' } : 
                            { class: 'normal', label: 'Disponible' };
                        
                        const subtotalCostoVar = precioCostoVar * stockVar;
                        const utilidadPublicoVar = (precioPublicoVar - precioCostoVar) * stockVar;
                        const utilidadMayoristaVar = (precioMayoristaVar - precioCostoVar) * stockVar;

                        detailsRows += `
                            <tr class="detail-row detail-row-${producto.id} hidden fila-variante">
                                <td></td>
                                <td>
                                    <div class="producto-info">
                                        <div class="producto-avatar" style="opacity: 0.5; transform: scale(0.8);">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                                                <polyline points="2 17 12 22 22 17"></polyline>
                                                <polyline points="2 12 12 17 22 12"></polyline>
                                            </svg>
                                        </div>
                                        <div class="producto-nombre" style="font-size: 0.95rem;">
                                            <div>${producto.nombre}</div>
                                            <div style="display: flex; align-items: center; gap: 6px; margin-top: 4px;">
                                                <span class="badge-variante" style="font-size: 10px;">${variante.nombre}</span>
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <svg class="row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                                            <line x1="7" y1="7" x2="7.01" y2="7"></line>
                                        </svg>
                                        <span>${categoria?.nombre || 'Sin categoría'}</span>
                                    </div>
                                </td>
                                <td>
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <svg class="row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <rect x="1" y="3" width="15" height="13"></rect>
                                            <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                                            <circle cx="5.5" cy="18.5" r="2.5"></circle>
                                            <circle cx="18.5" cy="18.5" r="2.5"></circle>
                                        </svg>
                                        <span>${proveedor?.nombre || 'Sin proveedor'}</span>
                                    </div>
                                </td>
                                <td>
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <svg class="row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                                            <polyline points="2 17 12 22 22 17"></polyline>
                                            <polyline points="2 12 12 17 22 12"></polyline>
                                        </svg>
                                        <span style="font-size: 0.85rem;">Variante</span>
                                    </div>
                                </td>
                                <td>
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <svg class="row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <line x1="12" y1="1" x2="12" y2="23"></line>
                                            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                                        </svg>
                                        <span>${window.currencyFormatter ? window.currencyFormatter.format(precioCostoVar) : '$' + precioCostoVar.toFixed(2)}</span>
                                    </div>
                                </td>
                                <td>
                                    <div class="precio-con-porcentaje">
                                        <span class="precio-badge ${porcentajePublicoVar >= 0 ? 'ganancia-positiva' : 'ganancia-negativa'}">
                                            ${porcentajePublicoVar >= 0 ? '+' : ''}${porcentajePublicoVar.toFixed(1)}%
                                        </span>
                                        <div style="display: flex; align-items: center; gap: 8px;">
                                            <svg class="row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                <circle cx="9" cy="21" r="1"></circle>
                                                <circle cx="20" cy="21" r="1"></circle>
                                                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                                            </svg>
                                            <span>${window.currencyFormatter ? window.currencyFormatter.format(precioPublicoVar) : '$' + precioPublicoVar.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <div class="precio-con-porcentaje">
                                        <span class="precio-badge ${porcentajeMayoristaVar >= 0 ? 'ganancia-positiva' : 'ganancia-negativa'}">
                                            ${porcentajeMayoristaVar >= 0 ? '+' : ''}${porcentajeMayoristaVar.toFixed(1)}%
                                        </span>
                                        <div style="display: flex; align-items: center; gap: 8px;">
                                            <svg class="row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                                <circle cx="9" cy="7" r="4"></circle>
                                                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                            </svg>
                                            <span>${window.currencyFormatter ? window.currencyFormatter.format(precioMayoristaVar) : '$' + precioMayoristaVar.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <svg class="row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <line x1="18" y1="20" x2="18" y2="10"></line>
                                            <line x1="12" y1="20" x2="12" y2="4"></line>
                                            <line x1="6" y1="20" x2="6" y2="14"></line>
                                        </svg>
                                        <span>${stockVar}</span>
                                    </div>
                                </td>
                                <td>
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <svg class="row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <line x1="12" y1="1" x2="12" y2="23"></line>
                                            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                                        </svg>
                                        <strong>${window.currencyFormatter ? window.currencyFormatter.format(subtotalCostoVar) : '$' + subtotalCostoVar.toFixed(2)}</strong>
                                    </div>
                                </td>
                                <td style="color: #34C759;">
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <svg class="row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <polyline points="20 6 9 17 4 12"></polyline>
                                        </svg>
                                        <span>${window.currencyFormatter ? window.currencyFormatter.format(utilidadPublicoVar) : '$' + utilidadPublicoVar.toFixed(2)}</span>
                                    </div>
                                </td>
                                <td style="color: #007AFF;">
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <svg class="row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <line x1="12" y1="1" x2="12" y2="23"></line>
                                            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                                            <polyline points="20 17 22 15 20 13"></polyline>
                                            <polyline points="4 7 2 9 4 11"></polyline>
                                        </svg>
                                        <span>${window.currencyFormatter ? window.currencyFormatter.format(utilidadMayoristaVar) : '$' + utilidadMayoristaVar.toFixed(2)}</span>
                                    </div>
                                </td>
                                <td>
                                    <span class="estado-badge estado-${stockStatusVar.class}">
                                        <svg class="badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <polyline points="20 6 9 17 4 12"></polyline>
                                        </svg>
                                        ${stockStatusVar.label}
                                    </span>
                                </td>
                                <td>
                                    <div class="acciones-producto">
                                        <button class="btn-accion btn-editar" onclick="inventarioModule.editProducto('${producto.id}')" title="Editar">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                            </svg>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `;
                    }
                });
            }

            return mainRow + detailsRows;
        }).join('');

        tbody.innerHTML = rows;
    }

    // Calcular valores reales considerando cada variante/opción
    calcularValoresReales(producto) {
        let subtotalCosto = 0;
        let subtotalPublico = 0;
        let subtotalMayorista = 0;

        if (producto.tipo === 'simple') {
            // Producto simple - cálculo directo
            const stock = producto.stock?.actual || 0;
            const costo = producto.precio?.costo || 0;
            const publico = producto.precio?.publico || 0;
            const mayorista = producto.precio?.mayorista || 0;

            subtotalCosto = costo * stock;
            subtotalPublico = publico * stock;
            subtotalMayorista = mayorista * stock;

        } else if (producto.tipo === 'variantes' && producto.variantes) {
            // Convertir a array si viene como objeto de Firebase
            const variantesArray = Array.isArray(producto.variantes) 
                ? producto.variantes 
                : Object.values(producto.variantes || {});

            // Producto con variantes - sumar cada variante individualmente
            variantesArray.forEach(variante => {
                const costo = variante?.precio?.costo || 0;
                const publico = variante?.precio?.publico || 0;
                const mayorista = variante?.precio?.mayorista || 0;

                if (variante?.opciones) {
                    const opcionesArray = Array.isArray(variante.opciones) 
                        ? variante.opciones 
                        : Object.values(variante.opciones || {});

                    // Variante con opciones - sumar stock de cada opción
                    opcionesArray.forEach(opcion => {
                        const stockOpcion = opcion?.stock?.actual || 0;
                        subtotalCosto += costo * stockOpcion;
                        subtotalPublico += publico * stockOpcion;
                        subtotalMayorista += mayorista * stockOpcion;
                    });
                } else {
                    // Variante sin opciones - stock directo
                    const stockVariante = variante?.stock?.actual || 0;
                    subtotalCosto += costo * stockVariante;
                    subtotalPublico += publico * stockVariante;
                    subtotalMayorista += mayorista * stockVariante;
                }
            });

        } else if (producto.tipo === 'conversion' && producto.conversiones) {
            const conversionesArray = Array.isArray(producto.conversiones) 
                ? producto.conversiones 
                : Object.values(producto.conversiones || {});

            if (conversionesArray.length > 0) {
                // Producto con conversión - usar primera conversión
                const conversion = conversionesArray[0];
                const stock = producto.stock?.actual || 0;
                const costo = conversion?.precio?.costo || 0;
                const publico = conversion?.precio?.publico || 0;
                const mayorista = conversion?.precio?.mayorista || 0;

                subtotalCosto = costo * stock;
                subtotalPublico = publico * stock;
                subtotalMayorista = mayorista * stock;
            }
        }

        return {
            subtotalCosto,
            utilidadPublico: subtotalPublico - subtotalCosto,
            utilidadMayorista: subtotalMayorista - subtotalCosto
        };
    }

    obtenerRangosUtilidades(producto) {
        const formatter = window.currencyFormatter;
        
        if (producto.tipo === 'simple') {
            // Producto simple - utilidad única
            const costo = producto.precio?.costo || 0;
            const publico = producto.precio?.publico || 0;
            const mayorista = producto.precio?.mayorista || 0;
            
            const utilidadPublico = publico - costo;
            const utilidadMayorista = mayorista - costo;
            
            return {
                publico: formatter ? formatter.format(utilidadPublico) : '$' + utilidadPublico.toFixed(2),
                mayorista: formatter ? formatter.format(utilidadMayorista) : '$' + utilidadMayorista.toFixed(2),
                esRango: false
            };
        } else if (producto.tipo === 'variantes' && producto.variantes) {
            // Producto con variantes - calcular rango de utilidades
            const variantesArray = Array.isArray(producto.variantes) 
                ? producto.variantes 
                : Object.values(producto.variantes || {});
            
            if (variantesArray.length === 0) {
                return {
                    publico: '$0.00',
                    mayorista: '$0.00',
                    esRango: false
                };
            }
            
            let utilidadPublicoMin = Infinity, utilidadPublicoMax = -Infinity;
            let utilidadMayoristaMin = Infinity, utilidadMayoristaMax = -Infinity;
            
            variantesArray.forEach(variante => {
                const costo = variante?.precio?.costo || 0;
                const publico = variante?.precio?.publico || 0;
                const mayorista = variante?.precio?.mayorista || 0;
                
                const utilidadPublico = publico - costo;
                const utilidadMayorista = mayorista - costo;
                
                utilidadPublicoMin = Math.min(utilidadPublicoMin, utilidadPublico);
                utilidadPublicoMax = Math.max(utilidadPublicoMax, utilidadPublico);
                utilidadMayoristaMin = Math.min(utilidadMayoristaMin, utilidadMayorista);
                utilidadMayoristaMax = Math.max(utilidadMayoristaMax, utilidadMayorista);
            });
            
            const esRango = utilidadPublicoMin !== utilidadPublicoMax || utilidadMayoristaMin !== utilidadMayoristaMax;
            
            if (esRango) {
                return {
                    publico: `${formatter ? formatter.format(utilidadPublicoMin) : '$' + utilidadPublicoMin.toFixed(2)} - ${formatter ? formatter.format(utilidadPublicoMax) : '$' + utilidadPublicoMax.toFixed(2)}`,
                    mayorista: `${formatter ? formatter.format(utilidadMayoristaMin) : '$' + utilidadMayoristaMin.toFixed(2)} - ${formatter ? formatter.format(utilidadMayoristaMax) : '$' + utilidadMayoristaMax.toFixed(2)}`,
                    esRango: true
                };
            } else {
                return {
                    publico: formatter ? formatter.format(utilidadPublicoMin) : '$' + utilidadPublicoMin.toFixed(2),
                    mayorista: formatter ? formatter.format(utilidadMayoristaMin) : '$' + utilidadMayoristaMin.toFixed(2),
                    esRango: false
                };
            }
        } else if (producto.tipo === 'conversion' && producto.conversiones) {
            // Producto con conversión - calcular rango de utilidades
            const conversionesArray = Array.isArray(producto.conversiones) 
                ? producto.conversiones 
                : Object.values(producto.conversiones || {});
            
            if (conversionesArray.length === 0) {
                return {
                    publico: '$0.00',
                    mayorista: '$0.00',
                    esRango: false
                };
            }
            
            let utilidadPublicoMin = Infinity, utilidadPublicoMax = -Infinity;
            let utilidadMayoristaMin = Infinity, utilidadMayoristaMax = -Infinity;
            
            conversionesArray.forEach(conversion => {
                const costo = conversion?.precio?.costo || 0;
                const publico = conversion?.precio?.publico || 0;
                const mayorista = conversion?.precio?.mayorista || 0;
                
                const utilidadPublico = publico - costo;
                const utilidadMayorista = mayorista - costo;
                
                utilidadPublicoMin = Math.min(utilidadPublicoMin, utilidadPublico);
                utilidadPublicoMax = Math.max(utilidadPublicoMax, utilidadPublico);
                utilidadMayoristaMin = Math.min(utilidadMayoristaMin, utilidadMayorista);
                utilidadMayoristaMax = Math.max(utilidadMayoristaMax, utilidadMayorista);
            });
            
            const esRango = utilidadPublicoMin !== utilidadPublicoMax || utilidadMayoristaMin !== utilidadMayoristaMax;
            
            if (esRango) {
                return {
                    publico: `${formatter ? formatter.format(utilidadPublicoMin) : '$' + utilidadPublicoMin.toFixed(2)} - ${formatter ? formatter.format(utilidadPublicoMax) : '$' + utilidadPublicoMax.toFixed(2)}`,
                    mayorista: `${formatter ? formatter.format(utilidadMayoristaMin) : '$' + utilidadMayoristaMin.toFixed(2)} - ${formatter ? formatter.format(utilidadMayoristaMax) : '$' + utilidadMayoristaMax.toFixed(2)}`,
                    esRango: true
                };
            } else {
                return {
                    publico: formatter ? formatter.format(utilidadPublicoMin) : '$' + utilidadPublicoMin.toFixed(2),
                    mayorista: formatter ? formatter.format(utilidadMayoristaMin) : '$' + utilidadMayoristaMin.toFixed(2),
                    esRango: false
                };
            }
        }
        
        return {
            publico: '$0.00',
            mayorista: '$0.00',
            esRango: false
        };
    }

    obtenerRangosPrecios(producto) {
        const formatter = window.currencyFormatter;
        
        if (producto.tipo === 'simple') {
            // Producto simple - precio único
            const costo = producto.precio?.costo || 0;
            const publico = producto.precio?.publico || 0;
            const mayorista = producto.precio?.mayorista || 0;
            
            return {
                costo: formatter ? formatter.format(costo) : '$' + costo.toFixed(2),
                publico: formatter ? formatter.format(publico) : '$' + publico.toFixed(2),
                mayorista: formatter ? formatter.format(mayorista) : '$' + mayorista.toFixed(2),
                costoMin: costo,
                publicoMin: publico,
                mayoristaMin: mayorista,
                esRango: false
            };
        } else if (producto.tipo === 'variantes' && producto.variantes) {
            // Producto con variantes - obtener rango
            const variantesArray = Array.isArray(producto.variantes) 
                ? producto.variantes 
                : Object.values(producto.variantes || {});
            
            if (variantesArray.length === 0) {
                return {
                    costo: '$0.00',
                    publico: '$0.00',
                    mayorista: '$0.00',
                    costoMin: 0,
                    publicoMin: 0,
                    mayoristaMin: 0,
                    esRango: false
                };
            }
            
            let costoMin = Infinity, costoMax = -Infinity;
            let publicoMin = Infinity, publicoMax = -Infinity;
            let mayoristaMin = Infinity, mayoristaMax = -Infinity;
            
            variantesArray.forEach(variante => {
                const costo = variante?.precio?.costo || 0;
                const publico = variante?.precio?.publico || 0;
                const mayorista = variante?.precio?.mayorista || 0;
                
                costoMin = Math.min(costoMin, costo);
                costoMax = Math.max(costoMax, costo);
                publicoMin = Math.min(publicoMin, publico);
                publicoMax = Math.max(publicoMax, publico);
                mayoristaMin = Math.min(mayoristaMin, mayorista);
                mayoristaMax = Math.max(mayoristaMax, mayorista);
            });
            
            // Si todos los precios son iguales, no mostrar como rango
            const esRango = costoMin !== costoMax || publicoMin !== publicoMax || mayoristaMin !== mayoristaMax;
            
            if (esRango) {
                return {
                    costo: `${formatter ? formatter.format(costoMin) : '$' + costoMin.toFixed(2)} - ${formatter ? formatter.format(costoMax) : '$' + costoMax.toFixed(2)}`,
                    publico: `${formatter ? formatter.format(publicoMin) : '$' + publicoMin.toFixed(2)} - ${formatter ? formatter.format(publicoMax) : '$' + publicoMax.toFixed(2)}`,
                    mayorista: `${formatter ? formatter.format(mayoristaMin) : '$' + mayoristaMin.toFixed(2)} - ${formatter ? formatter.format(mayoristaMax) : '$' + mayoristaMax.toFixed(2)}`,
                    costoMin,
                    publicoMin,
                    mayoristaMin,
                    esRango: true
                };
            } else {
                return {
                    costo: formatter ? formatter.format(costoMin) : '$' + costoMin.toFixed(2),
                    publico: formatter ? formatter.format(publicoMin) : '$' + publicoMin.toFixed(2),
                    mayorista: formatter ? formatter.format(mayoristaMin) : '$' + mayoristaMin.toFixed(2),
                    costoMin,
                    publicoMin,
                    mayoristaMin,
                    esRango: false
                };
            }
        } else if (producto.tipo === 'conversion' && producto.conversiones) {
            // Producto con conversión - obtener rango
            const conversionesArray = Array.isArray(producto.conversiones) 
                ? producto.conversiones 
                : Object.values(producto.conversiones || {});
            
            if (conversionesArray.length === 0) {
                return {
                    costo: '$0.00',
                    publico: '$0.00',
                    mayorista: '$0.00',
                    costoMin: 0,
                    publicoMin: 0,
                    mayoristaMin: 0,
                    esRango: false
                };
            }
            
            let costoMin = Infinity, costoMax = -Infinity;
            let publicoMin = Infinity, publicoMax = -Infinity;
            let mayoristaMin = Infinity, mayoristaMax = -Infinity;
            
            conversionesArray.forEach(conversion => {
                const costo = conversion?.precio?.costo || 0;
                const publico = conversion?.precio?.publico || 0;
                const mayorista = conversion?.precio?.mayorista || 0;
                
                costoMin = Math.min(costoMin, costo);
                costoMax = Math.max(costoMax, costo);
                publicoMin = Math.min(publicoMin, publico);
                publicoMax = Math.max(publicoMax, publico);
                mayoristaMin = Math.min(mayoristaMin, mayorista);
                mayoristaMax = Math.max(mayoristaMax, mayorista);
            });
            
            const esRango = costoMin !== costoMax || publicoMin !== publicoMax || mayoristaMin !== mayoristaMax;
            
            if (esRango) {
                return {
                    costo: `${formatter ? formatter.format(costoMin) : '$' + costoMin.toFixed(2)} - ${formatter ? formatter.format(costoMax) : '$' + costoMax.toFixed(2)}`,
                    publico: `${formatter ? formatter.format(publicoMin) : '$' + publicoMin.toFixed(2)} - ${formatter ? formatter.format(publicoMax) : '$' + publicoMax.toFixed(2)}`,
                    mayorista: `${formatter ? formatter.format(mayoristaMin) : '$' + mayoristaMin.toFixed(2)} - ${formatter ? formatter.format(mayoristaMax) : '$' + mayoristaMax.toFixed(2)}`,
                    costoMin,
                    publicoMin,
                    mayoristaMin,
                    esRango: true
                };
            } else {
                return {
                    costo: formatter ? formatter.format(costoMin) : '$' + costoMin.toFixed(2),
                    publico: formatter ? formatter.format(publicoMin) : '$' + publicoMin.toFixed(2),
                    mayorista: formatter ? formatter.format(mayoristaMin) : '$' + mayoristaMin.toFixed(2),
                    costoMin,
                    publicoMin,
                    mayoristaMin,
                    esRango: false
                };
            }
        }
        
        return {
            costo: '$0.00',
            publico: '$0.00',
            mayorista: '$0.00',
            costoMin: 0,
            publicoMin: 0,
            mayoristaMin: 0,
            esRango: false
        };
    }

    getPrecioCosto(producto) {
        if (producto.tipo === 'simple') {
            return producto.precio?.costo || 0;
        } else if (producto.tipo === 'variantes' && producto.variantes) {
            const variantesArray = Array.isArray(producto.variantes) 
                ? producto.variantes 
                : Object.values(producto.variantes || {});
            if (variantesArray.length > 0) {
                return variantesArray[0]?.precio?.costo || 0;
            }
        } else if (producto.tipo === 'conversion' && producto.conversiones) {
            const conversionesArray = Array.isArray(producto.conversiones) 
                ? producto.conversiones 
                : Object.values(producto.conversiones || {});
            if (conversionesArray.length > 0) {
                return conversionesArray[0]?.precio?.costo || 0;
            }
        }
        return 0;
    }

    renderDashboardStats(productos = this.productos) {
        const statsContainer = document.getElementById('inventario-stats');
        if (!statsContainer) return;

        let totalProductosContado = 0;
        let valorInventario = 0;
        let valorPublico = 0;
        let valorMayorista = 0;
        let productosStockBajo = 0;

        productos.forEach(producto => {
            // Usar valores reales calculados por variante
            const valoresReales = this.calcularValoresReales(producto);
            valorInventario += valoresReales.subtotalCosto;
            valorPublico += valoresReales.subtotalCosto + valoresReales.utilidadPublico;
            valorMayorista += valoresReales.subtotalCosto + valoresReales.utilidadMayorista;

            // Contar variantes/opciones individuales
            if (producto.tipo === 'simple' || producto.tipo === 'conversion') {
                totalProductosContado++;
                const stockActual = producto.stock?.actual || 0;
                const stockMinimo = producto.stock?.minimo || 0;
                if (stockActual === 0 || (stockActual > 0 && stockActual <= stockMinimo)) {
                    productosStockBajo++;
                }
            } else if (producto.tipo === 'variantes') {
                const variantesArray = Array.isArray(producto.variantes) 
                    ? producto.variantes 
                    : Object.values(producto.variantes || {});

                variantesArray.forEach(variante => {
                    const stockMinimo = variante.stock?.minimo || 5;
                    
                    if (variante.opciones) {
                        const opcionesArray = Array.isArray(variante.opciones) 
                            ? variante.opciones 
                            : Object.values(variante.opciones || {});
                        
                        opcionesArray.forEach(opcion => {
                            totalProductosContado++;
                            const stockActual = opcion.stock?.actual || 0;
                            if (stockActual === 0 || (stockActual > 0 && stockActual <= stockMinimo)) {
                                productosStockBajo++;
                            }
                        });
                    } else {
                        totalProductosContado++;
                        const stockActual = variante.stock?.actual || 0;
                        if (stockActual === 0 || (stockActual > 0 && stockActual <= stockMinimo)) {
                            productosStockBajo++;
                        }
                    }
                });
            }
        });

        const utilidadPublico = valorPublico - valorInventario;
        const utilidadMayorista = valorMayorista - valorInventario;

        statsContainer.innerHTML = `
            <div class="stats-card" style="background: linear-gradient(135deg, #007AFF, #5856D6);">
                <h3>Valor Inventario</h3>
                <p class="stats-value">${window.currencyFormatter ? window.currencyFormatter.format(valorInventario) : '$' + valorInventario.toFixed(2)}</p>
                <span class="stats-label">${totalProductosContado} items totales</span>
            </div>
            <div class="stats-card" style="background: linear-gradient(135deg, #34C759, #30B84A);">
                <h3>Utilidad Público</h3>
                <p class="stats-value">${window.currencyFormatter ? window.currencyFormatter.format(utilidadPublico) : '$' + utilidadPublico.toFixed(2)}</p>
                <span class="stats-label">Valor: ${window.currencyFormatter ? window.currencyFormatter.format(valorPublico) : '$' + valorPublico.toFixed(2)}</span>
            </div>
            <div class="stats-card" style="background: linear-gradient(135deg, #5856D6, #AF52DE);">
                <h3>Utilidad Mayorista</h3>
                <p class="stats-value">${window.currencyFormatter ? window.currencyFormatter.format(utilidadMayorista) : '$' + utilidadMayorista.toFixed(2)}</p>
                <span class="stats-label">Valor: ${window.currencyFormatter ? window.currencyFormatter.format(valorMayorista) : '$' + valorMayorista.toFixed(2)}</span>
            </div>
            <div class="stats-card" style="background: linear-gradient(135deg, #FF9500, #FF8C00);">
                <h3>Alertas Stock</h3>
                <p class="stats-value">${productosStockBajo}</p>
                <span class="stats-label">Items en alerta</span>
            </div>
        `;
    }

    getPrecioPublico(producto) {
        if (producto.tipo === 'simple') {
            return producto.precio?.publico || 0;
        } else if (producto.tipo === 'variantes' && producto.variantes) {
            const variantesArray = Array.isArray(producto.variantes) 
                ? producto.variantes 
                : Object.values(producto.variantes || {});
            if (variantesArray.length > 0) {
                return variantesArray[0]?.precio?.publico || 0;
            }
        } else if (producto.tipo === 'conversion' && producto.conversiones) {
            const conversionesArray = Array.isArray(producto.conversiones) 
                ? producto.conversiones 
                : Object.values(producto.conversiones || {});
            if (conversionesArray.length > 0) {
                return conversionesArray[0]?.precio?.publico || 0;
            }
        }
        return 0;
    }

    getPrecioMayorista(producto) {
        if (producto.tipo === 'simple') {
            return producto.precio?.mayorista || 0;
        } else if (producto.tipo === 'variantes' && producto.variantes) {
            const variantesArray = Array.isArray(producto.variantes) 
                ? producto.variantes 
                : Object.values(producto.variantes || {});
            if (variantesArray.length > 0) {
                return variantesArray[0]?.precio?.mayorista || 0;
            }
        } else if (producto.tipo === 'conversion' && producto.conversiones) {
            const conversionesArray = Array.isArray(producto.conversiones) 
                ? producto.conversiones 
                : Object.values(producto.conversiones || {});
            if (conversionesArray.length > 0) {
                return conversionesArray[0]?.precio?.mayorista || 0;
            }
        }
        return 0;
    }

    getStockActual(producto) {
        if (producto.tipo === 'simple') {
            return producto.stock?.actual || 0;
        } else if (producto.tipo === 'variantes') {
            // Convertir a array si viene como objeto de Firebase
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
        return 0;
    }

    getStockStatus(producto) {
        const stockActual = this.getStockActual(producto);
        const stockMinimo = producto.stock?.minimo || producto.variantes?.[0]?.stock?.minimo || 0;

        if (stockActual === 0) {
            return { class: 'agotado', label: 'Agotado' };
        } else if (stockActual <= stockMinimo) {
            return { class: 'stock-bajo', label: 'Stock Bajo' };
        }
        return { class: 'activo', label: 'Disponible' };
    }

    getTipoLabel(tipo) {
        const labels = {
            'simple': 'Simple',
            'variantes': 'Variantes',
            'conversion': 'Conversión'
        };
        return labels[tipo] || 'Desconocido';
    }

    populateCategorias() {
        const select = document.getElementById('categoria');
        const filter = document.getElementById('filter-categoria');

        const options = this.categorias.map(cat => 
            `<option value="${cat.id}">${cat.nombre}</option>`
        ).join('');

        select.innerHTML = '<option value="">Seleccionar categoría</option>' + options;
        filter.innerHTML = '<option value="">Todas las categorías</option>' + options;
    }

    populateProveedores() {
        const select = document.getElementById('proveedor');
        const filter = document.getElementById('filter-proveedor');

        if (this.proveedores.length === 0) {
            select.innerHTML = '<option value="">No hay proveedores. Créalos primero en el módulo de Proveedores.</option>';
            filter.innerHTML = '<option value="">Todos los proveedores</option>';
            return;
        }

        const options = this.proveedores.map(prov => 
            `<option value="${prov.id}">${prov.nombre}</option>`
        ).join('');

        select.innerHTML = '<option value="">Seleccionar proveedor *</option>' + options;
        filter.innerHTML = '<option value="">Todos los proveedores</option>' + options;
    }

    openModal(producto = null) {
        if (producto) {
            const tienePermisoEditar = window.authSystem?.hasSubPermission('inventario', 'editarProducto') ?? true;
            if (!tienePermisoEditar) {
                this.showNotification('No tienes permiso para editar productos', 'error');
                return;
            }
        } else {
            const tienePermisoNuevo = window.authSystem?.hasSubPermission('inventario', 'nuevoProducto') ?? true;
            if (!tienePermisoNuevo) {
                this.showNotification('No tienes permiso para crear productos', 'error');
                return;
            }
        }

        this.editingProducto = producto;
        const modal = document.getElementById('modal-producto');
        const title = document.getElementById('modal-title');

        if (producto) {
            title.textContent = 'Editar Producto';
            this.loadProductoData(producto);
        } else {
            title.textContent = 'Nuevo Producto';
            this.resetForm();
        }

        this.showStep(1);
        
        if (modal) {
            // Reset completo: modal, wrapper y content
            modal.style.cssText = '';
            const wrapper = modal.querySelector('.modal-inventario-wrapper');
            const content = modal.querySelector('.modal-inventario-content');
            
            if (wrapper) wrapper.style.cssText = '';
            if (content) content.style.cssText = '';
            
            // Activar modal
            modal.classList.add('active');
            
            // Forzar reflow
            void modal.offsetHeight;
        }
    }

    loadProductoData(producto) {
        // Resetear formulario primero
        this.resetForm();

        // Paso 1: Seleccionar tipo de producto
        const tipoRadio = document.querySelector(`input[name="tipoProducto"][value="${producto.tipo}"]`);
        if (tipoRadio) {
            tipoRadio.checked = true;
            this.currentTipoProducto = producto.tipo;
        }

        // Paso 2: Información básica
        document.getElementById('nombre').value = producto.nombre || '';
        document.getElementById('codigo').value = producto.codigo || '';
        document.getElementById('categoria').value = producto.categoria || '';
        document.getElementById('proveedor').value = producto.proveedor || '';

        // Paso 3: Cargar datos según tipo
        if (producto.tipo === 'simple') {
            this.loadSimpleProductData(producto);
        } else if (producto.tipo === 'variantes') {
            this.loadVariantesProductData(producto);
        } else if (producto.tipo === 'conversion') {
            this.loadConversionProductData(producto);
        }

        // Ir directamente al paso 2 (información básica)
        this.showStep(2);
    }

    loadSimpleProductData(producto) {
        document.getElementById('precio-costo').value = producto.precio?.costo || 0;
        document.getElementById('precio-publico').value = producto.precio?.publico || 0;
        document.getElementById('precio-mayorista').value = producto.precio?.mayorista || 0;
        document.getElementById('stock-inicial').value = producto.stock?.actual || 0;
        document.getElementById('stock-minimo').value = producto.stock?.minimo || 0;

        // Calcular utilidad
        this.calcularUtilidad();
    }

    loadVariantesProductData(producto) {
        const container = document.getElementById('variantes-container');
        container.innerHTML = '';
        this.varianteCounter = 0; // CORRECCIÓN: Reiniciar contador al cargar datos

        if (producto.variantes && producto.variantes.length > 0) {
            const variantesArray = Array.isArray(producto.variantes) 
                ? producto.variantes 
                : Object.values(producto.variantes || {});
                
            variantesArray.forEach((variante, index) => {
                this.agregarVariante();

                // Cargar datos de la variante
                const nombreInput = document.querySelector(`input[name="variante_nombre_${index}"]`);
                if (nombreInput) nombreInput.value = variante.nombre || '';
                
                const codigoInput = document.querySelector(`input[name="variante_codigo_${index}"]`);
                if (codigoInput) codigoInput.value = variante.codigoBarras || '';
                
                const costoInput = document.querySelector(`input[name="variante_costo_${index}"]`);
                if (costoInput) costoInput.value = variante.precio?.costo || 0;
                
                const publicoInput = document.querySelector(`input[name="variante_publico_${index}"]`);
                if (publicoInput) publicoInput.value = variante.precio?.publico || 0;
                
                const mayoristaInput = document.querySelector(`input[name="variante_mayorista_${index}"]`);
                if (mayoristaInput) mayoristaInput.value = variante.precio?.mayorista || 0;
                
                const minimoInput = document.querySelector(`input[name="variante_minimo_${index}"]`);
                if (minimoInput) minimoInput.value = variante.stock?.minimo || 0;

                // Si tiene opciones
                if (variante.opciones && (Array.isArray(variante.opciones) ? variante.opciones.length > 0 : Object.keys(variante.opciones).length > 0)) {
                    const checkbox = document.querySelector(`input[name="variante_tiene_opciones_${index}"]`);
                    if (checkbox) {
                        checkbox.checked = true;
                        this.toggleOpcionesVariante(index);

                        const opcionesArray = Array.isArray(variante.opciones) 
                            ? variante.opciones 
                            : Object.values(variante.opciones || {});

                        // Cargar opciones
                        opcionesArray.forEach((opcion, opcionIndex) => {
                            // Solo agregar si no es la primera (que ya se agregó en toggleOpcionesVariante)
                            if (opcionIndex > 0) this.agregarOpcion(index);

                            const opNombreInput = document.querySelector(`input[name="variante_${index}_opcion_nombre_${opcionIndex}"]`);
                            if (opNombreInput) opNombreInput.value = opcion.nombre || '';
                            
                            const opCodigoInput = document.querySelector(`input[name="variante_${index}_opcion_codigo_${opcionIndex}"]`);
                            if (opCodigoInput) opCodigoInput.value = opcion.codigoBarras || '';
                            
                            const opStockInput = document.querySelector(`input[name="variante_${index}_opcion_stock_${opcionIndex}"]`);
                            if (opStockInput) opStockInput.value = opcion.stock?.actual || 0;
                        });
                    }
                } else {
                    // Sin opciones, solo stock
                    const stockInput = document.querySelector(`input[name="variante_stock_${index}"]`);
                    if (stockInput) stockInput.value = variante.stock?.actual || 0;
                }
            });
        }
    }

    loadConversionProductData(producto) {
        const container = document.getElementById('conversiones-container');
        container.innerHTML = '';
        this.conversionCounter = 0; // Reiniciar contador para la edición

        document.getElementById('unidad-base').value = producto.unidadBase || 'unidad';

        if (producto.conversiones) {
            const conversionesArray = Array.isArray(producto.conversiones) 
                ? producto.conversiones 
                : Object.values(producto.conversiones || {});
                
            conversionesArray.forEach((conversion, index) => {
                this.agregarConversion();

                const nombreInput = document.querySelector(`input[name="conversion_nombre_${index}"]`);
                const cantidadInput = document.querySelector(`input[name="conversion_cantidad_${index}"]`);
                const costoInput = document.querySelector(`input[name="conversion_costo_${index}"]`);
                const publicoInput = document.querySelector(`input[name="conversion_publico_${index}"]`);
                const mayoristaInput = document.querySelector(`input[name="conversion_mayorista_${index}"]`);

                if (nombreInput) nombreInput.value = conversion.tipo || '';
                if (cantidadInput) cantidadInput.value = conversion.cantidad || 1;
                if (costoInput) costoInput.value = conversion.precio?.costo || 0;
                if (publicoInput) publicoInput.value = conversion.precio?.publico || 0;
                if (mayoristaInput) mayoristaInput.value = conversion.precio?.mayorista || 0;
            });
        }

        document.getElementById('stock-inicial-conversion').value = producto.stock?.actual || 0;
        document.getElementById('stock-minimo-conversion').value = producto.stock?.minimo || 0;
    }

    closeModal() {
        const modal = document.getElementById('modal-producto');
        if (modal) {
            modal.classList.remove('active');
            this.resetForm();
        }
    }

    openCategoriasModal() {
        const tienePermiso = window.authSystem?.hasSubPermission('inventario', 'categorias') ?? true;
        if (!tienePermiso) {
            this.showNotification('No tienes permiso para gestionar categorías', 'error');
            return;
        }
        this.renderCategoriasList();
        const modal = document.getElementById('modal-categorias');
        if (modal) {
            // Reset completo
            modal.style.cssText = '';
            const wrapper = modal.querySelector('.modal-inventario-wrapper');
            const content = modal.querySelector('.modal-inventario-content');
            
            if (wrapper) wrapper.style.cssText = '';
            if (content) content.style.cssText = '';
            
            modal.classList.add('active');
            void modal.offsetHeight;
        }
    }

    closeCategoriasModal() {
        const modal = document.getElementById('modal-categorias');
        if (modal) {
            modal.classList.remove('active');
        }
    }

    renderCategoriasList() {
        const lista = document.getElementById('lista-categorias');
        lista.innerHTML = this.categorias.map(cat => `
            <li>
                <span>${cat.nombre}</span>
                <button class="btn-delete-categoria" onclick="inventarioModule.deleteCategoria('${cat.id}')">Eliminar</button>
            </li>
        `).join('');
    }

    async agregarCategoria() {
        const input = document.getElementById('nueva-categoria');
        const nombre = window.inputSanitizer ? window.inputSanitizer.sanitizeText(input.value.trim()) : input.value.trim();

        if (!nombre) {
            this.showNotification('Ingresa un nombre para la categoría', 'error');
            return;
        }

        try {
            const categoriaData = {
                nombre,
                metadata: {
                    createdAt: new Date(),
                    createdBy: window.authSystem?.currentUser?.uid || 'unknown'
                }
            };

            // Guardar en Firebase
            const docRef = await window.db.collection('categories').add(categoriaData);

            // Actualizar localmente para feedback inmediato
            this.categorias.push({ id: docRef.id, ...categoriaData });
            this.populateCategorias();
            this.renderCategoriasList();

            input.value = '';
            this.showNotification('Categoría agregada', 'success');
        } catch (error) {
            console.error('Error:', error);
            this.showNotification('Error al agregar categoría', 'error');
        }
    }

    async deleteCategoria(id) {
        if (!confirm('¿Eliminar esta categoría?')) return;

        this.showLoading();
        try {
            await window.db.collection('categories').doc(id).delete();
            await this.loadCategorias();
            this.populateCategorias();
            this.renderCategoriasList();
            this.showNotification('Categoría eliminada', 'success');
        } catch (error) {
            console.error('Error:', error);
            this.showNotification('Error al eliminar categoría', 'error');
        } finally {
            this.hideLoading();
        }
    }

    resetForm() {
        document.getElementById('form-producto').reset();
        this.varianteCounter = 0;
        this.conversionCounter = 0;
        this.currentTipoProducto = 'simple';
        document.getElementById('variantes-container').innerHTML = '';
        document.getElementById('conversiones-container').innerHTML = '';
    }

    showStep(step) {
        this.currentStep = step;
        document.querySelectorAll('.form-step').forEach(s => s.classList.add('hidden'));

        const steps = {
            1: 'step-tipo-producto',
            2: 'step-info-basica',
            3: this.currentTipoProducto === 'simple' ? 'step-simple' : 
               this.currentTipoProducto === 'variantes' ? 'step-variantes' : 'step-conversion'
        };

        document.getElementById(steps[step]).classList.remove('hidden');
    }

    nextStepFromTipo() {
        this.showStep(2);
    }

    nextStepFromInfo() {
        const nombre = document.getElementById('nombre').value.trim();
        const categoria = document.getElementById('categoria').value;
        const proveedor = document.getElementById('proveedor').value;

        if (!nombre || !categoria || !proveedor) {
            this.showNotification('Completa todos los campos obligatorios', 'error');
            return;
        }

        // CORRECCIÓN PROFESIONAL: Solo agregar variante/conversión inicial si el contenedor está realmente vacío
        // Y si NO estamos editando un producto (ya que la edición carga sus propias variantes)
        if (!this.editingProducto) {
            if (this.currentTipoProducto === 'variantes') {
                const container = document.getElementById('variantes-container');
                if (container && container.querySelectorAll('.variante-item').length === 0) {
                    this.agregarVariante();
                }
            } else if (this.currentTipoProducto === 'conversion') {
                const container = document.getElementById('conversiones-container');
                if (container && container.querySelectorAll('[data-conversion]').length === 0) {
                    this.agregarConversion();
                }
            }
        }

        this.showStep(3);
    }

    calcularUtilidad() {
        const costo = parseFloat(document.getElementById('precio-costo').value) || 0;
        const publico = parseFloat(document.getElementById('precio-publico').value) || 0;
        const mayorista = parseFloat(document.getElementById('precio-mayorista')?.value) || 0;

        const fmt = (val) => window.currencyFormatter
            ? window.currencyFormatter.format(val)
            : '$' + val.toFixed(2);

        // Utilidad público
        const utilidadPublico = publico - costo;
        const pctPublico = costo > 0 ? ((utilidadPublico / costo) * 100) : 0;
        const elPublico = document.getElementById('utilidad-publico');
        if (elPublico) {
            elPublico.textContent = `${fmt(utilidadPublico)} (${pctPublico.toFixed(1)}%)`;
            elPublico.style.color = utilidadPublico >= 0 ? '#34C759' : '#FF3B30';
        }

        // Utilidad mayorista
        const utilidadMayorista = mayorista - costo;
        const pctMayorista = costo > 0 ? ((utilidadMayorista / costo) * 100) : 0;
        const elMayorista = document.getElementById('utilidad-mayorista');
        if (elMayorista) {
            elMayorista.textContent = `${fmt(utilidadMayorista)} (${pctMayorista.toFixed(1)}%)`;
            elMayorista.style.color = utilidadMayorista >= 0 ? '#007AFF' : '#FF3B30';
        }
    }

    agregarVariante() {
        const container = document.getElementById('variantes-container');
        
        // CORRECCIÓN: Calcular índice basado en variantes existentes en el DOM
        const variantesExistentes = container.querySelectorAll('.variante-item[data-index]');
        let maxIndex = -1;
        variantesExistentes.forEach(v => {
            const idx = parseInt(v.getAttribute('data-index'), 10);
            if (!isNaN(idx) && idx > maxIndex) maxIndex = idx;
        });
        const index = maxIndex + 1;
        this.varianteCounter = index + 1; // Sincronizar contador

        const varianteHTML = `
            <div class="variante-item" data-index="${index}">
                <div class="variante-header">
                    <div class="variante-header-left">
                        <div class="variante-order-controls">
                            <button type="button" class="btn-move-variante btn-move-up" onclick="inventarioModule.moverVariante(${index}, 'up')" title="Subir variante">▲</button>
                            <button type="button" class="btn-move-variante btn-move-down" onclick="inventarioModule.moverVariante(${index}, 'down')" title="Bajar variante">▼</button>
                        </div>
                        <strong class="variante-label">Variante ${index + 1}</strong>
                    </div>
                    <button type="button" class="btn-remove-variante" onclick="inventarioModule.removeVariante(${index})">Eliminar</button>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Nombre de la Variante *</label>
                        <input type="text" name="variante_nombre_${index}" placeholder="Ej: 500ml, Talla M" required>
                    </div>
                    <div class="form-group">
                        <label>Código de Barras</label>
                        <input type="text" name="variante_codigo_${index}" placeholder="Ej: 7501234567891">
                        <small>Opcional</small>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Precio Costo *</label>
                        <input type="number" name="variante_costo_${index}" step="0.01" min="0" required>
                    </div>
                    <div class="form-group">
                        <label>Precio Público *</label>
                        <input type="number" name="variante_publico_${index}" step="0.01" min="0" required>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Precio Mayorista *</label>
                        <input type="number" name="variante_mayorista_${index}" step="0.01" min="0" required>
                    </div>
                    <div class="form-group">
                        <label>Stock Mínimo *</label>
                        <input type="number" name="variante_minimo_${index}" min="0" required>
                    </div>
                </div>

                <!-- Sección de Opciones (Opcional) -->
                <div class="opciones-section">
                    <div class="opciones-header">
                        <label>
                            <input type="checkbox" name="variante_tiene_opciones_${index}" onchange="inventarioModule.toggleOpcionesVariante(${index})">
                            Esta variante tiene opciones (sabores, colores, etc.)
                        </label>
                    </div>
                    <div id="opciones-wrapper-${index}" class="opciones-wrapper hidden">
                        <div id="opciones-container-${index}" class="opciones-container">
                            <!-- Las opciones se agregarán aquí -->
                        </div>
                        <button type="button" class="btn-add-opcion" onclick="inventarioModule.agregarOpcion(${index})">
                            ➕ Agregar Opción
                        </button>
                        <small style="display: block; margin-top: 8px; color: #6D6D80;">
                            Si agregas opciones, el stock se manejará por opción individual
                        </small>
                    </div>
                </div>

                <!-- Stock para variante sin opciones -->
                <div id="stock-variante-${index}" class="stock-variante-section">
                    <div class="form-group">
                        <label>Stock Inicial *</label>
                        <input type="number" name="variante_stock_${index}" min="0" required>
                    </div>
                </div>
            </div>
        `;

        container.insertAdjacentHTML('beforeend', varianteHTML);
        this.actualizarNumerosVariantes();
    }

    toggleOpcionesVariante(varianteIndex) {
        const checkbox = document.querySelector(`input[name="variante_tiene_opciones_${varianteIndex}"]`);
        const opcionesWrapper = document.getElementById(`opciones-wrapper-${varianteIndex}`);
        const stockVariante = document.getElementById(`stock-variante-${varianteIndex}`);
        const stockInput = document.querySelector(`input[name="variante_stock_${varianteIndex}"]`);

        if (checkbox.checked) {
            opcionesWrapper.classList.remove('hidden');
            stockVariante.classList.add('hidden');
            stockInput.removeAttribute('required');
            
            // CORRECCIÓN PROFESIONAL: Solo agregar opción si el contenedor está vacío
            const container = document.getElementById(`opciones-container-${varianteIndex}`);
            if (container && container.children.length === 0) {
                this.agregarOpcion(varianteIndex);
            }
        } else {
            opcionesWrapper.classList.add('hidden');
            stockVariante.classList.remove('hidden');
            stockInput.setAttribute('required', 'required');
            // Limpiar opciones
            document.getElementById(`opciones-container-${varianteIndex}`).innerHTML = '';
        }
    }

    removeVariante(index) {
        const variante = document.querySelector(`#variantes-container [data-index="${index}"]`);
        if (variante) {
            variante.remove();
            this.actualizarNumerosVariantes();
        }
    }

    moverVariante(index, direction) {
        const container = document.getElementById('variantes-container');
        const item = container.querySelector(`.variante-item[data-index="${index}"]`);
        if (!item) return;

        if (direction === 'up') {
            const prev = item.previousElementSibling;
            if (prev) container.insertBefore(item, prev);
        } else {
            const next = item.nextElementSibling;
            if (next) container.insertBefore(next, item);
        }

        this.actualizarNumerosVariantes();
    }

    actualizarNumerosVariantes() {
        const items = document.querySelectorAll('#variantes-container .variante-item');
        items.forEach((item, i) => {
            const label = item.querySelector('.variante-label');
            if (label) label.textContent = `Variante ${i + 1}`;

            const btnUp = item.querySelector('.btn-move-up');
            const btnDown = item.querySelector('.btn-move-down');
            if (btnUp) btnUp.disabled = i === 0;
            if (btnDown) btnDown.disabled = i === items.length - 1;
        });
    }

    agregarConversion() {
        const container = document.getElementById('conversiones-container');
        const index = this.conversionCounter++;
        const isBase = index === 0;

        const conversionHTML = `
            <div class="variante-item" data-conversion="${index}">
                <div class="variante-header">
                    <strong>${isBase ? '📦 Unidad Base (Principal)' : `Unidad de Venta Adicional ${index}`}</strong>
                    ${!isBase ? `<button type="button" class="btn-remove-variante" onclick="inventarioModule.removeConversion(${index})">Eliminar</button>` : ''}
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Nombre *</label>
                        <input type="text" name="conversion_nombre_${index}" placeholder="Ej: ${isBase ? 'Unidad' : 'Paquete'}" value="${isBase ? 'Unidad' : ''}" required>
                    </div>
                    <div class="form-group">
                        <label>Cantidad en unidad base *</label>
                        <input type="number" name="conversion_cantidad_${index}" min="1" placeholder="Ej: 1" value="${isBase ? '1' : ''}" ${isBase ? 'readonly' : ''} required>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group" style="${isBase ? '' : 'display:none;'}">
                        <label>Precio Costo *</label>
                        <input type="number" name="conversion_costo_${index}" step="0.01" min="0" ${isBase ? 'required' : ''} value="${isBase ? '' : '0'}">
                    </div>
                    <div class="form-group">
                        <label>Precio Público *</label>
                        <input type="number" name="conversion_publico_${index}" step="0.01" min="0" required>
                    </div>
                </div>
                <div class="form-group">
                    <label>Precio Mayorista *</label>
                    <input type="number" name="conversion_mayorista_${index}" step="0.01" min="0" required>
                </div>
                ${isBase ? '<small style="color: var(--primary-color); font-weight: 500;">Esta es la unidad mínima. El precio de costo se define aquí.</small>' : ''}
            </div>
        `;

        container.insertAdjacentHTML('beforeend', conversionHTML);
    }

    removeConversion(index) {
        const conversion = document.querySelector(`[data-conversion="${index}"]`);
        if (conversion) conversion.remove();
    }

    filterProductos(searchTerm) {
        this.applyFilters(); // Usar applyFilters para mantener todos los filtros sincronizados
    }

    applyFilters() {
        let filtered = this.productos;

        const categoria = document.getElementById('filter-categoria').value;
        const proveedor = document.getElementById('filter-proveedor').value;
        const tipo = document.getElementById('filter-tipo').value;
        const stock = document.getElementById('filter-stock').value;
        const searchTerm = document.getElementById('search-productos').value;

        if (categoria) {
            filtered = filtered.filter(p => p.categoria === categoria);
        }

        if (proveedor) {
            filtered = filtered.filter(p => p.proveedor === proveedor);
        }

        if (tipo) {
            filtered = filtered.filter(p => p.tipo === tipo);
        }

        if (stock === 'bajo') {
            filtered = filtered.filter(p => {
                return this.tieneStockBajo(p);
            });
        } else if (stock === 'agotado') {
            filtered = filtered.filter(p => {
                return this.tieneStockAgotado(p);
            });
        }

        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            filtered = filtered.filter(p => {
                const nombre = p.nombre?.toLowerCase() || '';
                return nombre.includes(search);
            });
        }

        this.renderProductos(filtered);
        this.renderDashboardStats(filtered); // Actualizar estadísticas con productos filtrados
    }

    // Verificar si un producto tiene stock bajo (considerando variantes individuales)
    tieneStockBajo(producto) {
        if (producto.tipo === 'simple') {
            const stockActual = producto.stock?.actual || 0;
            const stockMinimo = producto.stock?.minimo || 0;
            return stockActual > 0 && stockActual <= stockMinimo;
        } else if (producto.tipo === 'variantes') {
            const variantesArray = Array.isArray(producto.variantes) 
                ? producto.variantes 
                : Object.values(producto.variantes || {});

            // Verificar si al menos una variante/opción tiene stock bajo
            return variantesArray.some(variante => {
                const stockMinimo = variante.stock?.minimo || 5;
                
                if (variante.opciones) {
                    const opcionesArray = Array.isArray(variante.opciones) 
                        ? variante.opciones 
                        : Object.values(variante.opciones || {});
                    
                    return opcionesArray.some(opcion => {
                        const stockActual = opcion.stock?.actual || 0;
                        return stockActual > 0 && stockActual <= stockMinimo;
                    });
                } else {
                    const stockActual = variante.stock?.actual || 0;
                    return stockActual > 0 && stockActual <= stockMinimo;
                }
            });
        } else if (producto.tipo === 'conversion') {
            const stockActual = producto.stock?.actual || 0;
            const stockMinimo = producto.stock?.minimo || 0;
            return stockActual > 0 && stockActual <= stockMinimo;
        }
        return false;
    }

    // Verificar si un producto está agotado (considerando variantes individuales)
    tieneStockAgotado(producto) {
        if (producto.tipo === 'simple') {
            return (producto.stock?.actual || 0) === 0;
        } else if (producto.tipo === 'variantes') {
            const variantesArray = Array.isArray(producto.variantes) 
                ? producto.variantes 
                : Object.values(producto.variantes || {});

            // Verificar si al menos una variante/opción está agotada
            return variantesArray.some(variante => {
                if (variante.opciones) {
                    const opcionesArray = Array.isArray(variante.opciones) 
                        ? variante.opciones 
                        : Object.values(variante.opciones || {});
                    
                    return opcionesArray.some(opcion => (opcion.stock?.actual || 0) === 0);
                } else {
                    return (variante.stock?.actual || 0) === 0;
                }
            });
        } else if (producto.tipo === 'conversion') {
            return (producto.stock?.actual || 0) === 0;
        }
        return false;
    }

    async editProducto(id) {
        const producto = this.productos.find(p => p.id === id);
        if (producto) {
            this.openModal(producto);
        }
    }

    async deleteProducto(id) {
        if (this.isProcessing) return;

        // CORRECCIÓN DE SEGURIDAD: Solo el administrador puede eliminar productos
        const userRole = window.authSystem?.currentUser?.rol;
        if (userRole !== 'administrador') {
            this.showNotification('🚫 Error de Seguridad: Solo el administrador principal puede eliminar productos permanentemente.', 'error');
            return;
        }

        const tienePermiso = window.authSystem?.hasSubPermission('inventario', 'eliminarProducto') ?? true;
        if (!tienePermiso) {
            this.showNotification('No tienes permiso para eliminar productos', 'error');
            return;
        }

        if (!confirm('¿Eliminar este producto? Esta acción es irreversible.')) return;

        this.showLoading();
        try {
            await window.db.collection('products').doc(id).delete();
            
            this.productos = this.productos.filter(p => p.id !== id);
            
            if (window.cacheManager && typeof window.cacheManager.invalidate === 'function') {
                window.cacheManager.invalidate('productos_cache');
            }
            
            this.renderProductos();
            this.renderDashboardStats();
            this.applyFilters();
            
            this.showNotification('Producto eliminado correctamente', 'success');
        } catch (error) {
            console.error('❌ Error al eliminar:', error);
            this.showNotification('Error técnico al eliminar: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async deleteProductosMasivo(ids) {
        if (!ids || ids.length === 0) return;
        
        // CORRECCIÓN DE SEGURIDAD: Solo el administrador puede eliminar productos masivamente
        const userRole = window.authSystem?.currentUser?.rol;
        if (userRole !== 'administrador') {
            this.showNotification('🚫 Error de Seguridad: La eliminación masiva está restringida solo para el administrador.', 'error');
            return;
        }

        const tienePermiso = window.authSystem?.hasSubPermission('inventario', 'eliminarMasivo') ?? true;
        if (!tienePermiso) {
            this.showNotification('No tienes permiso para realizar eliminación masiva de productos', 'error');
            return;
        }

        if (!confirm(`¿Estás seguro de eliminar ${ids.length} productos seleccionados? Esta acción no se puede deshacer.`)) return;

        this.showLoading();
        try {
            const db = window.db;
            const batch = db.batch();
            
            ids.forEach(id => {
                const docRef = db.collection('products').doc(id);
                batch.delete(docRef);
            });

            await batch.commit();

            // 🚀 Actualización inmediata del estado local
            this.productos = this.productos.filter(p => !ids.includes(p.id));

            // 🛠️ CORRECCIÓN: El método correcto es invalidate(), no delete()
            if (window.cacheManager && typeof window.cacheManager.invalidate === 'function') {
                window.cacheManager.invalidate('productos_cache');
            }

            this.renderProductos();
            this.renderDashboardStats();
            this.applyFilters();
            
            this.showNotification(`${ids.length} productos eliminados correctamente`, 'success');
            
            const checkAll = document.getElementById('check-all-products');
            if (checkAll) checkAll.checked = false;
            
            this.updateBulkDeleteButton();
            
        } catch (error) {
            console.error('Error en eliminación masiva:', error);
            this.showNotification('Error al eliminar algunos productos: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    toggleSelectAll(checkbox) {
        const allCheckboxes = document.querySelectorAll('.row-checkbox');
        allCheckboxes.forEach(cb => {
            cb.checked = checkbox.checked;
        });
        this.updateBulkDeleteButton();
    }

    updateBulkDeleteButton() {
        const checked = document.querySelectorAll('.row-checkbox:checked');
        const checkAll = document.getElementById('check-all-products');
        const allCheckboxes = document.querySelectorAll('.row-checkbox');
        
        // Actualizar estado del checkbox "seleccionar todo"
        if (checkAll) {
            checkAll.checked = checked.length === allCheckboxes.length && allCheckboxes.length > 0;
            checkAll.indeterminate = checked.length > 0 && checked.length < allCheckboxes.length;
        }
        
        let btnBulk = document.getElementById('btn-bulk-delete');
        
        if (checked.length > 0) {
            if (!btnBulk) {
                btnBulk = document.createElement('button');
                btnBulk.id = 'btn-bulk-delete';
                btnBulk.className = 'btn-bulk-delete-ios';
                btnBulk.innerHTML = `
                    <div class="bulk-delete-content">
                        <div class="bulk-delete-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </div>
                        <div class="bulk-delete-text">
                            <span class="bulk-delete-label">Eliminar Selección</span>
                            <span class="bulk-delete-count"><span id="bulk-count">0</span> productos</span>
                        </div>
                    </div>
                `;
                btnBulk.addEventListener('click', () => {
                    const ids = Array.from(document.querySelectorAll('.row-checkbox:checked')).map(cb => cb.value);
                    this.deleteProductosMasivo(ids);
                });
                document.body.appendChild(btnBulk);

                // Estilos inline para asegurar coherencia iOS
                const style = document.createElement('style');
                style.id = 'bulk-delete-styles';
                style.textContent = `
                    .btn-bulk-delete-ios {
                        position: fixed;
                        bottom: 180px;
                        right: 24px;
                        z-index: 9999;
                        background: #FF3B30;
                        color: white;
                        border: none;
                        padding: 12px 20px;
                        border-radius: 16px;
                        box-shadow: 0 8px 24px rgba(255, 59, 48, 0.4);
                        cursor: pointer;
                        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                        animation: bulkPopIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                        display: flex;
                        align-items: center;
                    }
                    .btn-bulk-delete-ios:hover {
                        transform: translateY(-4px) scale(1.02);
                        box-shadow: 0 12px 30px rgba(255, 59, 48, 0.5);
                        background: #FF453A;
                    }
                    .btn-bulk-delete-ios:active {
                        transform: scale(0.96);
                    }
                    .bulk-delete-content {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                    }
                    .bulk-delete-icon {
                        width: 36px;
                        height: 36px;
                        background: rgba(255,255,255,0.2);
                        border-radius: 10px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    .bulk-delete-icon svg { width: 20px; height: 20px; }
                    .bulk-delete-text {
                        display: flex;
                        direction: ltr;
                        flex-direction: column;
                        align-items: flex-start;
                        line-height: 1.2;
                    }
                    .bulk-delete-label {
                        font-size: 14px;
                        font-weight: 700;
                        letter-spacing: -0.2px;
                    }
                    .bulk-delete-count {
                        font-size: 11px;
                        opacity: 0.9;
                        font-weight: 500;
                    }
                    @keyframes bulkPopIn {
                        from { opacity: 0; transform: translateY(40px) scale(0.8); }
                        to { opacity: 1; transform: translateY(0) scale(1); }
                    }
                `;
                if (!document.getElementById('bulk-delete-styles')) {
                    document.head.appendChild(style);
                }
            }
            document.getElementById('bulk-count').textContent = checked.length;
        } else if (btnBulk) {
            btnBulk.classList.add('pop-out');
            setTimeout(() => btnBulk.remove(), 300);
        }
    }

    showLoading() {
        this.isProcessing = true;
        const btnSave = document.querySelector('.btn-save');
        if (btnSave) {
            btnSave.disabled = true;
            btnSave.dataset.originalText = btnSave.textContent;
            btnSave.textContent = this.editingProducto ? 'Editando...' : 'Guardando...';
        }
        document.getElementById('loading-overlay-inventario').classList.add('active');
    }

    hideLoading() {
        this.isProcessing = false;
        const btnSave = document.querySelector('.btn-save');
        if (btnSave) {
            btnSave.disabled = false;
            if (btnSave.dataset.originalText) {
                btnSave.textContent = btnSave.dataset.originalText;
            }
        }
        document.getElementById('loading-overlay-inventario').classList.remove('active');
    }

    setupTableScrollIndicator() {
        // Funcionalidad removida - ya no se necesita el indicador
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
                <span class="notification-message">${message}</span>
                <button class="notification-close">✕</button>
            </div>
        `;

        document.body.appendChild(notification);

        notification.querySelector('.notification-close').addEventListener('click', () => notification.remove());
        setTimeout(() => notification.remove(), 5000);
    }

    destroy() {
        this.closeModal();
        this.closeCategoriasModal();

        // Eliminar todos los event listeners del DOM registrados por este módulo
        if (this._listenerAbortController) {
            this._listenerAbortController.abort();
            this._listenerAbortController = null;
        }

        // Detener listeners en tiempo real
        if (window.realtimeSync) {
            window.realtimeSync.stopModuleListeners(this.moduleId);
        }

        // Asegurar que la guardia quede liberada
        this.isProcessing = false;

        console.log(`Módulo ${this.moduleId} descargado`);
    }
}

function loadInventarioModule() {
    // Destruir instancia anterior para limpiar sus event listeners del DOM
    if (window.inventarioModule && typeof window.inventarioModule.destroy === 'function') {
        window.inventarioModule.destroy();
    }
    window.inventarioModule = new InventarioModule();
}

window.loadInventarioModule = loadInventarioModule;