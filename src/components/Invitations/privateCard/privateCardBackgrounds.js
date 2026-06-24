/**
 * Personal (1-on-1) card backgrounds under
 * `public/private-invitation-templates/backgrounds/{dating|friendship|icebreaker}/`
 * (synced from repo-root `private-invitation-templates/` via `npm run sync:private-templates`).
 */
import {
    publicAssetUrl,
    CARD_BACKGROUND_IMAGE_PLACEHOLDER
} from '../socialCard/socialCardBackgrounds';
import {
    normalizePersonalInviteCategory,
    DEFAULT_PERSONAL_INVITE_CATEGORY,
} from '../../../constants/personalInviteCategories';

/** Subfolder names under `backgrounds/` — match `personalInviteCategory` ids. */
export const PERSONAL_INVITE_BACKGROUND_DIRS = {
    dating: 'dating',
    friendship: 'friendship',
    icebreaker: 'icebreaker',
};

/** Template ids whose art is dark enough to need lifted frame text. */
export const PRIVATE_DARK_TEMPLATE_BACKGROUND_IDS = new Set([
    'private-city',
    'private-minimal',
    'private-mystery-entrance',
    'private-candle-room',
    'private-candlelight-table',
    'private-restaurant-chemistry',
    'private-midnight-city-lights',
    'private-neon-coffee-date',
    'private-neon-hearts-date',
    'private-golden-love-night',
    'private-velvet-lounge-evening',
]);

export const PRIVATE_CARD_BACKGROUNDS = [
    { id: 'private-luxury-floral', labelKey: 'private_tpl_luxury_floral', category: 'dating' },
    { id: 'private-rooftop-dinner', labelKey: 'private_tpl_rooftop_dinner', category: 'dating' },
    { id: 'private-mystery-entrance', labelKey: 'private_tpl_mystery_entrance', category: 'dating' },
    { id: 'private-restaurant-chemistry', labelKey: 'private_tpl_restaurant_chemistry', category: 'dating' },
    { id: 'private-sunset-beach', labelKey: 'private_tpl_sunset_beach', category: 'dating' },
    { id: 'private-rainy-coffee', labelKey: 'private_tpl_rainy_coffee', category: 'dating' },
    { id: 'private-rose-pathway', labelKey: 'private_tpl_rose_pathway', category: 'dating' },
    { id: 'private-heart-roses', labelKey: 'private_tpl_heart_roses', category: 'dating' },
    { id: 'private-candlelight-table', labelKey: 'private_tpl_candlelight_table', category: 'dating' },
    { id: 'private-candle-room', labelKey: 'private_tpl_candle_room', category: 'dating' },
    { id: 'private-golden-love-night', labelKey: 'private_tpl_golden_love_night', category: 'dating' },
    { id: 'private-love-in-bloom', labelKey: 'private_tpl_love_in_bloom', category: 'dating' },
    { id: 'private-midnight-city-lights', labelKey: 'private_tpl_midnight_city_lights', category: 'dating' },
    { id: 'private-neon-coffee-date', labelKey: 'private_tpl_neon_coffee_date', category: 'dating' },
    { id: 'private-neon-hearts-date', labelKey: 'private_tpl_neon_hearts_date', category: 'dating' },
    { id: 'private-romantic-coffee-escape', labelKey: 'private_tpl_romantic_coffee_escape', category: 'dating' },
    { id: 'private-roses-candlelight', labelKey: 'private_tpl_roses_candlelight', category: 'dating' },
    { id: 'private-secret-garden-date', labelKey: 'private_tpl_secret_garden_date', category: 'dating' },
    { id: 'private-sunset-romance', labelKey: 'private_tpl_sunset_romance', category: 'dating' },
    { id: 'private-sunset-walk-together', labelKey: 'private_tpl_sunset_walk_together', category: 'dating' },
    { id: 'private-sweetheart-rooftop', labelKey: 'private_tpl_sweetheart_rooftop', category: 'dating' },
    { id: 'private-valentines-evening', labelKey: 'private_tpl_valentines_evening', category: 'dating' },
    { id: 'private-velvet-lounge-evening', labelKey: 'private_tpl_velvet_lounge_evening', category: 'dating' },
    /** Legacy SVG placeholders — kept for old invitations, hidden from picker */
    { id: 'private-rose', legacyOnly: true, category: 'dating' },
    { id: 'private-city', legacyOnly: true, category: 'dating' },
    { id: 'private-minimal', legacyOnly: true, category: 'dating' },
];

export const DEFAULT_DATING_CARD_BACKGROUND_ID = 'private-luxury-floral';

const BACKGROUND_FILE_FALLBACK_EXTS = ['webp', 'jpg', 'jpeg', 'png', 'svg'];
const LEGACY_FLAT_BACKGROUND_DIR = '';

/** @param {unknown} personalInviteCategory */
export function getPersonalInviteBackgroundDir(personalInviteCategory) {
    const cat = normalizePersonalInviteCategory(personalInviteCategory);
    return PERSONAL_INVITE_BACKGROUND_DIRS[cat] || PERSONAL_INVITE_BACKGROUND_DIRS.dating;
}

/** On-disk stems still use `dating-*` under category subfolders. */
export function privateBackgroundFileStem(assetId) {
    const canonical = resolveCanonicalPrivateBackgroundId(assetId);
    if (!canonical) return null;
    const opt = PRIVATE_CARD_BACKGROUNDS.find((o) => o.id === canonical);
    if (opt?.fileStem) {
        return String(opt.fileStem).replace(/\.(webp|png|jpe?g|svg)$/i, '');
    }
    if (canonical.startsWith('private-')) {
        return `dating-${canonical.slice('private-'.length)}`;
    }
    return canonical;
}

