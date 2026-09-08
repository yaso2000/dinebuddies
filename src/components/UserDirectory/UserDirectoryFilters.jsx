import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FaMars, FaVenus, FaCamera } from 'react-icons/fa';
import { DATING_AGE_CATEGORIES } from '../../constants/datingProfile';

/**
 * Compact icon-toggle filters for the Connect member list:
 *  - Gender: two toggles ♂ ♀ (both on = All; at least one always on).
 *  - Age: one pill that cycles All → each category → back to All.
 *  - Photo: a camera icon; tap adds a "no" slash = show all (no photo filter).
 *  - Online: a small switch; on = only members online right now.
 * Age uses categories only (privacy: never an exact age).
 */
export default function UserDirectoryFilters({
  id,
  genderFilter,
  onGenderFilterChange,
  ageCategoryFilter = 'all',
  onAgeCategoryFilterChange,
  photoFilter = 'with_photo',
  onPhotoFilterChange,
  onlineOnly = false,
  onOnlineOnlyChange,
}) {
  const { t } = useTranslation();

  const ageOrder = useMemo(() => ['all', ...DATING_AGE_CATEGORIES.map((c) => c.id)], []);
  const ageLabels = useMemo(() => {
    const m = { all: t('user_directory_age_all', 'All ages') };
    DATING_AGE_CATEGORIES.forEach((c) => { m[c.id] = c.label; });
    return m;
  }, [t]);

  const maleOn = genderFilter === 'all' || genderFilter === 'male';
  const femaleOn = genderFilter === 'all' || genderFilter === 'female';
  const setGender = (m, f) => {
    if (!m && !f) return; // at least one gender stays on
    onGenderFilterChange(m && f ? 'all' : m ? 'male' : 'female');
  };

  const cycleAge = () => {
    const i = Math.max(0, ageOrder.indexOf(ageCategoryFilter));
    onAgeCategoryFilterChange(ageOrder[(i + 1) % ageOrder.length]);
  };

  const iconBtn = (active, activeColor) => ({
    width: '36px',
    height: '32px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '999px',
    cursor: 'pointer',
    fontSize: '1rem',
    padding: 0,
    background: active ? (activeColor || 'var(--primary)') : 'var(--bg-elevated, var(--bg-card))',
    color: active ? '#fff' : 'var(--text-muted)',
    border: `1px solid ${active ? (activeColor || 'var(--primary)') : 'var(--border-color)'}`,
    transition: 'all 0.15s',
  });

  return (
    <div
      id={id}
      className="users-directory-filters users-directory-filters--toolbar"
      role="group"
      aria-label={t('user_directory_filters_aria', 'Filters')}
      style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>

      {/* Gender: two independent toggles */}
      <div style={{ display: 'inline-flex', gap: '4px' }}>
        <button
          type="button"
          onClick={() => setGender(!maleOn, femaleOn)}
          aria-pressed={maleOn}
          aria-label={t('gender_male', 'Male')}
          title={t('gender_male', 'Male')}
          style={iconBtn(maleOn, '#3b82f6')}>
          <FaMars />
        </button>
        <button
          type="button"
          onClick={() => setGender(maleOn, !femaleOn)}
          aria-pressed={femaleOn}
          aria-label={t('gender_female', 'Female')}
          title={t('gender_female', 'Female')}
          style={iconBtn(femaleOn, '#ec4899')}>
          <FaVenus />
        </button>
      </div>

      {/* Age: single cycling pill */}
      {onAgeCategoryFilterChange && (
        <button
          type="button"
          onClick={cycleAge}
          aria-label={t('user_directory_age_filter_aria', 'Age category filter')}
          title={t('user_directory_age_filter_aria', 'Age category filter')}
          style={{
            height: '32px',
            padding: '0 14px',
            borderRadius: '999px',
            fontSize: '0.82rem',
            fontWeight: 700,
            cursor: 'pointer',
            background: ageCategoryFilter !== 'all' ? 'var(--primary)' : 'var(--bg-elevated, var(--bg-card))',
            color: ageCategoryFilter !== 'all' ? '#fff' : 'var(--text-main)',
            border: `1px solid ${ageCategoryFilter !== 'all' ? 'var(--primary)' : 'var(--border-color)'}`,
          }}>
          {ageLabels[ageCategoryFilter] || ageLabels.all}
        </button>
      )}

      {/* Photo: camera icon; slashed = show all (no photo filter) */}
      {onPhotoFilterChange && (
        <button
          type="button"
          onClick={() => onPhotoFilterChange(photoFilter === 'with_photo' ? 'all' : 'with_photo')}
          aria-pressed={photoFilter === 'with_photo'}
          aria-label={t('user_directory_photo_filter_aria', 'Show only profiles with a photo')}
          title={t('user_directory_photo_filter_aria', 'Show only profiles with a photo')}
          style={iconBtn(photoFilter === 'with_photo')}>
          <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <FaCamera />
            {photoFilter !== 'with_photo' && (
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  left: '-3px',
                  right: '-3px',
                  top: '50%',
                  height: '2px',
                  background: '#ef4444',
                  transform: 'rotate(-45deg)',
                  borderRadius: '2px',
                  boxShadow: '0 0 0 1px rgba(0,0,0,0.15)',
                }}
              />
            )}
          </span>
        </button>
      )}

      {/* Online now: switch */}
      {onOnlineOnlyChange && (
        <button
          type="button"
          role="switch"
          aria-checked={onlineOnly}
          onClick={() => onOnlineOnlyChange(!onlineOnly)}
          aria-label={t('user_directory_online_filter_aria', 'Show only members online now')}
          title={t('user_directory_online_filter_aria', 'Show only members online now')}
          style={{
            height: '32px',
            padding: '0 6px',
            borderRadius: '999px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0',
            cursor: 'pointer',
            fontSize: '0.78rem',
            fontWeight: 700,
            background: onlineOnly ? 'rgba(34, 197, 94, 0.14)' : 'var(--bg-elevated, var(--bg-card))',
            color: onlineOnly ? '#16a34a' : 'var(--text-muted)',
            border: `1px solid ${onlineOnly ? '#22c55e' : 'var(--border-color)'}`,
            transition: 'all 0.15s',
          }}>
          <span
            aria-hidden
            style={{
              position: 'relative',
              width: '30px',
              height: '18px',
              borderRadius: '999px',
              background: onlineOnly ? '#22c55e' : 'var(--border-color)',
              transition: 'background 0.15s',
              flexShrink: 0,
            }}>
            <span
              style={{
                position: 'absolute',
                top: '2px',
                left: onlineOnly ? '14px' : '2px',
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                background: '#fff',
                boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
                transition: 'left 0.15s',
              }}
            />
          </span>
        </button>
      )}
    </div>
  );
}
