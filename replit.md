# Sistema de Gestión Empresarial

## Overview

Sistema de gestión empresarial integral que busca proporcionar una experiencia de usuario fluida y profesional, similar a las aplicaciones de escritorio. Desarrollado con Node.js, Express, JavaScript Vanilla y Firebase, el proyecto se enfoca en la estabilidad, la prevención de errores y la optimización del rendimiento mediante técnicas avanzadas como la precarga inteligente de módulos y animaciones sofisticadas. Su propósito es ofrecer una herramienta robusta para la gestión de caja, ventas, créditos, inventario, clientes, usuarios, pagos y proveedores, con una interfaz de usuario altamente reactiva y un manejo eficiente de datos.

## User Preferences

- Lenguaje: Español
- Prioridad: Estabilidad y prevención de bugs
- Enfoque: Soluciones precisas sin afectar funcionalidad existente
- **Módulo inicial después del login**: Notas Internas (remover Dashboard)

## Pendientes acordados con Juan (a implementar más adelante)

1. **Reglas Firestore más estrictas para cancelar venta**: hoy la UI oculta el botón a no-admin, pero técnicamente un usuario podría llamarlo por consola. Bloquear también a nivel servidor (rules).
2. **"Caja de ajuste" cuando se cancela sin caja abierta**: hoy si cancelas una venta en efectivo y la caja ya cerró, el reverso se ignora silenciosamente. Mejor guardarlo como pendiente de conciliar.
3. **Atomicidad real en abonos a crédito**: si dos cajeros abonan al mismo crédito a la vez, puede haber descuadre. Solución: `runTransaction` (complejidad media).
4. **Alertas proactivas de stock crítico**: notificación visual (banner global) cuando un producto baja de un umbral configurable. Hoy solo se ve en Reportes.
5. **Backup automático diario**: hoy es manual. Programar job (Cloud Functions, fuera del plan gratuito) o recordatorio en pantalla cada 24-48h.

## Estado actual

- **APP_VERSION**: `20260523-07`
- **CACHE_NAME**: `sistema-gestion-v53`
- **Último cambio**: Cambio de contraseña honesto + login limpio. (1) Quitado campo "Nueva contraseña" engañoso del modal Editar Usuario (no hacía nada; ahora botón "Enviar correo de restablecimiento"). (2) Nuevo modal **Mi Perfil** en el menú de usuario, con re-autenticación + `updatePassword` inmediato para que cualquier usuario cambie SU propia contraseña. (3) Login limpio: `autocomplete="new-password"` + `value=""` en input password para que el navegador no autorrellene tras cerrar caja/logout. Detalles en `CHANGELOG.md`.

> 📜 **Histórico completo**: ver [`CHANGELOG.md`](./CHANGELOG.md) para todos los cambios anteriores (devolución v2, venta atómica, scanner, bitácora, respaldos, etc.).

## Database Analysis & Recommendations

### Current Setup: Firebase (Google)
- **Authentication**: Firebase Auth (emails + passwords)
- **Database**: Firestore (NoSQL document-based)
- **Real-time Syncing**: Sí (listeners de Firestore)
- **Cloud Functions**: ninguna (todo client-side)

### Free Tier OK para este caso
Firebase free tier cubre: 50k lecturas/día, 20k escrituras/día, 20k borrados/día, 1 GB de almacenamiento, autenticación ilimitada. Para 1–50 usuarios y ~500–1000 ops/día queda holgado. Si crece a 10 GB+ o se necesita control total del servidor, considerar migrar a PostgreSQL (Replit ofrece 10 GB gratis pero requiere reimplementar auth + reescribir todo el cliente).

### Buenas prácticas
- Usar `limit()` y `where()` para reducir lecturas innecesarias.
- Firestore crea índices automáticos para queries simples.
- Revisar consola Firebase mensualmente para ver uso real.

## System Architecture

### UI/UX
- **Animaciones "Genie Effect"** estilo macOS para navegación entre módulos (Web Animations API + 3D transforms + blur + easing personalizado).
- **Skeleton Screens** durante la carga de módulos.
- **Selector de Correos Avanzado** en el login (dropdown con filtrado, estilo iOS).

### Núcleo técnico
- **Frontend**: JavaScript Vanilla.
- **Backend**: Node.js + Express (sirve archivos estáticos).
- **ModuleManager**: SPA con carga dinámica de módulos.
- **MotionUtils**: animaciones encapsuladas con easings (`spring`, `smooth`, `bounce`, `sharp`).
- **ModulePreloader**: caché LRU de 6 módulos con predicción y precarga diferida (1s).
- **Carga de módulos optimizada**: limpieza automática del CSS del módulo anterior; scripts reutilizados vía sus funciones de init (no se recargan).
- **Manejo de errores**: fallbacks de animaciones, visibilidad garantizada, `try-catch` en carga de JS.
- **Lock de cajas**: un único doc en Firebase por vendedor evita duplicar cajas abiertas en multi-dispositivo.
- **Cleanup de listeners**: cada módulo tiene `destroy()` que remueve sus listeners.
- **Singleton por módulo**: destruye instancia anterior antes de crear nueva.
- **Permisos graduales**: `window.authSystem.hasSubPermission(modulo, permiso)`. Admins tienen todo. Sub-permisos en `userData.subPermisos.{modulo}.{permiso}`.

