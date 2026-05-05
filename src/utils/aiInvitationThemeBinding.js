import { COLOR_SCHEMES } from './invitationTemplates';

/**
 * Map Gemini / API frame label (matches COLOR_SCHEMES[].name) to `formData.colorScheme` key.
 * @param {string} label
 * @returns {string | null}
 */
export function mapAiFrameTextColorToColorSchemeKey(label) {
    const s = String(label || '').trim().toLowerCase();
    if (!s) return null;
    const hit = Object.entries(COLOR_SCHEMES).find(
        ([, v]) => String(v?.name || '').trim().toLowerCase() === s
    );
    return hit ? hit[0] : null;
}

/** AI model font labels → CSS stacks (aligned with api/generate-image DINE_FONT_LABELS). */
export const PUBLIC_INVITATION_FONT_OPTIONS = [
    { label: 'Playfair Display', cssFamily: "'Playfair Display', Georgia, serif" },
    { label: 'Cormorant Garamond', cssFamily: "'Cormorant Garamond', 'Times New Roman', serif" },
    { label: 'Lora', cssFamily: "'Lora', Georgia, serif" },
    { label: 'Montserrat', cssFamily: "'Montserrat', 'Segoe UI', sans-serif" },
    { label: 'Dancing Script', cssFamily: "'Dancing Script', cursive" },
    { label: 'Great Vibes', cssFamily: "'Great Vibes', cursive" },
];

/**
 * @param {string} label
 * @returns {string | null} css font-family value
 */
export function mapAiFontNameToCssFamily(label) {
    const s = String(label || '').trim().toLowerCase();
    if (!s) return null;
    const opt = PUBLIC_INVITATION_FONT_OPTIONS.find((o) => o.label.toLowerCase() === s);
    if (opt) return opt.cssFamily;
    const partial = PUBLIC_INVITATION_FONT_OPTIONS.find(
        (o) => s.includes(o.label.toLowerCase()) || o.label.toLowerCase().includes(s)
    );
    return partial ? partial.cssFamily : null;
}

/** `inviteMood` key → concise tone phrase for Gemini (aligned with public vibe picker). */
const INVITE_MOOD_TO_TONE_PHRASE = {
    social: 'warm friendly social dining',
    family: 'cozy family-friendly gathering',
    celebratory: 'festive celebratory high-energy',
    friends: 'laid-back casual friends hangout',
    new_friends: 'welcoming open meet-new-people',
    formal: 'polished formal elegant',
};

/**
 * Optional `userPreferences` for `/api/generate-image` from public invitation composer state.
 * Uses `inviteMood`, venue `type`, color scheme, and card font.
 *
 * @param {Record<string, unknown>} formData
 * @returns {Record<string, string> | undefined}
 */
export function buildPublicInvitationUserPreferencesForAi(formData) {
    if (!formData || typeof formData !== 'object') return undefined;
    const out = {};
    const mood = String(formData.inviteMood || '').trim();
    if (mood && INVITE_MOOD_TO_TONE_PHRASE[mood]) {
        out.tonePreference = INVITE_MOOD_TO_TONE_PHRASE[mood];
        out.inviteMood = mood;
    }
    const venue = String(formData.type || '').trim();
    if (venue) out.venueType = venue;

    const scheme = COLOR_SCHEMES[formData.colorScheme];
    const colorName = scheme?.name && String(scheme.name).trim();
    if (colorName) out.colorPreference = colorName;

    const css = String(formData.cardFontFamily || '').trim();
    if (css) {
        const match = PUBLIC_INVITATION_FONT_OPTIONS.find((o) => o.cssFamily === css);
        if (match?.label) out.fontPreference = match.label;
    }

    return Object.keys(out).length ? out : undefined;
}

/**
 * Map Gemini `style_suggestion` token to an `inviteMood` key (public invitations).
 * @param {string} suggestion
 * @returns {string | null}
 */
export function mapStyleSuggestionToInviteMood(suggestion) {
    const s = String(suggestion || '').trim().toLowerCase();
    if (!s) return null;
    const table = [
        [['romantic', 'date', 'love', 'social'], 'social'],
        [['formal', 'business', 'work', 'corporate'], 'formal'],
        [['cozy', 'coffee', 'cafe', 'casual', 'friendly'], 'friends'],
        [['celebrat', 'party', 'birthday', 'night'], 'celebratory'],
        [['family', 'kids', 'bbq'], 'family'],
        [['new', 'stranger', 'network', 'meetup group'], 'new_friends'],
    ];
    for (const [needles, mood] of table) {
        if (needles.some((n) => s.includes(n))) return mood;
    }
    return null;
}

/** Canonical values for `animation_meta.type` (Gemini atomic API) and `coverAnimationType` in Firestore — keep in sync with `api/generate-image.js`. */
export const INVITATION_COVER_ANIMATION_TYPES = ['elegant-fade', 'gentle-pulse', 'glide-up', 'none'];

/** Legacy `coverAnimationType` / model output → canonical slug (for stored invitations). */
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
 * Normalize for composer / API apply: always one of {@link INVITATION_COVER_ANIMATION_TYPES}.
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
