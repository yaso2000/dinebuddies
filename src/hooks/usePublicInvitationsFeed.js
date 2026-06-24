import { useMemo } from 'react';
import { getInvitationLatLng } from '../utils/invitationCoords';
import { asUidArray } from '../utils/userSocialLists';
import { isVisibleInPublicFeed } from '../utils/invitationRules';

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Shared public-invitation feed filtering for the Invitations screen.
 */
export function usePublicInvitationsFeed({
    invitations = [],
    currentUser,
    userProfile,
    userLocation,
    searchQuery = '',
    activeFilter = 'All',
    geoFilter = 'global',
}) {
    const safeInvitations = useMemo(
        () => (Array.isArray(invitations) ? invitations : []),
        [invitations]
    );
    const blockedAuthorIds = useMemo(
        () => new Set(asUidArray(userProfile?.blockedUserIds)),
        [userProfile?.blockedUserIds]
    );

    const filteredInvitations = useMemo(() => {
        const now = new Date();

        let filtered = safeInvitations.filter((inv) => {
            if (!inv || !inv.author) return false;
            if (inv.status === 'draft') return false;

            const isOwn = inv.author.id === currentUser?.id;
            if (!isOwn && blockedAuthorIds.has(inv.author.id)) return false;

            if (inv.meetingStatus === 'completed' && inv.completedAt) {
                const completedTime = inv.completedAt.toDate
                    ? inv.completedAt.toDate()
                    : new Date(inv.completedAt);
                const oneHourAfterCompletion = new Date(completedTime.getTime() + 60 * 60 * 1000);
                if (now > oneHourAfterCompletion) return false;
            } else {
                const inviteDate = new Date(inv.date || now);
                if (!isNaN(inviteDate.getTime())) {
                    const [hours, minutes] = (inv.time || '20:30').split(':');
                    inviteDate.setHours(parseInt(hours, 10) || 0, parseInt(minutes, 10) || 0, 0);
                    const expiry = new Date(inviteDate.getTime() + 60 * 60 * 1000);
                    if (now > expiry) return false;
                }
            }

            const isStaff = ['admin', 'moderator', 'support'].includes(userProfile?.role);
            if (
                !isVisibleInPublicFeed(inv, userLocation, {
                    isStaff,
                    isOwn,
                    viewerCountryCode: userProfile?.countryCode,
                })
            ) {
                return false;
            }

            if (inv.privacy === 'followers' || inv.isFollowersOnly) {
                const isFollowing = currentUser?.following?.includes(inv.author.id);
                if (!isOwn && !isFollowing) return false;
            }

            const q = searchQuery.trim().toLowerCase();
            const matchesSearch =
                !q ||
                inv.title?.toLowerCase().includes(q) ||
                inv.location?.toLowerCase().includes(q) ||
                inv.description?.toLowerCase().includes(q);

            const matchesCategory = activeFilter === 'All' || inv.type === activeFilter;

            return matchesSearch && matchesCategory;
        });

        if (geoFilter !== 'global' && geoFilter !== 'All' && userLocation && !['admin', 'moderator', 'support'].includes(userProfile?.role)) {
            filtered = filtered.filter((inv) => {
                const coords = getInvitationLatLng(inv);
                if (!coords) return false;
                const distance = calculateDistance(
                    userLocation.lat,
                    userLocation.lng,
                    coords.lat,
                    coords.lng
                );
                switch (geoFilter) {
                    case 'nearby':
                        return distance < 10;
                    case 'city':
                        return distance < 50;
                    case 'country':
                        return distance < 500;
                    default:
                        return true;
                }
            });
        }

        if (userLocation) {
            filtered = filtered.map((inv) => {
                const coords = getInvitationLatLng(inv);
                return {
                    ...inv,
                    distance: coords
                        ? calculateDistance(
                              userLocation.lat,
                              userLocation.lng,
                              coords.lat,
                              coords.lng
                          )
                        : null,
                };
            });
        }

        return filtered;
    }, [
        safeInvitations,
        searchQuery,
        geoFilter,
        activeFilter,
        userLocation,
        currentUser,
        userProfile?.role,
        userProfile?.countryCode,
        blockedAuthorIds,
    ]);

    const hasActiveFilters =
        Boolean(searchQuery.trim()) || activeFilter !== 'All' || (geoFilter !== 'global' && geoFilter !== 'All');

    return { filteredInvitations, hasActiveFilters };
}

export default usePublicInvitationsFeed;
