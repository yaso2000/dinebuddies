/**
 * Fetch business details from Google Places (Google Business Profile)
 * Uses the PlacesService from Google Maps JavaScript API.
 *
 * Note: Menu data is not available via the standard Places API.
 * Photo URLs from Google may have limited lifespan; consider re-uploading to Firebase for permanence.
 */

/**
 * Extract Place ID from Google Maps URL
 * Supports: .../place/.../...!1s0x...!... and ...!1sChIJ...!8m2!...
 * @param {string} url - Google Maps URL
 * @returns {string|null} Place ID or null
 */
export function extractPlaceIdFromUrl(url) {
    if (!url || typeof url !== 'string') return null;
    const trimmed = url.trim();
    // Pattern for Place ID in Google Maps URLs (ChIJ...)
    const placeIdMatch = trimmed.match(/!1s(ChIJ[A-Za-z0-9_-]+)/);
    if (placeIdMatch) return placeIdMatch[1];
    // Alternative: place ID in data parameter
    const dataMatch = trimmed.match(/place\/[^/]+\/[^?]*data=[^!]*!1s([^!]+)/);
    if (dataMatch) return dataMatch[1];
    return null;
}

/**
 * Get city from address_components
 * @param {Array} components - address_components from Place Details
 * @returns {{ city: string, country: string, countryCode: string }}
 */
function parseAddressComponents(components) {
    let city = '';
    let country = '';
    let countryCode = '';
    if (Array.isArray(components)) {
        for (const c of components) {
            if (c.types?.includes('locality')) city = c.long_name || '';
            if (c.types?.includes('administrative_area_level_1') && !city) city = c.long_name || '';
            if (c.types?.includes('country')) {
                country = c.long_name || '';
                countryCode = (c.short_name || '').toUpperCase().slice(0, 2);
            }
        }
    }
    return { city, country, countryCode };
}

/**
 * Fetch place details using PlacesService
 * @param {string} placeId - Google Place ID
 * @param {object} placesService - google.maps.places.PlacesService instance
 * @returns {Promise<object>} Normalized business data for DineBuddies
 */
export function fetchPlaceDetails(placeId, placesService) {
    return new Promise((resolve, reject) => {
        if (!placeId || !placesService) {
            reject(new Error('Place ID and PlacesService are required'));
            return;
        }

        const fields = [
            'name',
            'formatted_address',
            'address_components',
            'geometry',
            'place_id',
            'formatted_phone_number',
            'international_phone_number',
            'website',
            'url',
            'photos',
            'opening_hours',
            'types',
            'reviews',
        ];

        placesService.getDetails(
            {
                placeId,
                fields,
            },
            (place, status) => {
                if (status !== window.google?.maps?.places?.PlacesServiceStatus?.OK || !place) {
                    reject(new Error(status === 'ZERO_RESULTS' ? 'Place not found' : 'Failed to fetch place details'));
                    return;
                }

                const { city, country, countryCode } = parseAddressComponents(place.address_components || []);
                const lat = place.geometry?.location?.lat?.();
                const lng = place.geometry?.location?.lng?.();

                // Get ALL photo URLs from the place (API returns up to 10; use all)
                const photoUrls = [];
                if (place.photos && place.photos.length > 0) {
                    for (let i = 0; i < place.photos.length; i++) {
                        try {
                            const url = place.photos[i].getUrl({ maxWidth: 1200 });
                            if (url) photoUrls.push(url);
                        } catch (e) {
                            console.warn('Could not get photo URL:', e);
                        }
                    }
                }

                // Parse opening hours if available
                let workingHours = null;
                if (place.opening_hours?.weekday_text) {
                    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                    workingHours = {};
                    place.opening_hours.weekday_text.forEach((text, i) => {
                        const day = days[i];
                        workingHours[day] = {
                            isOpen: !text.toLowerCase().includes('closed'),
                            text: text,
                        };
                    });
                }

                // Google Business has no "about" field; leave description empty (do not use first review)
                const description = '';

                resolve({
                    businessName: place.name || '',
                    address: place.formatted_address || '',
                    city,
                    country,
                    countryCode: countryCode || 'AU',
                    lat,
                    lng,
                    placeId: place.place_id || placeId,
                    phone: place.formatted_phone_number || place.international_phone_number || '',
                    website: place.website || place.url || '',
                    description,
                    coverImage: photoUrls[0] || null,
                    logo: photoUrls[0] || null,
                    gallery: photoUrls,
                    workingHours,
                    types: place.types || [],
                });
            }
        );
    });
}
