/**
 * Unified social-invitation categories (five). The stored value is
 * `social_invitations.occasionType` = the English `label`, which resolves to a
 * `categoryId` for the card icon/art via socialCardOccasionMap. "Getting acquainted"
 * (تعارف) is a light intro. Legacy "Serious relationship" invitations render as
 * "Getting acquainted". Kept in sync with personalInviteCategories.js.
 */
export const SOCIAL_INVITE_TYPES = [
    { id: 'social', label: 'Social', labelKey: 'social_type_social', defaultLabel: 'Social' },
    { id: 'friendship', label: 'Friendship', labelKey: 'social_type_friendship', defaultLabel: 'Friendship' },
    { id: 'family', label: 'Family', labelKey: 'social_type_family', defaultLabel: 'Family' },
    { id: 'work', label: 'Work', labelKey: 'social_type_work', defaultLabel: 'Work' },
    { id: 'acquaintance', label: 'Getting acquainted', labelKey: 'social_type_acquaintance', defaultLabel: 'Getting acquainted' },
];

export const DEFAULT_SOCIAL_INVITE_TYPE_LABEL = 'Social';

/**
 * No occasion is capped at a single invitee anymore. Two-person meet-ups are
 * still allowed (the host just invites one guest), but nothing FORCES a 1/1
 * invite — that one-on-one "private" shape was a dating leftover and is removed.
 * Kept as an empty set so existing imports keep working.
 */
export const SINGLE_INVITEE_OCCASIONS = new Set();

/** Upper bound on invitees for a social invitation. */
export const SOCIAL_MAX_INVITEES = 100;

/** Max invitees allowed for a given occasionType — always the multi-guest max. */
export function maxInviteesForOccasion() {
    return SOCIAL_MAX_INVITEES;
}

const BY_LABEL = new Map(SOCIAL_INVITE_TYPES.map((tpe) => [tpe.label, tpe]));
const LEGACY_LABELS = { 'Serious relationship': 'Getting acquainted', Dating: 'Getting acquainted' };

/** Map a stored occasionType label to a current one (legacy-safe). */
export function normalizeSocialInviteTypeLabel(label) {
    const l = String(label || '');
    if (BY_LABEL.has(l)) return l;
    return LEGACY_LABELS[l] || DEFAULT_SOCIAL_INVITE_TYPE_LABEL;
}

/** @param {string} label @param {(key: string, fallback?: string) => string} t */
export function getSocialInviteTypeLabel(label, t) {
    const meta = BY_LABEL.get(normalizeSocialInviteTypeLabel(label)) || SOCIAL_INVITE_TYPES[0];
    return t(meta.labelKey, meta.defaultLabel);
}
