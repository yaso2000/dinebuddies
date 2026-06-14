import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { auth } from '../../firebase/config';
import {
    previewBusinessFromGoogle,
    publishBusinessFromGoogle,
} from '../../services/adminGooglePlacesImport';
import LocationAutocomplete from '../../components/LocationAutocomplete';
import AdminPlacesGeoFilter from '../components/AdminPlacesGeoFilter';
import { DEFAULT_BUSINESS_COVER } from '../../utils/businessCoverImage';
import '../../components/venue-search.css';

const EMPTY_GEO = {
    countryCode: '',
    countryName: '',
    stateCode: '',
    stateName: '',
    city: '',
    readyForBusinessSearch: false,
};

export default function GooglePlacesImportPage() {
    const { t } = useTranslation();
    const [geo, setGeo] = useState(EMPTY_GEO);
    const [searchText, setSearchText] = useState('');
    const [selected, setSelected] = useState(null);
    const [fetching, setFetching] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [error, setError] = useState('');
    const [preview, setPreview] = useState(null);
    const [previewCoverImage, setPreviewCoverImage] = useState(null);
    const [result, setResult] = useState(null);
    const inFlightRef = useRef(false);

    const handleGeoChange = useCallback((next) => {
        setGeo(next);
        setSearchText('');
        setSelected(null);
        setPreview(null);
        setPreviewCoverImage(null);
        setResult(null);
        setError('');
    }, []);

    const runPreview = useCallback(
        async (placeId, placePreview) => {
            const id = String(placeId || '').trim();
            if (!id || inFlightRef.current) return;

            inFlightRef.current = true;
            setFetching(true);
            setError('');
            setPreview(null);
            setPreviewCoverImage(null);
            setResult(null);
            if (placePreview) setSelected(placePreview);

            try {
                const user = auth.currentUser;
                if (!user) {
                    setError(t('admin_places_login_required'));
                    return;
                }
                const token = await user.getIdToken();
                const { ok, status, data } = await previewBusinessFromGoogle(id, token);

                if (!ok || data?.status !== 'ok' || data.action !== 'preview') {
                    const msg =
                        data?.message ||
                        (data?.code === 'google-places-failed'
                            ? t('admin_places_google_fetch_failed', {
                                  message: data?.message || '',
                              })
                            : status === 429
                              ? data?.message || t('admin_places_rate_limited')
                              : t('admin_places_preview_failed'));
                    setError(msg.trim());
                    return;
                }

                setPreview(data);
                setPreviewCoverImage(data.previewCoverImage || null);
                if (data.photoWarning) {
                    setError(
                        t('admin_places_google_photo_failed', {
                            message: data.photoWarning.message,
                        }),
                    );
                }
            } catch (e) {
                setError(e?.message || t('admin_places_connection_failed'));
            } finally {
                setFetching(false);
                inFlightRef.current = false;
            }
        },
        [t],
    );

    const runPublish = useCallback(
        async () => {
            const id = String(selected?.placeId || preview?.placeId || '').trim();
            if (!id || inFlightRef.current || !preview) return;

            inFlightRef.current = true;
            setPublishing(true);
            setError('');

            try {
                const user = auth.currentUser;
                if (!user) {
                    setError(t('admin_places_login_required'));
                    return;
                }
                const token = await user.getIdToken();
                const { ok, status, data } = await publishBusinessFromGoogle(
                    id,
                    previewCoverImage,
                    token,
                );

                if (!ok || data?.status !== 'ok' || data.action !== 'publish') {
                    const msg =
                        data?.message ||
                        (data?.code === 'photo-storage-failed' || data?.code === 'invalid-cover-data'
                            ? t('admin_places_publish_storage_failed')
                            : data?.code === 'google-places-failed'
                              ? t('admin_places_google_fetch_failed', {
                                    message: data?.message || '',
                                })
                              : status === 429
                                ? data?.message || t('admin_places_rate_limited')
                                : t('admin_places_publish_failed'));
                    setError(msg.trim());
                    return;
                }

                setResult(data);
                setError('');
            } catch (e) {
                setError(e?.message || t('admin_places_connection_failed'));
            } finally {
                setPublishing(false);
                inFlightRef.current = false;
            }
        },
        [preview, previewCoverImage, selected?.placeId, t],
    );

    const handlePlaceSelect = useCallback(
        (place) => {
            const placeId = String(place?.placeId || '').trim();
            if (!placeId) {
                setError(t('admin_places_place_resolve_failed'));
                setSelected(null);
                return;
            }
            const row = {
                placeId,
                name: String(place?.name || '').trim() || placeId,
                address: String(place?.fullAddress || '').trim(),
            };
            setSearchText(String(place?.name || place?.fullAddress || '').trim());
            setSelected(row);
            setPreview(null);
            setPreviewCoverImage(null);
            setResult(null);
            setError('');
        },
        [t],
    );

    const businessSearchStep = geo.stateName ? '4' : '3';
    const coverSrc = previewCoverImage || DEFAULT_BUSINESS_COVER;
    const publishedCoverSrc =
        String(result?.placeholder?.coverImage || '').trim() || coverSrc;

    return (
        <div>
            <h1 className="db-h1">{t('admin_places_title')}</h1>
            <p className="db-lead" style={{ marginBottom: '1.25rem', maxWidth: 620 }}>
                {t('admin_places_lead')}
            </p>

            <div
                style={{
                    maxWidth: 680,
                    padding: '1.25rem',
                    borderRadius: 8,
                    border: '1px solid var(--db-border)',
                    background: 'var(--db-elevated)',
                }}
            >
                <h2 className="db-h2" style={{ fontSize: '1rem', marginBottom: '1rem' }}>
                    {t('admin_places_location_filter')}
                </h2>
                <AdminPlacesGeoFilter onFilterChange={handleGeoChange} />

                <hr style={{ margin: '1.25rem 0', border: 'none', borderTop: '1px solid var(--db-border)' }} />

                <label className="db-label" htmlFor="admin-google-places-search">
                    {t('admin_places_business_search_label', { step: businessSearchStep })}
                </label>
                <LocationAutocomplete
                    value={searchText}
                    onChange={(e) => {
                        setSearchText(e.target.value);
                        if (selected) setSelected(null);
                    }}
                    onSelect={handlePlaceSelect}
                    useGooglePlacesMinimal
                    googleBusinessSearch
                    required={false}
                    disabled={!geo.readyForBusinessSearch}
                    countryCode={geo.countryCode}
                    city={geo.city}
                    region={geo.stateName}
                    placeholder={
                        geo.readyForBusinessSearch
                            ? t('admin_places_business_search_placeholder', { city: geo.city })
                            : t('admin_places_complete_geo_first')
                    }
                    aria-label={t('admin_places_aria_search')}
                    inputStyle={{
                        padding: '0.65rem 0.75rem',
                        borderRadius: 8,
                        border: '1px solid var(--db-border)',
                        background: 'var(--db-input-bg, var(--bg-input))',
                        color: 'var(--db-text, var(--text-main))',
                        fontSize: '0.95rem',
                        opacity: geo.readyForBusinessSearch ? 1 : 0.55,
                    }}
                />

                {selected && (
                    <div
                        style={{
                            marginTop: '1rem',
                            padding: '0.85rem 1rem',
                            borderRadius: 8,
                            border: '1px solid var(--db-border)',
                            background: 'rgba(0,0,0,0.15)',
                        }}
                    >
                        <p style={{ margin: 0, fontWeight: 700 }}>{selected.name}</p>
                        {selected.address && (
                            <p className="db-muted" style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}>
                                {selected.address}
                            </p>
                        )}
                        <p className="db-muted" style={{ margin: '0.5rem 0 0', fontSize: '0.75rem' }}>
                            Place ID: <code>{selected.placeId}</code>
                        </p>

                        {!fetching && !preview && (
                            <button
                                type="button"
                                className="db-btn db-btn--primary"
                                style={{ marginTop: '0.85rem' }}
                                onClick={() => runPreview(selected.placeId, selected)}
                            >
                                {t('admin_places_fetch_preview')}
                            </button>
                        )}
                    </div>
                )}

                {fetching && (
                    <p className="db-muted" style={{ marginTop: '1rem' }}>
                        {t('admin_places_fetching')}
                    </p>
                )}

                {preview && !result && (
                    <>
                        <div style={{ marginTop: '1rem' }}>
                            <img
                                src={coverSrc}
                                alt={
                                    preview.preview?.name ||
                                    selected?.name ||
                                    t('admin_places_cover_alt_preview')
                                }
                                style={{
                                    width: '100%',
                                    maxHeight: 220,
                                    objectFit: 'cover',
                                    borderRadius: 8,
                                    border: '1px solid var(--db-border)',
                                }}
                            />
                            <p className="db-muted" style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                                {previewCoverImage
                                    ? t('admin_places_preview_in_memory')
                                    : t('admin_places_no_google_image')}
                            </p>
                        </div>

                        <pre
                            className="db-code"
                            style={{
                                marginTop: '1rem',
                                padding: '1rem',
                                borderRadius: 8,
                                background: 'rgba(0,0,0,0.25)',
                                fontSize: '0.8rem',
                                overflow: 'auto',
                            }}
                        >
                            {JSON.stringify(preview.preview, null, 2)}
                        </pre>

                        {preview.alreadyExisted && (
                            <p style={{ marginTop: '0.5rem', color: '#fbbf24', fontSize: '0.85rem' }}>
                                {t('admin_places_already_imported_plain')}{' '}
                                <code>restaurants/{preview.docId}</code>.
                            </p>
                        )}

                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                className="db-btn db-btn--primary"
                                disabled={publishing}
                                onClick={runPublish}
                            >
                                {publishing ? t('admin_places_publishing') : t('admin_places_publish')}
                            </button>
                            <button
                                type="button"
                                className="db-btn db-btn--secondary"
                                disabled={fetching || publishing}
                                onClick={() => runPreview(selected.placeId, selected)}
                            >
                                {t('admin_places_refetch_preview')}
                            </button>
                        </div>
                    </>
                )}

                {error && (
                    <p className="db-error" role="alert" style={{ marginTop: '1rem' }}>
                        {error}
                    </p>
                )}

                {result?.docId && (
                    <>
                        <p className="db-muted" style={{ marginTop: '0.5rem' }}>
                            Firestore: <code>restaurants/{result.docId}</code>
                            {result.directorySynced && (
                                <> · Directory: <code>public_profiles/{result.docId}</code></>
                            )}
                        </p>
                        <p className="db-muted" style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                            {t('admin_places_visible_in')}{' '}
                            <a href="/restaurants" target="_blank" rel="noreferrer">
                                {t('admin_places_business_list_link')}
                            </a>
                            {' · '}
                            <a href={`/business/${result.docId}`} target="_blank" rel="noreferrer">
                                {t('admin_places_business_profile_link', { id: result.docId })}
                            </a>
                        </p>
                        <div style={{ marginTop: '0.75rem' }}>
                            <img
                                src={publishedCoverSrc}
                                alt={result.placeholder?.name || t('admin_places_cover_alt')}
                                style={{
                                    width: '100%',
                                    maxHeight: 220,
                                    objectFit: 'cover',
                                    borderRadius: 8,
                                    border: '1px solid var(--db-border)',
                                }}
                            />
                            <p
                                style={{
                                    marginTop: '0.5rem',
                                    color: 'var(--db-lime, #84cc16)',
                                    fontSize: '0.85rem',
                                }}
                            >
                                {t('admin_places_cover_saved')}
                                {result.placeholder?.coverImageStoragePath && (
                                    <>
                                        {' '}
                                        <code style={{ fontSize: '0.75rem' }}>
                                            {result.placeholder.coverImageStoragePath}
                                        </code>
                                    </>
                                )}
                            </p>
                        </div>
                        <button
                            type="button"
                            className="db-btn db-btn--secondary"
                            style={{ marginTop: '1rem' }}
                            disabled={fetching || publishing}
                            onClick={() => {
                                setResult(null);
                                runPreview(selected.placeId, selected);
                            }}
                        >
                            {t('admin_places_new_preview')}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
