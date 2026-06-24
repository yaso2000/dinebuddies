import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Unified loading shell for route lazy-load, auth/session wait, and profile hydrate.
 */import { AppText } from "./base";
export default function AppRouteLoading({ variant = 'route', fullViewport = false }) {
  const { t } = useTranslation();
  const title =
  variant === 'session' ?
  t('loading_app_session', 'Preparing your session…') :
  variant === 'profile' ?
  t('loading_app_profile', 'Syncing your profile…') :
  t('loading_app_route', 'Loading…');

  const className = [
  'app-route-loading',
  fullViewport ? 'app-route-loading--viewport' : 'app-route-loading--inline'].
  join(' ');

  return (
    <div role="status" aria-busy="true" aria-live="polite" className={className}>
            <div className="app-route-loading__spinner" />
            <AppText as="p" className="app-route-loading__label">{title}</AppText>
        </div>);

}