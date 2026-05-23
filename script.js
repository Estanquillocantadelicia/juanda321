
// Sistema de Gestión Empresarial - JavaScript
class BusinessManagementSystem {
    constructor() {
        this.currentModule = 'notas';
        this.currentModuleInstance = null;
        this.sidebar = document.getElementById('sidebar');
        this.mainContainer = document.querySelector('.main-container');
        this.mainContent = document.getElementById('main-content');
        this.pageTitle = document.getElementById('page-title');
        this.loadingSpinner = document.getElementById('loading-spinner');
        this.sidebarOverlay = document.getElementById('sidebar-overlay');

        this.modules = {
            notas: { title: 'Notas Internas', icon: '📝' },
            ventas: { title: 'Ventas', icon: '🛒' },
            creditos: { title: 'Créditos', icon: '💳' },
            caja: { title: 'Caja', icon: '💵' },
            inventario: { title: 'Inventario', icon: '📦' },
            compras: { title: 'Compras', icon: '📥' },
            'simulacion-pedidos': { title: 'Simulación de Pedidos', icon: '📋' },
            clientes: { title: 'Clientes', icon: '👤' },
            proveedores: { title: 'Proveedores', icon: '🚚' },
            pagos: { title: 'Pagos', icon: '💸' },
            reportes: { title: 'Reportes', icon: '📊' },
            usuarios: { title: 'Usuarios', icon: '👥' },
            promociones: { title: 'Promociones', icon: '🏷️' },
            configuracion: { title: 'Configuración', icon: '⚙️' },
            respaldos: { title: 'Respaldos', icon: '💾' },
            bitacora: { title: 'Bitácora de Actividad', icon: '📋' }
        };

        this.init();
    }

    async init() {
        console.log('🚀 Inicializando BusinessManagementSystem...');

        // Cargar sistemas centralizados primero
        await this.loadCoreModules();

        this.setupEventListeners();
        this.registerAllModules();
        this.setupResponsiveHandler();

        console.log('✅ BusinessManagementSystem inicializado, esperando autenticación...');
    }

    async loadCoreModules() {
        try {
            // Cargar módulos centralizados en orden de dependencia
            await this.loadScript('./modules/core/event-bus.js');
            await this.loadScript('./modules/core/module-manager.js');
            await this.loadScript('./modules/core/error-handler.js');
            await this.loadScript('./modules/core/form-validator.js');
            await this.loadScript('./modules/core/currency-formatter.js');
            await this.loadScript('./modules/core/bitacora-logger.js');
            await this.loadScript('./modules/core/scanner.js');
            await this.loadScript('./modules/core/scanner-modal.js');
        } catch (error) {
            console.error('Error cargando módulos centralizados:', error);
        }
    }

    async loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    registerAllModules() {
        // Solo registrar módulos que realmente necesitan configuración especial
        if (window.moduleManager) {
            window.moduleManager.registerModule('usuarios', {
                name: 'usuarios',
                dependencies: [],
                initFunction: 'loadUsuariosModule'
            });
            console.log('✅ Módulos registrados en ModuleManager');
        }
    }

