import { resolveDefaultProfileCover } from '../constants/defaultProfileMedia';

/** Max portrait slots on dating profiles (9:16). */
export const PROFILE_GALLERY_MAX_SLOTS = 3;
/** CSS aspect-ratio value for gallery previews. */
export const PROFILE_GALLERY_ASPECT = '9 / 16';

const PROFILE_MEDIA_KEYS = {
    gallery: 'profileGallery',
    cover: 'cover_photo',
    coverAlt: 'coverPhotoUrl',
    coverIndex: 'directoryCoverIndex',
};

function hasOwnField(obj, key) {
    return Boolean(obj) && Object.prototype.hasOwnProperty.call(obj, key);
}

/** True when the patch intentionally includes profile media fields (including explicit clears). */
export function incomingTouchesProfileMedia(incoming) {
    if (!incoming || typeof incoming !== 'object') return false;
    return (
        hasOwnField(incoming, PROFILE_MEDIA_KEYS.gallery) ||
        hasOwnField(incoming, PROFILE_MEDIA_KEYS.cover) ||
        hasOwnField(incoming, PROFILE_MEDIA_KEYS.coverAlt) ||
        hasOwnField(incoming, PROFILE_MEDIA_KEYS.coverIndex)
    );
}

/**
 * Normalize stored gallery to exactly 3 slots (empty strings = empty slot).
 * @param {unknown} raw
 * @returns {string[]}
 */
export function normalizeProfileGallery(raw) {
    const slots = ['', '', ''];
    if (!Array.isArray(raw)) return slots;
    raw.slice(0, PROFILE_GALLERY_MAX_SLOTS).forEach((u, i) => {
        if (typeof u === 'string' && u.trim()) slots[i] = u.trim();
    });
    return slots;
}

/**
 * Firestore shape: fixed 3-slot array so `directoryCoverIndex` stays aligned after save/load.
 * @param {string[]} slots
 * @returns {string[]}
 */
export function profileGalleryToFirestore(slots) {
    return normalizeProfileGallery(slots);
}

/**
 * @param {string[]} slots
 * @param {unknown} coverIndex
 * @returns {{ profileGallery: string[], directoryCoverIndex: number }}
 */
export function buildProfileGallerySavePayload(slots, coverIndex) {
    const profileGallery = normalizeProfileGallery(slots);
    let directoryCoverIndex = normalizeDirectoryCoverIndex(coverIndex);
    if (profileGallery.some(Boolean) && !profileGallery[directoryCoverIndex]) {
        const firstFilled = profileGallery.findIndex(Boolean);
        directoryCoverIndex = firstFilled >= 0 ? firstFilled : 0;
    }
    return { profileGallery, directoryCoverIndex };
}

/**
 * Merge profile snapshots.
 * - Partial updates (e.g. privacySettings only) keep existing media.
 * - Explicit media fields in `incoming` win, including empty gallery / cleared cover.
 * @param {object | null | undefined} prev
 * @param {object | null | undefined} incoming
 */
export function mergeProfileSnapshot(prev, incoming) {
    if (!incoming) return prev ?? null;
    if (!prev) return incoming;

    const next = { ...prev, ...incoming };
    const touchesMedia = incomingTouchesProfileMedia(incoming);

    const prevGallery = normalizeProfileGallery(prev.profileGallery);
    const incomingGallery = normalizeProfileGallery(incoming.profileGallery);

    if (hasOwnField(incoming, PROFILE_MEDIA_KEYS.gallery)) {
        next.profileGallery = incomingGallery;
    } else if (!touchesMedia && !incomingGallery.some(Boolean) && prevGallery.some(Boolean)) {
        next.profileGallery = prevGallery;
    } else if (incomingGallery.some(Boolean)) {
        next.profileGallery = incomingGallery;
    }

    if (
        hasOwnField(incoming, PROFILE_MEDIA_KEYS.cover) ||
        hasOwnField(incoming, PROFILE_MEDIA_KEYS.coverAlt)
    ) {
        next.cover_photo =
            typeof incoming.cover_photo === 'string' ?
                incoming.cover_photo.trim() :
                typeof incoming.coverPhotoUrl === 'string' ?
                    incoming.coverPhotoUrl.trim() :
                    '';
    } else if (!touchesMedia && !resolveProfileCoverUrl(incoming) && resolveProfileCoverUrl(prev)) {
        next.cover_photo = prev.cover_photo;
    }

    if (hasOwnField(incoming, PROFILE_MEDIA_KEYS.coverIndex)) {
        next.directoryCoverIndex = normalizeDirectoryCoverIndex(incoming.directoryCoverIndex);
    } else if (!touchesMedia && incoming.directoryCoverIndex == null && prev.directoryCoverIndex != null) {
        next.directoryCoverIndex = prev.directoryCoverIndex;
    }

    // Preserve a previously-resolved avatar so an incoming snapshot with an empty
    // photo (Firestore doc without a stored photo) can't wipe the social avatar.
    for (const key of ['photoURL', 'photo_url', 'avatar', 'avatarUrl', 'avatar_url']) {
        const incomingVal = typeof incoming[key] === 'string' ? incoming[key].trim() : incoming[key];
        const prevVal = typeof prev[key] === 'string' ? prev[key].trim() : prev[key];
        if (!incomingVal && prevVal) {
            next[key] = prev[key];
        }
    }

    return next;
}

/**
 * @param {unknown} index
 * @param {number} [slotCount]
 * @returns {number}
 */
