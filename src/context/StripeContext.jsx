import React, { createContext, useContext } from 'react';

const StripeContext = createContext();

// Temporary: Stripe disabled until package is installed
// const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
// const stripePromise = stripeKey ? loadStripe(stripeKey) : Promise.resolve(null);

export const StripeProvider = ({ children }) => {
    return (
        <StripeContext.Provider value={{}}>
            {children}
        </StripeContext.Provider>
    );
};

export const useStripe = () => useContext(StripeContext);
