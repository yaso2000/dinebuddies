import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LuSparkles } from 'react-icons/lu';
import InboxHubLink from '../components/discovery/InboxHubLink';
import DirectorySearchBar from '../components/DirectorySearchBar';
import { getPrivateInviteeDisplayName } from '../utils/privateInviteAvailability';
import { useAuth } from '../context/AuthContext';
import { useUserDirectory } from '../hooks/useUserDirectory';
import { useProfileGiftPicker } from '../hooks/useProfileGiftPicker';
import UserDirectoryCard from '../components/UserDirectory/UserDirectoryCard';
import UserDirectoryFilters from '../components/UserDirectory/UserDirectoryFilters';
import {
  filterDirectoryUsers,
} from '../utils/userDirectoryFilters';
import { getUserDocLatLng } from '../utils/userDocCoords';
import { goToLogin } from '../utils/goToLogin';
import './UsersDirectory.css';
import '../components/venue-search.css';
import { AppText } from '../components/base';
import PullToRefresh from '../components/PullToRefresh';

// How many VISIBLE cards each "Load more" tap should try to add, and a hard cap
// on how many raw docs we page through chasing them. Pages fetched from
// Firestore are thinned by the client filters (photo gate, gender, place…), so a
// single page can yield zero visible cards; we keep paging until the visible
// list grows by a step or the pool runs out.
const BROWSE_VISIBLE_STEP = 12;
const BROWSE_HARD_CAP = 240;

