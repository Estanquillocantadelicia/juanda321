/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MÓDULO: SkeletonScreen - Sistema de Pantallas de Carga v2.0
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * ¿QUÉ HACE ESTE ARCHIVO?
 * Muestra una "silueta" del contenido mientras se carga el módulo real.
 * Esto hace que la app se sienta más rápida porque el usuario ve algo
 * inmediatamente, en lugar de una pantalla en blanco.
 * 
 * ¿POR QUÉ ES IMPORTANTE?
 * Los estudios de UX muestran que los usuarios perciben las apps como
 * más rápidas cuando ven un placeholder animado vs un spinner girando.
 * 
 * MEJORAS IMPLEMENTADAS:
 * 
 * 1. APARICIÓN INSTANTÁNEA (<100ms)
 *    - El skeleton aparece inmediatamente al solicitar un módulo
 *    - No hay retraso perceptible
 * 
 * 2. TRANSICIÓN SUAVE AL CONTENIDO REAL
 *    - El skeleton se desvanece gradualmente
 *    - El contenido real aparece suavemente
 *    - No hay "saltos" bruscos en la interfaz
 * 
 * 3. MEJOR ANIMACIÓN "SHIMMER"
 *    - Efecto de brillo que se mueve de izquierda a derecha
 *    - Indica que algo está cargando sin ser molesto
 * 
 * 4. ROLES ARIA PARA ACCESIBILIDAD
 *    - Los lectores de pantalla anuncian "Cargando contenido"
 *    - Mejor experiencia para usuarios con discapacidad visual
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

class SkeletonScreen {
    static activeAnimations = [];
    static isVisible = false;
    static mountTime = 0;
    static minDisplayTime = 200;

    /**
     * CREAR SKELETON INMEDIATAMENTE
     * Devuelve el HTML del skeleton según el tipo solicitado
     */
    static create(type = 'module') {
        const templates = {
            module: this.createModuleSkeleton(),
            list: this.createListSkeleton(),
            card: this.createCardSkeleton(),
            form: this.createFormSkeleton(),
            table: this.createTableSkeleton()
        };

        return templates[type] || templates.module;
    }

    /**
     * MONTAR SKELETON EN UN CONTENEDOR
     * Versión mejorada que aparece instantáneamente
     */
    static mount(container, type = 'module') {
        if (!container) return;

        this.mountTime = performance.now();
        this.isVisible = true;

        container.style.opacity = '1';
        container.innerHTML = this.create(type);

        this.startAnimation();

        console.log('💀 Skeleton montado instantáneamente');
    }

    /**
     * DESMONTAR SKELETON CON TRANSICIÓN SUAVE
     * Espera un tiempo mínimo para evitar "parpadeos"
     */
    static async unmount(container, fadeOutDuration = 200) {
        if (!container || !this.isVisible) return;

        const elapsedTime = performance.now() - this.mountTime;
        const remainingTime = Math.max(0, this.minDisplayTime - elapsedTime);

        if (remainingTime > 0) {
            await new Promise(resolve => setTimeout(resolve, remainingTime));
        }

        const skeletons = container.querySelectorAll('[data-skeleton="true"]');

        if (skeletons.length > 0 && window.MotionUtils) {
            const fadePromises = Array.from(skeletons).map(skeleton => 
                window.MotionUtils.fadeOut(skeleton, fadeOutDuration).then(() => {
                    skeleton.remove();
                })
            );
            await Promise.all(fadePromises);
        } else {
            skeletons.forEach(skeleton => skeleton.remove());
        }

        this.stopAnimations();
        this.isVisible = false;

        console.log('💀 Skeleton desmontado suavemente');
    }

    /**
     * SKELETON PARA MÓDULO COMPLETO
     * Incluye header, estadísticas y contenido
     */
    static createModuleSkeleton() {
        return `
            <div class="skeleton-container" data-skeleton="true" role="status" aria-label="Cargando contenido">
                <div class="skeleton-header">
                    <div class="skeleton-title skeleton-shimmer"></div>
                    <div class="skeleton-subtitle skeleton-shimmer"></div>
                </div>

                <div class="skeleton-stats">
                    <div class="skeleton-stat-card skeleton-shimmer"></div>
                    <div class="skeleton-stat-card skeleton-shimmer"></div>
                    <div class="skeleton-stat-card skeleton-shimmer"></div>
                    <div class="skeleton-stat-card skeleton-shimmer"></div>
                </div>

                <div class="skeleton-content">
                    <div class="skeleton-line skeleton-shimmer"></div>
                    <div class="skeleton-line short skeleton-shimmer"></div>
                    <div class="skeleton-line skeleton-shimmer"></div>
                    <div class="skeleton-line medium skeleton-shimmer"></div>
                </div>

                <span class="sr-only">Cargando contenido del módulo...</span>
            </div>
        `;
    }

