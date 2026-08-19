import { useEffect, useMemo, useState } from 'react';
import { useInvitations } from '../context/InvitationContext';
import { useAuth } from '../context/AuthContext';
import {
  DEFAULT_BUSINESS_COVER,
  resolveBusinessCoverImageUrl,
} from '../utils/businessCoverImage';
import { pickSafeDisplayImageUrl } from '../utils/avatarUtils';
import { getBusinessCardCity } from '../utils/businessCardLocation';
import { haversineKm } from '../utils/postsFeedScope';
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

    const applyCoords = (lat, lng) => {
      const latN = Number(lat);
      const lngN = Number(lng);
      if (cancelled || !Number.isFinite(latN) || !Number.isFinite(lngN)) return;
      setDeviceLocation({ lat: latN, lng: lngN });
    };

    const applyIpOrProfileFallback = async () => {
      try {
        const ip = await fetchIpLocation();
        if (cancelled) return;
        if (ip?.latitude != null && ip?.longitude != null) {
          applyCoords(ip.latitude, ip.longitude);
        }
      } catch {
        /* ignore — profileLocation (below) already covers this case */
      }
    };

    if (!navigator.geolocation) {
      void applyIpOrProfileFallback();
      return () => {
        cancelled = true;
      };
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => applyCoords(pos.coords.latitude, pos.coords.longitude),
      () => {
        void applyIpOrProfileFallback();
      },
      { maximumAge: 60000, timeout: 8000 }
    );

    return () => {
      cancelled = true;
    };
  }, [userProfile]);

  // Profile coordinates are available immediately (no permission prompt, no
  // network round-trip) — use them as the baseline so the deck can sort by
  // distance on first render, and let live GPS (once granted) override with a
  // more precise fix. Previously this hook only fell back to a *mis-keyed*
  // profile field (userProfile.lat instead of userProfile.coordinates.lat)
  // and only as a last resort after both GPS and IP lookup failed — so for
  // most users neither ever populated, the deck silently sorted by "most
  // recently updated" instead of distance, surfacing whichever business had
  // been touched most recently regardless of the viewer's actual city.
  const profileLat = Number(userProfile?.coordinates?.lat);
  const profileLng = Number(userProfile?.coordinates?.lng);
  const profileLocation =
    Number.isFinite(profileLat) && Number.isFinite(profileLng) && !(profileLat === 0 && profileLng === 0)
      ? { lat: profileLat, lng: profileLng }
      : null;
  const userLocation = deviceLocation || profileLocation;

  const items = useMemo(() => {
    const mapped = (restaurants || [])
      .filter((res) => res && res.id && res.name)
      .map((res) => {
        const coords = parseBusinessLatLng(res);
        const distanceKm =
          userLocation && coords
            ? haversineKm(userLocation.lat, userLocation.lng, coords.lat, coords.lng)
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
