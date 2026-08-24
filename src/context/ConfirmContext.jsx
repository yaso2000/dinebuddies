import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { AppText } from '../components/base';
import '../components/ConfirmDialog.css';

const ConfirmContext = createContext(null);

/**
 * Promise-based replacement for window.confirm, so destructive actions ask in
 * the app's own chrome instead of a browser dialog that ignores theme, language
 * direction, and — inside the Capacitor webview — looks nothing like the app.
 *
 * @returns {(options?: {
 *   title?: string,
 *   message?: string,
 *   confirmLabel?: string,
 *   cancelLabel?: string,
 *   tone?: 'danger' | 'default',
 * }) => Promise<boolean>}
 */
export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
}

function ConfirmDialog({ request, onResolve }) {
  const { t } = useTranslation();
  const confirmRef = useRef(null);

  useEffect(() => {
    // Focus the confirming button so Enter works, but never auto-fire it.
    confirmRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onResolve(false);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onResolve]);

  // Opt in to the destructive styling — a neutral question should not look alarming.
  const isDanger = request.tone === 'danger';

  return createPortal(
    <div
      className="confirm-dialog-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onResolve(false);
      }}
    >
      <div
        className={`confirm-dialog${isDanger ? ' confirm-dialog--danger' : ''}`}
        role="alertdialog"
        aria-modal="true"
        aria-label={request.title || t('confirm_action_title', 'Are you sure?')}
      >
        <div className="confirm-dialog__icon" aria-hidden>
          {isDanger ? '⚠️' : '❓'}
        </div>
        <AppText as="h3" className="confirm-dialog__title">
          {request.title || t('confirm_action_title', 'Are you sure?')}
        </AppText>
        {request.message ? (
          <AppText as="p" className="confirm-dialog__message" dir="auto">
            {request.message}
          </AppText>
        ) : null}
        <div className="confirm-dialog__actions">
          <button
            type="button"
            className="confirm-dialog__btn"
            onClick={() => onResolve(false)}
          >
            {request.cancelLabel || t('cancel', 'Cancel')}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className="confirm-dialog__btn confirm-dialog__btn--confirm"
            onClick={() => onResolve(true)}
          >
            {request.confirmLabel || t('confirm', 'Confirm')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null);
  const resolverRef = useRef(null);

  const confirm = useCallback((options = {}) => {
    // A second request while one is open would strand the first promise.
    if (resolverRef.current) resolverRef.current(false);
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setRequest(typeof options === 'string' ? { message: options } : options);
    });
  }, []);

  const resolve = useCallback((value) => {
    const resolver = resolverRef.current;
    resolverRef.current = null;
    setRequest(null);
    resolver?.(value);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {request ? <ConfirmDialog request={request} onResolve={resolve} /> : null}
    </ConfirmContext.Provider>
  );
}
