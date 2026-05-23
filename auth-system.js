// Sistema de Autenticación - Gestión de sesiones y permisos
class AuthenticationSystem {
    constructor() {
        this.currentUser = null;
        this.userPermissions = {};
        this.isAuthenticated = false;
        this.onAuthStateChangedCallback = null;
        this._userDocUnsubscribe = null;

        this.init();
    }

    async init() {
        // Cargar emails de usuarios para autocompletado PRIMERO
        await this.loadUserEmails();

        // Escuchar cambios en el estado de autenticación
        window.auth.onAuthStateChanged(async (user) => {
            if (user) {
                await this.handleUserLogin(user);
            } else {
                this.handleUserLogout();
            }
        });
    }

    async loadUserEmails() {
        try {
            console.log('🔄 Intentando cargar emails de usuarios...');

            const usersSnapshot = await window.db.collection('users').get();
            console.log(`✅ Colección 'users' encontrada con ${usersSnapshot.size} documentos`);

            this.userEmails = [];
            usersSnapshot.forEach(doc => {
                const userData = doc.data();
                console.log('👤 Usuario encontrado:', doc.id, userData);

                let email = null;

                if (userData.personalInfo?.email) {
                    email = userData.personalInfo.email;
                } else if (userData.email) {
                    email = userData.email;
                } else if (userData.correo) {
                    email = userData.correo;
                } else if (userData.personalInfo?.correo) {
                    email = userData.personalInfo.correo;
                }

                if (email && email.includes('@')) {
                    this.userEmails.push(email);
                    console.log('✉️ Email agregado:', email);
                } else {
                    console.warn('⚠️ Usuario sin email válido:', doc.id, userData);
                }
            });

            console.log('📧 Total de emails cargados:', this.userEmails.length);
            console.log('📋 Lista de emails:', this.userEmails);

            this.populateEmailSuggestions();
        } catch (error) {
            console.error('❌ Error al cargar emails:', error);
            this.userEmails = [];
        }
    }

    async handleUserLogin(user) {
        try {
            const userDoc = await window.db.collection('users').doc(user.uid).get();

            if (userDoc.exists) {
                const userData = userDoc.data();

                // === CONTROL DE DISPOSITIVOS ACTIVOS ===
                // Aislado: si Firestore falla con este subsistema, NO bloquear login normal.
                if (window.SesionesActivas) {
                    try {
                        const limite = window.SesionesActivas.obtenerLimiteUsuario(userData);
                        const sesionesActuales = await window.SesionesActivas.listarSesionesActivas(user.uid);
                        const miDeviceId = window.SesionesActivas.generarDeviceId();

                        // Si este dispositivo ya tiene sesión registrada, no contarla doble
                        const yaTengoSesion = sesionesActuales.some(s => s.deviceId === miDeviceId);

                        if (!yaTengoSesion && sesionesActuales.length >= limite) {
                            // Excede el límite: pedir al usuario qué hacer
                            const accion = await this._pedirAccionLimiteDispositivos(sesionesActuales, limite);
                            if (accion?.tipo === 'expulsar' && accion.deviceId) {
                                await window.SesionesActivas.expulsarSesion(user.uid, accion.deviceId);
                            } else {
                                // Cancelar = cerrar este intento de login
                                await window.auth.signOut();
                                return;
                            }
                        }

                        // Registrar este dispositivo y arrancar latido
                        await window.SesionesActivas.registrarSesion(user, userData);
                        window.SesionesActivas.iniciarHeartbeat(user.uid);
                    } catch (sesErr) {
                        // Error del subsistema de dispositivos NO debe romper login.
                        console.warn('⚠️ Subsistema de dispositivos falló, continuando login:', sesErr);
                    }
                }
                // === FIN CONTROL DE DISPOSITIVOS ===

                this.currentUser = {
                    uid: user.uid,
                    email: user.email,
                    ...userData.personalInfo,
                    permissions: userData.permissions || {},
                    subPermisos: userData.subPermisos || {},
                    metadata: userData.metadata || {}
                };

                this.userPermissions = userData.permissions || {};
                this.isAuthenticated = true;

                await this.updateLastLogin(user.uid);
                this.hideLoginScreen();
                this.initializeMainApplication();

                // Escuchar cambios en tiempo real del documento del usuario
                // Si un admin cambia permisos o rol, recargar la página automáticamente
                this._startPermissionWatcher(user.uid);

                console.log('✅ Usuario autenticado:', this.currentUser.nombre || this.currentUser.email);
            } else {
                throw new Error('Usuario no encontrado en la base de datos');
            }
        } catch (error) {
            console.error('Error al cargar datos del usuario:', error);
            this.showNotification('Error al cargar el perfil de usuario', 'error');
            await this.logout();
        }
    }

