# Sistema de Gestión Empresarial

## Overview

Sistema de gestión empresarial integral que busca proporcionar una experiencia de usuario fluida y profesional, similar a las aplicaciones de escritorio. Desarrollado con Node.js, Express, JavaScript Vanilla y Firebase, el proyecto se enfoca en la estabilidad, la prevención de errores y la optimización del rendimiento mediante técnicas avanzadas como la precarga inteligente de módulos y animaciones sofisticadas. Su propósito es ofrecer una herramienta robusta para la gestión de caja, ventas, créditos, inventario, clientes, usuarios, pagos y proveedores, con una interfaz de usuario altamente reactiva y un manejo eficiente de datos.

## User Preferences

- Lenguaje: Español
- Prioridad: Estabilidad y prevención de bugs
- Enfoque: Soluciones precisas sin afectar funcionalidad existente
- **Módulo inicial después del login**: Notas Internas (remover Dashboard)

## Recent Changes (Dec 20, 2025)

### FIXED: Dashboard Title Flicker Issue - Complete Solution
**Causa raíz**: El Service Worker estaba sirviendo una versión cacheada del HTML que tenía "Dashboard" como título
- **Solución definitiva**: Cambié la estrategia del Service Worker de "Cache First" a "Network First" para index.html
  - Esto hace que el navegador SIEMPRE intente cargar la versión más reciente desde el servidor primero
  - Si no hay conexión, ENTONCES usa la versión cacheada
  - Resultado: Sin parpadeos ni contenido obsoleto, incluso con internet lento
- **Cambios adicionales para eliminar toda referencia a "dashboard"**:
  - `bottom-tab-bar.js`: `activeTab = 'dashboard'` → `activeTab = 'notas'`
  - `auth-system.js`: Removida la verificación especial de 'dashboard' en `filterNavigationByPermissions()`
  - `module-preloader.js`: Todas las referencias de predicción de 'dashboard' → 'notas'
  - Service Worker versión: v1 → v2 para forzar limpieza de caché antiguo
- **Resultado**: Notas Internas carga directamente después del login sin ningún parpadeo visible

## Database Analysis & Recommendations

### Current Setup: Firebase (Google) ✓
- **Authentication**: Firebase Auth (emails + passwords)
- **Database**: Firestore (NoSQL document-based)
- **Collections**: users, notas_internas, ventas, caja, creditos, inventario, clientes, compras, pagos, proveedores, config
- **Real-time Syncing**: Yes (via Firestore listeners)
- **Cloud Functions**: None (todo en el client-side)

### About Free Tier Compatibility ✓✓✓
**Good news**: Firebase free tier es suficiente para tu aplicación porque:
- **Lecturas gratuitas**: 50,000/día
- **Escrituras gratuitas**: 20,000/día
- **Borrados gratuitos**: 20,000/día
- **Almacenamiento**: 1 GB gratis
- **Auth gratuita**: Usuarios ilimitados

**Tu uso estimado**: 
- Pequeño a Mediano (1-50 usuarios concurrentes)
- ~500-1000 operaciones/día típicamente
- **Resultado**: Estarás bien en la versión gratuita ✓

### Alternative: Replit's PostgreSQL Database
Replit ofrece una base de datos PostgreSQL **gratuita con 10GB** pero:
- ❌ No incluye autenticación integrada (tendrías que manejarlo aparte)
- ❌ Requeriría migración de todo el código (cambio importante)
- ✓ Mejor si tu app crece a 10GB+ de datos
- ✓ Mejor si quieres control total del servidor

**Recomendación**: Mantén Firebase. Es más simple, está bien integrado, y la versión gratuita cubre tu caso de uso.

### Best Practices for Free Tier ✓
1. **Índices**: Firestore crea automáticamente índices (gratis en versión gratuita para queries simples)
2. **Límites**: 25 conexiones simultáneas (suficiente para 50 usuarios)
3. **Monitoreo**: Checa la consola de Firebase mensualmente para ver uso real
4. **Optimización**: Usa `limit()` y `where()` para reducir lecturas innecesarias

## System Architecture

### UI/UX Decisions
- **Animaciones "Genie Effect"**: Implementación de animaciones profesionales estilo macOS para la navegación entre módulos desde la barra de pestañas inferior, utilizando Web Animations API con transformaciones 3D, blur y easing personalizado.
- **Skeleton Screens**: Placeholders animados que proporcionan feedback visual inmediato durante la carga de módulos, mejorando la percepción de rendimiento.
- **Selector de Correos Avanzado**: Reemplazo del `datalist` por un dropdown desplegable con filtrado, expansión/colapso y diseño estilo iOS para una mejor selección de usuarios en el login.

