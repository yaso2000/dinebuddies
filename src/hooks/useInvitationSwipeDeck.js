import { useEffect, useMemo, useState } from 'react';
import { useInvitations } from '../context/InvitationContext';
import { useAuth } from '../context/AuthContext';
import { asUidArray } from '../utils/userSocialLists';
import { isVisibleInPublicFeed } from '../utils/invitationRules';
import { isPublicInvitationExpiredForArchive } from '../utils/invitationExpiry';
import { getInvitationLatLng } from '../utils/invitationCoords';
import { pickSafeDisplayImageUrl } from '../utils/avatarUtils';
import { calculateDistance } from '../utils/locationVerification';
import { fetchIpLocation } from '../utils/locationUtils';

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80';

function invitationCover(inv) {
  return (
    pickSafeDisplayImageUrl(
      inv.videoThumbnail,
      inv.customImage,
      inv.restaurantImage,
      inv.image,
      inv.coverImage
    ) || FALLBACK_IMAGE
  );
}

function invitationTimestamp(inv) {
  const sec = inv.createdAt?.seconds ?? inv.createdAt?._seconds;
  if (typeof sec === 'number') return sec;
  const ms = Date.parse(inv.createdAt);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : 0;
}

/**
 * Public invitations for the magnetic swipe deck (same visibility as Home feed).
 */
export function useInvitationSwipeDeck() {
  const { invitations = [], loadingInvitations: loading = true, currentUser = null } =
    useInvitations() || {};
  const { userProfile } = useAuth();
  const [deviceLocation, setDeviceLocation] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const profileLat = Number(userProfile?.lat ?? userProfile?.location?.lat);
    const profileLng = Number(userProfile?.lng ?? userProfile?.location?.lng);
    if (Number.isFinite(profileLat) && Number.isFinite(profileLng)) {
      setDeviceLocation({ lat: profileLat, lng: profileLng });
      return undefined;
    }
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!cancelled) {
            setDeviceLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          }
        },
        async () => {
          try {
            const ip = await fetchIpLocation();
            if (!cancelled && ip?.lat != null && ip?.lng != null) {
              setDeviceLocation({ lat: Number(ip.lat), lng: Number(ip.lng) });
            }
          } catch {
            /* ignore */
          }
        },
        { maximumAge: 120000, timeout: 8000 }
      );
    }
    return () => {
      cancelled = true;
    };
  }, [userProfile]);

  const blockedAuthorIds = useMemo(
    () => new Set(asUidArray(userProfile?.blockedUserIds || currentUser?.blockedUserIds)),
    [currentUser?.blockedUserIds, userProfile?.blockedUserIds]
  );

  const userLocation = deviceLocation;

  const items = useMemo(() => {
    const now = new Date();
    const isStaff = ['admin', 'moderator', 'support'].includes(userProfile?.role);

    const filtered = (invitations || []).filter((inv) => {
      if (!inv || !inv.author) return false;
      if (inv.status === 'draft') return false;

      const isOwn = inv.author.id === currentUser?.id;
      if (!isOwn && blockedAuthorIds.has(inv.author.id)) return false;

      if (inv.meetingStatus === 'completed' && inv.completedAt) {
        const completedTime = inv.completedAt.toDate
          ? inv.completedAt.toDate()
          : new Date(inv.completedAt);
        const archiveAfterCompletion = new Date(completedTime.getTime() + 24 * 60 * 60 * 1000);
        if (now > archiveAfterCompletion) return false;
      } else if (isPublicInvitationExpiredForArchive(inv, now)) {
        return false;
      }

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

      return true;
    });

    const mapped = filtered.map((inv) => {
      const coords = getInvitationLatLng(inv);
      const distanceKm =
        userLocation && coords
          ? calculateDistance(userLocation.lat, userLocation.lng, coords.lat, coords.lng)
          : null;
      const hostName = inv.author?.name || inv.author?.displayName || '';
      const locationLabel = [inv.location, inv.city].filter(Boolean).join(' · ') || inv.location || '';

      return {
        id: inv.id,
        coverImage: invitationCover(inv),
        title: inv.title || hostName || 'Invitation',
        subtitle: [hostName, inv.type].filter(Boolean).join(' · '),
        locationLabel,
        distanceKm,
        createdAtSec: invitationTimestamp(inv),
        href: `/invitation/${inv.id}`,
        raw: inv,
      };
    });

    mapped.sort((a, b) => {
      if (a.distanceKm == null && b.distanceKm == null) {
        return b.createdAtSec - a.createdAtSec;
      }
      if (a.distanceKm == null) return 1;
      if (b.distanceKm == null) return -1;
      return a.distanceKm - b.distanceKm;
    });

    return mapped;
  }, [blockedAuthorIds, currentUser, invitations, userLocation, userProfile?.countryCode, userProfile?.role]);

  return { items, loading };
}
