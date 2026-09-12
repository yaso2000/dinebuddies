const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const HIDDEN_CATEGORY_TYPES = new Set([
    'point_of_interest',
    'establishment',
    'food',
    'premise',
    'geocode',
    'political',
]);

function formatHourMinute(hour, minute) {
    const h = Number(hour);
    const m = Number(minute) || 0;
    if (!Number.isFinite(h)) return '09:00';
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatLegacyPlacesTime(t) {
    if (t == null) return '09:00';
    const s = String(t).replace(/\D/g, '').padStart(4, '0').slice(0, 4);
    return `${s.slice(0, 2)}:${s.slice(2, 4)}`;
}

/**
 * @param {{ day?: number, hour?: number, minute?: number, time?: string } | undefined} point
 */
function periodPointToTime(point) {
    if (!point || typeof point !== 'object') return null;
    if (typeof point.hour === 'number') {
        return formatHourMinute(point.hour, point.minute);
    }
    if (point.time != null) {
        return formatLegacyPlacesTime(point.time);
    }
    return null;
}

/**
 * Places API (New) `regularOpeningHours` → BusinessHours `hours` shape.
 * @param {unknown} regularOpeningHours
 */
export function regularOpeningHoursToBusinessHours(regularOpeningHours) {
    if (!regularOpeningHours || typeof regularOpeningHours !== 'object') return null;
    const periods = /** @type {{ periods?: unknown[] }} */ (regularOpeningHours).periods;
    if (!Array.isArray(periods) || periods.length === 0) return null;

    const out = {};
    DAY_KEYS.forEach((d) => {
        out[d] = { closed: true };
    });

    for (const raw of periods) {
        if (!raw || typeof raw !== 'object') continue;
        const p = /** @type {{ open?: { day?: number }, close?: { day?: number } }} */ (raw);
        if (!p.open || typeof p.open.day !== 'number') continue;
        const dayName = DAY_KEYS[p.open.day];
        if (!dayName) continue;
        const openT = periodPointToTime(p.open);
        if (!openT) continue;
        if (!p.close) {
            out[dayName] = { open: openT, close: '23:59', closed: false };
            continue;
        }
        const closeT = periodPointToTime(p.close);
        if (!closeT) {
            out[dayName] = { open: openT, close: '23:59', closed: false };
            continue;
        }
        out[dayName] = { open: openT, close: closeT, closed: false };
    }

    return out;
}

/**
 * @param {unknown} types
 */
export function normalizeGooglePlaceCategories(types) {
    if (!Array.isArray(types)) return [];
    return types
        .map((t) => String(t || '').trim())
        .filter((t) => t && !HIDDEN_CATEGORY_TYPES.has(t.toLowerCase()));
}

/**
 * Resolve a Google place to ONE of the five app categories, or null if none.
 * Fixed conflict priority (business spec): Night Club, Bar, Hotel, Cafe,
 * Restaurant — first match wins. bar → Bar · night_club → Night Club ·
 * lodging/hotel → Hotel · cafe/coffee_shop/bakery → Cafe · other food → Restaurant.
 * `bar` matches exact types only (never substring) so "barber_shop" is not a Bar.
 * @param {string[]|null|undefined} types
 * @returns {'Restaurant'|'Cafe'|'Bar'|'Night Club'|'Hotel'|null}
 */
export function resolveAllowedVenueCategory(types) {
    if (!Array.isArray(types) || types.length === 0) return null;
    const lower = types.map((x) => String(x).toLowerCase());
    const has = (t) => lower.includes(t);
    // Any *_restaurant type (fast_food_restaurant, hamburger_restaurant, …) — safe
    // substring: no non-food Google type contains "restaurant".
    const anyRestaurant = lower.some((x) => x.includes('restaurant'));

    if (has('night_club')) return 'Night Club';
    if (has('bar') || has('pub') || has('wine_bar') || has('cocktail_bar') || has('brewery')) return 'Bar';
    if (has('lodging') || has('hotel') || has('resort_hotel') || has('motel') || has('guest_house') || has('bed_and_breakfast')) {
        return 'Hotel';
    }
    if (has('cafe') || has('coffee_shop') || has('cafeteria') || has('bakery')) return 'Cafe';
    if (anyRestaurant || has('meal_takeaway') || has('meal_delivery') || has('fast_food') || has('food_truck')) {
        return 'Restaurant';
    }
    return null;
}

/**
 * Same five-category priority, but never null — unmatched/food places default to
 * Restaurant. Used by the importer to always land on one of the five types.
 * @param {string[]} types
 * @returns {'Restaurant'|'Cafe'|'Bar'|'Night Club'|'Hotel'}
 */
export function mapGoogleTypesToBusinessType(types) {
    return resolveAllowedVenueCategory(types) || 'Restaurant';
}
