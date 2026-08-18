/**
 * Apple App Store Server API — server-side verify + grant, mirrors functions/googlePlayBilling.js.
 *
 * Requires an App Store Server API key (Key ID + Issuer ID + .p8 private key) generated
 * in App Store Connect → Users and Access → Integrations, and Apple's Root CA .cer files
 * on disk (see docs/APP_STORE_IOS.md). Env: APPLE_IAP_KEY_ID, APPLE_IAP_ISSUER_ID,
 * APPLE_IAP_PRIVATE_KEY_BASE64, APPLE_IAP_BUNDLE_ID, APPLE_IAP_ROOT_CERT_PATHS,
 * APPLE_IAP_APP_APPLE_ID (App Store Connect numeric app id, production only),
 * APPLE_IAP_MODE ('sandbox' | 'production', default inferred from NODE_ENV).
 */
const fs = require('fs');
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const {
    SignedDataVerifier,
    AppStoreServerAPIClient,
    Environment,
} = require('@apple/app-store-server-library');
const {
    grantPaidCreditsInTransaction,
    isBusinessUserDoc,
    CREDIT_PACKAGES,
} = require('./creditsCore');
const {
    resolveAppleBundleId,
    resolvePackageFromAppleProductId,
    isAppleBusinessSubscriptionProduct,
} = require('./appStoreCatalog');
const {
    hasAppleIapKey,
    resolveAppleIapPrivateKey,
    resolveAppleRootCertPaths,
    appleCommerceStatus,
} = require('./appStoreEnv');

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

function resolveAppleEnvironment() {
    const mode = String(process.env.APPLE_IAP_MODE || '').trim().toLowerCase();
    if (mode === 'production') return Environment.PRODUCTION;
    if (mode === 'sandbox') return Environment.SANDBOX;
    // No explicit mode set — default to Sandbox until the app is live on the Store,
    // matching how STRIPE_MODE / PAYPAL_MODE default to test-like behavior.
    return Environment.SANDBOX;
}

/** @type {SignedDataVerifier | null} */
let verifierCache = null;
let verifierCacheEnv = null;

function getSignedDataVerifier() {
    const environment = resolveAppleEnvironment();
    if (verifierCache && verifierCacheEnv === environment) return verifierCache;

    const certPaths = resolveAppleRootCertPaths();
    if (certPaths.length === 0) {
        throw new functions.https.HttpsError(
            'failed-precondition',
            'Apple root certificates are not configured (APPLE_IAP_ROOT_CERT_PATHS).'
        );
    }

    const rootCAs = certPaths.map((p) => fs.readFileSync(p));
    const bundleId = resolveAppleBundleId();
    const appAppleId = process.env.APPLE_IAP_APP_APPLE_ID
        ? Number(process.env.APPLE_IAP_APP_APPLE_ID)
        : undefined;

    verifierCache = new SignedDataVerifier(rootCAs, true, environment, bundleId, appAppleId);
    verifierCacheEnv = environment;
    return verifierCache;
}

/** @type {AppStoreServerAPIClient | null} */
let apiClientCache = null;
let apiClientCacheEnv = null;

function getAppStoreServerApiClient() {
    const environment = resolveAppleEnvironment();
    if (apiClientCache && apiClientCacheEnv === environment) return apiClientCache;

    if (!hasAppleIapKey()) {
        throw new functions.https.HttpsError(
            'failed-precondition',
            'Apple App Store Server API key is not configured.'
        );
    }

    const encodedKey = resolveAppleIapPrivateKey();
    if (!encodedKey) {
        throw new functions.https.HttpsError('failed-precondition', 'APPLE_IAP_PRIVATE_KEY_BASE64 is invalid.');
    }

    apiClientCache = new AppStoreServerAPIClient(
        encodedKey,
        String(process.env.APPLE_IAP_KEY_ID).trim(),
        String(process.env.APPLE_IAP_ISSUER_ID).trim(),
        resolveAppleBundleId(),
        environment
    );
    apiClientCacheEnv = environment;
    return apiClientCache;
}

/**
 * Decode + cryptographically verify a StoreKit 2 signed transaction (JWS) the client
 * received directly from `Transaction.jwsRepresentation` after a successful purchase.
 */
async function decodeVerifiedTransaction(signedTransactionInfo) {
    const verifier = getSignedDataVerifier();
    try {
        return await verifier.verifyAndDecodeTransaction(signedTransactionInfo);
    } catch (err) {
        console.error('[appStoreBilling] transaction verification failed', err?.message || err);
        throw new functions.https.HttpsError('failed-precondition', 'Could not verify Apple transaction.');
    }
}

function fulfillmentDocId(transactionId) {
    return String(transactionId || '').trim().slice(0, 400);
}

/**
 * Callable — iOS app sends the signed transaction after StoreKit's purchase completes.
 * Grants credits once, idempotent per transaction id.
 */
