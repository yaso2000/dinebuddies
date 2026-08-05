import { formatToE164, isValidE164 } from './phoneUtils';

export function looksLikeEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

/**
 * @param {string} identifier
 * @param {string} [defaultCountryCode] e.g. +20
 * @returns {string} E.164 or ''
 */
export function identifierToE164(identifier, defaultCountryCode = '+20') {
    const s = String(identifier || '').trim();
    if (!s || looksLikeEmail(s)) return '';
    if (s.startsWith('+')) {
        const digits = s.replace(/\D/g, '');
        return digits.length >= 8 ? `+${digits}` : '';
    }
    return formatToE164(defaultCountryCode, s);
}

/**
 * @param {string} identifier
 * @param {string} [defaultCountryCode]
 * @returns {{ type: 'empty' } | { type: 'email', email: string } | { type: 'phone', e164: string }}
 */
export function parseLoginIdentifier(identifier, defaultCountryCode = '+20') {
    const s = String(identifier || '').trim();
    if (!s) return { type: 'empty' };
    if (looksLikeEmail(s)) {
        return { type: 'email', email: s.toLowerCase() };
    }
    const e164 = identifierToE164(s, defaultCountryCode);
    if (!isValidE164(e164)) {
        return { type: 'empty' };
    }
    return { type: 'phone', e164 };
}
