import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { normalizeProfileGallery } from './profileGallery';
import { mapPublicProfileDocToUserShape } from './publicProfileMap';
import { upsizeProviderPhotoUrl } from './providerPhotoSize';

/**
 * Google Places image URLs (JS PhotoService, REST /place/photo, etc.) are not persisted app media.
 * Do not use as gallery/cover img src — use Firebase Storage + Firestore instead.
 */
export function isGooglePlaceImageUrl(url) {    if (!url || typeof url !== 'string') return false;
    if (/maps\.googleapis\.com\/maps\/api\/place\/photo\b/i.test(url)) return true;
    return /PhotoService\.GetPhoto|maps\.googleapis\.com.*PhotoService|place\/js.*PhotoService/i.test(url);
}

/**
 * Legacy server proxy URLs (Firebase `placePhoto` / Vercel `api/place-photo`) are disabled (410).
 * Stored gallery/cover entries must not keep these as img src.
 */
export function isPlacePhotoProxyUrl(url) {
    if (!url || typeof url !== 'string') return false;
    const u = url.trim();
    return u.includes('/api/place-photo') || u.includes('/__dev/place-photo');
}

/**
 * Google *account* profile photos live on the same CDN as Places photos
 * (lh3.googleusercontent.com) but use stable `/a/` or `/a-/` avatar paths.
 * These are the photos returned by Google/Firebase sign-in and are safe to render.
 */
export function isGoogleAccountPhotoUrl(url) {
    if (!url || typeof url !== 'string') return false;
    return /^https?:\/\/lh\d+\.googleusercontent\.com\/a[-/]/i.test(url.trim());
}

/** Facebook / Meta account profile photos from OAuth. */
export function isFacebookAccountPhotoUrl(url) {
    if (!url || typeof url !== 'string') return false;
    const u = url.trim();
    return (
        /(?:^https?:\/\/)?(?:graph|scontent)[^/]*\.facebook\.com\//i.test(u) ||
        /(?:^https?:\/\/)?[^/]*fbcdn\.net\//i.test(u) ||
        /platform-lookaside\.fbsbx\.com\//i.test(u)
    );
}

/**
 * Google or Facebook OAuth provider account photo (priority tier 2).
 * Apple usually has no photoURL.
 */
export function isProviderAccountPhotoUrl(url) {
    return isGoogleAccountPhotoUrl(url) || isFacebookAccountPhotoUrl(url);
}

/**
 * Photo the user uploaded into our Storage (priority tier 1).
 * Final moderated URLs live under Firebase Storage — never treat OAuth CDNs as uploads.
 */
