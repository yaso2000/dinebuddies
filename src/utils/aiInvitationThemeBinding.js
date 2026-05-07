/**
 * Public invitation card: font list and cover animation slugs (stored on invitations / composer).
 */

export const PUBLIC_INVITATION_FONT_OPTIONS = [
    { label: 'Playfair Display', cssFamily: "'Playfair Display', Georgia, serif" },
    { label: 'Cormorant Garamond', cssFamily: "'Cormorant Garamond', 'Times New Roman', serif" },
    { label: 'Lora', cssFamily: "'Lora', Georgia, serif" },
    { label: 'Montserrat', cssFamily: "'Montserrat', 'Segoe UI', sans-serif" },
    { label: 'Dancing Script', cssFamily: "'Dancing Script', cursive" },
    { label: 'Great Vibes', cssFamily: "'Great Vibes', cursive" },
];

/** Canonical values for `animation_meta.type` and `coverAnimationType` in Firestore. */
export const INVITATION_COVER_ANIMATION_TYPES = ['elegant-fade', 'gentle-pulse', 'glide-up', 'none'];

/** Legacy `coverAnimationType` → canonical slug (for stored invitations). */
export const LEGACY_COVER_ANIMATION_TO_CANONICAL = {
    'slow-fade': 'elegant-fade',
    'elegant-pulse': 'gentle-pulse',
    'subtle-zoom': 'glide-up',
    glitter: 'gentle-pulse',
    sparkle: 'gentle-pulse',
};

export function slugifyCoverAnimationType(raw) {
    return String(raw ?? '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-');
}

/**
 * Normalize for composer: always one of {@link INVITATION_COVER_ANIMATION_TYPES}.
 * Empty input defaults to gentle-pulse.
 * @param {string | undefined | null} raw
 * @returns {'elegant-fade' | 'gentle-pulse' | 'glide-up' | 'none'}
 */
export function normalizeCoverAnimationType(raw) {
    if (raw === undefined || raw === null || raw === '') return 'gentle-pulse';
    const slug = slugifyCoverAnimationType(raw);
    if (!slug) return 'gentle-pulse';
    if (INVITATION_COVER_ANIMATION_TYPES.includes(slug)) return slug;
    if (LEGACY_COVER_ANIMATION_TO_CANONICAL[slug]) {
        return LEGACY_COVER_ANIMATION_TO_CANONICAL[slug];
    }
    return 'gentle-pulse';
}

/**
 * For Framer Motion: missing field → no motion; explicit `none` → no motion.
 * Unknown non-empty values fall back to gentle-pulse (motion on).
 * @param {string | undefined | null} raw
 * @returns {'elegant-fade' | 'gentle-pulse' | 'glide-up' | null}
 */
export function resolveCoverAnimationForMotion(raw) {
    if (raw === undefined || raw === null || raw === '') return null;
    const slug = slugifyCoverAnimationType(raw);
    if (!slug || slug === 'none') return null;
    if (INVITATION_COVER_ANIMATION_TYPES.includes(slug) && slug !== 'none') return slug;
    if (LEGACY_COVER_ANIMATION_TO_CANONICAL[slug]) {
        const c = LEGACY_COVER_ANIMATION_TO_CANONICAL[slug];
        return c === 'none' ? null : c;
    }
    return 'gentle-pulse';
}
