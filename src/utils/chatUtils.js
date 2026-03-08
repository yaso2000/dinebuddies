import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Mark a user as online in Firestore.
 * Stores isOnline: true + lastSeen timestamp on the users/{uid} document.
 */
export const setUserOnline = async (uid) => {
    if (!uid) return;
    try {
        await updateDoc(doc(db, 'users', uid), {
            isOnline: true,
            lastSeen: serverTimestamp(),
        });
    } catch (e) {
        // Silently fail — presence is non-critical
        console.warn('setUserOnline failed:', e.message);
    }
};

/**
 * Mark a user as offline in Firestore.
 * Stores isOnline: false + lastSeen timestamp on the users/{uid} document.
 */
export const setUserOffline = async (uid) => {
    if (!uid) return;
    try {
        await updateDoc(doc(db, 'users', uid), {
            isOnline: false,
            lastSeen: serverTimestamp(),
        });
    } catch (e) {
        console.warn('setUserOffline failed:', e.message);
    }
};

/**
 * Format a Firestore Timestamp or Date into a "last seen X ago" string.
 */
export const formatLastSeen = (ts) => {
    if (!ts) return 'Offline';
    const date = ts?.toDate ? ts.toDate() : new Date(ts);
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
};
