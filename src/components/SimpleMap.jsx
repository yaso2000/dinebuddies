import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
    detachLeafletMap,
    ensureLeafletMapDetachedIfOrphan,
} from '../utils/leafletMapLifecycle';

import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import iconRetina from 'leaflet/dist/images/marker-icon-2x.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: iconRetina,
    iconUrl: icon,
    shadowUrl: iconShadow,
});

const SimpleMap = ({ lat, lng, businessName, address }) => {
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markerRef = useRef(null);

    useEffect(() => {
        const latNum = parseCoord(lat);
        const lngNum = parseCoord(lng);
        if (!mapRef.current || latNum == null || lngNum == null) return undefined;

        ensureLeafletMapDetachedIfOrphan(mapInstanceRef, mapRef.current);

        if (!mapInstanceRef.current) {
            const map = L.map(mapRef.current, {
                center: [latNum, lngNum],
                zoom: 14,
                scrollWheelZoom: false,
                dragging: true,
                zoomControl: true,
            });

            L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a>',
                maxZoom: 19,
            }).addTo(map);

            mapInstanceRef.current = map;
        } else {
            mapInstanceRef.current.setView([latNum, lngNum], 14);
        }

        if (markerRef.current) {
            mapInstanceRef.current.removeLayer(markerRef.current);
        }

        const marker = L.marker([latNum, lngNum]).addTo(mapInstanceRef.current);
        if (businessName || address) {
            const popupContent = `
                ${businessName ? `<b>${businessName}</b><br />` : ''}
                ${address || ''}
            `;
            marker.bindPopup(popupContent);
        }
        markerRef.current = marker;

        const resizeTimers = [50, 200].map((ms) =>
            setTimeout(() => mapInstanceRef.current?.invalidateSize(), ms)
        );

        return () => {
            resizeTimers.forEach(clearTimeout);
        };
    }, [lat, lng, businessName, address]);

    useEffect(() => () => detachLeafletMap(mapInstanceRef), []);

    return (
        <div
            ref={mapRef}
            className="leaflet-container-home"
            style={{
                height: '100%',
                width: '100%',
                minHeight: '280px',
                borderRadius: '16px',
                position: 'relative',
                zIndex: 1,
            }}
        />
    );
};

function parseCoord(value) {
    if (value == null || value === '') return null;
    const n = typeof value === 'number' ? value : parseFloat(String(value).trim());
    return Number.isFinite(n) ? n : null;
}

export default SimpleMap;
