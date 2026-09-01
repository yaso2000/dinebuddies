/**
 * Card backgrounds: files in `public/invitation-card-backgrounds/{category}/{id}.webp`.
 * `id` must match the filename stem on disk. Legacy Firestore ids are mapped in BIRTHDAY_LEGACY_CANONICAL_ID.
 * Optional per-row `fileStem` / `ext` — see resolveCardBackgroundUrlCandidates.
 */
import { resolveOccasionCategoryId } from './socialCardOccasionMap';

/** Template ids whose artwork is predominantly dark — frame text must be lifted for contrast */
export const DARK_TEMPLATE_BACKGROUND_IDS = new Set([]);

/** New social-invite create: default type + first social template art */
export const DEFAULT_PRIVATE_OCCASION_LABEL = 'Social';
export const DEFAULT_PRIVATE_CARD_BACKGROUND_ID = 'social-1';

/** Typographic apostrophe (U+2019) — matches Windows/macOS “smart quote” filenames on disk. */
const CURLY_APOSTROPHE = '\u2019';

// Social-invitation categories: friendship, social, family, work, serious, acquaintance.
// Each folder lives at public/invitation-card-backgrounds/{category}/{id}.webp.
export const CARD_BACKGROUNDS_BY_CATEGORY = {
    friendship: [
        { id: 'friendship-1' },
        { id: 'friendship-2' },
        { id: 'friendship-3' },
        { id: 'friendship-4' },
        { id: 'friendship-5' },
        { id: 'friendship-6' },
        { id: 'friendship-7' },
        { id: 'friendship-8' },
        { id: 'friendship-9' },
        { id: 'friendship-10' }
    ],
    social: [
        { id: 'social-1' },
        { id: 'social-2' },
        { id: 'social-3' },
        { id: 'social-4' },
        { id: 'social-5' },
        { id: 'social-6' },
        { id: 'social-7' },
        { id: 'social-8' },
        { id: 'social-9' },
        { id: 'social-10' }
    ],
    family: [
        { id: 'family-1' },
        { id: 'family-2' },
        { id: 'family-3' },
        { id: 'family-4' },
        { id: 'family-5' },
        { id: 'family-6' },
        { id: 'family-7' },
        { id: 'family-8' },
        { id: 'family-9' },
        { id: 'family-10' }
    ],
    work: [
        { id: 'work-1' },
        { id: 'work-2' },
        { id: 'work-3' },
        { id: 'work-4' },
        { id: 'work-5' },
        { id: 'work-6' },
        { id: 'work-7' },
        { id: 'work-8' },
        { id: 'work-9' },
        { id: 'work-10' }
    ],
    serious: [
        { id: 'serious-1' },
        { id: 'serious-2' },
        { id: 'serious-3' },
        { id: 'serious-4' },
        { id: 'serious-5' },
        { id: 'serious-6' },
        { id: 'serious-7' },
        { id: 'serious-8' },
        { id: 'serious-9' }
    ],
    acquaintance: [
        { id: 'acquaintance-1' },
        { id: 'acquaintance-2' },
        { id: 'acquaintance-3' },
        { id: 'acquaintance-4' },
        { id: 'acquaintance-5' },
        { id: 'acquaintance-6' },
        { id: 'acquaintance-7' },
        { id: 'acquaintance-8' },
        { id: 'acquaintance-9' }
    ]
};

/**
 * Firestore may still store old placeholder ids — map to real option ids / files on disk.
 */
const BIRTHDAY_LEGACY_CANONICAL_ID = {
    'birthday-candlake': 'birthday-candlecake',
    'birthday-sparkle': 'birthday-dark',
    'birthday-elegant': 'birthday-dark-1',
    'birthday-confetti': 'birthday-dark-neon',
    'birthday-golden': 'birthday-gold'
};

export function getCardBackgroundOptions(categoryId) {
    if (!categoryId || typeof categoryId !== 'string') return CARD_BACKGROUNDS_BY_CATEGORY.social || [];
    // Categories without their own artwork (e.g. friendship) reuse the social set.
    return CARD_BACKGROUNDS_BY_CATEGORY[categoryId] || CARD_BACKGROUNDS_BY_CATEGORY.social || [];
}