export function normalizeDirectoryCoverIndex(index, slotCount = PROFILE_GALLERY_MAX_SLOTS) {
    const n = Number(index);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(slotCount - 1, Math.floor(n)));
}

/**
 * Profile header banner + member directory card background (16:9 list view).
 * @param {object} user
 * @returns {string | null}
 */
export function resolveProfileCoverUrl(user = {}) {
    const cover = user.cover_photo || user.coverPhotoUrl;
    if (typeof cover === 'string' && cover.trim()) return cover.trim();
    return resolveDefaultProfileCover(user) || null;
}

/** Square / profile photo (avatar) — also the swipe discovery card background. */
export function resolveProfileAvatarUrl(user = {}) {
    const url =
        user.photo_url ||
        user.photoURL ||
        user.avatarUrl ||
        user.avatar ||
        '';
    return typeof url === 'string' && url.trim() ? url.trim() : null;
}

/**
 * Swipe discovery feed: profile photo only (`photo_url` / avatar).
 * @param {object} user
 * @returns {string | null}
 */
export function resolveSwipeProfilePhotoUrl(user = {}) {
    return resolveProfileAvatarUrl(user);
}

/**
 * Member directory card grid: profile cover banner (`cover_photo`).
 * @param {object} user
 * @returns {string | null}
 */
export function resolveDirectoryListCoverUrl(user = {}) {
    return resolveProfileCoverUrl(user);
}

/**
 * Extra portrait slots on the profile page (not used for Discover swipe or card grid).
 * @param {object} user
 * @returns {string | null}
 */
export function resolveDirectoryCoverUrl(user = {}) {
    const slots = normalizeProfileGallery(user.profileGallery);
    const idx = normalizeDirectoryCoverIndex(user.directoryCoverIndex ?? 0);
    const fromGallery = slots[idx] || slots.find(Boolean);
    return fromGallery || null;
}

/** @param {object | null | undefined} user */
export function hasProfileGallery(user) {
    return normalizeProfileGallery(user?.profileGallery).some(Boolean);
}

/** Read cover + gallery for UI / save coalescing. */
export function readProfileMedia(source = {}) {
    return {
        cover_photo: resolveProfileCoverUrl(source) || '',
        profileGallery: normalizeProfileGallery(source.profileGallery),
        directoryCoverIndex: normalizeDirectoryCoverIndex(source.directoryCoverIndex)
    };
}

/** First non-empty gallery among sources (preserves slot positions). */
export function coalesceProfileGallerySources(...sources) {
    for (const source of sources) {
        const slots = normalizeProfileGallery(source);
        if (slots.some(Boolean)) return slots;
    }
    return ['', '', ''];
}

/** First non-empty cover URL among sources. */
export function coalesceProfileCoverSources(...sources) {
    for (const source of sources) {
        const url = resolveProfileCoverUrl(
            typeof source === 'string' ? { cover_photo: source } : source
        );
        if (url) return url;
    }
    return '';
}

/**
 * Merge local profile media state with an incoming profile row.
 * Only overwrites cover/gallery when the incoming object explicitly carries those fields.
 */
export function mergeProfileMedia(prevMedia, incomingSource = {}) {
    const prev = readProfileMedia(prevMedia);
    const incoming = readProfileMedia(incomingSource);

    const hasGallery = hasOwnField(incomingSource, PROFILE_MEDIA_KEYS.gallery);
    const hasCover =
        hasOwnField(incomingSource, PROFILE_MEDIA_KEYS.cover) ||
        hasOwnField(incomingSource, PROFILE_MEDIA_KEYS.coverAlt);
    const hasCoverIndex = hasOwnField(incomingSource, PROFILE_MEDIA_KEYS.coverIndex);

    const profileGallery = hasGallery ?
        incoming.profileGallery :
        incoming.profileGallery.some(Boolean) ?
            incoming.profileGallery :
            prev.profileGallery;

    const directoryCoverIndex = hasCoverIndex ?
        incoming.directoryCoverIndex :
        hasGallery || incoming.profileGallery.some(Boolean) ?
            incoming.directoryCoverIndex :
            prev.directoryCoverIndex;

    return {
        cover_photo: hasCover ? incoming.cover_photo : incoming.cover_photo || prev.cover_photo,
        profileGallery,
        directoryCoverIndex
    };
}

/**
 * Build the in-memory profile row shown after save.
 * @param {object | null | undefined} prev
 * @param {object} payload
 * @param {object} [extras]
 */
export function buildProfileViewFromSave(prev, payload, extras = {}) {
    const hasGallery = hasOwnField(payload, PROFILE_MEDIA_KEYS.gallery);
    const hasCover = hasOwnField(payload, PROFILE_MEDIA_KEYS.cover);

    const galleryForView = hasGallery ?
        normalizeProfileGallery(payload.profileGallery) :
        normalizeProfileGallery(prev?.profileGallery);

    const coverPhoto = hasCover ?
        (typeof payload.cover_photo === 'string' ? payload.cover_photo.trim() : '') :
        resolveProfileCoverUrl(prev) || '';

    return mergeProfileSnapshot(prev, {
        ...prev,
        ...payload,
        ...extras,
        profileGallery: galleryForView,
        directoryCoverIndex: normalizeDirectoryCoverIndex(
            hasOwnField(payload, PROFILE_MEDIA_KEYS.coverIndex) ?
                payload.directoryCoverIndex :
                prev?.directoryCoverIndex ?? 0
        ),
        cover_photo: coverPhoto
    });
}