export function resolveCanonicalPrivateBackgroundId(assetId) {
    if (!assetId || typeof assetId !== 'string') return null;
    if (PRIVATE_CARD_BACKGROUNDS.some((o) => o.id === assetId)) return assetId;
    // Legacy docs saved before rename (dating-luxury-floral → private-luxury-floral)
    if (assetId.startsWith('dating-')) {
        const mapped = `private-${assetId.slice('dating-'.length)}`;
        if (PRIVATE_CARD_BACKGROUNDS.some((o) => o.id === mapped)) return mapped;
    }
    return null;
}

function resolveBackgroundDirForAsset(canonical, personalInviteCategory) {
    const opt = PRIVATE_CARD_BACKGROUNDS.find((o) => o.id === canonical);
    if (opt?.category) return PERSONAL_INVITE_BACKGROUND_DIRS[opt.category] || opt.category;
    return getPersonalInviteBackgroundDir(personalInviteCategory);
}

function buildBackgroundFileUrls(stem, dir, opt) {
    const preferred = opt?.ext ? [String(opt.ext).toLowerCase().replace(/^\./, '')] : [];
    const rest = BACKGROUND_FILE_FALLBACK_EXTS.filter((e) => !preferred.includes(e));
    const exts = [...preferred, ...rest];
    const seen = new Set();
    const unique = exts.filter((e) => {
        if (seen.has(e)) return false;
        seen.add(e);
        return true;
    });
    const dirs = dir ? [dir, LEGACY_FLAT_BACKGROUND_DIR] : [LEGACY_FLAT_BACKGROUND_DIR];
    const urls = [];
    for (const folder of dirs) {
        for (const ext of unique) {
            const rel = folder
                ? `private-invitation-templates/backgrounds/${folder}/${stem}.${ext}`
                : `private-invitation-templates/backgrounds/${stem}.${ext}`;
            urls.push(publicAssetUrl(rel));
        }
    }
    return urls;
}

/**
 * @param {string} assetId
 * @param {unknown} [personalInviteCategory]
 * @returns {string[]}
 */
export function resolvePrivateCardBackgroundUrlCandidates(assetId, personalInviteCategory) {
    if (!assetId) return [];
    const canonical = resolveCanonicalPrivateBackgroundId(assetId);
    if (!canonical) return [];
    const opt = PRIVATE_CARD_BACKGROUNDS.find((o) => o.id === canonical);
    if (opt?.assetPath) {
        return [publicAssetUrl(opt.assetPath), CARD_BACKGROUND_IMAGE_PLACEHOLDER];
    }
    const stem = privateBackgroundFileStem(canonical);
    if (!stem) return [];
    const dir = resolveBackgroundDirForAsset(canonical, personalInviteCategory);
    const fileUrls = buildBackgroundFileUrls(stem, dir, opt);
    return [...fileUrls, CARD_BACKGROUND_IMAGE_PLACEHOLDER];
}

/** First resolved file URL for a template (skips trailing SVG data placeholder when possible). */
export function getFirstPrivateBackgroundFileUrl(assetId, personalInviteCategory) {
    const urls = resolvePrivateCardBackgroundUrlCandidates(assetId, personalInviteCategory);
    for (const u of urls) {
        if (u && typeof u === 'string' && !u.startsWith('data:')) return u;
    }
    return urls[0] || null;
}

/** If `url` points at a personal template asset, return its canonical id. */
export function parseDatingCoverTemplateIdFromUrl(url) {
    if (!url || typeof url !== 'string') return null;
    const match = url.match(
        /private-invitation-templates\/backgrounds\/(?:dating|friendship|icebreaker\/)?([^./?#]+)/i
    );
    if (!match) return null;
    const stem = match[1];
    const asPrivate = stem.startsWith('dating-')
        ? `private-${stem.slice('dating-'.length)}`
        : stem.startsWith('private-')
          ? stem
          : `private-${stem}`;
    return resolveCanonicalPrivateBackgroundId(asPrivate);
}

/**
 * Dating editor draft → hero layer for {@link SocialInvitationCardPreview}.
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

/** @param {unknown} [personalInviteCategory] */
export function getPrivateCardBackgroundOptions(personalInviteCategory = DEFAULT_PERSONAL_INVITE_CATEGORY) {
    const dir = getPersonalInviteBackgroundDir(personalInviteCategory);
    return PRIVATE_CARD_BACKGROUNDS.filter(
        (o) => !o.legacyOnly && (o.category || 'dating') === dir
    );
}

/**
 * Saved private invitation (1-on-1) → hero cover from upload or template art.
 * @returns {{ src: string, mediaType: 'image'|'video', poster?: string|null } | null}
 */
export function getPrivateInvitationHeroCoverFromInvitation(invitation) {
    if (!invitation) return null;
    const type = String(invitation.type || '');
    const isPersonal =
        type === 'Private' ||
        type === 'Dating' ||
        String(invitation.occasionType || '').toLowerCase() === 'dating' ||
        String(invitation.personalInviteCategory || '').length > 0;
    if (!isPersonal) return null;
    const vid = invitation.customVideo;
    if (vid) {
        return { src: vid, mediaType: 'video', poster: invitation.videoThumbnail || null };
    }
    const img = invitation.customImage || invitation.image;
    if (img && typeof img === 'string' && !parseDatingCoverTemplateIdFromUrl(img)) {
        return { src: img, mediaType: 'image', poster: null };
    }
    const category = invitation.personalInviteCategory || 'dating';
    const templateUrl = getFirstPrivateBackgroundFileUrl(invitation.cardBackgroundId, category);
    if (templateUrl) {
        return { src: templateUrl, mediaType: 'image', poster: null };
    }
    return null;
}

/**
 * Private editor draft → hero over template art (video, photo, or template image).
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
