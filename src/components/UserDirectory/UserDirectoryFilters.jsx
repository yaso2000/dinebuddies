import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { normalizePlaceLabel } from '../../utils/postsFeedScope';
import { AppText } from '../base';

/**
 * Gender + geo filter chips for the Connect member card list (same geo pattern as posts feed).
 */
export default function UserDirectoryFilters({
  genderFilter,
  onGenderFilterChange,
  geoScope,
  onGeoScopeChange,
  userProfile,
}) {
  const { t } = useTranslation();

  const userCityLabel = useMemo(() => {
    const city = String(userProfile?.city || '').trim();
    return city || t('feed_scope_local', t('in_my_city', 'My city'));
  }, [userProfile?.city, t]);

  const userCountryLabel = useMemo(() => {
    const country = String(userProfile?.country || '').trim();
    return country || t('in_my_country', 'My country');
  }, [userProfile?.country, t]);

  const genderFilters = useMemo(
    () => [
      { id: 'all', label: t('filter_all', 'All'), icon: '👥' },
      { id: 'male', label: t('gender_male', 'Male'), icon: '👨' },
      { id: 'female', label: t('gender_female', 'Female'), icon: '👩' },
    ],
    [t]
  );

  const geoScopeFilters = useMemo(
    () => [
      { id: 'global', label: t('feed_scope_global', t('global', 'Global')), icon: '🌍' },
      { id: 'country', label: userCountryLabel, icon: '🗺️' },
      { id: 'city', label: userCityLabel, icon: '🏙️' },
    ],
    [t, userCountryLabel, userCityLabel]
  );

  return (
    <div className="users-directory-filters">
      <div
        className="users-directory-filters__row posts-feed-scope-chips"
        role="group"
        aria-label={t('user_directory_gender_filter_aria', 'Gender filter')}>
        {genderFilters.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`home-geo-chip home-geo-chip--compact${genderFilter === f.id ? ' home-geo-chip--active' : ''}`}
            onClick={() => onGenderFilterChange(f.id)}
            aria-pressed={genderFilter === f.id}>
            <AppText as="span" className="home-geo-chip__icon" aria-hidden>
              {f.icon}
            </AppText>
            <AppText as="span" className="home-geo-chip__label">{f.label}</AppText>
          </button>
        ))}
      </div>

      <div
        className="users-directory-filters__row posts-feed-scope-chips"
        role="group"
        aria-label={t('feed_scope_geo_aria', 'Area scope')}>
        {geoScopeFilters.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`home-geo-chip home-geo-chip--compact${geoScope === f.id ? ' home-geo-chip--active' : ''}`}
            onClick={() => onGeoScopeChange(f.id)}
            aria-pressed={geoScope === f.id}>
            <AppText as="span" className="home-geo-chip__icon" aria-hidden>
              {f.icon}
            </AppText>
            <AppText as="span" className="home-geo-chip__label">{f.label}</AppText>
          </button>
        ))}
      </div>
    </div>
  );
}

export function useDirectoryFilterContext(userProfile, userLocation) {
  return useMemo(
    () => ({
      userCityNorm: normalizePlaceLabel(userProfile?.city),
      userCountryNorm: normalizePlaceLabel(userProfile?.country),
      userCountryCode: String(userProfile?.countryCode || userProfile?.country_code || '')
        .trim()
        .toLowerCase(),
      userLocation,
    }),
    [
      userProfile?.city,
      userProfile?.country,
      userProfile?.countryCode,
      userProfile?.country_code,
      userLocation,
    ]
  );
}
