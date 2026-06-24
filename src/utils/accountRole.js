import { ROLE_AFFILIATE_AGENT } from '../constants/userProfileSchema';
import { normalizeUserProfile } from './userProfileNormalize';

/**
 * Raw Firestore read / merge payload — affiliate portal markers (used only under `/affiliate/*` + normalization).
 * Do NOT use this for global Layout/HomeRouter routing: it must not affect consumer/business shells.
 */
export function isAffiliateAgentProfileData(data) {
    if (!data || typeof data !== 'object') return false;
    const r = String(data.role || '').toLowerCase();
    if (r === ROLE_AFFILIATE_AGENT) return true;
    if (String(data.registrationChannel || '').toLowerCase() === 'affiliate_portal') return true;
    if (String(data.authProvider || '').toLowerCase() === 'affiliate_email') return true;
    return false;
}

/**
 * Raw Firestore `users/{uid}` payload — same rules as AuthContext profile normalization.
 */
export function profileDocumentIsBusiness(data) {
    if (!data || typeof data !== 'object') return false;
    return normalizeUserProfile(data)?.isBusiness === true;
}

/**
 * Single source of truth for “is this a business / partner account?” in the client.
 */
export function isBusinessUser(profile) {
    if (!profile || typeof profile !== 'object') return false;
    if (profile.isBusiness === true) return true;
    return profileDocumentIsBusiness(profile);
}

/** Virtual / placeholder accounts cannot create consumer invitations. */
export function isVirtualUser(profile) {
    if (!profile || typeof profile !== 'object') return false;
    return profile.isVirtual === true;
}

/** Business or virtual accounts are blocked from creating any invitation type. */
export function cannotCreateInvitations(profile) {
    return isBusinessUser(profile) || isVirtualUser(profile);
}

/** Affiliate agent accounts in the **normalized** app profile (`role` only) — safe for Layout/HomeRouter. */
export function isAffiliateAgent(profile) {
    if (!profile || typeof profile !== 'object') return false;
    return String(profile.role || '').toLowerCase() === ROLE_AFFILIATE_AGENT;
}

/** Session hint set after a successful business-portal sign-in (survives brief profile load races). */
export function hasBusinessSessionHint(uid) {
    if (!uid) return false;
    try {
        return sessionStorage.getItem('dineb_biz_uid') === uid;
    } catch {
        return false;
    }
}
