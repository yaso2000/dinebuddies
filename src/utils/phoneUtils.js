/**
 * تنظيف وتوحيد أرقام الهاتف بصيغة E.164 (+CountryCodeLocalNumber).
 * يُستخدم في الواجهة ويجب مزامنته مع api/_phoneUtils.js
 */

/**
 * تحويل رقم الهاتف إلى الصيغة الدولية الموحدة E.164
 * @param {string} countryCode - رمز الدولة (مثال: +20 أو +966 أو 20)
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

/** @param {string} e164 */
export function isValidE164(e164) {
    return /^\+[1-9]\d{7,14}$/.test(String(e164 || '').trim());
}

/** @param {string} iso2 */
/** عدد الأرقام فقط بعد إزالة الرموز */
export function cleanedPhoneLength(str) {
    return String(str || '').replace(/\D/g, '').length;
}

/** تحويل رمز اتصال (20 أو +20) إلى صيغة القائمة +20 */
export function toCountryCodeSelectValue(dialOrPlus) {
    const digits = String(dialOrPlus || '20').replace(/\D/g, '');
    return digits ? `+${digits}` : '+20';
}

export function defaultDialCodeForCountryIso(iso2) {
    const cc = String(iso2 || '').trim().toUpperCase().slice(0, 2);
    const map = {
        EG: '20',
        SA: '966',
        AE: '971',
        KW: '965',
        QA: '974',
        BH: '973',
        OM: '968',
        JO: '962',
        LB: '961',
        IQ: '964',
        MA: '212',
        DZ: '213',
        TN: '216',
        AU: '61',
        US: '1',
        GB: '44',
    };
    return map[cc] || '20';
}
