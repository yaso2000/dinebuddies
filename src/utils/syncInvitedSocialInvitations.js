import { collection, doc, getDoc, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Load private invitations this user was invited to via inbox notifications + getDoc.
 * Avoids private_invitations list queries (Firestore rules reject array-contains list for some accounts).
 */
export function listenInvitedPrivateInvitations(sessionUid, onUpdate, onError) {
    const qNotif = query(
        collection(db, 'notifications'),
        where('userId', '==', sessionUid),
        orderBy('createdAt', 'desc'),
        limit(100)
    );

    let seq = 0;

    return onSnapshot(
        qNotif,
        async (snap) => {
            const mySeq = ++seq;
            const ids = [
                ...new Set(
                    snap.docs
                        .map((d) => d.data())
                        .filter(
                            (n) =>
                                n.type === 'social_invitation' &&
                                typeof n.invitationId === 'string' &&
                                n.invitationId
                        )
                        .map((n) => n.invitationId)
                ),
            ];

            const rows = [];
            await Promise.all(
                ids.map(async (invId) => {
                    try {
                        const invSnap = await getDoc(doc(db, 'social_invitations', invId));
                        if (invSnap.exists()) {
                            rows.push({ id: invSnap.id, ...invSnap.data() });
                        }
                    } catch (e) {
                        const code = e?.code || '';
                        if (code !== 'permission-denied') {
                            console.error('Load invited private invitation:', invId, e);
                        }
                    }
                })
            );

            if (mySeq === seq) onUpdate(rows);
        },
        onError
    );
}
