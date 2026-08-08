import { normalizeLookingFor } from '../constants/personalInviteCategories';

/** @param {unknown} raw */
export function normalizeOpenToDating(raw) {
    return raw === true;
}

/**
 * Whether this member's Connect card uses Like (dating) vs Follow (friendship).
 * Explicit `openToDating` wins; legacy profiles infer from `lookingFor`.
 */
export function isUserOpenToDating(user) {
    if (!user || typeof user !== 'object') return false;
    if (user.openToDating === true) return true;
    if (user.openToDating === false) return false;
    return normalizeLookingFor(user.lookingFor, { includeDating: true }).includes('dating');
}

/** Sync lookingFor with the dating openness switch on profile save. */
export function syncLookingForWithOpenToDating(lookingFor, openToDating) {
    const normalized = normalizeLookingFor(lookingFor, { includeDating: true });
    if (openToDating) {
        return normalized.includes('dating') ? normalized : [...normalized, 'dating'];
    }
    return normalized.filter((id) => id !== 'dating');
}
