import React from 'react';
import { usePayPalScriptReducer } from '@paypal/react-paypal-js';
import { useTranslation } from 'react-i18next';
import { AppText } from './base';

/**
 * Shows PayPal SDK load status. Children (packs / restore) always render.
 * Individual buttons should also no-op until the SDK is resolved.
 */
export default function PayPalScriptStatus() {
  const { t } = useTranslation();
  const [{ isPending, isRejected, isResolved }] = usePayPalScriptReducer();

  if (isRejected) {
    return (
      <AppText
        as="p"
        style={{
          marginBottom: 14,
          padding: '12px 14px',
          borderRadius: 12,
          border: '1px solid rgba(220, 38, 38, 0.28)',
          background: 'rgba(220, 38, 38, 0.08)',
          color: 'var(--text-secondary)',
          fontSize: '0.92rem',
          fontWeight: 600,
        }}>
        {t(
          'paypal_sdk_load_failed',
          'PayPal failed to load. Update VITE_PAYPAL_CLIENT_ID (Vercel) and PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET (functions/.env) for the new Live PayPal app, then redeploy.'
        )}
      </AppText>
    );
  }

  if (isPending || !isResolved) {
    return (
      <AppText
        as="p"
        style={{
          marginBottom: 10,
          color: 'var(--text-secondary)',
          fontSize: '0.9rem',
          fontWeight: 600,
        }}>
        {t('paypal_sdk_loading', 'Loading PayPal…')}
      </AppText>
    );
  }

  return null;
}

/** Render children only after PayPal JS SDK is ready (avoids Buttons undefined crash). */
export function PayPalReady({ children, fallback = null }) {
  const [{ isResolved, isRejected }] = usePayPalScriptReducer();
  if (isRejected || !isResolved) return fallback;
  return children;
}
