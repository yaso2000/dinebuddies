/**
 * Default avatar + cover pools for regular consumer accounts.
 * — Avatars match gender (unspecified → female).
 * — Covers are never food/restaurant themed.
 * — Dating mode uses romantic / lifestyle covers instead of social scenes.
 */
import { isUserOpenToDating } from '../utils/openToDating';

const unsplash = (id, { w = 400, h = 400, fit = 'crop', crop } = {}) => {
    const params = new URLSearchParams({ w: String(w), h: String(h), fit });
    if (crop) params.set('crop', crop);
    return `https://images.unsplash.com/${id}?${params.toString()}`;
};

/** @type {Record<'male'|'female', string[]>} */
export const DEFAULT_PROFILE_AVATARS = {
    female: [
        unsplash('photo-1494790108377-be9c29b29330', { w: 400, h: 400, fit: 'crop', crop: 'faces' }),
        unsplash('photo-1580489944761-15a19d654956', { w: 400, h: 400, fit: 'crop', crop: 'faces' }),
        unsplash('photo-1438761681033-6461ffad8d80', { w: 400, h: 400, fit: 'crop', crop: 'faces' }),
        unsplash('photo-1544005313-94ddf0286df2', { w: 400, h: 400, fit: 'crop', crop: 'faces' }),
        unsplash('photo-1534528741775-53994a1da99b', { w: 400, h: 400, fit: 'crop', crop: 'faces' }),
        unsplash('photo-1573496359142-b8d87734a5a2', { w: 400, h: 400, fit: 'crop', crop: 'faces' }),
    ],
    male: [
        unsplash('photo-1507003211169-0a1dd7228f2d', { w: 400, h: 400, fit: 'crop', crop: 'faces' }),
        unsplash('photo-1535713875002-d1d0cf377fde', { w: 400, h: 400, fit: 'crop', crop: 'faces' }),
        unsplash('photo-1599566150163-29194dcaad36', { w: 400, h: 400, fit: 'crop', crop: 'faces' }),
        unsplash('photo-1633332755192-727a05c4013d', { w: 400, h: 400, fit: 'crop', crop: 'faces' }),
        unsplash('photo-1472099645785-5658abf4ff4e', { w: 400, h: 400, fit: 'crop', crop: 'faces' }),
        unsplash('photo-1560250097-0b93528c311a', { w: 400, h: 400, fit: 'crop', crop: 'faces' }),
    ],
};

/** Social / friendship — landscapes, city, nature (no food). */
export const DEFAULT_PROFILE_COVERS_SOCIAL = [
    unsplash('photo-1506905925346-21bda4d32df4', { w: 1200, h: 600, fit: 'crop' }),
    unsplash('photo-1449824913935-59a10b8d2000', { w: 1200, h: 600, fit: 'crop' }),
    unsplash('photo-1441974231531-c6227db76b6e', { w: 1200, h: 600, fit: 'crop' }),
    unsplash('photo-1507525428034-b723cf961d3e', { w: 1200, h: 600, fit: 'crop' }),
    unsplash('photo-1419242901234-f332fd302675', { w: 1200, h: 600, fit: 'crop' }),
    unsplash('photo-1464822759023-fed622ff2c3b', { w: 1200, h: 600, fit: 'crop' }),
];

/** Dating openness — romantic mood, evenings, soft landscapes (no food). */
export const DEFAULT_PROFILE_COVERS_DATING = [
    unsplash('photo-1518199264681-4ff0cfe069c4', { w: 1200, h: 600, fit: 'crop' }),
    unsplash('photo-1514525253161-7a46d19cd819', { w: 1200, h: 600, fit: 'crop' }),
    unsplash('photo-1492684223066-8137ee7bb2d7', { w: 1200, h: 600, fit: 'crop' }),
    unsplash('photo-1516589178551-44ed474174fb', { w: 1200, h: 600, fit: 'crop' }),
    unsplash('photo-1502680390779-177b92e8a32e', { w: 1200, h: 600, fit: 'crop' }),
    unsplash('photo-1529333166437-7750a6dd5a70', { w: 1200, h: 600, fit: 'crop' }),
];

const ALL_BUNDLED_AVATARS = new Set([
    ...DEFAULT_PROFILE_AVATARS.male,
    ...DEFAULT_PROFILE_AVATARS.female,
]);