exports.verifyAppleCreditsPurchase = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Sign in required');
    }

    const productId = String(data?.productId || '').trim();
    const signedTransactionInfo = String(data?.signedTransactionInfo || '').trim();
    const packageDef = resolvePackageFromAppleProductId(productId);

    if (!productId || !signedTransactionInfo) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'productId and signedTransactionInfo are required'
        );
    }

    if (!packageDef || !CREDIT_PACKAGES[packageDef.packageId]) {
        throw new functions.https.HttpsError('invalid-argument', 'Unknown Apple credit product');
    }

    const decoded = await decodeVerifiedTransaction(signedTransactionInfo);

    if (decoded.productId !== productId) {
        throw new functions.https.HttpsError('failed-precondition', 'Transaction/product mismatch.');
    }
    if (decoded.revocationDate) {
        throw new functions.https.HttpsError('failed-precondition', 'Transaction was refunded/revoked.');
    }

    const userId = context.auth.uid;
    const fulfillId = fulfillmentDocId(decoded.transactionId);
    const fulfillRef = db.collection('apple_iap_credit_fulfillments').doc(fulfillId);
    const userRef = db.collection('users').doc(userId);
    let creditsGranted = packageDef.credits;
    let alreadyFulfilled = false;

    await db.runTransaction(async (tx) => {
        const done = await tx.get(fulfillRef);
        if (done.exists) {
            alreadyFulfilled = true;
            creditsGranted = done.data()?.credits || packageDef.credits;
            return;
        }

        const snap = await tx.get(userRef);
        if (!snap.exists) {
            throw new functions.https.HttpsError('not-found', 'User not found');
        }

        const userData = snap.data();
        const accountRole = isBusinessUserDoc(userData) ? 'business' : 'user';

        grantPaidCreditsInTransaction(tx, userRef, userData, {
            uid: userId,
            accountRole,
            credits: packageDef.credits,
            type: 'purchase',
            reason: `apple_iap_${packageDef.packageId}`,
            relatedId: fulfillId,
        });

        tx.set(fulfillRef, {
            userId,
            productId,
            packageId: packageDef.packageId,
            credits: packageDef.credits,
            transactionId: decoded.transactionId,
            originalTransactionId: decoded.originalTransactionId || null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    });

    return {
        ok: true,
        alreadyFulfilled,
        credits: creditsGranted,
        packageId: packageDef.packageId,
    };
});

/**
 * Callable — iOS app sends the signed transaction after subscribing to the Business plan.
 * Mirrors functions/paypal.js's grantPayPalBusinessPlan field shape (`subscriptionProvider`,
 * `businessPaidUntil`) rather than the Stripe-webhook shape, since Apple (like PayPal) has
 * no live webhook wired up yet — entitlement is refreshed on-demand from the decoded
 * transaction's `expiresDate` each time the client re-verifies.
 */
exports.verifyAppleBusinessSubscription = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Sign in required');
    }

    const signedTransactionInfo = String(data?.signedTransactionInfo || '').trim();
    if (!signedTransactionInfo) {
        throw new functions.https.HttpsError('invalid-argument', 'signedTransactionInfo is required');
    }

    const decoded = await decodeVerifiedTransaction(signedTransactionInfo);

    if (!isAppleBusinessSubscriptionProduct(decoded.productId)) {
        throw new functions.https.HttpsError('invalid-argument', 'Unknown Apple subscription product');
    }
    if (decoded.revocationDate) {
        throw new functions.https.HttpsError('failed-precondition', 'Subscription was refunded/revoked.');
    }
    if (!decoded.expiresDate || decoded.expiresDate <= Date.now()) {
        throw new functions.https.HttpsError('failed-precondition', 'Subscription is not currently active.');
    }

    const userId = context.auth.uid;
    const originalTransactionId = String(decoded.originalTransactionId || decoded.transactionId).trim();
    const fulfillRef = db.collection('apple_business_plan_fulfillments').doc(originalTransactionId);
    const userRef = db.collection('users').doc(userId);
    const paidUntil = admin.firestore.Timestamp.fromMillis(decoded.expiresDate);

    await db.runTransaction(async (tx) => {
        const snap = await tx.get(userRef);
        if (!snap.exists) {
            throw new functions.https.HttpsError('not-found', 'User not found');
        }
        const userData = snap.data() || {};
        if (!isBusinessUserDoc(userData)) {
            throw new functions.https.HttpsError(
                'failed-precondition',
                'Business subscription requires a business account.'
            );
        }

        tx.update(userRef, {
            subscriptionStatus: 'active',
            subscriptionTier: 'paid',
            currentPlan: 'paid',
            weeklyPrivateQuota: 0,
            usedPrivateCreditsThisWeek: 0,
            subscriptionStartDate: admin.firestore.FieldValue.serverTimestamp(),
            subscriptionProvider: 'apple',
            appleOriginalTransactionId: originalTransactionId,
            businessPaidUntil: paidUntil,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        tx.set(
            fulfillRef,
            {
                userId,
                originalTransactionId,
                lastTransactionId: decoded.transactionId,
                provider: 'apple',
                paidUntil,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
        );
    });

    return { ok: true, paidUntil: paidUntil.toDate().toISOString() };
});

exports.getAppleCommerceStatus = functions.https.onCall(async () => appleCommerceStatus());

// Exported for future use (e.g. a periodic refresh job re-checking subscription status
// via the App Store Server API instead of waiting for the client to re-verify).
exports._internal = { getAppStoreServerApiClient };
