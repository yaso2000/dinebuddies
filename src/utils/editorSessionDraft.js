/** Max image payload stored in browser draft storage (~2.5 MB). */
const MAX_DATA_URL_BYTES = 2.5 * 1024 * 1024;
const STORAGE_PREFIX = 'dineb_editor_draft:';
/** Private invitation editor drafts survive tab close (localStorage). */
const PRIVATE_INVITE_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function canUseWebStorage() {
    return typeof window !== 'undefined';
}

/** @param {string} key */
function draftStorageForKey(key) {
    if (!canUseWebStorage() || !key) return null;
    if (key.includes('private-invite:') && typeof localStorage !== 'undefined') {
        return localStorage;
    }
    if (typeof sessionStorage !== 'undefined') return sessionStorage;
    return null;
}

/** @param {string} key */
export function readEditorSessionDraft(key) {
    const storage = draftStorageForKey(key);
    if (!storage || !key) return null;
    try {
        const raw = storage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        if (key.includes('private-invite:')) {
            const updatedAt = typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0;
            if (updatedAt && Date.now() - updatedAt > PRIVATE_INVITE_DRAFT_TTL_MS) {
                storage.removeItem(key);
                return null;
            }
        }
        return parsed;
    } catch {
        return null;
    }
}

/** @param {string} key @param {object} payload */
export function writeEditorSessionDraft(key, payload) {
    const storage = draftStorageForKey(key);
    if (!storage || !key || !payload) return;
    try {
        storage.setItem(
            key,
            JSON.stringify({
                ...payload,
                updatedAt: Date.now(),
            })
        );
    } catch {
        /* quota or private mode */
    }
}

/** @param {string} key */
export function clearEditorSessionDraft(key) {
    const storage = draftStorageForKey(key);
    if (!storage || !key) return;
    try {
        storage.removeItem(key);
    } catch {
        /* ignore */
    }
}

/** @param {string} uid @param {string | null | undefined} editId */
export function motionStudioDraftKey(uid, editId = null) {
    const base = `${STORAGE_PREFIX}motion:${uid}`;
    return editId ? `${base}:edit:${editId}` : base;
}

/** @param {string} uid @param {string | null | undefined} editId */
export function featuredPostDraftKey(uid, editId = null) {
    const base = `${STORAGE_PREFIX}featured:${uid}`;
    return editId ? `${base}:edit:${editId}` : base;
}

/** @param {string} uid */
export function inlinePostDraftKey(uid) {
    return `${STORAGE_PREFIX}inline-post:${uid}`;
}

/** @param {string} uid @param {'private' | 'dating'} kind @param {string | null | undefined} editId */
export function privateInvitationEditorDraftKey(uid, kind, editId = null) {
    const base = `${STORAGE_PREFIX}private-invite:${kind}:${uid}`;
    return editId ? `${base}:edit:${editId}` : base;
}

/** @param {object | null | undefined} draft */
export function isPrivateInvitationEditorDraftEmpty(draft) {
    if (!draft) return true;
    if (draft.existingDraftId) return false;

    const fd = draft.formData && typeof draft.formData === 'object' ? draft.formData : {};
    const hasText = Boolean(
        String(fd.title || '').trim() ||
            String(fd.description || '').trim() ||
            String(fd.location || '').trim() ||
            fd.date ||
            fd.time
    );
    const hasMedia = Boolean(draft.media?.remoteUrl || draft.media?.dataUrl);
    const hasStash = Array.isArray(draft.coverMediaStash) && draft.coverMediaStash.some((e) => e?.media);
    const hasCardState = Boolean(draft.cardBackgroundId || draft.cardGradientId);

    return !hasText && !hasMedia && !hasStash && !hasCardState;
}

/** @param {object | null | undefined} state */
export function hasPrivateInvitationEditorWork(state) {
    return !isPrivateInvitationEditorDraftEmpty({
        existingDraftId: state?.existingDraftId,
        formData: state?.formData,
        media: state?.mediaData,
        coverMediaStash: state?.coverMediaStash,
        cardBackgroundId: state?.cardBackgroundId,
        cardGradientId: state?.cardGradientId,
    });
}

/**
 * @param {{ id?: string, kind?: string, media?: unknown }[]} stash
 * @param {(media: unknown) => Promise<unknown>} serializeMedia
 */
export async function serializeCoverMediaStash(stash, serializeMedia) {
    if (!Array.isArray(stash) || !stash.length) return [];
    const out = [];
    for (const entry of stash) {
        const media = await serializeMedia(entry?.media);
        if (!media) continue;
        out.push({
            id: entry?.id || null,
            kind: entry?.kind || null,
            media,
        });
    }
    return out;
}

/**
 * @param {unknown} stashDraft
 * @param {(media: unknown) => Promise<unknown>} restoreMedia
 */
