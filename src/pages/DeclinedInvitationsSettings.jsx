import React, { useState, useEffect } from 'react';
import AppBackButton from '../components/AppBackButton';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { FaUserClock } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import {
  listDeclinedSendersForRecipient,
  clearPrivateInviteDeclineCooldown,
} from '../utils/privateInviteDeclineCooldown';
import { getSafeAvatar } from '../utils/avatarUtils';
import UserAvatar from '../components/UserAvatar';
import './SettingsPages.css';
import { AppText } from '../components/base';

const DeclinedInvitationsSettings = () => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const [rows, setRows] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const uid = currentUser?.uid || currentUser?.id;

    if (!uid) {
      setRows([]);
      setLoadingList(false);
      return () => {
        cancelled = true;
      };
    }

    setLoadingList(true);
    (async () => {
      const declines = await listDeclinedSendersForRecipient(uid);
      const out = [];
      for (const decline of declines) {
        try {
          const snap = await getDoc(doc(db, 'users', decline.senderId));
          const d = snap.exists() ? snap.data() : {};
          out.push({
            id: decline.senderId,
            name: d.display_name || d.displayName || d.name || d.nickname || decline.senderId.slice(0, 8) + '…',
            avatar: getSafeAvatar({ ...d, id: decline.senderId }),
            gender: d.gender,
          });
        } catch {
          out.push({
            id: decline.senderId,
            name: decline.senderId.slice(0, 8) + '…',
            avatar: getSafeAvatar(null),
          });
        }
      }
      if (!cancelled) {
        setRows(out);
        setLoadingList(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUser?.uid, currentUser?.id]);

  const handleAllowAgain = async (senderId) => {
    const uid = currentUser?.uid || currentUser?.id;
    if (!uid || busyId) return;
    setBusyId(senderId);
    try {
      await clearPrivateInviteDeclineCooldown(senderId, uid);
      showToast(t('declined_invitations_unlocked_toast', 'They can invite you again.'), 'success');
      setRows((prev) => prev.filter((r) => r.id !== senderId));
    } catch (e) {
      console.error(e);
      showToast(t('error_update_settings', 'Failed to update settings. Please try again.'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <AppBackButton fallback="/settings" />
        <AppText as="h1">{t('settings_declined_invitations', 'Declined invitations')}</AppText>
        <div style={{ width: '40px' }} />
      </div>

      <div className="settings-content">
        <div className="settings-card ui-card">
          <div className="settings-icon-wrapper" style={{ background: 'rgba(139, 92, 246, 0.1)' }}>
            <FaUserClock style={{ color: '#8b5cf6', fontSize: '1.5rem' }} />
          </div>
          <AppText as="h2">{t('declined_invitations_title', 'People you declined')}</AppText>
          <AppText as="p" className="settings-description" style={{ marginBottom: '1.25rem' }}>
            {t(
              'declined_invitations_desc',
              "When you decline a personal invitation, that person can't send you another one for 7 days. You can allow them again anytime here."
            )}
          </AppText>

          {loadingList ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              {t('loading', 'Loading...')}
            </div>
          ) : rows.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '2rem 1rem',
                color: 'var(--text-muted)',
                border: '1px dashed var(--border-color)',
                borderRadius: '16px',
                background: 'var(--bg-input)',
              }}
            >
              {t('declined_invitations_empty', "You haven't declined any personal invitations recently.")}
            </div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {rows.map((row) => (
                <li
                  key={row.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 14px',
                    borderRadius: '14px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-card)',
                  }}
                >
                  <UserAvatar
                    user={{ photo_url: row.avatar, display_name: row.name, gender: row.gender }}
                    src={row.avatar}
                    alt=""
                    style={{ width: 44, height: 44, flexShrink: 0 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.name}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="ui-btn ui-btn--secondary"
                    disabled={busyId === row.id}
                    onClick={() => handleAllowAgain(row.id)}
                    style={{
                      flexShrink: 0,
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      padding: '8px 14px',
                      borderRadius: '10px',
                    }}
                  >
                    {busyId === row.id ? '…' : t('allow_invitations_again', 'Allow again')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeclinedInvitationsSettings;
