import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { normalizePlaceLabel } from '../../utils/postsFeedScope';
import { AppText } from '../base';

/**
 * Gender + geo filter chips for the Connect member card list (same geo pattern as posts feed).
 */
export default function UserDirectoryFilters({
  id,
  expanded = true,
  genderFilter,
  onGenderFilterChange,
  geoScope,
  onGeoScopeChange,
  userProfile,
}) {
  const { t } = useTranslation();

  const userCityLabel = useMemo(() => t('my_city', 'My city'), [t]);

  const userCountryLabel = useMemo(() => t('my_country', 'My country'), [t]);

  const genderFilters = useMemo(
    () => [
      { id: 'all', label: t('filter_all', 'All') },
      { id: 'male', label: t('gender_male', 'Male') },
      { id: 'female', label: t('gender_female', 'Female') },
    ],
    [t]
  );

  const geoScopeFilters = useMemo(
    () => [
      { id: 'global', label: t('feed_scope_global', t('global', 'Global')) },
      { id: 'country', label: userCountryLabel },
      { id: 'city', label: userCityLabel },
    ],
    [t, userCountryLabel, userCityLabel]
  );

  if (!expanded) return null;

  return (
    <div id={id} className="users-directory-filters">
      <div
        className="users-directory-filters__row posts-feed-scope-chips"
        role="group"
        aria-label={t('user_directory_gender_filter_aria', 'Gender filter')}>
        {genderFilters.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`home-geo-chip home-geo-chip--compact users-directory-filter-chip${genderFilter === f.id ? ' home-geo-chip--active' : ''}`}
            onClick={() => onGenderFilterChange(f.id)}
            aria-pressed={genderFilter === f.id}>
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
            className={`home-geo-chip home-geo-chip--compact users-directory-filter-chip${geoScope === f.id ? ' home-geo-chip--active' : ''}`}
            onClick={() => onGeoScopeChange(f.id)}
            aria-pressed={geoScope === f.id}>
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
