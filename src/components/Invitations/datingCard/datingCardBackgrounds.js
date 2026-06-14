/**
 * Dating card backgrounds: files in `public/dating-invitation-templates/backgrounds/`
 * (synced from repo-root `dating-invitation-templates/` via `npm run sync:dating-templates`).
 */
import {
    publicAssetUrl,
    CARD_BACKGROUND_IMAGE_PLACEHOLDER
} from '../privateCard/privateCardBackgrounds';

/** Template ids whose art is dark enough to need lifted frame text. */
export const DATING_DARK_TEMPLATE_BACKGROUND_IDS = new Set([
    'dating-city',
    'dating-minimal',
    'dating-mystery-entrance',
    'dating-candle-room',
    'dating-candlelight-table',
    'dating-restaurant-chemistry',
    'dating-midnight-city-lights',
    'dating-neon-coffee-date',
    'dating-neon-hearts-date',
    'dating-golden-love-night',
    'dating-velvet-lounge-evening',
]);

export const DATING_CARD_BACKGROUNDS = [
    { id: 'dating-luxury-floral', labelKey: 'dating_tpl_luxury_floral' },
    { id: 'dating-rooftop-dinner', labelKey: 'dating_tpl_rooftop_dinner' },
    { id: 'dating-mystery-entrance', labelKey: 'dating_tpl_mystery_entrance' },
    { id: 'dating-restaurant-chemistry', labelKey: 'dating_tpl_restaurant_chemistry' },
    { id: 'dating-sunset-beach', labelKey: 'dating_tpl_sunset_beach' },
    { id: 'dating-rainy-coffee', labelKey: 'dating_tpl_rainy_coffee' },
    { id: 'dating-rose-pathway', labelKey: 'dating_tpl_rose_pathway' },
    { id: 'dating-heart-roses', labelKey: 'dating_tpl_heart_roses' },
    { id: 'dating-candlelight-table', labelKey: 'dating_tpl_candlelight_table' },
    { id: 'dating-candle-room', labelKey: 'dating_tpl_candle_room' },
    { id: 'dating-golden-love-night', labelKey: 'dating_tpl_golden_love_night' },
    { id: 'dating-love-in-bloom', labelKey: 'dating_tpl_love_in_bloom' },
    { id: 'dating-midnight-city-lights', labelKey: 'dating_tpl_midnight_city_lights' },
    { id: 'dating-neon-coffee-date', labelKey: 'dating_tpl_neon_coffee_date' },
    { id: 'dating-neon-hearts-date', labelKey: 'dating_tpl_neon_hearts_date' },
    { id: 'dating-romantic-coffee-escape', labelKey: 'dating_tpl_romantic_coffee_escape' },
    { id: 'dating-roses-candlelight', labelKey: 'dating_tpl_roses_candlelight' },
    { id: 'dating-secret-garden-date', labelKey: 'dating_tpl_secret_garden_date' },
    { id: 'dating-sunset-romance', labelKey: 'dating_tpl_sunset_romance' },
    { id: 'dating-sunset-walk-together', labelKey: 'dating_tpl_sunset_walk_together' },
    { id: 'dating-sweetheart-rooftop', labelKey: 'dating_tpl_sweetheart_rooftop' },
    { id: 'dating-valentines-evening', labelKey: 'dating_tpl_valentines_evening' },
    { id: 'dating-velvet-lounge-evening', labelKey: 'dating_tpl_velvet_lounge_evening' },
    /** Legacy SVG placeholders — kept for old invitations, hidden from picker */
    { id: 'dating-rose', legacyOnly: true },
    { id: 'dating-city', legacyOnly: true },
    { id: 'dating-minimal', legacyOnly: true },
];

export const DEFAULT_DATING_CARD_BACKGROUND_ID = 'dating-luxury-floral';

const BACKGROUND_FILE_FALLBACK_EXTS = ['webp', 'jpg', 'jpeg', 'png', 'svg'];

export function getDatingCardBackgroundOptions() {
    return DATING_CARD_BACKGROUNDS.filter((o) => !o.legacyOnly);
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
    if (opt?.assetPath) {
        return [publicAssetUrl(opt.assetPath), CARD_BACKGROUND_IMAGE_PLACEHOLDER];
    }
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
