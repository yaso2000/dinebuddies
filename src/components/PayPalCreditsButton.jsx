import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PayPalButtons } from '@paypal/react-paypal-js';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../firebase/config';
import { useToast } from '../context/ToastContext';

const FUNCTIONS_REGION = 'us-central1';

export default function PayPalCreditsButton({ pack, disabled = false }) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

  return (
    <div style={{ width: '100%', opacity: disabled ? 0.7 : 1 }}>
      <PayPalButtons
        disabled={disabled || busy}
        forceReRender={[pack.id, disabled]}
        style={{
          layout: 'vertical',
          shape: 'pill',
          label: 'paypal',
          height: 42,
          color: 'gold',
        }}
        createOrder={async () => {
          setBusy(true);
          try {
            const fn = httpsCallable(
              getFunctions(app, FUNCTIONS_REGION),
              'createPayPalCreditsOrder'
            );
            const result = await fn({ packageId: pack.id });
            const orderId = result.data?.orderId;
            if (!orderId) {
              throw new Error(
                t('paypal_order_create_missing', 'PayPal did not return an order id.')
              );
            }
            return orderId;
          } catch (error) {
            console.error('[PayPalCreditsButton/createOrder]', error);
            showToast(
              error?.message ||
                t('paypal_checkout_start_failed', 'Could not start PayPal checkout.'),
              'error'
            );
            setBusy(false);
            throw error;
          }
        }}
        onApprove={async (data) => {
          const orderId = data?.orderID || data?.orderId;
          try {
            const fn = httpsCallable(
              getFunctions(app, FUNCTIONS_REGION),
              'capturePayPalCreditsOrder'
            );
            const result = await fn({ orderId });
            const credits = Number(result.data?.credits || pack.credits || 0);
            showToast(
              t('paypal_credits_added', '{{count}} credits added to your wallet.', {
                count: credits,
              }),
              'success'
            );
          } catch (error) {
            console.error('[PayPalCreditsButton/onApprove]', error);
            try {
              const reconcile = httpsCallable(
                getFunctions(app, FUNCTIONS_REGION),
                'reconcilePayPalCreditsOrder'
              );
              const recovered = await reconcile({ orderId });
              const credits = Number(recovered.data?.credits || pack.credits || 0);
              showToast(
                t('paypal_credits_added', '{{count}} credits added to your wallet.', {
                  count: credits,
                }),
                'success'
              );
            } catch (recoverError) {
              console.error('[PayPalCreditsButton/reconcile]', recoverError);
              showToast(
                recoverError?.message ||
                  error?.message ||
                  t(
                    'paypal_capture_failed',
                    'PayPal payment was approved but credits were not added. Contact support with your PayPal receipt.'
                  ),
                'error'
              );
              throw recoverError;
            }
          } finally {
            setBusy(false);
          }
        }}
        onCancel={() => {
          setBusy(false);
          showToast(
            t('paypal_checkout_cancelled', 'PayPal checkout was cancelled.'),
            'info'
          );
        }}
        onError={(error) => {
          console.error('[PayPalCreditsButton/onError]', error);
          setBusy(false);
          showToast(
            t('paypal_checkout_error', 'Something went wrong with PayPal checkout.'),
            'error'
          );
        }}
      />
    </div>
  );
}
