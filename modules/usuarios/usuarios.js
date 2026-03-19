
// Módulo de Usuarios - Lógica independiente
class UsuariosModule {
    constructor() {
        this.usuarios = [];
        this.currentStep = 1;
        this.editingUser = null;
        this.moduleId = 'usuarios';
        this.eventListeners = [];
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadUsuarios();
        this.renderUsuarios();
    }

    setupEventListeners() {
        // Botón nuevo usuario
        document.getElementById('btn-nuevo-usuario').addEventListener('click', () => {
            this.openModal();
        });

        // Cerrar modal
        document.getElementById('modal-close').addEventListener('click', () => {
            this.closeModal();
        });

        // Búsqueda
        document.getElementById('search-usuarios').addEventListener('input', (e) => {
            this.filterUsuarios(e.target.value);
        });

        // Filtros
        document.getElementById('filter-rol').addEventListener('change', () => {
            this.applyFilters();
        });

        document.getElementById('filter-estado').addEventListener('change', () => {
            this.applyFilters();
        });

        // Navegación del formulario
        document.getElementById('btn-siguiente').addEventListener('click', () => {
            this.nextStep();
        });

        document.getElementById('btn-anterior').addEventListener('click', () => {
            this.previousStep();
        });

        // Envío del formulario
        document.getElementById('form-usuario').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveUsuario();
        });

        // Cambio de rol para permisos automáticos
        document.getElementById('rol').addEventListener('change', (e) => {
            this.updatePermissionsByRole(e.target.value);
        });
    }

    async loadUsuarios() {
        try {
            // 🚀 OPTIMIZACIÓN: Usar caché para reducir queries
            if (window.cacheManager) {
                this.usuarios = await window.cacheManager.getOrFetch('usuarios_cache', async () => {
                    const querySnapshot = await window.db.collection('users').get();
                    const usuarios = [];
                    
                    querySnapshot.forEach((doc) => {
                        const userData = doc.data();
                        usuarios.push({
                            id: doc.id,
                            ...userData
                        });
                    });
                    
                    return usuarios;
                });
            } else {
                // Fallback si cache-manager no está disponible
                const querySnapshot = await window.db.collection('users').get();
                this.usuarios = [];
                
                querySnapshot.forEach((doc) => {
                    const userData = doc.data();
                    this.usuarios.push({
                        id: doc.id,
                        ...userData
                    });
                });
            }
            
            console.log(`✅ ${this.usuarios.length} usuarios cargados`);
        } catch (error) {
            console.error('Error al cargar usuarios:', error);
            this.showNotification('Error al cargar usuarios', 'error');
        }
    }

    renderUsuarios(usuarios = this.usuarios) {
        const tbody = document.getElementById('usuarios-table-body');

        if (usuarios.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px; color: #6D6D80;">
                        <svg style="width: 64px; height: 64px; margin-bottom: 16px; color: #C7C7CC;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                        <div>No hay usuarios registrados</div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = usuarios.map(usuario => {
            const rolIcons = {
                administrador: '<svg class="badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5M2 12l10 5 10-5"></path></svg>',
                supervisor: '<svg class="badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
                vendedor: '<svg class="badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>'
            };

            const estadoIcons = {
                active: '<svg class="badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>',
                inactive: '<svg class="badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>'
            };

            const rol = usuario.personalInfo?.rol || 'vendedor';
            const status = usuario.metadata?.status || 'active';

            return `
                <tr>
                    <td>
                        <div class="usuario-info">
                            <div class="usuario-avatar">
                                ${this.getInitials(usuario.personalInfo?.nombre || 'Usuario')}
                            </div>
                            <div class="usuario-nombre">
                                ${usuario.personalInfo?.nombre || 'Sin nombre'}
                            </div>
                        </div>
                    </td>
                    <td>${usuario.personalInfo?.email || 'Sin email'}</td>
                    <td>
                        <span class="rol-badge rol-${rol}">
                            ${rolIcons[rol] || ''}
                            ${this.getRolDisplayName(rol)}
                        </span>
                    </td>
                    <td>
                        <span class="estado-badge estado-${status}">
                            ${estadoIcons[status] || ''}
                            ${status === 'active' ? 'Activo' : 'Inactivo'}
                        </span>
                    </td>
                    <td>${this.formatDate(usuario.metadata?.lastLogin)}</td>
                    <td>
                        <div class="acciones-usuario">
                            <button class="btn-accion btn-editar" onclick="usuariosModule.editUsuario('${usuario.id}')" title="Editar usuario">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                            </button>
                            <button class="btn-accion btn-eliminar" onclick="usuariosModule.deleteUsuario('${usuario.id}')" title="Eliminar usuario">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    getInitials(nombre) {
        return nombre.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
    }

    getRolDisplayName(rol) {
        const roles = {
            'administrador': 'Administrador',
            'supervisor': 'Supervisor',
            'vendedor': 'Vendedor'
        };
        return roles[rol] || 'Vendedor';
    }

    formatDate(timestamp) {
        if (!timestamp) return 'Nunca';

        try {
            let date;
            if (timestamp.toDate) {
                // Firestore Timestamp nativo
                date = timestamp.toDate();
            } else if (timestamp._seconds !== undefined) {
                // Timestamp serializado por JSON (cache localStorage)
                date = new Date(timestamp._seconds * 1000);
            } else if (timestamp.seconds !== undefined) {
                // Variante alternativa de serialización
                date = new Date(timestamp.seconds * 1000);
            } else {
                date = new Date(timestamp);
            }

            if (isNaN(date.getTime())) return 'Nunca';

            return new Intl.DateTimeFormat('es-CO', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }).format(date);
        } catch (error) {
            return 'Nunca';
        }
    }

    filterUsuarios(searchTerm) {
        const filtered = this.usuarios.filter(usuario => {
            const nombre = usuario.personalInfo?.nombre?.toLowerCase() || '';
            const email = usuario.personalInfo?.email?.toLowerCase() || '';
            const search = searchTerm.toLowerCase();

            return nombre.includes(search) || email.includes(search);
        });

        this.renderUsuarios(filtered);
    }

    applyFilters() {
        const rolFilter = document.getElementById('filter-rol').value;
        const estadoFilter = document.getElementById('filter-estado').value;
        const searchTerm = document.getElementById('search-usuarios').value;

        let filtered = this.usuarios;

        if (rolFilter) {
            filtered = filtered.filter(usuario => usuario.personalInfo?.rol === rolFilter);
        }

        if (estadoFilter) {
            filtered = filtered.filter(usuario => usuario.metadata?.status === estadoFilter);
        }

        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            filtered = filtered.filter(usuario => {
                const nombre = usuario.personalInfo?.nombre?.toLowerCase() || '';
                const email = usuario.personalInfo?.email?.toLowerCase() || '';
                return nombre.includes(search) || email.includes(search);
            });
        }

        this.renderUsuarios(filtered);
    }

    openModal(usuario = null) {
        this.editingUser = usuario;
        this.currentStep = 1;

        const modal = document.getElementById('modal-usuario');
        const title = document.getElementById('modal-title');
        const passwordInput = document.getElementById('password');
        const passwordRequired = document.getElementById('password-required');
        const passwordHint = document.getElementById('password-hint');
        const btnGuardar = document.getElementById('btn-guardar');

        if (usuario) {
            title.innerHTML = `
                <svg class="modal-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
                <span>Editar Usuario</span>
            `;
            this.populateForm(usuario);

            // Cambiar texto del botón a "Guardar Cambios"
            if (btnGuardar) {
                btnGuardar.textContent = 'Guardar Cambios';
            }

            // Al editar, la contraseña es opcional
            if (passwordInput) {
                passwordInput.removeAttribute('required');
                passwordInput.value = '';
                passwordInput.placeholder = 'Dejar en blanco para no restablecer';
            }
            if (passwordRequired) {
                passwordRequired.style.display = 'none';
            }
            if (passwordHint) {
                passwordHint.textContent = 'Si ingresas una contraseña, se enviará un correo de restablecimiento al usuario';
            }
        } else {
            title.innerHTML = `
                <svg class="modal-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                </svg>
                <span>Nuevo Usuario</span>
            `;
            this.resetForm();

            // Cambiar texto del botón a "Guardar Usuario"
            if (btnGuardar) {
                btnGuardar.textContent = 'Guardar Usuario';
            }

            // Al crear, la contraseña es obligatoria
            if (passwordInput) {
                passwordInput.setAttribute('required', '');
                passwordInput.placeholder = '';
            }
            if (passwordRequired) {
                passwordRequired.style.display = 'inline';
            }
            if (passwordHint) {
                passwordHint.textContent = 'Mínimo 8 caracteres';
            }
        }

        // ✅ Configurar validación en tiempo real
        setTimeout(() => {
            const validationRules = {
                nombre: ['required', { type: 'minLength', value: 3 }],
                email: ['required', 'email'],
                rol: ['required']
            };

            if (!this.editingUser) {
                validationRules.password = ['required', 'password'];
            }

            window.formValidator?.setupRealtimeValidation(
                document.getElementById('form-usuario'),
                validationRules
            );
        }, 100);

        // RESETEO COMPLETO del modal antes de abrir
        modal.style.display = ''; // Resetear display
        modal.removeAttribute('style');
        modal.classList.remove('active'); // Remover primero
        
        const modalContent = modal.querySelector('.modal-content');
        if (modalContent) {
            modalContent.removeAttribute('style');
            modalContent.scrollTop = 0;
        }
        
        this.showStep(1);
        
        // Forzar reflow para que el navegador aplique los cambios
        void modal.offsetHeight;
        
        // Ahora sí, activar el modal
        modal.classList.add('active');
    }

    closeModal() {
        const modal = document.getElementById('modal-usuario');
        const modalContent = modal.querySelector('.modal-content');
        
        // Remover clase active
        modal.classList.remove('active');
        
        // Limpiar cualquier estilo inline residual
        modal.removeAttribute('style');
        if (modalContent) {
            modalContent.removeAttribute('style');
        }
        
        // Resetear scroll a la parte superior
        if (modalContent) {
            modalContent.scrollTop = 0;
        }
        
        this.resetForm();
    }

    resetForm() {
        document.getElementById('form-usuario').reset();
        this.currentStep = 1;
        this.editingUser = null;

        // Resetear permisos de módulos
        document.querySelectorAll('input[name="permisos"]').forEach(checkbox => {
            checkbox.checked = false;
        });

        // Resetear sub-permisos (todos marcados por defecto)
        document.querySelectorAll('input[name="subPermisos"]').forEach(checkbox => {
            checkbox.checked = true;
        });

        // Ocultar todas las secciones de sub-permisos
        this.updateSubPermisosVisibility();
    }

    populateForm(usuario) {
        document.getElementById('nombre').value = usuario.personalInfo?.nombre || '';
        document.getElementById('email').value = usuario.personalInfo?.email || '';
        document.getElementById('rol').value = usuario.personalInfo?.rol || '';

        // Cargar permisos de módulos
        const permisos = usuario.permissions || {};
        document.querySelectorAll('input[name="permisos"]').forEach(checkbox => {
            checkbox.checked = permisos[checkbox.value] || false;
        });

        // Cargar sub-permisos
        const subPermisos = usuario.subPermisos || {};
        document.querySelectorAll('input[name="subPermisos"]').forEach(checkbox => {
            const [modulo, permiso] = checkbox.value.split('.');
            const moduleSubPermisos = subPermisos[modulo] || {};

            // Si no existe el sub-permiso, marcarlo como true por defecto
            if (moduleSubPermisos[permiso] === undefined) {
                checkbox.checked = true;
            } else {
                checkbox.checked = moduleSubPermisos[permiso];
            }
        });

        // Actualizar visibilidad de sub-permisos
        this.updateSubPermisosVisibility();
    }

    showStep(step) {
        document.getElementById('step-1').style.display = step === 1 ? 'block' : 'none';
        document.getElementById('step-2').style.display = step === 2 ? 'block' : 'none';
        document.getElementById('step-3').style.display = step === 3 ? 'block' : 'none';

        document.getElementById('btn-anterior').style.display = step === 1 ? 'none' : 'inline-block';
        document.getElementById('btn-siguiente').style.display = step === 3 ? 'none' : 'inline-block';
        document.getElementById('btn-guardar').style.display = step === 3 ? 'inline-block' : 'none';

        // Actualizar visibilidad de sub-permisos cuando llegamos al paso 3
        if (step === 3) {
            this.updateSubPermisosVisibility();
        }
    }

    nextStep() {
        if (this.validateStep(this.currentStep)) {
            this.currentStep++;
            this.showStep(this.currentStep);
        }
    }

    previousStep() {
        if (this.currentStep > 1) {
            this.currentStep--;
            this.showStep(this.currentStep);
        }
    }

    updateSubPermisosVisibility() {
        const modulosConSubPermisos = ['caja', 'ventas', 'inventario'];
        let hayAlgunModuloVisible = false;

        modulosConSubPermisos.forEach(modulo => {
            const permisoCheckbox = document.getElementById(`perm-${modulo}`);
            const subPermisosContainer = document.getElementById(`sub-permisos-${modulo}`);

            if (permisoCheckbox && subPermisosContainer) {
                if (permisoCheckbox.checked) {
                    subPermisosContainer.style.display = 'block';
                    subPermisosContainer.classList.add('fade-in');
                    hayAlgunModuloVisible = true;
                } else {
                    subPermisosContainer.style.display = 'none';
                    subPermisosContainer.classList.remove('fade-in');
                }
            }
        });

        // Mostrar mensaje si no hay módulos con sub-permisos seleccionados
        const noSubPermisosMsg = document.getElementById('no-sub-permisos-msg');
        if (noSubPermisosMsg) {
            noSubPermisosMsg.style.display = hayAlgunModuloVisible ? 'none' : 'block';
        }
    }

    validateStep(step) {
        if (step === 1) {
            const nombre = document.getElementById('nombre').value.trim();
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            const rol = document.getElementById('rol').value;

            if (!nombre || !email || !rol) {
                this.showNotification('Por favor completa todos los campos obligatorios', 'error');
                return false;
            }

            // Validar contraseña solo si se está creando un nuevo usuario o si se ingresó una nueva
            if (!this.editingUser && password.length < 8) {
                this.showNotification('La contraseña debe tener al menos 8 caracteres', 'error');
                return false;
            }

            if (this.editingUser && password && password.length < 8) {
                this.showNotification('Si deseas cambiar la contraseña, debe tener al menos 8 caracteres', 'error');
                return false;
            }

            if (!this.isValidEmail(email)) {
                this.showNotification('Por favor ingresa un email válido', 'error');
                return false;
            }
        }

        return true;
    }

    isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    updatePermissionsByRole(rol) {
        const rolePermissions = {
            'vendedor': ['ventas', 'caja', 'clientes', 'creditos'],
            'supervisor': ['ventas', 'caja', 'inventario', 'clientes', 'creditos', 'reportes', 'promociones'],
            'administrador': ['ventas', 'caja', 'inventario', 'compras', 'clientes', 'creditos', 'proveedores', 'pagos', 'reportes', 'usuarios', 'promociones', 'notas', 'configuracion']
        };

        const permisos = rolePermissions[rol] || [];

        document.querySelectorAll('input[name="permisos"]').forEach(checkbox => {
            checkbox.checked = permisos.includes(checkbox.value);
        });
    }

    async saveUsuario() {
        // ✅ Validar formulario antes de guardar
        const validationRules = {
            nombre: ['required', { type: 'minLength', value: 3 }],
            email: ['required', 'email'],
            rol: ['required']
        };

        if (!this.editingUser) {
            validationRules.password = ['required', 'password'];
        }

        const validation = window.formValidator?.validateForm(
            document.getElementById('form-usuario'),
            validationRules
        );

        if (validation && !validation.isValid) {
            this.showNotification('Por favor corrige los errores del formulario', 'error');
            return;
        }

        this.showLoading();

        try {
            const formData = new FormData(document.getElementById('form-usuario'));

            // 🛡️ Sanitizar datos
            const sanitizedData = window.inputSanitizer?.sanitizeFormData(formData) || Object.fromEntries(formData);

            const userData = {
                personalInfo: {
                    nombre: sanitizedData.nombre,
                    email: sanitizedData.email,
                    rol: sanitizedData.rol
                },
                permissions: {},
                subPermisos: {}
            };

            // Procesar permisos de módulos
            const permisosSeleccionados = formData.getAll('permisos');
            const todosLosModulos = ['ventas', 'caja', 'inventario', 'compras', 'clientes', 'creditos', 'proveedores', 'pagos', 'reportes', 'usuarios', 'promociones', 'notas', 'configuracion'];

            todosLosModulos.forEach(modulo => {
                userData.permissions[modulo] = permisosSeleccionados.includes(modulo);
            });

            // Procesar sub-permisos
            const subPermisosCheckboxes = document.querySelectorAll('input[name="subPermisos"]');
            subPermisosCheckboxes.forEach(checkbox => {
                const [modulo, permiso] = checkbox.value.split('.');

                if (!userData.subPermisos[modulo]) {
                    userData.subPermisos[modulo] = {};
                }

                userData.subPermisos[modulo][permiso] = checkbox.checked;
            });

            if (this.editingUser) {
                // Actualizar usuario existente - preservar metadata existente
                const metadataActual = this.editingUser.metadata || {};
                userData.metadata = {
                    ...metadataActual,
                    status: metadataActual.status || 'active',
                    updatedAt: new Date(),
                    updatedBy: window.authSystem?.currentUser?.uid || 'unknown'
                };

                await window.errorHandler?.wrapFirebaseOperation(
                    () => window.db.collection('users').doc(this.editingUser.id).update(userData),
                    'Actualizar usuario'
                );

                // Si se proporcionó una nueva contraseña, enviar correo de restablecimiento
                const newPassword = formData.get('password');
                if (newPassword && newPassword.trim().length >= 8) {
                    try {
                        const emailUsuario = this.editingUser.personalInfo?.email;
                        if (emailUsuario) {
                            await window.auth.sendPasswordResetEmail(emailUsuario);
                            this.showNotification('Usuario actualizado. Se envió un correo al usuario para restablecer su contraseña.', 'success');
                        } else {
                            this.showNotification('Usuario actualizado correctamente', 'success');
                        }
                    } catch (error) {
                        console.warn('No se pudo enviar correo de restablecimiento:', error);
                        this.showNotification('Usuario actualizado. No se pudo enviar el correo de restablecimiento de contraseña.', 'warning');
                    }
                } else {
                    this.showNotification('Usuario actualizado correctamente', 'success');
                }
            } else {
                // Crear nuevo usuario - agregar metadata de creación
                userData.metadata = {
                    createdAt: new Date(),
                    createdBy: window.authSystem?.currentUser?.uid || 'unknown',
                    status: 'active'
                };

                // Crear nuevo usuario en Firebase Auth con error handler
                const password = formData.get('password');
                const userCredential = await window.errorHandler?.wrapFirebaseOperation(
                    () => window.auth.createUserWithEmailAndPassword(userData.personalInfo.email, password),
                    'Crear usuario en Auth'
                );

                // Guardar datos adicionales en Firestore con error handler
                await window.errorHandler?.wrapFirebaseOperation(
                    () => window.db.collection('users').doc(userCredential.user.uid).set(userData),
                    'Guardar usuario en Firestore'
                );
                this.showNotification('Usuario creado correctamente', 'success');
            }

            window.cacheManager?.invalidate('usuarios_cache');
            await this.loadUsuarios();
            this.renderUsuarios();
            this.closeModal();

        } catch (error) {
            console.error('Error al guardar usuario:', error);
            let errorMessage = 'Error al guardar usuario';

            if (error.code === 'auth/email-already-in-use') {
                errorMessage = 'El email ya está registrado';
            } else if (error.code === 'auth/weak-password') {
                errorMessage = 'La contraseña es muy débil';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'El email no es válido';
            }

            this.showNotification(errorMessage, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async editUsuario(userId) {
        const usuario = this.usuarios.find(u => u.id === userId);
        if (usuario) {
            this.openModal(usuario);
        }
    }

    async deleteUsuario(userId) {
        if (!confirm('¿Estás seguro de que quieres eliminar este usuario?')) {
            return;
        }

        this.showLoading();

        try {
            await window.db.collection('users').doc(userId).delete();
            window.cacheManager?.invalidate('usuarios_cache');
            await this.loadUsuarios();
            this.renderUsuarios();
            this.showNotification('Usuario eliminado correctamente', 'success');
        } catch (error) {
            console.error('Error al eliminar usuario:', error);
            this.showNotification('Error al eliminar usuario', 'error');
        } finally {
            this.hideLoading();
        }
    }

    showLoading() {
        document.getElementById('loading-overlay').classList.add('active');
    }

    hideLoading() {
        document.getElementById('loading-overlay').classList.remove('active');
    }

    showNotification(message, type = 'info') {
        // Usar el sistema global de notificaciones si existe
        if (window.eventBus) {
            window.eventBus.emit(window.APP_EVENTS.NOTIFICATION_SHOW, {
                message,
                type
            });
            return;
        }

        // Fallback al sistema local
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">
                    ${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}
                </span>
                <span class="notification-message">${message}</span>
                <button class="notification-close">✕</button>
            </div>
        `;

        // Agregar estilos si no existen
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

                .notification-success {
                    border-left: 4px solid #34C759;
                }

                .notification-error {
                    border-left: 4px solid #FF3B30;
                }

                .notification-info {
                    border-left: 4px solid #007AFF;
                }

                .notification-message {
                    flex: 1;
                    font-weight: 500;
                }

                .notification-close {
                    background: none;
                    border: none;
                    cursor: pointer;
                    padding: 4px;
                    border-radius: 4px;
                }

                @keyframes slideInFromRight {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
            `;
            document.head.appendChild(styles);
        }

        document.body.appendChild(notification);

        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            notification.remove();
        });

        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }

    // Método para limpiar el módulo cuando se descarga
    destroy() {
        // IMPORTANTE: Cerrar y limpiar modal ANTES de limpiar listeners
        const modal = document.getElementById('modal-usuario');
        if (modal) {
            modal.classList.remove('active');
            // Forzar reset completo del modal
            modal.style.display = 'none';
            const modalContent = modal.querySelector('.modal-content');
            if (modalContent) {
                modalContent.scrollTop = 0;
            }
        }

        // Resetear formulario
        const form = document.getElementById('form-usuario');
        if (form) {
            form.reset();
        }

        // Limpiar event listeners
        this.eventListeners.forEach(cleanup => cleanup());
        this.eventListeners = [];

        // Limpiar eventos globales del módulo
        if (window.eventBus) {
            window.eventBus.cleanupModule(this.moduleId);
        }

        // Resetear estado interno
        this.currentStep = 1;
        this.editingUser = null;

        console.log(`Módulo ${this.moduleId} descargado correctamente`);
    }
}

// Cargar el módulo cuando se carga el contenido
function loadUsuariosModule() {
    window.usuariosModule = new UsuariosModule();
}

// Exportar para uso global
window.loadUsuariosModule = loadUsuariosModule;
