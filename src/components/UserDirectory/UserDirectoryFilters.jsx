import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DATING_AGE_CATEGORIES } from '../../constants/datingProfile';

/**
 * Compact filter dropdowns for the Connect member list — gender, age category,
 * and photo, each a small pill <select>. Age uses categories only (privacy:
 * never an exact age).
 */
export default function UserDirectoryFilters({
  id,
  genderFilter,
  onGenderFilterChange,
  ageCategoryFilter = 'all',
  onAgeCategoryFilterChange,
  photoFilter = 'with_photo',
  onPhotoFilterChange,
}) {
  const { t } = useTranslation();

  const genderOptions = useMemo(
    () => [
      { id: 'all', label: t('filter_all', 'All') },
      { id: 'male', label: t('gender_male', 'Male') },
      { id: 'female', label: t('gender_female', 'Female') },
    ],
    [t]
  );

  const ageOptions = useMemo(
    () => [{ id: 'all', label: t('user_directory_age_all', 'All ages') }, ...DATING_AGE_CATEGORIES],
    [t]
  );

  const pill = (active) => ({
    padding: '6px 10px',
    borderRadius: '999px',
    fontSize: '0.82rem',
    fontWeight: 600,
    height: '30px',
    cursor: 'pointer',
    background: active ? 'var(--primary)' : 'var(--bg-elevated, var(--bg-card))',
    color: active ? '#fff' : 'var(--text-main)',
    border: '1px solid var(--border-color)',
  });

  return (
    <div
      id={id}
      className="users-directory-filters users-directory-filters--toolbar"
      role="group"
      aria-label={t('user_directory_filters_aria', 'Filters')}
      style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>

      <select
        className="users-directory-filter-select"
        value={genderFilter}
        onChange={(e) => onGenderFilterChange(e.target.value)}
        aria-label={t('user_directory_gender_filter_aria', 'Gender filter')}
        style={pill(genderFilter && genderFilter !== 'all')}>
        {genderOptions.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>

      {onAgeCategoryFilterChange && (
        <select
          className="users-directory-filter-select users-directory-age-select"
          value={ageCategoryFilter}
          onChange={(e) => onAgeCategoryFilterChange(e.target.value)}
          aria-label={t('user_directory_age_filter_aria', 'Age category filter')}
          style={pill(ageCategoryFilter !== 'all')}>
          {ageOptions.map((f) => (
            <option key={f.id} value={f.id}>{f.label}</option>
          ))}
        </select>
      )}

      {onPhotoFilterChange && (
        <select
          className="users-directory-filter-select"
          value={photoFilter}
          onChange={(e) => onPhotoFilterChange(e.target.value)}
          aria-label={t('user_directory_photo_filter_aria', 'Show only profiles with a photo')}
          style={pill(photoFilter === 'with_photo')}>
          <option value="with_photo">📷 {t('filter_with_photo', 'With photo')}</option>
          <option value="all">{t('filter_all', 'All')}</option>
        </select>
      )}
    </div>
  );
}
