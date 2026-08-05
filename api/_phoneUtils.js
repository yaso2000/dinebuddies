/**
 * Server-side E.164 helpers — keep in sync with src/utils/phoneUtils.js
 */
/**
 * تحويل رقم الهاتف إلى الصيغة الدولية الموحدة E.164
 * @param {string} countryCode - رمز الدولة (مثال: +20 أو +966)
 * @param {string} rawPhone - الرقم المدخل من المستخدم
 * @returns {string} الرقم الموحد جاهزاً للتخزين والـ API
 */
export function formatToE164(countryCode, rawPhone) {
    if (!rawPhone || !countryCode) return '';

    let cleaned = String(rawPhone).replace(/\D/g, '');

    if (cleaned.startsWith('0')) {
        cleaned = cleaned.substring(1);
    }

    const cleanCountry = String(countryCode).replace(/\D/g, '');
    if (!cleanCountry || !cleaned) return '';

    return `+${cleanCountry}${cleaned}`;
}

export function isValidE164(e164) {
    return /^\+[1-9]\d{7,14}$/.test(String(e164 || '').trim());
}

/**
 * Google `internationalPhoneNumber` → compact E.164 when already global (+1, +44, +61, …).
 * Does not infer or override country codes.
 * @param {string} raw
 * @returns {string} compact E.164 or '' if not parseable
 */
export function compactE164FromGoogleInternational(raw) {
    const trimmed = String(raw || '').trim();
    if (!trimmed) return '';
    const compact = trimmed.replace(/[\s\-().]/g, '');
    return isValidE164(compact) ? compact : '';
}

export function e164ToDocKey(e164) {
    return String(e164 || '').replace(/\D/g, '');
}