### Módulos
Principales: Caja, Ventas (POS), Créditos, Inventario, Clientes, Usuarios, Pagos, Proveedores, Configuración, Reportes, Notas Internas.

**Notas Internas** (módulo inicial post-login): tablero tipo "post-its" con colores, prioridades (normal/urgente), visibilidad por rol (todos/admin/vendedor), sync real-time, "marcar como leída" para auto-eliminación, auto-eliminar 24 h, filtros (todas/para mí/mías/urgentes). Colección `notas_internas`.

**Reportes**: 4 pestañas (Resumen, Ventas, Inventario, Créditos). Chart.js, KPIs (ventas, utilidad neta, gastos operativos, utilidad libre), filtros de período, export PDF/Excel/print, alertas (stock bajo, agotados, créditos vencidos). Diseño iOS glassmorphism. Las ventas guardan `utilidad` calculada al venderse (con fallback dinámico para ventas antiguas).

**Core**: `event-bus.js`, `module-manager.js`, `error-handler.js`, `form-validator.js`, `currency-formatter.js`, `motion-utils.js`, `module-preloader.js`, `skeleton-screen.js`, `scanner.js`, `scanner-modal.js`, `bitacora-logger.js`, `pagos-helper.js`, `sesiones-activas.js`.

### Decisiones de diseño
- **Firebase desde el cliente**: sin Admin SDK en el servidor.
- **Arquitectura por módulos** independientes gestionados por `ModuleManager`.
- **Lector de códigos universal**: `window.scanner` con HID global (pistola USB/BT) + modal cámara (`BarcodeDetector` nativo con fallback ZXing self-hosted en `/vendor/zxing-browser.min.js`, precacheado por SW). Búsqueda tolerante (normalización, variantes UPC-A↔EAN-13, busca en producto/variante/opción/presentación de conversión). Optimizado para móvil: throttle 12 fps, crop central, resolución adaptativa, anti-duplicado 700 ms. Modos `simple` y `cadena` + asociación in-place. Integrado en Inventario, Ventas POS, Compras.
- **Bitácora / Audit Log**: `window.bitacora.log({tipo, accion, detalle, nivel, gravedad})`. Sólo lectura por admin (reglas Firestore validan identidad vía `get()` contra `users`). Auto-limpieza por lotes con rate-limit 1/h. Hooks: anular venta, eliminar cliente/producto, cierre automático de caja.
- **Sistema de Respaldos**: módulo admin-only, descarga JSON completo (Blob + URL.createObjectURL), registra en `respaldos_log` (inmutable). UI muestra estado (verde/amarillo>7d/rojo>14d) e historial de 30.
- **Control de dispositivos por rol**: `sesiones_activas` con heartbeat 30 s, limpieza de zombies >5 min. Límites por defecto: admin 2, supervisor 2, vendedor 1 (override por usuario con `maxDispositivos`). Modal "demasiados dispositivos" + pantalla "Mis Dispositivos". Si Firestore falla, login normal continúa.
- **Caché de módulos en memoria**: contenedores DOM con listeners Firebase vivos se guardan en `businessSystem.moduleContainers` (Map). Al volver: se mueve de `#module-cache` a `#main-content` con fade-in 0.18 s — sin re-lecturas. Hook `onResume()` disponible.
- **Reglas Firestore**: lectura pública de `users` y `configuracion` para el login; resto protegido. Reglas de `/users/{userId}`: sólo admin crea/elimina y cambia rol; el dueño actualiza su propio doc pero NO el rol.
- **Puerto único**: servidor en `5000`.

## External Dependencies

- **Firebase Firestore** — Base NoSQL.
  - Colecciones: `users`, `clients`, `products`, `categories`, `providers`, `sales`, `cajas`, `cajas_activas`, `abonos`, `pagos`, `configuracion`, `notas_internas`, `sesiones_activas`, `respaldos_log`, `bitacora`.
- **Firebase Authentication** — Autenticación de usuarios.
- **Node.js** — Runtime del servidor.
- **Express.js** — Sirve archivos estáticos.
- **Chart.js** — Gráficos del módulo Reportes.
- **ZXing (@zxing/browser)** — Fallback de decodificación de códigos (self-hosted).
