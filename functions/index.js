const admin = require('firebase-admin');
admin.initializeApp();

const stripeModule = require('./stripe');
const webhookModule = require('./webhook');

// تصدير Stripe Functions
exports.createCheckoutSession = stripeModule.createCheckoutSession;
exports.createPortalSession = stripeModule.createPortalSession;

// تصدير Webhook Handler
exports.stripeWebhook = webhookModule.stripeWebhook;
