/**
 * Google Play Billing — server-side verify + consume for Dine Credits (consumables).
 *
 * Requires Play Console service account linked with Android Publisher API access.
 * Env: GOOGLE_PLAY_PACKAGE_NAME, GOOGLE_PLAY_SERVICE_ACCOUNT_JSON
 */
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { google } = require('googleapis');
const {
    grantPaidCreditsInTransaction,
    isBusinessUserDoc,
    CREDIT_PACKAGES,
} = require('./creditsCore');
const {
    resolveGooglePlayPackageName,
    resolvePackageFromGoogleProductId,
} = require('./googlePlayCatalog');
const { hasGooglePlayServiceAccount, googlePlayCommerceStatus } = require('./googlePlayEnv');

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

/** @type {import('googleapis').androidpublisher_v3.Androidpublisher | null} */
let androidPublisherCache = null;

function getAndroidPublisher() {
    if (androidPublisherCache) return androidPublisherCache;

    if (!hasGooglePlayServiceAccount()) {
        throw new functions.https.HttpsError(
            'failed-precondition',
            'Google Play billing is not configured (missing service account).'
        );
    }

    let credentials;
    try {
        credentials = JSON.parse(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON);
    } catch {
        throw new functions.https.HttpsError(
            'failed-precondition',
            'GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is invalid JSON.'
        );
    }

    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    });

    androidPublisherCache = google.androidpublisher({ version: 'v3', auth });
    return androidPublisherCache;
}

async function fetchGooglePlayProductPurchase(productId, purchaseToken) {
    const androidpublisher = getAndroidPublisher();
    const packageName = resolveGooglePlayPackageName();

    const { data } = await androidpublisher.purchases.products.get({
        packageName,
        productId,
        token: purchaseToken,
    });

    return data;
}

async function consumeGooglePlayProduct(productId, purchaseToken) {
    const androidpublisher = getAndroidPublisher();
    const packageName = resolveGooglePlayPackageName();

    await androidpublisher.purchases.products.consume({
        packageName,
        productId,
        token: purchaseToken,
    });
}

function fulfillmentDocId(purchaseToken) {
    return Buffer.from(String(purchaseToken)).toString('base64url').slice(0, 400);
}

/**
 * Callable — Android app sends purchaseToken after BillingClient purchase.
 * Grants credits once, consumes the Play product, idempotent per token.
 */
exports.verifyGooglePlayCreditsPurchase = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Sign in required');
    }

    const productId = String(data?.productId || '').trim();
    const purchaseToken = String(data?.purchaseToken || '').trim();
    const packageDef = resolvePackageFromGoogleProductId(productId);

    if (!productId || !purchaseToken) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'productId and purchaseToken are required'
        );
    }

    if (!packageDef) {
        throw new functions.https.HttpsError('invalid-argument', 'Unknown Google Play product');
    }

    if (!CREDIT_PACKAGES[packageDef.packageId]) {
        throw new functions.https.HttpsError('invalid-argument', 'Unknown credit package');
    }

    const userId = context.auth.uid;
    let purchase;

    try {
        purchase = await fetchGooglePlayProductPurchase(productId, purchaseToken);
    } catch (err) {
        console.error('[verifyGooglePlayCreditsPurchase] Google API', err?.message || err);
        throw new functions.https.HttpsError(
            'failed-precondition',
            'Could not verify purchase with Google Play.'
        );
    }

    const purchaseState = Number(purchase?.purchaseState);
    if (purchaseState !== 0) {
        throw new functions.https.HttpsError(
            'failed-precondition',
            'Purchase is not completed yet.'
        );
    }

    const fulfillId = fulfillmentDocId(purchaseToken);
    const fulfillRef = db.collection('google_play_credit_fulfillments').doc(fulfillId);
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
            reason: `google_play_${packageDef.packageId}`,
            relatedId: fulfillId,
        });

        tx.set(fulfillRef, {
            userId,
            productId,
            packageId: packageDef.packageId,
            credits: packageDef.credits,
            orderId: purchase.orderId || null,
            purchaseTokenHash: fulfillId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    });

    if (!alreadyFulfilled) {
        try {
            await consumeGooglePlayProduct(productId, purchaseToken);
        } catch (err) {
            console.error('[verifyGooglePlayCreditsPurchase] consume failed (credits granted)', err?.message || err);
        }
    }

    return {
        ok: true,
        alreadyFulfilled,
        credits: creditsGranted,
        packageId: packageDef.packageId,
    };
});

exports.getGooglePlayCommerceStatus = functions.https.onCall(async () => googlePlayCommerceStatus());
