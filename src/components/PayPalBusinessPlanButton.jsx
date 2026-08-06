import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PayPalButtons } from '@paypal/react-paypal-js';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../firebase/config';
import { useToast } from '../context/ToastContext';
import { PAYPAL_CURRENCY, PAYPAL_MODE } from '../config/paypalCommerce';
import { paypalCallableErrorMessage } from '../utils/paypalCallableError';
import { PayPalReady } from './PayPalScriptGate';

const FUNCTIONS_REGION = 'us-central1';

export default function PayPalBusinessPlanButton({ disabled = false, onSuccess }) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const createOrderFailedRef = useRef(false);

  return (
    <PayPalReady fallback={<div style={{ width: '100%', minHeight: 45 }} aria-hidden />}>
    <div style={{ width: '100%', opacity: disabled ? 0.7 : 1 }}>
      <PayPalButtons
        // Do not set fundingSource — if that source is ineligible PayPal renders nothing.
        disabled={disabled || busy}
        forceReRender={[disabled, PAYPAL_CURRENCY]}
        style={{
          layout: 'vertical',
          shape: 'rect',
          label: 'paypal',
          height: 45,
          color: 'gold',
          tagline: false,
        }}
        createOrder={async () => {
          setBusy(true);
          createOrderFailedRef.current = false;
          try {
            const fn = httpsCallable(
              getFunctions(app, FUNCTIONS_REGION),
              'createPayPalBusinessPlanOrder'
            );
            const result = await fn({
              planId: 'paid',
              clientMode: PAYPAL_MODE,
              currency: PAYPAL_CURRENCY,
            });
            const orderId = result.data?.orderId;
            if (!orderId) {
              throw new Error(
                t('paypal_order_create_missing', 'PayPal did not return an order id.')
              );
            }
            return orderId;
          } catch (error) {
            createOrderFailedRef.current = true;
            console.error('[PayPalBusinessPlanButton/createOrder]', error);
            showToast(
              paypalCallableErrorMessage(
                error,
                t('paypal_checkout_start_failed', 'Could not start PayPal checkout.')
              ),
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
            await fn({ orderId, clientMode: PAYPAL_MODE });
            showToast(
              t('biz_plan_paypal_upgraded', 'Paid Business plan activated via PayPal.'),
              'success'
            );
            onSuccess?.();
          } catch (error) {
            console.error('[PayPalBusinessPlanButton/onApprove]', error);
            showToast(
              paypalCallableErrorMessage(
                error,
                t('paypal_capture_failed', 'PayPal payment was approved but capture failed.')
              ),
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
          if (createOrderFailedRef.current) {
            createOrderFailedRef.current = false;
            return;
          }
          showToast(
            t('paypal_checkout_error', 'Something went wrong with PayPal checkout.'),
            'error'
          );
        }}
      />
    </div>
    </PayPalReady>
  );
}
