/** @typedef {'upload' | 'camera'} PrivateCoverStashKind */

/**
 * @typedef {object} PrivateCoverStashEntry
 * @property {string} id
 * @property {PrivateCoverStashKind} kind
 * @property {object} media
 */

export const PRIVATE_COVER_STASH_MAX_IMAGES = 5;
export const PRIVATE_COVER_STASH_MAX_VIDEOS = 3;

export function createPrivateCoverStashId() {
    return `cover-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** @param {PrivateCoverStashEntry[]} stash @param {PrivateCoverStashKind} kind */
export function countCoverStashByKind(stash, kind) {
    if (!Array.isArray(stash)) return 0;
    return stash.filter((e) => e.kind === kind).length;
}

/** @param {PrivateCoverStashEntry[]} stash @param {PrivateCoverStashKind} kind */
export function isCoverStashKindAtLimit(stash, kind) {
    const max = kind === 'upload' ? PRIVATE_COVER_STASH_MAX_IMAGES : PRIVATE_COVER_STASH_MAX_VIDEOS;
    return countCoverStashByKind(stash, kind) >= max;
}

function revokeBlobUrl(url) {
    if (url && String(url).startsWith('blob:')) {
        try {
            URL.revokeObjectURL(url);
        } catch {
            /* ignore */
        }
    }
}

/** Revoke blob previews on a single media draft. */
export function revokePrivateCoverMedia(media) {
    if (!media) return;
    revokeBlobUrl(media.preview);
    revokeBlobUrl(media.videoThumbnail);
}

/** @param {PrivateCoverStashEntry} entry */
export function revokePrivateCoverStashEntry(entry) {
    if (!entry) return;
    revokePrivateCoverMedia(entry.media);
}

/** @param {PrivateCoverStashEntry[]} stash */
export function revokeAllPrivateCoverStash(stash) {
    if (!Array.isArray(stash)) return;
    stash.forEach(revokePrivateCoverStashEntry);
}

/** @param {PrivateCoverStashEntry[]} stash @param {string} [keepId] */
export function revokePrivateCoverStashExcept(stash, keepId) {
    if (!Array.isArray(stash)) return;
    stash.forEach((entry) => {
        if (keepId && entry.id === keepId) return;
        revokePrivateCoverStashEntry(entry);
    });
}

export function isSamePrivateCoverMedia(a, b) {
    if (!a || !b) return false;
    if (a.preview && b.preview && a.preview === b.preview) return true;
    if (a.url && b.url && a.url === b.url) return true;
    return false;
}
