/**
 * Single routing model for account kinds — consumer, business, affiliate, staff, guest.
 * Identity comes from Firestore + AuthContext normalization; portals must not mix flows.
 */
import { accountKindFromProfileData, AUTH_PORTAL } from './authPortalGate';
import { isAdminIdentity, shouldLandOnAdminDashboard } from './adminAccess';
import { isAffiliateAgent } from './accountRole';
import { canConsumerEnterApp, shouldSkipConsumerProfileCompletion } from './consumerProfileComplete';
import { needsConsumerEmailVerification } from './emailVerification';
import { sanitizeNextPath } from './safeInternalPath';

export const ACCOUNT_KIND = {
    CONSUMER: 'consumer',
    BUSINESS: 'business',
    AFFILIATE: 'affiliate',
    GUEST: 'guest',
    STAFF: 'staff',
};

const PORTAL_TO_KIND = {
    [AUTH_PORTAL.PERSONAL]: ACCOUNT_KIND.CONSUMER,
    [AUTH_PORTAL.BUSINESS]: ACCOUNT_KIND.BUSINESS,
    [AUTH_PORTAL.AFFILIATE]: ACCOUNT_KIND.AFFILIATE,
};

/** @param {object | null | undefined} profile normalized or raw Firestore user */
export function resolveAccountKind(profile, { isGuest = false } = {}) {
    if (isGuest || profile?.isGuest || profile?.role === 'guest') return ACCOUNT_KIND.GUEST;
    if (!profile) return null;
    if (shouldLandOnAdminDashboard(null, profile) || ['admin', 'staff', 'support', 'moderator'].includes(String(profile.role || '').toLowerCase())) {
        return ACCOUNT_KIND.STAFF;
    }
    if (isAffiliateAgent(profile)) return ACCOUNT_KIND.AFFILIATE;
    const portal = accountKindFromProfileData(profile);
    return PORTAL_TO_KIND[portal] || ACCOUNT_KIND.CONSUMER;
}

/**
 * Default in-app destination after session restore or login.
 * @param {import('firebase/auth').User | null} currentUser
 * @param {object | null | undefined} profile
 * @param {{ next?: string | null, isGuest?: boolean }} [opts]
 */
export function resolveSignedInHomePath(currentUser, profile, opts = {}) {
    const next = sanitizeNextPath(opts.next);
    const kind = resolveAccountKind(profile, { isGuest: opts.isGuest });

    if (!currentUser && kind !== ACCOUNT_KIND.GUEST) {
        return '/login';
    }

    if (kind === ACCOUNT_KIND.GUEST) {
        return next || '/posts-feed';
    }

    if (kind === ACCOUNT_KIND.STAFF || shouldLandOnAdminDashboard(currentUser, profile)) {
        return next || '/admin/users';
    }

    if (kind === ACCOUNT_KIND.AFFILIATE) {
        return next?.startsWith('/affiliate') ? next : '/affiliate/dashboard';
    }

    if (kind === ACCOUNT_KIND.BUSINESS) {
        if (next && (next.startsWith('/business') || next === '/business-dashboard')) return next;
        if (profile?.pendingBusinessRegistration) return '/business/onboarding';
        return '/business-dashboard';
    }

    // Consumer
    if (needsConsumerEmailVerification(currentUser, profile)) {
        return '/verify-email';
    }
    if (!canConsumerEnterApp(profile)) {
        return '/complete-profile';
    }
    return next || '/posts-feed';
}

/** Layout subtree is consumer-first; business/affiliate/staff have dedicated shells. */
export function shouldUseConsumerAppShell(profile, { isGuest = false } = {}) {
    const kind = resolveAccountKind(profile, { isGuest });
    return kind === ACCOUNT_KIND.CONSUMER || kind === ACCOUNT_KIND.GUEST || kind == null;
}

export function isBusinessAccount(profile) {
    return resolveAccountKind(profile) === ACCOUNT_KIND.BUSINESS;
}

export function isConsumerAccount(profile) {
    return resolveAccountKind(profile) === ACCOUNT_KIND.CONSUMER;
}

export { shouldSkipConsumerProfileCompletion };
