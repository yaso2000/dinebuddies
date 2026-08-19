import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { FaCalendarAlt, FaUsers } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import BusinessDashboardShell from '../components/BusinessDashboardShell';
import { isCompletedHostedInvitation } from '../services/businessRankingStats';
import './MyCommunity.css';
import { AppText } from "../components/base";

function isPastOrCompleted(inv) {
  if (isCompletedHostedInvitation(inv)) return true;
  if (!inv.date) return false;
  const eventDate = new Date(inv.date);
  if (inv.time) {
    const [hours, mins] = String(inv.time).split(':').map(Number);
    eventDate.setHours(hours || 0, mins || 0, 0, 0);
  }
  return eventDate.getTime() < Date.now();
}

export default function BusinessHostedArchive() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentUser, userProfile } = useAuth();
  const [liveItems, setLiveItems] = useState([]);
  const [archivedItems, setArchivedItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const isBusinessAccount = userProfile?.isBusiness;

  useEffect(() => {
    if (!isBusinessAccount || !currentUser?.uid) {
      if (!isBusinessAccount) navigate('/');
      return;
    }

    const liveQ = query(
      collection(db, 'invitations'),
      where('restaurantId', '==', currentUser.uid)
    );
    const archiveQ = query(
      collection(db, 'invitation_archives'),
      where('restaurantId', '==', currentUser.uid)
    );

    let liveLoaded = false;
    let archiveLoaded = false;
    const markLoaded = () => {
      if (liveLoaded && archiveLoaded) setLoading(false);
    };

    const unsubLive = onSnapshot(liveQ, (snapshot) => {
      setLiveItems(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })).filter(isPastOrCompleted));
      liveLoaded = true;
      markLoaded();
    }, () => {
      liveLoaded = true;
      markLoaded();
    });

    const unsubArchive = onSnapshot(archiveQ, (snapshot) => {
      setArchivedItems(
        snapshot.docs.map((d) => ({ id: d.id, ...d.data(), _archived: true }))
      );
      archiveLoaded = true;
      markLoaded();
    }, () => {
      archiveLoaded = true;
      markLoaded();
    });

    return () => {
      unsubLive();
      unsubArchive();
    };
  }, [currentUser?.uid, isBusinessAccount, navigate]);

  const items = [...liveItems, ...archivedItems].sort((a, b) => {
    const aTime =
      a.completedAt?.toMillis?.() ||
      a.archivedAt?.toMillis?.() ||
      new Date(a.date || a.startDate || 0).getTime();
    const bTime =
      b.completedAt?.toMillis?.() ||
      b.archivedAt?.toMillis?.() ||
      new Date(b.date || b.startDate || 0).getTime();
    return bTime - aTime;
  });

  if (!isBusinessAccount) return null;

  return (
    <BusinessDashboardShell title={t('biz_dashboard_archive', 'Hosted Invitations')}>
            {loading ?
      <AppText as="p" className="my-community-empty ui-prompt__desc">{t('loading', 'Loading…')}</AppText> :
      items.length === 0 ?
      <div className="my-community-card my-community-empty ui-prompt__desc">
                    {t('biz_dashboard_archive_empty', 'No hosted invitations in the archive yet.')}
                </div> :

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {items.map((inv) =>
        <li key={inv.id}>
                            <button
            type="button"
            className="my-community-card"
            style={{ width: '100%', textAlign: 'start', cursor: 'pointer', border: 'none' }}
            onClick={() => navigate(inv._archived ? `/invitation/archived/${inv.id}` : `/invitation/${inv.id}`)}>

                                <div style={{ fontWeight: 800, fontSize: '0.95rem', marginBottom: '6px', color: 'var(--text-main)' }}>
                                    {inv.title || t('invitation', 'Invitation')}
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    {(inv.date || inv.startDate) &&
              <AppText as="span"><FaCalendarAlt style={{ marginInlineEnd: 4 }} />{inv.date || inv.startDate}{(inv.time || inv.startTime) ? ` · ${inv.time || inv.startTime}` : ''}</AppText>
              }
                                    {!inv._archived &&
              <AppText as="span"><FaUsers style={{ marginInlineEnd: 4 }} />{(inv.participants?.length || 0) + 1}</AppText>
              }
                                    {inv._archived ?
              <AppText as="span" style={{ color: 'var(--text-muted)', fontWeight: 700 }}>{t('invitation_archived_badge', 'Archived')}</AppText> :
              inv.status === 'completed' &&
              <AppText as="span" style={{ color: 'var(--primary)', fontWeight: 700 }}>{t('completed', 'Completed')}</AppText>
              }
                                </div>
                            </button>
                        </li>
        )}
                </ul>
      }
        </BusinessDashboardShell>);

}