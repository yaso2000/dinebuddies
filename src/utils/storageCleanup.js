import { ref, deleteObject } from 'firebase/storage';
import { storage } from '../firebase/config';
import { db } from '../firebase/config';
import { doc, getDoc, collection, getDocs, writeBatch, deleteDoc } from 'firebase/firestore';

const FIREBASE_STORAGE_URL_PREFIX = 'https://firebasestorage.googleapis.com/v0/b/';

/**
 * Extract Firebase Storage path from a download URL.
 * Only processes Firebase Storage URLs; returns null for external URLs.
 * @param {string} url - Full download URL
 * @returns {string|null} - Storage path or null
 */
export function extractStoragePathFromUrl(url) {
    if (!url || typeof url !== 'string') return null;
    if (!url.includes('firebasestorage.googleapis.com') || !url.includes('/o/')) return null;
    try {
        const pathPart = url.split('/o/')[1];
        if (!pathPart) return null;
        const path = pathPart.split('?')[0];
        return decodeURIComponent(path);
    } catch {
        return null;
    }
}

/**
 * Delete a single file from Storage by URL (cost-efficient: no list operations).
 * Ignores non-Firebase URLs. Resolves successfully if file already missing (404).
 * @param {string} imageUrl - Firebase Storage download URL
 * @returns {Promise<void>}
 */
export async function deleteStorageFileByUrl(imageUrl) {
    const path = extractStoragePathFromUrl(imageUrl);
    if (!path) return;
    try {
        const storageRef = ref(storage, path);
        await deleteObject(storageRef);
    } catch (err) {
        if (err?.code === 'storage/object-not-found') return;
        console.warn('Storage delete error (skipping):', err?.message || err);
    }
}

/**
 * Delete multiple files from Storage by URLs (cost-efficient: delete by known path only).
 * @param {string[]} urls - Array of Firebase Storage download URLs
 * @returns {Promise<void>}
 */
export async function deleteStorageFilesByUrls(urls) {
    if (!Array.isArray(urls) || urls.length === 0) return;
    const settled = await Promise.allSettled(
        urls.map((url) => deleteStorageFileByUrl(url))
    );
    settled.forEach((r, i) => {
        if (r.status === 'rejected' && r.reason?.code !== 'storage/object-not-found') {
            console.warn('Storage cleanup failed for URL:', urls[i], r.reason);
        }
    });
}

/**
 * Collect invitation doc media URLs (customImage, customVideo, videoThumbnail, image, restaurantImage if Firebase).
 * @param {Object} data - Invitation document data
 * @returns {string[]}
 */
export function getInvitationMediaUrls(data) {
    if (!data) return [];
    const urls = [];
    const fields = ['customImage', 'customVideo', 'videoThumbnail', 'image', 'restaurantImage'];
    fields.forEach((field) => {
        const v = data[field];
        if (v && typeof v === 'string' && v.includes('firebasestorage')) urls.push(v);
    });
    return [...new Set(urls)];
}

/**
 * Collect message doc media URLs (imageUrl, audioUrl, fileUrl / attachment url if present).
 * @param {Object} data - Message document data
 * @returns {string[]}
 */
export function getMessageMediaUrls(data) {
    if (!data) return [];
    const urls = [];
    const fields = ['imageUrl', 'audioUrl', 'fileUrl'];
    fields.forEach((field) => {
        const v = data[field];
        if (v && typeof v === 'string' && v.includes('firebasestorage')) urls.push(v);
    });
    if (data.attachment && typeof data.attachment?.url === 'string' && data.attachment.url.includes('firebasestorage')) {
        urls.push(data.attachment.url);
    }
    return [...new Set(urls)];
}

/**
 * Delete invitation and all related Firestore + Storage (cost-efficient: no list-all).
 * Deletes: invitation media (images/videos), chat messages and their media, then invitation doc.
 * @param {string} invitationId - Document ID
 * @param {string} collectionName - 'invitations' | 'private_invitations'
 * @returns {Promise<boolean>} - true if deleted, false if doc not found
 */
export async function deleteInvitationAndStorage(invitationId, collectionName = 'invitations') {
    if (!invitationId || !collectionName) return false;
    const invRef = doc(db, collectionName, invitationId);
    const invSnap = await getDoc(invRef);
    if (!invSnap.exists()) return false;

    const invData = invSnap.data();
    const messagesRef = collection(db, collectionName, invitationId, 'messages');
    const messagesSnap = await getDocs(messagesRef);

    const urls = [...getInvitationMediaUrls(invData)];
    messagesSnap.docs.forEach((d) => {
        urls.push(...getMessageMediaUrls(d.data()));
    });

    try {
        await deleteStorageFilesByUrls(urls);
    } catch (err) {
        console.warn('Storage cleanup failed (continuing with Firestore delete):', err);
    }

    const batch = writeBatch(db);
    messagesSnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(invRef);
    await batch.commit();
    return true;
}
