import {
    collection,
    doc,
    onSnapshot,
    serverTimestamp,
    setDoc,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { uidStr } from './inviteLanding';

const SUBCOLLECTION = 'invite_inbox_dismissals';

/** @returns {import('firebase/firestore').DocumentReference} */
export function inviteInboxDismissalRef(userId, invitationId) {
    return doc(db, 'users', uidStr(userId), SUBCOLLECTION, String(invitationId));
}

/**
 * Persistently hide invite card for this user (view or decline from inbox overlay / landing).
 * @param {string} userId
 * @param {string} invitationId
 * @param {'viewed' | 'declined'} reason
 */
export async function markInviteInboxDismissed(userId, invitationId, reason = 'viewed') {
    const uid = uidStr(userId);
    const invId = String(invitationId || '').trim();
    if (!uid || !invId) return;
    await setDoc(
        inviteInboxDismissalRef(uid, invId),
        {
            invitationId: invId,
            reason,
            dismissedAt: serverTimestamp(),
        },
        { merge: true }
    );
}

/**
 * @param {string} userId
 * @param {(ids: Set<string>) => void} onChange
 */
export function subscribeInviteInboxDismissals(userId, onChange) {
    const uid = uidStr(userId);
    if (!uid) {
        onChange(new Set());
        return () => {};
    }

    return onSnapshot(
        collection(db, 'users', uid, SUBCOLLECTION),
        (snap) => {
            onChange(new Set(snap.docs.map((d) => d.id)));
        },
        (err) => {
            console.warn('[inviteInboxDismissals] listener error', err);
            onChange(new Set());
        }
    );
}
