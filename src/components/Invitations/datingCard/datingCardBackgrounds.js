/**
 * Dating card backgrounds: files synced from repo-root `dating-invitation-templates/backgrounds/`
 * into `public/dating-invitation-templates/backgrounds/` (see scripts/sync-dating-invitation-templates.mjs).
 */
import {
    publicAssetUrl,
    CARD_BACKGROUND_IMAGE_PLACEHOLDER
} from '../privateCard/privateCardBackgrounds';

/** Template ids whose art is dark enough to need lifted frame text (extend when adding assets). */
export const DATING_DARK_TEMPLATE_BACKGROUND_IDS = new Set(['dating-city', 'dating-minimal']);

export const DATING_CARD_BACKGROUNDS = [
    { id: 'dating-rose' },
    { id: 'dating-city' },
    { id: 'dating-minimal' }
];

const BACKGROUND_FILE_FALLBACK_EXTS = ['webp', 'jpg', 'jpeg', 'png', 'svg'];

export function getDatingCardBackgroundOptions() {
    return DATING_CARD_BACKGROUNDS;
}

export function resolveCanonicalDatingBackgroundId(assetId) {
    if (!assetId || typeof assetId !== 'string') return null;
    return DATING_CARD_BACKGROUNDS.some((o) => o.id === assetId) ? assetId : null;
}

/**
 * @returns {string[]}
 */
export function resolveDatingCardBackgroundUrlCandidates(assetId) {
    if (!assetId) return [];
    const canonical = resolveCanonicalDatingBackgroundId(assetId);
    if (!canonical) return [];
    const opt = DATING_CARD_BACKGROUNDS.find((o) => o.id === canonical);
    const stem = opt?.fileStem ? String(opt.fileStem).replace(/\.(webp|png|jpe?g|svg)$/i, '') : canonical;
    const preferred = opt?.ext ? [String(opt.ext).toLowerCase().replace(/^\./, '')] : [];
    const rest = BACKGROUND_FILE_FALLBACK_EXTS.filter((e) => !preferred.includes(e));
    const exts = [...preferred, ...rest];
    const seen = new Set();
    const unique = exts.filter((e) => {
        if (seen.has(e)) return false;
        seen.add(e);
        return true;
    });
    const fileUrls = unique.map((ext) =>
        publicAssetUrl(`dating-invitation-templates/backgrounds/${stem}.${ext}`)
    );
    return [...fileUrls, CARD_BACKGROUND_IMAGE_PLACEHOLDER];
}

/** First resolved file URL for a template (skips trailing SVG data placeholder when possible). */
export function getFirstDatingBackgroundFileUrl(assetId) {
    const urls = resolveDatingCardBackgroundUrlCandidates(assetId);
    for (const u of urls) {
        if (u && typeof u === 'string' && !u.startsWith('data:')) return u;
    }
    return urls[0] || null;
}

/** If `url` points at a dating template asset, return its canonical id. */
export function parseDatingCoverTemplateIdFromUrl(url) {
    if (!url || typeof url !== 'string') return null;
    const match = url.match(/dating-invitation-templates\/backgrounds\/([^./?#]+)/i);
    if (!match) return null;
    return resolveCanonicalDatingBackgroundId(match[1]);
}

/**
 * Dating editor draft → hero layer for {@link PrivateInvitationCardPreview}.
 * Template picks use `cardBackgroundId` only; uploads / camera / recorded video use explicit URLs.
 * @returns {{ src: string, mediaType: 'image'|'video', poster?: string|null } | null}
 */
export function getDatingHeroCoverFromMediaData(mediaData) {
    if (!mediaData) return null;
    if (mediaData.type === 'video') {
        const src = mediaData.preview || mediaData.url;
        if (!src) return null;
        return { src, mediaType: 'video', poster: mediaData.videoThumbnail || null };
    }
    if (mediaData.type === 'image') {
        if (mediaData.coverTemplateId) return null;
        const src = mediaData.preview || mediaData.url;
        if (!src) return null;
        return { src, mediaType: 'image', poster: null };
    }
    return null;
}

/**
 * Saved invitation → same hero rules as draft (skip template asset URLs; those use `cardBackgroundId`).
 * @returns {{ src: string, mediaType: 'image'|'video', poster?: string|null } | null}
 */
export function getDatingInvitationHeroCoverFromInvitation(invitation) {
    if (!invitation || invitation.type !== 'Dating') return null;
    const vid = invitation.customVideo;
    if (vid) {
        return { src: vid, mediaType: 'video', poster: invitation.videoThumbnail || null };
    }
    const img = invitation.customImage || invitation.image;
    if (!img || typeof img !== 'string') return null;
    if (parseDatingCoverTemplateIdFromUrl(img)) return null;
    return { src: img, mediaType: 'image', poster: null };
}

/**
 * Private editor draft → hero over occasion card art (video, photo, or dating template image).
 * @returns {{ src: string, mediaType: 'image'|'video', poster?: string|null } | null}
 */
export function getPrivateHeroCoverFromMediaData(mediaData) {
    if (!mediaData) return null;
    if (mediaData.type === 'video') {
        const src = mediaData.preview || mediaData.url;
        if (!src) return null;
        return { src, mediaType: 'video', poster: mediaData.videoThumbnail || null };
    }
    if (mediaData.type === 'image') {
        const src = mediaData.preview || mediaData.url;
        if (!src) return null;
        return { src, mediaType: 'image', poster: null };
    }
    return null;
}

/**
 * Saved private invitation → hero for {@link PrivateInvitationCardPreview}.
 * @returns {{ src: string, mediaType: 'image'|'video', poster?: string|null } | null}
 */
export function getPrivateInvitationHeroCoverFromInvitation(invitation) {
    if (!invitation || invitation.type !== 'Private') return null;
    const vid = invitation.customVideo;
    if (vid) {
        return { src: vid, mediaType: 'video', poster: invitation.videoThumbnail || null };
    }
    const img = invitation.customImage || invitation.image;
    if (!img || typeof img !== 'string') return null;
    return { src: img, mediaType: 'image', poster: null };
}
