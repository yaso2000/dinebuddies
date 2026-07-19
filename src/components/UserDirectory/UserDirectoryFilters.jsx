import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AppText } from '../base';

/**
 * Gender filter chips for the Connect member card list — always visible in the toolbar.
 */
export default function UserDirectoryFilters({
  id,
  genderFilter,
  onGenderFilterChange,
}) {
  const { t } = useTranslation();

  const genderFilters = useMemo(
    () => [
      { id: 'all', label: t('filter_all', 'All') },
      { id: 'male', label: t('gender_male', 'Male') },
      { id: 'female', label: t('gender_female', 'Female') },
    ],
    [t]
  );

  return (
    <div
      id={id}
      className="users-directory-filters users-directory-filters--toolbar"
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
  );
}
