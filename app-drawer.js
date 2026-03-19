// App Drawer - Sistema de navegación estilo iOS 26 con iconos SVG profesionales
class AppDrawer {
    constructor() {
        this.drawer = null;
        this.overlay = null;
        this.trigger = null;
        this.isOpen = false;

        this.modules = [
            { id: 'notas', name: 'Notas', icon: 'notas', color: '#FFD60A' },
            { id: 'ventas', name: 'Ventas', icon: 'ventas', color: '#34C759' },
            { id: 'creditos', name: 'Créditos', icon: 'creditos', color: '#FF9500' },
            { id: 'caja', name: 'Caja', icon: 'caja', color: '#007AFF' },
            { id: 'inventario', name: 'Inventario', icon: 'inventario', color: '#5856D6' },
            { id: 'compras', name: 'Compras', icon: 'compras', color: '#FF6482' },
            { id: 'simulacion-pedidos', icon: 'simulacion-pedidos', name: 'Sim. Pedidos', color: '#00C7BE' },
            { id: 'clientes', name: 'Clientes', icon: 'clientes', color: '#5AC8FA' },
            { id: 'proveedores', name: 'Proveedores', icon: 'proveedores', color: '#FF2D55' },
            { id: 'pagos', name: 'Pagos', icon: 'pagos', color: '#FFD60A' },
            { id: 'reportes', name: 'Reportes', icon: 'reportes', color: '#FF9F0A' },
            { id: 'usuarios', name: 'Usuarios', icon: 'usuarios', color: '#5E5CE6' },
            { id: 'promociones', name: 'Promociones', icon: 'promociones', color: '#BF5AF2' },
            { id: 'configuracion', name: 'Configuración', icon: 'configuracion', color: '#8E8E93' }
        ];

        this.init();
    }

    init() {
        this.createDrawer();
        this.setupEventListeners();
        this.setupSwipeGesture();
    }

    getCurrentUser() {
        if (window.authSystem && window.authSystem.currentUser) {
            return window.authSystem.currentUser;
        }
        return {
            nombre: 'Usuario',
            rol: 'Invitado'
        };
    }

    getRoleDisplayName(role) {
        const roles = {
            'administrador': 'Administrador',
            'supervisor': 'Supervisor',
            'vendedor': 'Vendedor'
        };
        return roles[role] || 'Usuario';
    }

    createDrawer() {
        const user = this.getCurrentUser();
        const userInitial = user.nombre ? user.nombre.charAt(0).toUpperCase() : '?';
        const roleDisplay = this.getRoleDisplayName(user.rol);

        // Crear overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'app-drawer-overlay';
        document.body.appendChild(this.overlay);

        // Crear drawer
        this.drawer = document.createElement('div');
        this.drawer.className = 'app-drawer';
        this.drawer.innerHTML = `
            <div class="app-drawer-user">
                <div class="app-drawer-user-avatar">${userInitial}</div>
                <div class="app-drawer-user-info">
                    <div class="app-drawer-user-name">${user.nombre || 'Usuario'}</div>
                    <div class="app-drawer-user-role">${roleDisplay}</div>
                </div>
                <button class="app-drawer-logout" title="Cerrar Sesión">
                    ${window.getIcon ? window.getIcon('logout', 'logout-icon') : '🚪'}
                </button>
            </div>
            <div class="app-drawer-header">
                <h2 class="app-drawer-title">Apps</h2>
                <button class="app-drawer-close">
                    ${window.getIcon ? window.getIcon('close', 'close-icon') : '✕'}
                </button>
            </div>
            <div class="apps-grid">
                ${this.modules.map((module, index) => `
                    <div class="app-item" data-module="${module.id}" data-index="${index}" style="--item-color: ${module.color}">
                        <div class="app-icon" data-module="${module.id}">
                            ${window.getIcon ? window.getIcon(module.icon, 'icon-svg') : '📱'}
                        </div>
                        <span class="app-name">${module.name}</span>
                    </div>
                `).join('')}
            </div>
        `;
        document.body.appendChild(this.drawer);

        // Crear botón trigger con icono SVG
        this.trigger = document.createElement('button');
        this.trigger.className = 'app-drawer-trigger';
        this.trigger.innerHTML = window.getIcon ? window.getIcon('menu', 'trigger-icon') : '📱';
        this.trigger.title = 'Abrir Apps';
        document.body.appendChild(this.trigger);
    }

