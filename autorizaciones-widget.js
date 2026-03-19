class AutorizacionesWidget {
    constructor() {
        this.solicitudes = [];
        this.isOpen = false;
        this.unsubscribe = null;
        this.audioEnabled = true;
    }

    async init() {
        console.log('🔍 Iniciando widget de autorizaciones...');
        console.log('👤 Usuario actual:', window.authSystem?.currentUser);

        const userRole = window.authSystem?.currentUser?.rol;
        console.log('🎭 Rol detectado:', userRole);

        if (userRole !== 'administrador') {
            console.log('⚠️ Widget de autorizaciones: Solo visible para administradores (rol actual: ' + userRole + ')');
            return;
        }

        console.log('✅ Usuario es administrador, renderizando widget...');
        this.render();
        this.setupListeners();
        console.log('✅ Widget de autorizaciones inicializado completamente');

        // Verificar que el widget esté en el DOM
        const widgetElement = document.getElementById('autorizaciones-widget');
        if (widgetElement) {
            console.log('✅ Widget encontrado en el DOM');
        } else {
            console.error('❌ Widget NO encontrado en el DOM después de render()');
        }
    }

    render() {
        const existingWidget = document.getElementById('autorizaciones-widget');
        if (existingWidget) existingWidget.remove();

        const widget = document.createElement('div');
        widget.id = 'autorizaciones-widget';
        widget.innerHTML = `
            <button class="widget-trigger" id="widget-trigger" title="Autorizaciones pendientes">
                <svg class="widget-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
                <span class="widget-badge" id="widget-badge">0</span>
            </button>
            <div class="widget-panel" id="widget-panel">
                <div class="widget-header">
                    <h3>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                        </svg>
                        Solicitudes de Edición
                    </h3>
                    <button class="widget-close" id="widget-close">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div class="widget-content" id="widget-content">
                    <div class="widget-empty">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                        <p>Sin solicitudes pendientes</p>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(widget);
        this.addStyles();
    }

    addStyles() {
        if (document.getElementById('autorizaciones-widget-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'autorizaciones-widget-styles';
        styles.textContent = `
            #autorizaciones-widget {
                position: fixed;
                bottom: 100px;
                right: 20px;
                z-index: 9999;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }

            .widget-trigger {
                width: 56px;
                height: 56px;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.45);
                backdrop-filter: blur(40px) saturate(180%) brightness(1.08);
                -webkit-backdrop-filter: blur(40px) saturate(180%) brightness(1.08);
                border: 1.5px solid rgba(255, 255, 255, 0.6);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 
                    0 10px 40px rgba(255, 149, 0, 0.25),
                    0 6px 20px rgba(0, 0, 0, 0.12),
                    inset 0 1px 1px rgba(255, 255, 255, 0.9),
                    inset 0 -1px 1px rgba(0, 0, 0, 0.03);
                transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
                position: relative;
            }

            .widget-trigger::before {
                content: '';
                position: absolute;
                inset: 0;
                border-radius: 50%;
                background: linear-gradient(135deg, rgba(255, 149, 0, 0.4), rgba(255, 140, 0, 0.4));
                opacity: 1;
                transition: opacity 0.3s ease;
            }

            .widget-trigger:hover {
                transform: scale(1.1);
                box-shadow: 
                    0 12px 40px rgba(255, 149, 0, 0.35),
                    0 8px 24px rgba(0, 0, 0, 0.15),
                    inset 0 1px 0 rgba(255, 255, 255, 0.6);
            }

            .widget-trigger:hover::before {
                opacity: 0.8;
            }

            .widget-trigger.has-solicitudes {
                animation: pulseWidget 2s ease-in-out infinite;
            }

            @keyframes pulseWidget {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.08); }
            }

            .widget-icon {
                width: 28px;
                height: 28px;
                color: #FF9500;
                filter: drop-shadow(0 2px 4px rgba(255, 149, 0, 0.3));
                transition: all 300ms cubic-bezier(0.16, 1, 0.3, 1);
                position: relative;
                z-index: 1;
            }

            .widget-badge {
                position: absolute;
                top: -4px;
                right: -4px;
                min-width: 22px;
                height: 22px;
                background: linear-gradient(135deg, #FF3B30, #FF6259);
                color: white;
                border-radius: 11px;
                font-size: 12px;
                font-weight: 700;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 0 6px;
                box-shadow: 
                    0 2px 8px rgba(255, 59, 48, 0.4),
                    0 0 0 2px rgba(255, 255, 255, 0.8);
                opacity: 0;
                transform: scale(0);
                transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                z-index: 2;
            }

            .widget-badge.visible {
                opacity: 1;
                transform: scale(1);
            }

            .widget-panel {
                position: absolute;
                bottom: 70px;
                right: 0;
                width: 360px;
                max-height: 480px;
                background: rgba(255, 255, 255, 0.88);
                backdrop-filter: blur(60px) saturate(200%) brightness(1.05);
                -webkit-backdrop-filter: blur(60px) saturate(200%) brightness(1.05);
                border-radius: 24px;
                box-shadow: 
                    0 20px 60px rgba(0, 0, 0, 0.18),
                    0 8px 24px rgba(0, 0, 0, 0.12),
                    0 0 0 1px rgba(255, 255, 255, 0.5),
                    inset 0 1px 2px rgba(255, 255, 255, 0.8);
                border: 1px solid rgba(255, 255, 255, 0.7);
                overflow: hidden;
                opacity: 0;
                visibility: hidden;
                transform: translateY(20px) scale(0.95);
                transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
            }

            .widget-panel.open {
                opacity: 1;
                visibility: visible;
                transform: translateY(0) scale(1);
            }

            .widget-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 18px 20px;
                background: linear-gradient(135deg, 
                    rgba(255, 149, 0, 0.75) 0%, 
                    rgba(255, 140, 0, 0.68) 100%);
                backdrop-filter: blur(40px) saturate(160%);
                -webkit-backdrop-filter: blur(40px) saturate(160%);
                border-bottom: 1px solid rgba(255, 255, 255, 0.4);
                box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4);
                color: white;
            }

            .widget-header h3 {
                margin: 0;
                font-size: 1rem;
                font-weight: 600;
                display: flex;
                align-items: center;
                gap: 10px;
            }

            .widget-header h3 svg {
                width: 20px;
                height: 20px;
            }

            .widget-close {
                width: 32px;
                height: 32px;
                border: none;
                background: rgba(255, 255, 255, 0.2);
                border-radius: 50%;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s ease;
            }

            .widget-close:hover {
                background: rgba(255, 255, 255, 0.3);
                transform: scale(1.1);
            }

            .widget-close svg {
                width: 16px;
                height: 16px;
                color: white;
            }

            .widget-content {
                max-height: 400px;
                overflow-y: auto;
                padding: 12px;
            }

            .widget-empty {
                text-align: center;
                padding: 40px 20px;
                color: #6D6D80;
            }

            .widget-empty svg {
                width: 48px;
                height: 48px;
                color: #34C759;
                margin-bottom: 12px;
            }

            .widget-empty p {
                margin: 0;
                font-size: 0.95rem;
            }

            .solicitud-card {
                background: rgba(255, 255, 255, 0.65);
                backdrop-filter: blur(30px) saturate(160%);
                -webkit-backdrop-filter: blur(30px) saturate(160%);
                border-radius: 16px;
                padding: 16px;
                margin-bottom: 10px;
                box-shadow: 
                    0 4px 16px rgba(0, 0, 0, 0.08),
                    0 2px 6px rgba(0, 0, 0, 0.04),
                    inset 0 1px 0 rgba(255, 255, 255, 0.8);
                border: 1px solid rgba(255, 255, 255, 0.6);
                animation: slideIn 0.3s ease-out;
            }

            @keyframes slideIn {
                from {
                    opacity: 0;
                    transform: translateX(20px);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }

            .solicitud-header {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 10px;
            }

            .solicitud-avatar {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                background: linear-gradient(135deg, #007AFF, #5856D6);
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: 700;
                font-size: 14px;
            }

            .solicitud-info {
                flex: 1;
            }

            .solicitud-vendedor {
                font-weight: 600;
                font-size: 0.95rem;
                color: #1D1D1F;
            }

            .solicitud-tiempo {
                font-size: 0.8rem;
                color: #6D6D80;
            }

            .solicitud-detalles {
                background: #F8F9FA;
                border-radius: 10px;
                padding: 12px;
                margin-bottom: 12px;
            }

            .solicitud-detalles-row {
                display: flex;
                justify-content: space-between;
                font-size: 0.85rem;
                color: #2C2C2E;
                margin-bottom: 4px;
            }

            .solicitud-detalles-row:last-child {
                margin-bottom: 0;
            }

            .solicitud-detalles-row span:last-child {
                font-weight: 600;
            }

            .solicitud-total {
                color: #007AFF !important;
            }

            .solicitud-acciones {
                display: flex;
                gap: 8px;
            }

            .btn-autorizar {
                flex: 1;
                padding: 10px 16px;
                background: linear-gradient(135deg, 
                    rgba(52, 199, 89, 0.85) 0%, 
                    rgba(48, 184, 74, 0.85) 100%);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                color: white;
                border: 1px solid rgba(255, 255, 255, 0.3);
                border-radius: 12px;
                font-weight: 600;
                font-size: 0.9rem;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                box-shadow: 
                    0 4px 12px rgba(52, 199, 89, 0.3),
                    inset 0 1px 0 rgba(255, 255, 255, 0.3);
                transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
            }

            .btn-autorizar:hover {
                transform: translateY(-2px);
                box-shadow: 
                    0 6px 16px rgba(52, 199, 89, 0.4),
                    inset 0 1px 0 rgba(255, 255, 255, 0.4);
            }

            .btn-autorizar:active {
                transform: translateY(0);
            }

            .btn-autorizar svg {
                width: 16px;
                height: 16px;
            }

            .btn-rechazar {
                padding: 10px 16px;
                background: rgba(255, 59, 48, 0.12);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                color: #FF3B30;
                border: 1px solid rgba(255, 59, 48, 0.2);
                border-radius: 12px;
                font-weight: 600;
                font-size: 0.9rem;
                cursor: pointer;
                transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
            }

            .btn-rechazar:hover {
                background: rgba(255, 59, 48, 0.2);
                border-color: rgba(255, 59, 48, 0.3);
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(255, 59, 48, 0.2);
            }

            .btn-rechazar:active {
                transform: translateY(0);
            }

            @media (max-width: 768px) {
                #autorizaciones-widget {
                    bottom: 140px;
                    right: 12px;
                }

                .widget-trigger {
                    width: 50px;
                    height: 50px;
                }

                .widget-panel {
                    width: calc(100vw - 24px);
                    right: -8px;
                    max-height: 60vh;
                }
            }
        `;

        document.head.appendChild(styles);
    }

    setupListeners() {
        const trigger = document.getElementById('widget-trigger');
        const close = document.getElementById('widget-close');
        const panel = document.getElementById('widget-panel');

        trigger?.addEventListener('click', () => this.togglePanel());
        close?.addEventListener('click', () => this.closePanel());

        document.addEventListener('click', (e) => {
            const widget = document.getElementById('autorizaciones-widget');
            if (widget && !widget.contains(e.target) && this.isOpen) {
                this.closePanel();
            }
        });

        // 🧹 INICIAR LIMPIEZA PERIÓDICA DE SESIONES EXPIRADAS (cada 30 segundos)
        this.iniciarLimpiezaSesionesExpiradas();

        console.log('👂 Configurando listener de solicitudes pendientes...');

        // Listener SIN orderBy para evitar errores de índice
        this.unsubscribe = window.db.collection('solicitudes_edicion_precio')
            .where('estado', '==', 'pendiente')
            .onSnapshot((snapshot) => {
                console.log('📡 Widget: Snapshot recibido -', snapshot.docs.length, 'solicitudes pendientes');
                console.log('📊 Widget activo:', !!document.getElementById('autorizaciones-widget'));

                const previousCount = this.solicitudes.length;

                // Mapear y ordenar manualmente por fecha
                this.solicitudes = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })).sort((a, b) => {
                    const fechaA = a.fechaSolicitud?.toDate ? a.fechaSolicitud.toDate() : new Date(0);
                    const fechaB = b.fechaSolicitud?.toDate ? b.fechaSolicitud.toDate() : new Date(0);
                    return fechaB - fechaA; // Más recientes primero
                });

                // Log detallado de solicitudes
                if (this.solicitudes.length > 0) {
                    console.log('📋 Solicitudes detectadas en widget:');
                    this.solicitudes.forEach(s => {
                        console.log(`   • ID: ${s.id}`);
                        console.log(`   • Vendedor: ${s.vendedor} (ID: ${s.vendedorId})`);
                        console.log(`   • Carrito: ${s.carritoNombre}`);
                        console.log(`   • Total: $${s.totalCarrito}`);
                        console.log(`   • Estado: ${s.estado}`);
                        console.log(`   • Fecha:`, s.fechaSolicitud?.toDate ? s.fechaSolicitud.toDate() : 'Sin fecha');
                        console.log('   ---');
                    });
                } else {
                    console.log('✅ No hay solicitudes pendientes para mostrar en widget');
                }

                this.updateBadge();
                this.renderSolicitudes();

                if (this.solicitudes.length > previousCount && previousCount >= 0) {
                    console.log('🔔 Nueva solicitud detectada, reproduciendo sonido...');
                    this.playNotificationSound();
                    this.showToast('Nueva solicitud de edición de precios');
                }
            }, (error) => {
                console.error('❌ Error en listener de solicitudes:', error);
                console.error('Código de error:', error.code);
                console.error('Mensaje:', error.message);

                // Si falla por índice, intentar sin orderBy
                if (error.code === 'failed-precondition') {
                    console.warn('⚠️ Falta índice en Firestore, pero continuando sin ordenamiento...');
                }
            });
    }

    togglePanel() {
        const panel = document.getElementById('widget-panel');
        this.isOpen = !this.isOpen;
        panel?.classList.toggle('open', this.isOpen);
    }

    closePanel() {
        const panel = document.getElementById('widget-panel');
        this.isOpen = false;
        panel?.classList.remove('open');
    }

    updateBadge() {
        const badge = document.getElementById('widget-badge');
        const trigger = document.getElementById('widget-trigger');

        if (badge) {
            badge.textContent = this.solicitudes.length;
            badge.classList.toggle('visible', this.solicitudes.length > 0);
        }

        if (trigger) {
            trigger.classList.toggle('has-solicitudes', this.solicitudes.length > 0);
        }
    }

    renderSolicitudes() {
        const content = document.getElementById('widget-content');
        if (!content) return;

        if (this.solicitudes.length === 0) {
            content.innerHTML = `
                <div class="widget-empty">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                    <p>Sin solicitudes pendientes</p>
                </div>
            `;
            return;
        }

        content.innerHTML = this.solicitudes.map(solicitud => {
            const initials = this.getInitials(solicitud.vendedor);
            const tiempoTranscurrido = this.getTimeAgo(solicitud.fechaSolicitud);
            const totalFormateado = window.currencyFormatter?.format(solicitud.totalCarrito) || 
                                   `$${solicitud.totalCarrito?.toFixed(2) || 0}`;

            return `
                <div class="solicitud-card" data-id="${solicitud.id}">
                    <div class="solicitud-header">
                        <div class="solicitud-avatar">${initials}</div>
                        <div class="solicitud-info">
                            <div class="solicitud-vendedor">${solicitud.vendedor || 'Vendedor'}</div>
                            <div class="solicitud-tiempo">${tiempoTranscurrido}</div>
                        </div>
                    </div>
                    <div class="solicitud-detalles">
                        <div class="solicitud-detalles-row">
                            <span>Carrito:</span>
                            <span>${solicitud.carritoNombre || 'Carrito'}</span>
                        </div>
                        <div class="solicitud-detalles-row">
                            <span>Productos:</span>
                            <span>${solicitud.itemsEnCarrito || 0} items</span>
                        </div>
                        <div class="solicitud-detalles-row">
                            <span>Total:</span>
                            <span class="solicitud-total">${totalFormateado}</span>
                        </div>
                    </div>
                    <div class="solicitud-acciones">
                        <button class="btn-autorizar" onclick="autorizacionesWidget.autorizar('${solicitud.id}', '${solicitud.vendedorId}')">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                            Autorizar
                        </button>
                        <button class="btn-rechazar" onclick="autorizacionesWidget.rechazar('${solicitud.id}')">
                            Rechazar
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    getInitials(nombre) {
        if (!nombre) return '??';
        return nombre.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
    }

    getTimeAgo(timestamp) {
        if (!timestamp) return 'Hace un momento';

        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Hace un momento';
        if (diffMins < 60) return `Hace ${diffMins} min`;

        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `Hace ${diffHours}h`;

        return `Hace ${Math.floor(diffHours / 24)}d`;
    }

    async autorizar(solicitudId, vendedorId) {
        try {
            const adminId = window.authSystem?.currentUser?.uid;
            const adminName = window.authSystem?.currentUser?.nombre || 'Administrador';

            // Obtener datos de la solicitud para incluir carritoId
            const solicitudDoc = await window.db.collection('solicitudes_edicion_precio').doc(solicitudId).get();
            const solicitudData = solicitudDoc.data();
            const carritoId = solicitudData?.carritoId;
            const carritoNombre = solicitudData?.carritoNombre;

            // Calcular tiempo de expiración (5 minutos desde ahora)
            const ahora = new Date();
            const expiracion = new Date(ahora.getTime() + 5 * 60 * 1000); // 5 minutos
            
            await window.db.collection('sesiones_precio_temporal').add({
                vendedorId: vendedorId,
                adminAutorizo: adminId,
                adminNombre: adminName,
                activo: true,
                solicitudId: solicitudId,
                carritoId: carritoId,
                carritoNombre: carritoNombre,
                fechaAutorizacion: firebase.firestore.Timestamp.now(),
                expiresAt: firebase.firestore.Timestamp.fromDate(expiracion),
                tabId: null // Se actualizará cuando el vendedor reciba la autorización
            });

            await window.db.collection('solicitudes_edicion_precio').doc(solicitudId).update({
                estado: 'aprobada',
                fechaAprobacion: firebase.firestore.Timestamp.now(),
                aprobadoPor: adminId
            });

            this.showToast(`Autorización concedida para ${carritoNombre || 'carrito'}`, 'success');
            console.log('✅ Autorización concedida para vendedor:', vendedorId, 'carrito:', carritoNombre);

        } catch (error) {
            console.error('Error autorizando:', error);
            this.showToast('Error al autorizar', 'error');
        }
    }

    async rechazar(solicitudId) {
        try {
            const adminId = window.authSystem?.currentUser?.uid;

            await window.db.collection('solicitudes_edicion_precio').doc(solicitudId).update({
                estado: 'rechazada',
                fechaRechazo: firebase.firestore.Timestamp.now(),
                rechazadoPor: adminId
            });

            this.showToast('Solicitud rechazada', 'warning');

        } catch (error) {
            console.error('Error rechazando:', error);
            this.showToast('Error al rechazar', 'error');
        }
    }

    playNotificationSound() {
        if (!this.audioEnabled) return;

        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);

            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
        } catch (e) {
            console.log('Audio notification not available');
        }
    }

    showToast(message, type = 'info') {
        const existingToast = document.querySelector('.widget-toast');
        if (existingToast) existingToast.remove();

        const toast = document.createElement('div');
        toast.className = `widget-toast widget-toast-${type}`;
        toast.innerHTML = `
            <span>${message}</span>
        `;

        const colors = {
            info: '#007AFF',
            success: '#34C759',
            warning: '#FF9500',
            error: '#FF3B30'
        };

        toast.style.cssText = `
            position: fixed;
            bottom: 170px;
            right: 20px;
            background: ${colors[type]};
            color: white;
            padding: 12px 20px;
            border-radius: 12px;
            font-weight: 600;
            font-size: 0.9rem;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
            z-index: 10000;
            animation: toastIn 0.3s ease-out;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;

        const style = document.createElement('style');
        style.textContent = `
            @keyframes toastIn {
                from { opacity: 0; transform: translateX(20px); }
                to { opacity: 1; transform: translateX(0); }
            }
            @keyframes toastOut {
                from { opacity: 1; transform: translateX(0); }
                to { opacity: 0; transform: translateX(20px); }
            }
        `;
        document.head.appendChild(style);

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'toastOut 0.3s ease-out forwards';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // 🧹 LIMPIEZA PERIÓDICA DE SESIONES EXPIRADAS (Admin puede limpiar cualquier sesión)
    iniciarLimpiezaSesionesExpiradas() {
        // Ejecutar limpieza inmediatamente
        this.limpiarSesionesExpiradas();
        
        // Configurar limpieza periódica cada 30 segundos
        this.limpiezaTimer = setInterval(() => {
            this.limpiarSesionesExpiradas();
        }, 30 * 1000);
        
        console.log('🧹 Limpieza periódica de sesiones configurada (admin, cada 30s)');
    }

    async limpiarSesionesExpiradas() {
        try {
            const ahora = new Date();
            
            // Buscar TODAS las sesiones activas
            const sesionesSnapshot = await window.db.collection('sesiones_precio_temporal')
                .where('activo', '==', true)
                .get();

            if (sesionesSnapshot.empty) return;

            const batch = window.db.batch();
            let sesionesExpiradas = 0;

            sesionesSnapshot.docs.forEach(doc => {
                const data = doc.data();
                const expiresAt = data.expiresAt?.toDate();
                
                // Si tiene expiresAt y ya pasó, o si no tiene expiresAt y pasaron más de 10 minutos
                const fechaAutorizacion = data.fechaAutorizacion?.toDate();
                const tiempoLimite = expiresAt || (fechaAutorizacion ? new Date(fechaAutorizacion.getTime() + 10 * 60 * 1000) : null);
                
                if (tiempoLimite && ahora > tiempoLimite) {
                    batch.update(doc.ref, {
                        activo: false,
                        fechaDesactivacion: firebase.firestore.Timestamp.now(),
                        motivoDesactivacion: 'Expiración automática (admin cleanup)'
                    });
                    sesionesExpiradas++;
                    console.log(`🧹 Admin: Sesión expirada detectada: ${doc.id}`);
                }
            });

            if (sesionesExpiradas > 0) {
                await batch.commit();
                console.log(`🧹 Admin: ${sesionesExpiradas} sesiones expiradas limpiadas`);
            }

        } catch (error) {
            console.error('Error en limpieza de sesiones (admin):', error);
        }
    }

    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
        if (this.limpiezaTimer) {
            clearInterval(this.limpiezaTimer);
        }
        const widget = document.getElementById('autorizaciones-widget');
        if (widget) widget.remove();
    }
}

window.autorizacionesWidget = new AutorizacionesWidget();

document.addEventListener('authStateChanged', (e) => {
    console.log('🔔 authStateChanged recibido:', e.detail);
    if (e.detail?.authenticated) {
        const userRole = e.detail.user?.rol || window.authSystem?.currentUser?.rol;
        console.log('👤 Rol del usuario:', userRole);

        setTimeout(() => {
            console.log('🔄 Intentando inicializar widget de autorizaciones...');
            window.autorizacionesWidget.init();
        }, 1000);
    } else {
        console.log('🚪 Usuario desautenticado, destruyendo widget');
        window.autorizacionesWidget.destroy();
    }
});

// Inicializar si ya hay sesión activa
if (window.authSystem?.isAuthenticated) {
    console.log('✅ Usuario ya autenticado al cargar widget, inicializando...');
    setTimeout(() => {
        window.autorizacionesWidget.init();
    }, 1500);
}

// Verificar periódicamente si el usuario es admin y no se ha inicializado
setInterval(() => {
    const userRole = window.authSystem?.currentUser?.rol;
    const widgetExists = document.getElementById('autorizaciones-widget');

    if (userRole === 'administrador' && !widgetExists && window.authSystem?.isAuthenticated) {
        console.log('⚠️ Widget de autorizaciones no encontrado pero usuario es admin, inicializando...');
        window.autorizacionesWidget.init();
    }
}, 5000);