import type {
    InvitationCategory,
    InvitationCreateErrorCode,
    InvitationCreateResult,
    InvitationCreatorProfile,
    PublicInvitationFeedDoc,
} from '../types/invitation';
import { isAffiliateAgentProfileData } from './accountRole';
import { getInvitationLatLng } from './invitationCoords';
import { detectLiveUserGps } from './locationUtils';

export const INVITATION_ERROR_CODES = {
    BUSINESS_CANNOT_CREATE: 'business-accounts-cannot-create-invitations',
    PUBLIC_MUST_BE_LOCAL: 'public-invite-must-be-local',
    LOCATION_NOT_DETERMINED: 'location-not-determined',
    GUEST_NOT_ALLOWED: 'guest-not-allowed',
    MISSING_TITLE: 'missing-title',
    FIRESTORE_ERROR: 'firestore-error',
} as const satisfies Record<string, InvitationCreateErrorCode>;

/** Strict 30 km geofence for public invitations (create + feed). */
export const PUBLIC_INVITE_GEOFENCE_RADIUS_KM = 30;

export const PUBLIC_INVITE_GEOFENCE_ERROR_MESSAGE =
    'Sorry, public invitations are restricted to your current local area (within a 30 km radius).';

export const LOCATION_NOT_DETERMINED_ERROR_MESSAGE =
    'Your location could not be determined. Enable GPS/location access to create a public invitation.';

export const VENUE_LOCATION_NOT_DETERMINED_ERROR_MESSAGE =
    'Venue location could not be determined. Select a place with valid map coordinates.';

export const INVITATION_ERROR_MESSAGES: Record<InvitationCreateErrorCode, string> = {
    [INVITATION_ERROR_CODES.BUSINESS_CANNOT_CREATE]:
        'Business accounts cannot create social or private invites.',
    [INVITATION_ERROR_CODES.PUBLIC_MUST_BE_LOCAL]: PUBLIC_INVITE_GEOFENCE_ERROR_MESSAGE,
    [INVITATION_ERROR_CODES.LOCATION_NOT_DETERMINED]: LOCATION_NOT_DETERMINED_ERROR_MESSAGE,
    [INVITATION_ERROR_CODES.GUEST_NOT_ALLOWED]: 'Please sign in to create an invitation.',
    [INVITATION_ERROR_CODES.MISSING_TITLE]: 'Invitation title is required.',
    [INVITATION_ERROR_CODES.FIRESTORE_ERROR]: 'Failed to create invitation. Try again.',
};

export type GeoCoords = { lat?: unknown; lng?: unknown } | null | undefined;

export type PublicInviteGeofenceInput = {
    creatorCoords?: GeoCoords;
    venueCoords?: GeoCoords;
    creatorCountryCode?: unknown;
    venueCountryCode?: unknown;
};

