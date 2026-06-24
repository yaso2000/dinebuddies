/** Personal (1-on-1) invite intent — stored on `social_invitations.personalInviteCategory`. */
export const PERSONAL_INVITE_CATEGORIES = [
    {
        id: 'dating',
        icon: '💕',
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
        id: 'icebreaker',
        icon: '✨',
        labelKey: 'personal_invite_cat_icebreaker',
        defaultLabel: 'Getting acquainted',
    },
];

export const DEFAULT_PERSONAL_INVITE_CATEGORY = 'friendship';

const VALID = new Set(PERSONAL_INVITE_CATEGORIES.map((c) => c.id));

/** @param {unknown} value */
export function normalizePersonalInviteCategory(value) {
    const id = String(value || '').trim().toLowerCase();
    if (VALID.has(id)) return id;
    // Legacy rows before category field existed
    if (id === 'private' || id === 'social') return DEFAULT_PERSONAL_INVITE_CATEGORY;
    return DEFAULT_PERSONAL_INVITE_CATEGORY;
}

/** @param {string} categoryId */
export function getPersonalInviteCategoryMeta(categoryId) {
    const id = normalizePersonalInviteCategory(categoryId);
    return PERSONAL_INVITE_CATEGORIES.find((c) => c.id === id) || PERSONAL_INVITE_CATEGORIES[1];
}
