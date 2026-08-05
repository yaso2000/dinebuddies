import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../api';
import AdminCreateDemoInvitationForm from '../components/AdminCreateDemoInvitationForm';
import { AppText } from "../../components/base";

const TYPE_TABS = [
{ id: 'all', labelKey: 'admin_invitations_type_all' },
{ id: 'public', labelKey: 'admin_invitations_type_public' },
{ id: 'private', labelKey: 'admin_invitations_type_social' },
{ id: 'dating', labelKey: 'admin_invitations_type_private' }];


const TYPE_LABEL_KEYS = {
  public: 'admin_invitations_type_public',
  private: 'admin_invitations_type_social',
  dating: 'admin_invitations_type_private'
};

export default function InvitationsPage() {
  const { t } = useTranslation();
  const [inviteType, setInviteType] = useState('all');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState(null);
  const [hasNext, setHasNext] = useState(false);
  const [acting, setActing] = useState(null);

  const load = useCallback(
    async (startAfterId = null) => {
      setLoading(true);
      try {
        const res = await adminApi.listInvitations({
          inviteType,
          startAfterId,
          pageSize: 25
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
    [inviteType, t]
  );

  useEffect(() => {
    load(null);
  }, [load]);

  const moderate = async (inv, action) => {
    if (!window.confirm(t('admin_invitations_confirm_action', { action }))) return;
    setActing(inv.id);
    try {
      await adminApi.moderateInvitation(inv.id, action, inv.inviteType);
      await load(null);
    } catch (e) {
      alert(e.message || t('admin_failed'));
    } finally {
      setActing(null);
    }
  };

  const fmt = (iso) => iso ? new Date(iso).toLocaleString() : '—';

  return (
    <>
            <AppText as="h1" className="db-h1">{t('admin_invitations_title')}</AppText>
            <AppText as="p" className="db-lead">{t('admin_invitations_lead')}</AppText>

            <AdminCreateDemoInvitationForm onCreated={() => load(null)} />

            <div className="db-tabs">
                {TYPE_TABS.map((tab) =>
        <button
          key={tab.id}
          type="button"
          className={`db-tab${inviteType === tab.id ? ' active' : ''}`}
          onClick={() => setInviteType(tab.id)}>

                        {t(tab.labelKey)}
                    </button>
        )}
            </div>

            <div className="db-panel">
                {loading ?
        <div className="db-spin" /> :
        items.length === 0 ?
        <div className="db-empty">{t('admin_empty_invitations')}</div> :

        <table className="db-table">
                        <thead>
                            <tr>
                                <th>{t('admin_invitations_type')}</th>
                                <th>{t('admin_invitations_title_col')}</th>
                                <th>{t('admin_invitations_host')}</th>
                                <th>{t('admin_invitations_date')}</th>
                                <th>{t('admin_invitations_status')}</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((inv) =>
            <tr key={inv.id}>
                                    <td>
                                        <AppText as="span" className="db-badge">
                                            {t(TYPE_LABEL_KEYS[inv.inviteType] || inv.inviteType)}
                                        </AppText>
                                    </td>
                                    <td>{inv.title}</td>
                                    <td>{inv.hostName || inv.hostId}</td>
                                    <td>{fmt(inv.createdAt)}</td>
                                    <td>
                                        {inv.adminBlocked &&
                <AppText as="span" className="db-badge db-badge--ban">
                                                {t('admin_status_blocked')}
                                            </AppText>
                }
                                        {!inv.adminBlocked && !inv.expired &&
                <AppText as="span" className="db-badge db-badge--ok">
                                                {t('admin_status_active')}
                                            </AppText>
                }
                                        {inv.expired && !inv.adminBlocked &&
                <AppText as="span" className="db-badge db-badge--warn">
                                                {t('admin_status_expired')}
                                            </AppText>
                }
                                    </td>
                                    <td>
                                        <div className="db-actions">
                                            <button
                    type="button"
                    className="db-btn db-btn--danger"
                    disabled={acting === inv.id}
                    onClick={() => moderate(inv, 'delete')}>

                                                {t('admin_invitations_delete')}
                                            </button>
                                            {!inv.adminBlocked &&
                  <button
                    type="button"
                    className="db-btn db-btn--warn"
                    disabled={acting === inv.id}
                    onClick={() => moderate(inv, 'block')}>

                                                    {t('admin_invitations_block')}
                                                </button>
                  }
                                            {(inv.adminBlocked || inv.expired) &&
                  <button
                    type="button"
                    className="db-btn db-btn--lime"
                    disabled={acting === inv.id}
                    onClick={() => moderate(inv, 'republish')}>

                                                    {t('admin_invitations_republish')}
                                                </button>
                  }
                                        </div>
                                    </td>
                                </tr>
            )}
                        </tbody>
                    </table>
        }
                {hasNext && !loading &&
        <div className="db-toolbar" style={{ marginTop: '1rem' }}>
                        <button type="button" className="db-btn" onClick={() => load(cursor)}>
                            {t('admin_more')}
                        </button>
                    </div>
        }
            </div>
        </>);

}