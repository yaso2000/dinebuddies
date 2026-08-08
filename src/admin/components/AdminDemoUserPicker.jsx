import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../api';
import { AppText } from '../../components/base';

export default function AdminDemoUserPicker({ value, onChange, disabled = false }) {
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminApi.listDemoUserProfiles({ limit: 500 });
      setUsers(Array.isArray(res.users) ? res.users : []);
    } catch (e) {
      setError(e.message || t('admin_demo_users_load_failed', 'Could not load demo users.'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const grouped = useMemo(() => {
    /** @type {Map<string, typeof users>} */
    const map = new Map();
    users.forEach((user) => {
      const key = user.city ? `${user.city}${user.countryCode ? ` (${user.countryCode})` : ''}` : t('admin_demo_picker_unknown_city', 'Unknown city');
      const list = map.get(key) || [];
      list.push(user);
      map.set(key, list);
    });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [users, t]);

  const selected = users.find((user) => user.uid === value) || null;

  return (
    <div style={{ display: 'grid', gap: '0.5rem', maxWidth: 520 }}>
      <label className="db-label" htmlFor="admin-demo-user-picker">
        {t('admin_demo_picker_label', 'Demo user (publisher)')}
      </label>
      {loading ? (
        <div className="db-spin" style={{ width: 24, height: 24 }} />
      ) : (
        <select
          id="admin-demo-user-picker"
          className="db-select"
          style={{ width: '100%', maxWidth: 520 }}
          value={value || ''}
          disabled={disabled || users.length === 0}
          onChange={(e) => onChange?.(e.target.value || '')}
        >
          <option value="">
            {users.length === 0
              ? t('admin_demo_picker_empty', 'No demo users — create some first')
              : t('admin_demo_picker_placeholder', 'Select a demo user…')}
          </option>
          {grouped.map(([cityLabel, cityUsers]) => (
            <optgroup key={cityLabel} label={cityLabel}>
              {cityUsers.map((user) => (
                <option key={user.uid} value={user.uid}>
                  {user.displayName || user.uid}
                  {user.gender ? ` · ${user.gender}` : ''}
                  {user.ageCategory ? ` · ${user.ageCategory}` : ''}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      )}
      {error ? (
        <AppText as="p" className="db-error" style={{ margin: 0 }}>
          {error}
        </AppText>
      ) : null}
      {selected ? (
        <AppText as="p" className="db-muted" style={{ margin: 0, fontSize: '0.82rem' }}>
          {selected.city || '—'}
          {selected.countryCode ? ` · ${selected.countryCode}` : ''}
          {' · '}
          <span className="db-id">{selected.uid}</span>
        </AppText>
      ) : null}
    </div>
  );
}
