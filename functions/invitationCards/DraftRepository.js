/**
 * Firestore persistence for invitation card sessions (one draftGroupId per session).
 */

const admin = require('firebase-admin');

const COLLECTION = 'invitation_card_sessions';

class DraftRepository {
    constructor() {
        this.db = admin.firestore();
    }

    async getSession(draftGroupId) {
        const ref = this.db.collection(COLLECTION).doc(draftGroupId);
        const snap = await ref.get();
        if (!snap.exists) return null;
        return { id: snap.id, ref, data: snap.data() };
    }

    async createSession(draftGroupId, userId, { invitationKind, clientAttemptId }) {
        const ref = this.db.collection(COLLECTION).doc(draftGroupId);
        await ref.set({
            userId,
            invitationKind,
            clientAttemptId: clientAttemptId || '',
            attemptCount: 0,
            fingerprints: [],
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return ref;
    }

    async appendAttempt(draftGroupId, { attemptIndex, cards, newFingerprints }) {
        const ref = this.db.collection(COLLECTION).doc(draftGroupId);
        const batch = this.db.batch();

        batch.update(ref, {
            attemptCount: attemptIndex,
            fingerprints: admin.firestore.FieldValue.arrayUnion(...newFingerprints),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        for (const c of cards) {
            const cardRef = ref.collection('cards').doc(c.cardId);
            batch.set(cardRef, {
                attemptIndex,
                slotIndex: c.slotIndex,
                textOverlay: c.textOverlay,
                imageUrl: c.imageUrl,
                storagePath: c.storagePath,
                animationProfile: c.animationProfile || null,
                provenance: c.provenance || {},
                fingerprint: c.fingerprint,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }

        await batch.commit();
    }

    async listCards(draftGroupId) {
        const snap = await this.db.collection(COLLECTION).doc(draftGroupId).collection('cards').get();
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }
}

module.exports = DraftRepository;
