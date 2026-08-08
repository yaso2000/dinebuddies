/** قيمة القائمة بصيغة +20 لتتوافق مع formatToE164 */
export const PHONE_COUNTRY_OPTIONS = [
    { iso: 'EG', labelKey: 'phone_country_eg', labelFallback: 'Egypt', dial: '20', flag: '🇪🇬' },
    { iso: 'SA', labelKey: 'phone_country_sa', labelFallback: 'Saudi Arabia', dial: '966', flag: '🇸🇦' },
    { iso: 'AE', labelKey: 'phone_country_ae', labelFallback: 'United Arab Emirates', dial: '971', flag: '🇦🇪' },
    { iso: 'KW', labelKey: 'phone_country_kw', labelFallback: 'Kuwait', dial: '965', flag: '🇰🇼' },
    { iso: 'QA', labelKey: 'phone_country_qa', labelFallback: 'Qatar', dial: '974', flag: '🇶🇦' },
    { iso: 'BH', labelKey: 'phone_country_bh', labelFallback: 'Bahrain', dial: '973', flag: '🇧🇭' },
    { iso: 'OM', labelKey: 'phone_country_om', labelFallback: 'Oman', dial: '968', flag: '🇴🇲' },
    { iso: 'JO', labelKey: 'phone_country_jo', labelFallback: 'Jordan', dial: '962', flag: '🇯🇴' },
    { iso: 'LB', labelKey: 'phone_country_lb', labelFallback: 'Lebanon', dial: '961', flag: '🇱🇧' },
    { iso: 'AU', labelKey: 'phone_country_au', labelFallback: 'Australia', dial: '61', flag: '🇦🇺' },
    { iso: 'US', labelKey: 'phone_country_us', labelFallback: 'United States', dial: '1', flag: '🇺🇸' },
    { iso: 'GB', labelKey: 'phone_country_gb', labelFallback: 'United Kingdom', dial: '44', flag: '🇬🇧' },
];

export function findPhoneCountryByDial(dial) {
    const d = String(dial || '').replace(/\D/g, '');
    return PHONE_COUNTRY_OPTIONS.find((c) => c.dial === d) || PHONE_COUNTRY_OPTIONS[0];
}
