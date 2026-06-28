import { useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useUserDirectory } from './useUserDirectory';
import { mapDirectoryUserToDiscoveryProfile } from '../utils/discoveryProfile';
import { isDiscoverySwipeMatch } from '../utils/discoverySwipeMatch';
import { normalizeInvitePreference } from '../constants/privateProfileOptions';

const MIN_SWIPE_DECK_SIZE = 8;

function buildSwipeViewer(userProfile, currentUser) {
    const uid = currentUser?.uid || currentUser?.id;
    if (!uid) return null;

    return {
        id: uid,
        gender: userProfile?.gender || currentUser?.gender || null,
        invitePreference: normalizeInvitePreference(userProfile?.invitePreference),
    };
}

/**
 * Discovery swipe — mutual gender comfort from both members' invite preferences.
 */
export function useDiscoveryProfiles({ enabled = true } = {}) {
    const { currentUser, userProfile, isGuest } = useAuth();
    const viewerUid = currentUser?.uid || currentUser?.id;
    const canLoad = Boolean(enabled && viewerUid && !isGuest);

    const directory = useUserDirectory({
        excludeUid: viewerUid,
        enabled: canLoad,
    });

    const viewer = useMemo(
        () => buildSwipeViewer(userProfile, currentUser),
        [currentUser, userProfile]
    );

    const profiles = useMemo(() => {
        if (!viewer) return [];
        return directory.users
            .filter((user) => isDiscoverySwipeMatch(viewer, user))
            .map(mapDirectoryUserToDiscoveryProfile)
            .filter(Boolean);
    }, [directory.users, viewer]);

    useEffect(() => {
        if (!canLoad || directory.loading || directory.loadingMore || !directory.hasMore) return;
        if (profiles.length >= MIN_SWIPE_DECK_SIZE) return;
        directory.loadMore();
    }, [
        canLoad,
        directory.hasMore,
        directory.loadMore,
        directory.loading,
        directory.loadingMore,
        profiles.length,
    ]);

    return {
        profiles,
        loading: directory.loading,
        loadingMore: directory.loadingMore,
        error: directory.error,
        hasMore: directory.hasMore,
        loadMore: directory.loadMore,
        canLoad,
    };
}
