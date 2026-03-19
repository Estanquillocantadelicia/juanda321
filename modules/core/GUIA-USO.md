
# 🛠️ Guía de Uso - Nuevas Herramientas

## 🛡️ Sanitización de Inputs

### ¿Para qué sirve?
Limpia automáticamente los datos que los usuarios escriben para evitar código malicioso.

### ¿Cómo usarlo en el módulo de Usuarios?

**Antes de guardar (en usuarios.js, método saveUsuario):**

```javascript
// En lugar de esto:
const nombre = formData.get('nombre');

// Usa esto:
const nombre = window.inputSanitizer.sanitizeText(formData.get('nombre'));
```

**Para sanitizar todo un formulario:**

```javascript
const formData = new FormData(document.getElementById('form-usuario'));
const datosLimpios = window.inputSanitizer.sanitizeFormData(formData);
```

---

## 🔄 Listeners en Tiempo Real

### ¿Para qué sirve?
Actualiza automáticamente la lista de usuarios cuando otro usuario hace cambios, sin necesidad de recargar la página.

### ¿Cómo usarlo en el módulo de Usuarios?

**En el método init() de usuarios.js:**

```javascript
// Agregar después de loadUsuarios()
this.setupRealtimeListener();
```

**Crear el método setupRealtimeListener:**

```javascript
setupRealtimeListener() {
    if (!window.realtimeSync) return;
    
    this.stopRealtimeListener = window.realtimeSync.listenToCollection(
        'users',
        (changes) => {
            // Actualizar automáticamente cuando hay cambios
            if (changes.added.length > 0 || changes.modified.length > 0 || changes.removed.length > 0) {
                this.loadUsuarios();
                this.renderUsuarios();
                
                // Mostrar notificación
                this.showNotification('Lista de usuarios actualizada', 'info');
            }
        },
        'usuarios'
    );
}
```

**En el método destroy() agregar:**

```javascript
// Detener listener al cerrar módulo
if (this.stopRealtimeListener) {
    this.stopRealtimeListener();
}
```

---

## ✅ Ventajas

1. **Seguridad**: Los datos siempre están limpios antes de guardarse
2. **Sincronización**: Varios usuarios pueden trabajar simultáneamente
3. **Sin recargas**: Todo se actualiza automáticamente
4. **Opcional**: Si algo falla, el sistema sigue funcionando normalmente

---

## 📌 Notas Importantes

- Estas herramientas son **opcionales**
- No afectan el código existente
- Puedes activarlas cuando quieras en cada módulo
- Si no las usas, todo sigue funcionando igual
