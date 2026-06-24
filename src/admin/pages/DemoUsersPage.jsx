import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AdminPlacesGeoFilter from '../components/AdminPlacesGeoFilter';
import DemoUserImageUpload from '../components/DemoUserImageUpload';
import PrivateProfileFields from '../../components/profile/PrivateProfileFields';
import { fetchCityBoundingBox } from '../../utils/osmPhotonSearch';
import { adminApi } from '../api';
import { AppText, AppTextInput } from '../../components/base';

const EMPTY_GEO = {
  countryCode: '',
  countryName: '',
  stateCode: '',
  stateName: '',
  city: '',
  readyForBusinessSearch: false,
};

const AGE_CATEGORIES = ['18-24', '25-34', '35-44', '45-54', '55+'];

const EMPTY_PROFILE = {
  displayName: '',
  gender: '',
  ageCategory: '',
  bio: '',
  photo_url: '',
  cover_photo: '',
  profileGallery: ['', '', ''],
  diningPersona: [],
  joinReasons: [],
  firstDatePlaceHint: '',
  invitePreference: 'any',
  availableForPrivateInvite: true,
};

export default function DemoUsersPage() {
  const { t } = useTranslation();
  const [geo, setGeo] = useState(EMPTY_GEO);
  const [coords, setCoords] = useState(null);
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [creating, setCreating] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [deletingUid, setDeletingUid] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [users, setUsers] = useState([]);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const demoCityIdPreview = useMemo(() => {
    if (!geo.city || !geo.countryCode) return '';
    const slug = String(geo.city)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48);
    return `${slug}-${String(geo.countryCode).toLowerCase()}`;
  }, [geo.city, geo.countryCode]);

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const res = await adminApi.listDemoUsers();
      setUsers(Array.isArray(res.users) ? res.users : []);
    } catch (e) {
      setError(e.message || t('admin_demo_users_load_failed', 'Could not load demo users.'));
    } finally {
      setLoadingUsers(false);
    }
  }, [t]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (!geo.readyForBusinessSearch || !geo.city || !geo.countryCode) {
      setCoords(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const bbox = await fetchCityBoundingBox(geo.city, geo.countryCode, geo.stateName);
      if (cancelled) return;
      if (bbox) {
        setCoords({
          lat: (bbox.minLat + bbox.maxLat) / 2,
          lng: (bbox.minLon + bbox.maxLon) / 2,
        });
      } else {
        setCoords(null);
        setError(t('admin_demo_users_geocode_failed', 'Could not locate city coordinates.'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [geo, t]);

  const updateProfile = (patch) => {
    setProfile((prev) => ({ ...prev, ...patch }));
  };

  const updateGallerySlot = (index, value) => {
    setProfile((prev) => {
      const next = [...prev.profileGallery];
      next[index] = value;
      return { ...prev, profileGallery: next };
    });
  };

  const validateForm = () => {
    if (!geo.city || !geo.countryCode) {
      return t('admin_demo_users_pick_city', 'Select country and city first.');
    }
    if (!coords || !Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) {
      return t('admin_demo_users_geocode_failed', 'Could not locate city coordinates.');
    }
    if (!profile.displayName.trim()) {
      return t('admin_demo_user_name_required', 'Display name is required.');
    }
    if (!profile.gender) {
      return t('admin_demo_user_gender_required', 'Gender is required.');
    }
    if (!profile.ageCategory) {
      return t('admin_demo_user_age_required', 'Age group is required.');
    }
    return '';
  };

  const handleSuggest = async () => {
    setError('');
    setMsg('');
    if (!geo.city || !geo.countryCode) {
      setError(t('admin_demo_users_pick_city', 'Select country and city first.'));
      return;
    }
    setSuggesting(true);
    try {
      const res = await adminApi.suggestDemoUserProfile({
        city: geo.city,
        countryCode: geo.countryCode,
        countryName: geo.countryName,
        stateName: geo.stateName,
      });
      const suggested = res?.profile;
      if (!suggested) {
        setError(t('admin_demo_user_suggest_empty', 'AI returned no profile.'));
        return;
      }
      setProfile((prev) => ({
        ...prev,
        displayName: suggested.display_name || suggested.displayName || prev.displayName,
        gender: suggested.gender === 'female' ? 'female' : suggested.gender === 'male' ? 'male' : prev.gender,
        ageCategory: AGE_CATEGORIES.includes(suggested.ageCategory) ? suggested.ageCategory : prev.ageCategory,
        bio: suggested.bio || prev.bio,
        diningPersona: Array.isArray(suggested.diningPersona) ? suggested.diningPersona : prev.diningPersona,
        joinReasons: Array.isArray(suggested.joinReasons) ? suggested.joinReasons : prev.joinReasons,
        firstDatePlaceHint: suggested.firstDatePlaceHint || prev.firstDatePlaceHint,
      }));
      setMsg(t('admin_demo_user_suggested', 'Profile text suggested — review and edit before publishing.'));
    } catch (e) {
      setError(e.message || t('admin_failed', 'Failed.'));
    } finally {
      setSuggesting(false);
    }
  };

  const handleCreate = async () => {
    setError('');
    setMsg('');
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    if (
      !window.confirm(
        t('admin_demo_user_create_confirm', {
          name: profile.displayName.trim(),
          city: geo.city,
        })
      )
    ) {
      return;
    }

    setCreating(true);
    try {
      const res = await adminApi.createDemoUser({
        city: geo.city,
        countryCode: geo.countryCode,
        countryName: geo.countryName,
        stateName: geo.stateName,
        lat: coords.lat,
        lng: coords.lng,
        profile: {
          displayName: profile.displayName.trim(),
          gender: profile.gender,
          ageCategory: profile.ageCategory,
          bio: profile.bio.trim(),
          photo_url: profile.photo_url.trim(),
          cover_photo: profile.cover_photo.trim(),
          profileGallery: profile.profileGallery.map((u) => u.trim()),
          diningPersona: profile.diningPersona,
          joinReasons: profile.joinReasons,
          firstDatePlaceHint: profile.firstDatePlaceHint,
          invitePreference: profile.invitePreference,
          availableForPrivateInvite: profile.availableForPrivateInvite,
        },
      });
      setMsg(
        t('admin_demo_user_created', {
          name: profile.displayName.trim(),
          city: geo.city,
          uid: res.uid,
        })
      );
      setProfile(EMPTY_PROFILE);
      await loadUsers();
    } catch (e) {
      setError(e.message || t('admin_failed', 'Failed.'));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (row) => {
    if (!row?.uid) return;
    if (
      !window.confirm(
        t('admin_demo_user_delete_confirm', {
          name: row.displayName || row.uid,
          city: row.city,
        })
      )
    ) {
      return;
    }
    setDeletingUid(row.uid);
    setError('');
    setMsg('');
    try {
      await adminApi.deleteDemoUser({ uid: row.uid });
      setMsg(t('admin_demo_user_deleted', { name: row.displayName || row.uid }));
      await loadUsers();
    } catch (e) {
      setError(e.message || t('admin_failed', 'Failed.'));
    } finally {
      setDeletingUid('');
    }
  };

  return (
    <>
      <AppText as="h1" className="db-h1">
        {t('admin_demo_users_title', 'Demo users')}
      </AppText>
      <AppText as="p" className="db-lead">
        {t(
          'admin_demo_users_lead_single',
          'Create one demo consumer profile at a time with full profile fields and an exact city location. No Auth account is created.'
        )}
      </AppText>

      <div className="db-panel" style={{ marginBottom: '1.25rem', padding: '1rem' }}>
        <AppText as="h2" className="db-h2" style={{ marginTop: 0 }}>
          {t('admin_demo_user_create_section', 'Create demo user')}
        </AppText>

        <AppText as="h3" className="db-h3" style={{ marginTop: '1rem' }}>
          {t('admin_demo_user_location_section', 'Location')}
        </AppText>
        <AdminPlacesGeoFilter onFilterChange={setGeo} />

        {coords ? (
          <div style={{ marginTop: '0.75rem', display: 'grid', gap: '0.75rem', maxWidth: 420 }}>
            <AppText as="p" className="db-muted" style={{ fontSize: '0.85rem', margin: 0 }}>
              {t('admin_demo_users_coords', {
                lat: coords.lat.toFixed(4),
                lng: coords.lng.toFixed(4),
                id: demoCityIdPreview,
              })}
            </AppText>
            <label className="db-label" htmlFor="admin-demo-lat">
              {t('admin_demo_user_lat', 'Latitude')}
            </label>
            <AppTextInput
              id="admin-demo-lat"
              type="number"
              step="any"
              className="db-input"
              value={coords.lat}
              onChange={(e) => setCoords((prev) => ({ ...prev, lat: Number(e.target.value) }))}
            />
            <label className="db-label" htmlFor="admin-demo-lng">
              {t('admin_demo_user_lng', 'Longitude')}
            </label>
            <AppTextInput
              id="admin-demo-lng"
              type="number"
              step="any"
              className="db-input"
              value={coords.lng}
              onChange={(e) => setCoords((prev) => ({ ...prev, lng: Number(e.target.value) }))}
            />
          </div>
        ) : null}

        <AppText as="h3" className="db-h3" style={{ marginTop: '1.25rem' }}>
          {t('admin_demo_user_required_section', 'Required profile fields')}
        </AppText>
        <div style={{ marginTop: '0.75rem', display: 'grid', gap: '0.75rem', maxWidth: 420 }}>
          <label className="db-label" htmlFor="admin-demo-name">
            {t('display_name', 'Display name')} *
          </label>
          <AppTextInput
            id="admin-demo-name"
            className="db-input"
            value={profile.displayName}
            onChange={(e) => updateProfile({ displayName: e.target.value })}
          />

          <label className="db-label">{t('gender', 'Gender')} *</label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {[
              { value: 'male', label: t('male', 'Male') },
              { value: 'female', label: t('female', 'Female') },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`db-btn${profile.gender === opt.value ? ' db-btn--lime' : ''}`}
                onClick={() => updateProfile({ gender: opt.value })}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <label className="db-label">{t('age_group', 'Age group')} *</label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {AGE_CATEGORIES.map((value) => (
              <button
                key={value}
                type="button"
                className={`db-btn${profile.ageCategory === value ? ' db-btn--lime' : ''}`}
                onClick={() => updateProfile({ ageCategory: value })}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        <AppText as="h3" className="db-h3" style={{ marginTop: '1.25rem' }}>
          {t('admin_demo_user_profile_section', 'Profile details')}
        </AppText>
        <div style={{ marginTop: '0.75rem', display: 'grid', gap: '0.75rem', maxWidth: 520 }}>
          <label className="db-label" htmlFor="admin-demo-bio">
            {t('bio', 'Bio')}
          </label>
          <textarea
            id="admin-demo-bio"
            className="db-input"
            rows={3}
            value={profile.bio}
            onChange={(e) => updateProfile({ bio: e.target.value })}
            style={{ resize: 'vertical' }}
          />

          <DemoUserImageUpload
            label={t('admin_demo_user_photo', 'Profile photo')}
            kind="avatar"
            value={profile.photo_url}
            onChange={(url) => updateProfile({ photo_url: url })}
            disabled={creating}
          />

          <DemoUserImageUpload
            label={t('admin_demo_user_cover', 'Cover photo')}
            kind="cover"
            value={profile.cover_photo}
            onChange={(url) => updateProfile({ cover_photo: url })}
            disabled={creating}
          />

          {[0, 1, 2].map((index) => (
            <DemoUserImageUpload
              key={index}
              label={t('admin_demo_user_gallery_photo', {
                n: index + 1,
                defaultValue: `Gallery photo ${index + 1}`,
              })}
              kind="gallery"
              value={profile.profileGallery[index] || ''}
              onChange={(url) => updateGallerySlot(index, url)}
              disabled={creating}
            />
          ))}

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={profile.availableForPrivateInvite}
              onChange={(e) => updateProfile({ availableForPrivateInvite: e.target.checked })}
            />
            <AppText as="span">
              {t('available_for_private_invite', 'Available for private invitations')}
            </AppText>
          </label>

          <PrivateProfileFields
            diningPersona={profile.diningPersona}
            invitePreference={profile.invitePreference}
            firstDatePlaceHint={profile.firstDatePlaceHint}
            joinReasons={profile.joinReasons}
            showInvitePreference={profile.availableForPrivateInvite}
            onChange={(patch) => updateProfile(patch)}
          />
        </div>

        <div className="db-toolbar" style={{ marginTop: '1.25rem', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="db-btn"
            disabled={suggesting || !geo.readyForBusinessSearch}
            onClick={handleSuggest}
          >
            {suggesting
              ? t('admin_demo_user_suggesting', 'Suggesting…')
              : t('admin_demo_user_suggest_btn', 'Suggest text with AI')}
          </button>
          <button
            type="button"
            className="db-btn db-btn--lime"
            disabled={creating || !coords || !geo.readyForBusinessSearch}
            onClick={handleCreate}
          >
            {creating
              ? t('admin_demo_user_creating', 'Publishing…')
              : t('admin_demo_user_publish_btn', 'Publish demo user')}
          </button>
        </div>
      </div>

      {error ? (
        <AppText as="p" className="db-error" role="alert">
          {error}
        </AppText>
      ) : null}
      {msg ? (
        <AppText as="p" className="db-success" role="status">
          {msg}
        </AppText>
      ) : null}

      <div className="db-panel" style={{ padding: '1rem' }}>
        <AppText as="h2" className="db-h2" style={{ marginTop: 0 }}>
          {t('admin_demo_users_existing', 'Existing demo users')}
        </AppText>
        {loadingUsers ? (
          <AppText as="p" className="db-muted">
            {t('admin_loading', 'Loading…')}
          </AppText>
        ) : users.length === 0 ? (
          <AppText as="p" className="db-muted">
            {t('admin_demo_users_none', 'No demo users yet.')}
          </AppText>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {users.map((row) => (
              <div
                key={row.uid}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  padding: '0.65rem 0',
                  borderBottom: '1px solid var(--db-border, var(--border-color))',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                  {row.photo_url ? (
                    <img
                      src={row.photo_url}
                      alt=""
                      style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }}
                    />
                  ) : null}
                  <div style={{ minWidth: 0 }}>
                    <AppText as="strong">{row.displayName || row.uid}</AppText>
                    <AppText as="div" className="db-muted" style={{ fontSize: '0.85rem' }}>
                      {row.city}
                      {row.countryCode ? ` (${row.countryCode})` : ''}
                      {row.gender ? ` · ${row.gender}` : ''}
                      {row.ageCategory ? ` · ${row.ageCategory}` : ''}
                    </AppText>
                    <AppText as="div" className="db-muted" style={{ fontSize: '0.78rem' }}>
                      {row.uid}
                    </AppText>
                  </div>
                </div>
                <button
                  type="button"
                  className="db-btn db-btn--danger"
                  disabled={Boolean(deletingUid)}
                  onClick={() => handleDelete(row)}
                >
                  {deletingUid === row.uid
                    ? t('admin_deleting', 'Deleting…')
                    : t('admin_demo_users_wipe_btn', 'Delete')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
