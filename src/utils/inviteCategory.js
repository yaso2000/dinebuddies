/**
 * Resolve hosted invitation category: `social` (up to 30 guests) or `private` (1-on-1, formerly dating).
 * Supports legacy Firestore values written before the rename migration.
 * @param {Record<string, unknown>} invite
 * @returns {'social' | 'private'}
 */
export function resolveInviteCategory(invite) {
    const type = String(invite?.type || '');
    const occ = String(invite?.occasionType || '').toLowerCase();
    const cat = String(invite?.inviteCategory || '').toLowerCase();

    // Legacy + new private (formerly dating)
    if (
        type === 'Dating' ||
        occ === 'dating' ||
        cat === 'dating' ||
        (invite?.datingInvitationPreference != null && invite?.datingInvitationPreference !== false)
    ) {
        return 'private';
    }

    if (type === 'Social' || cat === 'social' || occ === 'social') {
        return 'social';
    }

    // New private (formerly dating) — type Private + personalInviteCategory or private card fields
    const inviteeCount = Array.isArray(invite?.invitedFriends) ? invite.invitedFriends.length : 0;
    if (
        (type === 'Private' || occ === 'private' || cat === 'private') &&
        inviteeCount <= 1 &&
        (String(invite?.personalInviteCategory || '').length > 0 ||
            invite?.privateInvitationPreference != null ||
            invite?.privateCardThemeColor != null ||
            invite?.datingCardThemeColor != null)
    ) {
        return 'private';
    }

    // Legacy social (was type Private + inviteCategory private, multi-guest)
    return 'social';
}

/** @deprecated use resolveInviteCategory */
export const resolvePrivateInviteCategory = resolveInviteCategory;

/** @param {Record<string, unknown>} invite */
export function isPrivateHostedInvitation(invite) {
    return resolveInviteCategory(invite) === 'private';
}

/** @param {Record<string, unknown>} invite */
export function isSocialHostedInvitation(invite) {
    return resolveInviteCategory(invite) === 'social';
}
