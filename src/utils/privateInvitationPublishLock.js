/** Cross-instance in-flight dedup + client cooldown for publishPrivateInvitationDraft. */

const inFlightByInvitationId = new Map();

const rateLimitedUntilByInvitationId = new Map();

const RATE_LIMIT_STORAGE_PREFIX = 'db_publish_rl_';

function readStoredRateLimitUntil(invitationId) {
    if (typeof sessionStorage === 'undefined' || !invitationId) return 0;
    try {
        const raw = sessionStorage.getItem(`${RATE_LIMIT_STORAGE_PREFIX}${invitationId}`);
        const until = Number(raw || 0);
        return Number.isFinite(until) ? until : 0;
    } catch {
        return 0;
    }
}

function writeStoredRateLimitUntil(invitationId, untilMs) {
    if (typeof sessionStorage === 'undefined' || !invitationId) return;
    try {
        if (untilMs > Date.now()) {
            sessionStorage.setItem(`${RATE_LIMIT_STORAGE_PREFIX}${invitationId}`, String(untilMs));
        } else {
            sessionStorage.removeItem(`${RATE_LIMIT_STORAGE_PREFIX}${invitationId}`);
        }
    } catch {
        /* ignore */
    }
}

export function getPrivateInvitationPublishRateLimitedUntil(invitationId) {
    if (!invitationId) return 0;
    const memory = rateLimitedUntilByInvitationId.get(invitationId) || 0;
    const stored = readStoredRateLimitUntil(invitationId);
    const until = Math.max(memory, stored);
    rateLimitedUntilByInvitationId.set(invitationId, until);
    return until;
}

export function markPrivateInvitationPublishRateLimited(invitationId, cooldownMs = 60_000) {
    if (!invitationId) return;
    const until = Date.now() + cooldownMs;
    rateLimitedUntilByInvitationId.set(invitationId, until);
    writeStoredRateLimitUntil(invitationId, until);
}

export function clearPrivateInvitationPublishRateLimit(invitationId) {
    if (!invitationId) return;
    rateLimitedUntilByInvitationId.delete(invitationId);
    writeStoredRateLimitUntil(invitationId, 0);
}

/**
 * Ensures at most one publishPrivateInvitationDraft request per invitationId app-wide.
 * @template T
 * @param {string} invitationId
 * @param {() => Promise<T>} invoke
 * @returns {Promise<T>}
 */
export function runPrivateInvitationPublishOnce(invitationId, invoke) {
    if (!invitationId) {
        return invoke();
    }

    const existing = inFlightByInvitationId.get(invitationId);
    if (existing) {
        return existing;
    }

    const task = (async () => {
        try {
            return await invoke();
        } finally {
            inFlightByInvitationId.delete(invitationId);
        }
    })();

    inFlightByInvitationId.set(invitationId, task);
    return task;
}
