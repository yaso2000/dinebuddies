import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaExpand, FaCompress, FaMapMarkedAlt, FaGlobe, FaFlag } from 'react-icons/fa';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './MapStyles.css';
import { AppText } from './base';
import { addBaseTileLayer } from '../utils/mapTiles';
import { detachLeafletMap, ensureLeafletMapDetachedIfOrphan } from '../utils/leafletMapLifecycle';
import { useTheme } from '../context/ThemeContext';
import { haversineKm } from '../utils/postsFeedScope';

const CITY_ZOOM = 12;
const COUNTRY_ZOOM = 4;
const WORLD_ZOOM = 2;

/**
 * Reusable multi-marker directory map — the SAME chrome as the venues map: default city
 * focus, zoom +/-, fullscreen, City / Country (flag) / World buttons, self-sizes to ~4px
 * above the bottom nav, and an "active" count badge. Free Esri tiles (no API key).
 *
 * @param {object} props
 * @param {boolean} props.active
 * @param {Array<object>} props.items
 * @param {(item:object)=>({lat:number,lng:number}|null)} props.getCoords
 * @param {(item:object)=>string} props.getMarkerImageUrl
 * @param {(item:object)=>string} props.getFallbackName
 * @param {(item:object, ctx:{distanceKm:number|null, travelMin:number|null})=>string} props.buildPopupHtml
 * @param {{lat:number,lng:number}|null} [props.userLocation]
 * @param {string} [props.markerColor]
 * @param {string} [props.countryFlag]  — flag emoji for the Country button (else a flag icon)
 * @param {string} [props.badgeLabel]   — e.g. "Active offers" (prefixed with the count)
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
  countryFlag = '',
  badgeLabel = '',
}) {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const didFocusRef = useRef(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const points = useMemo(() => {
    return (items || [])
      .map((item) => {
        const c = getCoords(item);
        const lat = Number(c?.lat);
        const lng = Number(c?.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        if (lat === 0 && lng === 0) return null;
        return { item, lat, lng };
      })
      .filter(Boolean);
  }, [items, getCoords]);

  useEffect(() => () => detachLeafletMap(mapInstance), []);

  // Build/refresh the map + markers. Default view = the viewer's city (once), never fit-all.
  useEffect(() => {
    if (!active || !mapRef.current) return undefined;
    ensureLeafletMapDetachedIfOrphan(mapInstance, mapRef.current);

    if (!mapInstance.current) {
      let initialLat = 20;
      let initialLng = 0;
      let initialZoom = WORLD_ZOOM;
      if (userLocation) {
        initialLat = userLocation.lat;
        initialLng = userLocation.lng;
        initialZoom = CITY_ZOOM;
        didFocusRef.current = true;
      } else if (points.length > 0) {
        const lats = points.map((p) => p.lat);
        const lngs = points.map((p) => p.lng);
        initialLat = (Math.min(...lats) + Math.max(...lats)) / 2;
        initialLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
        initialZoom = 6;
      }
      mapInstance.current = L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: false,
        tap: false,
      }).setView([initialLat, initialLng], initialZoom);
    }

    // GPS/IP can resolve after creation — focus the city once, then leave the viewport.
    if (!didFocusRef.current && userLocation) {
      mapInstance.current.setView([userLocation.lat, userLocation.lng], CITY_ZOOM);
      didFocusRef.current = true;
    }

    mapInstance.current.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) mapInstance.current.removeLayer(layer);
    });
    addBaseTileLayer(L, mapInstance.current, isDark);

    mapInstance.current.eachLayer((layer) => {
      if (layer instanceof L.Marker) mapInstance.current.removeLayer(layer);
    });

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
    return () => clearTimeout(t1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, points, userLocation, isDark, t]);

  // Size the map to end ~4px above the bottom nav on any device (matches the venues map).
  useEffect(() => {
    if (!active) return undefined;
    const wrapper = mapRef.current?.closest('.directory-map-wrapper');
    if (!wrapper) return undefined;
    const apply = () => {
      if (isFullscreen) { wrapper.style.height = ''; return; }
      const top = wrapper.getBoundingClientRect().top;
      const nav = document.querySelector('.bottom-nav');
      const navTop = nav ? nav.getBoundingClientRect().top : window.innerHeight;
      wrapper.style.height = `${Math.max(260, Math.round(navTop - top - 4))}px`;
      if (mapInstance.current) mapInstance.current.invalidateSize();
    };
    apply();
    const t1 = setTimeout(apply, 150);
    const t2 = setTimeout(apply, 400);
    window.addEventListener('resize', apply);
    window.addEventListener('orientationchange', apply);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', apply);
      window.removeEventListener('orientationchange', apply);
    };
  }, [active, isFullscreen]);

  const zoomBy = (delta) => mapInstance.current && (delta > 0 ? mapInstance.current.zoomIn() : mapInstance.current.zoomOut());
  const focusLevel = (zoom) => {
    if (!mapInstance.current) return;
    const center = userLocation ? [userLocation.lat, userLocation.lng] : mapInstance.current.getCenter();
    mapInstance.current.setView(center, zoom, { animate: true });
  };
  const focusWorld = () => mapInstance.current && mapInstance.current.setView([20, 0], WORLD_ZOOM, { animate: true });

  return (
    <div
      className="map-view-container"
      style={{
        position: isFullscreen ? 'fixed' : 'relative',
        inset: isFullscreen ? 0 : 'auto',
        zIndex: isFullscreen ? 9999 : 'auto',
      }}>
      <div
        className={`map-wrapper directory-map-wrapper${isFullscreen ? ' directory-map-wrapper--fullscreen' : ''}`}
        style={{ borderRadius: 0, overflow: 'hidden', width: '100%', height: isFullscreen ? '100dvh' : undefined, position: 'relative' }}>
        <div ref={mapRef} className="responsive-map-container leaflet-container-home" style={{ width: '100%', height: '100%', outline: 'none' }} />

        <div className="map-zoom-controls">
          <button onClick={() => zoomBy(1)} className="btn-map-control" title={t('zoom_in', { defaultValue: 'Zoom In' })}>
            <AppText as="span" style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>+</AppText>
          </button>
          <button onClick={() => zoomBy(-1)} className="btn-map-control" title={t('zoom_out', { defaultValue: 'Zoom Out' })}>
            <AppText as="span" style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>−</AppText>
          </button>
          <button
            onClick={() => {
              setIsFullscreen((v) => !v);
              setTimeout(() => mapInstance.current && mapInstance.current.invalidateSize(), 100);
            }}
            className="btn-map-control"
            title={isFullscreen ? t('exit_fullscreen', 'Exit Fullscreen') : t('fullscreen', 'Fullscreen')}>
            {isFullscreen ? <FaCompress /> : <FaExpand />}
          </button>
          <button onClick={() => focusLevel(CITY_ZOOM)} className="btn-map-control" title={t('map_focus_city', { defaultValue: 'City' })} aria-label={t('map_focus_city', { defaultValue: 'City' })}>
            <FaMapMarkedAlt />
          </button>
          <button onClick={() => focusLevel(COUNTRY_ZOOM)} className="btn-map-control" title={t('map_focus_country', { defaultValue: 'Country' })} aria-label={t('map_focus_country', { defaultValue: 'Country' })}>
            {countryFlag ? <AppText as="span" aria-hidden style={{ fontSize: '1.15rem', lineHeight: 1 }}>{countryFlag}</AppText> : <FaFlag />}
          </button>
          <button onClick={focusWorld} className="btn-map-control" title={t('map_focus_world', { defaultValue: 'World' })} aria-label={t('map_focus_world', { defaultValue: 'World' })}>
            <FaGlobe />
          </button>
        </div>

        {badgeLabel ? (
          <div className="map-discovery-badge" style={{ top: 'auto', bottom: '20px', left: '50%', transform: 'translateX(-50%)' }}>
            <div className="pulse-dot" />
            <AppText as="span">{points.length} {badgeLabel}</AppText>
          </div>
        ) : null}
      </div>
    </div>
  );
}
