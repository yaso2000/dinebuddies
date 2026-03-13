/**
 * Load Google Maps Places API script dynamically using the API key from env.
 * Keeps the API key out of HTML source and version control.
 */
let loadPromise = null;

export function loadGoogleMapsScript() {
    if (typeof window === 'undefined') return Promise.resolve();
    if (window.google?.maps?.places) return Promise.resolve();
    if (loadPromise) return loadPromise;

    const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!key || key === 'your-google-maps-api-key') {
        console.warn(
            'Google Maps API key not configured. Add VITE_GOOGLE_MAPS_API_KEY to .env for place search.'
        );
        return Promise.resolve();
    }

    loadPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.async = true;
        script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&v=quarterly`;
        script.onload = () => resolve();
        script.onerror = () => {
            loadPromise = null;
            reject(new Error('Failed to load Google Maps script'));
        };
        document.head.appendChild(script);
    });

    return loadPromise;
}