    setupEventListeners() {
        // Navegación del sidebar
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const module = item.dataset.module;
                this.loadModule(module);
                this.setActiveNavItem(item);

                // Cerrar sidebar automáticamente después de seleccionar (en cualquier dispositivo)
                this.closeSidebar();
            });
        });

        // Toggle sidebar desktop
        const sidebarToggle = document.getElementById('sidebar-toggle');
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', () => {
                this.toggleSidebar();
            });
        }

        // Toggle sidebar móvil
        const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
        if (mobileMenuToggle) {
            mobileMenuToggle.addEventListener('click', () => {
                this.toggleSidebar();
            });
        }

        // Cerrar sidebar con overlay
        if (this.sidebarOverlay) {
            this.sidebarOverlay.addEventListener('click', () => {
                this.closeSidebar();
            });
        }

        // Cerrar sidebar con ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.sidebar && this.sidebar.classList.contains('open')) {
                this.closeSidebar();
            }
        });
    }

    setupResponsiveHandler() {
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) {
                this.sidebar.classList.remove('open');
                this.sidebarOverlay.classList.remove('active');
            } else {
                this.sidebar.classList.remove('hidden');
                this.mainContainer.classList.remove('sidebar-hidden');
            }
        });
    }

    toggleSidebar() {
        if (window.innerWidth <= 768) {
            // Comportamiento móvil
            this.sidebar.classList.toggle('open');
            this.sidebarOverlay.classList.toggle('active');
        } else {
            // Comportamiento desktop - igual que móvil pero sin overlay
            this.sidebar.classList.toggle('hidden');
            this.mainContainer.classList.toggle('sidebar-hidden');
        }
    }

    closeSidebar() {
        // Cerrar sidebar tanto en móvil como en desktop
        this.sidebar.classList.remove('open');
        this.sidebarOverlay.classList.remove('active');

        // En desktop, aplicar la clase hidden
        if (window.innerWidth > 768) {
            this.sidebar.classList.add('hidden');
            this.mainContainer.classList.add('sidebar-hidden');
        }
    }

    setActiveNavItem(activeItem) {
        // Remover clase active de todos los items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });

        // Agregar clase active al item seleccionado
        activeItem.classList.add('active');
    }

    showLoading() {
        this.loadingSpinner.classList.add('active');
    }

    hideLoading() {
        this.loadingSpinner.classList.remove('active');
    }

    updatePageTitle(title) {
        this.pageTitle.textContent = title;
        document.title = `${title} - Sistema de Gestión`;
    }

    async loadModule(moduleName, sourceIcon = null) {
        console.log(`🔍 Intentando cargar módulo: ${moduleName}`);

        if (!this.modules[moduleName]) {
            console.error(`❌ Módulo ${moduleName} no encontrado en this.modules`);
            console.log('📋 Módulos disponibles:', Object.keys(this.modules));
            return;
        }

        // Verificar autenticación y permisos
        if (window.authSystem && !window.authSystem.isUserAuthenticated()) {
            console.warn('⚠️ Usuario no autenticado, redirigiendo al login');
            return;
        }

        // 🔒 VERIFICACIÓN GLOBAL: Verificar y cerrar cajas vencidas ANTES de cargar cualquier módulo
        if (window.verificarYCerrarCajasVencidas) {
            try {
                await window.verificarYCerrarCajasVencidas();
            } catch (error) {
                console.error('⚠️ Error en verificación global de cajas:', error);
            }
        }

        if (window.authSystem && !window.authSystem.canAccessModule(moduleName)) {
            console.warn(`⚠️ Usuario sin permisos para acceder a ${moduleName}`);
            this.showAccessDeniedContent(moduleName);
            return;
        }

        const previousModule = this.currentModule;
        const targetIcon = sourceIcon || window.currentActiveTabIcon;

        // Marcar módulo anterior como inactivo en preloader
        if (window.modulePreloader && previousModule) {
            window.modulePreloader.markModuleInactive(previousModule);
        }

        // Descargar módulo anterior si existe con animación Genie Out
        if (this.currentModuleInstance && typeof this.currentModuleInstance.destroy === 'function') {
            console.log(`🗑️ Descargando módulo anterior: ${this.currentModule}`);
            this.currentModuleInstance.destroy();
        }

        // Animación Genie Out del módulo anterior
        if (window.MotionUtils && this.mainContent.children.length > 0 && targetIcon) {
            console.log('🎬 Aplicando animación Genie Out');
            const previousIcon = document.querySelector(`[data-module="${previousModule}"]`);
            await window.MotionUtils.genieOut(this.mainContent, previousIcon || targetIcon, 400);
        }

        // Resetear contenedor a estado neutral (oculto pero sin transformaciones)
        this.mainContent.style.opacity = '0';
        this.mainContent.style.transform = '';
        this.mainContent.style.filter = '';
        this.mainContent.style.transformOrigin = '';
        this.mainContent.style.transition = '';

        this.currentModule = moduleName;
        const module = this.modules[moduleName];

        this.updatePageTitle(module.title);

        try {
            console.log(`🔄 Cargando módulo: ${moduleName}`);

            // Mostrar skeleton screen mientras se carga
            if (window.SkeletonScreen) {
                this.mainContent.style.opacity = '1';
                this.mainContent.innerHTML = window.SkeletonScreen.create('module');
                window.SkeletonScreen.startAnimation();
            }

            // Generar contenido del módulo (con cache si está disponible)
            const content = await this.generateModuleHTML(moduleName, module);
            console.log(`📄 Contenido HTML generado para ${moduleName}`);

            // Resetear a estado oculto antes de insertar contenido
            this.mainContent.style.opacity = '0';

            // Remover skeleton screen
            if (window.SkeletonScreen) {
                window.SkeletonScreen.remove();
            }

            // Renderizar contenido con animación Genie In
            await this.renderModuleContent(moduleName, module, content, targetIcon);

            // Marcar módulo como activo en preloader
            if (window.modulePreloader) {
                window.modulePreloader.markModuleActive(moduleName);
            }

            console.log(`✅ Módulo ${moduleName} cargado exitosamente`);

        } catch (error) {
            console.error(`❌ Error cargando módulo ${moduleName}:`, error);
            this.mainContent.style.opacity = '1';
            this.showErrorContent(moduleName, error);
        }
    }

    showErrorContent(moduleName, error) {
        this.mainContent.innerHTML = `
            <div class="module-container">
                <h1 class="module-title">❌ Error al cargar módulo</h1>
                <p class="module-subtitle">No se pudo cargar el módulo "${moduleName}"</p>
                <p style="color: #FF3B30; margin-top: 20px;">Error: ${error.message}</p>
                <button onclick="businessSystem.loadModule('notas')" style="margin-top: 20px; padding: 10px 20px; border: none; border-radius: 8px; background: #007AFF; color: white; cursor: pointer;">
                    Volver a Notas Internas
                </button>
            </div>
        `;
    }

    showAccessDeniedContent(moduleName) {
        const module = this.modules[moduleName];
        this.mainContent.innerHTML = `
            <div class="module-container">
                <h1 class="module-title">🔒 Acceso Denegado</h1>
                <p class="module-subtitle">No tienes permisos para acceder al módulo "${module.title}"</p>
                <p style="color: #FF9500; margin-top: 20px;">Contacta al administrador para solicitar acceso a esta funcionalidad.</p>
                <button onclick="businessSystem.loadModule('notas')" style="margin-top: 20px; padding: 10px 20px; border: none; border-radius: 8px; background: #007AFF; color: white; cursor: pointer;">
                    Volver a Notas Internas
                </button>
            </div>
        `;
    }

    async renderModuleContent(moduleName, module, content, sourceIcon = null) {
        // Insertar contenido
        this.mainContent.innerHTML = content;

        // SIEMPRE restaurar visibility para evitar pantallas en blanco
        this.mainContent.style.opacity = '1';
        this.mainContent.style.transform = '';
        this.mainContent.style.filter = '';

        try {
            // Cargar JavaScript del módulo si existe
            await this.loadModuleJS(moduleName);
        } catch (error) {
            console.warn(`⚠️ Error cargando JS de ${moduleName}:`, error);
        }

        // Animación Genie In o fallback (DESPUÉS de asegurar visibility)
        if (window.MotionUtils && sourceIcon) {
            console.log('🎬 Aplicando animación Genie In');
            try {
                // Resetear opacity temporalmente para la animación
                this.mainContent.style.opacity = '';
                await window.MotionUtils.genieIn(this.mainContent, sourceIcon, 450);
            } catch (error) {
                console.warn('⚠️ Error en genieIn, asegurando visibility:', error);
                this.mainContent.style.opacity = '1';
            }
        } else {
            // Contenido ya es visible, solo aplicar animación sutil si queremos
            console.log('📄 Módulo renderizado sin animación genie (sin sourceIcon)');
        }
    }

    loadModuleCSS(moduleName) {
        // Verificar si el CSS del módulo actual ya existe
        const existingCSS = document.getElementById(`module-css-${moduleName}`);
        if (existingCSS) {
            console.log(`✅ CSS de ${moduleName} ya cargado`);
            return;
        }

        // Cargar nuevo CSS
        const link = document.createElement('link');
        link.id = `module-css-${moduleName}`;
        link.rel = 'stylesheet';
        link.href = `./modules/${moduleName}/${moduleName}.css`;
        document.head.appendChild(link);
        console.log(`📦 CSS cargado: ${moduleName}`);
    }

    async loadModuleJS(moduleName) {
        try {
            const scriptId = `module-js-${moduleName}`;
            const existingScript = document.getElementById(scriptId);

            if (existingScript) {
                console.log(`⚡ Script de ${moduleName} ya cargado`);
                const initFnName = `load${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}Module`;
                if (typeof window[initFnName] === 'function') {
                    window[initFnName]();
                }
                return Promise.resolve();
            }

            const script = document.createElement('script');
            script.id = scriptId;
            script.src = `./modules/${moduleName}/${moduleName}.js`;

            return new Promise((resolve, reject) => {
                script.onload = () => {
                    console.log(`📦 Script cargado: ${moduleName}`);
                    const initFnName = `load${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}Module`;
                    if (typeof window[initFnName] === 'function') {
                        window[initFnName]();
                    }
                    resolve();
                };
                script.onerror = (error) => {
                    console.error(`❌ Error cargando script de ${moduleName}`);
                    reject(error);
                };
                document.head.appendChild(script);
            });
        } catch (error) {
            console.error(`Error en loadModuleJS para ${moduleName}:`, error);
            return Promise.resolve();
        }
    }

    async generateModuleHTML(moduleName, module) {
        const moduleTemplates = {
            ventas: this.getVentasTemplate(),
            creditos: await this.getCreditosTemplate(),
            caja: this.getCajaTemplate(),
            inventario: await this.getInventarioTemplate(),
            compras: this.getComprasTemplate(),
            'simulacion-pedidos': await this.getSimulacionPedidosTemplate(),
            clientes: this.getClientesTemplate(),
            proveedores: await this.getProveedoresTemplate(),
            pagos: this.getPagosTemplate(),
            reportes: this.getReportesTemplate(),
            usuarios: await this.getUsuariosTemplate(),
            promociones: this.getPromocionesTemplate(),
            notas: await this.getNotasTemplate(),
            configuracion: this.getConfiguracionTemplate(),
            respaldos: await this.getRespaldosTemplate(),
            bitacora: await this.getBitacoraTemplate()
        };

        return moduleTemplates[moduleName] || this.getDefaultTemplate(module);
    }

    async loadModuleHTMLFromCache(moduleName) {
        if (window.modulePreloader) {
            const cachedHTML = await window.modulePreloader.getModuleHTML(moduleName);
            if (cachedHTML) {
                console.log(`⚡ HTML de ${moduleName} cargado desde cache`);
                return cachedHTML;
            }
        }

        const response = await fetch(`./modules/${moduleName}/${moduleName}.html`);
        return await response.text();
    }

    async getVentasTemplate() {
        try {
            const moduleHTML = await this.loadModuleHTMLFromCache('ventas');
            this.loadModuleCSS('ventas');

            return `
                <div class="module-container">
                    ${moduleHTML}
                </div>
            `;
        } catch (error) {
            console.error('Error al cargar módulo de ventas:', error);
            return `
                <div class="module-container">
                    <p style="color: #FF3B30; margin-top: 20px;">Error al cargar el módulo. Verifique la conexión.</p>
                </div>
            `;
        }
    }

    async getCreditosTemplate() {
        try {
            const moduleHTML = await this.loadModuleHTMLFromCache('creditos');
            this.loadModuleCSS('creditos');

            return `
                <div class="module-container">
                    <h1 class="module-title">💳 Módulo de Créditos</h1>
                    <p class="module-subtitle">Gestión profesional de créditos, cobranza y cuentas por cobrar</p>
                    ${moduleHTML}
                </div>
            `;
        } catch (error) {
            console.error('Error al cargar módulo de créditos:', error);
            return `
                <div class="module-container">
                    <h1 class="module-title">💳 Módulo de Créditos</h1>
                    <p class="module-subtitle">Gestión de créditos y cobranza</p>
                    <p style="color: #FF3B30; margin-top: 20px;">Error al cargar el módulo. Verifique la conexión.</p>
                </div>
            `;
        }
    }

    async getCajaTemplate() {
        try {
            const moduleHTML = await this.loadModuleHTMLFromCache('caja');
            this.loadModuleCSS('caja');

            return `
                <div class="module-container">
                    <h1 class="module-title">💵 Módulo de Caja</h1>
                    <p class="module-subtitle">Control de apertura, cierre y movimientos de caja</p>
                    ${moduleHTML}
                </div>
            `;
        } catch (error) {
            console.error('Error al cargar módulo de caja:', error);
            return `
                <div class="module-container">
                    <h1 class="module-title">💵 Módulo de Caja</h1>
                    <p class="module-subtitle">Control de apertura, cierre y movimientos de caja</p>
                    <p style="color: #FF3B30; margin-top: 20px;">Error al cargar el módulo. Verifique la conexión.</p>
                </div>
            `;
        }
    }

    async getInventarioTemplate() {
        try {
            const moduleHTML = await this.loadModuleHTMLFromCache('inventario');
            this.loadModuleCSS('inventario');

            return `
                <div class="module-container">
                    <h1 class="module-title">📦 Módulo de Inventario</h1>
                    <p class="module-subtitle">Gestión profesional de productos, stock y categorías</p>
                    ${moduleHTML}
                </div>
            `;
        } catch (error) {
            console.error('Error al cargar módulo de inventario:', error);
            return `
                <div class="module-container">
                    <h1 class="module-title">📦 Módulo de Inventario</h1>
                    <p class="module-subtitle">Gestión de productos, stock y control de inventario</p>
                    <p style="color: #FF3B30; margin-top: 20px;">Error al cargar el módulo. Verifique la conexión.</p>
                </div>
            `;
        }
    }

    async getComprasTemplate() {
        try {
            const moduleHTML = await this.loadModuleHTMLFromCache('compras');
            this.loadModuleCSS('compras');

            return `
                <div class="module-container">
                    <h1 class="module-title">📥 Módulo de Compras</h1>
                    <p class="module-subtitle">Gestión de compras a proveedores y actualización de inventario</p>
                    ${moduleHTML}
                </div>
            `;
        } catch (error) {
            console.error('Error al cargar módulo de compras:', error);
            return `
                <div class="module-container">
                    <h1 class="module-title">📥 Módulo de Compras</h1>
                    <p class="module-subtitle">Gestión de compras y órdenes a proveedores</p>
                    <p style="color: #FF3B30; margin-top: 20px;">Error al cargar el módulo. Verifique la conexión.</p>
                </div>
            `;
        }
    }

    async getClientesTemplate() {
        try {
            const response = await fetch('./modules/clientes/clientes.html');
            const moduleHTML = await response.text();

            this.loadModuleCSS('clientes');

            return `
                <div class="module-container">
                    <h1 class="module-title">👤 Módulo de Clientes</h1>
                    <p class="module-subtitle">Gestión completa de clientes y contactos</p>
                    ${moduleHTML}
                </div>
            `;
        } catch (error) {
            console.error('Error al cargar módulo de clientes:', error);
            return `
                <div class="module-container">
                    <h1 class="module-title">👤 Módulo de Clientes</h1>
                    <p class="module-subtitle">Gestión completa de clientes y contactos</p>
                    <p style="color: #FF3B30; margin-top: 20px;">Error al cargar el módulo. Verifique la conexión.</p>
                </div>
            `;
        }
    }

    getProveedoresTemplate() {
        return `
            <div class="module-container">
                <h1 class="module-title">🚚 Módulo de Proveedores</h1>
                <p class="module-subtitle">Gestión de proveedores y relaciones comerciales</p>
                <p style="color: #6D6D80; margin-top: 20px;">Este módulo estará disponible próximamente con todas las funcionalidades de proveedores.</p>
            </div>
        `;
    }

    async getPagosTemplate() {
        try {
            const response = await fetch('./modules/pagos/pagos.html');
            const moduleHTML = await response.text();

            this.loadModuleCSS('pagos');

            return `
                <div class="module-container">
                    <h1 class="module-title">💰 Módulo de Pagos</h1>
                    <p class="module-subtitle">Gestión financiera, caja mayor y nómina</p>
                    ${moduleHTML}
                </div>
            `;
        } catch (error) {
            console.error('Error al cargar módulo de pagos:', error);
            return `
                <div class="module-container">
                    <h1 class="module-title">💰 Módulo de Pagos</h1>
                    <p class="module-subtitle">Gestión financiera y nómina</p>
                    <p style="color: #FF3B30; margin-top: 20px;">Error al cargar el módulo. Verifique la conexión.</p>
                </div>
            `;
        }
    }

    async getReportesTemplate() {
        try {
            const response = await fetch('./modules/reportes/reportes.html');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const moduleHTML = await response.text();

            this.loadModuleCSS('reportes');

            return `
                <div class="module-container">
                    <h1 class="module-title">📊 Módulo de Reportes</h1>
                    <p class="module-subtitle">Análisis completo del negocio</p>
                    ${moduleHTML}
                </div>
            `;
        } catch (error) {
            console.error('Error al cargar módulo de reportes:', error);
            return `
                <div class="module-container">
                    <h1 class="module-title">📊 Módulo de Reportes</h1>
                    <p class="module-subtitle">Análisis y reportes del negocio</p>
                    <p style="color: #FF3B30; margin-top: 20px;">Error al cargar el módulo. Por favor, verifica la conexión.</p>
                </div>
            `;
        }
    }

    async getUsuariosTemplate() {
        // Cargar HTML del módulo independiente
        try {
            const response = await fetch('./modules/usuarios/usuarios.html');
            const moduleHTML = await response.text();

            // Cargar CSS del módulo
            this.loadModuleCSS('usuarios');

            return `
                <div class="module-container">
                    <h1 class="module-title">👥 Módulo de Usuarios</h1>
                    <p class="module-subtitle">Gestión de usuarios y permisos del sistema</p>
                    ${moduleHTML}
                </div>
            `;
        } catch (error) {
            console.error('Error al cargar módulo de usuarios:', error);
            return `
                <div class="module-container">
                    <h1 class="module-title">👥 Módulo de Usuarios</h1>
                    <p class="module-subtitle">Gestión de usuarios y permisos del sistema</p>
                    <p style="color: #FF3B30; margin-top: 20px;">Error al cargar el módulo. Verifique la conexión.</p>
                </div>
            `;
        }
    }

    async getProveedoresTemplate() {
        // Cargar HTML del módulo independiente
        try {
            const response = await fetch('./modules/proveedores/proveedores.html');
            const moduleHTML = await response.text();

            // Cargar CSS del módulo
            this.loadModuleCSS('proveedores');

            return `
                <div class="module-container">
                    <h1 class="module-title">🚚 Módulo de Proveedores</h1>
                    <p class="module-subtitle">Gestión de proveedores y relaciones comerciales</p>
                    ${moduleHTML}
                </div>
            `;
        } catch (error) {
            console.error('Error al cargar módulo de proveedores:', error);
            return `
                <div class="module-container">
                    <h1 class="module-title">🚚 Módulo de Proveedores</h1>
                    <p class="module-subtitle">Gestión de proveedores y relaciones comerciales</p>
                    <p style="color: #FF3B30; margin-top: 20px;">Error al cargar el módulo. Verifique la conexión.</p>
                </div>
            `;
        }
    }

    getPromocionesTemplate() {
        return `
            <div class="module-container">
                <h1 class="module-title">🏷️ Módulo de Promociones</h1>
                <p class="module-subtitle">Gestión de ofertas, descuentos y promociones</p>
                <p style="color: #6D6D80; margin-top: 20px;">Este módulo estará disponible próximamente con todas las funcionalidades de promociones.</p>
            </div>
        `;
    }

    async getRespaldosTemplate() {
        try {
            const moduleHTML = await this.loadModuleHTMLFromCache('respaldos');
            this.loadModuleCSS('respaldos');

            return `
                <div class="module-container">
                    ${moduleHTML}
                </div>
            `;
        } catch (error) {
            console.error('Error al cargar módulo de respaldos:', error);
            return `
                <div class="module-container">
                    <h1 class="module-title">💾 Respaldos</h1>
                    <p style="color: #FF3B30; margin-top: 20px;">Error al cargar el módulo. Verifique la conexión.</p>
                </div>
            `;
        }
    }

    async getBitacoraTemplate() {
        try {
            const moduleHTML = await this.loadModuleHTMLFromCache('bitacora');
            this.loadModuleCSS('bitacora');

            return `
                <div class="module-container">
                    ${moduleHTML}
                </div>
            `;
        } catch (error) {
            console.error('Error al cargar módulo de bitácora:', error);
            return `
                <div class="module-container">
                    <h1 class="module-title">📋 Bitácora</h1>
                    <p style="color: #FF3B30; margin-top: 20px;">Error al cargar el módulo. Verifique la conexión.</p>
                </div>
            `;
        }
    }

    async getNotasTemplate() {
        try {
            const moduleHTML = await this.loadModuleHTMLFromCache('notas');
            this.loadModuleCSS('notas');

            return `
                <div class="module-container">
                    ${moduleHTML}
                </div>
            `;
        } catch (error) {
            console.error('Error al cargar módulo de notas:', error);
            return `
                <div class="module-container">
                    <h1 class="module-title">📝 Módulo de Notas Internas</h1>
                    <p class="module-subtitle">Sistema de notas y comunicación interna</p>
                    <p style="color: #FF3B30; margin-top: 20px;">Error al cargar el módulo. Verifique la conexión.</p>
                </div>
            `;
        }
    }

    async getSimulacionPedidosTemplate() {
        try {
            const response = await fetch('./modules/simulacion-pedidos/simulacion-pedidos.html');
            const moduleHTML = await response.text();

            this.loadModuleCSS('simulacion-pedidos');

            return `
                <div class="module-container">
                    <h1 class="module-title">📋 Módulo de Simulación de Pedidos</h1>
                    <p class="module-subtitle">Simula y calcula pedidos a proveedores de forma rápida y precisa</p>
                    ${moduleHTML}
                </div>
            `;
        } catch (error) {
            console.error('Error al cargar módulo de simulación de pedidos:', error);
            return `
                <div class="module-container">
                    <h1 class="module-title">📋 Módulo de Simulación de Pedidos</h1>
                    <p class="module-subtitle">Simulación de pedidos a proveedores</p>
                    <p style="color: #FF3B30; margin-top: 20px;">Error al cargar el módulo. Verifique la conexión.</p>
                </div>
            `;
        }
    }

    async getConfiguracionTemplate() {
        try {
            const response = await fetch('./modules/configuracion/configuracion.html');
            const moduleHTML = await response.text();

            this.loadModuleCSS('configuracion');

            return `
                <div class="module-container">
                    <h1 class="module-title">⚙️ Módulo de Configuración</h1>
                    <p class="module-subtitle">Configuración general del sistema y horario comercial</p>
                    ${moduleHTML}
                </div>
            `;
        } catch (error) {
            console.error('Error al cargar módulo de configuración:', error);
            return `
                <div class="module-container">
                    <h1 class="module-title">⚙️ Módulo de Configuración</h1>
                    <p class="module-subtitle">Configuración general del sistema</p>
                    <p style="color: #FF3B30; margin-top: 20px;">Error al cargar el módulo. Verifique la conexión.</p>
                </div>
            `;
        }
    }

    getDefaultTemplate(module) {
        return `
            <div class="module-container">
                <h1 class="module-title">${module.icon} ${module.title}</h1>
                <p class="module-subtitle">Módulo en desarrollo</p>
                <p style="color: #6D6D80; margin-top: 20px;">Este módulo estará disponible próximamente.</p>
            </div>
        `;
    }
}

