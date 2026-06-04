/**
 * Google Places image URLs (JS PhotoService, REST /place/photo, etc.) are not persisted app media.
 * Do not use as gallery/cover img src — use Firebase Storage + Firestore instead.
 */
export function isGooglePlaceImageUrl(url) {
    if (!url || typeof url !== 'string') return false;
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

/** True for Google Place CDNs and disabled place-photo proxies — do not render or persist as media URLs. */
export function shouldBlockDirectImageLoad(url) {
    if (!url || typeof url !== 'string') return true;
    if (isGooglePlaceImageUrl(url)) return true;
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

/**
 * Unified logic to retrieve a safe avatar URL for a user
 * Checks multiple possible fields and provides a consistent fallback
 */
export const getSafeAvatar = (userData) => {
    if (!userData) return getDefaultAvatar();

    const candidates = [
        userData.avatarUrl,
        userData.avatar,
        userData.photoURL,
        userData.photo_url,
        userData.userPhoto,
        userData.logo,
        userData.logoImage,
        userData.profilePicture,
        userData.businessInfo?.logo,
        userData.businessInfo?.logoImage,
        userData.partnerLogo,
    ];

    for (const url of candidates) {
        if (url && typeof url === 'string' && url.length > 10) {
            if (url.startsWith('http') || url.startsWith('data:image')) {
                if (!isInvalidDirectImageUrl(url)) return url;
            }
        }
    }

    return getDefaultAvatar(userData.display_name || userData.displayName || userData.nickname);
};

/**
 * Returns a consistent default avatar (Initial-based or silhouette)
 */
export const getDefaultAvatar = (name = '') => {
    const label = name == null ? '' : String(name).trim();
    if (label && label !== 'User' && label !== 'Member') {
        const initials = label.split(/\s+/).map((n) => n[0]).filter(Boolean).join('').toUpperCase().slice(0, 2);
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(label)}&background=7c3aed&color=fff&bold=true&size=150`;
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

/**
 * Inline styles for a circular profile photo ring (box-shadow, no layout shift).
 */
export const getGenderAvatarRingStyle = (user, { ringWidth = 2, ringColorOverride } = {}) => {
    const color = ringColorOverride ?? getGenderBorderColor(user);
    if (!color || color === 'transparent') return {};
    return {
        display: 'inline-block',
        lineHeight: 0,
        borderRadius: '50%',
        boxShadow: `0 0 0 ${ringWidth}px ${color}`,
    };
};

/**
 * Merge gender ring styles into an existing style object (for legacy <img> tags).
 */
export const mergeAvatarStyleWithGenderRing = (user, style = {}, options = {}) => {
    return {
        objectFit: 'cover',
        borderRadius: style.borderRadius ?? '50%',
        ...getGenderAvatarRingStyle(user, options),
        ...style,
    };
};
