import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * Received discovery gifts for the inbox "Invites & gifts" tab.
 * Wire to Firestore when gift sends are implemented.
 */
export function useReceivedGiftsForMe() {
    const { currentUser, isGuest, loading } = useAuth();
    const viewerUid = currentUser?.uid || currentUser?.id;

    const canLoad = Boolean(viewerUid && !isGuest && !loading);

    return useMemo(
        () => ({
            gifts: [],
            synced: canLoad,
        }),
        [canLoad]
    );
}
