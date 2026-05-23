# Changelog — Sistema de Gestión Empresarial

Histórico cronológico de cambios mayores. Entradas más recientes arriba.

---

## 2026-05-23 — noche IV · APP_VERSION `20260523-07`, CACHE `v53`

### Cambio de contraseña honesto + login limpio
**Pedido de Juan**: "cuando cierro caja quiero que la sesión se cierre y que el login no traiga la contraseña autorrellenada. Y cuando cambio mi contraseña desde Usuarios no se guarda."

**Diagnóstico**:
- El Firebase Web SDK **no permite** cambiar la contraseña de OTRO usuario; solo del actual con re-auth + `updatePassword`. El código en `modules/usuarios/usuarios.js` L623-640 hacía un workaround engañoso: el campo "Nueva contraseña" en el modal Editar Usuario en realidad disparaba un `sendPasswordResetEmail`, sin guardar lo que el admin escribía. UX confusa → Juan creía que cambiaba, pero no.
- El input `#login-password` tenía `autocomplete="current-password"`, lo que hacía que el gestor del navegador rellenara la contraseña tras cerrar sesión.

**Solución aplicada (Opción A — cero infra, $0)**:

1. **Login limpio** (`auth-system.js` L476-484):
   - `autocomplete="current-password"` → `"new-password"` (engaña al gestor; estándar para evitar autofill).
   - `value=""` explícito en el HTML del input.
   - El email ya tenía `autocomplete="off"`.

2. **Modal Editar Usuario, fin del campo engañoso** (`modules/usuarios/usuarios.html` + `modules/usuarios/usuarios.js`):
   - Nuevo grupo `#reset-password-group` (oculto por defecto) con texto claro: *"Por seguridad, no es posible ver ni cambiar la contraseña actual de otro usuario. Puedes enviarle un correo para que él mismo la restablezca."* + botón **📧 Enviar correo de restablecimiento**.
   - `openModal(usuario)` alterna: en EDICIÓN oculta `#password-group` y muestra `#reset-password-group`; en CREACIÓN al revés. Reset on click → `sendPasswordResetEmail` + bitácora + feedback inline.
   - `saveUser()` ya no procesa `formData.get('password')` para usuarios existentes — bloque eliminado, comportamiento ahora 100% explícito.
   - Comportamiento de creación intacto: contraseña inicial vía instancia secundaria de Firebase (sin perder sesión admin).

3. **Nuevo modal "Mi Perfil"** (`user-menu.js`):
   - Botón **Mi Perfil** en el menú de usuario, ANTES de Mis Dispositivos, accesible a todos los roles.
   - Modal con datos del usuario (nombre, correo, rol — solo lectura) + formulario "Cambiar mi contraseña" con 3 campos: contraseña actual, nueva (mín. 8), confirmar.
   - Flujo: `firebase.auth.EmailAuthProvider.credential(email, actual)` → `reauthenticateWithCredential()` → `updatePassword(nueva)`. Cambio **inmediato y real**.
   - Bitácora: `accion: 'cambio_password_propio'`.
   - Mensajes de error mapeados: `wrong-password`, `weak-password`, `requires-recent-login`, `too-many-requests`.
   - Validaciones: confirmación debe coincidir, nueva ≠ actual, mín. 8 caracteres.

**Seguridad respetada**:
- Mi Perfil NO permite cambiar rol ni permisos (solo lectura), respetando la regla de Juan: "los vendedores no se dan/quitan accesos".
- Módulo Usuarios sigue siendo solo-admin (igual que hoy).
- Reglas Firestore ya impedían que el dueño cambiara su propio `rol` (preservado de iteración previa).
- Re-autenticación obligatoria antes de cambiar la propia contraseña → bloquea ataques con teléfono prestado.

**Pendiente acordado para más adelante** (Opción B, cuando se rentabilice):
- Implementar endpoint admin en `server.js` con Firebase Admin SDK para que el admin pueda cambiar la contraseña de cualquier usuario inmediatamente desde el panel (hoy solo se envía correo de reset, que es estándar de Google/Microsoft/etc).

**Archivos tocados**: `auth-system.js`, `modules/usuarios/usuarios.html`, `modules/usuarios/usuarios.js`, `user-menu.js`, `index.html`, `service-worker.js`, `replit.md`.

---

## 2026-05-23 — noche III · APP_VERSION `20260523-06`, CACHE `v52`

### Historial de Pagos agrupado por `batchId` (cero pérdida de datos)
**Pedido de Juan**: "el historial de pagos se ve saturado porque cuando hago un abono general que cubre varias ventas, o un pago de nómina a varios empleados, aparecen N líneas separadas. Quiero ver una sola línea con el total."

