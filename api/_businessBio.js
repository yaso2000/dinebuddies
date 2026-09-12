/**
 * Build a business "about" (bio) from Google details.
 *  - If Google has an editorial summary, use it verbatim → bioSource: 'google'.
 *  - Otherwise generate a short Arabic bio from the available facts (type, city,
 *    price level, rating, service flags) → bioSource: 'generated', so the owner
 *    knows it is a suggestion they can replace.
 * Never invents facts; omits anything missing.
 */

const TYPE_AR = {
    Restaurant: 'مطعم',
    Cafe: 'مقهى',
    Bar: 'بار',
    'Night Club': 'نادٍ ليلي',
    Hotel: 'فندق',
};

const PRICE_AR = {
    PRICE_LEVEL_FREE: 'مجاني',
    PRICE_LEVEL_INEXPENSIVE: 'أسعار اقتصادية',
    PRICE_LEVEL_MODERATE: 'أسعار متوسطة',
    PRICE_LEVEL_EXPENSIVE: 'أسعار مرتفعة',
    PRICE_LEVEL_VERY_EXPENSIVE: 'أسعار فاخرة',
};

/** Arabic-Indic digits so generated text reads naturally in Arabic. */
function toArabicDigits(value) {
    return String(value).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
}

/**
 * @param {{
 *   editorialSummary?: string, businessType?: string, city?: string,
 *   priceLevel?: string, rating?: number|null, userRatingCount?: number|null,
 *   serviceFlags?: { delivery?: boolean, takeout?: boolean, dineIn?: boolean }
 * }} details
 * @returns {{ description: string, bioSource: 'google'|'generated'|'' }}
 */
export function buildBusinessBio(details = {}) {
    const editorial = String(details.editorialSummary || '').trim();
    if (editorial) return { description: editorial, bioSource: 'google' };

    const typeAr = TYPE_AR[String(details.businessType || '').trim()] || 'مكان';
    const city = String(details.city || '').trim();
    const parts = [];

    parts.push(city ? `${typeAr} في ${city}` : typeAr);

    const price = PRICE_AR[String(details.priceLevel || '').trim()];
    if (price) parts.push(price);

    const rating = Number(details.rating);
    if (Number.isFinite(rating) && rating > 0) {
        const count = Number(details.userRatingCount);
        const countPart =
            Number.isFinite(count) && count > 0 ? ` (${toArabicDigits(count)} تقييمًا)` : '';
        parts.push(`تقييم ${toArabicDigits(rating.toFixed(1))} من ٥${countPart}`);
    }

    const flags = details.serviceFlags || {};
    const services = [];
    if (flags.dineIn) services.push('الجلوس في المكان');
    if (flags.delivery) services.push('التوصيل');
    if (flags.takeout) services.push('الاستلام');
    if (services.length) parts.push(`يوفّر ${services.join(' و')}`);

    // "مطعم في الرياض · أسعار متوسطة · تقييم ٤٫٥ من ٥ (١٢٠ تقييمًا) · يوفّر ..."
    return { description: parts.join(' · '), bioSource: 'generated' };
}

export default buildBusinessBio;
