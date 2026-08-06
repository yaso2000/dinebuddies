import { useEffect, useMemo, useState } from 'react';
import { useInvitations } from '../context/InvitationContext';
import { useAuth } from '../context/AuthContext';
import {
  DEFAULT_BUSINESS_COVER,
  resolveBusinessCoverImageUrl,
} from '../utils/businessCoverImage';
import { pickSafeDisplayImageUrl } from '../utils/avatarUtils';
import { getBusinessCardCity } from '../utils/businessCardLocation';
import { calculateDistance } from '../utils/locationVerification';
import { fetchIpLocation } from '../utils/locationUtils';

function parseBusinessLatLng(res) {
  const lat = Number(res?.lat ?? res?.location?.lat ?? res?.businessInfo?.lat);
  const lng = Number(res?.lng ?? res?.location?.lng ?? res?.businessInfo?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/**
 * Published partners for the magnetic swipe deck (same pool as /restaurants list).
 */
export function useBusinessSwipeDeck() {
  const { restaurants = [], loadingInvitations = true } = useInvitations() || {};
  const { userProfile } = useAuth();
  const loading = loadingInvitations && restaurants.length === 0;
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

  const userLocation = deviceLocation;

  const items = useMemo(() => {
    const mapped = (restaurants || [])
      .filter((res) => res && res.id && res.name)
      .map((res) => {
        const coords = parseBusinessLatLng(res);
        const distanceKm =
          userLocation && coords
            ? calculateDistance(userLocation.lat, userLocation.lng, coords.lat, coords.lng)
            : null;
        const city = getBusinessCardCity(res) || '';
        const coverImage =
          resolveBusinessCoverImageUrl(res) ||
          pickSafeDisplayImageUrl(res.image, res.businessInfo?.coverImage) ||
          DEFAULT_BUSINESS_COVER;

        return {
          id: res.id,
          coverImage,
          title: res.name,
          subtitle: [res.type, city].filter(Boolean).join(' · '),
          locationLabel: city,
          distanceKm,
          href: `/business/${res.id}`,
          raw: res,
        };
      });

    mapped.sort((a, b) => {
      if (a.distanceKm == null && b.distanceKm == null) return 0;
      if (a.distanceKm == null) return 1;
      if (b.distanceKm == null) return -1;
      return a.distanceKm - b.distanceKm;
    });

    return mapped;
  }, [restaurants, userLocation]);

  return { items, loading };
}
