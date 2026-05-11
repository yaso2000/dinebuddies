import { ROLE_AFFILIATE_AGENT } from '../constants/userProfileSchema';

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
 * Single source of truth for “is this a business / partner account?” in the client.
 * Keep aligned with AuthContext.normalizeProfile (businessInfo, role casing, accountType).
 */
export function isBusinessUser(profile) {
    if (!profile || typeof profile !== 'object') return false;
    if (profile.isBusiness === true) return true;
    if (profile.pendingBusinessRegistration === true) return true;
    const r = String(profile.role || '').toLowerCase();
    if (r === 'business' || r === 'partner') return true;
    if (String(profile.accountType || '').toLowerCase() === 'business') return true;
    // Firestore stub before step 2 completes (same as normalizeProfile pending business)
    if (String(profile.registrationIntent || '').toLowerCase() === 'business') return true;
    const bi = profile.businessInfo;
    return !!(bi && typeof bi === 'object' && Object.keys(bi).length > 0);
}

/** Affiliate agent accounts in the **normalized** app profile (`role` only) — safe for Layout/HomeRouter. */
export function isAffiliateAgent(profile) {
    if (!profile || typeof profile !== 'object') return false;
    return String(profile.role || '').toLowerCase() === ROLE_AFFILIATE_AGENT;
}
