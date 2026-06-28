/** Convert Google Places `opening_hours.periods` to BusinessHours `hours` shape (sunday..saturday). */
const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const HIDDEN_CATEGORY_TYPES = new Set([
    'point_of_interest',
    'establishment',
    'food',
    'premise',
    'geocode',
    'political',
]);

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

/**
 * Human-readable category badges from Google Places `types`.
 * @param {string[]|undefined} types
 */
export function googlePlaceTypesToCategoryBadges(types) {
    if (!Array.isArray(types)) return [];
    return types
        .map((t) => String(t || '').trim())
        .filter((t) => t && !HIDDEN_CATEGORY_TYPES.has(t.toLowerCase()))
        .map((t) => t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()))
        .slice(0, 8);
}

/**
 * @param {Record<string, { closed?: boolean, open?: string, close?: string }>|null|undefined} hours
 */
export function computeOpenNowFromBusinessHours(hours) {
    if (!hours || typeof hours !== 'object') return null;
    const now = new Date();
    const dayName = DAY_KEYS[now.getDay()];
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const today = hours[dayName];
    if (!today || today.closed) return false;
    if (!today.open || !today.close) return null;
    if (today.close <= today.open) {
        return currentTime >= today.open || currentTime < today.close;
    }
    return currentTime >= today.open && currentTime < today.close;
}

/**
 * Legacy `workingHours` shape uses `isOpen` per day instead of `closed`.
 * @param {Record<string, { isOpen?: boolean, open?: string, close?: string }>|null|undefined} workingHours
 */
export function computeOpenNowFromLegacyWorkingHours(workingHours) {
    if (!workingHours || typeof workingHours !== 'object') return null;
    const now = new Date();
    const dayName = DAY_KEYS[now.getDay()];
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const today = workingHours[dayName];
    if (!today || today.isOpen === false) return false;
    if (!today.open || !today.close) return null;
    if (today.close <= today.open) {
        return currentTime >= today.open || currentTime < today.close;
    }
    return currentTime >= today.open && currentTime < today.close;
}

/**
 * Resolve live open/closed state. Prefer stored hours over stale Google `openNow`.
 * @param {{
 *   hours?: Record<string, { closed?: boolean, open?: string, close?: string }>|null,
 *   openingHours?: { periods?: unknown[] }|null,
 *   workingHours?: Record<string, { isOpen?: boolean, open?: string, close?: string }>|null,
 *   openNow?: boolean|null,
 * }} sources
 * @returns {boolean|null}
 */
export function resolveBusinessOpenNow({
    hours,
    openingHours,
    workingHours,
    openNow,
} = {}) {
    const fromHours = computeOpenNowFromBusinessHours(hours);
    if (typeof fromHours === 'boolean') return fromHours;

    const fromOpeningHours = computeOpenNowFromBusinessHours(
        openingHoursToBusinessHours(
            openingHours && typeof openingHours === 'object' ? openingHours : null
        )
    );
    if (typeof fromOpeningHours === 'boolean') return fromOpeningHours;

    const fromLegacy = computeOpenNowFromLegacyWorkingHours(workingHours);
    if (typeof fromLegacy === 'boolean') return fromLegacy;

    return typeof openNow === 'boolean' ? openNow : null;
}
