import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../firebase/config';

const resolveVenueCallable = httpsCallable(
  getFunctions(app, 'us-central1'),
  'resolveDineBuddiesVenueFromGoogle'
);

/**
 * If a Google Places pick exactly matches a published DineBuddies venue
 * (placeId, address, or coordinates), return enriched selection for the app listing.
 * @param {Record<string, unknown>} place
 */
export async function resolveAppVenueFromGoogleSelection(place) {
  if (!place || place.isDineBuddiesVenue || place.restaurantId) {
    return place;
  }

  const address = String(place.fullAddress || place.address || place.name || '').trim();
  const placeId = place.placeId ? String(place.placeId).trim() : '';
  const lat = place.lat ?? null;
  const lng = place.lng ?? null;

  if (!placeId && !address && (lat == null || lng == null)) {
    return place;
  }

  try {
    const { data } = await resolveVenueCallable({
      placeId: placeId || null,
      address: address || '',
      lat,
      lng,
    });

    if (data?.found && data?.venue) {
      return {
        ...place,
        ...data.venue,
        isDineBuddiesVenue: true,
        matchedFromGoogle: true,
        matchReason: data.matchReason || 'placeId',
        placeId: placeId || data.venue.placeId || null,
        fullAddress: data.venue.fullAddress || address || place.fullAddress,
      };
    }
  } catch (err) {
    console.warn('[resolveAppVenueFromGoogleSelection]', err);
  }

  return place;
}