**Análisis previo**: se consideró agrupar los datos a nivel BD (1 solo doc en `pagos`), pero eso rompía el historial propio de Nómina (que lee de la misma colección `pagos` filtrando por `tipo='nomina'`). Se eligió **agrupación visual** (sólo en el render), que respeta los datos.

**Cambios**:

1. **`modules/creditos/creditos.js` — `procesarAbonoGeneral`**: se genera un `batchIdAbono = abono_gen_${timestamp}_${rand}` único antes del loop, y cada doc creado en `pagos` lleva esos campos compartidos: `batchId`, `batchTipo: 'abono_credito'`, `batchTotal` (suma aplicada), `batchSize` (cantidad de ventas), `batchLabel` (`Abono general — {clienteNombre}`). Los docs en colección `abonos` y el historial por venta NO se tocan.

2. **`modules/pagos/pagos.js` — `renderHistorial`**: refactorizado para agrupar movimientos por `batchId` antes de renderizar. Helpers nuevos:
   - `_renderFilaMovimiento(mov, formatter)`: fila individual (igual que antes).
   - `_renderFilaGrupo(batchId, items, formatter)`: fila resumen colapsable. Detecta tipo (nómina/abono/otro) y muestra ícono + etiqueta + total + cantidad. Hijas se renderizan ocultas (`display:none`) con sangría e icono `↳`.
   - `_toggleGrupo(grupoIdSafe)`: alterna visibilidad de las filas hijas y rota un caret `▸` → `▾`.
   - Grupos de 1 elemento se renderizan como fila normal (sin colapsar).
   - `grupoIdSafe` sanitiza el batchId a `[a-zA-Z0-9_-]` para uso seguro en selectores.

3. **Nómina**: NO requiere cambios — ya guardaba `batchId` desde antes (línea 706 de `pagos.js`). El render lo aprovecha automáticamente.

**Compatibilidad preservada**:
- Movimientos antiguos sin `batchId` → renderizados como filas individuales (comportamiento previo).
- Totales sumados (cierre de caja, reportes) → idénticos, sólo se cambió la presentación.
- Historial propio de Nómina (`renderHistorialNomina`) → intacto, sigue mostrando un registro por empleado.
- Colección `abonos` y `venta.abonos[]` → sin cambios.

---

## 2026-05-23 — noche II · APP_VERSION `20260523-05`, CACHE `v51`

### Pestañas de carrito v2 (UI Pro) — 7 mejoras integradas
**Pedido de Juan**: que las pestañas de carrito se sintieran "tipo POS de gama alta". Implementadas 7 mejoras coordinadas en `modules/ventas/ventas.js` + `ventas.css`:

1. **Renombrar con modal bonito** (reemplaza `prompt()`): doble-click o botón abre overlay con input + selector de color (7 chips), atajos Enter/Esc, click fuera cierra. Sanitización con `_escaparHtml`, máximo 40 chars.
2. **Badge con monto + items**: pestaña activa muestra `nombre · N items · $monto` (chip de monto + chip de count, ambos con color del carrito); compacta muestra dot color + número + mini-badge con count.
3. **Color por carrito**: paleta de 7 colores (`blue, green, purple, orange, pink, teal, red`). `_elegirColorCarrito()` asigna automáticamente el color menos usado al crear. Migración automática en `cargarCarritosGuardados()` para carritos viejos sin color. CSS usa `--carrito-color` + `color-mix()` para variantes (bg, sombra, badges).
4. **Drag & drop nativo** (HTML5 API): pestañas `draggable="true"`, listeners en `_configurarDragDropCarritos`. Visual `dragging` (opacidad 0.45) + `drop-target` (línea lateral del color). `_reordenarCarritos` ajusta `carritoActivo` correctamente según cómo se mueve el drag respecto al activo.
5. **Animaciones suaves**: keyframe `carritoTabEntra` (scale + fade) al renderizar, transiciones `cubic-bezier(0.34, 1.56, 0.64, 1)` en hover/active/dot/icon. Modales con `rcModalIn/Out` y `rcOverlayIn/Out`.
6. **Atajos de teclado** (`_configurarAtajosTecladoCarrito`, listener global único): `Ctrl/Cmd+T` nuevo carrito, `Ctrl/Cmd+W` cerrar actual, `Ctrl/Cmd+1..9` saltar al N. Sólo activos si `#tab-pos` está visible. Respeta inputs (no interfiere al escribir).
7. **Vista todos los carritos**: nuevo botón grid (esquina derecha) abre `modal-vista-todos-carritos` con grid responsivo de cards (mínimo 220px, auto-fill). Cada card: borde superior del color, nombre, monto grande, count + tipo, últimos 3 items o "vacío". Click en card → cambia carrito y cierra. Card activa marcada con badge "ACTIVA".