    setupEventListeners() {
        // Abrir con botón trigger
        this.trigger.addEventListener('click', () => this.open());

        // Cerrar con botón
        const closeBtn = this.drawer.querySelector('.app-drawer-close');
        closeBtn.addEventListener('click', () => this.close());

        // Agregar efecto hover al botón de cerrar
        if (window.MotionUtils) {
            closeBtn.addEventListener('mouseenter', () => {
                window.MotionUtils.rotate(closeBtn.querySelector('.close-icon'), 90, 200);
            });
            closeBtn.addEventListener('mouseleave', () => {
                closeBtn.querySelector('.close-icon').style.transform = '';
            });
        }

        // Cerrar con overlay
        this.overlay.addEventListener('click', () => this.close());

        // Logout
        const logoutBtn = this.drawer.querySelector('.app-drawer-logout');
        logoutBtn.addEventListener('click', () => {
            if (window.authSystem) {
                this.close();
                setTimeout(() => {
                    window.authSystem.showLogoutConfirmation();
                }, 300);
            }
        });

        // Efecto hover en logout
        if (window.MotionUtils) {
            logoutBtn.addEventListener('mouseenter', () => {
                window.MotionUtils.pulse(logoutBtn, 1.1, 400);
            });
        }

        // Click en apps con animaciones
        this.drawer.querySelectorAll('.app-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const module = item.dataset.module;
                
                // Animación de click
                if (window.MotionUtils) {
                    window.MotionUtils.springClick(item);
                    
                    // Ripple effect
                    window.MotionUtils.ripple(item, e);
                }
                
                // Delay para que se vea la animación
                setTimeout(() => {
                    this.selectModule(module);
                }, 150);
            });

            // Hover effect con rotación del icono
            item.addEventListener('mouseenter', () => {
                const icon = item.querySelector('.icon-svg');
                if (icon && window.MotionUtils) {
                    icon.style.transition = 'transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1)';
                    icon.style.transform = 'scale(1.1) rotate(5deg)';
                }
            });

            item.addEventListener('mouseleave', () => {
                const icon = item.querySelector('.icon-svg');
                if (icon) {
                    icon.style.transform = '';
                }
            });
        });

        // Cerrar con ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
    }

    setupSwipeGesture() {
        let touchStartX = 0;
        let touchStartY = 0;
        let touchEndX = 0;
        let touchEndY = 0;

        document.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
            touchStartY = e.changedTouches[0].screenY;
        });

        document.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            touchEndY = e.changedTouches[0].screenY;

            const diffX = touchEndX - touchStartX;
            const diffY = Math.abs(touchStartY - touchEndY);

            // Swipe desde el borde izquierdo hacia la derecha para abrir
            if (touchStartX < 50 && diffX > 50 && diffY < 100) {
                this.open();
            }

            // Swipe desde dentro del drawer hacia la izquierda para cerrar
            if (this.isOpen && diffX < -50 && diffY < 100) {
                this.close();
            }
        });
    }

    open() {
        this.isOpen = true;
        this.drawer.classList.add('active');
        this.overlay.classList.add('active');
        document.body.style.overflow = 'hidden';

        // Actualizar información del usuario al abrir
        this.updateUserInfo();

        // Animación stagger de las apps
        if (window.MotionUtils) {
            const appItems = this.drawer.querySelectorAll('.app-item');
            setTimeout(() => {
                window.MotionUtils.staggerIn(appItems, 100, 30);
            }, 200);
        }

        // Animación del trigger al abrir
        if (window.MotionUtils && this.trigger) {
            window.MotionUtils.rotate(this.trigger.querySelector('.trigger-icon'), 90, 300);
        }
    }

    close() {
        this.isOpen = false;
        this.drawer.classList.remove('active');
        this.overlay.classList.remove('active');
        document.body.style.overflow = '';

        // Animación del trigger al cerrar
        if (window.MotionUtils && this.trigger) {
            const icon = this.trigger.querySelector('.trigger-icon');
            if (icon) {
                icon.style.transition = 'transform 300ms cubic-bezier(0.16, 1, 0.3, 1)';
                icon.style.transform = 'rotate(0deg)';
            }
        }
    }

    updateUserInfo() {
        const user = this.getCurrentUser();
        const userInitial = user.nombre ? user.nombre.charAt(0).toUpperCase() : '?';
        const roleDisplay = this.getRoleDisplayName(user.rol);

        const userAvatar = this.drawer.querySelector('.app-drawer-user-avatar');
        const userName = this.drawer.querySelector('.app-drawer-user-name');
        const userRole = this.drawer.querySelector('.app-drawer-user-role');

        if (userAvatar) userAvatar.textContent = userInitial;
        if (userName) userName.textContent = user.nombre || 'Usuario';
        if (userRole) userRole.textContent = roleDisplay;
    }

    selectModule(moduleId) {
        // Usar el sistema existente para cargar módulos
        if (window.businessSystem) {
            window.businessSystem.loadModule(moduleId);
        }
        this.close();
    }
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.appDrawer = new AppDrawer();
    });
} else {
    window.appDrawer = new AppDrawer();
}
