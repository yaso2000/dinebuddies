import { isAffiliateAgentProfileData, profileDocumentIsBusiness } from './accountRole';

/** @readonly */
export const AUTH_PORTAL = {
    PERSONAL: 'personal',
    BUSINESS: 'business',
    AFFILIATE: 'affiliate',
};

/**
 * @param {object | null | undefined} data — raw or normalized Firestore user doc
 * @returns {'personal' | 'business' | 'affiliate'}
 */
export function accountKindFromProfileData(data) {
    if (!data || typeof data !== 'object') return AUTH_PORTAL.PERSONAL;
    if (isAffiliateAgentProfileData(data)) return AUTH_PORTAL.AFFILIATE;
    if (profileDocumentIsBusiness(data)) return AUTH_PORTAL.BUSINESS;
    return AUTH_PORTAL.PERSONAL;
}

function portalError(code, message) {
    const err = new Error(message);
    err.code = code;
    return err;
}

/**
 * Ensures the signed-in Firestore profile may use the given auth portal.
 * @param {object | null | undefined} data
 * @param {'personal' | 'business' | 'affiliate'} portal
 */
export function assertProfileMatchesPortal(data, portal) {
    const kind = accountKindFromProfileData(data);

    if (portal === AUTH_PORTAL.PERSONAL) {
        if (kind === AUTH_PORTAL.AFFILIATE) {
            throw portalError(
                'auth/affiliate-portal-only',
                'This account is an affiliate partner. Sign in from the affiliate portal only.'
            );
        }
        if (kind === AUTH_PORTAL.BUSINESS) {
            throw portalError(
                'auth/business-portal-only',
                'This account is a business account. Use Business sign-in, not personal login.'
            );
        }
        return;
    }

    if (portal === AUTH_PORTAL.BUSINESS) {
        if (kind === AUTH_PORTAL.AFFILIATE) {
            throw portalError(
                'auth/affiliate-portal-only',
                'This account is an affiliate partner. Use the affiliate sign-in page, not business login.'
            );
        }
        if (kind !== AUTH_PORTAL.BUSINESS) {
            throw portalError(
                'auth/consumer-portal-only',
                'This login is for business accounts only. Use personal sign-in (Google, Facebook, or Apple) for consumer accounts.'
            );
        }
        return;
    }

    if (portal === AUTH_PORTAL.AFFILIATE) {
        if (kind === AUTH_PORTAL.BUSINESS) {
            throw portalError(
                'auth/business-portal-only',
                'This account is a business account. Use business sign-in, not the affiliate portal.'
            );
        }
        if (kind !== AUTH_PORTAL.AFFILIATE) {
            throw portalError(
                'auth/affiliate-portal-only',
                'This login is for affiliate partners only. Use the main app for personal or business accounts.'
            );
        }
    }
}
