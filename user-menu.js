// User Menu Dropdown - Sistema de navegación secundaria
class UserMenu {
    constructor() {
        this.isOpen = false;
        this.menu = null;
        this.overlay = null;
        this.trigger = null;

        this.secondaryModules = [
            { id: 'clientes', name: 'Clientes', icon: 'clientes' },
            { id: 'proveedores', name: 'Proveedores', icon: 'proveedores' },
            { id: 'reportes', name: 'Reportes', icon: 'reportes' },
            { id: 'usuarios', name: 'Usuarios', icon: 'usuarios' },
            { id: 'promociones', name: 'Promociones', icon: 'promociones' },
            { id: 'notas', name: 'Notas', icon: 'notas' },
            { id: 'configuracion', name: 'Configuración', icon: 'configuracion' }
        ];

        this.init();
    }

    init() {
        this.createMenu();
        this.setupEventListeners();
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

    createMenu() {
        const user = this.getCurrentUser();
        const userInitial = user.nombre ? user.nombre.charAt(0).toUpperCase() : '?';
        const roleDisplay = this.getRoleDisplayName(user.rol);

        // Crear overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'user-menu-overlay';
        document.body.appendChild(this.overlay);

        // Crear menú
        this.menu = document.createElement('div');
        this.menu.className = 'user-menu-dropdown';

        this.menu.innerHTML = `
            <!-- Header con info del usuario -->
            <div class="user-menu-header">
                <div class="user-info">
                    <div class="user-avatar">${userInitial}</div>
                    <div class="user-details">
                        <div class="user-name">${user.nombre}</div>
                        <div class="user-role">${roleDisplay}</div>
                    </div>
                </div>
            </div>

            <!-- Lista de módulos secundarios -->
            <div class="user-menu-modules">
                <div class="user-menu-section-title">Módulos</div>
                ${this.secondaryModules.map(module => `
                    <div class="user-menu-item" data-module="${module.id}">
                        <div class="user-menu-item-icon" data-module="${module.id}">
                            ${window.getIcon ? window.getIcon(module.icon, 'icon-svg') : '📱'}
                        </div>
                        <span class="user-menu-item-text">${module.name}</span>
                        <div class="user-menu-item-chevron">
                            ${window.getIcon ? window.getIcon('chevron-right', 'chevron-icon') : '›'}
                        </div>
                    </div>
                `).join('')}
            </div>

            <!-- Opción de Instalación PWA (Solo visible si es instalable) -->
            <div id="pwa-install-item" class="user-menu-item" style="display: none; border-top: 1px solid rgba(0,0,0,0.05); margin-top: 5px; padding-top: 12px;">
                <div class="user-menu-item-icon" style="color: var(--primary-color, #007AFF);">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                </div>
                <span class="user-menu-item-text" style="font-weight: 600;">Instalar Aplicación</span>
            </div>

            <!-- Separador -->
            <div class="user-menu-divider"></div>

            <!-- Botón de cerrar sesión -->
            <button class="user-menu-logout">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
                Cerrar Sesión
            </button>
        `;

        document.body.appendChild(this.menu);
    }

    setupEventListeners() {
        // Botón trigger
        this.trigger = document.getElementById('user-menu-trigger');
        if (this.trigger) {
            // Remover listener previo si existe
            this.trigger.replaceWith(this.trigger.cloneNode(true));
            this.trigger = document.getElementById('user-menu-trigger');

            this.trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggle();
            });
        }

        // Manejo de Instalación PWA
        const pwaInstallItem = this.menu.querySelector('#pwa-install-item');
        
