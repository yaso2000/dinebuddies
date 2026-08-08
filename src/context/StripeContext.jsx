import React, { createContext, useContext } from 'react';
import { loadStripe } from '@stripe/stripe-js';

const StripeContext = createContext();

const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const stripePromise = stripeKey ? loadStripe(stripeKey) : null;

/**
 * Provides stripePromise for checkout flows. Intentionally does NOT wrap the app in
 * @stripe/react-stripe-js <Elements> — that injected Stripe iframes on every route (including /login)
 * and nothing in the app currently uses Elements hooks at the root.
 */
export const StripeProvider = ({ children }) => (
    <StripeContext.Provider value={{ stripeConfigured: !!stripePromise, stripePromise }}>
        {children}
    </StripeContext.Provider>
);

export const useStripeContext = () => useContext(StripeContext);