export function parseLatLng(pair: GeoCoords): { lat: number; lng: number } | null {
    const lat = Number(pair?.lat);
    const lng = Number(pair?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { lat, lng };
}

/** Haversine great-circle distance in kilometres. */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

export function distanceBetweenCoords(a: GeoCoords, b: GeoCoords): number | null {
    const p1 = parseLatLng(a);
    const p2 = parseLatLng(b);
    if (!p1 || !p2) return null;
    return haversineKm(p1.lat, p1.lng, p2.lat, p2.lng);
}

export function normalizeCountryCode(raw: unknown): string {
    return String(raw ?? '')
        .trim()
        .toUpperCase();
}

/** Reject when both ISO country codes are known and differ (cross-border). */
export function crossesInternationalBorder(creatorCountryCode: unknown, venueCountryCode: unknown): boolean {
    const creator = normalizeCountryCode(creatorCountryCode);
    const venue = normalizeCountryCode(venueCountryCode);
    if (!creator || !venue) return false;
    return creator !== venue;
}

/**
 * Pure spatial validation for public invitations.
 * Requires live GPS coordinates for creator and venue; no city-name fallbacks.
 */
export function evaluatePublicInviteGeofence(
    input: PublicInviteGeofenceInput,
    radiusKm = PUBLIC_INVITE_GEOFENCE_RADIUS_KM,
): boolean {
    if (!parseLatLng(input.creatorCoords) || !parseLatLng(input.venueCoords)) {
        return false;
    }

    if (crossesInternationalBorder(input.creatorCountryCode, input.venueCountryCode)) {
        return false;
    }

    const distanceKm = distanceBetweenCoords(input.creatorCoords, input.venueCoords);
    if (distanceKm == null) return false;

    return distanceKm <= radiusKm;
}

export function assertPublicInvitationGeofenceRule(
    input: PublicInviteGeofenceInput,
): InvitationCreateResult | null {
    if (!parseLatLng(input.creatorCoords)) {
        return {
            ok: false,
            code: INVITATION_ERROR_CODES.LOCATION_NOT_DETERMINED,
            message: LOCATION_NOT_DETERMINED_ERROR_MESSAGE,
        };
    }

    if (!parseLatLng(input.venueCoords)) {
        return {
            ok: false,
            code: INVITATION_ERROR_CODES.LOCATION_NOT_DETERMINED,
            message: VENUE_LOCATION_NOT_DETERMINED_ERROR_MESSAGE,
        };
    }

    if (crossesInternationalBorder(input.creatorCountryCode, input.venueCountryCode)) {
        return {
            ok: false,
            code: INVITATION_ERROR_CODES.PUBLIC_MUST_BE_LOCAL,
            message: PUBLIC_INVITE_GEOFENCE_ERROR_MESSAGE,
        };
    }

    const distanceKm = distanceBetweenCoords(input.creatorCoords, input.venueCoords);
    if (distanceKm == null || distanceKm > PUBLIC_INVITE_GEOFENCE_RADIUS_KM) {
        return {
            ok: false,
            code: INVITATION_ERROR_CODES.PUBLIC_MUST_BE_LOCAL,
            message: PUBLIC_INVITE_GEOFENCE_ERROR_MESSAGE,
        };
    }

    return null;
}

/**
 * Business / virtual accounts must never create invitations (any category).
 */
export function isCreatorBlockedFromInvitations(
    profile: InvitationCreatorProfile | null | undefined,
): boolean {
    if (!profile) return true;
    if (profile.isVirtual === true) return true;
    if (profile.isGuest === true) return true;

    if (isAffiliateAgentProfileData(profile)) return false;

    const roleLc = String(profile.role || '').toLowerCase();
    const accountTypeLc = String(profile.accountType || '').toLowerCase();
    const hasBusinessInfo =
        profile.businessInfo &&
        typeof profile.businessInfo === 'object' &&
        Object.keys(profile.businessInfo).length > 0;

    if (profile.isBusiness === true) return true;
    if (roleLc === 'business' || roleLc === 'partner') return true;
    if (accountTypeLc === 'business') return true;
    if (hasBusinessInfo) return true;
    if (profile.pendingBusinessRegistration === true) return true;
    if (
        String(profile.registrationIntent || '').toLowerCase() === 'business' &&
        roleLc !== 'business' &&
        roleLc !== 'partner' &&
        !hasBusinessInfo
    ) {
        return true;
    }

    return false;
}

export function assertCreatorCanCreateInvitations(
    profile: InvitationCreatorProfile | null | undefined,
): InvitationCreateResult | null {
    if (!profile) {
        return {
            ok: false,
            code: INVITATION_ERROR_CODES.GUEST_NOT_ALLOWED,
            message: INVITATION_ERROR_MESSAGES[INVITATION_ERROR_CODES.GUEST_NOT_ALLOWED],
        };
    }
    if (isCreatorBlockedFromInvitations(profile)) {
        return {
            ok: false,
            code: INVITATION_ERROR_CODES.BUSINESS_CANNOT_CREATE,
            message: INVITATION_ERROR_MESSAGES[INVITATION_ERROR_CODES.BUSINESS_CANNOT_CREATE],
        };
    }
    return null;
}

export function validatePublicInvitationCreate(input: {
    creatorProfile: InvitationCreatorProfile | null | undefined;
    creatorCoords?: GeoCoords;
    venueCoords?: GeoCoords;
    creatorCountryCode?: unknown;
    venueCountryCode?: unknown;
}): InvitationCreateResult | null {
    const blocked = assertCreatorCanCreateInvitations(input.creatorProfile);
    if (blocked) return blocked;

    return assertPublicInvitationGeofenceRule({
        creatorCoords: input.creatorCoords,
        venueCoords: input.venueCoords,
        creatorCountryCode: input.creatorCountryCode,
        venueCountryCode: input.venueCountryCode,
    });
}

export function resolveInviteCategory(doc: PublicInvitationFeedDoc): InvitationCategory | 'legacy-public' {
    const raw = String(doc.inviteCategory || '').toLowerCase();
    if (raw === 'private') return 'private';
    if (raw === 'dating') return 'private';
    if (raw === 'public') return 'public';

    const typeLc = String(doc.type || '').toLowerCase();
    if (typeLc === 'private') return 'private';
    if (typeLc === 'dating') return 'private';

    if (Array.isArray(doc.invitedFriends) && doc.invitedFriends.length > 0) {
        return 'private';
    }
    if (doc.privacy === 'private') return 'private';

    return 'legacy-public';
}

export function isPublishedActivePublicInvitation(doc: PublicInvitationFeedDoc): boolean {
    if (doc.status === 'draft') return false;
    if (doc.meetingStatus === 'cancelled') return false;

    const status = doc.status;
    if (status === 'active') return true;

    if (status == null || status === '') {
        return Boolean(doc.publishedAt);
    }

    return status !== 'draft';
}

/**
 * Public feed visibility — venue must be within 30 km of viewer GPS.
 * Private/dating must never appear here.
 */
export function isVisibleInPublicFeed(
    doc: PublicInvitationFeedDoc,
    viewerCoords: GeoCoords,
    options?: { isStaff?: boolean; isOwn?: boolean; viewerCountryCode?: unknown },
): boolean {
    if (!doc?.author) return false;

    const category = resolveInviteCategory(doc);
    if (category === 'private' || category === 'dating') return false;

    if (!isPublishedActivePublicInvitation(doc)) return false;

    if (options?.isStaff || options?.isOwn) return true;

    if (!parseLatLng(viewerCoords)) return false;

    const venueCoords = getInvitationLatLng(doc);
    if (!venueCoords) return false;

    return evaluatePublicInviteGeofence({
        creatorCoords: viewerCoords,
        venueCoords,
        creatorCountryCode: options?.viewerCountryCode,
        venueCountryCode: doc.countryCode,
    });
}

export function normalizeVenueCoordsFromRestaurantData(
    rd: Record<string, unknown> | null | undefined,
): { lat?: unknown; lng?: unknown; countryCode?: unknown } | null {
    if (!rd || typeof rd !== 'object') return null;
    const nested = rd.coordinates as GeoCoords;
    const lat = rd.lat ?? nested?.lat;
    const lng = rd.lng ?? nested?.lng;
    if (lat == null && lng == null) return null;
    return {
        lat,
        lng,
        countryCode: rd.countryCode ?? rd.country_code,
    };
}

/** Live GPS vs pre-filled business/venue coords — for upfront public-invite gates. */
export async function assertPublicInviteVenueFromLiveGps(
    venue: { lat?: unknown; lng?: unknown; countryCode?: unknown } | null | undefined,
): Promise<InvitationCreateResult | null> {
    if (!venue) return null;

    const live = await detectLiveUserGps();
    if (!live.success) {
        return {
            ok: false,
            code: INVITATION_ERROR_CODES.LOCATION_NOT_DETERMINED,
            message: LOCATION_NOT_DETERMINED_ERROR_MESSAGE,
        };
    }

    return assertPublicInvitationGeofenceRule({
        creatorCoords: { lat: live.latitude, lng: live.longitude },
        venueCoords: { lat: venue.lat, lng: venue.lng },
        creatorCountryCode: live.countryCode,
        venueCountryCode: venue.countryCode,
    });
}

export function invitationErrorI18nKey(code: InvitationCreateErrorCode): string {
    switch (code) {
        case INVITATION_ERROR_CODES.BUSINESS_CANNOT_CREATE:
            return 'business_cannot_create_invitation';
        case INVITATION_ERROR_CODES.PUBLIC_MUST_BE_LOCAL:
            return 'public_invite_must_be_local';
        case INVITATION_ERROR_CODES.LOCATION_NOT_DETERMINED:
            return 'location_not_determined';
        case INVITATION_ERROR_CODES.GUEST_NOT_ALLOWED:
            return 'login_to_create';
        case INVITATION_ERROR_CODES.MISSING_TITLE:
            return 'please_enter_title';
        default:
            return 'failed_save_draft';
    }
}
