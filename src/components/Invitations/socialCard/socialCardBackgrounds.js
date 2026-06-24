/**
 * Card backgrounds: files in `public/invitation-card-backgrounds/{category}/{id}.webp`.
 * `id` must match the filename stem on disk. Legacy Firestore ids are mapped in BIRTHDAY_LEGACY_CANONICAL_ID.
 * Optional per-row `fileStem` / `ext` — see resolveCardBackgroundUrlCandidates.
 */
/** Template ids whose artwork is predominantly dark — frame text must be lifted for contrast */
export const DARK_TEMPLATE_BACKGROUND_IDS = new Set(['birthday-dark', 'birthday-dark-1', 'birthday-dark-neon']);

/** New private-invite create: default occasion + first birthday template art */
export const DEFAULT_PRIVATE_OCCASION_LABEL = 'Birthday';
export const DEFAULT_PRIVATE_CARD_BACKGROUND_ID = 'birthday-warm';

/** Typographic apostrophe (U+2019) — matches Windows/macOS “smart quote” filenames on disk. */
const CURLY_APOSTROPHE = '\u2019';

export const CARD_BACKGROUNDS_BY_CATEGORY = {
    birthday: [
        { id: 'birthday-warm' },
        { id: 'birthday-candlecake' },
        { id: 'birthday-fun' },
        { id: 'birthday-dark' },
        { id: 'birthday-dark-1' },
        { id: 'birthday-dark-neon' },
        { id: 'birthday-kids' },
        { id: 'birthday-kids2' },
        { id: 'birthday-gold' },
        { id: 'birthday-gold2' }
    ],
    cafe: [
        { id: 'cafe-1' },
        { id: 'cafe-2' },
        { id: 'cafe-3' },
        { id: 'cafe-4' },
        { id: 'cafe-5' },
        { id: 'cafe-6' },
        { id: 'cafe-7' },
        { id: 'cafe-8' },
        { id: 'cafe-9' },
        { id: 'cafe-10' }
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
    nightlife: [
        { id: 'nightlife-1' },
        { id: 'nightlife-2' },
        { id: 'nightlife-3' },
        { id: 'nightlife-4' },
        { id: 'nightlife-5' },
        { id: 'nightlife-6' },
        { id: 'nightlife-7' },
        { id: 'nightlife-8' },
        { id: 'nightlife-9' },
        { id: 'nightlife-10' }
    ],
    dining: [
        { id: 'dining-1' },
        { id: 'dining-2' },
        { id: 'dining-3' },
        { id: 'dining-4' },
        { id: 'dining-5' },
        { id: 'dining-6' },
        { id: 'dining-7' },
        { id: 'dining-8' },
        { id: 'dining-9' },
        { id: 'dining-10' },
        { id: 'dining-11' }
    ],
    gaming: [
        { id: 'gaming-1' },
        { id: 'gaming-2' },
        { id: 'gaming-3' },
        { id: 'gaming-4' },
        { id: 'gaming-5' },
        { id: 'gaming-6' },
        { id: 'gaming-7' },
        { id: 'gaming-8' },
        { id: 'gaming-9' },
        { id: 'gaming-10' }
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
        { id: 'family-10' },
        { id: 'family-11' },
        { id: 'family-12' },
        { id: 'family-13' }
    ],
    /** fileStem matches on-disk filename (spaces + typographic apostrophe kept). */
    celebration: [
        { id: 'celebration-mothers-day', fileStem: `Mother${CURLY_APOSTROPHE}s Day` },
        { id: 'celebration-fathers-day', fileStem: `Father${CURLY_APOSTROPHE}s Day` },
        { id: 'celebration-christmas', fileStem: 'Christmas' },
        { id: 'celebration-thanksgiving', fileStem: 'Thanksgiving' },
        { id: 'celebration-halloween', fileStem: 'Halloween' },
        { id: 'celebration-new-year-1', fileStem: 'New Year1' },
        { id: 'celebration-new-year-2', fileStem: 'New Year2' },
        { id: 'celebration-new-year-3', fileStem: 'New Year3' },
        { id: 'celebration-valentines-day-1', fileStem: `Valentine${CURLY_APOSTROPHE}s Day1` },
        { id: 'celebration-valentines-day-2', fileStem: `Valentine${CURLY_APOSTROPHE}s Day2` },
        { id: 'celebration-valentines-day-3', fileStem: `Valentine${CURLY_APOSTROPHE}s Day3` },
        { id: 'celebration-valentines-day-4', fileStem: `Valentine${CURLY_APOSTROPHE}s Day4` },
        { id: 'celebration-ramadan', fileStem: 'Ramadan' },
        { id: 'celebration-eid-al-fitr', fileStem: 'Eid al-Fitr' },
        { id: 'celebration-wedding', fileStem: 'Wedding' },
        { id: 'celebration-wedding-2', fileStem: 'Wedding2' },
        { id: 'celebration-wedding-3', fileStem: 'Wedding3' },
        { id: 'celebration-wedding-4', fileStem: 'Wedding4' },
        { id: 'celebration-graduation', fileStem: 'Graduation' },
        { id: 'celebration-baby-gender-reveal', fileStem: 'Baby Gender Reveal' },
        { id: 'celebration-reunion', fileStem: 'Reunion' }
    ],
    cinema: [
        { id: 'cinema-1' },
        { id: 'cinema-2' },
        { id: 'cinema-3' },
        { id: 'cinema-4' },
        { id: 'cinema-5' },
        { id: 'cinema-6' },
        { id: 'cinema-7' },
        { id: 'cinema-8' },
        { id: 'cinema-9' },
        { id: 'cinema-10' }
    ],
    sports: [
        { id: 'sports-1' },
        { id: 'sports-2' },
        { id: 'sports-3' },
        { id: 'sports-4' },
        { id: 'sports-5' },
        { id: 'sports-6' },
        { id: 'sports-7' },
        { id: 'sports-8' },
        { id: 'sports-9' },
        { id: 'sports-10' }
    ],
    concert: [
        { id: 'concert-1' },
        { id: 'concert-2' },
        { id: 'concert-3' },
        { id: 'concert-4' },
        { id: 'concert-5' },
        { id: 'concert-6' },
        { id: 'concert-7' },
        { id: 'concert-8' },
        { id: 'concert-9' },
        { id: 'concert-10' }
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
    if (!categoryId || typeof categoryId !== 'string') return [];
    return CARD_BACKGROUNDS_BY_CATEGORY[categoryId] || [];
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
    const vid = invitation.customVideo;
    if (vid) {
        return { src: vid, mediaType: 'video', poster: invitation.videoThumbnail || null };
    }
    const img = invitation.customImage || invitation.image;
    if (!img || typeof img !== 'string') return null;
    return { src: img, mediaType: 'image', poster: null };
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