**Helpers añadidos al final de la clase `VentasModule`**:
- `_inicializarColoresCarrito`, `_elegirColorCarrito`, `_hexColorCarrito`
- `_totalCarrito(index)` — usa `this.carrito` para el activo (datos vivos), `carrito.items` para los demás
- `_escaparHtml(s)` — sanitiza nombres en innerHTML
- `_configurarDragDropCarritos`, `_reordenarCarritos`
- `_configurarAtajosTecladoCarrito` (idempotente via flag `_atajosCarritoConfigurados`)
- `abrirModalRenombrarCarrito`, `cerrarModalRenombrarCarrito`, `guardarRenombreCarrito`
- `abrirModalVistaTodosCarritos`, `cerrarModalVistaTodosCarritos`

**Lifecycle**: `destroy()` limpia los listeners globales (atajos + Esc del modal grid) para evitar fugas al recargar el módulo.

**Compatibilidad preservada**: NO se tocó la lógica de `carritoAutorizadoId`, `cambiarCarrito`, `cerrarCarrito`, sincronización con `tipo-venta`/`metodo-venta`, ni el flujo de venta. Sólo añadidos visuales y el modal de renombrar reemplaza el `prompt()`.

---

## 2026-05-23 — noche · APP_VERSION `20260523-04`, CACHE `v50`

### Venta atómica + validación de stock previa
**Auditoría exhaustiva detectó 2 bugs en `confirmarVenta` (modules/ventas/ventas.js):**

1. **CRÍTICO — falta de atomicidad**: la venta se guardaba con `add()`, luego se actualizaba inventario en un batch aparte, luego se creaban los pagos de tarjeta/transferencia uno a uno con `add()`. Si fallaba internet entre pasos → estado inconsistente (venta sin descuento de stock, o sin registro en Pagos).
2. **ALTO — sin hard-check de stock**: el POS permitía vender más de lo disponible (stock negativo).

**Solución implementada**:
- Nuevo helper `_prepararCambiosInventario(items)` lee todos los productos en paralelo, valida stock suficiente para los 4 tipos (simple, variante-simple, variante-opción, conversión-con-factor) y devuelve `{ok, updates, faltantes}`.
- Si `ok=false` → la venta se aborta ANTES de cualquier escritura, con alert detallado: "• Producto X: disponible 3, requerido 10".
- Si `ok=true` → un único `batchVenta` agrupa: `set(ventaRef, venta)` + `update(productoRef, …)` por cada producto + `set(pagoRef, …)` por cada componente tarjeta/transferencia. Un solo `commit()`: o todo se persiste o nada.
- `ventaRef` se preasigna con `.doc()` para usar su ID en `origenVenta` de los pagos antes del commit.
- El bloque viejo de pagos separados eliminado; `actualizarInventario()` marcado `@deprecated` pero conservado por compatibilidad con código externo.

**Beneficios**:
- Imposible que quede una venta sin descontar inventario o sin registro en Pagos.
- Inventario nunca queda negativo por la venta normal.
- Devolución v2 ya era atómica → ahora venta y devolución tienen la misma garantía.

**Riesgo residual aceptado**: sin `runTransaction` sobre lecturas previas — dos dispositivos vendiendo el mismo producto pueden ambos pasar la validación y dejar stock negativo. Aceptable para 1 vendedor (caso de Juan).

---

## 2026-05-23 — tarde · APP_VERSION `20260523-03`, CACHE `v49`

### Devolución de Ventas v2 — Soporte completo de tipos de pago
**Problema detectado por Juan**: la devolución sólo manejaba efectivo. Con tarjeta/transferencia/crédito/mixto los módulos quedaban descuadrados.

**Solución integral** (efectivo + tarjeta + transferencia + crédito + mixto):

1. **Nuevo helper en `modules/core/pagos-helper.js`**: `distribuirMontoProporcional(venta, monto)` reparte un monto a devolver entre los componentes de pago originales con redondeo a 2 decimales y corrección de descuadre.

2. **`modules/ventas/ventas.js` (`confirmarCancelacionVenta`)**:
   - Calcula distribución proporcional por método.
   - **EFECTIVO**: emite evento `venta:cancelada` con `montoEfectivo` específico (no el total).
   - **TARJETA/TRANSFERENCIA**: crea documentos en colección `pagos` (egreso, categoría='Devolución de venta', con `concepto` requerido por reglas Firestore). Sólo si `devolverDinero=true`.
   - **CRÉDITO**: reduce `saldoPendiente` dentro del mismo batch. Si la devolución del crédito sobrepasa el saldo actual (cliente ya abonó parte), el excedente se reembolsa como efectivo. **El crédito se reduce SIEMPRE**, incluso si `devolverDinero=false` (sería injusto cobrar deuda por algo que el cliente devolvió).
   - Snapshot de distribución guardado en `devolucion.distribucion` para auditoría.
   - Modal muestra desglose en vivo "Efectivo→caja, Tarjeta→pagos, Crédito→deuda" + aviso si hay excedente.
   - Alert final con desglose por método.

