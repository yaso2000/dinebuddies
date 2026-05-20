import { sanitizeNextPath } from './safeInternalPath';
import { isAffiliateAgent, isBusinessUser } from './accountRole';
import { shouldLandOnAdminDashboard } from './adminAccess';
import { canConsumerEnterApp } from './consumerProfileComplete';

/** Where business email sign-in should land (optional ?next= under /business*). */
export function resolveBusinessPostLoginPath(search = '') {
    const raw = typeof search === 'string' ? search : '';
    const next = sanitizeNextPath(new URLSearchParams(raw).get('next'));
    if (next && (next.startsWith('/business') || next === '/business-dashboard')) {
        return next;
    }
    return '/business-dashboard';
}

/** Consumer personal login destination. */
export function resolvePersonalPostLoginPath(search = '', profile, currentUser) {
    const next = sanitizeNextPath(new URLSearchParams(typeof search === 'string' ? search : '').get('next'));
    if (next) return next;
    if (shouldLandOnAdminDashboard(currentUser, profile)) return '/admin/users';
    if (isAffiliateAgent(profile)) return '/affiliate/dashboard';
    if (isBusinessUser(profile)) return '/business-dashboard';
    if (profile && !canConsumerEnterApp(profile)) return '/complete-profile';
    return '/posts-feed';
}
