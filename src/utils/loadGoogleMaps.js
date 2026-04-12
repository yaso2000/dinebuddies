/**
 * Load Google Maps Places API script dynamically using the API key from env.
 * Keeps the API key out of HTML source and version control.
 *
 * Rejects with:
 * - Error('API_KEY_NOT_SET') when key is missing or placeholder (so UI can show "set env and redeploy")
 * - Error('SCRIPT_LOAD_FAILED') when the script fails to load (e.g. key invalid or domain restricted)
 */
let loadPromise = null;

export function isGoogleMapsKeyConfigured() {
    if (typeof import.meta === 'undefined' || !import.meta.env) return false;
    const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    return !!(key && key !== 'your-google-maps-api-key');
}

export function loadGoogleMapsScript() {
    if (typeof window === 'undefined') return Promise.resolve();
    if (window.google?.maps?.places) return Promise.resolve();
    if (loadPromise) return loadPromise;

    const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!key || key === 'your-google-maps-api-key') {
        console.warn(
            'Google Maps API key not configured. Add VITE_GOOGLE_MAPS_API_KEY to .env or hosting env and redeploy.'
        );
        return Promise.reject(new Error('API_KEY_NOT_SET'));
    }

    loadPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.async = true;
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&loading=async&v=quarterly`;
        script.onload = () => resolve();
        script.onerror = () => {
            loadPromise = null;
            console.error('Google Maps script failed to load. Check API key, referrer restrictions, and enabled APIs.');
            reject(new Error('SCRIPT_LOAD_FAILED'));
        };
        document.head.appendChild(script);
    });

    return loadPromise;
}
