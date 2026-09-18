import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase/config';

/** @param {unknown} v */
export function asUidArray(v) {
    if (!Array.isArray(v)) return [];
    return v.filter((x) => typeof x === 'string' && x.length > 0);
}

/**
 * Invitees who accept direct outreach from `authorId`. Whether an invitee
 * blocked/muted the author is now enforced SERVER-SIDE at publish/notify time
 * (functions publishPrivateInvitationDraft filters blocked/muted/minor invitees),
 * so the client no longer reads each invitee's private block/mute lists.
 * @returns {Promise<{ allowed: string[], skipped: string[] }>}
 */
export async function filterInviteesWhoAcceptAuthor(authorId, inviteeIds) {
    const raw = asUidArray(inviteeIds);
    if (!authorId || raw.length === 0) return { allowed: [], skipped: [] };
    return { allowed: raw, skipped: [] };
}

export async function toggleUserBlock(myUid, targetUid, shouldBlock) {
    if (!myUid || !targetUid || myUid === targetUid) return;
    const ref = doc(db, 'users', myUid);
    if (shouldBlock) {
        await updateDoc(ref, {
            blockedUserIds: arrayUnion(targetUid),
            mutedUserIds: arrayRemove(targetUid)
        });
    } else {
        await updateDoc(ref, {
            blockedUserIds: arrayRemove(targetUid)
        });
    }
}

export async function toggleUserMute(myUid, targetUid, shouldMute) {
    if (!myUid || !targetUid || myUid === targetUid) return;
    const ref = doc(db, 'users', myUid);
    if (shouldMute) {
        await updateDoc(ref, {
            mutedUserIds: arrayUnion(targetUid),
            blockedUserIds: arrayRemove(targetUid)
        });
    } else {
        await updateDoc(ref, {
            mutedUserIds: arrayRemove(targetUid)
        });
    }
}

export function isAuthorHiddenForViewer(viewerProfile, authorId) {
    if (!authorId || !viewerProfile) return false;
    return asUidArray(viewerProfile.blockedUserIds).includes(authorId);
}

/** Private / private invites from this author should be hidden (mute). */
export function isAuthorMutedForViewer(viewerProfile, authorId) {
    if (!authorId || !viewerProfile) return false;
    return asUidArray(viewerProfile.mutedUserIds).includes(authorId);
}

export function messagingRestrictedBetweenUsers(viewerProfile, viewerUid, otherUserDoc, otherUid) {
    if (!viewerUid || !otherUid) return { restricted: true, reason: 'invalid' };
    if (otherUserDoc?.isSystemAccount === true) {
        return { restricted: false, reason: null };
    }
    const myBlocked = asUidArray(viewerProfile?.blockedUserIds);
    const myMuted = asUidArray(viewerProfile?.mutedUserIds);
    if (myBlocked.includes(otherUid) || myMuted.includes(otherUid)) {
        return { restricted: true, reason: 'viewer_list' };
    }
    // Whether the OTHER user blocked/muted the viewer is enforced server-side
    // (createOrGetConversation checks both directions). Not read client-side — that
    // would require the other member's private lists and reveal blocks to the viewer.
    return { restricted: false, reason: null };
}
