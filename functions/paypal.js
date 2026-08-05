const functions = require('firebase-functions');
const admin = require('firebase-admin');
const {
    CREDIT_PACKAGES,
    grantPaidCreditsInTransaction,
    isBusinessUserDoc,
} = require('./creditsCore');

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

const PAYPAL_CHECKOUT_ORDERS = 'paypal_checkout_orders';

const CREDIT_PACKAGE_PRICES = {
    credits_200: '2.00',
    credits_500: '5.00',
    credits_1000: '10.00',
    credits_3000: '25.00',
};

function getBusinessPlanPrice() {
    const raw = String(process.env.PAYPAL_BUSINESS_MONTHLY_PRICE || '29.00').trim();
    if (!/^\d+\.\d{2}$/.test(raw)) {
        throw new functions.https.HttpsError(
            'failed-precondition',
            'Invalid PAYPAL_BUSINESS_MONTHLY_PRICE (use format 29.00).'
        );
    }
    return raw;
}

async function assertCallerIsBusinessUser(userId) {
    const snap = await db.collection('users').doc(String(userId || '').trim()).get();
    if (!snap.exists || !isBusinessUserDoc(snap.data())) {
        throw new functions.https.HttpsError('failed-precondition', 'Business account required.');
    }
}

function paypalMode() {
    const mode = String(process.env.PAYPAL_MODE || 'sandbox').trim().toLowerCase();
    return mode === 'live' ? 'live' : 'sandbox';
}

function isPayPalSandbox() {
    return paypalMode() !== 'live';
}

function paypalApiBase() {
    return isPayPalSandbox()
        ? 'https://api-m.sandbox.paypal.com'
        : 'https://api-m.paypal.com';
}

function paypalClientId() {
    return String(process.env.PAYPAL_CLIENT_ID || '').trim();
}

function paypalClientSecret() {
    return String(process.env.PAYPAL_CLIENT_SECRET || '').trim();
}

function paypalCurrency() {
    return String(process.env.PAYPAL_CURRENCY || 'USD').trim().toUpperCase();
}

function assertPayPalConfigured() {
    if (!paypalClientId() || !paypalClientSecret()) {
        throw new functions.https.HttpsError(
            'failed-precondition',
            'PayPal is not configured (missing PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET).'
        );
    }
}

function getCreditPackagePrice(packageId) {
    const value = CREDIT_PACKAGE_PRICES[String(packageId || '').trim()];
    if (!value) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid credit package price');
    }
    return value;
}

function buildPayPalCustomId({ userId, packageId, credits }) {
    return JSON.stringify({
        userId: String(userId || '').trim(),
        packageId: String(packageId || '').trim(),
        credits: Math.floor(Number(credits) || 0),
    });
}

function parsePayPalCustomId(raw) {
    try {
        const parsed = JSON.parse(String(raw || '{}'));
        return {
            userId: String(parsed.userId || '').trim(),
            packageId: String(parsed.packageId || '').trim(),
            credits: Math.floor(Number(parsed.credits) || 0),
            kind: String(parsed.kind || '').trim(),
            planId: String(parsed.planId || '').trim(),
        };
    } catch {
        return { userId: '', packageId: '', credits: 0, kind: '', planId: '' };
    }
}

function buildPayPalBusinessPlanCustomId({ userId, planId }) {
    return JSON.stringify({
        userId: String(userId || '').trim(),
        kind: 'business_plan',
        planId: String(planId || 'paid').trim(),
    });
}

async function probePayPalOAuth(baseUrl) {
    const auth = Buffer.from(`${paypalClientId()}:${paypalClientSecret()}`).toString('base64');
    const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
    });
    const data = await res.json().catch(() => ({}));
    return {
        ok: res.ok && Boolean(data?.access_token),
        data,
        accessToken: data?.access_token || null,
    };
}

async function detectPayPalCredentialEnvironment() {
    const [sandbox, live] = await Promise.all([
        probePayPalOAuth('https://api-m.sandbox.paypal.com'),
        probePayPalOAuth('https://api-m.paypal.com'),
    ]);
    if (sandbox.ok) return 'sandbox';
    if (live.ok) return 'live';
    return null;
}

