import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaStore } from 'react-icons/fa';
import { loadFeaturedDirectoryBusinesses } from '../services/featuredBusinessesLoader';
import { AppText } from './base';

const PICK_COUNT = 4;

export default function FeaturedBusinessesSidebarWidget() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadFeaturedDirectoryBusinesses({ count: PICK_COUNT })
      .then((list) => {
        if (!cancelled) setItems(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading && !items.length) {
    return (
      <div className="ds-widget-card" aria-busy="true">
        <div className="ds-widget-header">
          <FaStore size={14} />
          <AppText as="span">{t('featured_businesses', 'Featured Businesses')}</AppText>
        </div>
        <div className="ds-featured-biz-grid">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="ds-featured-biz-thumb ds-featured-biz-thumb--skeleton" />
          ))}
        </div>
      </div>
    );
  }

  if (!items.length) return null;

  return (
    <div className="ds-widget-card">
      <div className="ds-widget-header">
        <FaStore size={14} />
        <AppText as="span">{t('featured_businesses', 'Featured Businesses')}</AppText>
        <Link to="/restaurants" className="ds-widget-see-all">
          {t('see_all', 'See all')}
        </Link>
      </div>
      <div className="ds-featured-biz-grid">
        {items.map((biz) => {
          const label = biz.name || t('business', 'Business');
          const src =
            biz.businessPublic?.coverImage ||
            biz.image ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(label)}`;
          return (
            <button
              key={biz.id}
              type="button"
              className={`ds-featured-biz-thumb${biz.isPaid ? ' ds-featured-biz-thumb--paid' : ''}`}
              title={label}
              onClick={() => navigate(`/business/${biz.id}`)}
            >
              <img
                src={src}
                alt={label}
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(label)}`;
                }}
              />
              {biz.isPaid ? (
                <AppText as="span" className="ds-featured-biz-thumb__badge">
                  {t('paid_plan', 'Paid')}
                </AppText>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
