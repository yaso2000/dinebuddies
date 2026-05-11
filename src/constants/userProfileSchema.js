/**
 * Canonical user profile fields (Firestore `users` + client normalization).
 * Values are lowercase strings to match existing `role: 'user' | 'business' | …` convention.
 */

/** Default consumer role for new personal accounts. */
export const ROLE_USER = 'user';

/** Affiliate program — managed on web only; blocked on mobile shell (see mobileAppShell + AuthContext). */
export const ROLE_AFFILIATE_AGENT = 'affiliate_agent';

/** Where the account is intended to be used (future gates / analytics). */
export const ACCESS_PLATFORM_ALL = 'all';
export const ACCESS_PLATFORM_WEB_ONLY = 'web_only';
export const ACCESS_PLATFORM_MOBILE_ONLY = 'mobile_only';

export const DEFAULT_USER_ROLE = ROLE_USER;
export const DEFAULT_ACCESS_PLATFORM = ACCESS_PLATFORM_ALL;

/** Firestore `users` (affiliate_agent): referral_code, referral_link, total_clicks — set by Cloud Function `ensureAffiliateReferralOnUserWrite`. */
