/**
 * Location Verification Utility
 * Verifies that the user is physically at the invitation location before allowing completion
 */

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in meters
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distance = R * c; // Distance in meters
    return distance;
};

/**
 * Get user's current location
 * @returns {Promise<{latitude: number, longitude: number}>}
 */
export const getCurrentLocation = () => {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation is not supported by your browser'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy
                });
            },
            (error) => {
                let errorMessage = 'Unable to get your location';

                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = 'Location permission denied. Please enable location access in your browser settings.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = 'Location information is unavailable.';
                        break;
                    case error.TIMEOUT:
                        errorMessage = 'Location request timed out.';
                        break;
                }

                reject(new Error(errorMessage));
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    });
};

/**
 * Verify if user is at the invitation location
 * @param {number} invitationLat - Invitation location latitude
 * @param {number} invitationLng - Invitation location longitude
 * @param {number} maxDistance - Maximum allowed distance in meters (default: 100m)
 * @returns {Promise<{verified: boolean, distance: number, userLocation: object, message: string}>}
 */
export const verifyUserAtLocation = async (invitationLat, invitationLng, maxDistance = 100) => {
    try {
        // Get user's current location
        const userLocation = await getCurrentLocation();

        // Calculate distance
        const distance = calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            invitationLat,
            invitationLng
        );

        const verified = distance <= maxDistance;

        return {
            verified,
            distance: Math.round(distance),
            userLocation,
            message: verified
                ? `✅ Location verified! You are ${Math.round(distance)}m from the venue.`
                : `❌ You must be at the venue to complete the invitation. You are ${Math.round(distance)}m away (max: ${maxDistance}m).`
        };
    } catch (error) {
        return {
            verified: false,
            distance: null,
            userLocation: null,
            message: error.message,
            error: error
        };
    }
};

/**
 * Configuration for location verification
 */
export const LOCATION_VERIFICATION_CONFIG = {
    MAX_DISTANCE_METERS: 100, // Maximum distance allowed (100 meters)
    HIGH_ACCURACY: true, // Use high accuracy GPS
    TIMEOUT: 10000, // 10 seconds timeout
    ENABLE_VERIFICATION: true // Master switch to enable/disable verification
};

/**
 * Format distance for display
 * @param {number} meters - Distance in meters
 * @returns {string} Formatted distance string
 */
export const formatDistance = (meters) => {
    if (meters < 1000) {
        return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(2)}km`;
};
