import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { FaCrown } from 'react-icons/fa';
import { useTopRankedPaid } from '../hooks/useTopRankedPaid';
import { AppText } from "./base";

const TOP_N = 3;

export default function RankingSidebarWidget() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { loading, top } = useTopRankedPaid(TOP_N);

  if (loading && !top.length) {
    return (
      <div className="ds-widget-card" aria-busy="true">
        <div className="ds-widget-header">
          <FaCrown size={14} style={{ color: 'var(--luxury-gold)' }} />
          <AppText as="span">{t('rankings_title', 'Business Rankings')}</AppText>
        </div>
        <div className="ds-widget-skeleton-row" />
        <div className="ds-widget-skeleton-row" />
        <div className="ds-widget-skeleton-row" />
      </div>
    );
  }

  if (!top.length) return null;

  return (
    <div className="ds-widget-card">
            <div className="ds-widget-header">
                <FaCrown size={14} style={{ color: 'var(--luxury-gold)' }} />
                <AppText as="span">{t('rankings_title', 'Business Rankings')}</AppText>
                <Link to="/rankings" className="ds-widget-see-all">{t('see_all', 'See all')}</Link>
            </div>
            {top.map((b, i) =>
      <div
        key={b.id}
        className="ds-widget-row"
        onClick={() => navigate(`/business/${b.id}`)}
        style={{ cursor: 'pointer' }}>

                    <AppText as="span" style={{ fontWeight: 800, color: 'var(--luxury-gold)', minWidth: 20 }}>#{i + 1}</AppText>
                    <img
          src={b.businessPublic?.coverImage || b.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(b.name)}`}
          alt={b.name}
          className="ds-widget-img-sq"
          style={{ borderRadius: '10px' }}
          onError={(e) => {e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(b.name)}`;}} />

                    <div className="ds-widget-info">
                        <div className="ds-widget-title">{b.name}</div>
                        <div className="ds-widget-sub">{Math.round(b.rankingScore ?? 0)} {t('rankings_points', 'pts')}</div>
                    </div>
                </div>
      )}
        </div>);

}