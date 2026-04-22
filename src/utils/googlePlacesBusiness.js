/** Convert Google Places `opening_hours.periods` to BusinessHours `hours` shape (sunday..saturday). */
const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function formatPlacesTime(t) {
    if (t == null) return '09:00';
    const s = String(t).replace(/\D/g, '').padStart(4, '0').slice(0, 4);
    return `${s.slice(0, 2)}:${s.slice(2, 4)}`;
}

/** @param {Array<{ open?: { day: number, time: string }, close?: { day: number, time: string } }>|undefined} periods */
export function placesOpeningPeriodsToBusinessHours(periods) {
    if (!Array.isArray(periods) || periods.length === 0) return null;
    const out = {};
    DAY_KEYS.forEach((d) => {
        out[d] = { closed: true };
    });
    for (const p of periods) {
        if (!p?.open) continue;
        const dayName = DAY_KEYS[p.open.day];
        if (!dayName) continue;
        const openT = formatPlacesTime(p.open.time);
        if (!p.close) {
            out[dayName] = { open: openT, close: '23:59', closed: false };
            continue;
        }
        const closeT = formatPlacesTime(p.close.time);
        if (p.open.day === p.close.day) {
            out[dayName] = { open: openT, close: closeT, closed: false };
        } else {
            out[dayName] = { open: openT, close: '23:59', closed: false };
        }
    }
    return out;
}

/** @param {{ periods?: unknown[] }|undefined|null} oh */
export function openingHoursToBusinessHours(oh) {
    if (!oh?.periods) return null;
    return placesOpeningPeriodsToBusinessHours(oh.periods);
}

/**
 * @param {Array<{ long_name?: string, short_name?: string, types?: string[] }>|undefined} components
 * @returns {{ city: string, country: string, countryCode: string }}
 */
export function parseGoogleAddressComponents(components) {
    if (!Array.isArray(components)) return { city: '', country: '', countryCode: '' };
    let city = '';
    let country = '';
    let countryCode = '';
    for (const c of components) {
        const longName = c.long_name || c.longText || '';
        const shortName = c.short_name || c.shortText || '';
        const t = c.types || [];
        if (t.includes('locality')) city = longName || city;
        else if (!city && t.includes('postal_town')) city = longName || '';
        else if (!city && t.includes('administrative_area_level_2')) city = longName || '';
        else if (!city && (t.includes('sublocality') || t.includes('sublocality_level_1'))) city = longName || '';
        if (t.includes('country')) {
            country = longName || '';
            countryCode = String(shortName || '').toUpperCase();
        }
    }
    if (!city) {
        for (const c of components) {
            const longName = c.long_name || c.longText || '';
            const t = c.types || [];
            if (t.includes('administrative_area_level_1')) {
                city = longName || '';
                break;
            }
        }
    }
    return { city, country, countryCode };
}

/**
 * Map Google Places `types` to onboarding business type labels.
 * @param {string[]|undefined} types
 * @returns {string|null}
 */
export function mapGoogleTypesToBusinessType(types) {
    if (!Array.isArray(types) || types.length === 0) return null;
    const lower = new Set(types.map((x) => String(x).toLowerCase()));
    if (lower.has('night_club')) return 'Night Club';
    if (lower.has('bar')) return 'Bar';
    if (lower.has('cafe') || lower.has('bakery')) return 'Cafe';
    if (lower.has('restaurant') || lower.has('meal_takeaway') || lower.has('meal_delivery')) return 'Restaurant';
    if (lower.has('liquor_store')) return 'Bar';
    return null;
}
