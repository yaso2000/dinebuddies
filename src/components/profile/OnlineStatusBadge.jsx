import React from 'react';
import { useTranslation } from 'react-i18next';
import { AppText } from '../base';
import './OnlineStatusBadge.css';

export default function OnlineStatusBadge({
  isOnline = false,
  className = '',
  size = 'md',
  showLabel = true,
}) {
  const { t } = useTranslation();

  if (!isOnline) return null;

  const sizeClass = size === 'sm' ? ' online-status-badge--sm' : '';

  return (
    <span
      className={`online-status-badge${sizeClass}${className ? ` ${className}` : ''}${showLabel ? '' : ' online-status-badge--dot-only'}`}
      role="status"
      aria-label={t('status_online', 'Online')}>
      <span className="online-status-badge__dot" aria-hidden />
      {showLabel ? (
        <AppText as="span" format={false}>
          {t('status_online', 'Online')}
        </AppText>
      ) : null}
    </span>
  );
}
