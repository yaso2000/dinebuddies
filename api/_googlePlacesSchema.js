/**
 * Canonical Google Places (New) → Firestore restaurant field mapping.
 * Google uses websiteUri, location.latitude/longitude — we persist website + coordinates.lat/lng.
 */

/** Single Place Details request — business fields + photo metadata. */
export const GOOGLE_PLACE_IMPORT_FIELD_MASK = [
    'displayName',
    'internationalPhoneNumber',
    'websiteUri',
    'formattedAddress',
    'addressComponents',
    'location',
    'regularOpeningHours',
    'types',
    'photos',
    'photos.name',
].join(',');

/** @deprecated use GOOGLE_PLACE_IMPORT_FIELD_MASK */
export const GOOGLE_PLACE_BUSINESS_FIELD_MASK = [
    'displayName',
    'internationalPhoneNumber',
    'websiteUri',
    'formattedAddress',
    'location',
    'regularOpeningHours',
    'types',
].join(',');

/** @deprecated merged into GOOGLE_PLACE_IMPORT_FIELD_MASK */
export const GOOGLE_PLACE_PHOTO_FIELD_MASK = 'photos,photos.name';

/**
 * @param {unknown} field
 */
export function textFromGooglePlaceField(field) {
    if (!field) return '';
    if (typeof field === 'string') return field.trim();
    if (typeof field === 'object' && field !== null && 'text' in field) {
        return String(/** @type {{ text?: string }} */ (field).text || '').trim();
    }
    return '';
}

/**
 * Google `location` → `{ lat, lng }`.
 * @param {unknown} location
 */
export function googleLocationToCoordinates(location) {
    if (!location || typeof location !== 'object') return { lat: null, lng: null };
    const lat = Number(/** @type {{ latitude?: number }} */ (location).latitude);
    const lng = Number(/** @type {{ longitude?: number }} */ (location).longitude);
    return {
        lat: Number.isFinite(lat) ? lat : null,
        lng: Number.isFinite(lng) ? lng : null,
    };
}

/**
 * @param {string} address
 */
export function parseCityCountryFromGoogleAddress(address) {
    const raw = String(address || '').trim();
    if (!raw) return { city: '', country: '' };

    // Google separates address segments with commas for most regions, but
    // uses " - " for some Gulf-region addresses (UAE, etc.) — sometimes even
    // mixed within the same address, e.g. "The Fountains, Yas Mall - جزيرة
    // ياس - أبو ظبي - الإمارات العربية المتحدة" — and Arabic-language
    // results (languageCode: 'ar') use the Arabic comma (،, U+060C) instead
    // of the ASCII comma, e.g. "طريق الأمير محمد بن عبدالعزيز، العليا،
    // الرياض 12331، السعودية". Splitting on any of these delimiters
    // uniformly means the last two segments are always city/country
    // regardless of which one a given address happens to use.
    const parts = raw.split(/,|،| - /).map((s) => s.trim()).filter(Boolean);
    if (parts.length < 2) return { city: '', country: '' };

    const country = parts[parts.length - 1] || '';
    const cityPart = parts[parts.length - 2] || '';
    const city = cityPart
        .replace(/\s+(QLD|NSW|VIC|SA|WA|TAS|NT|ACT)\s*\d*$/i, '')
        .replace(/\s+\d{4,6}$/, '') // trailing postal code, e.g. "الرياض 12331"
        .trim() || cityPart;
    return { city, country };
}

/**
 * Structured city / country / ISO code from Places (New) `addressComponents`.
 * Preferred over parsing `formattedAddress`, which is fragile for Arabic-language
 * results (governorate often lands in the "city" slot) and never yields an ISO code.
 * @param {unknown} components
 * @returns {{ city: string, country: string, countryCode: string }}
 */
export function parseGoogleAddressComponents(components) {
    let city = '';
    let fallbackCity = '';
    let country = '';
    let countryCode = '';
    if (Array.isArray(components)) {
        for (const c of components) {
            const types = Array.isArray(c?.types) ? c.types : [];
            const text = String(c?.longText || c?.shortText || '').trim();
            if (!text) continue;
            if (types.includes('locality')) city = city || text;
            else if (types.includes('postal_town')) fallbackCity = fallbackCity || text;
            else if (types.includes('administrative_area_level_2')) fallbackCity = fallbackCity || text;
            else if (types.includes('sublocality_level_1') || types.includes('sublocality')) fallbackCity = fallbackCity || text;
            if (types.includes('country')) {
                country = text;
                countryCode = String(c?.shortText || '').trim().toUpperCase().slice(0, 2);
            }
        }
    }
    return { city: city || fallbackCity, country, countryCode: /^[A-Z]{2}$/.test(countryCode) ? countryCode : '' };
}

/**
 * Map raw Places API (New) place resource → normalized ingest details (no photo upload).
 * @param {string} placeId
 * @param {Record<string, unknown>} data
 * @param {{ hours?: Record<string, unknown> | null; categories?: string[]; businessType?: string }} derived
 */
export function mapGooglePlaceResourceToDetails(placeId, data, derived = {}) {
    const id = String(placeId || '').trim();
    const address = String(data.formattedAddress ?? '').trim();
    const { lat, lng } = googleLocationToCoordinates(data.location);
    const openingHours = data.regularOpeningHours || null;
    const openNow =
        openingHours && typeof openingHours === 'object' && 'openNow' in openingHours
            ? openingHours.openNow === true
            : null;

    const fromComponents = parseGoogleAddressComponents(data.addressComponents);
    const fromAddress = parseCityCountryFromGoogleAddress(address);

    return {
        googlePlaceId: id,
        name: textFromGooglePlaceField(data.displayName) || id,
        phone: String(data.internationalPhoneNumber ?? '').trim(),
        website: String(data.websiteUri ?? '').trim(),
        address,
        city: fromComponents.city || fromAddress.city,
        country: fromComponents.country || fromAddress.country,
        countryCode: fromComponents.countryCode || '',
        coordinates: { lat, lng },
        openingHours,
        hours: derived.hours ?? null,
        openNow,
        categories: derived.categories ?? [],
        businessType: derived.businessType ?? 'Restaurant',
    };
}

/**
 * Firestore restaurant top-level + businessInfo keys written by virtual ingest.
 * @typedef {{
 *   name: string;
 *   phone: string;
 *   website: string;
 *   address: string;
 *   coordinates: { lat: number | null; lng: number | null };
 *   openingHours: unknown;
 *   categories: string[];
 * }} RestaurantGoogleFieldSchema
 */

export const RESTAURANT_GOOGLE_FIELD_KEYS = [
    'name',
    'phone',
    'website',
    'address',
    'coordinates',
    'openingHours',
    'categories',
];
