/**
 * Ensures that all native JS date/time and number formatters use Western Arabic numerals (1, 2, 3)
 * instead of Eastern Arabic numerals (١, ٢, ٣) when rendering in Arabic.
 * This ensures a unified numbering system across the entire application for all languages.
 */

const getResolvedLocales = (locales) => {
    // If no explicit locale is provided, retrieve the app's current language (fallback to 'en')
    const currentLang = window.localStorage.getItem('i18nextLng') || 'en';
    let resolvedLocales = locales !== undefined ? locales : currentLang;

    // Helper to process a single locale string
    const processLocale = (locale) => {
        if (typeof locale === 'string' && locale.startsWith('ar')) {
            // Check if explicitly requested without -u-nu-latn
            if (!locale.includes('-u-nu-latn')) {
                 return `${locale}-u-nu-latn`;
            }
        }
        return locale;
    };

    if (Array.isArray(resolvedLocales)) {
        return resolvedLocales.map(processLocale);
    }
    
    return processLocale(resolvedLocales);
};

// --- Override Date Methods ---

const originalToLocaleDateString = Date.prototype.toLocaleDateString;
Date.prototype.toLocaleDateString = function(locales, options) {
    return originalToLocaleDateString.call(this, getResolvedLocales(locales), options);
};

const originalToLocaleStringDate = Date.prototype.toLocaleString;
Date.prototype.toLocaleString = function(locales, options) {
    return originalToLocaleStringDate.call(this, getResolvedLocales(locales), options);
};

const originalToLocaleTimeString = Date.prototype.toLocaleTimeString;
Date.prototype.toLocaleTimeString = function(locales, options) {
    return originalToLocaleTimeString.call(this, getResolvedLocales(locales), options);
};

// --- Override Number Methods ---

const originalToLocaleStringNum = Number.prototype.toLocaleString;
Number.prototype.toLocaleString = function(locales, options) {
    return originalToLocaleStringNum.call(this, getResolvedLocales(locales), options);
};
