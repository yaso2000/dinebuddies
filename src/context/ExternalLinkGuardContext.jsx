import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaExclamationTriangle } from 'react-icons/fa';
import { AppText } from '../components/base';
import { useToast } from './ToastContext';
import { classifyChatLink } from '../utils/chatLinkSafety';
import './ExternalLinkGuard.css';

const ExternalLinkGuardContext = createContext(null);

function ExternalLinkConfirmDialog({ open, url, onStay, onLeave }) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onStay?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onStay]);

  if (!open) return null;

  return (
    <div
      className="external-link-guard"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="external-link-guard-title"
      aria-describedby="external-link-guard-message"
      onClick={onStay}
    >
      <div className="external-link-guard__card" onClick={(event) => event.stopPropagation()}>
        <div className="external-link-guard__icon" aria-hidden>
          <FaExclamationTriangle />
        </div>
        <AppText as="h2" id="external-link-guard-title" className="external-link-guard__title">
          {t('external_link_leave_title', 'You are leaving DineBuddies')}
        </AppText>
        <AppText as="p" id="external-link-guard-message" className="external-link-guard__message">
          {t(
            'external_link_leave_message',
            'This link opens outside the app. Only continue if you trust the sender and the destination.'
          )}
        </AppText>
        {url ? (
          <AppText as="p" className="external-link-guard__url" dir="ltr">
            {url}
          </AppText>
        ) : null}
        <div className="external-link-guard__actions">
          <button type="button" className="external-link-guard__btn external-link-guard__btn--stay" onClick={onStay} autoFocus>
            {t('external_link_stay', 'Stay in app')}
          </button>
          <button type="button" className="external-link-guard__btn external-link-guard__btn--leave" onClick={onLeave}>
            {t('external_link_continue', 'Open link')}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ExternalLinkGuardProvider({ children }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [pendingHref, setPendingHref] = useState(null);

  const openExternal = useCallback((href) => {
    if (!href || typeof window === 'undefined') return;
    window.open(href, '_blank', 'noopener,noreferrer');
  }, []);

  const requestOpenLink = useCallback(
    (rawUrl) => {
      const info = classifyChatLink(rawUrl);
      if (!info) return { handled: false };

      if (info.kind === 'blocked') {
        showToast?.(
          t(
            'external_link_blocked',
            'This link was blocked for safety (unsafe or hidden destination).'
          ),
          'error'
        );
        return { handled: true, kind: 'blocked' };
      }

      if (info.kind === 'internal') {
        navigate(info.href);
        return { handled: true, kind: 'internal' };
      }

      setPendingHref(info.href);
      return { handled: true, kind: 'external' };
    },
    [navigate, showToast, t]
  );

  const stay = useCallback(() => setPendingHref(null), []);
  const leave = useCallback(() => {
    const href = pendingHref;
    setPendingHref(null);
    openExternal(href);
  }, [openExternal, pendingHref]);

  const value = useMemo(() => ({ requestOpenLink }), [requestOpenLink]);

  return (
    <ExternalLinkGuardContext.Provider value={value}>
      {children}
      <ExternalLinkConfirmDialog open={Boolean(pendingHref)} url={pendingHref} onStay={stay} onLeave={leave} />
    </ExternalLinkGuardContext.Provider>
  );
}

export function useExternalLinkGuard() {
  const ctx = useContext(ExternalLinkGuardContext);
  if (!ctx) {
    return {
      requestOpenLink: (rawUrl) => {
        const info = classifyChatLink(rawUrl);
        if (!info || info.kind === 'blocked') return { handled: true, kind: 'blocked' };
        if (info.kind === 'internal' && typeof window !== 'undefined') {
          window.location.assign(info.href);
          return { handled: true, kind: 'internal' };
        }
        if (typeof window !== 'undefined' && info.href) {
          window.open(info.href, '_blank', 'noopener,noreferrer');
        }
        return { handled: true, kind: info.kind };
      },
    };
  }
  return ctx;
}
