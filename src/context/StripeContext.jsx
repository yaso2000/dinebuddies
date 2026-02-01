import React, { createContext, useContext } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';

const StripeContext = createContext();

// تحميل Stripe بالـ Publishable Key
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

export const StripeProvider = ({ children }) => {
    return (
        <Elements stripe={stripePromise}>
            <StripeContext.Provider value={{}}>
                {children}
            </StripeContext.Provider>
        </Elements>
    );
};

export const useStripe = () => useContext(StripeContext);
