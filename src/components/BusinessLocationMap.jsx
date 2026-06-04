import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import SimpleMap from './SimpleMap';
import { geocodeAddress } from '../utils/locationUtils';

function buildAddressLine(address, city, country) {
    return [address, city, country].filter(Boolean).join(', ');
}

function parseCoord(value) {
    if (value == null || value === '') return null;
    const n = typeof value === 'number' ? value : parseFloat(String(value).trim());
    return Number.isFinite(n) ? n : null;
}

function resolveStoredCoords(lat, lng) {
    const latNum = parseCoord(lat);
    const lngNum = parseCoord(lng);
    if (latNum == null || lngNum == null) return null;
    if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) return null;
    return { lat: latNum, lng: lngNum };
}

const shellStyle = (height) => ({
    height,
    minHeight: height,
    borderRadius: '20px',
    overflow: 'hidden',
    border: '2px solid var(--border-color)',
    position: 'relative',
    boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.1)',
    background: 'var(--bg-secondary, #e2e8f0)',
});

/**
 * Business profile map — Leaflet via stored coords or geocoded address (no Google iframe).
 */
export default function BusinessLocationMap({
    lat,
    lng,
    businessName,
    address,
    city,
    country,
    height = '320px',
}) {
    const { t } = useTranslation();
    const fullAddress = useMemo(
        () => buildAddressLine(address, city, country),
        [address, city, country]
    );
    const storedCoords = useMemo(() => resolveStoredCoords(lat, lng), [lat, lng]);
    const [geocoded, setGeocoded] = useState(null);
    const [geoState, setGeoState] = useState('idle');

    useEffect(() => {
        if (storedCoords) {
            setGeocoded(null);
            setGeoState('idle');
            return undefined;
        }
        if (!fullAddress) {
            setGeocoded(null);
            setGeoState('idle');
            return undefined;
        }

        let cancelled = false;
        setGeoState('loading');
        setGeocoded(null);

        geocodeAddress(fullAddress).then((result) => {
            if (cancelled) return;
            const first = result?.success && result.results?.[0];
            if (first && Number.isFinite(first.lat) && Number.isFinite(first.lng)) {
                setGeocoded({ lat: first.lat, lng: first.lng });
                setGeoState('ready');
            } else {
                setGeoState('failed');
            }
        });

        return () => {
            cancelled = true;
        };
    }, [fullAddress, storedCoords]);

    const coords = storedCoords || geocoded;
    const mapsQuery = encodeURIComponent(fullAddress);

    if (!fullAddress && !coords) return null;

    if (coords) {
        return (
            <div style={shellStyle(height)}>
                <SimpleMap
                    lat={coords.lat}
                    lng={coords.lng}
                    businessName={businessName}
                    address={fullAddress || address}
                />
            </div>
        );
    }

    if (geoState === 'loading') {
        return (
            <div
                style={{
                    ...shellStyle(height),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-muted)',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                }}
            >
                {t('map_loading', 'Loading map…')}
            </div>
        );
    }

    return (
        <div
            style={{
                ...shellStyle(height),
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                padding: '20px',
                textAlign: 'center',
            }}
        >
            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                {t('map_preview_unavailable', 'Map preview unavailable')}
            </span>
            {fullAddress && (
                <a
                    href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                        color: 'var(--brand-primary, var(--primary))',
                        fontWeight: 800,
                        fontSize: '0.95rem',
                        textDecoration: 'none',
                    }}
                >
                    {t('open_in_maps', 'Open in Maps')}
                </a>
            )}
        </div>
    );
}
