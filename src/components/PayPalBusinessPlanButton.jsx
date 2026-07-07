import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PayPalButtons } from '@paypal/react-paypal-js';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../firebase/config';
import { useToast } from '../context/ToastContext';

const FUNCTIONS_REGION = 'us-central1';

export default function PayPalBusinessPlanButton({ disabled = false, onSuccess }) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

  return (
    <div style={{ width: '100%', opacity: disabled ? 0.7 : 1 }}>
      <PayPalButtons
        disabled={disabled || busy}
        forceReRender={[disabled]}
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
              'createPayPalBusinessPlanOrder'
            );
            const result = await fn({ planId: 'paid' });
            const orderId = result.data?.orderId;
            if (!orderId) {
              throw new Error(
                t('paypal_order_create_missing', 'PayPal did not return an order id.')
              );
            }
            return orderId;
          } catch (error) {
            console.error('[PayPalBusinessPlanButton/createOrder]', error);
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
          try {
            const fn = httpsCallable(
              getFunctions(app, FUNCTIONS_REGION),
              'capturePayPalBusinessPlanOrder'
            );
            const orderId = data?.orderID || data?.orderId;
            await fn({ orderId });
            showToast(
              t('biz_plan_paypal_upgraded', 'Paid Business plan activated via PayPal.'),
              'success'
            );
            onSuccess?.();
          } catch (error) {
            console.error('[PayPalBusinessPlanButton/onApprove]', error);
            showToast(
              error?.message ||
                t('paypal_capture_failed', 'PayPal payment was approved but capture failed.'),
              'error'
            );
            throw error;
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
          console.error('[PayPalBusinessPlanButton/onError]', error);
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
