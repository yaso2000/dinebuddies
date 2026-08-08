/**
 * Maps public-invitation venue type (UI) to Google Places `types` on predictions.
 * Used to rank autocomplete so e.g. Cafe invitations surface cafes first.
 */

const RELATED_TYPES = {
    Restaurant: ['restaurant', 'meal_takeaway', 'food'],
    Cafe: ['cafe', 'bakery', 'meal_takeaway'],
    Bar: ['bar', 'pub'],
    'Night Club': ['night_club', 'bar'],
    'Food Truck': ['restaurant', 'meal_takeaway', 'food', 'establishment'],
    'Fast Food': ['meal_takeaway', 'restaurant', 'food'],
};

export const INVITATION_PRIMARY_PLACE_TYPE = {
    Restaurant: 'restaurant',
    Cafe: 'cafe',
    Bar: 'bar',
    'Night Club': 'night_club',
    'Food Truck': 'restaurant',
    'Fast Food': 'meal_takeaway',
};

/** @param {string|undefined} invitationType @returns {string|null} */
export function getInvitationPrimaryPlaceType(invitationType) {
    if (!invitationType) return null;
    return INVITATION_PRIMARY_PLACE_TYPE[invitationType] || null;
}

/**
 * @param {string[]|undefined} types - from Places Autocomplete prediction.types
 * @param {string|undefined} invitationType - formData.type
 * @returns {number} higher = better match for this invitation category
 */
export function scoreGoogleTypesForInvitation(types, invitationType) {
    if (!invitationType || !Array.isArray(types)) return 0;
    const related = RELATED_TYPES[invitationType];
    if (!related?.length) return 0;
    const want = new Set(related);
    let score = 0;
    for (const t of types) {
        if (want.has(t)) score += 8;
    }
    const primary = INVITATION_PRIMARY_PLACE_TYPE[invitationType];
    if (primary && types.includes(primary)) score += 12;
    return score;
}

/**
 * Sort Places predictions: city in description first, then invitation-type relevance, then original order.
 * @param {object[]} predictions - raw Google Autocomplete predictions
 * @param {string|null|undefined} city
 * @param {string|undefined} invitationType
 */
export function sortAutocompletePredictionsForInvitation(predictions, city, invitationType) {
    if (!predictions?.length) return predictions;
    const cityLower = city ? String(city).toLowerCase() : '';
    const enriched = predictions.map((p, idx) => ({
        p,
        idx,
        cityMatch: cityLower ? String(p.description || '').toLowerCase().includes(cityLower) : false,
        typeScore: scoreGoogleTypesForInvitation(p.types, invitationType),
    }));
    enriched.sort((a, b) => {
        if (a.cityMatch !== b.cityMatch) return a.cityMatch ? -1 : 1;
        if (b.typeScore !== a.typeScore) return b.typeScore - a.typeScore;
        return a.idx - b.idx;
    });
    return enriched.map((x) => x.p);
}

/** Sort DineBuddies directory hits: nearest to user GPS, then city match, then business type. */
export function sortDineBuddiesVenues(results, city, invitationType, userLat, userLng) {
    if (!results?.length) return results;
    const cityLower = city ? String(city).toLowerCase() : '';
    const uLat = userLat != null ? Number(userLat) : NaN;
    const uLng = userLng != null ? Number(userLng) : NaN;
    const hasUser = Number.isFinite(uLat) && Number.isFinite(uLng);

    const distKm = (v) => {
        const lat = Number(v.lat);
        const lng = Number(v.lng);
        if (!hasUser || !Number.isFinite(lat) || !Number.isFinite(lng)) return Infinity;
        const R = 6371;
        const dLat = ((lat - uLat) * Math.PI) / 180;
        const dLon = ((lng - uLng) * Math.PI) / 180;
        const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos((uLat * Math.PI) / 180) * Math.cos((lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    return [...results].sort((a, b) => {
        if (hasUser) {
            const da = distKm(a);
            const db = distKm(b);
            if (da !== db) return da - db;
        }
        if (cityLower) {
            const ac = String(a.city || a.address || '').toLowerCase().includes(cityLower);
            const bc = String(b.city || b.address || '').toLowerCase().includes(cityLower);
            if (ac !== bc) return ac ? -1 : 1;
        }
        if (invitationType) {
            const ae = a.businessType === invitationType ? 1 : 0;
            const be = b.businessType === invitationType ? 1 : 0;
            if (ae !== be) return be - ae;
        }
        return 0;
    });
}
