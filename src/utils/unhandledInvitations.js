import { resolveInviteCategory } from './inviteCategory';
import { isPendingInviteForUser, uidStr } from './inviteLanding';
import { isPrivateInvitationPublished } from './socialInvitationDraft';

/**
 * Count published private/dating invites awaiting this user's RSVP.
 * @param {object[]} invitations
 * @param {string} viewerUid
 */
export function countUnhandledInvitations(invitations, viewerUid) {
    const uid = uidStr(viewerUid);
    if (!uid || !Array.isArray(invitations)) {
        return { private: 0, dating: 0, total: 0 };
    }

    let privateCount = 0;
    let datingCount = 0;

    for (const inv of invitations) {
        if (!isPrivateInvitationPublished(inv)) continue;
        if (!isPendingInviteForUser(inv, uid)) continue;
        if (resolveInviteCategory(inv) === 'dating') {
            datingCount += 1;
        } else {
            privateCount += 1;
        }
    }

    return { private: privateCount, dating: datingCount, total: privateCount + datingCount };
}
