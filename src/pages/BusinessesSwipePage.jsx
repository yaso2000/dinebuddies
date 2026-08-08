import React, { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import MagneticDeck from '../components/discovery/MagneticDeck';
import BusinessSwipeCard from '../components/discovery/BusinessSwipeCard';
import { useBusinessSwipeDeck } from '../hooks/useBusinessSwipeDeck';
import '../components/discovery/discovery.css';
import { AppText } from '../components/base';

/** Partners / restaurants — magnetic swipe deck (default /restaurants). Close → list. */
export default function BusinessesSwipePage() {
  const { t } = useTranslation();
  const { items, loading } = useBusinessSwipeDeck();

  const renderCard = useCallback(
    ({ item, isTop, onSkip }) => (
      <BusinessSwipeCard key={item.id} item={item} isTop={isTop} onSkip={onSkip} />
    ),
    []
  );

  return (
    <div className="discovery-shell discovery-shell--in-layout discovery-shell--partners">
      {loading && items.length === 0 ? (
        <div className="discovery-feed discovery-feed__empty">
          <AppText as="p">{t('loading', 'Loading…')}</AppText>
          <Link to="/restaurants/list" className="discovery-feed__replay-btn" style={{ marginTop: 12 }}>
            {t('list_view', 'List')}
          </Link>
        </div>
      ) : items.length === 0 ? (
        <div className="discovery-feed discovery-feed__empty">
          <AppText as="h2" className="discovery-feed__empty-title">
            {t('no_restaurants_found', 'No partners to show yet.')}
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
          items={items}
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
