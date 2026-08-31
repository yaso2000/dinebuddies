import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DATING_AGE_CATEGORIES } from '../../constants/datingProfile';
import { AppText } from '../base';

/**
 * Gender + age-category filter chips for the Connect member card list — always
 * visible in the toolbar. Age uses categories only (privacy: never an exact age).
 */
export default function UserDirectoryFilters({
  id,
  genderFilter,
  onGenderFilterChange,
  ageCategoryFilter = 'all',
  onAgeCategoryFilterChange,
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

  const ageFilters = useMemo(
    () => [{ id: 'all', label: t('filter_all', 'All') }, ...DATING_AGE_CATEGORIES],
    [t]
  );

  return (
    <div
      id={id}
      className="users-directory-filters users-directory-filters--toolbar"
      role="group"
      aria-label={t('user_directory_gender_filter_aria', 'Gender filter')}
      style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
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

      {onAgeCategoryFilterChange && (
        <select
          className={`users-directory-age-select${ageCategoryFilter !== 'all' ? ' users-directory-age-select--active' : ''}`}
          value={ageCategoryFilter}
          onChange={(e) => onAgeCategoryFilterChange(e.target.value)}
          aria-label={t('user_directory_age_filter_aria', 'Age category filter')}
          style={{
            padding: '6px 8px', borderRadius: '999px', fontSize: '0.82rem', fontWeight: 600,
            cursor: 'pointer', background: ageCategoryFilter !== 'all' ? 'var(--primary)' : 'var(--bg-elevated, var(--bg-card))',
            color: ageCategoryFilter !== 'all' ? '#fff' : 'var(--text-main)',
            border: '1px solid var(--border-color)', minWidth: '84px', height: '30px',
          }}>
          {ageFilters.map((f) => (
            <option key={f.id} value={f.id}>
              {f.id === 'all' ? t('user_directory_age_all', 'All ages') : f.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
