/**
 * Unified social-invitation categories (six). The stored value is
 * `social_invitations.occasionType` = the English `label`, which resolves to a
 * `categoryId` for the card icon/art via socialCardOccasionMap. "Serious relationship"
 * (علاقة جدية) is a committed relationship — NOT dating — and "Getting acquainted"
 * (تعارف) is a light intro. Kept in sync with personalInviteCategories.js.
 */
export const SOCIAL_INVITE_TYPES = [
    { id: 'social', label: 'Social', labelKey: 'social_type_social', defaultLabel: 'Social' },
    { id: 'friendship', label: 'Friendship', labelKey: 'social_type_friendship', defaultLabel: 'Friendship' },
    { id: 'family', label: 'Family', labelKey: 'social_type_family', defaultLabel: 'Family' },
    { id: 'work', label: 'Work', labelKey: 'social_type_work', defaultLabel: 'Work' },
    { id: 'serious', label: 'Serious relationship', labelKey: 'social_type_serious', defaultLabel: 'Serious relationship' },
    { id: 'acquaintance', label: 'Getting acquainted', labelKey: 'social_type_acquaintance', defaultLabel: 'Getting acquainted' },
];

export const DEFAULT_SOCIAL_INVITE_TYPE_LABEL = 'Social';

const BY_LABEL = new Map(SOCIAL_INVITE_TYPES.map((tpe) => [tpe.label, tpe]));

/** @param {string} label @param {(key: string, fallback?: string) => string} t */
export function getSocialInviteTypeLabel(label, t) {
    const meta = BY_LABEL.get(label) || SOCIAL_INVITE_TYPES[0];
    return t(meta.labelKey, meta.defaultLabel);
}
