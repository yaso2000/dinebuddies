/**
 * Currency Mapping and Conversion Utility
 * Maps country codes/names to currencies and provides exchange rates relative to USD.
 */

// Mapping of country names (from Nominatim/IP) or country codes to Currency Info
export const COUNTRY_CURRENCY_MAP = {
    'Saudi Arabia': { code: 'SAR', symbol: 'ر.س', rate: 3.75 },
    'United Arab Emirates': { code: 'AED', symbol: 'د.إ', rate: 3.67 },
    'Egypt': { code: 'EGP', symbol: 'ج.م', rate: 48.00 }, // Approximate market rate
    'Kuwait': { code: 'KWD', symbol: 'د.ك', rate: 0.31 },
    'Qatar': { code: 'QAR', symbol: 'ر.ق', rate: 3.64 },
    'Bahrain': { code: 'BHD', symbol: 'د.ب', rate: 0.38 },
    'Oman': { code: 'OMR', symbol: 'ر.ع', rate: 0.38 },
    'Jordan': { code: 'JOD', symbol: 'د.أ', rate: 0.71 },
    'United Kingdom': { code: 'GBP', symbol: '£', rate: 0.79 },
    'European Union': { code: 'EUR', symbol: '€', rate: 0.92 },
    'Germany': { code: 'EUR', symbol: '€', rate: 0.92 },
    'France': { code: 'EUR', symbol: '€', rate: 0.92 },
    'Italy': { code: 'EUR', symbol: '€', rate: 0.92 },
    'Spain': { code: 'EUR', symbol: '€', rate: 0.92 },
    'Australia': { code: 'AUD', symbol: 'A$', rate: 1.53 },
    'Canada': { code: 'CAD', symbol: 'C$', rate: 1.35 },
    'United States': { code: 'USD', symbol: '$', rate: 1.0 },
};

// Fallback for European countries not explicitly listed
const EURO_ZONE = ['Austria', 'Belgium', 'Cyprus', 'Estonia', 'Finland', 'Greece', 'Ireland', 'Latvia', 'Lithuania', 'Luxembourg', 'Malta', 'Netherlands', 'Portugal', 'Slovakia', 'Slovenia'];

/**
 * Get currency info based on country name
 * @param {string} countryName 
 * @returns {object} { code, symbol, rate }
 */
export const getCurrencyByCountry = (countryName) => {
    if (!countryName) return { code: 'USD', symbol: '$', rate: 1.0 };

    if (COUNTRY_CURRENCY_MAP[countryName]) {
        return COUNTRY_CURRENCY_MAP[countryName];
    }

    if (EURO_ZONE.includes(countryName)) {
        return COUNTRY_CURRENCY_MAP['European Union'];
    }

    // Default to USD
    return { code: 'USD', symbol: '$', rate: 1.0 };
};

/**
 * Convert price from USD to local currency
 * @param {number} usdPrice 
 * @param {string} countryName 
 * @returns {object} { price, code, symbol }
 */
export const convertFromUSD = (usdPrice, countryName) => {
    const currency = getCurrencyByCountry(countryName);
    const convertedPrice = (usdPrice * currency.rate).toFixed(2);

    // For currencies like SAR/AED/EGP, we might want to round to whole numbers if it looks cleaner
    const finalPrice = ['SAR', 'AED', 'EGP', 'QAR'].includes(currency.code)
        ? Math.round(usdPrice * currency.rate)
        : parseFloat(convertedPrice);

    return {
        price: finalPrice,
        code: currency.code,
        symbol: currency.symbol
    };
};

/**
 * Format currency for display
 * @param {number} price 
 * @param {string} symbol 
 * @param {string} code 
 * @param {string} locale 
 * @returns {string}
 */
export const formatCurrency = (price, symbol, code, locale = 'en') => {
    if (locale === 'ar') {
        return `${price} ${symbol}`;
    }
    return `${symbol}${price}`;
};
