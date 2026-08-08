/** Personal (1-on-1) invite intent — stored on `social_invitations.personalInviteCategory` and `users.lookingFor`. */
export const PERSONAL_INVITE_CATEGORIES = [
    {
        id: 'dating',
        icon: '❤️',
        labelKey: 'personal_invite_cat_dating',
        defaultLabel: 'Dating',
    },
    {
        id: 'friendship',
        icon: '🤝',
        labelKey: 'personal_invite_cat_friendship',
        defaultLabel: 'Friendship',
    },
    {
        id: 'social',
        icon: '✨',
        labelKey: 'personal_invite_cat_social',
        defaultLabel: 'Social',
    },
];

export const DEFAULT_PERSONAL_INVITE_CATEGORY = 'friendship';

const VALID = new Set(PERSONAL_INVITE_CATEGORIES.map((c) => c.id));

/** @param {unknown} value */
export function normalizePersonalInviteCategory(value) {
    const id = String(value || '').trim().toLowerCase();
    if (id === 'icebreaker') return 'social';
    if (VALID.has(id)) return id;
    if (id === 'private') return DEFAULT_PERSONAL_INVITE_CATEGORY;
    return DEFAULT_PERSONAL_INVITE_CATEGORY;
}

/** @param {string} categoryId */
export function getPersonalInviteCategoryMeta(categoryId) {
    const id = normalizePersonalInviteCategory(categoryId);
    return PERSONAL_INVITE_CATEGORIES.find((c) => c.id === id) || PERSONAL_INVITE_CATEGORIES[1];
}

/** @param {string} categoryId @param {(key: string, fallback?: string) => string} t */
export function getPersonalInviteCategoryLabel(categoryId, t) {
    const meta = getPersonalInviteCategoryMeta(categoryId);
    const label = t(meta.labelKey, meta.defaultLabel);
    return `${label} ${meta.icon}`.trim();
}

/** Relationship intentions on member profiles (`users.lookingFor`). */
export const LOOKING_FOR_MAX = PERSONAL_INVITE_CATEGORIES.length;

/** @param {unknown} raw @param {{ includeDating?: boolean }} [opts] */
export function normalizeLookingFor(raw, { includeDating = true } = {}) {
    if (!Array.isArray(raw)) return [];
    const out = [];
    for (const item of raw) {
        const id = normalizePersonalInviteCategory(item);
        if (!VALID.has(id) || out.includes(id)) continue;
        if (id === 'dating' && !includeDating) continue;
        out.push(id);
        if (out.length >= LOOKING_FOR_MAX) break;
    }
    return out;
}

/** @param {{ includeDating?: boolean }} [opts] */
export function getLookingForOptions({ includeDating = true } = {}) {
    if (includeDating) return PERSONAL_INVITE_CATEGORIES;
    return PERSONAL_INVITE_CATEGORIES.filter((c) => c.id !== 'dating');
}

/** @param {string} id @param {(key: string, fallback?: string) => string} t */
export function getLookingForLabel(id, t) {
    return getPersonalInviteCategoryLabel(id, t);
}
