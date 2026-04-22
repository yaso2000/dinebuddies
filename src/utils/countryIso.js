import { Country } from 'country-state-city';

/**
 * Normalize user/profile country fields to ISO 3166-1 alpha-2 (e.g. "AU").
 * Accepts "AU", "au", "Australia", etc. Returns "" if unknown.
 */
export function resolveCountryIso2(codeOrName) {
    if (codeOrName == null || codeOrName === '') return '';
    const s = String(codeOrName).trim();
    if (/^[a-zA-Z]{2}$/.test(s)) return s.toUpperCase();
    const lower = s.toLowerCase();
    const all = Country.getAllCountries();
    const byIso = all.find((c) => c.isoCode.toLowerCase() === lower);
    if (byIso) return byIso.isoCode;
    const byName = all.find((c) => c.name.toLowerCase() === lower);
    return byName ? byName.isoCode : '';
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
