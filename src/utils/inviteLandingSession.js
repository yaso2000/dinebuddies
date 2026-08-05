/** Session-scoped invite landing — survives SPA navigation, clears on logout / new browser tab session. */

const ELIGIBLE_PREFIX = 'db:inviteLandingEligible:';
const CONSUMED_PREFIX = 'db:inviteLandingConsumed:';

function key(prefix, uid) {
    return `${prefix}${uid}`;
}

export function isInviteLandingEligible(uid) {
    if (!uid || typeof sessionStorage === 'undefined') return false;
    try {
        const raw = sessionStorage.getItem(key(ELIGIBLE_PREFIX, uid));
        if (raw === null) return true;
        return raw === '1';
    } catch {
        return false;
    }
}

export function markInviteLandingIneligible(uid) {
    if (!uid || typeof sessionStorage === 'undefined') return;
    try {
        sessionStorage.setItem(key(ELIGIBLE_PREFIX, uid), '0');
    } catch {
        /* ignore */
    }
}

export function hasInviteLandingBeenConsumed(uid) {
    if (!uid || typeof sessionStorage === 'undefined') return true;
    try {
        return sessionStorage.getItem(key(CONSUMED_PREFIX, uid)) === '1';
    } catch {
        return true;
    }
}

export function markInviteLandingConsumed(uid) {
    if (!uid || typeof sessionStorage === 'undefined') return;
    try {
        sessionStorage.setItem(key(CONSUMED_PREFIX, uid), '1');
        sessionStorage.setItem(key(ELIGIBLE_PREFIX, uid), '0');
    } catch {
        /* ignore */
    }
}

export function clearInviteLandingSession(uid) {
    if (!uid || typeof sessionStorage === 'undefined') return;
    try {
        sessionStorage.removeItem(key(ELIGIBLE_PREFIX, uid));
        sessionStorage.removeItem(key(CONSUMED_PREFIX, uid));
    } catch {
        /* ignore */
    }
}
