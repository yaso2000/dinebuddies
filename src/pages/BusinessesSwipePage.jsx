import React, { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import MagneticDeck from '../components/discovery/MagneticDeck';
import BusinessSwipeCard from '../components/discovery/BusinessSwipeCard';
import { useBusinessSwipeDeck } from '../hooks/useBusinessSwipeDeck';
import '../components/discovery/discovery.css';
import { AppText } from '../components/base';

/** Legacy sub-types folded into "Restaurant" (same grouping as the list view). */
const RESTAURANT_LIKE_TYPES = new Set(['Restaurant', 'Fast Food', 'Food Truck']);

/** Partners / restaurants — magnetic swipe deck (default /restaurants). Close → list. */
export default function BusinessesSwipePage() {
  const { t } = useTranslation();
  const { items, loading } = useBusinessSwipeDeck();
  const [activeFilter, setActiveFilter] = useState('All');

  const categories = [
    { id: 'All', label: t('filter_all'), icon: null },
    { id: 'Restaurant', label: t('type_restaurant'), icon: '🍴' },
    { id: 'Cafe', label: t('type_cafe'), icon: '☕' },
    { id: 'Bar', label: t('type_bar', 'Bar'), icon: '🍺' },
    { id: 'Night Club', label: t('type_nightclub', 'Night Club'), icon: '🎵' },
    { id: 'Hotel', label: t('type_hotel', 'Hotel'), icon: '🏨' },
  ];

  const filteredItems = useMemo(() => {
    if (activeFilter === 'All') return items;
    return items.filter((it) => {
      const type = it?.raw?.type;
      return activeFilter === 'Restaurant'
        ? RESTAURANT_LIKE_TYPES.has(type)
        : type === activeFilter;
    });
  }, [items, activeFilter]);

  const renderCard = useCallback(
    ({ item, isTop, onSkip, onBack }) => (
      <BusinessSwipeCard key={item.id} item={item} isTop={isTop} onSkip={onSkip} onBack={onBack} />
    ),
    []
  );

  const showChips = !(loading && items.length === 0) && items.length > 0;

  return (
    <div className="discovery-shell discovery-shell--in-layout discovery-shell--partners">
      {showChips ? (
        <div
          className="category-icons-scroll"
          style={{
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            padding: '8px 12px',
            width: '100%',
            flex: '0 0 auto',
          }}>
          <Link
            to="/offers"
            style={{
              flex: '0 0 auto',
              padding: '8px 12px',
              borderRadius: '10px',
              border: '1px solid var(--secondary, #e86e2e)',
              background: 'var(--secondary, #e86e2e)',
              color: '#fff',
              fontSize: '0.8rem',
              fontWeight: 700,
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              whiteSpace: 'nowrap',
            }}>
            🎁 {t('special_offers_title', 'Special offers')}
          </Link>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveFilter(cat.id)}
              style={{
                flex: '0 0 auto',
                padding: '8px 12px',
                borderRadius: '10px',
                border:
                  activeFilter === cat.id
                    ? '2px solid var(--primary)'
                    : '1px solid var(--border-color)',
                background:
                  activeFilter === cat.id
                    ? 'rgba(139, 92, 246, 0.1)'
                    : 'var(--bg-card)',
                color: activeFilter === cat.id ? 'var(--primary)' : 'var(--text-main)',
                fontSize: '0.8rem',
                fontWeight: activeFilter === cat.id ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                whiteSpace: 'nowrap',
              }}>
              {cat.icon ? <span aria-hidden>{cat.icon}</span> : null}
              {cat.label}
            </button>
          ))}
        </div>
      ) : null}

      {loading && items.length === 0 ? (
        <div className="discovery-feed discovery-feed__empty">
          <AppText as="p">{t('loading', 'Loading…')}</AppText>
          <Link to="/restaurants/list" className="discovery-feed__replay-btn" style={{ marginTop: 12 }}>
            {t('list_view', 'List')}
          </Link>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="discovery-feed discovery-feed__empty">
          <AppText as="h2" className="discovery-feed__empty-title">
            {items.length === 0
              ? t('no_restaurants_found', 'No partners to show yet.')
              : t('no_venues_in_category', 'No venues in this category.')}
          </AppText>
          <AppText as="p" className="discovery-feed__empty-sub">
            {t('partners_swipe_empty_sub', 'Published businesses will appear here as cards.')}
          </AppText>
          <Link to="/restaurants/list" className="discovery-feed__replay-btn">
            {t('list_view', 'List')}
          </Link>
        </div>
      ) : (
        <MagneticDeck
          key={activeFilter}
          items={filteredItems}
          renderCard={renderCard}
          listPath="/restaurants/list"
          emptyTitle={t('no_restaurants_found', 'No partners to show yet.')}
          emptySub={t(
            'partners_swipe_empty_sub',
            'Published businesses will appear here as cards.'
          )}
          finishedTitle={t('discovery_deck_empty_title', "You're all caught up")}
          finishedSub={t(
            'partners_swipe_finished_sub',
            'Open the list for filters and map view, or browse again.'
          )}
        />
      )}
    </div>
  );
}
