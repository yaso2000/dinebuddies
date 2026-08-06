import React, { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import MagneticDeck from '../components/discovery/MagneticDeck';
import InvitationSwipeCard from '../components/discovery/InvitationSwipeCard';
import { useInvitationSwipeDeck } from '../hooks/useInvitationSwipeDeck';
import '../components/discovery/discovery.css';
import { AppText } from '../components/base';

/** Public invitations — magnetic swipe deck (default /invitations). Close → list. */
export default function InvitationsSwipePage() {
  const { t } = useTranslation();
  const { items, loading } = useInvitationSwipeDeck();

  const renderCard = useCallback(
    ({ item, isTop, onSkip }) => (
      <InvitationSwipeCard key={item.id} item={item} isTop={isTop} onSkip={onSkip} />
    ),
    []
  );

  return (
    <div className="discovery-shell discovery-shell--in-layout">
      {loading && items.length === 0 ? (
        <div className="discovery-feed discovery-feed__empty">
          <AppText as="p">{t('loading', 'Loading…')}</AppText>
          <Link to="/invitations/list" className="discovery-feed__replay-btn" style={{ marginTop: 12 }}>
            {t('list_view', 'List')}
          </Link>
        </div>
      ) : items.length === 0 ? (
        <div className="discovery-feed discovery-feed__empty">
          <AppText as="h2" className="discovery-feed__empty-title">
            {t('no_invitations_found', 'No invitations to show yet.')}
          </AppText>
          <AppText as="p" className="discovery-feed__empty-sub">
            {t('invitations_swipe_empty_sub', 'Public invitations near you will appear here.')}
          </AppText>
          <Link to="/invitations/list" className="discovery-feed__replay-btn">
            {t('list_view', 'List')}
          </Link>
        </div>
      ) : (
        <MagneticDeck
          items={items}
          renderCard={renderCard}
          listPath="/invitations/list"
          emptyTitle={t('no_invitations_found', 'No invitations to show yet.')}
          emptySub={t(
            'invitations_swipe_empty_sub',
            'Public invitations near you will appear here.'
          )}
          finishedTitle={t('discovery_deck_empty_title', "You're all caught up")}
          finishedSub={t(
            'invitations_swipe_finished_sub',
            'Open the list for filters and map view, or browse again.'
          )}
        />
      )}
    </div>
  );
}
