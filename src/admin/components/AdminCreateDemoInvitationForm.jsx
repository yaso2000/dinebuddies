import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../api';
import AdminDemoUserPicker from './AdminDemoUserPicker';
import { AppText, AppTextInput } from '../../components/base';

const GENDER_OPTIONS = [
  { id: 'male', labelKey: 'male' },
  { id: 'female', labelKey: 'female' },
  { id: 'unspecified', labelKey: 'unspecified' },
];

const AGE_OPTIONS = ['18-24', '25-34', '35-44', '45-54', '55+'];

const VENUE_TYPES = ['Restaurant', 'Cafe', 'Bar', 'Night Club', 'Cinema', 'Concert', 'Sports Match'];
const INVITE_MOODS = ['social', 'family', 'celebratory', 'friends', 'new_friends', 'formal'];
const PAYMENT_TYPES = ['Split', 'Host pays', 'Guest pays'];
const COLOR_SCHEMES = ['oceanBlue', 'sunsetGlow', 'forestGreen', 'royalPurple', 'midnightBlack'];

function defaultDateString() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function toggleInList(list, value) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export default function AdminCreateDemoInvitationForm({ onCreated }) {
  const { t } = useTranslation();
  const [demoUid, setDemoUid] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(defaultDateString);
  const [time, setTime] = useState('20:30');
  const [location, setLocation] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [city, setCity] = useState('');
  const [guestsNeeded, setGuestsNeeded] = useState(3);
  const [genderGroups, setGenderGroups] = useState(['male', 'female', 'unspecified']);
  const [ageGroups, setAgeGroups] = useState(['18-24', '25-34', '35-44']);
  const [paymentType, setPaymentType] = useState('Split');
  const [type, setType] = useState('Restaurant');
  const [inviteMood, setInviteMood] = useState('social');
  const templateType = 'classic';
  const [colorScheme, setColorScheme] = useState('oceanBlue');
  const [restaurantId, setRestaurantId] = useState('');
  const [businesses, setBusinesses] = useState([]);
  const [loadingBusinesses, setLoadingBusinesses] = useState(true);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const loadBusinesses = useCallback(async () => {
    setLoadingBusinesses(true);
    try {
      const res = await adminApi.listBusinesses({ pageSize: 100 });
      setBusinesses(Array.isArray(res.items) ? res.items : []);
    } catch {
      setBusinesses([]);
    } finally {
      setLoadingBusinesses(false);
    }
  }, []);

  useEffect(() => {
    loadBusinesses();
  }, [loadBusinesses]);

  const selectedBusiness = useMemo(
    () => businesses.find((biz) => biz.id === restaurantId) || null,
    [businesses, restaurantId]
  );

  useEffect(() => {
    if (!selectedBusiness) return;
    if (selectedBusiness.address) setLocation(selectedBusiness.address);
    if (selectedBusiness.city) setCity(selectedBusiness.city);
    if (!title.trim() && selectedBusiness.name) {
      setTitle(t('admin_invite_default_title', { name: selectedBusiness.name, defaultValue: 'Dinner at {{name}}' }));
    }
  }, [selectedBusiness, t, title]);

  const canSubmit = Boolean(
    demoUid &&
    title.trim() &&
    date &&
    time &&
    location.trim() &&
    genderGroups.length > 0 &&
    ageGroups.length > 0 &&
    (restaurantId || (Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))))
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit || creating) return;

    setCreating(true);
    setError('');
    setMsg('');

    try {
      const payload = {
        demoUid,
        title: title.trim(),
        description: description.trim(),
        date,
        time,
        location: location.trim(),
        city: city.trim() || null,
        guestsNeeded,
        genderGroups,
        ageGroups,
        paymentType,
        type,
        inviteMood,
        templateType,
        colorScheme,
      };

      if (restaurantId) {
        payload.restaurantId = restaurantId;
        payload.restaurantName = selectedBusiness?.name || null;
      }
      const latNum = Number(lat);
      const lngNum = Number(lng);
      if (Number.isFinite(latNum) && Number.isFinite(lngNum)) {
        payload.lat = latNum;
        payload.lng = lngNum;
      }

      const result = await adminApi.createDemoPublicInvitation(payload);

      setMsg(
        t('admin_invitations_create_success', {
          name: result.hostName || demoUid,
          id: result.invitationId,
          defaultValue: 'Public invitation published as {{name}} ({{id}}).',
        })
      );
      setTitle('');
      setDescription('');
      setLocation('');
      setLat('');
      setLng('');
      setCity('');
      setRestaurantId('');
      setDemoUid('');
      setDate(defaultDateString());
      setTime('20:30');
      onCreated?.();
    } catch (err) {
      setError(err.message || t('admin_failed', 'Action failed.'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <form
      className="db-panel"
      style={{ marginBottom: '1.25rem', padding: '1rem' }}
      onSubmit={handleSubmit}
    >
      <AppText as="h2" className="db-h2" style={{ marginTop: 0 }}>
        {t('admin_invitations_create_section', 'Create public invitation as demo user')}
      </AppText>
      <AppText as="p" className="db-muted" style={{ marginTop: 0, marginBottom: '1rem', fontSize: '0.85rem' }}>
        {t(
          'admin_invitations_create_hint',
          'Choose a demo host, pick a venue, and publish an active public invitation immediately.'
        )}
      </AppText>

      <div style={{ display: 'grid', gap: '1rem', maxWidth: 560 }}>
        <AdminDemoUserPicker value={demoUid} onChange={setDemoUid} disabled={creating} />

        <div>
          <label className="db-label" htmlFor="admin-invite-business">
            {t('admin_invitations_create_business', 'Business / venue (optional)')}
          </label>
          <select
            id="admin-invite-business"
            className="db-select"
            style={{ width: '100%', maxWidth: 560 }}
            value={restaurantId}
            disabled={creating || loadingBusinesses}
            onChange={(e) => setRestaurantId(e.target.value)}
          >
            <option value="">
              {loadingBusinesses
                ? t('admin_loading', 'Loading…')
                : t('admin_invitations_create_business_none', 'Custom location (enter below)')}
            </option>
            {businesses.map((biz) => (
              <option key={biz.id} value={biz.id}>
                {biz.name}
                {biz.city ? ` · ${biz.city}` : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="db-label" htmlFor="admin-invite-title">
            {t('admin_invitations_title_col', 'Title')} *
          </label>
          <AppTextInput
            id="admin-invite-title"
            className="db-input"
            style={{ width: '100%', maxWidth: 560 }}
            value={title}
            disabled={creating}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div>
          <label className="db-label" htmlFor="admin-invite-description">
            {t('description', 'Description')}
          </label>
          <textarea
            id="admin-invite-description"
            className="db-input"
            style={{ width: '100%', maxWidth: 560, minHeight: 90, resize: 'vertical' }}
            value={description}
            maxLength={280}
            disabled={creating}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', maxWidth: 560 }}>
          <div>
            <label className="db-label" htmlFor="admin-invite-date">
              {t('admin_invitations_date', 'Date')} *
            </label>
            <AppTextInput
              id="admin-invite-date"
              type="date"
              className="db-input"
              style={{ width: '100%' }}
              value={date}
              disabled={creating}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <label className="db-label" htmlFor="admin-invite-time">
              {t('time', 'Time')} *
            </label>
            <AppTextInput
              id="admin-invite-time"
              type="time"
              className="db-input"
              style={{ width: '100%' }}
              value={time}
              disabled={creating}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="db-label" htmlFor="admin-invite-location">
            {t('location', 'Location')} *
          </label>
          <AppTextInput
            id="admin-invite-location"
            className="db-input"
            style={{ width: '100%', maxWidth: 560 }}
            value={location}
            disabled={creating}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>

        <div>
          <label className="db-label" htmlFor="admin-invite-city">
            {t('city', 'City')}
          </label>
          <AppTextInput
            id="admin-invite-city"
            className="db-input"
            style={{ width: '100%', maxWidth: 560 }}
            value={city}
            disabled={creating}
            onChange={(e) => setCity(e.target.value)}
          />
        </div>

        {!restaurantId ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', maxWidth: 560 }}>
            <div>
              <label className="db-label" htmlFor="admin-invite-lat">
                {t('admin_invitations_create_lat', 'Latitude')}
              </label>
              <AppTextInput
                id="admin-invite-lat"
                type="number"
                step="any"
                className="db-input"
                style={{ width: '100%' }}
                value={lat}
                disabled={creating}
                onChange={(e) => setLat(e.target.value)}
              />
            </div>
            <div>
              <label className="db-label" htmlFor="admin-invite-lng">
                {t('admin_invitations_create_lng', 'Longitude')}
              </label>
              <AppTextInput
                id="admin-invite-lng"
                type="number"
                step="any"
                className="db-input"
                style={{ width: '100%' }}
                value={lng}
                disabled={creating}
                onChange={(e) => setLng(e.target.value)}
              />
            </div>
          </div>
        ) : null}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', maxWidth: 560 }}>
          <div>
            <label className="db-label" htmlFor="admin-invite-guests">
              {t('guests_needed', 'Guests needed')}
            </label>
            <AppTextInput
              id="admin-invite-guests"
              type="number"
              min={1}
              max={10}
              className="db-input"
              style={{ width: '100%' }}
              value={guestsNeeded}
              disabled={creating}
              onChange={(e) => setGuestsNeeded(Number(e.target.value) || 3)}
            />
          </div>
          <div>
            <label className="db-label" htmlFor="admin-invite-payment">
              {t('payment', 'Payment')}
            </label>
            <select
              id="admin-invite-payment"
              className="db-select"
              style={{ width: '100%' }}
              value={paymentType}
              disabled={creating}
              onChange={(e) => setPaymentType(e.target.value)}
            >
              {PAYMENT_TYPES.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <div className="db-field-label">{t('gender_groups', 'Gender groups')} *</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {GENDER_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`db-btn${genderGroups.includes(opt.id) ? ' db-btn--lime' : ''}`}
                disabled={creating}
                onClick={() => setGenderGroups((prev) => toggleInList(prev, opt.id))}
              >
                {t(opt.labelKey, opt.id)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="db-field-label">{t('age_groups', 'Age groups')} *</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {AGE_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                className={`db-btn${ageGroups.includes(opt) ? ' db-btn--lime' : ''}`}
                disabled={creating}
                onClick={() => setAgeGroups((prev) => toggleInList(prev, opt))}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', maxWidth: 560 }}>
          <div>
            <label className="db-label" htmlFor="admin-invite-venue-type">
              {t('venue_type', 'Venue type')}
            </label>
            <select
              id="admin-invite-venue-type"
              className="db-select"
              style={{ width: '100%' }}
              value={type}
              disabled={creating}
              onChange={(e) => setType(e.target.value)}
            >
              {VENUE_TYPES.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="db-label" htmlFor="admin-invite-mood">
              {t('invite_mood', 'Invite mood')}
            </label>
            <select
              id="admin-invite-mood"
              className="db-select"
              style={{ width: '100%' }}
              value={inviteMood}
              disabled={creating}
              onChange={(e) => setInviteMood(e.target.value)}
            >
              {INVITE_MOODS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ maxWidth: 280 }}>
          <label className="db-label" htmlFor="admin-invite-color">
            {t('color_scheme', 'Color scheme')}
          </label>
          <select
            id="admin-invite-color"
            className="db-select"
            style={{ width: '100%' }}
            value={colorScheme}
            disabled={creating}
            onChange={(e) => setColorScheme(e.target.value)}
          >
            {COLOR_SCHEMES.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <div className="db-toolbar" style={{ margin: 0 }}>
          <button type="submit" className="db-btn db-btn--lime" disabled={!canSubmit || creating}>
            {creating
              ? t('admin_invitations_create_publishing', 'Publishing…')
              : t('admin_invitations_create_submit', 'Publish invitation')}
          </button>
        </div>

        {msg ? (
          <AppText as="p" className="db-ok-text" style={{ margin: 0 }}>
            {msg}
          </AppText>
        ) : null}
        {error ? (
          <AppText as="p" className="db-error" style={{ margin: 0 }}>
            {error}
          </AppText>
        ) : null}
      </div>
    </form>
  );
}
