import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaArrowLeft, FaArrowRight, FaBullhorn } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import BusinessFeedbackInbox from '../components/BusinessFeedbackInbox';
import BusinessBroadcastComposer from '../components/business/BusinessBroadcastComposer';
import CommunityManagement from '../components/CommunityManagement';
import { AppText } from '../components/base';

/**
 * Standalone Business inbox + member management page, split out of the dashboard
 * so the dashboard stays light (fewer live listeners) and this is its own screen.
 */
export default function BusinessInboxManage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { currentUser, userProfile } = useAuth();
  const [showBroadcast, setShowBroadcast] = useState(false);
  const BackIcon = i18n.dir() === 'rtl' ? FaArrowRight : FaArrowLeft;

  if (!currentUser?.uid) return null;

  return (
    <div className="page-container" style={{ padding: '1rem', maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1rem' }}>
        <button
          type="button"
          onClick={() => navigate('/business-dashboard')}
          aria-label={t('back', 'Back')}
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-main)', cursor: 'pointer', flexShrink: 0 }}>
          <BackIcon />
        </button>
        <AppText as="h2" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
          {t('feedback_box_title', 'Feedback & Complaints Inbox')}
        </AppText>
      </div>

      {/* Feedback inbox + broadcast */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 16, padding: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
          <button
            type="button"
            onClick={() => setShowBroadcast(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 12, background: 'var(--brand-primary)', color: '#fff', fontWeight: 700, fontSize: '0.85rem', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <FaBullhorn /> {t('broadcast_cta', 'Send offer')}
          </button>
        </div>
        <BusinessFeedbackInbox />
        <BusinessBroadcastComposer isOpen={showBroadcast} onClose={() => setShowBroadcast(false)} />
      </div>

      {/* Member management */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 16, padding: '1.5rem' }}>
        <CommunityManagement
          businessId={currentUser.uid}
          businessName={userProfile?.display_name || userProfile?.businessInfo?.name} />
      </div>
    </div>
  );
}
