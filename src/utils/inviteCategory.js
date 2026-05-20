/** @param {Record<string, unknown>} invite */
export function resolvePrivateInviteCategory(invite) {
    const occ = String(invite?.occasionType || '').toLowerCase();
    if (
        invite?.type === 'Dating' ||
        occ === 'dating' ||
        (invite?.datingInvitationPreference != null && invite?.datingInvitationPreference !== false)
    ) {
        return 'dating';
    }
    return 'private';
}
