const AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';

/** Google allows max 5 values for includedPrimaryTypes. */
export const BUSINESS_PRIMARY_TYPES = ['restaurant', 'cafe', 'bar', 'bakery', 'meal_takeaway'];

const FIELD_MASK =
    'suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat.mainText.text,suggestions.placePrediction.structuredFormat.secondaryText.text';

export function googlePlacesApiKey() {
    return (
        process.env.GOOGLE_PLACES_API_KEY ||
        process.env.GOOGLE_MAPS_SERVER_KEY ||
        process.env.VITE_GOOGLE_MAPS_API_KEY ||
        process.env.GOOGLE_MAPS_API_KEY ||
        ''
    );
}

/**
 * @param {{
 *   input: string;
 *   sessionToken: string;
 *   languageCode?: string;
 *   countryCode?: string;
 *   minLat?: number;
 *   minLon?: number;
 *   maxLat?: number;
 *   maxLon?: number;
 *   centerLat?: number;
 *   centerLng?: number;
 *   radiusMeters?: number;
 *   businessOnly?: boolean;
 * }} opts
 */
export function buildAutocompletePayloadVariants(opts) {
    const input = String(opts.input || '').trim();
    const sessionToken = String(opts.sessionToken || '').slice(0, 36);
    const languageCode =
        typeof opts.languageCode === 'string' && opts.languageCode.trim()
            ? opts.languageCode.trim()
            : 'en';

    const base = {
        input,
        sessionToken,
        languageCode,
        includeQueryPredictions: false,
    };

    if (opts.countryCode) {
        base.includedRegionCodes = [String(opts.countryCode).toLowerCase().slice(0, 2)];
    }

    const loLat = Number(opts.minLat);
    const loLon = Number(opts.minLon);
    const hiLat = Number(opts.maxLat);
    const hiLon = Number(opts.maxLon);
    const hasBbox =
        Number.isFinite(loLat) &&
        Number.isFinite(loLon) &&
        Number.isFinite(hiLat) &&
        Number.isFinite(hiLon);

    const bboxBias = hasBbox
        ? {
              locationBias: {
                  rectangle: {
                      low: { latitude: Math.min(loLat, hiLat), longitude: Math.min(loLon, hiLon) },
                      high: { latitude: Math.max(loLat, hiLat), longitude: Math.max(loLon, hiLon) },
                  },
              },
          }
        : {};

    const cLat = Number(opts.centerLat);
    const cLng = Number(opts.centerLng);
    const radiusM = Number(opts.radiusMeters);
    const hasCircle =
        Number.isFinite(cLat) &&
        Number.isFinite(cLng) &&
        Number.isFinite(radiusM) &&
        radiusM > 0;

    const circleBias = hasCircle
        ? {
              locationBias: {
                  circle: {
                      center: { latitude: cLat, longitude: cLng },
                      radius: Math.min(radiusM, 50000),
                  },
              },
          }
        : {};

    const localBias = hasCircle ? circleBias : bboxBias;

    const variants = [];

    if (opts.businessOnly) {
        variants.push({
            ...base,
            ...localBias,
            includedPrimaryTypes: [...BUSINESS_PRIMARY_TYPES],
        });
        variants.push({
            ...base,
            ...localBias,
        });
    } else {
        variants.push({
            ...base,
            ...localBias,
        });
    }

    if (hasCircle && hasBbox) {
        variants.push({
            ...base,
            ...bboxBias,
            ...(opts.businessOnly ? { includedPrimaryTypes: [...BUSINESS_PRIMARY_TYPES] } : {}),
        });
    }

    if (hasBbox || hasCircle) {
        variants.push({
            ...base,
            ...(opts.businessOnly ? { includedPrimaryTypes: [...BUSINESS_PRIMARY_TYPES] } : {}),
        });
        variants.push({ ...base });
    }

    const seen = new Set();
    return variants.filter((v) => {
        const key = JSON.stringify(v);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

/**
 * @param {Record<string, unknown>} payload
 * @param {string} key
 */
async function callGoogleAutocomplete(payload, key) {
    const response = await fetch(AUTOCOMPLETE_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': key,
            'X-Goog-FieldMask': FIELD_MASK,
        },
        body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    const suggestions = Array.isArray(data?.suggestions) ? data.suggestions : [];
    const predictions = suggestions
        .map((s) => s?.placePrediction)
        .filter(Boolean)
        .map((p) => {
            const main = p.structuredFormat?.mainText?.text || p.text?.text || '';
            const secondary = p.structuredFormat?.secondaryText?.text || '';
            return {
                place_id: p.placeId,
                description: secondary ? `${main}, ${secondary}` : main,
                structured_formatting: {
                    main_text: main,
                    secondary_text: secondary,
                },
            };
        });

    return {
        ok: response.ok,
        status: response.status,
        predictions,
        errorMessage:
            (data && typeof data === 'object' && data.error?.message) ||
            (typeof data?.error === 'string' ? data.error : '') ||
            '',
    };
}

/**
 * @param {{
 *   input: string;
 *   sessionToken: string;
 *   languageCode?: string;
 *   countryCode?: string;
 *   minLat?: number;
 *   minLon?: number;
 *   maxLat?: number;
 *   maxLon?: number;
 *   centerLat?: number;
 *   centerLng?: number;
 *   radiusMeters?: number;
 *   businessOnly?: boolean;
 * }} opts
 */
export async function fetchPlaceAutocompleteWithFallback(opts) {
    const key = googlePlacesApiKey();
    if (!key) {
        return { ok: false, status: 503, predictions: [], errorMessage: 'Google Places API key not configured' };
    }

    const variants = buildAutocompletePayloadVariants(opts);
    let lastError = '';

    for (const payload of variants) {
        const result = await callGoogleAutocomplete(payload, key);
        if (result.predictions.length > 0) {
            return { ok: true, status: 200, predictions: result.predictions, errorMessage: '' };
        }
        if (!result.ok) {
            lastError = result.errorMessage || `Google autocomplete failed (${result.status})`;
            // Invalid payload — don't keep retrying same class of error
            if (result.status === 400) break;
        }
    }

    return {
        ok: true,
        status: 200,
        predictions: [],
        errorMessage: lastError,
    };
}