    _pedirAccionLimiteDispositivos(sesiones, limite) {
        return new Promise((resolve) => {
            // Limpiar modal previo si existe
            const prev = document.getElementById('modal-limite-dispositivos');
            if (prev) prev.remove();

            const fmtFecha = (ts) => {
                try {
                    const d = ts?.toDate ? ts.toDate() : new Date(ts);
                    return d.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
                } catch { return '—'; }
            };

            const overlay = document.createElement('div');
            overlay.id = 'modal-limite-dispositivos';
            overlay.style.cssText = `
                position: fixed; inset: 0; background: rgba(0,0,0,0.55);
                display: flex; align-items: center; justify-content: center;
                z-index: 100000; padding: 16px;
            `;

            const sesionesHTML = sesiones.map((s, i) => `
                <div style="display:flex; align-items:center; gap:12px; padding:12px; background:#F8F8FA; border-radius:10px; margin-bottom:8px; border:1px solid #E5E5EA;">
                    <div style="flex:1;">
                        <div style="font-weight:600; color:#1C1C1E;">${s.deviceName || 'Dispositivo'}</div>
                        <div style="font-size:12px; color:#6D6D80;">Inició: ${fmtFecha(s.inicioSesion)}</div>
                        <div style="font-size:12px; color:#6D6D80;">Última actividad: ${fmtFecha(s.ultimoLatido)}</div>
                    </div>
                    <button data-device-id="${s.deviceId}" class="btn-expulsar-dispositivo"
                        style="padding:8px 14px; background:#FF3B30; color:white; border:none; border-radius:8px; font-weight:600; cursor:pointer;">
                        Cerrar este
                    </button>
                </div>
            `).join('');

            overlay.innerHTML = `
                <div style="background:white; border-radius:16px; max-width:480px; width:100%; max-height:90vh; overflow:auto; box-shadow:0 20px 60px rgba(0,0,0,0.3);">
                    <div style="padding:20px; border-bottom:1px solid #E5E5EA;">
                        <h3 style="margin:0 0 6px 0; font-size:18px; color:#1C1C1E;">⚠️ Demasiados dispositivos abiertos</h3>
                        <p style="margin:0; font-size:14px; color:#6D6D80;">
                            Tu cuenta ya tiene ${sesiones.length} de ${limite} dispositivos permitidos.
                            Cierra uno para poder entrar desde aquí.
                        </p>
                    </div>
                    <div style="padding:16px;">
                        ${sesionesHTML}
                    </div>
                    <div style="padding:14px 20px; border-top:1px solid #E5E5EA; display:flex; justify-content:flex-end;">
                        <button id="btn-cancelar-limite" style="padding:10px 18px; background:#E5E5EA; color:#1C1C1E; border:none; border-radius:10px; font-weight:600; cursor:pointer;">
                            Cancelar
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);

            overlay.querySelectorAll('.btn-expulsar-dispositivo').forEach(btn => {
                btn.onclick = () => {
                    const deviceId = btn.dataset.deviceId;
                    overlay.remove();
                    resolve({ tipo: 'expulsar', deviceId });
                };
            });

            document.getElementById('btn-cancelar-limite').onclick = () => {
                overlay.remove();
                resolve({ tipo: 'cancelar' });
            };
        });
    }

    _startPermissionWatcher(uid) {
        // Cancelar listener anterior si existe
        if (this._userDocUnsubscribe) {
            this._userDocUnsubscribe();
            this._userDocUnsubscribe = null;
        }

        let initialLoad = true;
        const loginTimestamp = Date.now();
        let reloadPending = false;

        // Serialización estable independiente del orden de claves
        const stableStringify = (obj) => {
            if (typeof obj !== 'object' || obj === null) return JSON.stringify(obj);
            return JSON.stringify(Object.keys(obj).sort().reduce((acc, k) => {
                acc[k] = (typeof obj[k] === 'object' && obj[k] !== null)
                    ? JSON.parse(stableStringify(obj[k]))
                    : obj[k];
                return acc;
            }, {}));
        };

        this._userDocUnsubscribe = window.db.collection('users').doc(uid).onSnapshot((doc) => {
            // Ignorar el primer disparo (datos iniciales ya cargados)
            if (initialLoad) {
                initialLoad = false;
                return;
            }

            if (!doc.exists || !this.isAuthenticated) return;

            // No recargar si la sesión tiene menos de 15 segundos (evitar falsos positivos al inicio)
            if (Date.now() - loginTimestamp < 15000) return;

            const data = doc.data();
            const nuevosPermisos = data.permissions || {};
            const nuevoRol = data.personalInfo?.rol;
            const rolActual = this.currentUser?.rol;

            // Comparación estable (independiente del orden de claves en el objeto)
            const cambioPermisos = stableStringify(nuevosPermisos) !== stableStringify(this.userPermissions);
            const cambioRol = nuevoRol && nuevoRol !== rolActual;

            if ((cambioPermisos || cambioRol) && !reloadPending) {
                reloadPending = true;
                console.log('🔄 Cambio real de permisos/rol detectado, recargando sesión...');
                if (window.eventBus) {
                    window.eventBus.emit(window.APP_EVENTS?.NOTIFICATION_SHOW || 'notification:show', {
                        message: 'Tu perfil fue actualizado por un administrador. Recargando...',
                        type: 'info'
                    });
                }
                setTimeout(() => window.location.reload(), 1800);
            }
        }, (error) => {
            console.warn('Error en watcher de permisos:', error);
        });
    }

    handleUserLogout() {
        if (this._userDocUnsubscribe) {
            this._userDocUnsubscribe();
            this._userDocUnsubscribe = null;
        }
        // Detener heartbeat de sesión activa (cualquier ruta de signOut)
        if (window.SesionesActivas) {
            try { window.SesionesActivas.detenerHeartbeat(); } catch (e) {}
        }
        this.currentUser = null;
        this.userPermissions = {};
        this.isAuthenticated = false;

        const sidebar = document.getElementById('sidebar');
        const mainContainer = document.querySelector('.main-container');
        if (sidebar) sidebar.style.display = 'none';
        if (mainContainer) mainContainer.style.display = 'none';

        const loginOverlay = document.querySelector('.login-overlay');
        if (!loginOverlay) {
            this.showLoginScreen();
        } else {
            // Remover overlay actual y recrear con nombre actualizado
            loginOverlay.remove();
            this.showLoginScreen();
        }

        console.log('👤 Usuario desconectado');
    }

    async updateLastLogin(uid) {
        try {
            await window.db.collection('users').doc(uid).update({
                'metadata.lastLogin': new Date()
            });
        } catch (error) {
            console.warn('No se pudo actualizar último login:', error);
        }
    }

    resetLoginForm() {
        const emailInput = document.getElementById('login-email');
        const passwordInput = document.getElementById('login-password');

        // Siempre cargar el email guardado
        if (emailInput) {
            emailInput.classList.remove('error');
            this.loadSavedEmail();
        }

        if (passwordInput) {
            passwordInput.value = '';
            passwordInput.classList.remove('error');
        }

        this.hideLoginError();
        this.showLoginLoading(false);

        setTimeout(() => {
            if (emailInput && !emailInput.value) {
                emailInput.focus();
            } else if (passwordInput) {
                passwordInput.focus();
            }
        }, 150);
    }

    getLocalStorage(key) {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            console.warn('⚠️ localStorage no disponible:', e.message);
            return null;
        }
    }

    setLocalStorage(key, value) {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (e) {
            console.warn('⚠️ No se pudo guardar en localStorage:', e.message);
            return false;
        }
    }

    loadSavedEmail() {
        const savedEmail = this.getLocalStorage('app_remembered_email');
        const emailInput = document.getElementById('login-email');

        if (savedEmail && emailInput) {
            emailInput.value = savedEmail;

            setTimeout(() => {
                const passwordInput = document.getElementById('login-password');
                if (passwordInput) {
                    passwordInput.focus();
                }
            }, 100);
        }
    }

    saveEmailIfRequested(email) {
        // Siempre guardar el email
        this.setLocalStorage('app_remembered_email', email);
    }

    updateBusinessName(newName) {
        if (newName && typeof newName === 'string') {
            this.cachedBusinessName = newName;
            console.log('🏪 Nombre del negocio actualizado en cache:', newName);
            
            const loginTitle = document.querySelector('.login-title');
            if (loginTitle) {
                loginTitle.textContent = newName;
                console.log('🔄 Título de login actualizado en vivo');
            }
        }
    }

    async showLoginScreen() {
        let nombreNegocio = this.cachedBusinessName || 'Estanquillo';
        try {
            const configDoc = await window.db.collection('configuracion').doc('general').get();
            if (configDoc.exists) {
                const configData = configDoc.data();
                if (configData.negocio && configData.negocio.nombre) {
                    nombreNegocio = configData.negocio.nombre;
                    this.cachedBusinessName = nombreNegocio;
                }
            }
        } catch (error) {
            console.warn('No se pudo cargar el nombre del negocio, usando nombre por defecto:', error);
        }

        const overlay = document.createElement('div');
        overlay.className = 'login-overlay';
        overlay.innerHTML = `
            <div class="login-container" id="login-container">
                <div class="login-header">
                    <div class="login-logo">
                        <svg class="logo-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M3 9L12 2L21 9V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V9Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M9 22V12H15V22" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </div>
                    <h2 class="login-title">${nombreNegocio}</h2>
                    <p class="login-subtitle">Sistema de Gestión Empresarial</p>
                </div>

                <div class="login-content">
                    <form id="login-form" class="login-form">
                        <div class="form-group">
                            <label for="login-email">
                                <svg class="label-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M4 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M22 6L12 13L2 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                                Correo electrónico
                            </label>
                            <div class="email-selector-wrapper">
                                <svg class="input-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M4 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M22 6L12 13L2 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                                <input 
                                    type="email" 
                                    id="login-email" 
                                    name="email" 
                                    autocomplete="off"
                                    placeholder="Escribe o selecciona un correo"
                                    required
                                >
                                <button type="button" class="email-dropdown-toggle" id="email-dropdown-toggle">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="6 9 12 15 18 9"></polyline>
                                    </svg>
                                </button>
                                <div class="email-dropdown" id="email-dropdown">
                                    <div class="email-dropdown-header">
                                        <span>Usuarios registrados</span>
                                    </div>
                                    <div class="email-dropdown-list" id="email-dropdown-list">
                                        <div class="email-dropdown-empty">Cargando usuarios...</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="form-group password-group">
                            <label for="login-password">
                                <svg class="label-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M7 11V7C7 5.67392 7.52678 4.40215 8.46447 3.46447C9.40215 2.52678 10.6739 2 12 2C13.3261 2 14.5979 2.52678 15.5355 3.46447C16.4732 4.40215 17 5.67392 17 7V11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                                Contraseña
                            </label>
                            <div class="input-wrapper password-input-wrapper">
                                <svg class="input-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M7 11V7C7 5.67392 7.52678 4.40215 8.46447 3.46447C9.40215 2.52678 10.6739 2 12 2C13.3261 2 14.5979 2.52678 15.5355 3.46447C16.4732 4.40215 17 5.67392 17 7V11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                                <input 
                                    type="password" 
                                    id="login-password" 
                                    name="password"
                                    autocomplete="new-password"
                                    placeholder="••••••••"
                                    value=""
                                    required
                                >
                                <button type="button" class="toggle-password" id="toggle-password">
                                    <svg class="eye-icon eye-open" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                        <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    </svg>
                                    <svg class="eye-icon eye-closed" style="display: none;" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M17.94 17.94C16.2306 19.243 14.1491 19.9649 12 20C5 20 1 12 1 12C2.24389 9.68192 3.96914 7.65663 6.06 6.06M9.9 4.24C10.5883 4.0789 11.2931 3.99836 12 4C19 4 23 12 23 12C22.393 13.1356 21.6691 14.2048 20.84 15.19M14.12 14.12C13.8454 14.4148 13.5141 14.6512 13.1462 14.8151C12.7782 14.9791 12.3809 15.0673 11.9781 15.0744C11.5753 15.0815 11.1752 15.0074 10.8016 14.8565C10.4281 14.7056 10.0887 14.4811 9.80385 14.1962C9.51897 13.9113 9.29439 13.5719 9.14351 13.1984C8.99262 12.8248 8.91853 12.4247 8.92563 12.0219C8.93274 11.6191 9.02091 11.2218 9.18488 10.8538C9.34884 10.4859 9.58525 10.1546 9.88 9.88" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                        <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <button type="submit" class="login-btn" id="login-btn">
                            <svg class="btn-icon login-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M15 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M10 17L15 12L10 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M15 12H3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            <span class="login-btn-text">Iniciar Sesión</span>
                            <div class="login-spinner" style="display: none;">
                                <svg class="spinner-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" opacity="0.25"/>
                                    <path d="M12 2C6.47715 2 2 6.47715 2 12" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
                                </svg>
                            </div>
                        </button>

                        <div id="login-error" class="login-error" style="display: none;">
                            <svg class="error-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                                <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                                <circle cx="12" cy="16" r="1" fill="currentColor"/>
                            </svg>
                            <span class="error-text"></span>
                        </div>
                    </form>
                </div>

                <div class="login-footer">
                    <p>Sistema de Gestión Empresarial v2.0</p>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Agregar orbe de acento animado al fondo
        const orbAccent = document.createElement('div');
        orbAccent.className = 'login-orb-accent';
        overlay.appendChild(orbAccent);

        this.handleMobileKeyboardZoom();
        this.setupLoginEventListeners();
    }

    handleMobileKeyboardZoom() {
        const loginContainer = document.getElementById('login-container');
        const inputs = document.querySelectorAll('#login-form input');

        if (!loginContainer || inputs.length === 0) return;

        inputs.forEach(input => {
            input.addEventListener('focus', () => {
                loginContainer.classList.add('keyboard-open');
                setTimeout(() => {
                    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 300);
            });

            input.addEventListener('blur', () => {
                setTimeout(() => {
                    loginContainer.classList.remove('keyboard-open');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }, 100);
            });
        });

        let initialHeight = window.innerHeight;
        window.addEventListener('resize', () => {
            const currentHeight = window.innerHeight;

            if (initialHeight - currentHeight > 150) {
                loginContainer.classList.add('keyboard-open');
            } else if (currentHeight > initialHeight - 50) {
                loginContainer.classList.remove('keyboard-open');
            }
        });
    }

    hideLoginScreen() {
        const loginOverlay = document.querySelector('.login-overlay');
        const loginContainer = document.getElementById('login-container');

        const sidebar = document.getElementById('sidebar');
        const mainContainer = document.querySelector('.main-container');

        if (loginOverlay && loginContainer) {
            // Añadir animación de éxito
            loginContainer.classList.add('login-success');

            const successOverlay = document.createElement('div');
            successOverlay.className = 'login-success-overlay';
            successOverlay.innerHTML = `
                <div class="login-success-check">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                </div>
                <div class="login-success-text">¡Bienvenido!</div>
            `;
            loginContainer.appendChild(successOverlay);

            // Revelar la app detrás
            if (sidebar) sidebar.style.display = 'flex';
            if (mainContainer) mainContainer.style.display = 'flex';

            // Fade out del overlay después de la animación
            setTimeout(() => {
                loginOverlay.classList.add('fade-out');
                setTimeout(() => {
                    loginOverlay.style.display = 'none';
                    loginOverlay.classList.remove('fade-out');
                }, 500);
            }, 800);
        } else {
            if (loginOverlay) loginOverlay.style.display = 'none';
            if (sidebar) sidebar.style.display = 'flex';
            if (mainContainer) mainContainer.style.display = 'flex';
        }
    }

    setupLoginEventListeners() {
        const loginForm = document.getElementById('login-form');
        const togglePassword = document.getElementById('toggle-password');
        const passwordInput = document.getElementById('login-password');
        const emailInput = document.getElementById('login-email');
        const dropdownToggle = document.getElementById('email-dropdown-toggle');

        this.populateEmailSuggestions();

        if (dropdownToggle) {
            dropdownToggle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleEmailDropdown();
            });
        }

        if (emailInput) {
            emailInput.addEventListener('focus', () => {
                if (!this.userEmails || this.userEmails.length === 0) {
                    this.loadUserEmails();
                } else {
                    this.populateEmailSuggestions();
                }
            });

            emailInput.addEventListener('input', () => {
                this.filterEmailDropdown(emailInput.value);
            });
        }

        document.addEventListener('click', (e) => {
            const dropdown = document.getElementById('email-dropdown');
            const toggle = document.getElementById('email-dropdown-toggle');
            const wrapper = document.querySelector('.email-selector-wrapper');
            
            if (dropdown && wrapper && !wrapper.contains(e.target)) {
                this.closeEmailDropdown();
            }
        });

        if (togglePassword && passwordInput) {
            togglePassword.addEventListener('click', (e) => {
                e.preventDefault();
                const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
                passwordInput.setAttribute('type', type);

                const eyeOpen = togglePassword.querySelector('.eye-open');
                const eyeClosed = togglePassword.querySelector('.eye-closed');

                if (type === 'password') {
                    eyeOpen.style.display = 'block';
                    eyeClosed.style.display = 'none';
                } else {
                    eyeOpen.style.display = 'none';
                    eyeClosed.style.display = 'block';
                }

                togglePassword.style.transform = 'scale(0.9)';
                setTimeout(() => {
                    togglePassword.style.transform = 'scale(1)';
                }, 100);
            });
        }

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;

            this.showLoginLoading(true);
            this.hideLoginError();

            try {
                await window.auth.signInWithEmailAndPassword(email, password);
                this.saveEmailIfRequested(email);
            } catch (error) {
                this.showLoginError(this.getAuthErrorMessage(error.code));
                this.showLoginLoading(false);
            }
        });
    }

    populateEmailSuggestions() {
        const dropdownList = document.getElementById('email-dropdown-list');
        if (!dropdownList) {
            console.warn('⚠️ Dropdown #email-dropdown-list no encontrado');
            return;
        }

        console.log('🔄 Poblando dropdown de emails...');
        dropdownList.innerHTML = '';

        if (!Array.isArray(this.userEmails)) {
            console.error('❌ this.userEmails NO es un array:', this.userEmails);
            this.userEmails = [];
            dropdownList.innerHTML = '<div class="email-dropdown-empty">No hay usuarios disponibles</div>';
            return;
        }

        console.log('📧 Emails disponibles:', this.userEmails);

        if (this.userEmails.length > 0) {
            this.userEmails.forEach((email, index) => {
                if (email && typeof email === 'string' && email.includes('@')) {
                    const item = document.createElement('div');
                    item.className = 'email-dropdown-item';
                    item.setAttribute('data-email', email);
                    item.innerHTML = `
                        <svg class="email-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                        <span class="email-item-text">${email}</span>
                    `;
                    item.addEventListener('click', () => this.selectEmail(email));
                    dropdownList.appendChild(item);
                    console.log('➕ Email agregado al dropdown:', email);
                }
            });
            console.log(`✅ ${this.userEmails.length} emails agregados al selector`);
        } else {
            dropdownList.innerHTML = '<div class="email-dropdown-empty">No hay usuarios registrados</div>';
            console.warn('⚠️ No hay emails disponibles para el selector');
        }
    }

    selectEmail(email) {
        const emailInput = document.getElementById('login-email');
        if (emailInput) {
            emailInput.value = email;
            emailInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        this.closeEmailDropdown();
        
        const passwordInput = document.getElementById('login-password');
        if (passwordInput) {
            setTimeout(() => passwordInput.focus(), 100);
        }
    }

    toggleEmailDropdown() {
        const dropdown = document.getElementById('email-dropdown');
        const toggle = document.getElementById('email-dropdown-toggle');
        
        if (dropdown) {
            const isOpen = dropdown.classList.contains('open');
            if (isOpen) {
                this.closeEmailDropdown();
            } else {
                dropdown.classList.add('open');
                if (toggle) toggle.classList.add('open');
            }
        }
    }

    closeEmailDropdown() {
        const dropdown = document.getElementById('email-dropdown');
        const toggle = document.getElementById('email-dropdown-toggle');
        
        if (dropdown) dropdown.classList.remove('open');
        if (toggle) toggle.classList.remove('open');
    }

    filterEmailDropdown(searchText) {
        const items = document.querySelectorAll('.email-dropdown-item');
        const search = searchText.toLowerCase().trim();
        let hasVisible = false;

        items.forEach(item => {
            const email = item.getAttribute('data-email').toLowerCase();
            if (email.includes(search) || search === '') {
                item.style.display = 'flex';
                hasVisible = true;
            } else {
                item.style.display = 'none';
            }
        });

        const emptyMsg = document.querySelector('.email-dropdown-empty');
        if (emptyMsg) {
            emptyMsg.style.display = hasVisible ? 'none' : 'block';
            if (!hasVisible) {
                emptyMsg.textContent = 'No se encontraron coincidencias';
            }
        }
    }

    showLoginLoading(loading) {
        const loginBtn = document.getElementById('login-btn');
        if (!loginBtn) return;

        const btnText = loginBtn.querySelector('.login-btn-text');
        const loginIcon = loginBtn.querySelector('.login-icon');
        const spinner = loginBtn.querySelector('.login-spinner');

        if (!btnText || !spinner) {
            console.warn('Login button elements not found');
            return;
        }

        if (loading) {
            btnText.style.display = 'none';
            if (loginIcon) loginIcon.style.display = 'none';
            spinner.style.display = 'flex';
            loginBtn.disabled = true;
        } else {
            btnText.style.display = 'inline-block';
            if (loginIcon) loginIcon.style.display = 'block';
            spinner.style.display = 'none';
            loginBtn.disabled = false;
        }
    }

    showLoginError(message) {
        const loginError = document.getElementById('login-error');
        const errorText = loginError.querySelector('.error-text');
        if (errorText) {
            errorText.textContent = message;
        }
        loginError.style.display = 'flex';
    }

    hideLoginError() {
        const loginError = document.getElementById('login-error');
        if (loginError) {
            loginError.style.display = 'none';
        }
    }

    getAuthErrorMessage(errorCode) {
        const errorMessages = {
            'auth/user-not-found': 'Usuario no encontrado',
            'auth/wrong-password': 'Contraseña incorrecta',
            'auth/invalid-email': 'Correo electrónico inválido',
            'auth/user-disabled': 'Usuario deshabilitado',
            'auth/too-many-requests': 'Demasiados intentos. Intenta más tarde',
            'auth/network-request-failed': 'Error de conexión. Verifica tu internet',
            'auth/invalid-credential': 'Credenciales inválidas. Verifica tu correo y contraseña'
        };

        return errorMessages[errorCode] || 'Error al iniciar sesión. Intenta nuevamente';
    }

    initializeMainApplication() {
        this.filterNavigationByPermissions();
        this.updateUserInterface();

        // Asegurar que businessSystem existe y está inicializado
        if (!window.businessSystem) {
            console.log('🔄 Inicializando BusinessManagementSystem...');
            window.businessSystem = new BusinessManagementSystem();
        }
        
        // Disparar evento de autenticación para widgets
        document.dispatchEvent(new CustomEvent('authStateChanged', {
            detail: {
                authenticated: true,
                user: this.currentUser
            }
        }));
        
        // Cargar notas internas al autenticarse (módulo inicial)
        // Se ejecuta después de que la interfaz está lista
        setTimeout(() => {
            if (window.businessSystem) {
                console.log('📝 Cargando Notas Internas (módulo inicial)...');
                window.businessSystem.loadModule('notas');
            }
        }, 50);
    }

    filterNavigationByPermissions() {
        const navItems = document.querySelectorAll('.nav-item');

        navItems.forEach(item => {
            const module = item.dataset.module;

            if (this.hasPermission(module)) {
                item.style.display = 'block';
            } else {
                item.style.display = 'none';
            }
        });
    }

    updateUserInterface() {
        const userNameElement = document.querySelector('.user-name');
        const userRoleElement = document.querySelector('.user-role');

        if (userNameElement && this.currentUser.nombre) {
            userNameElement.textContent = this.currentUser.nombre;
        }

        if (userRoleElement && this.currentUser.rol) {
            const roleDisplayName = this.getRoleDisplayName(this.currentUser.rol);
            userRoleElement.textContent = roleDisplayName;
        }

        this.addLogoutButton();
    }

    addLogoutButton() {
        // Manejado por app-drawer
    }

    getRoleDisplayName(role) {
        const roles = {
            'administrador': 'Administrador',
            'supervisor': 'Supervisor',
            'vendedor': 'Vendedor'
        };
        return roles[role] || 'Usuario';
    }

    hasPermission(module) {
        if (this.currentUser?.rol === 'administrador') {
            return true;
        }

        return this.userPermissions[module] === true;
    }

    hasSubPermission(module, subPermission) {
        if (this.currentUser?.rol === 'administrador') {
            return true;
        }

        if (!this.hasPermission(module)) {
            return false;
        }

        const subPermisos = this.currentUser?.subPermisos || {};
        const moduleSubPermisos = subPermisos[module] || {};
        
        if (moduleSubPermisos[subPermission] === true) {
            return true;
        }
        
        if (moduleSubPermisos[subPermission] === false) {
            return false;
        }
        
        return true;
    }

    getSubPermissionsConfig() {
        return {
            caja: {
                label: 'Caja',
                permisos: {
                    historial: { label: 'Ver Historial de Cajas', description: 'Acceso a la pestaña de historial' }
                }
            },
            ventas: {
                label: 'Ventas',
                permisos: {
                    cancelarVenta: { label: 'Cancelar Ventas', description: 'Permite cancelar ventas realizadas' }
                }
            },
            inventario: {
                label: 'Inventario',
                permisos: {
                    simulacion: { label: 'Pestaña Simulación', description: 'Acceso a simulación de pedidos' },
                    preciosClientes: { label: 'Pestaña Precios Clientes', description: 'Ver precios especiales por cliente' },
                    nuevoProducto: { label: 'Crear Productos', description: 'Permite agregar nuevos productos' },
                    categorias: { label: 'Gestionar Categorías', description: 'Crear y editar categorías' },
                    editarProducto: { label: 'Editar Productos', description: 'Modificar productos existentes' },
                    eliminarProducto: { label: 'Eliminar Productos', description: 'Permite eliminar productos' }
                }
            }
        };
    }

    async showLogoutConfirmation() {
        const userId = this.currentUser?.uid;
        if (userId) {
            const cajaAbiertaId = localStorage.getItem(`caja_abierta_${userId}`);

            if (cajaAbiertaId) {
                try {
                    const cajaDoc = await window.db.collection('cajas').doc(cajaAbiertaId).get();
                    if (cajaDoc.exists && cajaDoc.data().estado === 'abierta') {
                        this.showNotification('⚠️ No puedes cerrar sesión mientras tengas una caja abierta. Cierra la caja primero.', 'error');
                        return;
                    } else {
                        localStorage.removeItem(`caja_abierta_${userId}`);
                    }
                } catch (error) {
                    console.warn('Error verificando estado de caja:', error);
                }
            }
        }

        const existingModal = document.getElementById('logout-confirmation-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const modalHTML = `
            <div id="logout-confirmation-modal" class="modal active">
                <div class="modal-content" style="background: rgba(255, 255, 255, 0.25); backdrop-filter: blur(60px) saturate(200%); -webkit-backdrop-filter: blur(60px) saturate(200%); border: 1px solid rgba(255, 255, 255, 0.4); box-shadow: 0 32px 64px rgba(0, 0, 0, 0.4); border-radius: 24px; padding: 32px; max-width: 400px; text-align: center;">
                    <h2 style="margin: 0 0 16px 0; font-size: 1.5rem; font-weight: 700;">🚪 Cerrar Sesión</h2>
                    <p style="margin: 0 0 24px 0; color: rgba(0, 0, 0, 0.7); font-size: 1rem;">¿Estás seguro que deseas cerrar sesión?</p>
                    <div style="display: flex; gap: 12px; justify-content: center;">
                        <button id="cancel-logout-btn" style="flex: 1; padding: 12px 24px; border: none; border-radius: 12px; background: rgba(0, 0, 0, 0.05); color: #000; font-weight: 600; cursor: pointer; transition: all 0.3s ease;">
                            Cancelar
                        </button>
                        <button id="confirm-logout-btn" style="flex: 1; padding: 12px 24px; border: none; border-radius: 12px; background: linear-gradient(135deg, #FF3B30, #FF6482); color: white; font-weight: 600; cursor: pointer; transition: all 0.3s ease; box-shadow: 0 4px 12px rgba(255, 59, 48, 0.3);">
                            Cerrar Sesión
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        const modal = document.getElementById('logout-confirmation-modal');
        const cancelBtn = document.getElementById('cancel-logout-btn');
        const confirmBtn = document.getElementById('confirm-logout-btn');

        const closeModal = () => {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        };

        cancelBtn.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        confirmBtn.addEventListener('click', async () => {
            closeModal();
            await this.logout();
        });

        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleEsc);
            }
        };
        document.addEventListener('keydown', handleEsc);
    }

    async logout() {
        const userId = this.currentUser?.uid;
        if (userId) {
            const cajaAbiertaId = this.getLocalStorage(`caja_abierta_${userId}`);

            if (cajaAbiertaId) {
                try {
                    const cajaDoc = await window.db.collection('cajas').doc(cajaAbiertaId).get();
                    if (cajaDoc.exists && cajaDoc.data().estado === 'abierta') {
                        this.showNotification('⚠️ No puedes cerrar sesión mientras tengas una caja abierta. Cierra la caja primero.', 'error');
                        return;
                    }
                } catch (error) {
                    console.warn('Error verificando estado de caja:', error);
                }
            }

            // Cerrar mi propia sesión activa de este dispositivo
            if (window.SesionesActivas) {
                window.SesionesActivas.detenerHeartbeat();
                try {
                    await window.SesionesActivas.cerrarSesion(userId);
                } catch (e) {
                    console.warn('No se pudo borrar sesión activa:', e);
                }
            }
        }

        try {
            await window.auth.signOut();
            console.log('✅ Sesión cerrada exitosamente');
        } catch (error) {
            console.error('Error al cerrar sesión:', error);
            this.showNotification('Error al cerrar sesión: ' + error.message, 'error');
        }
    }

    canAccessModule(moduleName) {
        if (!this.isAuthenticated) {
            return false;
        }

        return this.hasPermission(moduleName);
    }

    showNotification(message, type = 'info') {
        if (window.eventBus) {
            window.eventBus.emit(window.APP_EVENTS.NOTIFICATION_SHOW, {
                message,
                type
            });
            return;
        }

        console.log(`${type.toUpperCase()}: ${message}`);

        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 16px 24px;
            background: ${type === 'success' ? '#34C759' : type === 'error' ? '#FF3B30' : '#007AFF'};
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 10000;
            font-weight: 500;
        `;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }

    getCurrentUser() {
        return this.currentUser;
    }

    isUserAuthenticated() {
        return this.isAuthenticated && this.currentUser !== null;
    }
}

window.authSystem = new AuthenticationSystem();