        const updatePwaVisibility = () => {
            if (window.deferredPrompt && pwaInstallItem) {
                pwaInstallItem.style.display = 'flex';
            }
        };

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            window.deferredPrompt = e;
            updatePwaVisibility();
        });

        // Verificar si ya teníamos el prompt guardado
        updatePwaVisibility();

        if (pwaInstallItem) {
            pwaInstallItem.addEventListener('click', async () => {
                if (window.deferredPrompt) {
                    window.deferredPrompt.prompt();
                    const { outcome } = await window.deferredPrompt.userChoice;
                    console.log(`Resultado de instalación: ${outcome}`);
                    window.deferredPrompt = null;
                    pwaInstallItem.style.display = 'none';
                }
                this.close();
            });
        }

        // Overlay para cerrar
        this.overlay.addEventListener('click', () => {
            this.close();
        });

        // Items del menú
        this.menu.querySelectorAll('.user-menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const moduleId = item.dataset.module;

                // Animación de click
                if (window.MotionUtils) {
                    window.MotionUtils.springClick(item);
                    window.MotionUtils.ripple(item, e);
                }

                setTimeout(() => {
                    this.selectModule(moduleId);
                }, 200);
            });

            // Hover effects
            item.addEventListener('mouseenter', () => {
                const icon = item.querySelector('svg');
                if (icon && window.MotionUtils) {
                    icon.style.transition = 'transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1)';
                    icon.style.transform = 'scale(1.1) rotate(-3deg)';
                }
            });

            item.addEventListener('mouseleave', () => {
                const icon = item.querySelector('svg');
                if (icon) {
                    icon.style.transform = '';
                }
            });
        });

        // Botón de logout
        const logoutBtn = this.menu.querySelector('.user-menu-logout');
        logoutBtn.addEventListener('click', () => {
            if (window.MotionUtils) {
                window.MotionUtils.springClick(logoutBtn);
            }

            setTimeout(() => {
                this.logout();
            }, 200);
        });

        // Hover en logout
        logoutBtn.addEventListener('mouseenter', () => {
            if (window.MotionUtils) {
                window.MotionUtils.pulse(logoutBtn, 1.05, 400);
            }
        });

        // Cerrar con ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });

        // Cerrar al hacer click fuera
        document.addEventListener('click', (e) => {
            if (this.isOpen &&
                !this.menu.contains(e.target) &&
                !this.trigger.contains(e.target)) {
                this.close();
            }
        });
    }

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    open() {
        this.isOpen = true;

        // Restablecer estilos inline
        this.menu.style.opacity = '';
        this.menu.style.visibility = '';

        this.menu.classList.add('active');
        this.overlay.classList.add('active');

        // Animación del trigger
        if (window.MotionUtils) {
            window.MotionUtils.springClick(this.trigger);
        }

        // Animación stagger de los items
        setTimeout(() => {
            const items = this.menu.querySelectorAll('.user-menu-item');
            if (window.MotionUtils) {
                window.MotionUtils.staggerIn(items, 0, 30);
            }
        }, 100);
    }

    close() {
        if (!this.isOpen) return;

        this.isOpen = false;

        // Animación de salida
        this.menu.classList.remove('active');
        this.overlay.classList.remove('active');

        // Asegurar que el menú se oculte completamente
        setTimeout(() => {
            if (!this.isOpen) {
                this.menu.style.opacity = '0';
                this.menu.style.visibility = 'hidden';
            }
        }, 300);
    }

    selectModule(moduleId) {
        console.log('🔄 Cargando módulo desde user menu:', moduleId);

        // Cerrar menú
        this.close();

        // Cargar módulo
        if (window.businessSystem) {
            window.businessSystem.loadModule(moduleId);
        }

        // Actualizar tab bar si está activo
        if (window.bottomTabBar) {
            // Deseleccionar todos los tabs principales
            document.querySelectorAll('.tab-bar-item').forEach(tab => {
                tab.classList.remove('active');
            });
        }
    }

    logout() {
        console.log('👋 Cerrando sesión...');

        if (window.authSystem) {
            window.authSystem.logout();
        } else {
            // Fallback
            location.reload();
        }
    }

    updateUserInfo(user) {
        const userInitial = user.nombre ? user.nombre.charAt(0).toUpperCase() : '?';
        const roleDisplay = this.getRoleDisplayName(user.rol);

        const avatar = this.menu.querySelector('.user-avatar');
        const name = this.menu.querySelector('.user-name');
        const role = this.menu.querySelector('.user-role');

        if (avatar) avatar.textContent = userInitial;
        if (name) name.textContent = user.nombre;
        if (role) role.textContent = roleDisplay;
    }
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.userMenu = new UserMenu();
    });
} else {
    window.userMenu = new UserMenu();
}