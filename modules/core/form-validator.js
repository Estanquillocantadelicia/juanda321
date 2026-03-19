
// Sistema de Validación de Formularios
class FormValidator {
    constructor() {
        this.rules = {
            required: (value) => value.trim() !== '',
            email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
            minLength: (value, length) => value.length >= length,
            maxLength: (value, length) => value.length <= length,
            numeric: (value) => !isNaN(value) && value.trim() !== '',
            positive: (value) => parseFloat(value) > 0,
            phone: (value) => /^[0-9]{10}$/.test(value.replace(/\s/g, '')),
            noSpecialChars: (value) => /^[a-zA-Z0-9\sáéíóúÁÉÍÓÚñÑ]+$/.test(value),
            password: (value) => value.length >= 8
        };

        this.messages = {
            required: 'Este campo es obligatorio',
            email: 'Ingresa un email válido',
            minLength: 'Mínimo {length} caracteres',
            maxLength: 'Máximo {length} caracteres',
            numeric: 'Solo números permitidos',
            positive: 'Debe ser un número positivo',
            phone: 'Ingresa un teléfono válido (10 dígitos)',
            noSpecialChars: 'No se permiten caracteres especiales',
            password: 'Mínimo 8 caracteres'
        };
    }

    // Validar un campo individual
    validateField(value, rules) {
        const errors = [];

        for (const rule of rules) {
            let isValid = false;
            let message = '';

            if (typeof rule === 'string') {
                // Regla simple: 'required', 'email', etc.
                isValid = this.rules[rule](value);
                message = this.messages[rule];
            } else if (typeof rule === 'object') {
                // Regla con parámetros: { type: 'minLength', value: 8 }
                const { type, value: ruleValue } = rule;
                isValid = this.rules[type](value, ruleValue);
                message = this.messages[type].replace('{length}', ruleValue);
            }

            if (!isValid) {
                errors.push(message);
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    // Validar un formulario completo
    validateForm(formElement, validationRules) {
        const formData = new FormData(formElement);
        const results = {};
        let isFormValid = true;

        for (const [fieldName, rules] of Object.entries(validationRules)) {
            const value = formData.get(fieldName) || '';
            const result = this.validateField(value, rules);
            
            results[fieldName] = result;
            
            if (!result.isValid) {
                isFormValid = false;
                this.showFieldError(formElement, fieldName, result.errors[0]);
            } else {
                this.clearFieldError(formElement, fieldName);
            }
        }

        return {
            isValid: isFormValid,
            results
        };
    }

    // Mostrar error en campo
    showFieldError(formElement, fieldName, message) {
        const field = formElement.querySelector(`[name="${fieldName}"]`);
        if (!field) return;

        // Agregar clase de error
        field.classList.add('error');

        // Crear o actualizar mensaje de error
        let errorMsg = field.parentElement.querySelector('.field-error');
        if (!errorMsg) {
            errorMsg = document.createElement('span');
            errorMsg.className = 'field-error';
            field.parentElement.appendChild(errorMsg);
        }
        errorMsg.textContent = message;
    }

    // Limpiar error de campo
    clearFieldError(formElement, fieldName) {
        const field = formElement.querySelector(`[name="${fieldName}"]`);
        if (!field) return;

        field.classList.remove('error');
        
        const errorMsg = field.parentElement.querySelector('.field-error');
        if (errorMsg) {
            errorMsg.remove();
        }
    }

    // Validación en tiempo real
    setupRealtimeValidation(formElement, validationRules) {
        for (const fieldName of Object.keys(validationRules)) {
            const field = formElement.querySelector(`[name="${fieldName}"]`);
            if (!field) continue;

            field.addEventListener('blur', () => {
                const value = field.value;
                const result = this.validateField(value, validationRules[fieldName]);
                
                if (!result.isValid) {
                    this.showFieldError(formElement, fieldName, result.errors[0]);
                } else {
                    this.clearFieldError(formElement, fieldName);
                }
            });

            // Limpiar error al empezar a escribir
            field.addEventListener('input', () => {
                if (field.classList.contains('error')) {
                    this.clearFieldError(formElement, fieldName);
                }
            });
        }
    }

    // Sanitizar datos del formulario
    sanitizeFormData(formData) {
        const sanitized = {};

        for (const [key, value] of formData.entries()) {
            if (window.inputSanitizer) {
                sanitized[key] = window.inputSanitizer.sanitizeText(value);
            } else {
                sanitized[key] = value;
            }
        }

        return sanitized;
    }
}

// Instancia global
window.formValidator = new FormValidator();

// Estilos para errores de validación (si no existen)
if (!document.querySelector('#form-validation-styles')) {
    const styles = document.createElement('style');
    styles.id = 'form-validation-styles';
    styles.textContent = `
        .field-error {
            display: block;
            color: #FF3B30;
            font-size: 0.85rem;
            margin-top: 4px;
            font-weight: 500;
        }
        
        input.error,
        select.error,
        textarea.error {
            border-color: #FF3B30 !important;
            background-color: rgba(255, 59, 48, 0.05) !important;
        }
    `;
    document.head.appendChild(styles);
}

console.log('✅ Sistema de validación de formularios activado');
