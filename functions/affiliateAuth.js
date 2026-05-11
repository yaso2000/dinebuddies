/**
 * Affiliate-only registration: email/password users complete profile via callable (sets role server-side).
 */
const functions = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.firestore();
const NEW_ACCOUNT_WINDOW_MS = 12 * 60 * 1000;

function validatePaypalEmail(raw) {
    const t = String(raw || '').trim().toLowerCase();
    if (t.length < 5 || t.length > 120) return null;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return null;
    return t;
}

function validatePhone(raw) {
    const t = String(raw || '').replace(/[^\d+()\s-]/g, '').trim();
    if (t.length < 8 || t.length > 32) return null;
    return t;
}

function validateLabel(raw, max) {
    const t = String(raw || '').trim();
    if (t.length < 1 || t.length > max) return null;
    return t;
}

function hasFirestoreRoleField(data) {
    return data && Object.prototype.hasOwnProperty.call(data, 'role') && data.role != null && String(data.role).trim() !== '';
}

/**
 * After Firebase Auth email/password signup, stores payout/contact fields and sets role affiliate_agent.
 * Rejects existing consumer/business accounts. Allows only fresh accounts (no `role` yet, or role user within window — unused for affiliate flow).
 */
const registerAffiliateAgentProfile = functions.https.onCall(async (data, context) => {
    if (!context.auth?.uid) {
        throw new functions.https.HttpsError('unauthenticated', 'Sign in required.');
    }
    const uid = context.auth.uid;

    let userRecord;
    try {
        userRecord = await admin.auth().getUser(uid);
    } catch (e) {
        functions.logger.warn('[registerAffiliateAgentProfile] getUser', e?.message || e);
        throw new functions.https.HttpsError('not-found', 'User not found.');
    }

    const createdMs = new Date(userRecord.metadata.creationTime).getTime();
    if (!Number.isFinite(createdMs) || Date.now() - createdMs > NEW_ACCOUNT_WINDOW_MS) {
        throw new functions.https.HttpsError(
            'failed-precondition',
            'Registration must be completed shortly after creating your account. Please contact support if you need help.'
        );
    }

    const phone = validatePhone(data?.phone);
    const country = validateLabel(data?.country, 80);
    const city = validateLabel(data?.city, 80);
    const paypalEmail = validatePaypalEmail(data?.paypalEmail);
    const display_name =
        validateLabel(data?.displayName, 80) ||
        (userRecord.email ? userRecord.email.split('@')[0] : 'Partner');

    if (!phone || !country || !city || !paypalEmail) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'Please provide a valid phone, country, city, and PayPal email.'
        );
    }

    const email = String(userRecord.email || '').trim().toLowerCase();
    if (!email) {
        throw new functions.https.HttpsError('failed-precondition', 'Your account must have an email address.');
    }

    const ref = db.collection('users').doc(uid);

    await db.runTransaction(async (t) => {
        const snap = await t.get(ref);
        const d = snap.exists ? snap.data() || {} : {};
        const role = String(d.role || '').toLowerCase();

        if (role === 'affiliate_agent') {
            return;
        }
        if (role === 'admin' || role === 'business' || role === 'partner' || role === 'staff' || role === 'support') {
            throw new functions.https.HttpsError('failed-precondition', 'This account cannot be registered as an affiliate.');
        }
        if (role === 'user') {
            throw new functions.https.HttpsError(
                'failed-precondition',
                'This email is already a consumer account. Use a different email for affiliate registration.'
            );
        }
        if (hasFirestoreRoleField(d) && role !== '') {
            throw new functions.https.HttpsError('failed-precondition', 'Profile already has a role. Use a new account.');
        }

        t.set(
            ref,
            {
                uid,
                role: 'affiliate_agent',
                display_name,
                email,
                photo_url: typeof d.photo_url === 'string' ? d.photo_url : '',
                affiliate_phone: phone,
                affiliate_country: country,
                affiliate_city: city,
                affiliate_paypal_email: paypalEmail,
                affiliate_address: '',
                isProfileComplete: true,
                isGuest: false,
                reputation: typeof d.reputation === 'number' && Number.isFinite(d.reputation) ? d.reputation : 100,
                freeCredits: typeof d.freeCredits === 'number' && Number.isFinite(d.freeCredits) ? d.freeCredits : 0,
                paidCredits: typeof d.paidCredits === 'number' && Number.isFinite(d.paidCredits) ? d.paidCredits : 0,
                pending_payouts:
                    typeof d.pending_payouts === 'number' && Number.isFinite(d.pending_payouts) ? d.pending_payouts : 0,
                registrationChannel: 'affiliate_portal',
                authProvider: 'affiliate_email',
                created_time: d.created_time || admin.firestore.FieldValue.serverTimestamp(),
                last_active_time: admin.firestore.FieldValue.serverTimestamp(),
                lastSeen: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
        );
    });

    functions.logger.info('[registerAffiliateAgentProfile] ok', { uid });
    return { ok: true };
});

module.exports = {
    registerAffiliateAgentProfile,
};
