import {
    assertPublicInviteVenueFromLiveGps,
    normalizeVenueCoordsFromRestaurantData,
    invitationErrorI18nKey,
} from './invitationRules';

/**
 * Returns true when the user must not proceed (toast already shown).
 * Only applies when a business/venue is pre-selected (public invite geofence).
 */
export async function blockPublicInviteFromBusinessVenue({ restaurantData, showToast, t }) {
    const venue = normalizeVenueCoordsFromRestaurantData(restaurantData);
    if (!venue) return false;

    const block = await assertPublicInviteVenueFromLiveGps(venue);
    if (!block) return false;

    showToast(t(invitationErrorI18nKey(block.code), block.message), 'error');
    return true;
}