// Inicializar el sistema cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.businessSystem = new BusinessManagementSystem();
});

// Función auxiliar para transiciones suaves
function smoothTransition(element, property, value, duration = 300) {
    element.style.transition = `${property} ${duration}ms ease-out`;
    element.style[property] = value;
}

// Utilidades para animaciones
const AnimationUtils = {
    fadeIn(element, duration = 300) {
        element.style.opacity = '0';
        element.style.display = 'block';

        setTimeout(() => {
            element.style.transition = `opacity ${duration}ms ease-out`;
            element.style.opacity = '1';
        }, 10);
    },

    fadeOut(element, duration = 300) {
        element.style.transition = `opacity ${duration}ms ease-out`;
        element.style.opacity = '0';

        setTimeout(() => {
            element.style.display = 'none';
        }, duration);
    },

    slideUp(element, duration = 300) {
        element.style.transition = `transform ${duration}ms ease-out, opacity ${duration}ms ease-out`;
        element.style.transform = 'translateY(0)';
        element.style.opacity = '1';
    },

    slideDown(element, duration = 300) {
        element.style.transition = `transform ${duration}ms ease-out, opacity ${duration}ms ease-out`;
        element.style.transform = 'translateY(20px)';
        element.style.opacity = '0';
    }
};

// Exportar para uso global si es necesario
window.BusinessManagementSystem = BusinessManagementSystem;
window.AnimationUtils = AnimationUtils;