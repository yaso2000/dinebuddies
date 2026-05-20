/** Session-only dismissals for pending invitation inbox (reappear on new browser session). */

const KEY_PREFIX = 'db:invitationInboxClosed:';

/** @param {string} uid */
export function readInboxClosedInvitationIds(uid) {
    if (!uid || typeof sessionStorage === 'undefined') return new Set();
    try {
        const raw = sessionStorage.getItem(`${KEY_PREFIX}${uid}`);
        if (!raw) return new Set();
        const parsed = JSON.parse(raw);
        return new Set(Array.isArray(parsed) ? parsed.filter(Boolean) : []);
    } catch {
        return new Set();
    }
}

/** @param {string} uid @param {Set<string>} ids */
export function writeInboxClosedInvitationIds(uid, ids) {
    if (!uid || typeof sessionStorage === 'undefined') return;
    try {
        sessionStorage.setItem(`${KEY_PREFIX}${uid}`, JSON.stringify([...ids]));
    } catch {
        /* ignore quota */
    }
}

/** @param {string} uid @param {string} invitationId @param {Set<string>} current */
export function addInboxClosedInvitationId(uid, invitationId, current) {
    const next = new Set(current);
    if (invitationId) next.add(invitationId);
    writeInboxClosedInvitationIds(uid, next);
    return next;
}
