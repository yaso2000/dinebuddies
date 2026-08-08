import { sanitizeNextPath } from './safeInternalPath';
import { resolveSignedInHomePath } from './accountKind';

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
    return resolveSignedInHomePath(currentUser, profile, { next });
}
