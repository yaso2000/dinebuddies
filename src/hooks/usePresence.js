import { useEffect } from 'react';
import { ref, set, onDisconnect, serverTimestamp, get } from 'firebase/database';
import { rtdb } from '../firebase/config';
import { useAuth } from '../context/AuthContext';

/**
 * Presence tracking using Firebase Realtime Database.
 *
 * Realtime Database is significantly cheaper than Firestore for presence:
 *  - onDisconnect() is handled server-side (no extra writes when the browser closes)
 *  - Reads/writes are priced per MB of bandwidth, not per document operation
 *
 * Data structure in RTDB:
 *   presence/{uid}: { online: boolean, lastSeen: ServerTimestamp }
 */
export const usePresence = () => {
    const { currentUser } = useAuth();

    useEffect(() => {
        if (!currentUser?.uid) return;
        const uid = currentUser.uid;
        const presenceRef = ref(rtdb, `presence/${uid}`);

        const goOnline = async () => {
            // Register disconnect handler BEFORE setting online status
            // so it's guaranteed to fire even if the write below fails midway
            await onDisconnect(presenceRef).set({
                online: false,
                lastSeen: serverTimestamp()
            });
            await set(presenceRef, {
                online: true,
                lastSeen: serverTimestamp()
            });
        };

        goOnline().catch(err => console.warn('Presence online failed:', err));

        return () => {
            // Mark offline on React unmount (e.g. sign-out)
            set(presenceRef, {
                online: false,
                lastSeen: serverTimestamp()
            }).catch(() => {});
        };
    }, [currentUser?.uid]);

    // Handle page visibility changes (tab switching, minimizing)
    useEffect(() => {
        if (!currentUser?.uid) return;
        const uid = currentUser.uid;
        const presenceRef = ref(rtdb, `presence/${uid}`);

        const handleVisibilityChange = () => {
            if (document.hidden) {
                set(presenceRef, { online: false, lastSeen: serverTimestamp() }).catch(() => {});
            } else {
                onDisconnect(presenceRef).set({ online: false, lastSeen: serverTimestamp() });
                set(presenceRef, { online: true, lastSeen: serverTimestamp() }).catch(() => {});
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [currentUser?.uid]);

    // Handle browser/tab close
    useEffect(() => {
        if (!currentUser?.uid) return;
        const uid = currentUser.uid;
        const presenceRef = ref(rtdb, `presence/${uid}`);

        const handleBeforeUnload = () => {
            // onDisconnect() already registered above handles this server-side.
            // This is a best-effort synchronous fallback for same-tab navigation.
            set(presenceRef, { online: false, lastSeen: serverTimestamp() }).catch(() => {});
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [currentUser?.uid]);
};

/**
 * Read a user's presence from RTDB (for chat/profile online indicators).
 * @param {string} uid
 * @returns {Promise<{online: boolean, lastSeen: object}>}
 */
export const getUserPresence = async (uid) => {
    if (!uid) return { online: false, lastSeen: null };
    try {
        const snap = await get(ref(rtdb, `presence/${uid}`));
        return snap.exists() ? snap.val() : { online: false, lastSeen: null };
    } catch {
        return { online: false, lastSeen: null };
    }
};
