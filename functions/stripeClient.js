'use strict';

/**
 * Lazy Stripe client so `process.env.STRIPE_SECRET_KEY` is read after `dotenv` / Cloud runtime env is ready.
 */
let stripeSingleton = null;

/** @returns {import('stripe').Stripe} */
function getStripe() {
    const key = String(process.env.STRIPE_SECRET_KEY || '').trim();
    if (!key) {
        const err = new Error(
            'STRIPE_SECRET_KEY is missing. Set STRIPE_SECRET_KEY in functions/.env then run: firebase deploy --only functions'
        );
        err.code = 'STRIPE_NOT_CONFIGURED';
        throw err;
    }
    if (!stripeSingleton) {
        stripeSingleton = require('stripe')(key);
    }
    return stripeSingleton;
}

module.exports = { getStripe };
