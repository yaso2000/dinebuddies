/** Discriminator for invitation visibility / billing category. */

export type InvitationCategory = 'public' | 'social' | 'private';



/** Venue type chip on public invitations (Restaurant, Cafe, …). */

export type InvitationVenueType = string;



export type InvitationCreateErrorCode =

    | 'business-accounts-cannot-create-invitations'

    | 'public-invite-must-be-local'
    | 'location-not-determined'

    | 'guest-not-allowed'

    | 'missing-title'

    | 'firestore-error';



export type InvitationCreateResult =

    | { ok: true; id: string }

    | { ok: false; code: InvitationCreateErrorCode; message: string };



export interface InvitationCreatorProfile {

    role?: string | null;

    accountType?: string | null;

    isBusiness?: boolean;

    isVirtual?: boolean;

    isGuest?: boolean;

    businessInfo?: Record<string, unknown> | null;

    pendingBusinessRegistration?: boolean;

    registrationIntent?: string | null;

    city?: string | null;

    locality?: string | null;

    countryCode?: string | null;

    coordinates?: { lat?: number; lng?: number } | null;

}



export interface PublicInvitationFeedDoc {

    id?: string;

    status?: string | null;

    inviteCategory?: InvitationCategory | string | null;

    type?: string | null;

    privacy?: string | null;

    invitedFriends?: string[] | null;

    publishedAt?: unknown;

    meetingStatus?: string | null;

    city?: string | null;

    restaurantCity?: string | null;

    restaurantId?: string | null;

    countryCode?: string | null;

    lat?: number | null;

    lng?: number | null;

    author?: { id?: string } | null;

}

