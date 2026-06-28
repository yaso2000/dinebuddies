/**
 * Personal (1-on-1) card backgrounds under
 * `public/private-invitation-templates/{date|friendship|social}/`
 * with legacy fallback to `backgrounds/{dating|friendship|icebreaker}/`.
 */
import {
    publicAssetUrl,
    CARD_BACKGROUND_IMAGE_PLACEHOLDER
} from '../socialCard/socialCardBackgrounds';
import {
    normalizePersonalInviteCategory,
    DEFAULT_PERSONAL_INVITE_CATEGORY,
} from '../../../constants/personalInviteCategories';
import {
    PERSONAL_INVITE_CATEGORY_DIRS,
    PRIVATE_INVITE_DATE_TEMPLATES,
    PRIVATE_INVITE_FRIENDSHIP_TEMPLATES,
    PRIVATE_INVITE_SOCIAL_TEMPLATES,
    encodePersonalInviteAssetUrl,
} from '../../../constants/privateInviteTemplateAssets';

/** @deprecated Use PERSONAL_INVITE_CATEGORY_DIRS — kept for callers expecting `backgrounds/` dir names. */
export const PERSONAL_INVITE_BACKGROUND_DIRS = {
    dating: 'dating',
    friendship: 'friendship',
    social: 'icebreaker',
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
    'private-friend-candle-room',
    'private-social-mystery-entrance',
    'private-social-neon-coffee-date',
    'private-social-midnight-city-lights',
    'private-social-neon-hearts-date',
    'private-social-golden-love-night',
]);

/** Old picker ids kept for saved invitations — hidden from new pickers; resolve via legacy `backgrounds/`. */
const LEGACY_PERSONAL_TEMPLATES = [
    { id: 'private-friend-rainy-coffee', labelKey: 'private_tpl_rainy_coffee', category: 'friendship', legacyOnly: true, fileStem: 'friendship-rainy-coffee' },
    { id: 'private-friend-rooftop-dinner', labelKey: 'private_tpl_rooftop_dinner', category: 'friendship', legacyOnly: true, fileStem: 'friendship-rooftop-dinner' },
    { id: 'private-friend-sunset-walk-together', labelKey: 'private_tpl_sunset_walk_together', category: 'friendship', legacyOnly: true, fileStem: 'friendship-sunset-walk-together' },
    { id: 'private-friend-romantic-coffee-escape', labelKey: 'private_tpl_romantic_coffee_escape', category: 'friendship', legacyOnly: true, fileStem: 'friendship-romantic-coffee-escape' },
    { id: 'private-friend-secret-garden-date', labelKey: 'private_tpl_secret_garden_date', category: 'friendship', legacyOnly: true, fileStem: 'friendship-secret-garden-date' },
    { id: 'private-friend-sunset-beach', labelKey: 'private_tpl_sunset_beach', category: 'friendship', legacyOnly: true, fileStem: 'friendship-sunset-beach' },
    { id: 'private-friend-candle-room', labelKey: 'private_tpl_candle_room', category: 'friendship', legacyOnly: true, fileStem: 'friendship-candle-room' },
    { id: 'private-friend-luxury-floral', labelKey: 'private_tpl_luxury_floral', category: 'friendship', legacyOnly: true, fileStem: 'friendship-luxury-floral' },
    { id: 'private-friend-neon-coffee-date', labelKey: 'private_tpl_neon_coffee_date', category: 'friendship', legacyOnly: true, fileStem: 'friendship-neon-coffee-date' },
    { id: 'private-friend-midnight-city-lights', labelKey: 'private_tpl_midnight_city_lights', category: 'friendship', legacyOnly: true, fileStem: 'friendship-midnight-city-lights' },
    { id: 'private-social-mystery-entrance', labelKey: 'private_tpl_mystery_entrance', category: 'social', legacyOnly: true, fileStem: 'social-mystery-entrance' },
    { id: 'private-social-neon-coffee-date', labelKey: 'private_tpl_neon_coffee_date', category: 'social', legacyOnly: true, fileStem: 'social-neon-coffee-date' },
    { id: 'private-social-midnight-city-lights', labelKey: 'private_tpl_midnight_city_lights', category: 'social', legacyOnly: true, fileStem: 'social-midnight-city-lights' },
    { id: 'private-social-neon-hearts-date', labelKey: 'private_tpl_neon_hearts_date', category: 'social', legacyOnly: true, fileStem: 'social-neon-hearts-date' },
    { id: 'private-social-golden-love-night', labelKey: 'private_tpl_golden_love_night', category: 'social', legacyOnly: true, fileStem: 'social-golden-love-night' },
    { id: 'private-social-love-in-bloom', labelKey: 'private_tpl_love_in_bloom', category: 'social', legacyOnly: true, fileStem: 'social-love-in-bloom' },
    { id: 'private-social-secret-garden-date', labelKey: 'private_tpl_secret_garden_date', category: 'social', legacyOnly: true, fileStem: 'social-secret-garden-date' },
    { id: 'private-social-rooftop-dinner', labelKey: 'private_tpl_rooftop_dinner', category: 'social', legacyOnly: true, fileStem: 'social-rooftop-dinner' },
    { id: 'private-social-sunset-beach', labelKey: 'private_tpl_sunset_beach', category: 'social', legacyOnly: true, fileStem: 'social-sunset-beach' },
    { id: 'private-social-heart-roses', labelKey: 'private_tpl_heart_roses', category: 'social', legacyOnly: true, fileStem: 'social-heart-roses' },
    { id: 'private-social-romantic-coffee-escape', labelKey: 'private_tpl_romantic_coffee_escape', category: 'social', legacyOnly: true, fileStem: 'social-romantic-coffee-escape' },
    /** Legacy SVG placeholders — kept for old invitations, hidden from picker */
    { id: 'private-rose', legacyOnly: true, category: 'dating' },
    { id: 'private-city', legacyOnly: true, category: 'dating' },
    { id: 'private-minimal', legacyOnly: true, category: 'dating' },
];

