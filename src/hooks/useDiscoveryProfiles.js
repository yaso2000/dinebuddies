import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useUserDirectory } from './useUserDirectory';
import { mapDirectoryUserToDiscoveryProfile } from '../utils/discoveryProfile';
import { isDiscoverySwipeMatch } from '../utils/discoverySwipeMatch';
import { normalizeInvitePreference } from '../constants/privateProfileOptions';
import { getUserDocLatLng } from '../utils/userDocCoords';
import {
    sortDirectoryUsersByDistance,
    memberMatchesPhotoFilter,
    memberMatchesGenderFilter,
    memberMatchesAgeCategory,
} from '../utils/userDirectoryFilters';

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
        ageCategory: userProfile?.ageCategory || userProfile?.age_category || '',
    };
}

/**
 * Discovery swipe — mutual gender comfort from both members' invite preferences.
 * Shows the deck immediately; re-sorts by distance when location becomes available.
 */
export function useDiscoveryProfiles({
    enabled = true,
    genderFilter = 'all',
    ageCategoryFilter = 'all',
    photoFilter = 'with_photo',
    onlineOnly = false,
} = {}) {
    const { currentUser, userProfile, isGuest, loading: authLoading } = useAuth();
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
        viewerProfile: userProfile,
    });

    const viewer = useMemo(
        () => buildSwipeViewer(userProfile, currentUser),
        [currentUser, userProfile]
    );

    const profiles = useMemo(() => {
        if (!viewer) return [];
        // Apply the same toolbar filters as the list (photo default = with_photo),
        // on top of the swipe gender-comfort match.
        const matched = directory.users.filter(
            (user) =>
                memberMatchesPhotoFilter(user, photoFilter) &&
                memberMatchesGenderFilter(user, genderFilter) &&
                memberMatchesAgeCategory(user, ageCategoryFilter) &&
                (!onlineOnly || user?.isOnline === true) &&
                isDiscoverySwipeMatch(viewer, user)
        );
        return sortDirectoryUsersByDistance(matched, userLocation)
            .map((user) => mapDirectoryUserToDiscoveryProfile(user, userLocation))
            .filter(Boolean);
    }, [directory.users, userLocation, viewer, photoFilter, genderFilter, ageCategoryFilter, onlineOnly]);

    useEffect(() => {
        // Wait until the viewer profile is ready (gender loaded) before auto-paging —
        // otherwise the gender-comfort filter drops everyone and we'd burn through
        // every page while the deck still looks empty on first load.
        if (!canLoad || authLoading || !viewer?.gender) return;
        if (directory.loading || directory.loadingMore || !directory.hasMore) return;
        if (profiles.length >= MIN_SWIPE_DECK_SIZE) return;
        directory.loadMore();
    }, [
        canLoad,
        authLoading,
        viewer,
        directory.hasMore,
        directory.loadMore,
        directory.loading,
        directory.loadingMore,
        profiles.length,
    ]);

    return {
        profiles,
        // Keep showing the loading state (not the empty "no members" deck) while
        // auth/profile is still resolving on first load.
        loading: (authLoading || directory.loading) && profiles.length === 0,
        loadingMore: directory.loadingMore,
        error: directory.error,
        hasMore: directory.hasMore,
        loadMore: directory.loadMore,
        canLoad,
    };
}
