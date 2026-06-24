/** In-memory-only dismissals for "Later" — must NOT persist across login/logout. */

const KEY_PREFIX = 'db:invitationInboxClosed:';

/** Remove legacy sessionStorage entries (old builds persisted "Later" too long). */
export function clearInboxClosedInvitationIds(uid) {
    if (!uid || typeof sessionStorage === 'undefined') return;
    try {
        sessionStorage.removeItem(`${KEY_PREFIX}${uid}`);
    } catch {
        /* ignore */
    }
}

/** @deprecated Legacy — do not read on mount; kept for one-time cleanup only. */
export function readInboxClosedInvitationIds(uid) {
    clearInboxClosedInvitationIds(uid);
    return new Set();
}

/** @deprecated Legacy — "Later" is in-memory only now. */
export function writeInboxClosedInvitationIds(_uid, _ids) {}

/** @deprecated Use in-component Set state instead. */
export function addInboxClosedInvitationId(_uid, invitationId, current) {
    const next = new Set(current);
    if (invitationId) next.add(invitationId);
    return next;
}
