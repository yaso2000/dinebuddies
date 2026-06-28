import { resolveApiUrl } from './resolveApiUrl';
import { resolveCountryIso2 } from './countryIso';
import { bboxFromCoords } from './locationUtils';
import { fetchCityBoundingBox } from './osmPhotonSearch';
import { sortAutocompletePredictionsForInvitation } from './invitationVenueSearch';

export function newPlacesSessionToken() {
  const bytes = new Uint8Array(18);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  const raw = btoa(String.fromCharCode(...bytes));
  return raw.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '').slice(0, 36);
}

/** Keep only predictions whose description mentions the invitation city. */
export function filterPredictionsInCity(predictions, city) {
  if (!Array.isArray(predictions) || !predictions.length) return [];
  const cityToken = String(city || '')
    .trim()
    .toLowerCase()
    .split(',')[0]
    .trim();
  if (!cityToken || cityToken.length < 2) return predictions;

  const filtered = predictions.filter((p) =>
    String(p.description || p.full_description || '').toLowerCase().includes(cityToken)
  );
  return filtered;
}

export async function resolveCitySearchBbox({ city, countryCode, region, userLat, userLng }) {
  const lat = userLat != null ? Number(userLat) : NaN;
  const lng = userLng != null ? Number(userLng) : NaN;
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return bboxFromCoords(lat, lng, 40);
  }

  const cityName = String(city || '').trim();
  const iso = resolveCountryIso2(countryCode);
  if (cityName.length >= 2 && iso) {
    const bbox = await fetchCityBoundingBox(cityName, iso, region);
    if (bbox) return bbox;
  }

  return null;
}

/**
 * Google Places autocomplete for invitation venue search (city-biased).
 * @returns {Promise<Array<{ source: 'google', placeId, name, address, full_description, types }>>}
 */
export async function fetchGoogleVenuePredictions({
  input,
  city,
  countryCode,
  region,
  userLat,
  userLng,
  invitationType,
  sessionToken,
  lang = 'en',
  bbox: bboxIn,
}) {
  const trimmedInput = String(input || '').trim();
  if (trimmedInput.length < 2) return [];

  const countryIsoResolved = resolveCountryIso2(countryCode);
  let bbox = bboxIn;
  if (!bbox) {
    bbox = await resolveCitySearchBbox({ city, countryCode, region, userLat, userLng });
  }

  const params = new URLSearchParams({
    input: trimmedInput,
    sessionToken: sessionToken || newPlacesSessionToken(),
    languageCode: lang,
  });
  if (countryIsoResolved) params.set('countryCode', countryIsoResolved);
  const latNum = userLat != null ? Number(userLat) : NaN;
  const lngNum = userLng != null ? Number(userLng) : NaN;
  if (Number.isFinite(latNum) && Number.isFinite(lngNum)) {
    params.set('lat', String(latNum));
    params.set('lng', String(lngNum));
    params.set('radiusKm', '30');
  }
  if (
    bbox?.minLat != null &&
    bbox?.minLon != null &&
    bbox?.maxLat != null &&
    bbox?.maxLon != null
  ) {
    params.set('minLat', String(bbox.minLat));
    params.set('minLon', String(bbox.minLon));
    params.set('maxLat', String(bbox.maxLat));
    params.set('maxLon', String(bbox.maxLon));
  }

  const response = await fetch(`${resolveApiUrl('/api/place-autocomplete')}?${params.toString()}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || data?.hint || 'Google autocomplete failed');
  }

  let predictions = Array.isArray(data?.predictions) ? data.predictions : [];
  predictions = sortAutocompletePredictionsForInvitation(predictions, city, invitationType);
  predictions = filterPredictionsInCity(predictions, city);

  return predictions.map((p) => ({
    source: 'google',
    placeId: p.place_id,
    name: p.structured_formatting?.main_text || p.description || '',
    address: p.structured_formatting?.secondary_text || p.description || '',
    full_description: p.description || '',
    types: p.types || [],
  }));
}

export async function fetchGooglePlaceDetails({
  placeId,
  sessionToken,
  countryCode,
  lang = 'en',
}) {
  const params = new URLSearchParams({
    placeId: String(placeId),
    sessionToken: sessionToken || newPlacesSessionToken(),
    languageCode: lang,
  });
  const countryIsoResolved = resolveCountryIso2(countryCode);
  if (countryIsoResolved) params.set('regionCode', countryIsoResolved);

  const response = await fetch(`${resolveApiUrl('/api/place-details')}?${params.toString()}`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || 'Google details request failed');
  }

  return {
    name: data.businessName || '',
    fullAddress: data.address || '',
    city: data.city || '',
    country: data.country || '',
    countryCode: data.countryCode || '',
    lat: data.lat ?? null,
    lng: data.lng ?? null,
    placeId: data.placeId || placeId,
    types: [],
    addressComponents: data.addressComponents || [],
    photos: [],
    rating: null,
    userRatingsTotal: null,
    priceLevel: null,
    phone: '',
    website: '',
    openingHours: null,
    businessStatus: null,
    editorialSummary: '',
  };
}
