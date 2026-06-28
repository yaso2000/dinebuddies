import React, { useEffect } from 'react';
import { FaExclamationTriangle } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { AppText } from './base';
import './PersistentWarningModal.css';

export default function PersistentWarningModal({ title, message, onDismiss }) {
  const { t } = useTranslation();

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onDismiss?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onDismiss]);

  return (
    <div
      className="persistent-warning"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="persistent-warning-title"
      aria-describedby="persistent-warning-message"
      onClick={onDismiss}
    >
      <div
        className="persistent-warning__card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="persistent-warning__icon-wrap" aria-hidden>
          <FaExclamationTriangle />
        </div>
        {title ? (
          <AppText as="h2" id="persistent-warning-title" className="persistent-warning__title">
            {title}
          </AppText>
        ) : null}
        <AppText as="p" id="persistent-warning-message" className="persistent-warning__message">
          {message}
        </AppText>
        <button
          type="button"
          className="persistent-warning__dismiss"
          onClick={onDismiss}
          autoFocus
        >
          {t('connection_cooldown_dismiss', 'Got it')}
        </button>
      </div>
    </div>
  );
}