    /**
     * SKELETON PARA LISTAS
     */
    static createListSkeleton() {
        return `
            <div class="skeleton-list" data-skeleton="true" role="status" aria-label="Cargando lista">
                ${Array(5).fill(0).map(() => `
                    <div class="skeleton-list-item">
                        <div class="skeleton-avatar skeleton-shimmer"></div>
                        <div class="skeleton-list-content">
                            <div class="skeleton-line skeleton-shimmer"></div>
                            <div class="skeleton-line short skeleton-shimmer"></div>
                        </div>
                    </div>
                `).join('')}
                <span class="sr-only">Cargando lista...</span>
            </div>
        `;
    }

    /**
     * SKELETON PARA TARJETAS
     */
    static createCardSkeleton() {
        return `
            <div class="skeleton-cards" data-skeleton="true" role="status" aria-label="Cargando tarjetas">
                ${Array(3).fill(0).map(() => `
                    <div class="skeleton-card">
                        <div class="skeleton-card-image skeleton-shimmer"></div>
                        <div class="skeleton-card-content">
                            <div class="skeleton-line skeleton-shimmer"></div>
                            <div class="skeleton-line medium skeleton-shimmer"></div>
                        </div>
                    </div>
                `).join('')}
                <span class="sr-only">Cargando tarjetas...</span>
            </div>
        `;
    }

    /**
     * SKELETON PARA FORMULARIOS
     */
    static createFormSkeleton() {
        return `
            <div class="skeleton-form" data-skeleton="true" role="status" aria-label="Cargando formulario">
                ${Array(4).fill(0).map(() => `
                    <div class="skeleton-form-group">
                        <div class="skeleton-label skeleton-shimmer"></div>
                        <div class="skeleton-input skeleton-shimmer"></div>
                    </div>
                `).join('')}
                <div class="skeleton-button skeleton-shimmer"></div>
                <span class="sr-only">Cargando formulario...</span>
            </div>
        `;
    }

    /**
     * SKELETON PARA TABLAS (NUEVO)
     */
    static createTableSkeleton() {
        return `
            <div class="skeleton-table" data-skeleton="true" role="status" aria-label="Cargando tabla">
                <div class="skeleton-table-header">
                    ${Array(4).fill(0).map(() => `
                        <div class="skeleton-table-th skeleton-shimmer"></div>
                    `).join('')}
                </div>
                ${Array(5).fill(0).map(() => `
                    <div class="skeleton-table-row">
                        ${Array(4).fill(0).map(() => `
                            <div class="skeleton-table-td skeleton-shimmer"></div>
                        `).join('')}
                    </div>
                `).join('')}
                <span class="sr-only">Cargando tabla de datos...</span>
            </div>
        `;
    }

    /**
     * INICIAR ANIMACIONES SHIMMER
     * Usa CSS animations para eficiencia (mejor que JavaScript)
     */
    static startAnimation() {
        this.stopAnimations();
        console.log('✨ Animaciones shimmer iniciadas (CSS puro)');
    }

    /**
     * DETENER ANIMACIONES
     */
    static stopAnimations() {
        this.activeAnimations.forEach(anim => {
            if (anim && anim.cancel) {
                anim.cancel();
            }
        });
        this.activeAnimations = [];
    }

    /**
     * REMOVER SKELETON (método legacy para compatibilidad)
     */
    static remove() {
        const skeletons = document.querySelectorAll('[data-skeleton="true"]');
        skeletons.forEach(skeleton => {
            if (window.MotionUtils) {
                window.MotionUtils.fadeOut(skeleton, 200).then(() => {
                    skeleton.remove();
                });
            } else {
                skeleton.remove();
            }
        });
        this.stopAnimations();
        this.isVisible = false;
    }
}

