
// Sistema de Sanitización de Inputs
class InputSanitizer {
    constructor() {
        this.patterns = {
            script: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
            html: /<\/?[^>]+(>|$)/g,
            sql: /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/gi
        };
    }

    // Sanitizar texto simple (nombres, descripciones)
    sanitizeText(input) {
        if (typeof input !== 'string') return input;
        
        return input
            .replace(this.patterns.script, '') // Remover scripts
            .replace(/[<>]/g, '') // Remover < y >
            .trim();
    }

    // Sanitizar email
    sanitizeEmail(email) {
        if (typeof email !== 'string') return '';
        
        return email
            .toLowerCase()
            .trim()
            .replace(/[^\w\s@.-]/g, '');
    }

    // Sanitizar números
    sanitizeNumber(input) {
        const num = parseFloat(input);
        return isNaN(num) ? 0 : num;
    }

    // Sanitizar objeto completo (recursivo)
    sanitizeObject(obj) {
        if (typeof obj !== 'object' || obj === null) {
            return obj;
        }

        const sanitized = {};

        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'string') {
                sanitized[key] = this.sanitizeText(value);
            } else if (typeof value === 'object') {
                sanitized[key] = this.sanitizeObject(value);
            } else {
                sanitized[key] = value;
            }
        }

        return sanitized;
    }

    // Sanitizar datos de formulario
    sanitizeFormData(formData) {
        const sanitized = {};

        for (const [key, value] of formData.entries()) {
            if (key.toLowerCase().includes('email')) {
                sanitized[key] = this.sanitizeEmail(value);
            } else if (key.toLowerCase().includes('password')) {
                // Las contraseñas NO se sanitizan (pueden tener caracteres especiales)
                sanitized[key] = value;
            } else if (!isNaN(value) && value !== '') {
                sanitized[key] = this.sanitizeNumber(value);
            } else {
                sanitized[key] = this.sanitizeText(value);
            }
        }

        return sanitized;
    }
}

// Instancia global
window.inputSanitizer = new InputSanitizer();

console.log('🛡️ Sistema de sanitización activado');
