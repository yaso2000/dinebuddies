/**
 * Derive invitation buckets for the signed-in user's profile page.
 * @param {{ invitations: any[]; privateInvitations: any[]; profileUid: string }} p
 */
export function buildProfileInvitationLists({ invitations, privateInvitations, profileUid }) {
    const invs = invitations || [];
    const priv = privateInvitations || [];

    const myPostedInvitations = invs.filter((inv) => inv.author?.id === profileUid);
    const publicPosted = myPostedInvitations.filter((inv) => inv.privacy !== 'private');

    const privatePostedLegacy = myPostedInvitations.filter((inv) => inv.privacy === 'private');
    const hostedFromPrivateColl = priv
        .filter((inv) => (inv.authorId || inv.author?.id) === profileUid)
        .map((inv) => ({ ...inv, privacy: 'private' }));
    const legacyPrivateIds = new Set(privatePostedLegacy.map((i) => i.id));
    const privatePosted = [
        ...privatePostedLegacy,
        ...hostedFromPrivateColl.filter((inv) => !legacyPrivateIds.has(inv.id)),
    ];

    const receivedPrivate = priv
        .filter(
            (inv) =>
                Array.isArray(inv.invitedFriends) &&
                inv.invitedFriends.includes(profileUid) &&
                (inv.authorId || inv.author?.id) !== profileUid
        )
        .map((inv) => ({ ...inv, privacy: 'private' }));

    const myJoinedInvitations = invs.filter((inv) => inv.joined?.includes(profileUid));

    return {
        publicPosted,
        privatePosted,
        receivedPrivate,
        myJoinedInvitations,
    };
}
