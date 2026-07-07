import { doc, getDoc, getDocFromServer } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import {
    isHostedInvitationDraft,
    isHostedInvitationPublished,
} from './socialInvitationDraft';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isHostDraft(data, uid) {
    if (!data || !uid) return false;
    return (
        data.authorId === uid ||
        (data.author && typeof data.author === 'object' && data.author.id === uid)
    );
}

/**
 * Load a hosted invitation draft with retries (handles post-write propagation / auth warmup).
 *
 * @param {string} draftId
 * @param {{
 *   maxAttempts?: number;
 *   baseDelayMs?: number;
 *   preferServer?: boolean;
 *   allowPublished?: boolean;
 * }} [options]
 * @returns {Promise<
 *   | { ok: true; id: string; data: object; published?: boolean }
 *   | { ok: false; code: string }
 * >}
 */
export async function fetchHostedInvitationDraft(draftId, options = {}) {
    const {
        maxAttempts = 8,
        baseDelayMs = 150,
        preferServer = true,
        allowPublished = false,
    } = options;

    if (!draftId) {
        return { ok: false, code: 'missing_id' };
    }

    await auth.authStateReady();
    const uid = auth.currentUser?.uid;
    if (!uid) {
        return { ok: false, code: 'not_signed_in' };
    }

    const ref = doc(db, 'social_invitations', draftId);
    let lastCode = 'not_found';

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        try {
            const snap =
                preferServer && attempt < maxAttempts - 1
                    ? await getDocFromServer(ref)
                    : await getDoc(ref);

            if (!snap.exists()) {
                lastCode = 'not_found';
            } else {
                const data = snap.data();
                if (!isHostDraft(data, uid)) {
                    return { ok: false, code: 'permission' };
                }
                if (isHostedInvitationPublished(data)) {
                    if (allowPublished) {
                        return { ok: true, id: draftId, data, published: true };
                    }
                    return { ok: false, code: 'published' };
                }
                if (isHostedInvitationDraft(data)) {
                    return { ok: true, id: draftId, data };
                }
                return { ok: false, code: 'invalid_status' };
            }
        } catch (error) {
            const code = error?.code || '';
            if (code === 'permission-denied') {
                lastCode = 'permission';
            } else if (code === 'unavailable' || code === 'failed-precondition') {
                lastCode = 'unavailable';
            } else {
                throw error;
            }
        }

        if (attempt < maxAttempts - 1) {
            await sleep(baseDelayMs * (attempt + 1));
        }
    }

    return { ok: false, code: lastCode };
}

/** Stronger retry profile used right after editor persist, before preview navigation. */
export function ensureHostedInvitationDraftReady(draftId) {
    return fetchHostedInvitationDraft(draftId, {
        maxAttempts: 10,
        baseDelayMs: 120,
        preferServer: true,
    });
}