/**
 * ESTILOS DEL SKELETON
 * 
 * El efecto "shimmer" se logra con:
 * 1. Un gradiente que va de gris claro a blanco y de vuelta a gris
 * 2. Una animación que mueve ese gradiente de izquierda a derecha
 * 3. Esto crea la ilusión de un brillo que pasa por encima
 */
const skeletonStyles = `
    /* Animación shimmer - el efecto de brillo que se mueve */
    @keyframes skeleton-shimmer {
        0% {
            background-position: -200% 0;
        }
        100% {
            background-position: 200% 0;
        }
    }

    /* Entrada del skeleton */
    @keyframes skeleton-fade-in {
        from {
            opacity: 0;
            transform: translateY(10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    /* Clase base para elementos con shimmer */
    .skeleton-shimmer {
        background: linear-gradient(
            90deg,
            #f0f0f0 25%,
            #e8e8e8 37%,
            #f0f0f0 63%
        );
        background-size: 200% 100%;
        animation: skeleton-shimmer 1.5s ease-in-out infinite;
    }

    /* Contenedor principal */
    .skeleton-container {
        padding: 24px;
        animation: skeleton-fade-in 200ms ease-out;
    }

    .skeleton-header {
        margin-bottom: 32px;
    }

    .skeleton-title {
        height: 36px;
        width: 200px;
        border-radius: 8px;
        margin-bottom: 12px;
    }

    .skeleton-subtitle {
        height: 20px;
        width: 300px;
        border-radius: 6px;
    }

    .skeleton-stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 16px;
        margin-bottom: 32px;
    }

    .skeleton-stat-card {
        height: 120px;
        border-radius: 16px;
    }

    .skeleton-content {
        margin-top: 24px;
    }

    .skeleton-line {
        height: 16px;
        border-radius: 4px;
        margin-bottom: 12px;
    }

    .skeleton-line.short {
        width: 60%;
    }

    .skeleton-line.medium {
        width: 80%;
    }

    /* Lista */
    .skeleton-list {
        padding: 16px;
    }

    .skeleton-list-item {
        display: flex;
        gap: 16px;
        padding: 16px;
        margin-bottom: 12px;
        background: white;
        border-radius: 12px;
    }

    .skeleton-avatar {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        flex-shrink: 0;
    }

    .skeleton-list-content {
        flex: 1;
    }

    /* Tarjetas */
    .skeleton-cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 20px;
        padding: 16px;
    }

    .skeleton-card {
        background: white;
        border-radius: 16px;
        overflow: hidden;
    }

    .skeleton-card-image {
        height: 150px;
    }

    .skeleton-card-content {
        padding: 16px;
    }

    /* Formulario */
    .skeleton-form {
        padding: 24px;
    }

    .skeleton-form-group {
        margin-bottom: 20px;
    }

    .skeleton-label {
        height: 16px;
        width: 120px;
        border-radius: 4px;
        margin-bottom: 8px;
    }

    .skeleton-input {
        height: 44px;
        border-radius: 8px;
    }

    .skeleton-button {
        height: 48px;
        width: 150px;
        border-radius: 12px;
        margin-top: 24px;
    }

    /* Tabla */
    .skeleton-table {
        padding: 16px;
    }

    .skeleton-table-header {
        display: flex;
        gap: 12px;
        padding: 12px;
        margin-bottom: 8px;
    }

    .skeleton-table-th {
        flex: 1;
        height: 20px;
        border-radius: 4px;
    }

    .skeleton-table-row {
        display: flex;
        gap: 12px;
        padding: 12px;
        margin-bottom: 8px;
        background: white;
        border-radius: 8px;
    }

    .skeleton-table-td {
        flex: 1;
        height: 16px;
        border-radius: 4px;
    }

    /* Accesibilidad - ocultar texto solo para lectores de pantalla */
    .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
    }
`;

function injectSkeletonStyles() {
    if (document.getElementById('skeleton-screen-styles')) return;

    const styleElement = document.createElement('style');
    styleElement.id = 'skeleton-screen-styles';
    styleElement.textContent = skeletonStyles;
    document.head.appendChild(styleElement);
}

if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectSkeletonStyles);
    } else {
        injectSkeletonStyles();
    }

    window.SkeletonScreen = SkeletonScreen;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SkeletonScreen;
}
