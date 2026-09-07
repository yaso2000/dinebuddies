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

/**
 * Occasion types that are strictly one-on-one: تعارف (Getting acquainted) and
 * علاقة جدية (Serious relationship) — these invite exactly ONE person.
 * Matched by both stored label and category id for safety.
 */
export const SINGLE_INVITEE_OCCASIONS = new Set([
    'Serious relationship', 'Getting acquainted', 'serious', 'acquaintance',
]);

/** Upper bound on invitees for a normal (multi-guest) social invitation. */
export const SOCIAL_MAX_INVITEES = 100;

/** Max invitees allowed for a given occasionType label/id (1 for تعارف/علاقة جدية). */
export function maxInviteesForOccasion(occasionType) {
    return SINGLE_INVITEE_OCCASIONS.has(occasionType) ? 1 : SOCIAL_MAX_INVITEES;
}

const BY_LABEL = new Map(SOCIAL_INVITE_TYPES.map((tpe) => [tpe.label, tpe]));

/** @param {string} label @param {(key: string, fallback?: string) => string} t */
export function getSocialInviteTypeLabel(label, t) {
    const meta = BY_LABEL.get(label) || SOCIAL_INVITE_TYPES[0];
    return t(meta.labelKey, meta.defaultLabel);
}
