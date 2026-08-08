/**
 * @deprecated Venue and city search use OpenStreetMap (Photon + Nominatim) — no Maps JavaScript API.
 * This module remains so legacy imports resolve; it does not load Google scripts.
 */

const SCRIPT_ID = 'dinebuddies-google-maps-js';

export function isGoogleMapsKeyConfigured() {
    return false;
}

/** No-op: Google Maps / Places is no longer used for search. */
export function loadGoogleMapsScript() {
    if (typeof window === 'undefined') return Promise.resolve();
    const el = document.getElementById(SCRIPT_ID);
    if (el) {
        try {
            el.remove();
        } catch {
            /* ignore */
        }
    }
    return Promise.resolve();
}
