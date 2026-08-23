import { arrayRemove, arrayUnion, updateDoc } from 'firebase/firestore';

/**
 * Toggle the current user's uid in a message's `starredBy` array.
 * @param {import('firebase/firestore').DocumentReference} messageRef
 * @param {string} uid
 * @param {boolean} currentlyStarred
 */
export async function toggleMessageStar(messageRef, uid, currentlyStarred) {
    if (!messageRef || !uid) return;
    await updateDoc(messageRef, {
        starredBy: currentlyStarred ? arrayRemove(uid) : arrayUnion(uid),
    });
}

export function isMessageStarredBy(message, uid) {
    return Array.isArray(message?.starredBy) && message.starredBy.includes(uid);
}
