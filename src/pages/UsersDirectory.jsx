import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { FaFilter, FaSearch, FaTimes } from 'react-icons/fa';
import { LuSparkles } from 'react-icons/lu';
import InboxHubLink from '../components/discovery/InboxHubLink';
import { useAuth } from '../context/AuthContext';
import { useUserDirectory } from '../hooks/useUserDirectory';
import { useProfileGiftPicker } from '../hooks/useProfileGiftPicker';
import UserDirectoryCard from '../components/UserDirectory/UserDirectoryCard';
import UserDirectoryFilters, { useDirectoryFilterContext } from '../components/UserDirectory/UserDirectoryFilters';
import {
  filterDirectoryUsers,
} from '../utils/userDirectoryFilters';
import { goToLogin } from '../utils/goToLogin';
import './UsersDirectory.css';
import { AppText, AppTextInput } from "../components/base";
import PullToRefresh from '../components/PullToRefresh';

export default function UsersDirectory() {
  const { t, i18n } = useTranslation();
  const { currentUser, userProfile, isGuest } = useAuth();
  const rtl = i18n.language === 'ar';
  const loadMoreRef = useRef(null);

  const [genderFilter, setGenderFilter] = useState('all');
  const [geoScope, setGeoScope] = useState('global');
  const [userLocation, setUserLocation] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const viewerUid = currentUser?.uid || currentUser?.id;
  const canBrowse = Boolean(viewerUid && !isGuest);
  const { openGiftPicker, giftModal } = useProfileGiftPicker();

  useEffect(() => {
    if (!navigator.geolocation) return undefined;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => setUserLocation(null)
    );
    return undefined;
  }, []);

  const filterContext = useDirectoryFilterContext(userProfile, userLocation);

  const {
    users,
    loading,
    loadingMore,
    error,
    hasMore,
    query,
    setQuery,
    isSearchMode,
    loadMore,
    refresh,
  } = useUserDirectory({
    excludeUid: viewerUid,
    enabled: canBrowse
  });

  const filteredUsers = useMemo(
    () =>
      filterDirectoryUsers(users, {
        genderFilter,
        geoScope,
        ...filterContext,
      }),
    [users, genderFilter, geoScope, filterContext]
  );

  useEffect(() => {
    if (!hasMore || loading || loadingMore) return undefined;

    const node = loadMoreRef.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: '240px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadMore, loading, loadingMore]);

  const clearQuery = () => setQuery('');

  const activeFiltersLabel = useMemo(() => {
    const gender =
      genderFilter === 'male'
        ? t('gender_male', 'Male')
        : genderFilter === 'female'
          ? t('gender_female', 'Female')
          : t('filter_all', 'All');
    const geo =
      geoScope === 'city'
        ? t('my_city', 'My city')
        : geoScope === 'country'
          ? t('my_country', 'My country')
          : t('feed_scope_global', t('global', 'Global'));
    return `${gender} · ${geo}`;
  }, [genderFilter, geoScope, t]);

  const handleRefresh = useCallback(async () => {
    document.querySelector('.app-main')?.scrollTo({ top: 0, behavior: 'smooth' });
    await refresh();
  }, [refresh]);

  if (!canBrowse) {
    return (
      <div className="users-directory-page" dir={rtl ? 'rtl' : 'ltr'}>
                <main className="users-directory-main">
                    <AppText as="p" className="users-directory-message">
                        {t(
              'user_directory_login_required',
              'Sign in to browse members and send invitations.'
            )}
                    </AppText>
                    <div className="users-directory-load-more">
                        <button
              type="button"
              className="users-directory-load-more-btn"
              onClick={() => goToLogin({ returnPath: '/search/list' })}>
              
                            {t('login_signup', 'Login / Sign Up')}
                        </button>
                    </div>
                </main>
            </div>);

  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <div className="users-directory-page" dir={rtl ? 'rtl' : 'ltr'}>
            <div className="users-directory-toolbar">
                <div className="users-directory-field">
                    <FaSearch className="users-directory-field-icon" aria-hidden />
                    <AppTextInput
            className="users-directory-field-input"
            type="search"
            enterKeyHint="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t(
              'user_directory_search_placeholder',
              'Search members by name…'
            )}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false} />
          
                    {query ?
          <button
            type="button"
            className="users-directory-field-clear"
            onClick={clearQuery}
            aria-label={t('clear', 'Clear')}>
            
                            <FaTimes />
                        </button> :
          null}
                </div>

                <div className="users-directory-toolbar__actions">
                      <Link
            to="/search"
            className="users-directory-feed-link"
            title={t('user_directory_feed_view', 'Swipe discovery')}>
                        <LuSparkles aria-hidden />
                        <AppText as="span" className="users-directory-feed-link__label">
                          {t('user_directory_feed_view', 'Swipe view')}
                        </AppText>
                      </Link>
                      <InboxHubLink
            className="users-directory-inbox-link inbox-hub-link"
            tab="activity"
            showLabel={false}
            label={t('inbox_tab_activity', 'Activity')}
          />
                      {!isSearchMode ?
          <button
            type="button"
            className={`users-directory-filters-toggle${filtersOpen ? ' users-directory-filters-toggle--open' : ''}`}
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
            aria-controls="users-directory-filters-panel"
            title={t('user_directory_toggle_filters', 'Filters')}>
                        <FaFilter aria-hidden />
                        <AppText as="span" className="users-directory-filters-toggle__label">
                          {t('user_directory_toggle_filters', 'Filters')}
                        </AppText>
                        {!filtersOpen ?
            <AppText as="span" className="users-directory-filters-toggle__summary">
                          {activeFiltersLabel}
                        </AppText> :
            null}
                      </button> :
          null}
                </div>
            </div>

            {!isSearchMode ?
        <UserDirectoryFilters
          id="users-directory-filters-panel"
          expanded={filtersOpen}
          genderFilter={genderFilter}
          onGenderFilterChange={setGenderFilter}
          geoScope={geoScope}
          onGeoScopeChange={setGeoScope}
          userProfile={userProfile}
        /> :
        null}

            <main className="users-directory-main">
                {!isSearchMode && loading && users.length === 0 ?
        <AppText as="p" className="users-directory-message">{t('loading', 'Loading…')}</AppText> :
        null}

                {isSearchMode && loading &&
        <AppText as="p" className="users-directory-message">{t('searching', 'Searching…')}</AppText>
        }

                {error ?
        <AppText as="p" className="users-directory-message users-directory-message--error">
                        {t(error, 'Could not load members. Try again.')}
                    </AppText> :
        null}

                {!loading && !error && users.length === 0 && isSearchMode ?
        <AppText as="p" className="users-directory-message">{t('no_results', 'No results')}</AppText> :
        null}

                {!loading && !error && users.length === 0 && !isSearchMode ?
        <AppText as="p" className="users-directory-message">
                        {t('user_directory_empty', 'No members to show yet.')}
                    </AppText> :
        null}

                {!loading && !error && users.length > 0 && filteredUsers.length === 0 ?
        <AppText as="p" className="users-directory-message">
                        {t(
            'user_directory_no_filter_matches',
            'No members match these filters. Try All or Global.'
          )}
                    </AppText> :
        null}

                {filteredUsers.length > 0 ?
        <div className="users-directory-grid">
                        {filteredUsers.map((user) =>
          <UserDirectoryCard key={user.id} user={user} currentUser={currentUser} onGift={openGiftPicker} />
          )}
                    </div> :
        null}

                {hasMore && !isSearchMode ?
        <div className="users-directory-load-more" ref={loadMoreRef}>
                        <button
            type="button"
            className="users-directory-load-more-btn"
            onClick={loadMore}
            disabled={loadingMore}>
            
                            {loadingMore ?
            t('loading', 'Loading…') :
            t('user_directory_load_more', 'Load more')}
                        </button>
                    </div> :
        null}
            </main>
            {giftModal}
        </div>
    </PullToRefresh>);

}