export async function restoreCoverMediaStash(stashDraft, restoreMedia) {
    if (!Array.isArray(stashDraft)) return [];
    const out = [];
    for (const entry of stashDraft) {
        const media = await restoreMedia(entry?.media);
        if (!media || !entry?.id) continue;
        out.push({
            id: entry.id,
            kind: entry.kind || 'upload',
            media,
        });
    }
    return out;
}

/** @param {File | null | undefined} file */
export function fileToDataUrlIfSmall(file) {
    if (!file || file.size > MAX_DATA_URL_BYTES) {
        return Promise.resolve(null);
    }
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () =>
            resolve(typeof reader.result === 'string' ? reader.result : null);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
    });
}

/** Sync snapshot for pagehide / back navigation (no FileReader). */
export function syncSerializeEditorMedia(media) {
    if (!media) return null;

    const remoteUrl =
        (typeof media.url === 'string' && media.url.startsWith('http') ? media.url : null) ||
        (typeof media.preview === 'string' && media.preview.startsWith('http') ? media.preview : null) ||
        (typeof media.publishedUrl === 'string' && media.publishedUrl.startsWith('http')
            ? media.publishedUrl
            : null);

    const dataUrl =
        typeof media.preview === 'string' && media.preview.startsWith('data:') ? media.preview : null;

    if (!remoteUrl && !dataUrl) return null;

    return {
        remoteUrl,
        dataUrl,
        fileName: media.file?.name || null,
        mediaType: media.type || 'image',
    };
}

/**
 * @param {{ file?: File; preview?: string; url?: string } | null | undefined} media
 * @param {(media: { file?: File; preview?: string; url?: string } | null | undefined) => string | null | undefined} [pickRemoteUrl]
 */
export async function serializeEditorMedia(media, pickRemoteUrl) {
    if (!media) return null;

    const remoteFromPicker = pickRemoteUrl ? pickRemoteUrl(media) : null;
    const remoteUrl =
        (typeof remoteFromPicker === 'string' && remoteFromPicker.startsWith('http')
            ? remoteFromPicker
            : null) ||
        (typeof media.url === 'string' && media.url.startsWith('http') ? media.url : null) ||
        (typeof media.preview === 'string' && media.preview.startsWith('http')
            ? media.preview
            : null);

    let dataUrl = null;
    if (media.file) {
        dataUrl = await fileToDataUrlIfSmall(media.file);
    } else if (typeof media.preview === 'string' && media.preview.startsWith('data:')) {
        dataUrl = media.preview;
    }

    if (!remoteUrl && !dataUrl) return null;

    return {
        remoteUrl,
        dataUrl,
        fileName: media.file?.name || null,
        mediaType: media.type || 'image',
    };
}

/** @param {{ remoteUrl?: string | null; dataUrl?: string | null; fileName?: string | null; mediaType?: string } | null | undefined} draftMedia */
export async function restoreEditorMedia(draftMedia) {
    if (!draftMedia) return null;

    const preview = draftMedia.dataUrl || draftMedia.remoteUrl || '';
    if (!preview) return null;

    if (draftMedia.dataUrl) {
        try {
            const res = await fetch(draftMedia.dataUrl);
            const blob = await res.blob();
            const file = new File(
                [blob],
                draftMedia.fileName || 'draft-image.jpg',
                { type: blob.type || 'image/jpeg' }
            );
            return {
                file,
                preview: draftMedia.dataUrl,
                url: draftMedia.remoteUrl || undefined,
                type: draftMedia.mediaType || 'image',
            };
        } catch {
            if (draftMedia.remoteUrl) {
                return {
                    preview: draftMedia.remoteUrl,
                    url: draftMedia.remoteUrl,
                    type: draftMedia.mediaType || 'image',
                };
            }
            return null;
        }
    }

    return {
        preview: draftMedia.remoteUrl,
        url: draftMedia.remoteUrl,
        type: draftMedia.mediaType || 'image',
    };
}

/** @param {object | null | undefined} draft */
export function isMotionStudioDraftEmpty(draft) {
    if (!draft) return true;
    const hasText = Boolean(
        String(draft.title || '').trim() || String(draft.body || '').trim()
    );
    const hasMedia = Boolean(draft.media?.remoteUrl || draft.media?.dataUrl);
    const hasPromos = Array.isArray(draft.promoStickers) && draft.promoStickers.length > 0;
    const hasLayout = draft.layoutModel && draft.layoutModel !== 'square';
    return !hasText && !hasMedia && !hasPromos && !hasLayout && !draft.coverHidden;
}

/** @param {object | null | undefined} draft */
export function isFeaturedPostDraftEmpty(draft) {
    if (!draft) return true;
    return (
        !String(draft.title || '').trim() &&
        !String(draft.description || '').trim() &&
        !draft.bgImageUrl
    );
}

/** @param {object | null | undefined} draft */
export function isInlinePostDraftEmpty(draft) {
    if (!draft) return true;
    return (
        !String(draft.title || '').trim() &&
        !String(draft.text || '').trim() &&
        !draft.media?.remoteUrl &&
        !draft.media?.dataUrl &&
        !draft.embedData
    );
}
