
// Módulo de Simulación de Pedidos
if (typeof SimulacionPedidosModule === 'undefined') {
    window.SimulacionPedidosModule = class SimulacionPedidosModule {
        constructor() {
        this.proveedores = [];
        this.productos = [];
        this.productosFiltrados = [];
        this.pedidoActual = new Map();
        this.proveedorSeleccionado = null;
        this.moduleId = 'simulacion-pedidos';

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            setTimeout(() => this.init(), 100);
        }
    }

    async init() {
        console.log('📦 Inicializando simulación de pedidos...');
        this.setupEventListeners();
        
        try {
            // Cargar productos primero
            await this.cargarProductos();
            console.log(`✅ ${this.productos.length} productos cargados`);
            
            // Luego cargar proveedores basados en productos
            await this.cargarProveedoresDesdeProductos();
            console.log(`✅ ${this.proveedores.length} proveedores encontrados`);
            
            // Renderizar proveedores en el selector
            this.renderProveedores();
            
            console.log('✅ Módulo listo');
        } catch (error) {
            console.error('❌ Error en inicialización:', error);
            this.showNotification('Error al cargar el módulo', 'error');
        }
    }

    setupEventListeners() {
        const selectProveedor = document.getElementById('select-proveedor');
        if (selectProveedor) {
            selectProveedor.addEventListener('change', (e) => {
                this.seleccionarProveedor(e.target.value);
            });
        }

        const btnLimpiar = document.getElementById('btn-limpiar-simulacion');
        if (btnLimpiar) {
            btnLimpiar.addEventListener('click', () => this.limpiarSimulacion());
        }

        const btnExportar = document.getElementById('btn-exportar-simulacion');
        if (btnExportar) {
            btnExportar.addEventListener('click', () => this.exportarPDF());
        }
    }

    async cargarProductos() {
        try {
            console.log('🔄 Cargando productos...');
            const snapshot = await window.db.collection('products').get();
            this.productos = [];
            snapshot.forEach(doc => {
                this.productos.push({ id: doc.id, ...doc.data() });
            });
            console.log(`✅ ${this.productos.length} productos cargados`);
        } catch (error) {
            console.error('❌ Error al cargar productos:', error);
        }
    }

    async cargarProveedoresDesdeProductos() {
        try {
            console.log('🔄 Extrayendo proveedores de productos...');
            console.log(`📊 Total de productos: ${this.productos.length}`);
            
            if (this.productos.length === 0) {
                console.warn('⚠️ No hay productos en el inventario');
                this.showNotification('No hay productos en el inventario. Primero crea productos con proveedores.', 'warning');
                this.proveedores = [];
                return;
            }
            
            // Debug detallado de los productos
            console.log('🔍 Análisis completo de productos:');
            this.productos.forEach((p, index) => {
                console.log(`  Producto ${index + 1}: "${p.nombre}"`, {
                    proveedor: p.proveedor,
                    proveedorNombre: p.proveedorNombre,
                    tipoProveedor: typeof p.proveedor,
                    tieneProveedor: !!p.proveedor
                });
            });
            
            // Obtener IDs únicos de proveedores
            const proveedorIds = [...new Set(
                this.productos
                    .map(p => p.proveedor)
                    .filter(id => id && id.trim() !== '')
            )];
            
            console.log(`📊 IDs únicos encontrados: ${proveedorIds.length}`);
            console.log(`📋 IDs: ${JSON.stringify(proveedorIds)}`);
            
            if (proveedorIds.length === 0) {
                console.warn('⚠️ NINGÚN producto tiene proveedor asignado');
                this.showNotification('No hay productos con proveedores. Edita tus productos y asígnales un proveedor.', 'warning');
                this.proveedores = [];
                return;
            }

            // Cargar proveedores desde Firebase (buscar en ambas colecciones)
            this.proveedores = [];
            let proveedoresEncontrados = 0;
            let proveedoresNoEncontrados = 0;
            
            for (const id of proveedorIds) {
                console.log(`🔄 Buscando proveedor ID: ${id}`);
                try {
                    // Intentar primero en 'providers' (inglés)
                    let doc = await window.db.collection('providers').doc(id).get();
                    
                    // Si no existe, intentar en 'proveedores' (español)
                    if (!doc.exists) {
                        console.log(`⚠️ No encontrado en 'providers', buscando en 'proveedores'...`);
                        doc = await window.db.collection('proveedores').doc(id).get();
                    }
                    
                    if (doc.exists) {
                        const proveedorData = doc.data();
                        this.proveedores.push({ 
                            id: doc.id, 
                            nombre: proveedorData.nombre,
                            ...proveedorData 
                        });
                        proveedoresEncontrados++;
                        console.log(`✅ Proveedor cargado: ${proveedorData.nombre}`);
                    } else {
                        proveedoresNoEncontrados++;
                        console.warn(`❌ Proveedor ID ${id} no existe en ninguna colección`);
                    }
                } catch (error) {
                    console.error(`❌ Error al cargar proveedor ${id}:`, error);
                }
            }

            console.log(`✅ Resumen: ${proveedoresEncontrados} encontrados, ${proveedoresNoEncontrados} no encontrados`);
            
            if (this.proveedores.length === 0) {
                this.showNotification('Los proveedores asignados a los productos no existen en la base de datos', 'error');
            } else {
                console.log(`✅ ${this.proveedores.length} proveedores disponibles:`, 
                    this.proveedores.map(p => ({ id: p.id, nombre: p.nombre }))
                );
            }
        } catch (error) {
            console.error('❌ Error al cargar proveedores:', error);
            this.showNotification('Error al cargar proveedores: ' + error.message, 'error');
        }
    }

    renderProveedores() {
        console.log('🎨 Renderizando proveedores en selector...');
        const select = document.getElementById('select-proveedor');
        if (!select) {
            console.error('❌ Selector #select-proveedor no encontrado en el DOM');
            return;
        }

        console.log(`📋 Proveedores a renderizar: ${this.proveedores.length}`);
        select.innerHTML = '<option value="">-- Seleccione un proveedor --</option>';

        if (this.proveedores.length === 0) {
            console.warn('⚠️ No hay proveedores para mostrar');
            select.innerHTML += '<option value="" disabled>No hay proveedores disponibles</option>';
            return;
        }

        this.proveedores.forEach((proveedor, index) => {
            console.log(`➕ Agregando proveedor ${index + 1}: ${proveedor.nombre} (ID: ${proveedor.id})`);
            const option = document.createElement('option');
            option.value = proveedor.id;
            option.textContent = proveedor.nombre;
            select.appendChild(option);
        });

        console.log(`✅ ${this.proveedores.length} proveedores renderizados en selector`);
        console.log(`🔍 Opciones en el selector:`, select.options.length);
    }

    seleccionarProveedor(proveedorId) {
        console.log('🔍 Seleccionando proveedor:', proveedorId);
        
        if (!proveedorId) {
            this.limpiarSimulacion();
            return;
        }

        this.proveedorSeleccionado = this.proveedores.find(p => p.id === proveedorId);

        if (!this.proveedorSeleccionado) {
            console.error('❌ Proveedor no encontrado en la lista');
            this.showNotification('Proveedor no encontrado', 'error');
            return;
        }

        console.log('✅ Proveedor seleccionado:', this.proveedorSeleccionado.nombre);
        console.log('📦 Filtrando productos para proveedor ID:', proveedorId);
        
        this.productosFiltrados = this.productos.filter(p => p.proveedor === proveedorId);
        
        console.log(`📊 Productos filtrados: ${this.productosFiltrados.length}`);
        
        if (this.productosFiltrados.length > 0) {
            console.log('📋 Productos encontrados:');
            this.productosFiltrados.forEach((p, i) => {
                console.log(`  ${i + 1}. ${p.nombre} (Tipo: ${p.tipo})`);
            });
        }

        if (this.productosFiltrados.length === 0) {
            console.warn('⚠️ No se encontraron productos para este proveedor');
            this.showNotification('Este proveedor no tiene productos asignados', 'warning');
            this.mostrarEmptyState();
            return;
        }

        this.pedidoActual.clear();
        this.renderTablaProductos();
        this.actualizarResumen();
        this.habilitarBotones();
    }

    renderTablaProductos() {
        const emptyState = document.getElementById('empty-state');
        const table = document.getElementById('productos-table');
        const tbody = document.getElementById('productos-table-body');
        const footer = document.getElementById('productos-table-footer');

        if (!tbody) return;

        if (emptyState) emptyState.classList.add('hidden');
        if (table) table.classList.remove('hidden');
        if (footer) footer.classList.remove('hidden');

        let rows = [];

        this.productosFiltrados.forEach(producto => {
            if (producto.tipo === 'simple') {
                // Producto simple - una sola fila
                const stockActual = producto.stock?.actual || 0;
                const precioCosto = producto.precio?.costo || 0;
                const stockClass = stockActual <= (producto.stock?.minimo || 5) ? 'stock-bajo' : 'stock-normal';

                rows.push(`
                    <tr data-producto-id="${producto.id}">
                        <td>
                            <div class="producto-nombre">${producto.nombre}</div>
                        </td>
                        <td>
                            <span class="producto-tipo">Simple</span>
                        </td>
                        <td>
                            <span class="stock-value ${stockClass}">${stockActual}</span>
                        </td>
                        <td>
                            <span class="precio-costo">${window.currencyFormatter ? window.currencyFormatter.format(precioCosto) : '$' + precioCosto.toFixed(2)}</span>
                        </td>
                        <td>
                            <input 
                                type="number" 
                                class="cantidad-input" 
                                min="0" 
                                step="1" 
                                value="0"
                                data-producto-id="${producto.id}"
                                data-precio="${precioCosto}"
                                onchange="simulacionPedidosModule.actualizarCantidad('${producto.id}', this.value, ${precioCosto})"
                            />
                        </td>
                        <td>
                            <span class="subtotal-value" id="subtotal-${producto.id}">$0.00</span>
                        </td>
                    </tr>
                `);

            } else if (producto.tipo === 'variantes') {
                // Producto con variantes - desglosar cada variante y opción
                const variantesArray = Array.isArray(producto.variantes) 
                    ? producto.variantes 
                    : Object.values(producto.variantes || {});

                variantesArray.forEach((variante, vIdx) => {
                    const precioCosto = variante.precio?.costo || 0;

                    if (variante.opciones) {
                        // Variante con opciones - mostrar cada opción
                        const opcionesArray = Array.isArray(variante.opciones) 
                            ? variante.opciones 
                            : Object.values(variante.opciones || {});

                        opcionesArray.forEach((opcion, oIdx) => {
                            const stockActual = opcion.stock?.actual || 0;
                            const stockClass = stockActual <= (variante.stock?.minimo || 5) ? 'stock-bajo' : 'stock-normal';
                            const itemId = `${producto.id}-v${vIdx}-o${oIdx}`;

                            rows.push(`
                                <tr data-producto-id="${itemId}">
                                    <td>
                                        <div class="producto-nombre">
                                            ${producto.nombre}
                                            <div class="producto-detalle">
                                                📦 ${variante.nombre} - ${opcion.nombre}
                                                ${opcion.codigoBarras ? `<span class="codigo-barras">(${opcion.codigoBarras})</span>` : ''}
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <span class="producto-tipo">Opción</span>
                                    </td>
                                    <td>
                                        <span class="stock-value ${stockClass}">${stockActual}</span>
                                    </td>
                                    <td>
                                        <span class="precio-costo">${window.currencyFormatter ? window.currencyFormatter.format(precioCosto) : '$' + precioCosto.toFixed(2)}</span>
                                    </td>
                                    <td>
                                        <input 
                                            type="number" 
                                            class="cantidad-input" 
                                            min="0" 
                                            step="1" 
                                            value="0"
                                            data-producto-id="${itemId}"
                                            data-precio="${precioCosto}"
                                            onchange="simulacionPedidosModule.actualizarCantidad('${itemId}', this.value, ${precioCosto})"
                                        />
                                    </td>
                                    <td>
                                        <span class="subtotal-value" id="subtotal-${itemId}">$0.00</span>
                                    </td>
                                </tr>
                            `);
                        });
                    } else {
                        // Variante sin opciones
                        const stockActual = variante.stock?.actual || 0;
                        const stockClass = stockActual <= (variante.stock?.minimo || 5) ? 'stock-bajo' : 'stock-normal';
                        const itemId = `${producto.id}-v${vIdx}`;

                        rows.push(`
                            <tr data-producto-id="${itemId}">
                                <td>
                                    <div class="producto-nombre">
                                        ${producto.nombre}
                                        <div class="producto-detalle">
                                            📦 ${variante.nombre}
                                            ${variante.codigoBarras ? `<span class="codigo-barras">(${variante.codigoBarras})</span>` : ''}
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <span class="producto-tipo">Variante</span>
                                </td>
                                <td>
                                    <span class="stock-value ${stockClass}">${stockActual}</span>
                                </td>
                                <td>
                                    <span class="precio-costo">${window.currencyFormatter ? window.currencyFormatter.format(precioCosto) : '$' + precioCosto.toFixed(2)}</span>
                                </td>
                                <td>
                                    <input 
                                        type="number" 
                                        class="cantidad-input" 
                                        min="0" 
                                        step="1" 
                                        value="0"
                                        data-producto-id="${itemId}"
                                        data-precio="${precioCosto}"
                                        onchange="simulacionPedidosModule.actualizarCantidad('${itemId}', this.value, ${precioCosto})"
                                    />
                                </td>
                                <td>
                                    <span class="subtotal-value" id="subtotal-${itemId}">$0.00</span>
                                </td>
                            </tr>
                        `);
                    }
                });

            } else if (producto.tipo === 'conversion') {
                // Producto con conversión - mostrar cada unidad de conversión
                const conversionesArray = Array.isArray(producto.conversiones) 
                    ? producto.conversiones 
                    : Object.values(producto.conversiones || {});

                conversionesArray.forEach((conversion, cIdx) => {
                    const precioCosto = conversion.precio?.costo || 0;
                    const stockDisponible = Math.floor((producto.stock?.actual || 0) / conversion.cantidad);
                    const stockClass = stockDisponible <= 5 ? 'stock-bajo' : 'stock-normal';
                    const itemId = `${producto.id}-c${cIdx}`;

                    rows.push(`
                        <tr data-producto-id="${itemId}">
                            <td>
                                <div class="producto-nombre">
                                    ${producto.nombre}
                                    <div class="producto-detalle">
                                        📦 ${conversion.tipo} (${conversion.cantidad} ${producto.unidadBase || 'unidades'})
                                    </div>
                                </div>
                            </td>
                            <td>
                                <span class="producto-tipo">Conversión</span>
                            </td>
                            <td>
                                <span class="stock-value ${stockClass}">${stockDisponible}</span>
                            </td>
                            <td>
                                <span class="precio-costo">${window.currencyFormatter ? window.currencyFormatter.format(precioCosto) : '$' + precioCosto.toFixed(2)}</span>
                            </td>
                            <td>
                                <input 
                                    type="number" 
                                    class="cantidad-input" 
                                    min="0" 
                                    step="1" 
                                    value="0"
                                    data-producto-id="${itemId}"
                                    data-precio="${precioCosto}"
                                    onchange="simulacionPedidosModule.actualizarCantidad('${itemId}', this.value, ${precioCosto})"
                                />
                            </td>
                            <td>
                                <span class="subtotal-value" id="subtotal-${itemId}">$0.00</span>
                            </td>
                        </tr>
                    `);
                });
            }
        });

        tbody.innerHTML = rows.join('');
    }

    obtenerStockActual(producto) {
        if (producto.tipo === 'simple') {
            return producto.stock?.actual || 0;
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
        return 0;
    }

    obtenerPrecioCosto(producto) {
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

    obtenerTipoLabel(tipo) {
        const labels = {
            'simple': 'Simple',
            'variantes': 'Variantes',
            'conversion': 'Conversión'
        };
        return labels[tipo] || 'Desconocido';
    }

    actualizarCantidad(productoId, cantidad, precio) {
        const cantidadNum = parseInt(cantidad) || 0;

        if (cantidadNum > 0) {
            this.pedidoActual.set(productoId, cantidadNum);
        } else {
            this.pedidoActual.delete(productoId);
        }

        const subtotal = cantidadNum * precio;
        const subtotalElement = document.getElementById(`subtotal-${productoId}`);
        if (subtotalElement) {
            subtotalElement.textContent = window.currencyFormatter ? 
                window.currencyFormatter.format(subtotal) : 
                '$' + subtotal.toFixed(2);
        }

        this.actualizarTotales();
        this.actualizarResumen();
    }

    actualizarTotales() {
        let totalPedido = 0;

        this.pedidoActual.forEach((cantidad, productoId) => {
            const input = document.querySelector(`input[data-producto-id="${productoId}"]`);
            if (input) {
                const precio = parseFloat(input.dataset.precio) || 0;
                totalPedido += cantidad * precio;
            }
        });

        const totalElement = document.getElementById('total-pedido');
        if (totalElement) {
            totalElement.textContent = window.currencyFormatter ? 
                window.currencyFormatter.format(totalPedido) : 
                '$' + totalPedido.toFixed(2);
        }
    }

    actualizarResumen() {
        const resumenPanel = document.getElementById('resumen-pedido');
        const resumenProveedor = document.getElementById('resumen-proveedor');
        const resumenCantidad = document.getElementById('resumen-cantidad-productos');
        const resumenTotal = document.getElementById('resumen-total');

        if (!this.proveedorSeleccionado) {
            if (resumenPanel) resumenPanel.classList.add('hidden');
            return;
        }

        if (resumenPanel) resumenPanel.classList.remove('hidden');

        if (resumenProveedor) {
            resumenProveedor.textContent = this.proveedorSeleccionado.nombre;
        }

        if (resumenCantidad) {
            resumenCantidad.textContent = this.pedidoActual.size;
        }

        let total = 0;
        this.pedidoActual.forEach((cantidad, productoId) => {
            const input = document.querySelector(`input[data-producto-id="${productoId}"]`);
            if (input) {
                const precio = parseFloat(input.dataset.precio) || 0;
                total += cantidad * precio;
            }
        });

        if (resumenTotal) {
            resumenTotal.textContent = window.currencyFormatter ? 
                window.currencyFormatter.format(total) : 
                '$' + total.toFixed(2);
        }
    }

    limpiarSimulacion() {
        this.proveedorSeleccionado = null;
        this.productosFiltrados = [];
        this.pedidoActual.clear();

        const select = document.getElementById('select-proveedor');
        if (select) select.value = '';

        this.mostrarEmptyState();

        const resumenPanel = document.getElementById('resumen-pedido');
        if (resumenPanel) resumenPanel.classList.add('hidden');

        this.deshabilitarBotones();
        this.showNotification('Simulación limpiada', 'info');
    }

    mostrarEmptyState() {
        const emptyState = document.getElementById('empty-state');
        const table = document.getElementById('productos-table');
        const footer = document.getElementById('productos-table-footer');

        if (emptyState) emptyState.classList.remove('hidden');
        if (table) table.classList.add('hidden');
        if (footer) footer.classList.add('hidden');
    }

    habilitarBotones() {
        const btnLimpiar = document.getElementById('btn-limpiar-simulacion');
        const btnExportar = document.getElementById('btn-exportar-simulacion');

        if (btnLimpiar) btnLimpiar.disabled = false;
        if (btnExportar) btnExportar.disabled = false;
    }

    deshabilitarBotones() {
        const btnLimpiar = document.getElementById('btn-limpiar-simulacion');
        const btnExportar = document.getElementById('btn-exportar-simulacion');

        if (btnLimpiar) btnLimpiar.disabled = true;
        if (btnExportar) btnExportar.disabled = true;
    }

    exportarPDF() {
        if (this.pedidoActual.size === 0) {
            alert('No hay productos en el pedido para exportar');
            return;
        }

        let contenido = `SIMULACIÓN DE PEDIDO\n`;
        contenido += `=================================\n\n`;
        contenido += `Proveedor: ${this.proveedorSeleccionado.nombre}\n`;
        contenido += `Fecha: ${new Date().toLocaleDateString()}\n\n`;
        contenido += `PRODUCTOS:\n`;
        contenido += `---------------------------------\n`;

        let total = 0;
        this.pedidoActual.forEach((cantidad, productoId) => {
            const producto = this.productosFiltrados.find(p => p.id === productoId);
            const input = document.querySelector(`input[data-producto-id="${productoId}"]`);

            if (producto && input) {
                const precio = parseFloat(input.dataset.precio) || 0;
                const subtotal = cantidad * precio;
                total += subtotal;

                contenido += `${producto.nombre}\n`;
                contenido += `  Cantidad: ${cantidad}\n`;
                contenido += `  Precio: ${window.currencyFormatter ? window.currencyFormatter.format(precio) : '$' + precio.toFixed(2)}\n`;
                contenido += `  Subtotal: ${window.currencyFormatter ? window.currencyFormatter.format(subtotal) : '$' + subtotal.toFixed(2)}\n\n`;
            }
        });

        contenido += `---------------------------------\n`;
        contenido += `TOTAL: ${window.currencyFormatter ? window.currencyFormatter.format(total) : '$' + total.toFixed(2)}\n`;

        const blob = new Blob([contenido], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pedido_${this.proveedorSeleccionado.nombre}_${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        this.showNotification('Pedido exportado exitosamente', 'success');
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">
                    ${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}
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
                .notification-warning { border-left: 4px solid #FF9500; }
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
        closeBtn.addEventListener('click', () => notification.remove());

        setTimeout(() => {
            if (notification.parentNode) notification.remove();
        }, 5000);
    }

    destroy() {
        console.log('🔄 Módulo descargado');
    }
};
}

function loadSimulacionPedidosModule() {
    if (!window.simulacionPedidosModule) {
        window.simulacionPedidosModule = new window.SimulacionPedidosModule();
    } else {
        console.log('⚠️ Módulo ya está cargado, reutilizando instancia existente');
    }
}

window.loadSimulacionPedidosModule = loadSimulacionPedidosModule;
