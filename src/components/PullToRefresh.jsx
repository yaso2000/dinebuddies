import React from 'react';
import { useTranslation } from 'react-i18next';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { AppText } from './base';
import './PullToRefresh.css';

export default function PullToRefresh({
  onRefresh,
  disabled = false,
  className = '',
  children,
}) {
  const { t } = useTranslation();
  const { pageRef, pull, progress, refreshing } = usePullToRefresh({
    onRefresh,
    disabled,
  });

  const showIndicator = refreshing || progress > 0.08;
  const indicatorTop = Math.max(8, pull - 36);

  return (
    <div
      ref={pageRef}
      className={`pull-to-refresh-page${className ? ` ${className}` : ''}`}>
      <div
        className={`pull-to-refresh-page__indicator${showIndicator ? ' pull-to-refresh-page__indicator--visible' : ''}`}
        style={{ top: indicatorTop }}
        aria-hidden={!showIndicator}>
        <span
          className={`pull-to-refresh-page__spinner${refreshing ? ' pull-to-refresh-page__spinner--spin' : ''}`}
          style={!refreshing ? { transform: `rotate(${progress * 320}deg)` } : undefined}
        />
        <AppText as="span" format={false}>
          {refreshing
            ? t('pull_to_refresh_updating', 'Updating…')
            : progress >= 1
              ? t('pull_to_refresh_release', 'Release to refresh')
              : t('pull_to_refresh_pull', 'Pull to refresh')}
        </AppText>
      </div>
      <div
        className="pull-to-refresh-page__content"
        style={{
          transform: pull > 0 ? `translateY(${pull}px)` : undefined,
          transition: pullingTransition(pull, refreshing),
        }}>
        {children}
      </div>
    </div>
  );
}

function pullingTransition(pull, refreshing) {
  if (refreshing || pull > 0) return 'none';
  return 'transform 0.22s ease';
}