function buildPayPalAuthErrorMessage(data, configuredMode) {
    const base = data?.error_description || data?.error || 'Could not authenticate with PayPal.';
    if (data?.error !== 'invalid_client') return base;
    if (configuredMode === 'sandbox') {
        return `${base} Your Client ID/Secret look like Live credentials while PAYPAL_MODE=sandbox. In PayPal Developer Dashboard switch to Sandbox, copy that app’s Client ID + Secret, then redeploy functions.`;
    }
    return `${base} Check PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET for the ${configuredMode} environment.`;
}

async function getPayPalAccessToken() {
    const result = await probePayPalOAuth(paypalApiBase());
    if (result.accessToken) return result.accessToken;

    console.error('PayPal token error:', result.data);
    const detected = await detectPayPalCredentialEnvironment();
    let message = buildPayPalAuthErrorMessage(result.data, paypalMode());
    if (detected && detected !== paypalMode()) {
        message = `${message} Detected working credentials for "${detected}" — set PAYPAL_MODE=${detected} or replace with ${paypalMode()} credentials.`;
    }
    throw new functions.https.HttpsError('failed-precondition', message);
}

async function paypalApiRequest(path, { method = 'GET', body = null, headers = {} } = {}) {
    const token = await getPayPalAccessToken();
    const res = await fetch(`${paypalApiBase()}${path}`, {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
}

function extractPayPalCapture(orderData) {
    const purchaseUnit = Array.isArray(orderData?.purchase_units) ? orderData.purchase_units[0] : null;
    const capture = purchaseUnit?.payments?.captures?.[0] || null;
    return {
        purchaseUnit,
        capture,
        customId: purchaseUnit?.custom_id || '',
        referenceId: String(purchaseUnit?.reference_id || '').trim(),
    };
}

async function loadPayPalCheckoutOrder(orderId) {
    const snap = await db.collection(PAYPAL_CHECKOUT_ORDERS).doc(orderId).get();
    return snap.exists ? snap.data() : null;
}

async function savePayPalCheckoutOrder(orderId, payload) {
    await db.collection(PAYPAL_CHECKOUT_ORDERS).doc(orderId).set(
        {
            ...payload,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
    );
}

/**
 * Resolve credits metadata from PayPal custom_id, reference_id, or server-stored checkout doc.
 */
async function resolveCreditsOrderMeta(orderId, orderData, authUid) {
    const { customId, referenceId } = extractPayPalCapture(orderData);
    const parsed = parsePayPalCustomId(customId);
    if (
        parsed.userId &&
        parsed.userId === authUid &&
        parsed.packageId &&
        CREDIT_PACKAGES[parsed.packageId] &&
        parsed.credits > 0
    ) {
        return parsed;
    }

    if (referenceId && CREDIT_PACKAGES[referenceId]) {
        return {
            userId: authUid,
            packageId: referenceId,
            credits: CREDIT_PACKAGES[referenceId].credits,
        };
    }

    const pending = await loadPayPalCheckoutOrder(orderId);
    if (
        pending &&
        String(pending.userId || '').trim() === authUid &&
        String(pending.kind || 'credits') === 'credits' &&
        CREDIT_PACKAGES[pending.packageId]
    ) {
        return {
            userId: authUid,
            packageId: String(pending.packageId).trim(),
            credits: Math.floor(Number(pending.credits) || CREDIT_PACKAGES[pending.packageId].credits),
        };
    }

    return parsed;
}

async function fetchPayPalOrder(orderId) {
    return paypalApiRequest(`/v2/checkout/orders/${orderId}`);
}

function isPayPalOrderCompleted(orderData, capture) {
    const captureStatus = String(capture?.status || '').toUpperCase();
    const orderStatus = String(orderData?.status || '').toUpperCase();
    return captureStatus === 'COMPLETED' || orderStatus === 'COMPLETED';
}

async function captureOrLoadCompletedPayPalOrder(orderId) {
    const captureAttempt = await paypalApiRequest(`/v2/checkout/orders/${orderId}/capture`, {
        method: 'POST',
        headers: {
            'PayPal-Request-Id': `capture-${orderId}`,
        },
        body: {},
    });

    if (captureAttempt.ok && captureAttempt.data) {
        return captureAttempt.data;
    }

    const issue = captureAttempt.data?.details?.[0]?.issue;
    const fetched = await fetchPayPalOrder(orderId);
    if (!fetched.ok || !fetched.data) {
        console.error('PayPal capture error:', captureAttempt.status, captureAttempt.data);
        throw new functions.https.HttpsError(
            'internal',
            captureAttempt.data?.message ||
                fetched.data?.message ||
                'Could not capture PayPal order.'
        );
    }

    const { capture } = extractPayPalCapture(fetched.data);
    if (!isPayPalOrderCompleted(fetched.data, capture)) {
        if (issue === 'ORDER_ALREADY_CAPTURED') {
            throw new functions.https.HttpsError(
                'failed-precondition',
                'PayPal payment is still processing. Wait a moment and tap PayPal again to restore credits.'
            );
        }
        console.error('PayPal capture error:', captureAttempt.status, captureAttempt.data);
        throw new functions.https.HttpsError(
            'internal',
            captureAttempt.data?.message || 'Could not capture PayPal order.'
        );
    }

    return fetched.data;
}

async function fulfillPayPalCreditsOrder(orderId, authUid) {
    const orderData = await captureOrLoadCompletedPayPalOrder(orderId);
    const { purchaseUnit, capture } = extractPayPalCapture(orderData);
    const meta = await resolveCreditsOrderMeta(orderId, orderData, authUid);

    if (!meta.userId || meta.userId !== authUid) {
        throw new functions.https.HttpsError('permission-denied', 'This PayPal order does not belong to you.');
    }
    if (!meta.packageId || !CREDIT_PACKAGES[meta.packageId] || meta.credits <= 0) {
        throw new functions.https.HttpsError(
            'failed-precondition',
            'PayPal order metadata is invalid. Contact support with your PayPal receipt.'
        );
    }

    if (!isPayPalOrderCompleted(orderData, capture)) {
        throw new functions.https.HttpsError(
            'failed-precondition',
            'PayPal payment is not completed yet.'
        );
    }

    await grantPayPalCredits({
        orderId,
        captureId: String(capture?.id || '').trim(),
        userId: meta.userId,
        packageId: meta.packageId,
        credits: meta.credits,
    });

    await db.collection(PAYPAL_CHECKOUT_ORDERS).doc(orderId).set(
        {
            fulfilledAt: admin.firestore.FieldValue.serverTimestamp(),
            fulfilledCredits: meta.credits,
        },
        { merge: true }
    );

    return {
        ok: true,
        orderId,
        captureId: String(capture?.id || '').trim() || null,
        credits: meta.credits,
        packageId: meta.packageId,
        payerStatus: String(capture?.status || orderData?.status || 'COMPLETED').toUpperCase(),
        amount: purchaseUnit?.amount || null,
    };
}

async function grantPayPalCredits({ orderId, captureId, userId, packageId, credits }) {
    const fulfillRef = db.collection('paypal_dine_credit_fulfillments').doc(captureId || orderId);
    const userRef = db.collection('users').doc(userId);

    await db.runTransaction(async (tx) => {
        const done = await tx.get(fulfillRef);
        if (done.exists) return;

        const snap = await tx.get(userRef);
        if (!snap.exists) {
            throw new Error(`User not found for PayPal credits: ${userId}`);
        }

        const userData = snap.data() || {};
        const accountRole = isBusinessUserDoc(userData) ? 'business' : 'user';

        grantPaidCreditsInTransaction(tx, userRef, userData, {
            uid: userId,
            accountRole,
            credits,
            type: 'purchase',
            reason: `paypal_${packageId || 'credits'}`,
            relatedId: captureId || orderId,
        });

        tx.set(fulfillRef, {
            userId,
            orderId,
            captureId: captureId || null,
            packageId,
            credits,
            provider: 'paypal',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    });
}

async function grantPayPalBusinessPlan({ orderId, captureId, userId, planId }) {
    const fulfillRef = db.collection('paypal_business_plan_fulfillments').doc(captureId || orderId);
    const userRef = db.collection('users').doc(userId);
    const paidUntil = admin.firestore.Timestamp.fromDate(
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    );

    await db.runTransaction(async (tx) => {
        const done = await tx.get(fulfillRef);
        if (done.exists) return;

        const snap = await tx.get(userRef);
        if (!snap.exists) {
            throw new Error(`User not found for PayPal business plan: ${userId}`);
        }
        const userData = snap.data() || {};
        if (!isBusinessUserDoc(userData)) {
            throw new Error(`PayPal business plan requires business account: ${userId}`);
        }

        tx.update(userRef, {
            subscriptionStatus: 'active',
            subscriptionTier: 'paid',
            currentPlan: planId || 'paid',
            weeklyPrivateQuota: 0,
            usedPrivateCreditsThisWeek: 0,
            subscriptionStartDate: admin.firestore.FieldValue.serverTimestamp(),
            subscriptionProvider: 'paypal',
            paypalLastBusinessOrderId: orderId,
            paypalLastBusinessCaptureId: captureId || null,
            businessPaidUntil: paidUntil,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        tx.set(fulfillRef, {
            userId,
            orderId,
            captureId: captureId || null,
            planId: planId || 'paid',
            provider: 'paypal',
            paidUntil,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    });
}

exports.createPayPalCreditsOrder = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Sign in required');
    }

    assertPayPalConfigured();

    const packageId = String(data?.packageId || '').trim();
    const def = CREDIT_PACKAGES[packageId];
    if (!def) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid credit package');
    }

    const userId = context.auth.uid;
    const orderPayload = {
        intent: 'CAPTURE',
        purchase_units: [
            {
                reference_id: packageId,
                description: `${def.credits} Dine Credits`,
                custom_id: buildPayPalCustomId({
                    userId,
                    packageId,
                    credits: def.credits,
                }),
                amount: {
                    currency_code: paypalCurrency(),
                    value: getCreditPackagePrice(packageId),
                },
            },
        ],
        application_context: {
            shipping_preference: 'NO_SHIPPING',
            user_action: 'PAY_NOW',
        },
    };

    const result = await paypalApiRequest('/v2/checkout/orders', {
        method: 'POST',
        body: orderPayload,
    });

    if (!result.ok || !result.data?.id) {
        console.error('PayPal order create error:', result.status, result.data);
        throw new functions.https.HttpsError(
            'internal',
            result.data?.message || 'Could not create PayPal order.'
        );
    }

    await savePayPalCheckoutOrder(result.data.id, {
        userId,
        kind: 'credits',
        packageId,
        credits: def.credits,
        currency: paypalCurrency(),
        amount: getCreditPackagePrice(packageId),
    });

    return {
        orderId: result.data.id,
        status: result.data.status || 'CREATED',
    };
});

exports.capturePayPalCreditsOrder = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Sign in required');
    }

    assertPayPalConfigured();

    const orderId = String(data?.orderId || data?.orderID || '').trim();
    if (!orderId) {
        throw new functions.https.HttpsError('invalid-argument', 'orderId is required');
    }

    try {
        return await fulfillPayPalCreditsOrder(orderId, context.auth.uid);
    } catch (error) {
        if (error instanceof functions.https.HttpsError) throw error;
        console.error('capturePayPalCreditsOrder:', error);
        throw new functions.https.HttpsError(
            'internal',
            error?.message || 'Could not fulfill PayPal credits purchase.'
        );
    }
});

/** Idempotent recovery when payment completed but credits were not granted. */
exports.reconcilePayPalCreditsOrder = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Sign in required');
    }

    assertPayPalConfigured();

    const orderId = String(data?.orderId || data?.orderID || '').trim();
    if (!orderId) {
        throw new functions.https.HttpsError('invalid-argument', 'orderId is required');
    }

    try {
        return await fulfillPayPalCreditsOrder(orderId, context.auth.uid);
    } catch (error) {
        if (error instanceof functions.https.HttpsError) throw error;
        console.error('reconcilePayPalCreditsOrder:', error);
        throw new functions.https.HttpsError(
            'internal',
            error?.message || 'Could not reconcile PayPal credits purchase.'
        );
    }
});

