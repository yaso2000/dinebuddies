import { doc, updateDoc, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

/** @param {unknown} v */
export function asUidArray(v) {
    if (!Array.isArray(v)) return [];
    return v.filter((x) => typeof x === 'string' && x.length > 0);
}

/**
 * Returns invitee IDs who accept direct outreach from `authorId`
 * (not in their blockedUserIds / mutedUserIds vs author).
 */
export async function filterInviteesWhoAcceptAuthor(authorId, inviteeIds) {
    const raw = asUidArray(inviteeIds);
    if (!authorId || raw.length === 0) return { allowed: [], skipped: [] };
    const allowed = [];
    const skipped = [];
    for (const fid of raw) {
        try {
            const snap = await getDoc(doc(db, 'users', fid));
            const d = snap.data() || {};
            const blocked = asUidArray(d.blockedUserIds);
            const muted = asUidArray(d.mutedUserIds);
            if (blocked.includes(authorId) || muted.includes(authorId)) {
                skipped.push(fid);
            } else {
                allowed.push(fid);
            }
        } catch {
            skipped.push(fid);
        }
    }
    return { allowed, skipped };
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
    const theirBlocked = asUidArray(otherUserDoc?.blockedUserIds);
    const theirMuted = asUidArray(otherUserDoc?.mutedUserIds);
    if (myBlocked.includes(otherUid) || myMuted.includes(otherUid)) {
        return { restricted: true, reason: 'viewer_list' };
    }
    if (theirBlocked.includes(viewerUid) || theirMuted.includes(viewerUid)) {
        return { restricted: true, reason: 'other_list' };
    }
    return { restricted: false, reason: null };
}