export function isUserUploadedPhotoUrl(url) {
    if (!url || typeof url !== 'string') return false;
    const u = url.trim();
    if (isProviderAccountPhotoUrl(u) || isGeneratedAvatarUrl(u) || isStockDefaultAvatarUrl(u)) {
        return false;
    }
    if (/firebasestorage\.googleapis\.com/i.test(u)) return true;
    if (/firebasestorage\.app/i.test(u)) return true;
    if (/\.appspot\.com\/o\//i.test(u)) return true;
    if (/\/v0\/b\/[^/]+\/o\//i.test(u)) return true;
    return false;
}

/** Stock Unsplash defaults we used to persist — not a real user/OAuth photo. */
export function isStockDefaultAvatarUrl(url) {
    if (!url || typeof url !== 'string') return false;
    return /images\.unsplash\.com\//i.test(url.trim());
}

/**
 * Avatar display priority (exact):
 * 1) user-uploaded Storage photo
 * 2) Google / Facebook OAuth photo
 * 3) none → caller shows letter/initial
 *
 * @param {Record<string, unknown> | null | undefined} userData
 * @param {{ authPhotoUrl?: string | null }} [opts]
 * @returns {string | null}
 */
export function pickPreferredAvatarUrl(userData, opts = {}) {
    if (!userData && !opts?.authPhotoUrl) return null;

    const raw = [
        userData?.avatarUrl,
        userData?.avatar,
        userData?.avatar_url,
        userData?.photoURL,
        userData?.photo_url,
        userData?.swipePhotoUrl,
        firstProfileGalleryAvatarUrl(userData),
        userData?.userPhoto,
        userData?.profilePicture,
        opts?.authPhotoUrl,
    ];

    const usable = [];
    for (const url of raw) {
        if (!url || typeof url !== 'string' || url.length < 10) continue;
        if (!(url.startsWith('http') || url.startsWith('data:image'))) continue;
        if (isInvalidDirectImageUrl(url) && !isProviderAccountPhotoUrl(url)) continue;
        if (isGeneratedAvatarUrl(url) || isStockDefaultAvatarUrl(url)) continue;
        usable.push(url.trim());
    }

    const uploaded = usable.find((u) => isUserUploadedPhotoUrl(u));
    if (uploaded) return uploaded;

    const authPhoto = String(opts?.authPhotoUrl || '').trim();
    if (authPhoto && isProviderAccountPhotoUrl(authPhoto) && !isInvalidDirectImageUrl(authPhoto)) {
        return upsizeProviderPhotoUrl(authPhoto);
    }

    const provider = usable.find((u) => isProviderAccountPhotoUrl(u));
    if (provider) return upsizeProviderPhotoUrl(provider);

    return null;
}

/**
 * Fields to persist when the user sets a profile photo.
 * Keep every alias in sync so public profile + UI pickers stay consistent.
 * @param {string} url
 * @returns {{ avatar: string, avatarUrl: string, photo_url: string, photoURL: string } | null}
 */
export function buildAvatarPersistFields(url) {
    const u = String(url || '').trim();
    if (!u || u.length < 10) return null;
    if (!(u.startsWith('http') || u.startsWith('data:image'))) return null;
    return {
        avatar: u,
        avatarUrl: u,
        photo_url: u,
        photoURL: u,
    };
}

/**
 * Whether OAuth may write photo fields onto an existing users/{uid} doc.
 * Never overwrites a manually uploaded Storage photo.
 * @returns {{ photo_url: string, photoURL: string, avatar: string } | null}
 */
export function resolveOAuthPhotoUpdate(existingData, authPhotoUrl) {
    const next = String(authPhotoUrl || '').trim();
    if (!next || !isProviderAccountPhotoUrl(next)) return null;

    const current =
        String(
            existingData?.photo_url ||
                existingData?.photoURL ||
                existingData?.avatar ||
                existingData?.avatarUrl ||
                ''
        ).trim();

    if (current && isUserUploadedPhotoUrl(current)) return null;

    if (
        !current ||
        isGeneratedAvatarUrl(current) ||
        isStockDefaultAvatarUrl(current) ||
        isProviderAccountPhotoUrl(current) ||
        current.length < 10
    ) {
        return { photo_url: next, photoURL: next, avatar: next };
    }

    return null;
}

/** Ephemeral Google CDN URLs (Places photoUri) — do not persist or render. Account avatars are allowed. */
export function isEphemeralGoogleCdnUrl(url) {
    if (!url || typeof url !== 'string') return false;
    const u = url.trim();
    // Google/Firebase account avatars are stable — never treat them as ephemeral place media.
    if (isGoogleAccountPhotoUrl(u)) return false;
    if (/^https?:\/\/lh\d+\.googleusercontent\.com\//i.test(u)) return true;
    if (/^https?:\/\/places\.googleapis\.com\//i.test(u)) return true;
    return false;
}

/** True for Google Place CDNs and disabled place-photo proxies — do not render or persist as media URLs. */
export function shouldBlockDirectImageLoad(url) {
    if (!url || typeof url !== 'string') return true;
    if (isGooglePlaceImageUrl(url)) return true;
    if (isEphemeralGoogleCdnUrl(url)) return true;
    if (isPlacePhotoProxyUrl(url)) return true;
    return false;
}

const isInvalidDirectImageUrl = (url) => {
    if (!url || typeof url !== 'string') return true;
    return shouldBlockDirectImageLoad(url);
};

/**
 * Safe cover/header image URL for business profiles.
 * Rejects Maps JS PhotoService URLs and disabled /api/place-photo proxies.
 */
export const getSafeCoverImage = (url) => {
    if (!url || typeof url !== 'string') return null;
    if (isInvalidDirectImageUrl(url)) return null;
    if (url.startsWith('http') || url.startsWith('data:image')) return url;
    return null;
};

/** First usable URL from candidates (skips PhotoService / invalid). */
export const pickSafeDisplayImageUrl = (...candidates) => {
    for (const c of candidates) {
        const v = getSafeCoverImage(c);
        if (v) return v;
    }
    return null;
};

/**
 * URL that can be loaded in canvas (e.g. for share card).
 * Returns null for Google PhotoService URLs (they often 403 when fetched by proxy).
 * Use fallback when this returns null.
 */
export const getShareableCoverImage = (url) => {
    if (!url || typeof url !== 'string') return null;
    if (isInvalidDirectImageUrl(url)) return null;
    if (url.startsWith('http') || url.startsWith('data:') || url.startsWith('/')) return url;
    return null;
};

/** Gender ring colors — blue (male), pink (female), purple (unspecified). */
export const GENDER_AVATAR_RING = {
    male: 'var(--avatar-ring-male, #3b82f6)',
    female: 'var(--avatar-ring-female, #ec4899)',
    unspecified: 'var(--avatar-ring-unspecified, #a855f7)',
};

export function isBusinessAvatarUser(user) {
    if (!user) return false;
    return (
        user.role === 'business' ||
        user.isBusiness === true ||
        user.partnerId ||
        user.businessName ||
        user.partnerName ||
        user.type === 'elite_slide' ||
        user.businessLogoUrl
    );
}

/**
 * Normalize gender from profile / comment / notification payloads.
 * @returns {'male'|'female'|'unspecified'}
 */
export function normalizeUserGender(user) {
    if (!user || isBusinessAvatarUser(user)) return 'unspecified';
    const raw = user.gender ?? user.userGender ?? user.fromUserGender ?? '';
    const g = String(raw).toLowerCase().trim();
    if (g === 'male' || g === 'm' || g === 'man') return 'male';
    if (g === 'female' || g === 'f' || g === 'woman') return 'female';
    return 'unspecified';
}

/** First usable portrait from profile gallery slots. */
export function firstProfileGalleryAvatarUrl(userData) {
    if (!userData) return null;
    for (const slot of normalizeProfileGallery(userData.profileGallery)) {
        if (slot && !shouldBlockDirectImageLoad(slot)) return slot;
    }
    return null;
}

/**
 * Returns a persisted avatar URL when one exists, otherwise null (no generated fallback).
 * Consumer priority: user upload → Google/Facebook OAuth → null (caller uses letter/initial).
 * @param {Record<string, unknown> | null | undefined} userData
 * @param {{ authPhotoUrl?: string | null }} [opts]
 */
export function getAvatarUrlOrNull(userData, opts = {}) {
    if (userData && isBusinessAvatarUser(userData)) {
        const businessCandidates = [
            userData.avatarUrl,
            userData.avatar,
            userData.photoURL,
            userData.photo_url,
            userData.logo,
            userData.logoImage,
            userData.businessLogoUrl,
            userData.businessInfo?.logo,
            userData.businessInfo?.logoImage,
            userData.partnerLogo,
        ];
        for (const url of businessCandidates) {
            if (url && typeof url === 'string' && url.length > 10) {
                if ((url.startsWith('http') || url.startsWith('data:image')) && !isInvalidDirectImageUrl(url)) {
                    return url;
                }
            }
        }
    }
    return pickPreferredAvatarUrl(userData, opts);
}

/** Normalize all common avatar field aliases from the best available URL. */
export function enrichUserWithAvatarFields(user = {}) {
    if (!user || typeof user !== 'object') return user;
    const url = getAvatarUrlOrNull(user);
    if (!url) return user;
    return {
        ...user,
        photo_url: user.photo_url || url,
        photoURL: user.photoURL || url,
        avatar: user.avatar || url,
        avatarUrl: user.avatarUrl || url,
        avatar_url: user.avatar_url || url,
    };
}

/**
 * Fetch users / public_profiles for rows missing a portrait URL.
 * @param {Array<Record<string, unknown>>} users
 */
export async function hydrateUsersAvatarFields(users = []) {
    if (!Array.isArray(users) || users.length === 0) return [];

    const enriched = users.map((user) => enrichUserWithAvatarFields(user));
    const needIds = [
        ...new Set(
            enriched
                .filter((user) => user?.id && !getAvatarUrlOrNull(user))
                .map((user) => String(user.id))
        ),
    ];
    if (!needIds.length) return enriched;

    const hydratedById = new Map();
    await Promise.all(
        needIds.map(async (uid) => {
            try {
                const [userSnap, pubSnap] = await Promise.all([
                    getDoc(doc(db, 'users', uid)),
                    getDoc(doc(db, 'public_profiles', uid)),
                ]);
                const merged = { id: uid };
                if (pubSnap.exists()) {
                    Object.assign(
                        merged,
                        mapPublicProfileDocToUserShape({ ...pubSnap.data(), uid })
                    );
                }
                if (userSnap.exists()) {
                    Object.assign(merged, userSnap.data());
                }
                if (Object.keys(merged).length > 1) {
                    hydratedById.set(uid, enrichUserWithAvatarFields(merged));
                }
            } catch (err) {
                console.warn('[hydrateUsersAvatarFields]', uid, err);
            }
        })
    );

    return enriched.map((user) => {
        const extra = hydratedById.get(String(user.id));
        if (!extra) return user;
        return enrichUserWithAvatarFields({ ...extra, ...user });
    });
}

/**
 * Unified avatar URL: uploaded → OAuth → letter/initial.
 * Does not use Unsplash stock photos as the profile avatar.
 */
export const getSafeAvatar = (userData) => {
    if (!userData) return getDefaultAvatar();

    const picked = getAvatarUrlOrNull(userData);
    if (picked) return picked;

    const fallbackName =
        userData.display_name || userData.displayName || userData.nickname || userData.name || '';

    return getDefaultAvatar(fallbackName);
};

export function isUiAvatarsUrl(url) {
    return typeof url === 'string' && url.includes('ui-avatars.com');
}

export function isGeneratedAvatarUrl(url) {
    if (!url || typeof url !== 'string') return true;
    if (url.startsWith('data:image/svg+xml')) return true;
    if (isUiAvatarsUrl(url)) return true;
    if (url.includes('dicebear')) return true;
    return false;
}

/**
 * Pick the best author avatar for feed cards: live profile → fetched user → post snapshot.
 * Skips generated initials when a persisted photo exists on the post snapshot.
 */
export function resolveFeedAuthorAvatar(post, userData, userProfile, authorId, currentUserUid) {
    const snapshotAvatar = getSafeAvatar(post?.author || post);
    const liveAvatar =
        currentUserUid && authorId && currentUserUid === authorId && userProfile
            ? getSafeAvatar(userProfile)
            : null;
    const fetchedAvatar = userData ? getSafeAvatar(userData) : null;

    for (const candidate of [liveAvatar, fetchedAvatar, snapshotAvatar]) {
        if (candidate && !isGeneratedAvatarUrl(candidate)) return candidate;
    }

    const fallbackName =
        post?.author?.name ||
        post?.displayName ||
        post?.userName ||
        userData?.displayName ||
        userData?.display_name ||
        'User';

    return snapshotAvatar || fetchedAvatar || liveAvatar || getDefaultAvatar(fallbackName);
}

/** Inline SVG avatar — no external fetch, safe for html2canvas / CORS. */
export function buildInitialsAvatarDataUri(name = '', { size = 150, background = '7c3aed' } = {}) {
    const label = String(name || 'U').trim();
    const initials =
        label
            .split(/\s+/)
            .map((part) => part[0])
            .filter(Boolean)
            .join('')
            .toUpperCase()
            .slice(0, 2) || 'U';
    const bg = String(background).replace('#', '');
    const fontSize = Math.round(size * 0.37);
    const safeInitials = initials.replace(/[<>&"']/g, '');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect fill="#${bg}" width="${size}" height="${size}"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial,sans-serif" font-size="${fontSize}" font-weight="700" fill="#fff">${safeInitials}</text></svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function normalizeAvatarDisplayUrl(url, fallbackName = '') {
    if (!url || typeof url !== 'string') return url;
    if (!isUiAvatarsUrl(url)) return url;
    const match = url.match(/[?&]name=([^&]+)/);
    const name = match ? decodeURIComponent(match[1]) : fallbackName;
    return buildInitialsAvatarDataUri(name);
}

/**
 * Returns a consistent default avatar (Initial-based or silhouette)
 */
export const getDefaultAvatar = (name = '') => {
    const label = name == null ? '' : String(name).trim();
    if (label && label !== 'User' && label !== 'Member') {
        return buildInitialsAvatarDataUri(label);
    }

    return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="150" height="150"%3E%3Crect fill="%238b5cf6" width="150" height="150"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="60" fill="white"%3E👤%3C/text%3E%3C/svg%3E';
};

/**
 * Returns the CSS color for a user's gender-based avatar ring.
 * Business accounts use the theme border color.
 */
export const getGenderBorderColor = (user) => {
    if (!user) return GENDER_AVATAR_RING.unspecified;
    if (isBusinessAvatarUser(user)) return 'var(--border-color)';

    const gender = normalizeUserGender(user);
    if (gender === 'female') return GENDER_AVATAR_RING.female;
    if (gender === 'male') return GENDER_AVATAR_RING.male;
    return GENDER_AVATAR_RING.unspecified;
};

const avatarRingShellStyle = () => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 0,
    borderRadius: '50%',
    boxSizing: 'border-box',
});

/**
 * Inline styles for a circular profile photo ring (padding shell — participates in layout).
 */
export const getGenderAvatarRingStyle = (user, { ringWidth = 2, ringColorOverride } = {}) => {
    const color = ringColorOverride ?? getGenderBorderColor(user);
    if (!color || color === 'transparent') return avatarRingShellStyle();
    return {
        ...avatarRingShellStyle(),
        padding: `${ringWidth}px`,
        background: color,
    };
};

/**
 * Merge gender ring styles into an existing style object (for legacy <img> tags).
 */
export const mergeAvatarStyleWithGenderRing = (user, style = {}, options = {}) => {
    const { ringWidth = 2, ringColorOverride } = options;
    const color = ringColorOverride ?? getGenderBorderColor(user);
    return {
        objectFit: 'cover',
        borderRadius: style.borderRadius ?? '50%',
        boxSizing: 'border-box',
        ...(color && color !== 'transparent' ? { border: `${ringWidth}px solid ${color}` } : {}),
        ...style,
    };
};
