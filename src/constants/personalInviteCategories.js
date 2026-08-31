/**
 * Unified relationship categories — the single source of truth for BOTH the profile
 * "Looking for" (أبحث عن) chips (`users.lookingFor`) and the social-invitation
 * category (`social_invitations.personalInviteCategory`). Six warm intents; dating was
 * removed entirely — "serious" (علاقة جدية) is a committed relationship, NOT dating, and
 * "acquaintance" (تعارف) is a light getting-to-know. No hearts.
 */
export const PERSONAL_INVITE_CATEGORIES = [
    {
        id: 'social',
        icon: '✨',
        labelKey: 'personal_invite_cat_social',
        defaultLabel: 'Social',
    },
    {
        id: 'friendship',
        icon: '🤝',
        labelKey: 'personal_invite_cat_friendship',
        defaultLabel: 'Friendship',
    },
    {
        id: 'family',
        icon: '👨‍👩‍👧',
        labelKey: 'personal_invite_cat_family',
        defaultLabel: 'Family',
    },
    {
        id: 'work',
        icon: '💼',
        labelKey: 'personal_invite_cat_work',
        defaultLabel: 'Work',
    },
    {
        id: 'serious',
        icon: '💫',
        labelKey: 'personal_invite_cat_serious',
        defaultLabel: 'Serious relationship',
    },
    {
        id: 'acquaintance',
        icon: '👋',
        labelKey: 'personal_invite_cat_acquaintance',
        defaultLabel: 'Getting acquainted',
    },
];

export const DEFAULT_PERSONAL_INVITE_CATEGORY = 'social';

const VALID = new Set(PERSONAL_INVITE_CATEGORIES.map((c) => c.id));

/** @param {unknown} value */
export function normalizePersonalInviteCategory(value) {
    const id = String(value || '').trim().toLowerCase();
    // Legacy remaps: dating → serious; icebreaker → social; private → default.
    if (id === 'dating') return 'serious';
    if (id === 'icebreaker') return 'social';
    if (VALID.has(id)) return id;
    if (id === 'private') return DEFAULT_PERSONAL_INVITE_CATEGORY;
    return DEFAULT_PERSONAL_INVITE_CATEGORY;
}

/** @param {string} categoryId */
export function getPersonalInviteCategoryMeta(categoryId) {
    const id = normalizePersonalInviteCategory(categoryId);
    return PERSONAL_INVITE_CATEGORIES.find((c) => c.id === id) || PERSONAL_INVITE_CATEGORIES[0];
}

/** @param {string} categoryId @param {(key: string, fallback?: string) => string} t */
export function getPersonalInviteCategoryLabel(categoryId, t) {
    const meta = getPersonalInviteCategoryMeta(categoryId);
    const label = t(meta.labelKey, meta.defaultLabel);
    return `${label} ${meta.icon}`.trim();
}

/** Relationship intentions on member profiles (`users.lookingFor`). */
export const LOOKING_FOR_MAX = PERSONAL_INVITE_CATEGORIES.length;

/** @param {unknown} raw */
export function normalizeLookingFor(raw) {
    if (!Array.isArray(raw)) return [];
    const out = [];
    for (const item of raw) {
        const id = normalizePersonalInviteCategory(item);
        if (!VALID.has(id) || out.includes(id)) continue;
        out.push(id);
        if (out.length >= LOOKING_FOR_MAX) break;
    }
    return out;
}

/** All six relationship categories (kept the opts arg for call-site compatibility). */
export function getLookingForOptions() {
    return PERSONAL_INVITE_CATEGORIES;
}

/** @param {string} id @param {(key: string, fallback?: string) => string} t */
export function getLookingForLabel(id, t) {
    return getPersonalInviteCategoryLabel(id, t);
}
