import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { adminApi } from '../api';
import { AppText } from '../../components/base';
import { useConfirm } from '../../context/ConfirmContext';

export default function BusinessesPage() {
  const { t, i18n } = useTranslation();
  const confirm = useConfirm();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState(null);
  const [hasNext, setHasNext] = useState(false);
  const [acting, setActing] = useState(null);

  // Location filter bar (server-side, exact match on stored country code / city).
  const [filterCountry, setFilterCountry] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [locations, setLocations] = useState({ countries: [], citiesByCountry: {} });

  useEffect(() => {
    let cancelled = false;
    adminApi
      .listBusinessLocations()
      .then((res) => {
        if (!cancelled && res) setLocations({ countries: res.countries || [], citiesByCountry: res.citiesByCountry || {} });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const cityChoices = filterCountry
    ? locations.citiesByCountry[filterCountry] || []
    : [...new Set(Object.values(locations.citiesByCountry).flat())].sort((a, b) => a.localeCompare(b));

  const load = useCallback(
    async (startAfterId = null) => {
      setLoading(true);
      try {
        const res = await adminApi.listBusinesses({
          startAfterId,
          pageSize: 25,
          ...(filterCountry ? { countryCode: filterCountry } : {}),
          ...(filterCity ? { city: filterCity } : {}),
        });
        setItems(res.items || []);
        setHasNext(!!res.hasNext);
        setCursor(res.lastId);
      } catch (e) {
        alert(e.message || t('admin_load_failed'));
      } finally {
        setLoading(false);
      }
    },
    [t, filterCountry, filterCity]
  );

  useEffect(() => {
    load(null);
  }, [load]);

  const countryLabel = (code) => {
    if (!/^[A-Z]{2}$/.test(code)) return code;
    try {
      const name = new Intl.DisplayNames([i18n.language || 'en'], { type: 'region' }).of(code);
      return name ? `${name} (${code})` : code;
    } catch {
      return code;
    }
  };

  const remove = async (biz) => {
    if (!(await confirm({ message: t('admin_businesses_confirm_delete', { name: biz.name }), tone: 'danger' }))) return;
    setActing(biz.id);
    try {
      await adminApi.deleteBusiness(biz.id);
      await load(null);
    } catch (e) {
      alert(e.message || t('admin_failed'));
    } finally {
      setActing(null);
    }
  };

  // Grant / ban act on the business ACCOUNT, so they only apply to a claimed
  // business (its id is the owner uid). Virtual / directory-only entries have no
  // account — only delete applies there.
  const grantPlan = async (biz) => {
    const input = window.prompt(
      t('admin_business_grant_months_prompt', 'Grant Paid plan for how many months? Enter 0 for permanent.'),
      '0'
    );
    if (input === null) return;
    const months = Math.max(0, Math.min(60, Math.floor(Number(input) || 0)));
    setActing(biz.id);
    try {
      await adminApi.setUserSubscriptionTier(biz.id, 'paid', true, months);
      alert(t('admin_business_plan_granted', 'Paid plan granted.'));
    } catch (e) {
      alert(e.message || t('admin_failed'));
    } finally {
      setActing(null);
    }
  };

  const ban = async (biz) => {
    if (!(await confirm({ message: t('admin_businesses_confirm_ban', { name: biz.name }), tone: 'danger' }))) return;
    setActing(biz.id);
    try {
      await adminApi.setUserBanStatus(biz.id, true);
      alert(t('admin_business_banned', 'Business account banned.'));
    } catch (e) {
      alert(e.message || t('admin_failed'));
    } finally {
      setActing(null);
    }
  };

  return (
    <>
      <AppText as="h1" className="db-h1">{t('admin_businesses_title')}</AppText>
      <AppText as="p" className="db-lead">{t('admin_businesses_lead')}</AppText>

      {/* Location filter bar */}
      <div className="db-toolbar" role="search" aria-label={t('admin_businesses_filter_aria', 'Filter businesses by location')}>
        <select
          className="db-select"
          value={filterCountry}
          onChange={(e) => {
            setFilterCountry(e.target.value);
            setFilterCity('');
          }}
          aria-label={t('admin_businesses_filter_country', 'Country')}
        >
          <option value="">{t('admin_businesses_filter_all_countries', 'All countries')}</option>
          {locations.countries.map((c) => (
            <option key={c} value={c}>{countryLabel(c)}</option>
          ))}
        </select>
        <select
          className="db-select"
          value={filterCity}
          onChange={(e) => setFilterCity(e.target.value)}
          disabled={cityChoices.length === 0}
          aria-label={t('admin_businesses_filter_city', 'City')}
        >
          <option value="">{t('admin_businesses_filter_all_cities', 'All cities')}</option>
          {cityChoices.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        {(filterCountry || filterCity) && (
          <button
            type="button"
            className="db-btn"
            onClick={() => {
              setFilterCountry('');
              setFilterCity('');
            }}
          >
            {t('admin_businesses_filter_clear', 'Clear filter')}
          </button>
        )}
      </div>

      <div className="db-panel">
        {loading ? (
          <div className="db-spin" />
        ) : items.length === 0 ? (
          <div className="db-empty">{t('admin_empty_businesses')}</div>
        ) : (
          <table className="db-table">
            <thead>
              <tr>
                <th>{t('admin_businesses_name')}</th>
                <th>{t('admin_businesses_location')}</th>
                <th>{t('admin_businesses_status')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((biz) => (
                <tr key={biz.id}>
                  <td>
                    <div>{biz.name}</div>
                    <div className="db-id">{biz.id}</div>
                  </td>
                  <td>
                    <div>{biz.city || '—'}</div>
                    {biz.address ? (
                      <div className="db-id" style={{ maxWidth: 280 }}>{biz.address}</div>
                    ) : null}
                  </td>
                  <td>
                    {biz.isOrphan ? (
                      <AppText as="span" className="db-badge db-badge--warn">
                        {t('admin_businesses_orphan', 'Directory only')}
                      </AppText>
                    ) : null}
                    {biz.isClaimed ? (
                      <AppText as="span" className="db-badge db-badge--ok">
                        {t('admin_businesses_claimed')}
                      </AppText>
                    ) : biz.isVirtual ? (
                      <AppText as="span" className="db-badge">
                        {t('admin_businesses_google_import')}
                      </AppText>
                    ) : (
                      <AppText as="span" className="db-badge db-badge--warn">
                        {t('admin_businesses_unclaimed')}
                      </AppText>
                    )}
                  </td>
                  <td>
                    <div className="db-actions">
                      <Link to={`/business/${biz.id}`} className="db-btn" target="_blank" rel="noopener noreferrer">
                        {t('admin_businesses_view')}
                      </Link>
                      {biz.isClaimed && (
                        <>
                          <button
                            type="button"
                            className="db-btn"
                            disabled={acting === biz.id}
                            onClick={() => grantPlan(biz)}
                          >
                            {t('admin_business_plan_grant', 'Grant plan')}
                          </button>
                          <button
                            type="button"
                            className="db-btn db-btn--danger"
                            disabled={acting === biz.id}
                            onClick={() => ban(biz)}
                          >
                            {t('admin_businesses_ban', 'Ban')}
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        className="db-btn db-btn--danger"
                        disabled={acting === biz.id}
                        onClick={() => remove(biz)}
                      >
                        {t('admin_businesses_delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {hasNext && !loading && (
          <div className="db-toolbar" style={{ marginTop: '1rem' }}>
            <button type="button" className="db-btn" onClick={() => load(cursor)}>
              {t('admin_more')}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
