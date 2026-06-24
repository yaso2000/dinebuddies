import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { FaArrowLeft, FaBan } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { asUidArray, toggleUserBlock } from '../utils/userSocialLists';
import { getSafeAvatar } from '../utils/avatarUtils';
import UserAvatar from '../components/UserAvatar';
import './SettingsPages.css';
import { AppText } from "../components/base";

const BlockedUsersSettings = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();
  const { showToast } = useToast();
  const [rows, setRows] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const blockedIdsKey = useMemo(
    () => JSON.stringify(asUidArray(userProfile?.blockedUserIds)),
    [userProfile?.blockedUserIds]
  );

  useEffect(() => {
    let cancelled = false;
    const ids = asUidArray(userProfile?.blockedUserIds);

    if (!currentUser?.uid || ids.length === 0) {
      setRows([]);
      setLoadingList(false);
      return () => {cancelled = true;};
    }

    setLoadingList(true);
    (async () => {
      const out = [];
      for (const id of ids) {
        try {
          const snap = await getDoc(doc(db, 'users', id));
          const d = snap.exists() ? snap.data() : {};
          out.push({
            id,
            name: d.display_name || d.displayName || d.name || d.nickname || id.slice(0, 8) + '…',
            avatar: getSafeAvatar({ ...d, id }),
            gender: d.gender
          });
        } catch {
          out.push({
            id,
            name: id.slice(0, 8) + '…',
            avatar: getSafeAvatar(null)
          });
        }
      }
      if (!cancelled) {
        setRows(out);
        setLoadingList(false);
      }
    })();

    return () => {cancelled = true;};
  }, [currentUser?.uid, blockedIdsKey]);

  const handleUnblock = async (targetId) => {
    if (!currentUser?.uid || busyId) return;
    setBusyId(targetId);
    try {
      await toggleUserBlock(currentUser.uid, targetId, false);
      showToast(t('user_unblocked_toast', 'User unblocked.'), 'success');
      setRows((prev) => prev.filter((r) => r.id !== targetId));
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
                <button type="button" onClick={() => navigate('/settings')} className="back-btn" aria-label={t('back', 'Back')}>
                    <FaArrowLeft style={i18n.language === 'ar' ? {} : { transform: 'rotate(180deg)' }} />
                </button>
                <AppText as="h1">{t('settings_blocked_users', 'Blocked users')}</AppText>
                <div style={{ width: '40px' }} />
            </div>

            <div className="settings-content">
                <div className="settings-card ui-card">
                    <div className="settings-icon-wrapper" style={{ background: 'rgba(185, 28, 28, 0.1)' }}>
                        <FaBan style={{ color: '#b91c1c', fontSize: '1.5rem' }} />
                    </div>
                    <AppText as="h2">{t('blocked_users_title', 'People you blocked')}</AppText>
                    <AppText as="p" className="settings-description" style={{ marginBottom: '1.25rem' }}>
                        {t(
              'blocked_users_desc',
              'Blocked users cannot see your activity in the same way, and you will not see their profile, posts, or invitations. You can unblock someone anytime.'
            )}
                    </AppText>

                    {loadingList ?
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                            {t('loading', 'Loading...')}
                        </div> :
          rows.length === 0 ?
          <div
            style={{
              textAlign: 'center',
              padding: '2rem 1rem',
              color: 'var(--text-muted)',
              border: '1px dashed var(--border-color)',
              borderRadius: '16px',
              background: 'var(--bg-input)'
            }}>
            
                            {t('blocked_users_empty', 'No blocked users.')}
                        </div> :

          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {rows.map((row) =>
            <li
              key={row.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 14px',
                borderRadius: '14px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-card)'
              }}>
              
                                    <UserAvatar
                user={{ photo_url: row.avatar, display_name: row.name, gender: row.gender }}
                src={row.avatar}
                alt=""
                style={{ width: 44, height: 44, flexShrink: 0 }} />
              
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {row.name}
                                        </div>
                                    </div>
                                    <button
                type="button"
                className="ui-btn ui-btn--secondary"
                disabled={busyId === row.id}
                onClick={() => handleUnblock(row.id)}
                style={{
                  flexShrink: 0,
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  padding: '8px 14px',
                  borderRadius: '10px'
                }}>
                
                                        {busyId === row.id ? '…' : t('unblock_user', 'Unblock')}
                                    </button>
                                </li>
            )}
                        </ul>
          }
                </div>
            </div>
        </div>);

};

export default BlockedUsersSettings;