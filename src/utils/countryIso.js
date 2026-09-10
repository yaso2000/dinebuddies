import { ISO2_COUNTRIES } from './iso2Countries';

// [isoCode, name] pairs. Uses a tiny static list (~5KB) instead of the 640KB
// country-state-city library so this hot-path util stays off the initial bundle.

/**
 * Normalize user/profile country fields to ISO 3166-1 alpha-2 (e.g. "AU").
 * Accepts "AU", "au", "Australia", etc. Returns "" if unknown.
 */
export function resolveCountryIso2(codeOrName) {
    if (codeOrName == null || codeOrName === '') return '';
    const s = String(codeOrName).trim();
    if (/^[a-zA-Z]{2}$/.test(s)) return s.toUpperCase();
    const lower = s.toLowerCase();
    const byIso = ISO2_COUNTRIES.find(([iso]) => iso.toLowerCase() === lower);
    if (byIso) return byIso[0];
    const byName = ISO2_COUNTRIES.find(([, name]) => name.toLowerCase() === lower);
    return byName ? byName[0] : '';
}

/**
 * ISO2 for venue search: form fields first, then signed-in profile (covers empty form.country when IP/profile only set city).
 */
export function resolveVenueCountryIso(formData = {}, userProfile = null) {
    return resolveCountryIso2(
        formData.countryCode ||
            formData.country ||
            userProfile?.countryCode ||
            userProfile?.country
    );
}
