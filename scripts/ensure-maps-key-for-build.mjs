/**
 * Legacy: venue search uses OpenStreetMap (Photon + Nominatim); a Google Maps key is not required.
 * Kept so CI / vercel-build scripts that invoke this file still succeed.
 */
process.exit(0);