exports.createPayPalBusinessPlanOrder = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Sign in required');
    }

    assertPayPalConfigured();
    const userId = context.auth.uid;
    await assertCallerIsBusinessUser(userId);

    const planId = String(data?.planId || 'paid').trim();
    const orderPayload = {
        intent: 'CAPTURE',
        purchase_units: [
            {
                reference_id: 'business_paid_monthly',
                description: 'DineBuddies Paid Business — 1 month',
                custom_id: buildPayPalBusinessPlanCustomId({ userId, planId }),
                amount: {
                    currency_code: paypalCurrency(),
                    value: getBusinessPlanPrice(),
                },
            },
        ],
        application_context: {
            shipping_preference: 'NO_SHIPPING',
            user_action: 'PAY_NOW',
        },
    };

    const result = await paypalApiRequest('/v2/checkout/orders', {
        method: 'POST',
        body: orderPayload,
    });

    if (!result.ok || !result.data?.id) {
        console.error('PayPal business plan order create error:', result.status, result.data);
        throw new functions.https.HttpsError(
            'internal',
            result.data?.message || 'Could not create PayPal order.'
        );
    }

    await savePayPalCheckoutOrder(result.data.id, {
        userId,
        kind: 'business_plan',
        planId,
        currency: paypalCurrency(),
        amount: getBusinessPlanPrice(),
    });

    return {
        orderId: result.data.id,
        status: result.data.status || 'CREATED',
        planId,
        amount: getBusinessPlanPrice(),
        currency: paypalCurrency(),
    };
});

