// Bottom Tab Bar - Sistema de navegación inferior estilo iOS
class BottomTabBar {
    constructor() {
        this.activeTab = 'notas';
        this.tabs = [
            { id: 'caja', name: 'Caja', icon: 'caja' },
            { id: 'ventas', name: 'Ventas', icon: 'ventas' },
            { id: 'creditos', name: 'Créditos', icon: 'creditos' },
            { id: 'compras', name: 'Compras', icon: 'compras' },
            { id: 'inventario', name: 'Inventario', icon: 'inventario' },
            { id: 'pagos', name: 'Pagos', icon: 'pagos' },
            { id: 'notas', name: 'Notas', icon: 'notas' }
        ];

        this.init();
    }

    init() {
        this.createTabBar();
        this.setupEventListeners();
        this.setupScrollIndicator();
    }

    createTabBar() {
        // Crear estructura del tab bar
        const tabBar = document.createElement('nav');
        tabBar.className = 'bottom-tab-bar';
        tabBar.setAttribute('role', 'navigation');
        tabBar.setAttribute('aria-label', 'Navegación principal');

        const container = document.createElement('div');
        container.className = 'tab-bar-container';

        const itemsWrapper = document.createElement('div');
        itemsWrapper.className = 'tab-bar-items';

        // Crear cada tab
        this.tabs.forEach(tab => {
            const tabItem = this.createTabItem(tab);
            itemsWrapper.appendChild(tabItem);
        });

        container.appendChild(itemsWrapper);
        tabBar.appendChild(container);

        // Agregar indicador de scroll
        const scrollIndicator = document.createElement('div');
        scrollIndicator.className = 'scroll-indicator';
        tabBar.appendChild(scrollIndicator);

        document.body.appendChild(tabBar);
    }

    createTabItem(tab) {
        const button = document.createElement('button');
        button.className = 'tab-bar-item';
        button.dataset.module = tab.id;
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-label', tab.name);

        const iconWrapper = document.createElement('div');
        iconWrapper.className = 'tab-icon-wrapper';

        // Usar el sistema de iconos existente
        if (window.getIcon) {
            iconWrapper.innerHTML = window.getIcon(tab.icon);
        } else {
            // Fallback si no está disponible
            iconWrapper.innerHTML = '<div style="font-size: 24px;">📱</div>';
        }

        const label = document.createElement('span');
        label.className = 'tab-label';
        label.textContent = tab.name;

        button.appendChild(iconWrapper);
        button.appendChild(label);

        return button;
    }

    setupEventListeners() {
        const tabItems = document.querySelectorAll('.tab-bar-item');

        tabItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const moduleId = item.dataset.module;
                this.selectTab(moduleId);

                // Animación de click
                if (window.MotionUtils) {
                    window.MotionUtils.springClick(item);
                }
            });

            // Efecto hover en iconos
            item.addEventListener('mouseenter', () => {
                const icon = item.querySelector('svg');
                if (icon && window.MotionUtils) {
                    icon.style.transition = 'transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1)';
                    icon.style.transform = 'scale(1.15) rotate(-5deg)';
                }
            });

            item.addEventListener('mouseleave', () => {
                const icon = item.querySelector('svg');
                if (icon && !item.classList.contains('active')) {
                    icon.style.transform = '';
                }
            });
        });
    }

    setupScrollIndicator() {
        const container = document.querySelector('.tab-bar-container');
        const indicator = document.querySelector('.scroll-indicator');

        if (!container || !indicator) return;

        container.addEventListener('scroll', () => {
            const maxScroll = container.scrollWidth - container.clientWidth;
            const currentScroll = container.scrollLeft;
            const progress = currentScroll / maxScroll;

            // Ocultar indicador si ya no hay scroll
            if (maxScroll <= 0) {
                indicator.style.opacity = '0';
            } else {
                indicator.style.opacity = '1';
            }
        });

        // Verificar si necesita scroll inicialmente
        window.addEventListener('resize', () => {
            const maxScroll = container.scrollWidth - container.clientWidth;
            if (maxScroll <= 0) {
                indicator.style.opacity = '0';
            }
        });
    }

    selectTab(moduleId) {
        console.log(`📱 Tab seleccionada: ${moduleId}`);

        // Desactivar todas las tabs
        document.querySelectorAll('.tab-bar-item').forEach(item => {
            item.classList.remove('active');
            item.setAttribute('aria-selected', 'false');
        });

        // Activar el tab seleccionado
        const selectedTab = document.querySelector(`[data-module="${moduleId}"]`);
        if (selectedTab) {
            selectedTab.classList.add('active');
            selectedTab.setAttribute('aria-selected', 'true');

            // Scroll suave al tab en mobile
            this.scrollToTab(selectedTab);
            
            // Guardar referencia del ícono para animación genie
            window.currentActiveTabIcon = selectedTab;
        }

        // Cargar el módulo
        this.activeTab = moduleId;
        if (window.businessSystem) {
            console.log(`✅ businessSystem disponible, cargando módulo ${moduleId}`);
            window.businessSystem.loadModule(moduleId, selectedTab);
        } else {
            console.error('❌ businessSystem no está disponible');
        }
    }

    scrollToTab(tabElement) {
        const container = document.querySelector('.tab-bar-container');
        if (!container) return;

        const tabRect = tabElement.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        const scrollLeft = tabElement.offsetLeft - (containerRect.width / 2) + (tabRect.width / 2);

        container.scrollTo({
            left: scrollLeft,
            behavior: 'smooth'
        });
    }

    setActiveTab(moduleId) {
        this.selectTab(moduleId);
    }
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.bottomTabBar = new BottomTabBar();
    });
} else {
    window.bottomTabBar = new BottomTabBar();
}