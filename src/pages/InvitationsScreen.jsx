import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaSearch, FaGlobe, FaLock, FaHeart } from 'react-icons/fa';
import InvitationCard from '../components/InvitationCard';
import InvitationSkeleton from '../components/InvitationSkeleton';
import InvitationTypeCard from '../components/Invitations/InvitationTypeCard';
import { useInvitations } from '../context/InvitationContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import usePublicInvitationsFeed from '../hooks/usePublicInvitationsFeed';
import './InvitationsScreen.css';
import { AppText, AppTextInput } from "../components/base";

const CATEGORY_CHIPS = [
{ id: 'All', labelKey: 'filter_all', fallback: 'All' },
{ id: 'Restaurant', labelKey: 'type_restaurant', fallback: 'Restaurant', icon: '🍴' },
{ id: 'Cafe', labelKey: 'type_cafe', fallback: 'Cafe', icon: '☕' },
{ id: 'Bar', labelKey: 'type_bar', fallback: 'Bar', icon: '🍺' },
{ id: 'Cinema', labelKey: 'type_cinema', fallback: 'Cinema', icon: '🎬' }];


const InvitationsScreen = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const { userProfile, isBusiness, cannotCreateInvitations } = useAuth();
  const isBusinessAccount = isBusiness;

  const invContext = useInvitations();
  const {
    invitations = [],
    currentUser = null,
    loadingInvitations: loading = true,
    canCreateSocialInvitation
  } = invContext || {};

  const [redirectMessage, setRedirectMessage] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [geoFilter, setGeoFilter] = useState('global');
  const [activeFilter, setActiveFilter] = useState('All');
  const [userLocation, setUserLocation] = useState(null);

  const canShowCreate = !isBusinessAccount && currentUser?.id !== 'guest' && !userProfile?.isGuest;

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      },
      () => setUserLocation(null)
    );
  }, []);

  useEffect(() => {
    const message = location.state?.message;
    if (!message) return;
    setRedirectMessage(message);
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.state?.message, location.pathname, navigate]);

  useEffect(() => {
    if (!redirectMessage) return;
    const timer = setTimeout(() => setRedirectMessage(null), 6000);
    return () => clearTimeout(timer);
  }, [redirectMessage]);

  const { filteredInvitations, hasActiveFilters } = usePublicInvitationsFeed({
    invitations,
    currentUser,
    userProfile,
    userLocation,
    searchQuery,
    activeFilter,
    geoFilter
  });

  const scrollToCreate = useCallback(() => {
    const el = document.getElementById('invitations-create-section');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const goCreate = useCallback(
    async (kind) => {
      if (cannotCreateInvitations || !kind) return;

      if (kind === 'public') {
        navigate('/create');
        return;
      }

      if (kind === 'social') {
        const quota = canCreateSocialInvitation?.('social');
        if (quota && !quota.profileLoading && !quota.canCreate) {
          showToast(
            t(
              'insufficient_dine_credits_wallet',
              'Not enough Dine Credits. Open Settings → Dine Credits to top up.'
            ),
            'error'
          );
          navigate('/settings/credits');
          return;
        }
        navigate('/create-social');
        return;
      }

      if (kind === 'private' || kind === 'dating') {
        const quota = canCreateSocialInvitation?.('private');
        if (quota && !quota.profileLoading && !quota.canCreate) {
          showToast(
            t(
              'insufficient_dine_credits_wallet',
              'Not enough Dine Credits. Open Settings → Dine Credits to top up.'
            ),
            'error'
          );
          navigate('/settings/credits');
          return;
        }
        navigate('/create-private');
      }
    },
    [
    cannotCreateInvitations,
    navigate,
    canCreateSocialInvitation,
    showToast,
    t]

  );

  const handleTypeKeyDown = useCallback(
    (kind) => (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        goCreate(kind);
      }
    },
    [goCreate]
  );

  const emptyIcon = useMemo(() => {
    if (hasActiveFilters) return '🔍';
    return '🍽️';
  }, [hasActiveFilters]);

  const emptyTitle = hasActiveFilters ?
  t('no_results_found', 'No Results Found') :
  t('no_invitations_yet', 'No Invitations Yet');

  const emptyDescription = hasActiveFilters ?
  t('try_different_filters', 'Try adjusting your filters or search terms') :
  t('be_first_to_create', 'Be the first to create an invitation and start connecting!');

  const clearFilters = () => {
    setSearchQuery('');
    setActiveFilter('All');
    setGeoFilter('global');
  };

  return (
    <div className="invitations-screen">
            <div className="invitations-screen__scroll">
                <div className="invitations-screen__inner">
                    <header className="invitations-screen__header">
                        <AppText as="h1" className="invitations-screen__title">
                            {t('invitations', 'Invitations')}
                        </AppText>
                        <AppText as="p" className="invitations-screen__subtitle">
                            {t(
                'invitations_screen_subtitle',
                'Discover open invites nearby or start your own.'
              )}
                        </AppText>
                    </header>

                    {redirectMessage &&
          <div className="invitations-screen__banner" role="status">
                            <AppText as="span">{redirectMessage}</AppText>
                            <button
              type="button"
              className="invitations-screen__banner-close"
              onClick={() => setRedirectMessage(null)}>
              
                                {t('close', 'Close')}
                            </button>
                        </div>
          }

                    <section className="invitations-screen__filters" aria-label={t('filters', 'Filters')}>
                        <div className="invitations-screen__search-row">
                            <div className="invitations-screen__search">
                                <FaSearch
                  className="invitations-screen__search-icon invitations-screen__search-icon--start"
                  aria-hidden />
                
                                <AppTextInput
                  type="search"
                  className="invitations-screen__search-input"
                  placeholder={t(
                    'search_invitations_placeholder',
                    'Search invitations...'
                  )}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label={t(
                    'search_invitations_placeholder',
                    'Search invitations...'
                  )} />
                
                            </div>
                            <select
                className="invitations-screen__geo-select"
                value={geoFilter}
                onChange={(e) => setGeoFilter(e.target.value)}
                aria-label={t('location_filter', 'Location filter')}>
                
                                <option value="global">🌍 {t('all', 'All')}</option>
                                <option value="nearby">📍 {t('near_me', 'Near me')}</option>
                                <option value="city">🏙️ {t('in_my_city', 'In my city')}</option>
                                <option value="country">🗺️ {t('in_my_country', 'In my country')}</option>
                            </select>
                        </div>

                        <div className="invitations-screen__chips" role="tablist" aria-label={t('category', 'Category')}>
                            {CATEGORY_CHIPS.map((chip) => {
                const label = t(chip.labelKey, chip.fallback);
                const isActive = activeFilter === chip.id;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={`invitations-screen__chip${isActive ? ' invitations-screen__chip--active' : ''}`}
                    onClick={() => setActiveFilter(chip.id)}>
                    
                                        {chip.icon ? `${chip.icon} ` : ''}
                                        {label}
                                    </button>);

              })}
                        </div>
                    </section>

                    {canShowCreate &&
          <section
            id="invitations-create-section"
            className="invitations-screen__create"
            aria-label={t('invite_create_title', 'Create invitation')}>
            
                            <AppText as="p" className="invitations-screen__create-label">
                                {t('invite_create_title', 'Create invitation')}
                            </AppText>

                            <InvitationTypeCard
              variant="public"
              icon={FaGlobe}
              title={t('dinebuddy_open', 'DineBuddy Open')}
              description={t(
                'invite_create_public_desc',
                'A discoverable invitation others can browse and join.'
              )}
              onClick={() => goCreate('public')}
              onKeyDown={handleTypeKeyDown('public')} />
            

                            <InvitationTypeCard
              variant="social"
              icon={FaLock}
              title={t('invite_create_social_title', 'Social Invite')}
              description={t(
                'invite_create_social_desc',
                'Invite specific guests with a private link.'
              )}
              onClick={() => goCreate('social')}
              onKeyDown={handleTypeKeyDown('social')} />
            

                            <InvitationTypeCard
              variant="personal"
              icon={FaHeart}
              title={t('invite_create_private_title', 'Personal Invite')}
              description={t(
                'invite_create_private_desc',
                'A private-style invitation for matched dining.'
              )}
              onClick={() => goCreate('private')}
              onKeyDown={handleTypeKeyDown('private')} />
            
                        </section>
          }

                    <main className="invitations-screen__main">
                        {loading ?
            <div className="invitations-screen__feed" aria-busy="true">
                                {[1, 2, 3].map((i) =>
              <InvitationSkeleton key={i} />
              )}
                            </div> :
            filteredInvitations.length > 0 ?
            <div className="invitations-screen__feed">
                                {filteredInvitations.map((inv) =>
              <InvitationCard key={inv.id} invitation={inv} />
              )}
                            </div> :

            <div className="invitations-screen__empty">
                                <div className="invitations-screen__empty-icon" aria-hidden>
                                    {emptyIcon}
                                </div>
                                <AppText as="h2" className="invitations-screen__empty-title">{emptyTitle}</AppText>
                                <AppText as="p" className="invitations-screen__empty-text">{emptyDescription}</AppText>
                                <div className="invitations-screen__empty-actions">
                                    {hasActiveFilters ?
                <button
                  type="button"
                  className="invitations-screen__btn invitations-screen__btn--ghost"
                  onClick={clearFilters}>
                  
                                            {t('clear_filters', 'Clear Filters')}
                                        </button> :

                canShowCreate &&
                <button
                  type="button"
                  className="invitations-screen__btn invitations-screen__btn--primary"
                  onClick={scrollToCreate}>
                  
                                                {t('create_invitation', 'Create Invitation')}
                                            </button>

                }
                                </div>
                            </div>
            }
                    </main>
                </div>
            </div>
        </div>);

};

export default InvitationsScreen;