import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useUserDirectory } from './useUserDirectory';
import { mapDirectoryUserToDiscoveryProfile } from '../utils/discoveryProfile';

/**
 * Real consumer profiles for the discovery swipe feed.
 */
export function useDiscoveryProfiles({ enabled = true } = {}) {
    const { currentUser, isGuest } = useAuth();
    const viewerUid = currentUser?.uid || currentUser?.id;
    const canLoad = Boolean(enabled && viewerUid && !isGuest);

    const directory = useUserDirectory({
        excludeUid: viewerUid,
        enabled: canLoad,
    });

    const profiles = useMemo(
        () => directory.users.map(mapDirectoryUserToDiscoveryProfile).filter(Boolean),
        [directory.users]
    );

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
