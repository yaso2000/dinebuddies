import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { adminApi } from '../api';
import { AppText } from '../../components/base';

export default function BusinessesPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState(null);
  const [hasNext, setHasNext] = useState(false);
  const [acting, setActing] = useState(null);

  const load = useCallback(
    async (startAfterId = null) => {
      setLoading(true);
      try {
        const res = await adminApi.listBusinesses({ startAfterId, pageSize: 25 });
        setItems(res.items || []);
        setHasNext(!!res.hasNext);
        setCursor(res.lastId);
      } catch (e) {
        alert(e.message || t('admin_load_failed'));
      } finally {
        setLoading(false);
      }
    },
    [t]
  );

  useEffect(() => {
    load(null);
  }, [load]);

  const remove = async (biz) => {
    if (!window.confirm(t('admin_businesses_confirm_delete', { name: biz.name }))) return;
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

  return (
    <>
      <AppText as="h1" className="db-h1">{t('admin_businesses_title')}</AppText>
      <AppText as="p" className="db-lead">{t('admin_businesses_lead')}</AppText>

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