export const PRIVATE_CARD_BACKGROUNDS = [
    ...PRIVATE_INVITE_DATE_TEMPLATES,
    ...PRIVATE_INVITE_FRIENDSHIP_TEMPLATES,
    ...PRIVATE_INVITE_SOCIAL_TEMPLATES,
    ...LEGACY_PERSONAL_TEMPLATES,
];

export const DEFAULT_DATING_CARD_BACKGROUND_ID = 'private-luxury-floral';
export const DEFAULT_FRIENDSHIP_CARD_BACKGROUND_ID = 'private-friend-work-4';
export const DEFAULT_SOCIAL_CARD_BACKGROUND_ID = 'private-social-1';

const BACKGROUND_FILE_FALLBACK_EXTS = ['webp', 'jpg', 'jpeg', 'png', 'svg'];
const LEGACY_FLAT_BACKGROUND_DIR = '';

/** @param {unknown} personalInviteCategory */
export function getPersonalInviteBackgroundDir(personalInviteCategory) {
    const cat = normalizePersonalInviteCategory(personalInviteCategory);
    return PERSONAL_INVITE_CATEGORY_DIRS[cat] || PERSONAL_INVITE_CATEGORY_DIRS.dating;
}

function templateSuffixFromId(canonical) {
    if (canonical.startsWith('private-friend-')) return canonical.slice('private-friend-'.length);
    if (canonical.startsWith('private-social-')) return canonical.slice('private-social-'.length);
    if (canonical.startsWith('private-')) return canonical.slice('private-'.length);
    return canonical;
}

/** On-disk stems for legacy `backgrounds/` paths. */
export function privateBackgroundFileStem(assetId) {
    const canonical = resolveCanonicalPrivateBackgroundId(assetId);
    if (!canonical) return null;
    const opt = PRIVATE_CARD_BACKGROUNDS.find((o) => o.id === canonical);
    if (opt?.fileStem) {
        return String(opt.fileStem).replace(/\.(webp|png|jpe?g|svg)$/i, '');
    }
    const cat = opt?.category || 'dating';
    const suffix = templateSuffixFromId(canonical);
    if (cat === 'friendship') return `friendship-${suffix}`;
    if (cat === 'social') return `social-${suffix}`;
    return `dating-${suffix}`;
}

export function resolveCanonicalPrivateBackgroundId(assetId) {
    if (!assetId || typeof assetId !== 'string') return null;
    if (PRIVATE_CARD_BACKGROUNDS.some((o) => o.id === assetId)) return assetId;
    if (assetId.startsWith('dating-')) {
        const mapped = `private-${assetId.slice('dating-'.length)}`;
        if (PRIVATE_CARD_BACKGROUNDS.some((o) => o.id === mapped)) return mapped;
    }
    if (assetId.startsWith('friendship-')) {
        const mapped = `private-friend-${assetId.slice('friendship-'.length)}`;
        if (PRIVATE_CARD_BACKGROUNDS.some((o) => o.id === mapped)) return mapped;
    }
    if (assetId.startsWith('social-')) {
        const mapped = `private-social-${assetId.slice('social-'.length)}`;
        if (PRIVATE_CARD_BACKGROUNDS.some((o) => o.id === mapped)) return mapped;
    }
    return null;
}

/** @param {unknown} assetId @param {unknown} personalInviteCategory */
export function isPrivateBackgroundIdForCategory(assetId, personalInviteCategory) {
    const canonical = resolveCanonicalPrivateBackgroundId(assetId);
    if (!canonical) return false;
    const opt = PRIVATE_CARD_BACKGROUNDS.find((o) => o.id === canonical);
    const cat = normalizePersonalInviteCategory(personalInviteCategory);
    return (opt?.category || 'dating') === cat;
}

/** @param {unknown} [personalInviteCategory] */
export function getDefaultPrivateCardBackgroundId(personalInviteCategory = DEFAULT_PERSONAL_INVITE_CATEGORY) {
    const cat = normalizePersonalInviteCategory(personalInviteCategory);
    if (cat === 'friendship') return DEFAULT_FRIENDSHIP_CARD_BACKGROUND_ID;
    if (cat === 'social') return DEFAULT_SOCIAL_CARD_BACKGROUND_ID;
    return DEFAULT_DATING_CARD_BACKGROUND_ID;
}

