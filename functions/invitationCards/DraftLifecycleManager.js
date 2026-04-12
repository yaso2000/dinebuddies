/**
 * Final selection: keep one card, remove others from Storage and Firestore.
 */

const admin = require('firebase-admin');

const COLLECTION = 'invitation_card_sessions';

class DraftLifecycleManager {
    constructor() {
        this.db = admin.firestore();
    }

    async finalizeSelection({ draftGroupId, winningCardId, userId }) {
        const ref = this.db.collection(COLLECTION).doc(draftGroupId);
        const snap = await ref.get();
        if (!snap.exists) {
            throw new Error('DraftLifecycleManager: session not found.');
        }
        const data = snap.data();
        if (data.userId !== userId) {
            throw new Error('DraftLifecycleManager: forbidden.');
        }

        const cardsSnap = await ref.collection('cards').get();
        const bucket = admin.storage().bucket();
        const batch = this.db.batch();

        for (const doc of cardsSnap.docs) {
            const cid = doc.id;
            const c = doc.data();
            if (cid === winningCardId) {
                continue;
            }
            if (c.storagePath) {
                try {
                    await bucket.file(c.storagePath).delete({ ignoreNotFound: true });
                } catch (e) {
                    console.warn('DraftLifecycleManager: storage delete', c.storagePath, e.message);
                }
            }
            batch.delete(doc.ref);
        }

        batch.update(ref, {
            finalizedCardId: winningCardId,
            finalizedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        await batch.commit();

        return { success: true, draftGroupId, winningCardId };
    }
}

async function runFinalizeInvitationCardDraft(data, context) {
    const uid = context.auth.uid;
    const draftGroupId = typeof data?.draftGroupId === 'string' ? data.draftGroupId.trim() : '';
    const winningCardId = typeof data?.winningCardId === 'string' ? data.winningCardId.trim() : '';
    if (!draftGroupId || !winningCardId) {
        throw new Error('draftGroupId and winningCardId are required.');
    }
    const mgr = new DraftLifecycleManager();
    return mgr.finalizeSelection({ draftGroupId, winningCardId, userId: uid });
}

module.exports = { DraftLifecycleManager, runFinalizeInvitationCardDraft };