3. **`modules/caja/caja.js`**:
   - `procesarEventoVenta`: usa `data.montoEfectivo` (nuevo) con fallback legacy a `data.total` cuando `metodoPago==='efectivo'`.
   - `registrarMovimientoCancelacion` acepta `montoOverride` y diferencia "VENTA CANCELADA" vs "DEVOLUCIÓN PARCIAL".
   - **FIX descuadre mixtos**: `renderEstadoCaja` (L1488) y cierre de caja (L2867) ahora usan `PagosHelper.obtenerMontoPorMetodo` para descomponer ventas mixtas en cada bucket (efectivo/tarjeta/transferencia/crédito) en lugar del campo plano `metodoPago` que perdía mixtas.

4. **Atomicidad**: batch único incluye productos (stock) + venta (saldoPendiente/estado/devoluciones) + docs en `pagos` (tarjeta/transferencia). Si falla cualquier op, nada se persiste.

**Riesgo residual aceptado**: sin `runTransaction` sobre lecturas previas (concurrencia multi-dispositivo) — no bloqueante para 1 vendedor.

---

## 2026-05-23 — mañana · APP_VERSION `20260523-01`, CACHE `v47`

### Devolución de Ventas — Mejoras Críticas
**3 mejoras integradas en el modal de cancelar venta (`abrirModalCancelarVenta` / `confirmarCancelacionVenta` en `modules/ventas/ventas.js`):**

1. **FIX BUG conversiones al cancelar**: Antes se leía `item.conversion?.cantidad` pero ese objeto NUNCA se guarda en la venta (sólo `conversionIndex`). Resultado: en ventas con cigarrillos/cervezas por presentación (paquete, six-pack), el stock NO se devolvía al cancelar. Ahora se lee el factor desde `productoData.conversiones[item.conversionIndex].cantidad` (con fallback al campo viejo para ventas históricas).
2. **Bloqueo del botón al cancelar**: Doble-click ya no descontrola inventario. Botones `btn-confirmar/btn-cancelar/btn-close` se deshabilitan al inicio mostrando "⏳ Procesando...", se restauran en `finally` (también en error para permitir reintento).
3. **Devolución parcial**: Nuevo modal con lista de productos + checkbox por línea + input cantidad por línea + checkbox "Devolver dinero al cliente" (default activado). Soporta devoluciones acumulativas (varias parciales en distintos momentos). Cálculo de `yaDevuelto` por matching exacto de línea (productoId + varianteIndex + opcionIndex + conversionIndex).
   - Si devuelve TODO lo disponible → `estado='cancelada'` (comportamiento histórico).
   - Si parcial → `estado='parcialmente_devuelta'`, se guarda histórico en `venta.devoluciones[]` con `{fecha, motivo, items, devolvioDinero, montoReintegrado, usuario, esTotal}`.
   - Si `devolverDinero=true` y método=efectivo: emite evento `venta:cancelada` con monto parcial → caja reversa proporcional.
   - **Integridad**: si conversión sin factor válido → omite ese ítem (no stock, no dinero) y registra en log; si TODOS los ítems se omiten → throw rollback (batch atómico, nada se persiste).
4. **`puedeEliminar` extendido** en historial para incluir `parcialmente_devuelta` (permite seguir devolviendo).

**Riesgo residual aceptado**: sin `runTransaction` sobre `sales+products`; para 1 vendedor con baja simultaneidad NO es bloqueante. A revisar si crece a uso multi-dispositivo intenso.

---

## 2025-12-20

### FIXED: Dashboard Title Flicker Issue — Complete Solution
**Causa raíz**: El Service Worker estaba sirviendo una versión cacheada del HTML que tenía "Dashboard" como título.
- **Solución definitiva**: Cambié la estrategia del Service Worker de "Cache First" a "Network First" para index.html.
  - El navegador SIEMPRE intenta cargar la versión más reciente desde el servidor primero.
  - Si no hay conexión, ENTONCES usa la versión cacheada.
  - Resultado: Sin parpadeos ni contenido obsoleto, incluso con internet lento.
- **Cambios adicionales para eliminar toda referencia a "dashboard"**:
  - `bottom-tab-bar.js`: `activeTab = 'dashboard'` → `activeTab = 'notas'`
  - `auth-system.js`: Removida la verificación especial de 'dashboard' en `filterNavigationByPermissions()`
  - `module-preloader.js`: Todas las referencias de predicción de 'dashboard' → 'notas'
  - Service Worker versión: v1 → v2 para forzar limpieza de caché antiguo
- **Resultado**: Notas Internas carga directamente después del login sin ningún parpadeo visible.