function resolveLegacyBackgroundDirForAsset(canonical) {
    const opt = PRIVATE_CARD_BACKGROUNDS.find((o) => o.id === canonical);
    if (opt?.category) return PERSONAL_INVITE_BACKGROUND_DIRS[opt.category] || opt.category;
    return PERSONAL_INVITE_BACKGROUND_DIRS.dating;
}

function buildLegacyBackgroundFileUrls(stem, dir, opt) {
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

function resolvePrimaryTemplateAssetUrl(opt) {
    if (!opt?.assetPath) return null;
    return encodePersonalInviteAssetUrl(opt.assetPath, publicAssetUrl);
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
    const cat = normalizePersonalInviteCategory(personalInviteCategory);
    if (!isPrivateBackgroundIdForCategory(canonical, cat)) return [];
    const opt = PRIVATE_CARD_BACKGROUNDS.find((o) => o.id === canonical);
    const primary = resolvePrimaryTemplateAssetUrl(opt);
    const legacyStem = privateBackgroundFileStem(canonical);
    const legacyDir = resolveLegacyBackgroundDirForAsset(canonical);
    const legacyUrls = legacyStem ? buildLegacyBackgroundFileUrls(legacyStem, legacyDir, opt) : [];
    const urls = primary ? [primary, ...legacyUrls] : legacyUrls;
    return [...urls, CARD_BACKGROUND_IMAGE_PLACEHOLDER];
}

/** First resolved file URL for a template (skips trailing SVG data placeholder when possible). */
export function getFirstPrivateBackgroundFileUrl(assetId, personalInviteCategory) {
    const urls = resolvePrivateCardBackgroundUrlCandidates(assetId, personalInviteCategory);
    for (const u of urls) {
        if (u && typeof u === 'string' && !u.startsWith('data:')) return u;
    }
    return urls[0] || null;
}

function categoryFromTemplateDir(dir) {
    if (dir === 'date') return 'dating';
    if (dir === 'friendship') return 'friendship';
    if (dir === 'social') return 'social';
    return null;
}

/** If `url` points at a personal template asset, return its canonical id. */
export function parseDatingCoverTemplateIdFromUrl(url) {
    if (!url || typeof url !== 'string') return null;

    const categoryMatch = url.match(
        /private-invitation-templates\/(date|friendship|social)\/([^?#]+)/i
    );
    if (categoryMatch) {
        const category = categoryFromTemplateDir(categoryMatch[1].toLowerCase());
        let fileName = categoryMatch[2];
        try {
            fileName = decodeURIComponent(fileName);
        } catch {
            /* keep raw segment */
        }
        const opt = PRIVATE_CARD_BACKGROUNDS.find(
            (o) =>
                o.assetPath &&
                o.category === category &&
                o.assetPath.endsWith(`/${fileName}`)
        );
        if (opt) return opt.id;
    }

    const legacyMatch = url.match(
        /private-invitation-templates\/backgrounds\/(?:dating|friendship|social|icebreaker\/)?([^./?#]+)/i
    );
    if (!legacyMatch) return null;
    const stem = legacyMatch[1];
    if (stem.startsWith('dating-')) {
        return resolveCanonicalPrivateBackgroundId(`private-${stem.slice('dating-'.length)}`);
    }
    if (stem.startsWith('friendship-')) {
        return resolveCanonicalPrivateBackgroundId(`private-friend-${stem.slice('friendship-'.length)}`);
    }
    if (stem.startsWith('social-')) {
        return resolveCanonicalPrivateBackgroundId(`private-social-${stem.slice('social-'.length)}`);
    }
    if (stem.startsWith('private-friend-') || stem.startsWith('private-social-') || stem.startsWith('private-')) {
        return resolveCanonicalPrivateBackgroundId(stem);
    }
    return resolveCanonicalPrivateBackgroundId(`private-${stem}`);
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
    const cat = normalizePersonalInviteCategory(personalInviteCategory);
    return PRIVATE_CARD_BACKGROUNDS.filter(
        (o) => !o.legacyOnly && (o.category || 'dating') === cat
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
    const category = normalizePersonalInviteCategory(invitation.personalInviteCategory);
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

const EMPTY_COVER_DRAFTS = { template: null, upload: null, camera: null, ai: null };

/** Per-category cover editor snapshot for private invitation create flow. */
export function createPrivateCategoryCoverSlice(categoryId, overrides = {}) {
    const cat = normalizePersonalInviteCategory(categoryId);
    const defaultBg = getDefaultPrivateCardBackgroundId(cat);
    const bgId =
        overrides.cardBackgroundId &&
        isPrivateBackgroundIdForCategory(overrides.cardBackgroundId, cat)
            ? overrides.cardBackgroundId
            : defaultBg;
    return {
        cardBackgroundId: bgId,
        cardGradientId: overrides.cardGradientId ?? null,
        coverTab: overrides.coverTab ?? 'template',
        mediaData: overrides.mediaData ?? null,
        drafts: { ...EMPTY_COVER_DRAFTS, ...(overrides.drafts || {}) },
        stash: overrides.stash ?? [],
    };
}
