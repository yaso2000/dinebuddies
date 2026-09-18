import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './MapStyles.css';
import { addBaseTileLayer } from '../utils/mapTiles';
import { detachLeafletMap, ensureLeafletMapDetachedIfOrphan } from '../utils/leafletMapLifecycle';
import { useTheme } from '../context/ThemeContext';
import { haversineKm } from '../utils/postsFeedScope';

/**
 * Reusable multi-marker directory map (list ↔ map pattern). Extracted from the
 * hand-rolled Leaflet effect that BusinessesDirectory / Home each duplicated, so
 * offers, jobs and any future directory share one map. Free Esri tiles (no API key)
 * via addBaseTileLayer. The parent controls height via CSS on the wrapper.
 *
 * @param {object} props
 * @param {boolean} props.active            — map view is visible (skip work when hidden)
 * @param {Array<object>} props.items       — rows to plot
 * @param {(item:object)=>({lat:number,lng:number}|null)} props.getCoords
 * @param {(item:object)=>string} props.getMarkerImageUrl  — logo/photo for the pin
 * @param {(item:object)=>string} props.getFallbackName    — name for the initials fallback
 * @param {(item:object, ctx:{distanceKm:number|null, travelMin:number|null})=>string} props.buildPopupHtml
 * @param {{lat:number,lng:number}|null} [props.userLocation]
 * @param {string} [props.markerColor]      — pin border colour
 * @param {string} [props.className]
 */
export default function DirectoryMap({
  active,
  items,
  getCoords,
  getMarkerImageUrl,
  getFallbackName,
  buildPopupHtml,
  userLocation = null,
  markerColor = '#fbbf24',
  className = '',
}) {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const mapRef = useRef(null);
  const mapInstance = useRef(null);

  // Only rows with finite coordinates are plottable.
  const points = useMemo(() => {
    return (items || [])
      .map((item) => {
        const c = getCoords(item);
        const lat = Number(c?.lat);
        const lng = Number(c?.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        if (lat === 0 && lng === 0) return null; // guard Null Island
        return { item, lat, lng };
      })
      .filter(Boolean);
  }, [items, getCoords]);

  // Detach the Leaflet instance on unmount (avoids "container already initialized").
  useEffect(() => () => detachLeafletMap(mapInstance), []);

  useEffect(() => {
    if (!active || !mapRef.current) return;
    ensureLeafletMapDetachedIfOrphan(mapInstance, mapRef.current);

    if (!mapInstance.current) {
      let initialLat = 0;
      let initialLng = 0;
      let initialZoom = 2;
      if (userLocation) {
        initialLat = userLocation.lat;
        initialLng = userLocation.lng;
        initialZoom = 13;
      } else if (points.length > 0) {
        const lats = points.map((p) => p.lat);
        const lngs = points.map((p) => p.lng);
        initialLat = (Math.min(...lats) + Math.max(...lats)) / 2;
        initialLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
        initialZoom = 10;
      }
      mapInstance.current = L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: false,
        tap: false,
      }).setView([initialLat, initialLng], initialZoom);
    }

    // Re-apply theme tiles.
    mapInstance.current.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) mapInstance.current.removeLayer(layer);
    });
    addBaseTileLayer(L, mapInstance.current, isDark);

    // Clear old markers.
    mapInstance.current.eachLayer((layer) => {
      if (layer instanceof L.Marker) mapInstance.current.removeLayer(layer);
    });

    // Viewer marker.
    if (userLocation) {
      const userIcon = L.divIcon({
        className: 'user-location-marker',
        html: `<div class="user-marker-outer"><div class="user-marker-pulse"></div><div class="user-marker-dot"></div></div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });
      L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
        .addTo(mapInstance.current)
        .bindPopup(`<strong style="color:#8b5cf6;">📍 ${t('your_location', 'Your location')}</strong>`);
    }

    // Item markers.
    points.forEach(({ item, lat, lng }) => {
      let distanceKm = null;
      let travelMin = null;
      if (userLocation) {
        distanceKm = haversineKm(userLocation.lat, userLocation.lng, lat, lng);
        travelMin = Math.round((distanceKm / 40) * 60);
      }
      const img = getMarkerImageUrl(item) || '';
      const name = (getFallbackName && getFallbackName(item)) || '•';
      const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${markerColor.replace('#', '')}&color=fff&size=200`;
      const markerIcon = L.divIcon({
        className: 'custom-invitation-marker',
        html: `<div style="width:50px;height:50px;border-radius:50%;border:3px solid ${markerColor};overflow:hidden;background:white;box-shadow:0 4px 12px rgba(0,0,0,0.3);">
                 <img src="${img || fallback}" style="width:100%;height:100%;object-fit:cover;" onerror="this.src='${fallback}'" />
               </div>`,
        iconSize: [50, 50],
        iconAnchor: [25, 50],
      });
      L.marker([lat, lng], { icon: markerIcon })
        .addTo(mapInstance.current)
        .bindPopup(buildPopupHtml(item, { distanceKm, travelMin }), {
          maxWidth: 220,
          minWidth: 180,
          className: 'compact-leaflet-popup',
        });
    });

    const t1 = setTimeout(() => {
      if (mapInstance.current) mapInstance.current.invalidateSize();
    }, 100);
    const t2 = setTimeout(() => {
      if (!mapInstance.current) return;
      const bounds = points.map((p) => [p.lat, p.lng]);
      if (userLocation) bounds.push([userLocation.lat, userLocation.lng]);
      if (bounds.length > 0) {
        try {
          mapInstance.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15, animate: true });
        } catch {
          if (userLocation) mapInstance.current.setView([userLocation.lat, userLocation.lng], 12);
        }
      }
    }, 300);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, points, userLocation, isDark, t]);

  return <div ref={mapRef} className={`directory-map ${className}`.trim()} />;
}
