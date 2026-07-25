/**
 * Validate invitation venue coordinates.
 * Null/NaN/out-of-range values must never be persisted (and must never be
 * replaced with fabricated city defaults).
 *
 * @param {unknown} lat
 * @param {unknown} lng
 * @returns {{ lat: number, lng: number } | null}
 */
export function parseInvitationCoordinates(lat, lng) {
    // Reject null/undefined/empty before Number() — Number(null) === 0.
    if (lat == null || lng == null || lat === '' || lng === '') {
        return null;
    }

    const parsedLat = typeof lat === 'number' ? lat : Number(lat);
    const parsedLng = typeof lng === 'number' ? lng : Number(lng);

    if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
        return null;
    }
    if (parsedLat < -90 || parsedLat > 90 || parsedLng < -180 || parsedLng > 180) {
        return null;
    }

    return { lat: parsedLat, lng: parsedLng };
}
