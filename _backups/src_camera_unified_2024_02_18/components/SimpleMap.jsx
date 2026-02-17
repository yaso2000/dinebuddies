import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icons
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

    useEffect(() => {
        if (!mapInstanceRef.current && mapRef.current && lat && lng) {
            const map = L.map(mapRef.current, {
                center: [lat, lng],
                zoom: 14,
                scrollWheelZoom: false,
                dragging: true,
                zoomControl: true
            });

            L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a>',
                maxZoom: 19
            }).addTo(map);

            // Add marker
            const marker = L.marker([lat, lng]).addTo(map);

            // Add popup
            if (businessName || address) {
                const popupContent = `
                    ${businessName ? `<b>${businessName}</b><br />` : ''}
                    ${address || ''}
                `;
                marker.bindPopup(popupContent);
            }

            mapInstanceRef.current = map;

            // Force resize
            setTimeout(() => {
                map.invalidateSize();
            }, 100);
        }

        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
    }, [lat, lng, businessName, address]);

    return (
        <div
            ref={mapRef}
            style={{
                height: '100%',
                width: '100%',
                borderRadius: '16px',
                position: 'relative',
                zIndex: 1
            }}
        />
    );
};

export default SimpleMap;
