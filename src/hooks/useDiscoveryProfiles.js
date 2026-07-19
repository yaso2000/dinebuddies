import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useUserDirectory } from './useUserDirectory';
import { mapDirectoryUserToDiscoveryProfile } from '../utils/discoveryProfile';
import { isDiscoverySwipeMatch } from '../utils/discoverySwipeMatch';
import { normalizeInvitePreference } from '../constants/privateProfileOptions';
import { getUserDocLatLng } from '../utils/userDocCoords';
import { sortDirectoryUsersByDistance } from '../utils/userDirectoryFilters';

const MIN_SWIPE_DECK_SIZE = 8;
/** Larger pages = fewer round-trips when many members are filtered out client-side. */
const DISCOVERY_PAGE_SIZE = 36;
const GEO_TIMEOUT_MS = 4000;

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
 * Shows the deck immediately; re-sorts by distance when location becomes available.
 */
export function useDiscoveryProfiles({ enabled = true } = {}) {
    const { currentUser, userProfile, isGuest } = useAuth();
    const viewerUid = currentUser?.uid || currentUser?.id;
    const canLoad = Boolean(enabled && viewerUid && !isGuest);
    const [deviceLocation, setDeviceLocation] = useState(null);

    useEffect(() => {
        if (!canLoad || !navigator.geolocation) return undefined;

        let cancelled = false;
        navigator.geolocation.getCurrentPosition(
            (position) => {
                if (cancelled) return;
                setDeviceLocation({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                });
            },
            () => {},
            { enableHighAccuracy: false, maximumAge: 120_000, timeout: GEO_TIMEOUT_MS }
        );

        return () => {
            cancelled = true;
        };
    }, [canLoad]);

    const userLocation = useMemo(
        () => deviceLocation || getUserDocLatLng(userProfile) || null,
        [deviceLocation, userProfile]
    );

    const directory = useUserDirectory({
        excludeUid: viewerUid,
        enabled: canLoad,
        pageSize: DISCOVERY_PAGE_SIZE,
    });

    const viewer = useMemo(
        () => buildSwipeViewer(userProfile, currentUser),
        [currentUser, userProfile]
    );

    const profiles = useMemo(() => {
        if (!viewer) return [];
        const matched = directory.users.filter((user) => isDiscoverySwipeMatch(viewer, user));
        return sortDirectoryUsersByDistance(matched, userLocation)
            .map((user) => mapDirectoryUserToDiscoveryProfile(user, userLocation))
            .filter(Boolean);
    }, [directory.users, userLocation, viewer]);

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
        loading: directory.loading && profiles.length === 0,
        loadingMore: directory.loadingMore,
        error: directory.error,
        hasMore: directory.hasMore,
        loadMore: directory.loadMore,
        canLoad,
    };
}
