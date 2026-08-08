/** @typedef {import('../constants/aiDesignStudioCategories').AiDesignStudioCategoryId} AiDesignStudioCategoryId */

/**
 * @typedef {object} AiDesignStudioStashEntry
 * @property {string} id
 * @property {string} imageUrl
 * @property {AiDesignStudioCategoryId} categoryId
 * @property {'1:1' | '9:16' | '16:9'} aspectRatio
 * @property {string} userPrompt
 * @property {string} [optimizedPrompt]
 * @property {number} createdAt
 */

export const AI_DESIGN_STUDIO_STASH_MAX = 5;

const STORAGE_PREFIX = 'ai-design-studio-stash:';

/** @param {string | undefined | null} userId */
function storageKey(userId) {
    return `${STORAGE_PREFIX}${userId || 'guest'}`;
}

export function createAiDesignStudioStashId() {
    return `studio-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * @param {string | undefined | null} userId
 * @returns {AiDesignStudioStashEntry[]}
 */
export function readAiDesignStudioStash(userId) {
    if (typeof window === 'undefined' || !userId) return [];
    try {
        const raw = sessionStorage.getItem(storageKey(userId));
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(
            (entry) =>
                entry &&
                typeof entry.id === 'string' &&
                typeof entry.imageUrl === 'string' &&
                entry.imageUrl.startsWith('http')
        );
    } catch {
        return [];
    }
}

/**
 * @param {string | undefined | null} userId
 * @param {AiDesignStudioStashEntry[]} stash
 */
export function writeAiDesignStudioStash(userId, stash) {
    if (typeof window === 'undefined' || !userId) return;
    try {
        sessionStorage.setItem(storageKey(userId), JSON.stringify(stash.slice(0, AI_DESIGN_STUDIO_STASH_MAX)));
    } catch {
        /* quota or private mode */
    }
}

/**
 * Prepend entry; dedupe by imageUrl; keep newest AI_DESIGN_STUDIO_STASH_MAX items.
 * @param {AiDesignStudioStashEntry[]} stash
 * @param {AiDesignStudioStashEntry} entry
 * @returns {{ stash: AiDesignStudioStashEntry[], evictedOldest: boolean }}
 */
export function pushAiDesignStudioStash(stash, entry) {
    const atLimit = stash.length >= AI_DESIGN_STUDIO_STASH_MAX;
    const withoutDup = (Array.isArray(stash) ? stash : []).filter((e) => e.imageUrl !== entry.imageUrl);
    const next = [entry, ...withoutDup].slice(0, AI_DESIGN_STUDIO_STASH_MAX);
    const evictedOldest = atLimit && !stash.some((e) => e.imageUrl === entry.imageUrl);
    return { stash: next, evictedOldest };
}

/** @param {AiDesignStudioStashEntry[]} stash @param {string} entryId */
export function removeAiDesignStudioStashEntry(stash, entryId) {
    if (!Array.isArray(stash)) return [];
    return stash.filter((e) => e.id !== entryId);
}