export default function UsersDirectory() {
  const { t, i18n } = useTranslation();
  const { currentUser, userProfile, isGuest, isBusiness } = useAuth();
  const rtl = i18n.language === 'ar';
  const loadMoreRef = useRef(null);

  const [genderFilter, setGenderFilter] = useState('all');
  const [ageCategoryFilter, setAgeCategoryFilter] = useState('all');
  const [photoFilter, setPhotoFilter] = useState('with_photo'); // 'with_photo' | 'all'
  const [onlineOnly, setOnlineOnly] = useState(false); // online-now switch
  const [deviceLocation, setDeviceLocation] = useState(null);
  // Unified free search (name) + data-derived place chip (city/country).
  const [searchText, setSearchText] = useState('');
  const [placeFilter, setPlaceFilter] = useState(null);
  // Target number of visible cards to keep on screen; grows on "Load more".
  const [visibleTarget, setVisibleTarget] = useState(BROWSE_VISIBLE_STEP);

  const viewerUid = currentUser?.uid || currentUser?.id;
  const canBrowse = Boolean(viewerUid && !isGuest);
  const { openGiftPicker, giftModal } = useProfileGiftPicker();

  useEffect(() => {
    if (!navigator.geolocation) return undefined;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setDeviceLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => setDeviceLocation(null)
    );
    return undefined;
  }, []);

  const userLocation = useMemo(
    () => deviceLocation || getUserDocLatLng(userProfile) || null,
    [deviceLocation, userProfile]
  );

  const {
    users,
    loading,
    loadingMore,
    error,
    hasMore,
    loadMore,
    refresh,
  } = useUserDirectory({
    excludeUid: viewerUid,
    enabled: canBrowse,
  });

  // Stable display order: once shown, members keep their place; loading more
  // appends the new page BELOW (in distance order among themselves) instead of
  // re-shuffling the whole list over the scroll position. Reset only when the
  // filter or the viewer's location changes.
  const displayOrderRef = useRef([]);
  const filterKeyRef = useRef(null);
  const filteredUsers = useMemo(() => {
    const sorted = filterDirectoryUsers(users, {
      genderFilter,
      ageCategoryFilter,
      photoFilter,
      onlineOnly,
      searchText,
      placeFilter,
      userLocation,
    });
    const filterKey = JSON.stringify([
      genderFilter,
      ageCategoryFilter,
      photoFilter,
      onlineOnly,
      searchText,
      placeFilter?.id || placeFilter || '',
      userLocation ? `${userLocation.lat},${userLocation.lng}` : '',
    ]);
    const byId = new Map(sorted.map((u) => [u.id, u]));

    if (filterKey !== filterKeyRef.current) {
      filterKeyRef.current = filterKey;
      displayOrderRef.current = sorted.map((u) => u.id);
      return sorted;
    }

    const keptIds = displayOrderRef.current.filter((id) => byId.has(id));
    const keptSet = new Set(keptIds);
    const appended = sorted.filter((u) => !keptSet.has(u.id)).map((u) => u.id);
    const order = [...keptIds, ...appended];
    displayOrderRef.current = order;
    return order.map((id) => byId.get(id)).filter(Boolean);
  }, [users, genderFilter, ageCategoryFilter, photoFilter, onlineOnly, searchText, placeFilter, userLocation]);

  // Member-name suggestions for the unified search box.
  const memberItems = useMemo(() => {
    const seen = new Set();
    const opts = [];
    for (const u of users || []) {
      const id = u?.uid || u?.id;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const name = getPrivateInviteeDisplayName(u) || '';
      if (!name) continue;
      opts.push({ id, name, city: String(u?.city || '').trim() });
    }
    return opts;
  }, [users]);

  // City + country suggestions derived from loaded members (free, no API).
  const placeOptions = useMemo(() => {
    const countrySet = new Set();
    const cityMap = new Map();
    for (const u of users || []) {
      const country = String(u?.country || '').trim();
      const city = String(u?.city || '').trim();
      if (country) countrySet.add(country);
      if (city) {
        const key = `${city.toLocaleLowerCase()}|${country.toLocaleLowerCase()}`;
        if (!cityMap.has(key)) cityMap.set(key, { city, country });
      }
    }
    const opts = [];
    for (const c of countrySet) {
      opts.push({ id: `country:${c}`, type: 'country', value: c, label: c, sublabel: '' });
    }
    for (const { city, country } of cityMap.values()) {
      opts.push({ id: `city:${city}|${country}`, type: 'city', value: city, label: city, sublabel: country });
    }
    opts.sort((a, b) => a.label.localeCompare(b.label));
    return opts;
  }, [users]);

  // Changing any filter/search resets the visible target — otherwise a large
  // target carried over from browsing would over-fetch the new result set.
  useEffect(() => {
    setVisibleTarget(BROWSE_VISIBLE_STEP);
  }, [genderFilter, ageCategoryFilter, photoFilter, onlineOnly, searchText, placeFilter]);

  // Keep paging until the VISIBLE list reaches the target (or the pool is
  // exhausted). A fetched page is thinned by the client filters, so a single
  // page may add zero visible cards; without this, "Load more" would grow the
  // raw list but leave the screen unchanged. Capped so it never runs away.
  useEffect(() => {
    if (loading || loadingMore || !hasMore) return;
    if (filteredUsers.length >= visibleTarget) return;
    if (users.length >= BROWSE_HARD_CAP) return;
    loadMore();
  }, [
    filteredUsers.length,
    visibleTarget,
    users.length,
    hasMore,
    loading,
    loadingMore,
    loadMore,
  ]);

  // Sentinel near the end of the list → ask for another step of visible cards.
  const requestMore = useCallback(() => {
    setVisibleTarget((prev) =>
      Math.max(prev, filteredUsers.length) + BROWSE_VISIBLE_STEP
    );
  }, [filteredUsers.length]);

  useEffect(() => {
    if (!hasMore) return undefined;

    const node = loadMoreRef.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) requestMore();
      },
      { rootMargin: '240px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, requestMore]);

  const handleRefresh = useCallback(async () => {
    document.querySelector('.app-main')?.scrollTo({ top: 0, behavior: 'smooth' });
    await refresh();
  }, [refresh]);

  // Businesses may not browse / contact regular users.
  if (isBusiness) return <Navigate to="/business-dashboard" replace />;

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
              onClick={() => goToLogin({ returnPath: '/search' })}>
              {t('login_signup', 'Login / Sign Up')}
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="users-directory-page" dir={rtl ? 'rtl' : 'ltr'}>
        <div className="users-directory-toolbar">
          <div className="users-directory-field users-directory-field--place">
            <DirectorySearchBar
              text={searchText}
              onTextChange={setSearchText}
              place={placeFilter}
              onPlaceChange={setPlaceFilter}
              items={memberItems}
              places={placeOptions}
              itemIcon="👤"
              placeholder={t(
                'user_directory_search_placeholder_v2',
                'Search a member, city or country…'
              )}
              clearLabel={t('clear', 'Clear')}
            />
          </div>

          <div className="users-directory-toolbar__actions">
            <UserDirectoryFilters
              id="users-directory-filters-panel"
              genderFilter={genderFilter}
              onGenderFilterChange={setGenderFilter}
              ageCategoryFilter={ageCategoryFilter}
              onAgeCategoryFilterChange={setAgeCategoryFilter}
              photoFilter={photoFilter}
              onPhotoFilterChange={setPhotoFilter}
              onlineOnly={onlineOnly}
              onOnlineOnlyChange={setOnlineOnly}
            />
            <Link
              to="/search"
              className="users-directory-feed-link"
              title={t('user_directory_feed_view', 'Connect cards')}>
              <LuSparkles aria-hidden />
              <AppText as="span" className="users-directory-feed-link__label">
                {t('user_directory_feed_view', 'Card view')}
              </AppText>
            </Link>
            <InboxHubLink
              className="users-directory-inbox-link inbox-hub-link"
              tab="activity"
              showLabel={false}
              label={t('inbox_tab_activity', 'Activity')}
            />
          </div>
        </div>

        <main className="users-directory-main">
          {loading && users.length === 0 ? (
            <AppText as="p" className="users-directory-message">
              {t('loading', 'Loading…')}
            </AppText>
          ) : null}

          {error ? (
            <AppText as="p" className="users-directory-message users-directory-message--error">
              {t(error, 'Could not load members. Try again.')}
            </AppText>
          ) : null}

          {!loading && !error && users.length === 0 ? (
            <AppText as="p" className="users-directory-message">
              {t('user_directory_empty', 'No members to show yet.')}
            </AppText>
          ) : null}

          {!loading && !error && users.length > 0 && filteredUsers.length === 0 ? (
            <AppText as="p" className="users-directory-message">
              {t(
                'user_directory_no_filter_matches',
                'No members match this place. Try another city or clear the search.'
              )}
            </AppText>
          ) : null}

          {filteredUsers.length > 0 ? (
            <div className="users-directory-grid">
              {filteredUsers.map((user) => (
                <UserDirectoryCard
                  key={user.id}
                  user={user}
                  currentUser={currentUser}
                  onGift={openGiftPicker}
                />
              ))}
            </div>
          ) : null}

          {hasMore ? (
            <div className="users-directory-load-more" ref={loadMoreRef}>
              <button
                type="button"
                className="users-directory-load-more-btn"
                onClick={requestMore}
                disabled={loadingMore}>
                {loadingMore
                  ? t('loading', 'Loading…')
                  : t('user_directory_load_more', 'Load more')}
              </button>
            </div>
          ) : null}
        </main>
        {giftModal}
      </div>
    </PullToRefresh>
  );
}
