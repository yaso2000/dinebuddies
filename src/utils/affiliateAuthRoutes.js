import { isMobileRestrictedShell } from './mobileAppShell';
import { sanitizeNextPath } from './safeInternalPath';

/**
 * Email/password sign-in entry for affiliate partners.
 * On mobile (narrow viewport or PWA standalone), use the main app Business tab on `/login`
 * so partners are not sent to a separate affiliate login screen.
 */
export function getAffiliateEmailSignInHref(nextPath) {
    const next = sanitizeNextPath(typeof nextPath === 'string' ? nextPath : '') || '/affiliate/dashboard';
    if (typeof window !== 'undefined' && isMobileRestrictedShell()) {
        return `/login?${new URLSearchParams({ tab: 'business', next }).toString()}`;
    }
    return `/affiliate/login?${new URLSearchParams({ next }).toString()}`;
}
