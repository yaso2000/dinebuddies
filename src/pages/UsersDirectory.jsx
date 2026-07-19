import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { FaMapMarkerAlt, FaTimes } from 'react-icons/fa';
import { LuSparkles } from 'react-icons/lu';
import InboxHubLink from '../components/discovery/InboxHubLink';
import LocationAutocomplete from '../components/LocationAutocomplete';
import { useAuth } from '../context/AuthContext';
import { useUserDirectory } from '../hooks/useUserDirectory';
import { useProfileGiftPicker } from '../hooks/useProfileGiftPicker';
import UserDirectoryCard from '../components/UserDirectory/UserDirectoryCard';
import UserDirectoryFilters from '../components/UserDirectory/UserDirectoryFilters';
import {
  filterDirectoryUsers,
  inferDirectoryPlaceScope,
} from '../utils/userDirectoryFilters';
import { getUserDocLatLng } from '../utils/userDocCoords';
import { parseGoogleAddressComponents } from '../utils/googlePlacesBusiness';
import { goToLogin } from '../utils/goToLogin';
import './UsersDirectory.css';
import '../components/venue-search.css';
import { AppText } from '../components/base';
import PullToRefresh from '../components/PullToRefresh';

export default function UsersDirectory() {
  const { t, i18n } = useTranslation();
  const { currentUser, userProfile, isGuest } = useAuth();
  const rtl = i18n.language === 'ar';
  const loadMoreRef = useRef(null);

  const [genderFilter, setGenderFilter] = useState('all');
  const [deviceLocation, setDeviceLocation] = useState(null);
  const [placeQuery, setPlaceQuery] = useState('');
  const [selectedPlace, setSelectedPlace] = useState(null);

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

  const filteredUsers = useMemo(
    () =>
      filterDirectoryUsers(users, {
        genderFilter,
        selectedPlace,
        userLocation,
      }),
    [users, genderFilter, selectedPlace, userLocation]
  );

  // When a place is selected, keep loading a few more pages (capped) until we have matches.
  useEffect(() => {
    if (!selectedPlace || loading || loadingMore || !hasMore) return;
    if (filteredUsers.length >= 8) return;
    if (users.length >= 120) return;
    loadMore();
  }, [
    selectedPlace,
    filteredUsers.length,
    users.length,
    hasMore,
    loading,
    loadingMore,
    loadMore,
  ]);

  useEffect(() => {
    if (!hasMore || loading || loadingMore) return undefined;

    const node = loadMoreRef.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: '160px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadMore, loading, loadingMore]);

  const handlePlaceSelect = useCallback((place) => {
    const parsed = place.addressComponents
      ? parseGoogleAddressComponents(place.addressComponents)
      : { city: '', country: '', countryCode: '' };
    const city = String(place.city || parsed.city || '').trim();
    const country = String(place.country || parsed.country || '').trim();
    const countryCode = String(place.countryCode || parsed.countryCode || '')
      .trim()
      .toUpperCase();
    const label =
      String(place.fullAddress || place.name || '').trim() ||
      [city, country].filter(Boolean).join(', ');

    const next = {
      label,
      city,
      country,
      countryCode,
      lat: place.lat ?? null,
      lng: place.lng ?? null,
      addressComponents: place.addressComponents || [],
      types: place.types || [],
    };
    next.scope = inferDirectoryPlaceScope(next);

    setSelectedPlace(next);
    setPlaceQuery(label);
  }, []);

  const clearPlace = useCallback(() => {
    setSelectedPlace(null);
    setPlaceQuery('');
  }, []);

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
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="users-directory-page" dir={rtl ? 'rtl' : 'ltr'}>
        <div className="users-directory-toolbar">
          <div className="users-directory-field users-directory-field--place">
            <FaMapMarkerAlt className="users-directory-field-icon" aria-hidden />
            <LocationAutocomplete
              value={placeQuery}
              onChange={(e) => {
                setPlaceQuery(e.target.value);
                if (selectedPlace) setSelectedPlace(null);
              }}
              onSelect={handlePlaceSelect}
              useGooglePlacesMinimal
              required={false}
              userLat={userLocation?.lat}
              userLng={userLocation?.lng}
              className="users-directory-place-autocomplete"
              inputStyle={{
                width: '100%',
                border: 'none',
                background: 'transparent',
                boxShadow: 'none',
                padding: '0',
                height: '38px',
                fontSize: '0.95rem',
                color: 'var(--text-main)',
              }}
              placeholder={t(
                'user_directory_search_placeholder',
                'Search city, region, or country…'
              )}
              aria-label={t(
                'user_directory_geo_search_aria',
                'Search members by city, region, or country'
              )}
            />
            {placeQuery || selectedPlace ? (
              <button
                type="button"
                className="users-directory-field-clear"
                onClick={clearPlace}
                aria-label={t('clear', 'Clear')}>
                <FaTimes />
              </button>
            ) : null}
          </div>

          <div className="users-directory-toolbar__actions">
            <UserDirectoryFilters
              id="users-directory-filters-panel"
              genderFilter={genderFilter}
              onGenderFilterChange={setGenderFilter}
            />
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
                onClick={loadMore}
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
