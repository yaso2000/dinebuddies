/**
 * Normalize a directory/profile business into create-invitation navigation state.
 * Keeps venue prefill durable across the type selector → create form flow.
 */

function asPlainString(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || '';
  }
  return '';
}

function resolveAddress(business) {
  if (!business || typeof business !== 'object') return '';
  return (
    asPlainString(business.address) ||
    asPlainString(business.location) ||
    asPlainString(business.city) ||
    asPlainString(business.businessInfo?.address) ||
    asPlainString(business.businessInfo?.city) ||
    ''
  );
}

function resolveCoords(business) {
  const lat = business?.lat ?? business?.coordinates?.lat ?? business?.businessInfo?.lat ?? null;
  const lng = business?.lng ?? business?.coordinates?.lng ?? business?.businessInfo?.lng ?? null;
  const latN = lat == null ? null : Number(lat);
  const lngN = lng == null ? null : Number(lng);
  if (!Number.isFinite(latN) || !Number.isFinite(lngN)) {
    return { lat: null, lng: null };
  }
  return { lat: latN, lng: lngN };
}

export function buildHostInvitationRestaurantData(business) {
  if (!business || typeof business !== 'object') return null;
  const id = business.id || business.uid || business.ownerId;
  if (!id) return null;

  const { lat, lng } = resolveCoords(business);
  const name =
    asPlainString(business.name) ||
    asPlainString(business.display_name) ||
    asPlainString(business.displayName) ||
    'Business';

  return {
    id,
    name,
    image:
      business.image ||
      business.businessInfo?.coverImage ||
      business.coverImage ||
      null,
    address: resolveAddress(business),
    city: asPlainString(business.city) || asPlainString(business.businessInfo?.city),
    lat,
    lng,
    countryCode:
      business.countryCode ||
      business.country ||
      business.businessInfo?.countryCode ||
      null,
    type:
      business.type ||
      business.businessType ||
      business.businessInfo?.businessType ||
      'Restaurant',
  };
}

export function buildHostInvitationNavigationState(business) {
  const restaurantData = buildHostInvitationRestaurantData(business);
  if (!restaurantData) return null;
  return {
    fromRestaurant: true,
    restaurantData,
  };
}

export function findBusinessForHostInvitation(restaurants, businessId) {
  if (!businessId || !Array.isArray(restaurants)) return null;
  return restaurants.find((item) => item?.id === businessId || item?.uid === businessId) || null;
}

export function resolveHostInvitationNavigationState({ locationState, businessId, restaurants } = {}) {
  const fromState =
    locationState && typeof locationState === 'object' ? { ...locationState } : {};
  if (fromState.restaurantData || fromState.selectedRestaurant) {
    const raw = fromState.restaurantData || fromState.selectedRestaurant;
    const normalized = buildHostInvitationRestaurantData(raw) || raw;
    return {
      ...fromState,
      fromRestaurant: true,
      restaurantData: normalized,
    };
  }

  const id = businessId || fromState.businessId || null;
  if (!id) return fromState.restaurantData ? fromState : {};

  const found = findBusinessForHostInvitation(restaurants, id);
  const built = buildHostInvitationNavigationState(found);
  if (!built) {
    return id ? { ...fromState, businessId: id, fromRestaurant: true } : fromState;
  }
  return { ...fromState, ...built, businessId: id };
}

export function withBusinessIdInPath(path, businessId) {
  if (!path || !businessId) return path;
  try {
    const url = new URL(path, 'https://dinebuddies.local');
    url.searchParams.set('businessId', businessId);
    return `${url.pathname}${url.search}`;
  } catch {
    const join = path.includes('?') ? '&' : '?';
    return `${path}${join}businessId=${encodeURIComponent(businessId)}`;
  }
}
