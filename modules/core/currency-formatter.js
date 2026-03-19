
// Sistema de Formateo de Moneda - Centralizado y Configurable
class CurrencyFormatter {
    constructor() {
        // Configuración por defecto (Peso Colombiano)
        this.config = {
            currency: 'COP',
            symbol: '$',
            symbolPosition: 'before', // 'before' o 'after'
            thousandsSeparator: '.',
            decimalSeparator: ',',
            decimals: 2,
            locale: 'es-CO'
        };

        // Configuraciones predefinidas para diferentes monedas
        this.presets = {
            COP: {
                currency: 'COP',
                symbol: '$',
                symbolPosition: 'before',
                thousandsSeparator: '.',
                decimalSeparator: ',',
                decimals: 2,
                locale: 'es-CO'
            },
            USD: {
                currency: 'USD',
                symbol: '$',
                symbolPosition: 'before',
                thousandsSeparator: ',',
                decimalSeparator: '.',
                decimals: 2,
                locale: 'en-US'
            },
            EUR: {
                currency: 'EUR',
                symbol: '€',
                symbolPosition: 'after',
                thousandsSeparator: '.',
                decimalSeparator: ',',
                decimals: 2,
                locale: 'es-ES'
            }
        };

        console.log('✅ Sistema de formateo de moneda inicializado');
    }

    /**
     * Formatea un número como moneda
     * @param {number} amount - Cantidad a formatear
     * @param {object} options - Opciones de formateo (opcional)
     * @returns {string} Cantidad formateada
     */
    format(amount, options = {}) {
        // Validar entrada
        const num = parseFloat(amount);
        if (isNaN(num)) {
            console.warn('Valor inválido para formatear:', amount);
            return this.config.symbol + ' 0' + this.config.decimalSeparator + '00';
        }

        // Usar configuración actual o sobrescribir con opciones
        const config = { ...this.config, ...options };

        // Formatear número con separadores
        const parts = Math.abs(num).toFixed(config.decimals).split('.');
        const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, config.thousandsSeparator);
        const decimalPart = parts[1];

        // Construir string formateado
        let formatted = integerPart + config.decimalSeparator + decimalPart;

        // Agregar símbolo de moneda
        if (config.symbolPosition === 'before') {
            formatted = config.symbol + ' ' + formatted;
        } else {
            formatted = formatted + ' ' + config.symbol;
        }

        // Agregar signo negativo si es necesario
        if (num < 0) {
            formatted = '-' + formatted;
        }

        return formatted;
    }

    /**
     * Formatea solo la parte numérica (sin símbolo)
     * @param {number} amount - Cantidad a formatear
     * @returns {string} Número formateado
     */
    formatNumber(amount) {
        const num = parseFloat(amount);
        if (isNaN(num)) return '0' + this.config.decimalSeparator + '00';

        const parts = Math.abs(num).toFixed(this.config.decimals).split('.');
        const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, this.config.thousandsSeparator);
        const decimalPart = parts[1];

        return integerPart + this.config.decimalSeparator + decimalPart;
    }

    /**
     * Convierte un string formateado a número
     * @param {string} formattedAmount - String formateado
     * @returns {number} Número decimal
     */
    parse(formattedAmount) {
        if (typeof formattedAmount !== 'string') return parseFloat(formattedAmount) || 0;

        // Remover símbolo de moneda y espacios
        let cleaned = formattedAmount.replace(this.config.symbol, '').trim();

        // Reemplazar separadores
        cleaned = cleaned
            .replace(new RegExp('\\' + this.config.thousandsSeparator, 'g'), '')
            .replace(this.config.decimalSeparator, '.');

        return parseFloat(cleaned) || 0;
    }

    /**
     * Cambia la configuración de moneda
     * @param {string} currencyCode - Código de moneda (COP, USD, EUR)
     */
    setCurrency(currencyCode) {
        if (this.presets[currencyCode]) {
            this.config = { ...this.presets[currencyCode] };
            console.log(`💱 Moneda cambiada a: ${currencyCode}`);
            
            // Emitir evento de cambio de moneda
            if (window.eventBus) {
                window.eventBus.emit('CURRENCY_CHANGED', { currency: currencyCode });
            }
        } else {
            console.warn(`Moneda ${currencyCode} no encontrada`);
        }
    }

    /**
     * Obtiene la configuración actual
     * @returns {object} Configuración actual
     */
    getConfig() {
        return { ...this.config };
    }

    /**
     * Establece configuración personalizada
     * @param {object} customConfig - Configuración personalizada
     */
    setCustomConfig(customConfig) {
        this.config = { ...this.config, ...customConfig };
        console.log('⚙️ Configuración de moneda actualizada');
    }

    /**
     * Obtiene el símbolo de la moneda actual
     * @returns {string} Símbolo de moneda
     */
    getSymbol() {
        return this.config.symbol;
    }
}

// Crear instancia global
window.currencyFormatter = new CurrencyFormatter();

console.log('💰 Currency Formatter cargado y disponible globalmente');
