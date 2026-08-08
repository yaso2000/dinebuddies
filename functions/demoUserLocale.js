/**
 * Country → primary language for demo user AI text generation.
 * Falls back to Gemini inference when code is unknown.
 */
const COUNTRY_CODE_LANGUAGE = {
    AE: 'Arabic',
    SA: 'Arabic',
    QA: 'Arabic',
    KW: 'Arabic',
    BH: 'Arabic',
    OM: 'Arabic',
    EG: 'Arabic',
    JO: 'Arabic',
    LB: 'Arabic',
    IQ: 'Arabic',
    MA: 'Arabic',
    DZ: 'Arabic',
    TN: 'Arabic',
    IT: 'Italian',
    FR: 'French',
    ES: 'Spanish',
    PT: 'Portuguese',
    DE: 'German',
    AT: 'German',
    CH: 'German',
    NL: 'Dutch',
    BE: 'Dutch',
    SE: 'Swedish',
    NO: 'Norwegian',
    DK: 'Danish',
    FI: 'Finnish',
    PL: 'Polish',
    TR: 'Turkish',
    GR: 'Greek',
    RU: 'Russian',
    UA: 'Ukrainian',
    JP: 'Japanese',
    KR: 'Korean',
    CN: 'Chinese',
    TW: 'Chinese',
    HK: 'Chinese',
    IN: 'Hindi',
    PK: 'Urdu',
    BD: 'Bengali',
    IR: 'Persian',
    IL: 'Hebrew',
    TH: 'Thai',
    VN: 'Vietnamese',
    ID: 'Indonesian',
    MY: 'Malay',
    PH: 'Filipino',
    BR: 'Portuguese',
    MX: 'Spanish',
    AR: 'Spanish',
    CL: 'Spanish',
    CO: 'Spanish',
    AU: 'English',
    NZ: 'English',
    US: 'English',
    GB: 'English',
    IE: 'English',
    CA: 'English',
    ZA: 'English',
    NG: 'English',
    KE: 'English',
    SG: 'English',
};

/**
 * @param {string} countryName
 * @param {string} [countryCode]
 * @returns {string}
 */
function resolvePrimaryLanguage(countryName, countryCode) {
    const cc = String(countryCode || '').trim().toUpperCase().slice(0, 2);
    if (cc && COUNTRY_CODE_LANGUAGE[cc]) {
        return COUNTRY_CODE_LANGUAGE[cc];
    }
    const name = String(countryName || '').trim();
    if (name) {
        return `the primary official language of ${name}`;
    }
    return 'the local official language of the selected country';
}

module.exports = {
    resolvePrimaryLanguage,
    COUNTRY_CODE_LANGUAGE,
};
