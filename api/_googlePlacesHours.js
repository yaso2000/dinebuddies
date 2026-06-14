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
 * @param {string[]} types
 */
export function mapGoogleTypesToBusinessType(types) {
    if (!Array.isArray(types) || types.length === 0) return 'Restaurant';
    const lower = new Set(types.map((x) => String(x).toLowerCase()));
    if (lower.has('night_club')) return 'Night Club';
    if (lower.has('bar')) return 'Bar';
    if (lower.has('cafe') || lower.has('bakery')) return 'Cafe';
    if (lower.has('restaurant') || lower.has('meal_takeaway') || lower.has('meal_delivery')) return 'Restaurant';
    if (lower.has('fast_food')) return 'Fast Food';
    if (lower.has('food_truck')) return 'Food Truck';
    return 'Restaurant';
}