/**
 * URL for files in /public (respects Vite `base` / `import.meta.env.BASE_URL` on subpath deploys).
 * @param {string} pathFromPublicRoot e.g. `invitation-card-backgrounds/birthday/foo.webp`
 */
export function publicAssetUrl(pathFromPublicRoot) {
    const p = String(pathFromPublicRoot || '').replace(/^\/+/, '');
    const base = import.meta.env.BASE_URL || '/';
    return `${base.replace(/\/?$/, '/')}${p}`;
}

/** Encode each path segment so stems with spaces/apostrophes resolve on disk and CDN. */
function publicBackgroundAssetUrl(categoryId, fileStem, ext) {
    const encodedStem = encodeURIComponent(String(fileStem || ''));
    return publicAssetUrl(`invitation-card-backgrounds/${categoryId}/${encodedStem}.${ext}`);
}

/** Straight vs typographic apostrophe — try both when building URL fallbacks. */
function fileStemUrlVariants(stem) {
    const variants = new Set([stem]);
    if (stem.includes("'")) {
        variants.add(stem.replace(/'/g, CURLY_APOSTROPHE));
    }
    if (stem.includes(CURLY_APOSTROPHE)) {
        variants.add(stem.replace(new RegExp(CURLY_APOSTROPHE, 'g'), "'"));
    }
    return [...variants];
}

/** File stem (without extension) for public URL — legacy typos + optional per-option `fileStem` if filename ≠ id. */
export function resolveAssetFileStem(categoryId, assetId) {
    if (!assetId) return null;
    const opts = getCardBackgroundOptions(categoryId);
    const canonical = resolveCanonicalBackgroundId(categoryId, assetId);
    const opt = opts.find((o) => o.id === canonical);
    if (opt?.fileStem && typeof opt.fileStem === 'string') {
        return opt.fileStem.replace(/\.(webp|png|jpe?g)$/i, '');
    }
    return canonical;
}

/** Canonical option id for validation (legacy → current file id). */
export function resolveCanonicalBackgroundId(categoryId, assetId) {
    if (!assetId) return null;
    if (categoryId === 'birthday' && Object.prototype.hasOwnProperty.call(BIRTHDAY_LEGACY_CANONICAL_ID, assetId)) {
        return BIRTHDAY_LEGACY_CANONICAL_ID[assetId];
    }
    return assetId;
}

/** Try these extensions in order when `ext` is not set on the option (fixes PNG/JPEG saved with wrong name). */
const BACKGROUND_FILE_FALLBACK_EXTS = ['webp', 'jpg', 'jpeg', 'png'];

/**
 * Shown when no file exists under /public yet — avoids broken-image icon in the picker/preview.
 * Replace with a real asset: public/invitation-card-backgrounds/{category}/{id}.webp|png|…
 */
export const CARD_BACKGROUND_IMAGE_PLACEHOLDER =
    'data:image/svg+xml,' +
    encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1280" viewBox="0 0 720 1280" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4a3f6b"/>
      <stop offset="100%" stop-color="#1f1a2e"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <text x="50%" y="48%" fill="rgba(255,255,255,0.22)" font-family="system-ui,sans-serif" font-size="22" text-anchor="middle">✦</text>
  <text x="50%" y="52%" fill="rgba(255,255,255,0.18)" font-family="system-ui,sans-serif" font-size="13" text-anchor="middle">background</text>
</svg>`
    );

/**
 * Ordered public URLs to try for one template (first match wins in img onError chain).
 * @returns {string[]}
 */
export function resolveCardBackgroundUrlCandidates(categoryId, assetId) {
    if (!categoryId || !assetId) return [];
    const opts = getCardBackgroundOptions(categoryId);
    const canonical = resolveCanonicalBackgroundId(categoryId, assetId);
    const valid = opts.some((o) => o.id === canonical);
    if (!valid) return [];
    const stem = resolveAssetFileStem(categoryId, assetId);
    if (!stem) return [];
    const opt = opts.find((o) => o.id === canonical);
    const preferred = opt?.ext
        ? [String(opt.ext).toLowerCase().replace(/^\./, '')]
        : [];
    const rest = BACKGROUND_FILE_FALLBACK_EXTS.filter((e) => !preferred.includes(e));
    const order = [...preferred, ...rest];
    const seen = new Set();
    const exts = order.filter((e) => {
        if (seen.has(e)) return false;
        seen.add(e);
        return true;
    });
    const fileUrls = [];
    for (const stemVariant of fileStemUrlVariants(stem)) {
        for (const ext of exts) {
            fileUrls.push(publicBackgroundAssetUrl(categoryId, stemVariant, ext));
        }
    }
    const uniqueFileUrls = [...new Set(fileUrls)];
    return [...uniqueFileUrls, CARD_BACKGROUND_IMAGE_PLACEHOLDER];
}

/** @returns {string|null} first candidate URL or null if invalid */
export function resolveCardBackgroundUrl(categoryId, assetId) {
    const urls = resolveCardBackgroundUrlCandidates(categoryId, assetId);
    return urls[0] ?? null;
}

export function getDefaultCardBackgroundId(categoryId) {
    const opts = getCardBackgroundOptions(categoryId);
    return opts[0]?.id ?? null;
}

/**
 * If `url` points at `invitation-card-backgrounds/{category}/{file}`, return canonical option id + category.
 * Used when editing a draft that saved a template asset as `customImage` / `image`.
 * @returns {{ categoryId: string, assetId: string } | null}
 */
export function parsePrivateInvitationCardBackgroundFromUrl(url) {
    if (!url || typeof url !== 'string') return null;
    const m = url.match(/invitation-card-backgrounds\/([a-z0-9_-]+)\/([a-z0-9_-]+)\.(webp|jpe?g|png)/i);
    if (!m) return null;
    const categoryId = m[1].toLowerCase();
    const stem = m[2].toLowerCase();
    const canonical = resolveCanonicalBackgroundId(categoryId, stem) || stem;
    const opts = getCardBackgroundOptions(categoryId);
    if (!opts.some((o) => o.id === canonical)) return null;
    return { categoryId, assetId: canonical };
}

/**
 * Saved social invitation → hero cover for card preview.
 * @returns {{ src: string, mediaType: 'image'|'video', poster?: string|null } | null}
 */
export function getSocialInvitationHeroCoverFromInvitation(invitation) {
    if (!invitation) return null;
    const type = String(invitation.type || '');
    if (type === 'Dating') return null;
    if (type === 'Private' && String(invitation.inviteCategory || '').toLowerCase() === 'private') {
        return null;
    }
    // Uploaded video covers are no longer supported — an existing video cover is hidden,
    // falling through to its poster frame / image / template instead of playing it.
    const img =
        invitation.customImage ||
        invitation.image ||
        invitation.restaurantImage ||
        invitation.coverImage ||
        invitation.videoThumbnail;
    if (img && typeof img === 'string') {
        // Template assets saved as customImage should resolve via cardBackgroundId instead.
        if (!parsePrivateInvitationCardBackgroundFromUrl(img)) {
            return { src: img, mediaType: 'image', poster: null };
        }
    }
    // Template-only social invites have no uploaded image — resolve from cardBackgroundId.
    if (invitation.cardBackgroundId && !invitation.cardGradientId) {
        const categoryId = resolveOccasionCategoryId(invitation.occasionType);
        const templateUrl = resolveCardBackgroundUrl(categoryId, invitation.cardBackgroundId);
        if (templateUrl && templateUrl !== CARD_BACKGROUND_IMAGE_PLACEHOLDER) {
            return { src: templateUrl, mediaType: 'image', poster: null };
        }
    }
    return null;
}

/**
 * Social editor draft → hero from uploaded media.
 * @returns {{ src: string, mediaType: 'image'|'video', poster?: string|null } | null}
 */
export function getSocialHeroCoverFromMediaData(mediaData) {
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
