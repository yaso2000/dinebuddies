import { getBusinessSubscriptionAccess } from './businessSubscription';
import { isBusinessUser } from './accountRole';

/**
 * Premium Feed Image Studio — gated for business accounts with a paid subscription.
 *
 * Firestore `users/{uid}` typically has:
 * - `subscriptionTier`: `'free' | 'paid'` (canonical for app gating; see `businessSubscription.js`)
 * - `subscriptionStatus`: Stripe mirror (`'active'`, `'canceled'`, …) from webhooks
 *
 * Access if: business user AND (`subscriptionTier` resolves to paid OR `subscriptionStatus` is paid-like).
 */
export function canUsePremiumFeedImageEditor(profile) {
    if (!profile || !isBusinessUser(profile)) return false;

    if (getBusinessSubscriptionAccess(profile.subscriptionTier).isPaid) return true;

    const status = String(profile.subscriptionStatus || '').toLowerCase();
    return status === 'paid' || status === 'active' || status === 'trialing';
}
