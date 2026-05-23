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
            { id: 'configuracion', name: 'Configuración', icon: 'configuracion' },
            { id: 'respaldos', name: 'Respaldos', icon: 'configuracion', soloAdmin: true },
            { id: 'bitacora', name: 'Bitácora', icon: 'reportes', soloAdmin: true }
        ];

        this.init();
    }

    init() {
        this.createMenu();
        this.setupEventListeners();

        // Reconstruir el menú cuando el usuario se autentique (para mostrar
        // ítems condicionados al rol como "Respaldos" solo a admins).
        document.addEventListener('authStateChanged', (e) => {
            if (e.detail?.authenticated) {
                this.rebuildMenu();
            }
        });
    }

    rebuildMenu() {
        // Quita el menú actual y vuelve a crearlo con el rol del usuario logueado
        if (this.menu) this.menu.remove();
        if (this.overlay) this.overlay.remove();
        this.createMenu();
        this.setupEventListeners();
        this.isOpen = false;
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
        const esAdmin = user.rol === 'administrador';
        // Filtrar módulos según rol
        const modulosVisibles = this.secondaryModules.filter(m => !m.soloAdmin || esAdmin);

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
                ${modulosVisibles.map(module => `
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

            <!-- Botón Mi Perfil -->
            <div id="user-menu-profile" class="user-menu-item" style="border-top: 1px solid rgba(0,0,0,0.05); padding-top: 12px;">
                <div class="user-menu-item-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                </div>
                <span class="user-menu-item-text">Mi Perfil</span>
                <div class="user-menu-item-chevron">›</div>
            </div>

            <!-- Botón Mis Dispositivos -->
            <div id="user-menu-devices" class="user-menu-item">
                <div class="user-menu-item-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                        <line x1="8" y1="21" x2="16" y2="21"></line>
                        <line x1="12" y1="17" x2="12" y2="21"></line>
                    </svg>
                </div>
                <span class="user-menu-item-text">Mis Dispositivos</span>
                <div class="user-menu-item-chevron">›</div>
            </div>

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

        // Items del menú (excluir entradas especiales sin data-module)
        this.menu.querySelectorAll('.user-menu-item[data-module]').forEach(item => {
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

        // Botón Mi Perfil
        const profileBtn = this.menu.querySelector('#user-menu-profile');
        if (profileBtn) {
            profileBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.close();
                this.mostrarMiPerfil();
            });
        }

        // Botón Mis Dispositivos
        const devicesBtn = this.menu.querySelector('#user-menu-devices');
        if (devicesBtn) {
            devicesBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.close();
                this.mostrarMisDispositivos();
            });
        }

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

    async mostrarMisDispositivos() {
        if (!window.SesionesActivas || !window.authSystem?.currentUser) {
            alert('No se pudo cargar la lista de dispositivos.');
            return;
        }
        const userId = window.authSystem.currentUser.uid;
        const miDeviceId = window.SesionesActivas.generarDeviceId();

        // Limpiar modal previo
        const prev = document.getElementById('modal-mis-dispositivos');
        if (prev) prev.remove();

        const overlay = document.createElement('div');
        overlay.id = 'modal-mis-dispositivos';
        overlay.style.cssText = `
            position: fixed; inset: 0; background: rgba(0,0,0,0.55);
            display: flex; align-items: center; justify-content: center;
            z-index: 100000; padding: 16px;
        `;
        overlay.innerHTML = `
            <div style="background:white; border-radius:16px; max-width:520px; width:100%; max-height:90vh; overflow:auto; box-shadow:0 20px 60px rgba(0,0,0,0.3);">
                <div style="padding:20px; border-bottom:1px solid #E5E5EA; display:flex; align-items:center; justify-content:space-between;">
                    <h3 style="margin:0; font-size:18px; color:#1C1C1E;">Mis Dispositivos</h3>
                    <button id="cerrar-mis-dispositivos" style="background:none; border:none; font-size:22px; cursor:pointer; color:#6D6D80;">✕</button>
                </div>
                <div id="lista-mis-dispositivos" style="padding:16px;">
                    <div style="text-align:center; padding:30px; color:#6D6D80;">Cargando...</div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        document.getElementById('cerrar-mis-dispositivos').onclick = () => overlay.remove();

        const fmtFecha = (ts) => {
            try {
                const d = ts?.toDate ? ts.toDate() : new Date(ts);
                return d.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
            } catch { return '—'; }
        };

        try {
            const sesiones = await window.SesionesActivas.listarSesionesActivas(userId);
            const cont = document.getElementById('lista-mis-dispositivos');
            if (sesiones.length === 0) {
                cont.innerHTML = '<div style="text-align:center; padding:30px; color:#6D6D80;">No hay otros dispositivos activos.</div>';
                return;
            }
            cont.innerHTML = sesiones.map(s => {
                const esActual = s.deviceId === miDeviceId;
                return `
                    <div style="display:flex; align-items:center; gap:12px; padding:12px; background:${esActual ? '#E3F2FD' : '#F8F8FA'}; border-radius:10px; margin-bottom:8px; border:1px solid ${esActual ? '#90CAF9' : '#E5E5EA'};">
                        <div style="flex:1;">
                            <div style="font-weight:600; color:#1C1C1E;">
                                ${s.deviceName || 'Dispositivo'}
                                ${esActual ? '<span style="background:#007AFF; color:white; font-size:11px; padding:2px 8px; border-radius:6px; margin-left:6px;">ESTE</span>' : ''}
                            </div>
                            <div style="font-size:12px; color:#6D6D80;">Inició: ${fmtFecha(s.inicioSesion)}</div>
                            <div style="font-size:12px; color:#6D6D80;">Última actividad: ${fmtFecha(s.ultimoLatido)}</div>
                        </div>
                        ${esActual ? '' : `<button data-device-id="${s.deviceId}" class="btn-cerrar-otro-dispositivo" style="padding:8px 14px; background:#FF3B30; color:white; border:none; border-radius:8px; font-weight:600; cursor:pointer;">Cerrar</button>`}
                    </div>
                `;
            }).join('');

            cont.querySelectorAll('.btn-cerrar-otro-dispositivo').forEach(btn => {
                btn.onclick = async () => {
                    if (!confirm('¿Cerrar sesión de este dispositivo?')) return;
                    btn.disabled = true;
                    btn.textContent = 'Cerrando...';
                    try {
                        await window.SesionesActivas.expulsarSesion(userId, btn.dataset.deviceId);
                        // Recargar la lista
                        overlay.remove();
                        this.mostrarMisDispositivos();
                    } catch (err) {
                        alert('Error: ' + err.message);
                        btn.disabled = false;
                        btn.textContent = 'Cerrar';
                    }
                };
            });
        } catch (err) {
            document.getElementById('lista-mis-dispositivos').innerHTML =
                '<div style="text-align:center; padding:30px; color:#FF3B30;">Error al cargar dispositivos: ' + err.message + '</div>';
        }
    }

    async mostrarMiPerfil() {
        const user = window.authSystem?.currentUser;
        if (!user) {
            alert('No hay sesión activa.');
            return;
        }

        const prev = document.getElementById('modal-mi-perfil');
        if (prev) prev.remove();

        const roleDisplay = this.getRoleDisplayName(user.rol);
        const nombre = user.nombre || '—';
        const email = user.email || user.personalInfo?.email || '—';

        const overlay = document.createElement('div');
        overlay.id = 'modal-mi-perfil';
        overlay.style.cssText = `
            position: fixed; inset: 0; background: rgba(0,0,0,0.55);
            display: flex; align-items: center; justify-content: center;
            z-index: 100000; padding: 16px;
        `;
        overlay.innerHTML = `
            <div style="background:white; border-radius:16px; max-width:480px; width:100%; max-height:90vh; overflow:auto; box-shadow:0 20px 60px rgba(0,0,0,0.3);">
                <div style="padding:20px; border-bottom:1px solid #E5E5EA; display:flex; align-items:center; justify-content:space-between;">
                    <h3 style="margin:0; font-size:18px; color:#1C1C1E;">Mi Perfil</h3>
                    <button id="cerrar-mi-perfil" style="background:none; border:none; font-size:22px; cursor:pointer; color:#6D6D80;">✕</button>
                </div>
                <div style="padding:20px;">
                    <div style="background:#F8F8FA; border-radius:12px; padding:16px; margin-bottom:20px;">
                        <div style="display:flex; align-items:center; gap:14px; margin-bottom:14px;">
                            <div style="width:54px; height:54px; border-radius:50%; background:linear-gradient(135deg,#007AFF,#5856D6); color:white; display:flex; align-items:center; justify-content:center; font-size:24px; font-weight:600;">
                                ${(nombre.charAt(0) || '?').toUpperCase()}
                            </div>
                            <div>
                                <div style="font-weight:600; font-size:16px; color:#1C1C1E;">${nombre}</div>
                                <div style="font-size:13px; color:#6D6D80;">${roleDisplay}</div>
                            </div>
                        </div>
                        <div style="font-size:13px; color:#6D6D80; padding-top:10px; border-top:1px solid #E5E5EA;">
                            <div style="margin-bottom:4px;"><strong style="color:#1C1C1E;">Correo:</strong> ${email}</div>
                            <div><strong style="color:#1C1C1E;">Rol:</strong> ${roleDisplay} <span style="font-size:11px; color:#8E8E93;">(solo lectura)</span></div>
                        </div>
                    </div>

                    <h4 style="margin:0 0 12px; font-size:15px; color:#1C1C1E;">Cambiar mi contraseña</h4>
                    <form id="form-cambiar-pass" autocomplete="off">
                        <div style="margin-bottom:12px;">
                            <label style="display:block; font-size:13px; color:#6D6D80; margin-bottom:6px;">Contraseña actual</label>
                            <input type="password" id="pass-actual" required autocomplete="current-password"
                                style="width:100%; padding:10px 12px; border:1px solid #E5E5EA; border-radius:8px; font-size:14px; box-sizing:border-box;">
                        </div>
                        <div style="margin-bottom:12px;">
                            <label style="display:block; font-size:13px; color:#6D6D80; margin-bottom:6px;">Nueva contraseña <span style="color:#8E8E93;">(mín. 8 caracteres)</span></label>
                            <input type="password" id="pass-nueva" required minlength="8" autocomplete="new-password"
                                style="width:100%; padding:10px 12px; border:1px solid #E5E5EA; border-radius:8px; font-size:14px; box-sizing:border-box;">
                        </div>
                        <div style="margin-bottom:14px;">
                            <label style="display:block; font-size:13px; color:#6D6D80; margin-bottom:6px;">Confirmar nueva contraseña</label>
                            <input type="password" id="pass-confirma" required minlength="8" autocomplete="new-password"
                                style="width:100%; padding:10px 12px; border:1px solid #E5E5EA; border-radius:8px; font-size:14px; box-sizing:border-box;">
                        </div>
                        <div id="pass-feedback" style="font-size:13px; margin-bottom:12px; min-height:18px;"></div>
                        <button type="submit" id="btn-cambiar-pass"
                            style="width:100%; padding:12px; background:linear-gradient(135deg,#007AFF,#5856D6); color:white; border:none; border-radius:10px; font-weight:600; cursor:pointer; font-size:14px;">
                            Cambiar contraseña
                        </button>
                    </form>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const cerrar = () => overlay.remove();
        document.getElementById('cerrar-mi-perfil').onclick = cerrar;
        overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });

        const form = document.getElementById('form-cambiar-pass');
        const feedback = document.getElementById('pass-feedback');
        const btn = document.getElementById('btn-cambiar-pass');

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const actual = document.getElementById('pass-actual').value;
            const nueva = document.getElementById('pass-nueva').value;
            const confirma = document.getElementById('pass-confirma').value;

            feedback.textContent = '';
            feedback.style.color = '';

            if (nueva.length < 8) {
                feedback.textContent = '✗ La nueva contraseña debe tener al menos 8 caracteres.';
                feedback.style.color = '#FF3B30';
                return;
            }
            if (nueva !== confirma) {
                feedback.textContent = '✗ La confirmación no coincide con la nueva contraseña.';
                feedback.style.color = '#FF3B30';
                return;
            }
            if (nueva === actual) {
                feedback.textContent = '✗ La nueva contraseña debe ser distinta a la actual.';
                feedback.style.color = '#FF3B30';
                return;
            }

            btn.disabled = true;
            const textoOriginal = btn.textContent;
            btn.textContent = 'Cambiando...';

            try {
                const currentAuthUser = window.auth.currentUser;
                if (!currentAuthUser) throw new Error('No hay sesión de Firebase activa.');

                const credential = firebase.auth.EmailAuthProvider.credential(
                    currentAuthUser.email,
                    actual
                );
                await currentAuthUser.reauthenticateWithCredential(credential);
                await currentAuthUser.updatePassword(nueva);

                try {
                    await window.bitacora?.log({
                        tipo: 'usuarios',
                        accion: 'cambio_password_propio',
                        detalle: `${currentAuthUser.email} cambió su propia contraseña`,
                        nivel: 'info',
                        gravedad: 'media'
                    });
                } catch(e) {}

                feedback.textContent = '✓ Contraseña actualizada correctamente.';
                feedback.style.color = '#34C759';
                btn.textContent = '✓ Cambiada';
                setTimeout(cerrar, 1400);
            } catch (error) {
                console.error('Error cambiando contraseña:', error);
                let msg = 'No se pudo cambiar la contraseña.';
                if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                    msg = '✗ La contraseña actual es incorrecta.';
                } else if (error.code === 'auth/weak-password') {
                    msg = '✗ La nueva contraseña es muy débil.';
                } else if (error.code === 'auth/requires-recent-login') {
                    msg = '✗ Por seguridad, vuelve a iniciar sesión e intenta de nuevo.';
                } else if (error.code === 'auth/too-many-requests') {
                    msg = '✗ Demasiados intentos. Espera unos minutos.';
                } else if (error.message) {
                    msg = '✗ ' + error.message;
                }
                feedback.textContent = msg;
                feedback.style.color = '#FF3B30';
                btn.disabled = false;
                btn.textContent = textoOriginal;
            }
        });

        setTimeout(() => document.getElementById('pass-actual')?.focus(), 100);
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