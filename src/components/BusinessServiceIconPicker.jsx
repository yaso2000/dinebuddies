import React from 'react';
import { useTranslation } from 'react-i18next';
import { SERVICE_ICONS } from './ServiceModal';
import { AppTextInput } from './base';

/**
 * Emoji icon grid for business service/menu items (non-restaurant listings).
 */
export default function BusinessServiceIconPicker({
  value = '⚙️',
  onChange,
  search = '',
  onSearchChange,
  compact = false
}) {
  const { t } = useTranslation();
  const filtered = search.trim() ?
  SERVICE_ICONS.filter((s) => s.label.toLowerCase().includes(search.trim().toLowerCase())) :
  SERVICE_ICONS;

  return (
    <div className={`business-service-icon-picker${compact ? ' business-service-icon-picker--compact' : ''}`}>
      <div className="business-service-icon-picker__preview" aria-hidden>
        {value || '⚙️'}
      </div>
      <AppTextInput
        type="text"
        className="business-service-icon-picker__search"
        value={search}
        onChange={(e) => onSearchChange?.(e.target.value)}
        placeholder={t('search_icons', 'Search icons...')} />

      <div className="business-service-icon-picker__grid" role="listbox" aria-label={t('choose_service_icon', 'Choose icon')}>
        {filtered.map((s) =>
        <button
          key={`${s.icon}-${s.label}`}
          type="button"
          role="option"
          aria-selected={value === s.icon}
          title={s.label}
          className={`business-service-icon-picker__btn${value === s.icon ? ' business-service-icon-picker__btn--selected' : ''}`}
          onClick={() => onChange?.(s.icon)}>

            {s.icon}
          </button>
        )}
      </div>
    </div>);

}
