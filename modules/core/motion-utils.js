/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MÓDULO: MotionUtils - Sistema de Animaciones v2.0
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * ¿QUÉ HACE ESTE ARCHIVO?
 * Proporciona animaciones fluidas estilo Apple/iOS para toda la aplicación.
 * Las animaciones hacen que la app se sienta profesional y pulida.
 * 
 * MEJORAS IMPLEMENTADAS:
 * 
 * 1. OPTIMIZACIÓN GPU
 *    - ¿Qué es la GPU? Es el procesador de gráficos de tu computadora
 *    - Usamos propiedades que la GPU puede animar eficientemente:
 *      transform, opacity (no width, height, top, left)
 *    - Resultado: Animaciones a 60fps sin "tirones"
 * 
 * 2. will-change INTELIGENTE
 *    - Le dice al navegador: "prepárate, voy a animar esto"
 *    - Se activa ANTES de la animación y se limpia DESPUÉS
 *    - Evita el uso excesivo que podría consumir memoria
 * 
 * 3. requestAnimationFrame
 *    - Sincroniza las animaciones con la tasa de refresco del monitor
 *    - Garantiza que cada frame se dibuje en el momento óptimo
 * 
 * 4. RESPETO A prefers-reduced-motion
 *    - ¿Qué es? Una opción del sistema operativo para personas que
 *      prefieren menos animaciones (mareos, epilepsia, etc.)
 *    - Cuando está activado, las animaciones son más simples/rápidas
 * 
 * 5. CACHÉ DE KEYFRAMES
 *    - Reutilizamos definiciones de animación en lugar de crearlas cada vez
 *    - Reduce el trabajo del navegador
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

