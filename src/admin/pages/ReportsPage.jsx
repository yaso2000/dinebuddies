import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../api';
import { AppText } from "../../components/base";

const SECTIONS = [
{ id: 'accounts', types: new Set(['user', 'partner']), labelKey: 'admin_reports_accounts' },
{ id: 'invitations', types: new Set(['invitation', 'message']), labelKey: 'admin_reports_invitations' },
{ id: 'posts', types: new Set(['post']), labelKey: 'admin_reports_posts' }];


export default function ReportsPage() {
  const { t } = useTranslation();
  const [section, setSection] = useState('accounts');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.listReports({ status: 'pending', pageSize: 50 });
      setItems(res.items || []);
    } catch (e) {
      alert(e.message || t('admin_failed'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const cfg = SECTIONS.find((s) => s.id === section) || SECTIONS[0];
  const filtered = items.filter((r) => cfg.types.has(r.type));

  const resolve = async (id, status) => {
    if (
    !window.confirm(
      status === 'resolved' ?
      t('admin_report_accept_confirm') :
      t('admin_report_dismiss_confirm')
    ))
    {
      return;
    }
    setActing(id);
    try {
      await adminApi.setReportStatus(id, status);
      setItems((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      alert(e.message || t('admin_failed'));
    } finally {
      setActing(null);
    }
  };

  return (
    <>
            <AppText as="h1" className="db-h1">{t('admin_reports_title')}</AppText>
            <AppText as="p" className="db-lead">{t('admin_reports_lead')}</AppText>

            <div className="db-tabs">
                {SECTIONS.map((s) =>
        <button
          key={s.id}
          type="button"
          className={`db-tab${section === s.id ? ' active' : ''}`}
          onClick={() => setSection(s.id)}>

                        {t(s.labelKey)}
                    </button>
        )}
            </div>

            <div className="db-panel">
                {loading ?
        <div className="db-spin" /> :
        filtered.length === 0 ?
        <div className="db-empty">{t('admin_empty_pending_reports')}</div> :

        <table className="db-table">
                        <thead>
                            <tr>
                                <th>{t('admin_reports_target')}</th>
                                <th>{t('admin_reports_reason')}</th>
                                <th>{t('admin_reports_reporter')}</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((r) =>
            <tr key={r.id}>
                                    <td>
                                        <div>{r.targetName || r.targetId}</div>
                                        <div className="db-id">{r.type}</div>
                                    </td>
                                    <td>{r.reason}</td>
                                    <td>{r.reporterName || r.reporterId}</td>
                                    <td>
                                        <div className="db-actions">
                                            <button
                    type="button"
                    className="db-btn db-btn--lime"
                    disabled={acting === r.id}
                    onClick={() => resolve(r.id, 'resolved')}>

                                                {t('admin_report_accept')}
                                            </button>
                                            <button
                    type="button"
                    className="db-btn db-btn--ghost"
                    disabled={acting === r.id}
                    onClick={() => resolve(r.id, 'dismissed')}>

                                                {t('admin_report_dismiss')}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
            )}
                        </tbody>
                    </table>
        }
            </div>
        </>);

}