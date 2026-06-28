import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { auth } from '../../firebase/config';
import {
  previewBusinessFromGoogle,
  publishBusinessFromGoogle } from
'../../services/adminGooglePlacesImport';
import LocationAutocomplete from '../../components/LocationAutocomplete';
import AdminPlacesGeoFilter from '../components/AdminPlacesGeoFilter';
import { DEFAULT_BUSINESS_COVER } from '../../utils/businessCoverImage';
import '../../components/venue-search.css';
import { AppText } from "../../components/base";

const EMPTY_GEO = {
  countryCode: '',
  countryName: '',
  stateCode: '',
  stateName: '',
  city: '',
  readyForBusinessSearch: false
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
  const [forceCreate, setForceCreate] = useState(false);
  const inFlightRef = useRef(false);

  const duplicateReasonLabel = useCallback(
    (reason) => {
      if (reason === 'phone') return t('admin_places_dup_phone', 'Same phone number');
      if (reason === 'coordinates') return t('admin_places_dup_coordinates', 'Same coordinates');
      if (reason === 'address') return t('admin_places_dup_address', 'Same address');
      return reason;
    },
    [t]
  );

  const handleGeoChange = useCallback((next) => {
    setGeo(next);
    setSearchText('');
    setSelected(null);
    setPreview(null);
    setPreviewCoverImage(null);
    setResult(null);
    setForceCreate(false);
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
          data?.message || (
          data?.code === 'google-places-failed' ?
          t('admin_places_google_fetch_failed', {
            message: data?.message || ''
          }) :
          status === 429 ?
          data?.message || t('admin_places_rate_limited') :
          t('admin_places_preview_failed'));
          setError(msg.trim());
          return;
        }

        setPreview(data);
        setPreviewCoverImage(data.previewCoverImage || null);
        setForceCreate(false);
        if (data.photoWarning) {
          setError(
            t('admin_places_google_photo_failed', {
              message: data.photoWarning.message
            })
          );
        }
      } catch (e) {
        setError(e?.message || t('admin_places_connection_failed'));
      } finally {
        setFetching(false);
        inFlightRef.current = false;
      }
    },
    [t]
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
          { forceCreate }
        );

        if (!ok || data?.status !== 'ok' || data.action !== 'publish') {
          const msg =
          data?.message || (
          data?.code === 'photo-storage-failed' || data?.code === 'invalid-cover-data' ?
          t('admin_places_publish_storage_failed') :
          data?.code === 'google-places-failed' ?
          t('admin_places_google_fetch_failed', {
            message: data?.message || ''
          }) :
          status === 429 ?
          data?.message || t('admin_places_rate_limited') :
          t('admin_places_publish_failed'));
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
    [preview, previewCoverImage, selected?.placeId, t, forceCreate]
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
        address: String(place?.fullAddress || '').trim()
      };
      setSearchText(String(place?.name || place?.fullAddress || '').trim());
      setSelected(row);
      setPreview(null);
      setPreviewCoverImage(null);
      setResult(null);
      setError('');
    },
    [t]
  );

  const businessSearchStep = geo.stateName ? '4' : '3';
  const coverSrc = previewCoverImage || DEFAULT_BUSINESS_COVER;
  const publishedCoverSrc =
  String(result?.placeholder?.coverImage || '').trim() || coverSrc;

  return (
    <div>
            <AppText as="h1" className="db-h1">{t('admin_places_title')}</AppText>
            <AppText as="p" className="db-lead" style={{ marginBottom: '1.25rem', maxWidth: 620 }}>
                {t('admin_places_lead')}
            </AppText>

            <div
        style={{
          maxWidth: 680,
          padding: '1.25rem',
          borderRadius: 8,
          border: '1px solid var(--db-border)',
          background: 'var(--db-elevated)'
        }}>
        
                <AppText as="h2" className="db-h2" style={{ fontSize: '1rem', marginBottom: '1rem' }}>
                    {t('admin_places_location_filter')}
                </AppText>
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
          geo.readyForBusinessSearch ?
          t('admin_places_business_search_placeholder', { city: geo.city }) :
          t('admin_places_complete_geo_first')
          }
          aria-label={t('admin_places_aria_search')}
          inputStyle={{
            padding: '0.65rem 0.75rem',
            borderRadius: 8,
            border: '1px solid var(--db-border)',
            background: 'var(--db-input-bg, var(--bg-input))',
            color: 'var(--db-text, var(--text-main))',
            fontSize: '0.95rem',
            opacity: geo.readyForBusinessSearch ? 1 : 0.55
          }} />
        

                {selected &&
        <div
          style={{
            marginTop: '1rem',
            padding: '0.85rem 1rem',
            borderRadius: 8,
            border: '1px solid var(--db-border)',
            background: 'rgba(0,0,0,0.15)'
          }}>
          
                        <AppText as="p" style={{ margin: 0, fontWeight: 700 }}>{selected.name}</AppText>
                        {selected.address &&
          <AppText as="p" className="db-muted" style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}>
                                {selected.address}
                            </AppText>
          }
                        <AppText as="p" className="db-muted" style={{ margin: '0.5rem 0 0', fontSize: '0.75rem' }}>
                            Place ID: <code>{selected.placeId}</code>
                        </AppText>

                        {!fetching && !preview &&
          <button
            type="button"
            className="db-btn db-btn--primary"
            style={{ marginTop: '0.85rem' }}
            onClick={() => runPreview(selected.placeId, selected)}>
            
                                {t('admin_places_fetch_preview')}
                            </button>
          }
                    </div>
        }

                {fetching &&
        <AppText as="p" className="db-muted" style={{ marginTop: '1rem' }}>
                        {t('admin_places_fetching')}
                    </AppText>
        }

                {preview && !result &&
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
                border: '1px solid var(--db-border)'
              }} />
            
                            <AppText as="p" className="db-muted" style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                                {previewCoverImage ?
              t('admin_places_preview_in_memory') :
              t('admin_places_no_google_image')}
                            </AppText>
                        </div>

                        <pre
            className="db-code"
            style={{
              marginTop: '1rem',
              padding: '1rem',
              borderRadius: 8,
              background: 'rgba(0,0,0,0.25)',
              fontSize: '0.8rem',
              overflow: 'auto'
            }}>
            
                            {JSON.stringify(preview.preview, null, 2)}
                        </pre>

                        {preview.alreadyExisted &&
          <AppText as="p" style={{ marginTop: '0.5rem', color: '#fbbf24', fontSize: '0.85rem' }}>
                                {t('admin_places_already_imported_plain')}{' '}
                                <code>restaurants/{preview.docId}</code>.
                            </AppText>
          }

                        {Array.isArray(preview.duplicateMatches) && preview.duplicateMatches.length > 0 && !preview.alreadyExisted &&
          <div
            style={{
              marginTop: '0.75rem',
              padding: '0.75rem',
              borderRadius: 8,
              border: '1px solid #fbbf24',
              background: 'rgba(251, 191, 36, 0.08)'
            }}>
            
                                <AppText as="p" style={{ margin: 0, color: '#fbbf24', fontSize: '0.85rem', fontWeight: 700 }}>
                                    {t('admin_places_duplicate_warning', 'Possible duplicate business detected')}
                                </AppText>
                                <ul style={{ margin: '0.5rem 0 0', paddingInlineStart: '1.1rem', fontSize: '0.82rem' }}>
                                    {preview.duplicateMatches.map((match) =>
              <li key={`${match.docId}:${match.matchReason}`} style={{ marginBottom: '0.35rem' }}>
                                            <strong>{match.name}</strong>
                                            {' · '}
                                            <code>restaurants/{match.docId}</code>
                                            {' · '}
                                            {duplicateReasonLabel(match.matchReason)}
                                        </li>
              )}
                                </ul>
                                {preview.duplicateMergeTarget &&
            <AppText as="p" className="db-muted" style={{ margin: '0.5rem 0 0', fontSize: '0.82rem' }}>
                                        {t('admin_places_duplicate_merge_hint', {
                  docId: preview.duplicateMergeTarget,
                  defaultValue:
                    'Publish will update the existing record restaurants/{{docId}} instead of creating a duplicate.'
                })}
                                    </AppText>
            }
                                <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', marginTop: '0.65rem', fontSize: '0.82rem', cursor: 'pointer' }}>
                                    <input
                type="checkbox"
                checked={forceCreate}
                onChange={(e) => setForceCreate(e.target.checked)} />
              
                                    {t(
                'admin_places_force_create',
                'Create as a new business anyway (ignore duplicate detection)'
              )}
                                </label>
                            </div>
          }

                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                            <button
              type="button"
              className="db-btn db-btn--primary"
              disabled={publishing}
              onClick={runPublish}>
              
                                {publishing ?
              t('admin_places_publishing') :
              preview.alreadyExisted ?
              t('admin_places_publish_update', 'Update existing') :
              preview.duplicateMergeTarget && !forceCreate ?
              t('admin_places_publish_merge', 'Update matched business') :
              t('admin_places_publish')}
                            </button>
                            <button
              type="button"
              className="db-btn db-btn--secondary"
              disabled={fetching || publishing}
              onClick={() => runPreview(selected.placeId, selected)}>
              
                                {t('admin_places_refetch_preview')}
                            </button>
                        </div>
                    </>
        }

                {error &&
        <AppText as="p" className="db-error" role="alert" style={{ marginTop: '1rem' }}>
                        {error}
                    </AppText>
        }

                {result?.docId &&
        <>
                        <AppText as="p" className="db-muted" style={{ marginTop: '0.5rem' }}>
                            Firestore: <code>restaurants/{result.docId}</code>
                            {result.directorySynced &&
            <> · Directory: <code>public_profiles/{result.docId}</code></>
            }
                        </AppText>
                        {result.mergedFromDuplicate &&
          <AppText as="p" style={{ marginTop: '0.5rem', color: '#fbbf24', fontSize: '0.85rem' }}>
                            {t('admin_places_merged_from_duplicate', {
              reason: duplicateReasonLabel(result.duplicateMergeReason),
              defaultValue: 'Updated existing business (matched by {{reason}}) — no duplicate was created.'
            })}
                        </AppText>
          }
                        <AppText as="p" className="db-muted" style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                            {t('admin_places_visible_in')}{' '}
                            <a href="/restaurants" target="_blank" rel="noreferrer">
                                {t('admin_places_business_list_link')}
                            </a>
                            {' · '}
                            <a href={`/business/${result.docId}`} target="_blank" rel="noreferrer">
                                {t('admin_places_business_profile_link', { id: result.docId })}
                            </a>
                        </AppText>
                        <div style={{ marginTop: '0.75rem' }}>
                            <img
              src={publishedCoverSrc}
              alt={result.placeholder?.name || t('admin_places_cover_alt')}
              style={{
                width: '100%',
                maxHeight: 220,
                objectFit: 'cover',
                borderRadius: 8,
                border: '1px solid var(--db-border)'
              }} />
            
                            <AppText as="p"
            style={{
              marginTop: '0.5rem',
              color: 'var(--db-lime, #84cc16)',
              fontSize: '0.85rem'
            }}>
              
                                {t('admin_places_cover_saved')}
                                {result.placeholder?.coverImageStoragePath &&
              <>
                                        {' '}
                                        <code style={{ fontSize: '0.75rem' }}>
                                            {result.placeholder.coverImageStoragePath}
                                        </code>
                                    </>
              }
                            </AppText>
                        </div>
                        <button
            type="button"
            className="db-btn db-btn--secondary"
            style={{ marginTop: '1rem' }}
            disabled={fetching || publishing}
            onClick={() => {
              setResult(null);
              runPreview(selected.placeId, selected);
            }}>
            
                            {t('admin_places_new_preview')}
                        </button>
                    </>
        }
            </div>
        </div>);

}