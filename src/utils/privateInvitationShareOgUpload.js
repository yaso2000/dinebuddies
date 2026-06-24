import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { storage, db } from '../firebase/config';

/** Firebase Storage path for the 9:16 share card JPEG used by WhatsApp OG crawlers. */
export function getPrivateInvitationShareOgStoragePath(invitationId) {
    return `private-invitations/${invitationId}/share-og.jpg`;
}

/**
 * Upload captured share JPEG and persist public URL on the invitation doc.
 * Host-only (enforced by Storage + Firestore rules).
 *
 * @param {string} invitationId
 * @param {File | Blob} file JPEG from html2canvas
 * @param {{ force?: boolean }} [opts] — set force:true to re-upload even if URL exists
 * @returns {Promise<string|null>} download URL or null on skip/failure
 */
export async function uploadPrivateInvitationShareOgImage(invitationId, file, opts = {}) {
    if (!invitationId || !file) return null;

    const invitationRef = doc(db, 'social_invitations', invitationId);

    if (!opts.force) {
        try {
            const snap = await getDoc(invitationRef);
            const existing = snap.exists() ? snap.data()?.shareOgImageUrl : null;
            if (existing && typeof existing === 'string' && existing.startsWith('http')) {
                return existing;
            }
        } catch {
            /* continue to upload */
        }
    }

    try {
        const storageRef = ref(storage, getPrivateInvitationShareOgStoragePath(invitationId));
        await uploadBytes(storageRef, file, {
            contentType: 'image/jpeg',
            cacheControl: 'public, max-age=31536000, immutable',
        });

        const downloadUrl = await getDownloadURL(storageRef);
        const versionedUrl = `${downloadUrl}${downloadUrl.includes('?') ? '&' : '?'}ogv=${Date.now()}`;

        await updateDoc(invitationRef, {
            shareOgImageUrl: versionedUrl,
            shareOgImageUpdatedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });

        return downloadUrl;
    } catch (error) {
        console.warn('[uploadPrivateInvitationShareOgImage]', invitationId, error);
        return null;
    }
}

/**
 * Fire-and-forget OG upload — never blocks the native share sheet.
 * @param {string} invitationId
 * @param {File | null} file
 * @param {{ force?: boolean }} [opts]
 */
export function schedulePrivateInvitationShareOgUpload(invitationId, file, opts = {}) {
    if (!invitationId || !file) return;
    void uploadPrivateInvitationShareOgImage(invitationId, file, opts).catch(() => {
        /* logged inside upload */
    });
}