### Technical Implementations
- **Frontend**: JavaScript Vanilla para un control total y optimización.
- **Backend**: Node.js + Express actuando como un servidor de archivos estáticos.
- **Módulos Dinámicos**: Carga dinámica de módulos con un `ModuleManager` centralizado para una aplicación SPA (Single Page Application) eficiente.
- **MotionUtils**: Sistema de animaciones encapsulado con `Web Animations API` y easings profesionales (`spring`, `smooth`, `bounce`, `sharp`).
- **ModulePreloader**: Sistema de caché LRU (Least Recently Used) para HTML de módulos (capacidad: 6 módulos), con predicción de navegación y precarga diferida (1 segundo) para optimizar rendimiento.
- **Sistema de Carga de Módulos Optimizado**: Gestión inteligente de CSS y JavaScript de módulos que evita conflictos de estilos y duplicación de scripts. Los CSS de módulos anteriores se limpian automáticamente al cambiar de módulo, y los scripts se reutilizan mediante sus funciones de inicialización en lugar de recargarse.
- **Manejo de Errores Robusto**: Fallbacks automáticos para animaciones, visibilidad garantizada de contenido y `try-catch` en la carga de JS para evitar rupturas.
- **Sistema de Lock para Cajas**: Implementación de un sistema de lock basado en un documento único por vendedor en Firebase para prevenir la duplicación de cajas abiertas debido a condiciones de carrera en entornos multi-dispositivo.
- **Limpieza de Event Listeners**: Uso de referencias a manejadores de eventos y un método `destroy()` en cada módulo para limpiar correctamente los listeners del DOM y evitar duplicaciones al recargar módulos.
- **Patrón Singleton para Módulos**: Prevención de instancias duplicadas de módulos mediante un patrón singleton que destruye la instancia anterior antes de crear una nueva.
- **Actualización en Tiempo Real**: Notificación al sistema de autenticación sobre cambios en la configuración (ej. nombre del negocio) para una actualización inmediata en la interfaz.
- **Sistema de Permisos Graduales**: Control de acceso a funcionalidades específicas dentro de módulos habilitados mediante sub-permisos. Usa `window.authSystem.hasSubPermission(modulo, permiso)` para verificar. Los administradores tienen acceso completo automáticamente. Sub-permisos almacenados en Firestore bajo `userData.subPermisos.{modulo}.{permiso}`.

### Feature Specifications
- **Módulos Principales**: Caja (apertura/cierre/movimientos), Ventas (punto de venta), Créditos, Inventario, Clientes, Usuarios, Pagos, Proveedores, Configuración, Reportes, Notas Internas.
- **Módulo de Notas Internas** (módulo inicial después del login): Sistema de comunicación tipo "post-its de nevera" para recordatorios rápidos entre usuarios del equipo con:
  - Tablero visual de notas adhesivas con colores personalizables (amarillo, rosa, verde, azul, naranja, morado)
  - Efecto visual de rotación y sombra 3D simulando notas pegadas
  - Prioridades: normal y urgente (con badge animado)
  - Visibilidad configurable: todos, solo administradores, solo vendedores
  - Sincronización en tiempo real con Firebase
  - Sistema de "marcar como leída" para auto-eliminación cuando todos leen
  - Opción de auto-eliminar después de 24 horas
  - Filtros: todas, para mí, mis notas, urgentes
  - Almacenado en colección Firebase `notas_internas`
- **Módulo de Reportes**: Sistema completo de análisis y visualización de datos del negocio con:
  - 4 pestañas: Resumen Ejecutivo, Ventas y Finanzas, Inventario y Suministros, Créditos y Clientes
  - Gráficos interactivos con Chart.js (líneas, donuts, barras)
  - KPIs principales: ventas totales, utilidad neta, transacciones, ticket promedio
  - KPIs secundarios: Gastos Operativos y Utilidad Libre (lo que queda después de pagar gastos fijos)
  - Resumen Financiero detallado: ingresos, costo de productos, utilidad bruta, desglose de gastos operativos (nómina, arriendo, servicios, otros), y utilidad neta final
  - Gráfica "Utilidad vs Gastos Operativos" para comparar ganancia real contra gastos fijos
  - Cálculo de utilidad: Las ventas ahora guardan el campo `utilidad` calculado en el momento de la venta, con fallback dinámico para ventas antiguas
  - Gastos operativos: Solo se consideran gastos del módulo Pagos (nómina, arriendo, servicios, proveedores), NO compras de inventario
  - Stock de productos: Usa getStockActual() para productos con variantes/opciones
  - Filtros por período (hoy, ayer, semana, mes, trimestre, año, personalizado)
  - Exportación a PDF, Excel/CSV e impresión
  - Alertas del sistema (stock bajo, productos agotados, créditos vencidos)
  - Diseño iOS-inspired con glassmorphism y animaciones fluidas
- **Módulos Core**: `event-bus.js`, `module-manager.js`, `error-handler.js`, `form-validator.js`, `currency-formatter.js`, `motion-utils.js`, `module-preloader.js`, `skeleton-screen.js`.

### System Design Choices
- **Acceso a Firebase desde el Cliente**: Todas las interacciones con Firebase (Firestore y Auth) se realizan directamente desde el frontend, eliminando la necesidad de Firebase Admin SDK en el servidor.
- **Arquitectura Basada en Módulos**: La aplicación está dividida en módulos independientes, cada uno con su propia lógica y UI, gestionados por un `ModuleManager`.
- **Reglas de Seguridad de Firestore**: Reglas configuradas para permitir la lectura pública de datos esenciales (`users`, `configuracion`) en el login, mientras se mantiene la seguridad para el resto de la aplicación.
- **Puerto Único**: El servidor expone el puerto 5000 para acceso web.

## External Dependencies

- **Firebase Firestore**: Base de datos NoSQL para el almacenamiento de datos.
  - Colecciones: `users`, `clients`, `products`, `categories`, `providers`, `sales`, `cajas`, `cajas_activas`, `abonos`, `pagos`, `configuracion`, `notas_internas`.
- **Firebase Authentication**: Sistema de autenticación de usuarios.
- **Node.js**: Entorno de ejecución para el servidor backend.
- **Express.js**: Framework para el servidor web (sirve archivos estáticos).