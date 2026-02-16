import React, { createContext, useContext, useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';

const StripeContext = createContext();

// Initialize Stripe outside of component to avoid recreation on re-renders
const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
// Only create promise if key exists
const stripePromise = stripeKey ? loadStripe(stripeKey) : null;

if (!stripeKey) {
    console.warn('⚠️ Stripe Publishable Key is missing in environment variables (VITE_STRIPE_PUBLISHABLE_KEY). Payments will not work.');
}

export const StripeProvider = ({ children }) => {
    // We can add more context values/state here if needed (e.g., payment intent status)

    // If stripe is not configured, just render children without Elements provider 
    // (or with a dummy provider to avoid crashes if components expect useStripe)
    if (!stripePromise) {
        return (
            <StripeContext.Provider value={{ stripeConfigured: false }}>
                {children}
            </StripeContext.Provider>
        );
    }

    return (
        <StripeContext.Provider value={{ stripeConfigured: true }}>
            <Elements stripe={stripePromise}>
                {children}
            </Elements>
        </StripeContext.Provider>
    );
};

export const useStripeContext = () => useContext(StripeContext);
