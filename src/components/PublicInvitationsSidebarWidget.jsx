import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaClock } from 'react-icons/fa';
import { useInvitations } from '../context/InvitationContext';
import { AppText } from './base';

const THUMB_LIMIT = 6;
const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=160&h=160&fit=crop';

function invitationImage(inv) {
  return inv.restaurantImage || inv.customImage || inv.image || inv.coverImage || FALLBACK_IMAGE;
}

function invitationTimestamp(inv) {
  const sec = inv.createdAt?.seconds ?? inv.createdAt?._seconds;
  if (typeof sec === 'number') return sec;
  const ms = Date.parse(inv.createdAt);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : 0;
}

function pickLatestPublic(invitations) {
  return (invitations || [])
    .filter((inv) => inv.adminBlocked !== true && (inv.privacy === 'public' || !inv.privacy))
    .sort((a, b) => invitationTimestamp(b) - invitationTimestamp(a))
    .slice(0, THUMB_LIMIT);
}

export default function PublicInvitationsSidebarWidget() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { invitations, loadingInvitations } = useInvitations();
  const latestPublic = pickLatestPublic(invitations);

  if (loadingInvitations && !latestPublic.length) {
    return (
      <div className="ds-widget-card" aria-busy="true">
        <div className="ds-widget-header">
          <FaClock size={14} />
          <AppText as="span">{t('latest_public_invitations', 'Latest Public Invitations')}</AppText>
        </div>
        <div className="ds-invitation-thumb-grid">
          {[0, 1, 2].map((i) => (
            <div key={i} className="ds-invitation-thumb ds-invitation-thumb--skeleton" />
          ))}
        </div>
      </div>
    );
  }

  if (!latestPublic.length) return null;

  return (
    <div className="ds-widget-card">
      <div className="ds-widget-header">
        <FaClock size={14} />
        <AppText as="span">{t('latest_public_invitations', 'Latest Public Invitations')}</AppText>
        <Link to="/invitations" className="ds-widget-see-all">{t('see_all', 'See all')}</Link>
      </div>
      <div className="ds-invitation-thumb-grid">
        {latestPublic.map((inv) => (
          <button
            key={inv.id}
            type="button"
            className="ds-invitation-thumb"
            title={inv.title || inv.restaurantName || ''}
            onClick={() => navigate(`/invitation/${inv.id}`)}
          >
            <img
              src={invitationImage(inv)}
              alt={inv.title || inv.restaurantName || t('invitation', 'Invitation')}
              loading="lazy"
              onError={(e) => {
                e.currentTarget.src = FALLBACK_IMAGE;
              }}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
