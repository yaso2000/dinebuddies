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

/** Compact E.164 for tel: links (digits only with leading +). */
export function phoneToTelHref(phone) {
    const compact = String(phone || '')
        .trim()
        .replace(/[\s\-().]/g, '');
    if (!compact) return '';
    return compact.startsWith('+') ? compact : `+${compact.replace(/\D/g, '')}`;
}

/**
 * Normalize display spacing while preserving international digit order.
 * @param {string} phone
 */
export function formatPhoneForDisplay(phone) {
    const raw = String(phone || '').trim();
    if (!raw) return '';

    if (/[\s\-()]/.test(raw)) {
        return raw.replace(/\s+/g, ' ').trim();
    }

    const compact = raw.replace(/[\s\-().]/g, '');
    const m = /^(\+\d{1,3})(\d+)$/.exec(compact);
    if (!m) return raw;

    const cc = m[1];
    const rest = m[2];
    if (cc === '+971' && rest.length >= 8) {
        return `${cc} ${rest[0]} ${rest.slice(1, 4)} ${rest.slice(4)}`.trim();
    }
    if (cc === '+966' && rest.length >= 9) {
        return `${cc} ${rest.slice(0, 2)} ${rest.slice(2, 5)} ${rest.slice(5)}`.trim();
    }
    if (cc === '+20' && rest.length >= 10) {
        return `${cc} ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6)}`.trim();
    }

    const groups = rest.match(/.{1,3}/g) || [rest];
    return `${cc} ${groups.join(' ')}`.trim();
}

/** Inline style — keeps phone LTR in Arabic/RTL layouts. */
export function phoneNumberLtrStyle() {
    return {
        direction: 'ltr',
        unicodeBidi: 'isolate',
        textAlign: 'left',
    };
}