const ALL_BUNDLED_COVERS = new Set([
    ...DEFAULT_PROFILE_COVERS_SOCIAL,
    ...DEFAULT_PROFILE_COVERS_DATING,
    // Legacy food cover — treat as replaceable default
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0',
]);

/** Stable pick from a list using uid/email seed. */
export function pickFromMediaPool(pool, seed = '') {
    if (!Array.isArray(pool) || pool.length === 0) return '';
    const key = String(seed || 'default');
    let hash = 0;
    for (let i = 0; i < key.length; i += 1) {
        hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
    }
    return pool[hash % pool.length];
}

/** @returns {'male'|'female'} — unspecified / non-binary → female avatar. */
export function defaultAvatarGenderKey(gender) {
    const g = String(gender || '').toLowerCase().trim();
    if (g === 'male' || g === 'm' || g === 'man') return 'male';
    return 'female';
}

export function pickDefaultProfileAvatar(user = {}) {
    const genderKey = defaultAvatarGenderKey(user.gender);
    const seed = user.uid || user.id || user.email || genderKey;
    return pickFromMediaPool(DEFAULT_PROFILE_AVATARS[genderKey], seed);
}

export function pickDefaultProfileCover(user = {}) {
    const dating = isUserOpenToDating(user);
    const pool = dating ? DEFAULT_PROFILE_COVERS_DATING : DEFAULT_PROFILE_COVERS_SOCIAL;
    const seed = `${user.uid || user.id || user.email || 'cover'}:${dating ? 'dating' : 'social'}`;
    return pickFromMediaPool(pool, seed);
}

export function isBundledDefaultProfileAvatar(url) {
    if (!url || typeof url !== 'string') return false;
    const base = url.trim().split('?')[0];
    for (const entry of ALL_BUNDLED_AVATARS) {
        if (base === entry.split('?')[0]) return true;
    }
    return false;
}

export function isBundledDefaultProfileCover(url) {
    if (!url || typeof url !== 'string') return false;
    const base = url.trim().split('?')[0];
    for (const entry of ALL_BUNDLED_COVERS) {
        if (base === entry.split('?')[0]) return true;
    }
    return false;
}

function isEmptyMediaUrl(url) {
    return !url || typeof url !== 'string' || url.trim().length < 12;
}

function isGeneratedPlaceholderAvatar(url) {
    if (!url || typeof url !== 'string') return true;
    if (url.startsWith('data:image/svg+xml')) return true;
    if (url.includes('ui-avatars.com')) return true;
    if (url.includes('dicebear')) return true;
    return false;
}

/**
 * Merge default avatar/cover into a profile patch when the user has not uploaded custom media.
 * @param {object} user — uid, gender, openToDating, photo_url, cover_photo, …
 * @returns {{ photo_url?: string, photoURL?: string, avatar?: string, avatarUrl?: string, cover_photo?: string }}
 */
export function buildDefaultProfileMediaPatch(user = {}) {
    const patch = {};
    const avatarCandidate =
        user.photo_url || user.photoURL || user.avatar || user.avatarUrl || '';
    const coverCandidate = user.cover_photo || user.coverPhotoUrl || '';

    const needsAvatar =
        isEmptyMediaUrl(avatarCandidate) ||
        isGeneratedPlaceholderAvatar(avatarCandidate);

    if (needsAvatar) {
        const avatar = pickDefaultProfileAvatar(user);
        if (avatar) {
            patch.photo_url = avatar;
            patch.photoURL = avatar;
            patch.avatar = avatar;
            patch.avatarUrl = avatar;
        }
    }

    const needsCover =
        isEmptyMediaUrl(coverCandidate) || isBundledDefaultProfileCover(coverCandidate);

    if (needsCover) {
        const cover = pickDefaultProfileCover(user);
        if (cover) {
            patch.cover_photo = cover;
        }
    }

    return patch;
}

/** Display fallback when Firestore has no cover yet. */
export function resolveDefaultProfileCover(user = {}) {
    return pickDefaultProfileCover(user);
}

/** First social cover — used as generic directory fallback. */
export const DEFAULT_PROFILE_COVER_FALLBACK = DEFAULT_PROFILE_COVERS_SOCIAL[0];