exports.capturePayPalBusinessPlanOrder = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Sign in required');
    }

    assertPayPalConfigured();
    await assertCallerIsBusinessUser(context.auth.uid);

    const orderId = String(data?.orderId || data?.orderID || '').trim();
    if (!orderId) {
        throw new functions.https.HttpsError('invalid-argument', 'orderId is required');
    }

    let result = await paypalApiRequest(`/v2/checkout/orders/${orderId}/capture`, {
        method: 'POST',
        headers: {
            'PayPal-Request-Id': `capture-business-${orderId}`,
        },
        body: {},
    });

    if (!result.ok && result.status === 422) {
        const issue = result.data?.details?.[0]?.issue;
        if (issue === 'ORDER_ALREADY_CAPTURED') {
            result = await paypalApiRequest(`/v2/checkout/orders/${orderId}`);
        }
    }

    if (!result.ok) {
        console.error('PayPal business plan capture error:', result.status, result.data);
        throw new functions.https.HttpsError(
            'internal',
            result.data?.message || 'Could not capture PayPal order.'
        );
    }

    const { capture, customId } = extractPayPalCapture(result.data);
    const meta = parsePayPalCustomId(customId);

    if (!meta.userId || meta.userId !== context.auth.uid) {
        throw new functions.https.HttpsError('permission-denied', 'This PayPal order does not belong to you.');
    }
    if (meta.kind !== 'business_plan' || !meta.planId) {
        throw new functions.https.HttpsError('failed-precondition', 'PayPal order metadata is invalid.');
    }

    const captureStatus = String(capture?.status || result.data?.status || '').toUpperCase();
    if (captureStatus !== 'COMPLETED') {
        throw new functions.https.HttpsError(
            'failed-precondition',
            `PayPal payment is not completed yet (${captureStatus || 'unknown'}).`
        );
    }

    await grantPayPalBusinessPlan({
        orderId,
        captureId: String(capture?.id || '').trim(),
        userId: meta.userId,
        planId: meta.planId,
    });

    return {
        ok: true,
        orderId,
        captureId: String(capture?.id || '').trim() || null,
        planId: meta.planId,
        subscriptionTier: 'paid',
    };
});

exports.getPayPalCommerceStatus = functions.https.onCall(async () => {
    const mode = paypalMode();
    const detectedEnvironment = await detectPayPalCredentialEnvironment();
    return {
        mode,
        sandbox: isPayPalSandbox(),
        clientIdPresent: Boolean(paypalClientId()),
        clientSecretPresent: Boolean(paypalClientSecret()),
        currency: paypalCurrency(),
        oauthOk: detectedEnvironment === mode,
        detectedCredentialEnvironment: detectedEnvironment,
        modeMatchesCredentials: !detectedEnvironment || detectedEnvironment === mode,
        businessPlanPrice: getBusinessPlanPrice(),
        businessPlanCurrency: paypalCurrency(),
    };
});