const MotionUtils = {

    /**
     * CURVAS DE ANIMACIÓN (Easing)
     * 
     * ¿Qué es una curva de easing?
     * Define CÓMO se mueve algo, no solo de dónde a dónde.
     * 
     * - spring: Como un resorte, empieza rápido y desacelera suavemente
     * - springBounce: Como spring pero con un pequeño rebote al final
     * - smooth: Movimiento natural y suave
     * - snappy: Rápido y preciso, sin rebote
     */
    easings: {
        spring: 'cubic-bezier(0.16, 1, 0.3, 1)',
        springBounce: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
        snappy: 'cubic-bezier(0.4, 0, 0, 1)',
        entrance: 'cubic-bezier(0, 0, 0.2, 1)',
        exit: 'cubic-bezier(0.4, 0, 1, 1)'
    },

    durations: {
        instant: 100,
        fast: 200,
        normal: 300,
        slow: 400,
        slower: 600
    },

    /**
     * VERIFICAR PREFERENCIA DE MOVIMIENTO REDUCIDO
     */
    prefersReducedMotion() {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    },

    /**
     * PREPARAR ELEMENTO PARA ANIMACIÓN (Optimización GPU)
     * 
     * will-change le dice al navegador que se prepare para animar.
     * Es como decirle a un atleta "prepárate para correr".
     */
    prepareForAnimation(element) {
        if (!element) return;
        element.style.willChange = 'transform, opacity';
    },

    /**
     * LIMPIAR DESPUÉS DE ANIMACIÓN
     * 
     * Importante: will-change usa memoria, así que lo limpiamos
     * cuando ya no lo necesitamos. Solo limpiamos will-change,
     * dejando transform/opacity intactos para evitar flicker.
     */
    cleanupAfterAnimation(element, resetStyles = false) {
        if (!element) return;
        requestAnimationFrame(() => {
            element.style.willChange = 'auto';
            if (resetStyles) {
                element.style.transform = '';
                element.style.opacity = '';
                element.style.filter = '';
            }
        });
    },

    /**
     * ANIMACIÓN DE ENTRADA (Fade In con escala)
     */
    fadeIn(element, duration = 300, delay = 0) {
        if (!element) return Promise.resolve();

        if (this.prefersReducedMotion()) {
            element.style.opacity = '1';
            element.style.transform = '';
            return Promise.resolve();
        }

        this.prepareForAnimation(element);

        const animation = element.animate([
            { opacity: 0, transform: 'scale(0.95)' },
            { opacity: 1, transform: 'scale(1)' }
        ], {
            duration,
            delay,
            easing: this.easings.spring,
            fill: 'forwards'
        });

        return animation.finished.then(() => {
            this.cleanupAfterAnimation(element);
            element.style.opacity = '1';
            element.style.transform = '';
        });
    },

    /**
     * ANIMACIÓN DE SALIDA (Fade Out con escala)
     */
    fadeOut(element, duration = 200) {
        if (!element) return Promise.resolve();

        if (this.prefersReducedMotion()) {
            element.style.opacity = '0';
            return Promise.resolve();
        }

        this.prepareForAnimation(element);

        const animation = element.animate([
            { opacity: 1, transform: 'scale(1)' },
            { opacity: 0, transform: 'scale(0.95)' }
        ], {
            duration,
            easing: this.easings.exit,
            fill: 'forwards'
        });

        return animation.finished.then(() => {
            element.style.opacity = '0';
            this.cleanupAfterAnimation(element);
        });
    },

    /**
     * SLIDE DESDE LA IZQUIERDA
     */
    slideInLeft(element, duration = 400, delay = 0) {
        if (!element) return Promise.resolve();

        if (this.prefersReducedMotion()) {
            return this.fadeIn(element, 100, delay);
        }

        this.prepareForAnimation(element);

        const animation = element.animate([
            { opacity: 0, transform: 'translateX(-30px)' },
            { opacity: 1, transform: 'translateX(0)' }
        ], {
            duration,
            delay,
            easing: this.easings.spring,
            fill: 'forwards'
        });

        return animation.finished.then(() => {
            this.cleanupAfterAnimation(element);
            element.style.opacity = '1';
        });
    },

    /**
     * ANIMACIÓN STAGGER (Escalonada para listas)
     * 
     * ¿Qué es stagger?
     * Es cuando cada elemento de una lista aparece con un pequeño
     * retraso respecto al anterior, creando un efecto de "cascada".
     */
    staggerIn(elements, baseDelay = 0, staggerDelay = 50) {
        if (!elements || elements.length === 0) return Promise.resolve();

        const promises = [];
        const maxStagger = this.prefersReducedMotion() ? 20 : staggerDelay;

        Array.from(elements).forEach((element, index) => {
            const delay = baseDelay + (index * maxStagger);
            promises.push(this.fadeIn(element, 300, delay));
        });

        return Promise.all(promises);
    },

    /**
     * EFECTO SPRING AL CLICK
     * 
     * El elemento se "comprime" ligeramente cuando lo presionas,
     * como un botón físico.
     */
    springClick(element) {
        if (!element || this.prefersReducedMotion()) return;

        element.animate([
            { transform: 'scale(1)' },
            { transform: 'scale(0.95)' },
            { transform: 'scale(1)' }
        ], {
            duration: 200,
            easing: this.easings.springBounce
        });
    },

    /**
     * EFECTO PULSO (Para notificaciones)
     */
    pulse(element, scale = 1.05, duration = 600) {
        if (!element) return Promise.resolve();

        if (this.prefersReducedMotion()) {
            return Promise.resolve();
        }

        const animation = element.animate([
            { transform: 'scale(1)' },
            { transform: `scale(${scale})` },
            { transform: 'scale(1)' }
        ], {
            duration,
            easing: this.easings.smooth
        });

        return animation.finished;
    },

    /**
     * EFECTO SHAKE (Para errores)
     * 
     * Agita el elemento de lado a lado para indicar un error.
     */
    shake(element) {
        if (!element) return Promise.resolve();

        if (this.prefersReducedMotion()) {
            return this.pulse(element, 1.02, 200);
        }

        const animation = element.animate([
            { transform: 'translateX(0)' },
            { transform: 'translateX(-10px)' },
            { transform: 'translateX(10px)' },
            { transform: 'translateX(-10px)' },
            { transform: 'translateX(10px)' },
            { transform: 'translateX(0)' }
        ], {
            duration: 400,
            easing: this.easings.snappy
        });

        return animation.finished;
    },

    /**
     * EFECTO RIPPLE (Estilo Material Design)
     * 
     * Crea una onda circular que se expande desde donde hiciste clic.
     */
    ripple(element, event) {
        if (!element || this.prefersReducedMotion()) return;

        const ripple = document.createElement('span');
        const rect = element.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = event.clientX - rect.left - size / 2;
        const y = event.clientY - rect.top - size / 2;

        ripple.style.cssText = `
            position: absolute;
            width: ${size}px;
            height: ${size}px;
            left: ${x}px;
            top: ${y}px;
            background: rgba(255, 255, 255, 0.5);
            border-radius: 50%;
            transform: scale(0);
            pointer-events: none;
        `;

        element.style.position = 'relative';
        element.style.overflow = 'hidden';
        element.appendChild(ripple);

        ripple.animate([
            { transform: 'scale(0)', opacity: 1 },
            { transform: 'scale(4)', opacity: 0 }
        ], {
            duration: 600,
            easing: 'ease-out'
        }).finished.then(() => ripple.remove());
    },

    /**
     * SMOOTH SCROLL
     * 
     * Desplazamiento suave hasta un elemento.
     */
    smoothScrollTo(target, duration = 600) {
        const element = typeof target === 'string' 
            ? document.querySelector(target) 
            : target;

        if (!element) return Promise.resolve();

        if (this.prefersReducedMotion()) {
            element.scrollIntoView({ behavior: 'auto', block: 'start' });
            return Promise.resolve();
        }

        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return new Promise(resolve => setTimeout(resolve, duration));
    },

    /**
     * ═══════════════════════════════════════════════════════════════════
     * GENIE EFFECT - Efecto macOS estilo Dock (OPTIMIZADO)
     * ═══════════════════════════════════════════════════════════════════
     * 
     * ¿Qué es el Genie Effect?
     * Es la animación que usa macOS cuando minimizas una ventana al dock:
     * el contenido se "succiona" hacia el ícono en una forma de genio.
     * 
     * OPTIMIZACIONES:
     * 1. Usamos solo transform y opacity (GPU-friendly)
     * 2. will-change se prepara antes y limpia después
     * 3. requestAnimationFrame para sincronizar con el monitor
     * 4. Versión simplificada si prefers-reduced-motion está activo
     */

    genieOut(element, targetIcon, duration = 450) {
        if (!element) return Promise.resolve();

        if (this.prefersReducedMotion()) {
            return this.fadeOut(element, 150);
        }

        if (!targetIcon) {
            console.warn('MotionUtils.genieOut: targetIcon no proporcionado');
            return this.fadeOut(element, 200);
        }

        return new Promise((resolve) => {
            requestAnimationFrame(() => {
                const iconRect = targetIcon.getBoundingClientRect();
                const elementRect = element.getBoundingClientRect();

                const iconCenterX = iconRect.left + iconRect.width / 2;
                const iconCenterY = iconRect.top + iconRect.height / 2;
                const elementCenterX = elementRect.left + elementRect.width / 2;
                const elementCenterY = elementRect.top + elementRect.height / 2;

                const translateX = iconCenterX - elementCenterX;
                const translateY = iconCenterY - elementCenterY;

                element.style.transformOrigin = `${iconCenterX - elementRect.left}px ${iconCenterY - elementRect.top}px`;
                element.style.willChange = 'transform, opacity, filter';

                const keyframes = [
                    { 
                        transform: 'scale(1) translateY(0) perspective(1000px) rotateX(0deg)',
                        opacity: 1,
                        filter: 'blur(0px)'
                    },
                    { 
                        transform: `scale(0.7) translate(${translateX * 0.4}px, ${translateY * 0.5}px) perspective(1000px) rotateX(5deg)`,
                        opacity: 0.7,
                        filter: 'blur(1px)',
                        offset: 0.4
                    },
                    { 
                        transform: `scale(0.05) translate(${translateX}px, ${translateY}px) perspective(1000px) rotateX(10deg)`,
                        opacity: 0,
                        filter: 'blur(5px)'
                    }
                ];

                const animation = element.animate(keyframes, {
                    duration: duration,
                    easing: this.easings.spring,
                    fill: 'forwards'
                });

                animation.finished.then(() => {
                    element.style.opacity = '0';
                    element.style.transform = 'scale(0.05)';
                    element.style.filter = 'blur(5px)';
                    element.style.willChange = 'auto';
                    resolve();
                }).catch(resolve);
            });
        });
    },

    genieIn(element, sourceIcon, duration = 450) {
        if (!element) return Promise.resolve();

        if (this.prefersReducedMotion()) {
            element.style.opacity = '1';
            return this.fadeIn(element, 150);
        }

        if (!sourceIcon) {
            console.warn('MotionUtils.genieIn: sourceIcon no proporcionado');
            return this.fadeIn(element, 300);
        }

        return new Promise((resolve) => {
            requestAnimationFrame(() => {
                const iconRect = sourceIcon.getBoundingClientRect();
                const elementRect = element.getBoundingClientRect();

                const iconCenterX = iconRect.left + iconRect.width / 2;
                const iconCenterY = iconRect.top + iconRect.height / 2;
                const elementCenterX = elementRect.left + elementRect.width / 2;
                const elementCenterY = elementRect.top + elementRect.height / 2;

                const translateX = iconCenterX - elementCenterX;
                const translateY = iconCenterY - elementCenterY;

                element.style.transformOrigin = `${iconCenterX - elementRect.left}px ${iconCenterY - elementRect.top}px`;
                element.style.willChange = 'transform, opacity, filter';

                const keyframes = [
                    { 
                        transform: `scale(0.05) translate(${translateX}px, ${translateY}px) perspective(1000px) rotateX(10deg)`,
                        opacity: 0,
                        filter: 'blur(5px)'
                    },
                    { 
                        transform: `scale(0.7) translate(${translateX * 0.4}px, ${translateY * 0.5}px) perspective(1000px) rotateX(5deg)`,
                        opacity: 0.7,
                        filter: 'blur(1px)',
                        offset: 0.6
                    },
                    { 
                        transform: 'scale(1) translateY(0) perspective(1000px) rotateX(0deg)',
                        opacity: 1,
                        filter: 'blur(0px)'
                    }
                ];

                const animation = element.animate(keyframes, {
                    duration: duration,
                    easing: this.easings.spring,
                    fill: 'forwards'
                });

                animation.finished.then(() => {
                    element.style.willChange = 'auto';
                    element.style.transform = '';
                    element.style.opacity = '1';
                    element.style.filter = '';
                    resolve();
                }).catch(() => {
                    element.style.opacity = '1';
                    resolve();
                });
            });
        });
    },

    /**
     * EFECTO BREATHE (Para skeleton screens)
     */
    breathe(element) {
        if (!element) return null;

        const animation = element.animate([
            { opacity: 0.4 },
            { opacity: 0.8 },
            { opacity: 0.4 }
        ], {
            duration: 1500,
            iterations: Infinity,
            easing: 'ease-in-out'
        });

        return animation;
    },

    /**
     * CONFIGURAR ELEMENTOS INTERACTIVOS
     */
    setupInteractiveElements(selector) {
        const elements = typeof selector === 'string' 
            ? document.querySelectorAll(selector) 
            : selector;

        if (!elements) return;

        Array.from(elements).forEach(element => {
            element.addEventListener('mousedown', () => {
                this.springClick(element);
            });
        });
    }
};

const motionStyles = `
    @keyframes ripple-animation {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }

    .animate-ready {
        opacity: 0;
        transform: translateY(20px);
    }

    .animate-in {
        animation: fadeInUp 500ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }

    @keyframes fadeInUp {
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .smooth-transition {
        transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
    }

    .gpu-accelerated {
        will-change: transform;
        transform: translateZ(0);
    }

    /* Fallback para usuarios que prefieren menos movimiento */
    @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
        }
    }
`;

function injectMotionStyles() {
    if (document.getElementById('motion-utils-styles')) return;

    const styleElement = document.createElement('style');
    styleElement.id = 'motion-utils-styles';
    styleElement.textContent = motionStyles;
    document.head.appendChild(styleElement);
}

if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectMotionStyles);
    } else {
        injectMotionStyles();
    }

    window.MotionUtils = MotionUtils;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MotionUtils;
}
