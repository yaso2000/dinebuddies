import { isBusinessUser } from './accountRole';

/**
 * Firebase Auth provider IDs for federated (OAuth / OIDC) sign-in.
 * For these accounts, identity and email ownership are established by the provider;
 * `currentUser.emailVerified` may still be false, but we must NOT send users through
 * the email-link "activation" flow — that flow is for email/password sign-ups only.
 */
const OAUTH_PROVIDER_IDS = new Set([
    'google.com',
    'facebook.com',
    'apple.com',
    'twitter.com',
    'microsoft.com',
    'yahoo.com',
    'github.com',
]);

function hasOAuthProvider(currentUser) {
    const list = currentUser?.providerData;
    if (!Array.isArray(list) || list.length === 0) return false;
    return list.some((p) => p?.providerId && OAUTH_PROVIDER_IDS.has(p.providerId));
}

/**
 * Email/password (non-OAuth) accounts with an unverified address must use `/verify-email`
 * before the app treats the account as activated. Applies to **consumers and businesses**.
 */
/** @param userProfile reserved for future rules; profile may load after auth. */
export function needsEmailPasswordVerification(currentUser, userProfile) {
    void userProfile;
    if (!currentUser) return false;

    const email = currentUser.email;
    if (!email || typeof email !== 'string') return false;
    if (currentUser.emailVerified === true) return false;

    if (hasOAuthProvider(currentUser)) return false;

    return true;
}

/**
 * Whether a **consumer** must complete the in-app `/verify-email` flow (Firebase
 * `sendEmailVerification` + link) before using the app.
 *
 * Same as {@link needsEmailPasswordVerification} but **excludes** business accounts
 * when routing logic already handled them separately (legacy callers).
 */
export function needsConsumerEmailVerification(currentUser, userProfile) {
    if (!needsEmailPasswordVerification(currentUser, userProfile)) return false;
    if (isBusinessUser(userProfile)) return false;
    return true;
}
