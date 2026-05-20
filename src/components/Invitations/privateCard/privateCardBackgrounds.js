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
    const fileUrls = exts.map((ext) =>
        publicAssetUrl(`invitation-card-backgrounds/${categoryId}/${stem}.${ext}`)
    );
    return [...fileUrls, CARD_BACKGROUND_IMAGE_PLACEHOLDER];
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
