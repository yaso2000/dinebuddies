/**
 * Same-origin URLs for Google Place photos.
 * Avoids Maps JS PhotoService.GetPhoto (403 when API key HTTP referrers exclude localhost).
 * Also avoid requesting the `photos` field in PlacesService.getDetails — that still triggers PhotoService.
 */
export function placePhotoProxyUrls(placeId, photoCount) {
    if (!placeId || !photoCount) return [];
    const n = Math.min(Math.max(0, photoCount), 10);
    const base = import.meta.env.DEV ? '/__dev/place-photo' : '/api/place-photo';
    return Array.from({ length: n }, (_, i) => `${base}?placeId=${encodeURIComponent(placeId)}&index=${i}`);
}
