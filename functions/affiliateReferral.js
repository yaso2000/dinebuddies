/**
 * Affiliate referral identity: unique AGENT-XXXX code, shareable link, total_clicks (for later analytics).
 * Uses registry collection affiliate_referral_codes/{code} for collision-safe allocation.
 */
const crypto = require('crypto');
const functions = require('firebase-functions');

const PREFIX = 'AGENT-';
const SUFFIX_LEN = 5;
/** Uppercase without ambiguous I, O, 0, 1 */
const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomSuffix(len) {
    const bytes = crypto.randomBytes(len);
    let s = '';
    for (let i = 0; i < len; i += 1) {
        s += CHARSET[bytes[i] % CHARSET.length];
    }
    return s;
}

/**
 * Produces a new candidate code (caller must verify uniqueness in a transaction or registry read).
 * @param {FirebaseFirestore.Firestore} _db
 * @param {typeof import('firebase-admin')} _admin
 * @returns {Promise<string>}
 */
async function generateUniqueReferralCode(_db, _admin) {
    return PREFIX + randomSuffix(SUFFIX_LEN);
}

function getPublicAppOrigin() {
    const o = process.env.PUBLIC_APP_ORIGIN || process.env.PUBLIC_APP_URL || '';
    const trimmed = String(o).trim().replace(/\/+$/, '');
    return trimmed || 'https://dinebuddies.com';
}

/**
 * @param {string} agentCode
 * @param {string} [baseUrl] — optional override (defaults to PUBLIC_APP_ORIGIN)
 */
function getReferralLink(agentCode, baseUrl) {
    const base = String(baseUrl || getPublicAppOrigin()).replace(/\/+$/, '');
    const code = String(agentCode || '').trim().toUpperCase();
    return `${base}/join?ref=${encodeURIComponent(code)}`;
}

/**
 * Assign referral_code + referral_link + total_clicks on users/{uid} when role is affiliate_agent.
 * @param {FirebaseFirestore.Firestore} db
 * @param {typeof import('firebase-admin')} admin
 * @param {string} uid
 */
async function assignReferralFieldsIfNeeded(db, admin, uid) {
    const userRef = db.collection('users').doc(uid);
    const pre = await userRef.get();
    if (!pre.exists) return;
    const u = pre.data() || {};
    if (String(u.role || '').toLowerCase() !== 'affiliate_agent') return;
    if (u.referral_code && String(u.referral_code).trim()) return;

    const registry = db.collection('affiliate_referral_codes');
    const base = getPublicAppOrigin();

    for (let attempt = 0; attempt < 30; attempt += 1) {
        const code = await generateUniqueReferralCode(db, admin);
        const regRef = registry.doc(code);
        try {
            await db.runTransaction(async (t) => {
                const uSnap = await t.get(userRef);
                if (!uSnap.exists) return;
                const cur = uSnap.data() || {};
                if (String(cur.role || '').toLowerCase() !== 'affiliate_agent') return;
                if (cur.referral_code && String(cur.referral_code).trim()) return;

                const rSnap = await t.get(regRef);
                if (rSnap.exists) {
                    const collision = new Error('collision');
                    collision.code = 'collision';
                    throw collision;
                }

                const link = getReferralLink(code, base);
                t.set(regRef, {
                    uid,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                t.update(userRef, {
                    referral_code: code,
                    referral_link: link,
                    total_clicks: typeof cur.total_clicks === 'number' && Number.isFinite(cur.total_clicks) ? cur.total_clicks : 0,
                    current_balance:
                        typeof cur.current_balance === 'number' && Number.isFinite(cur.current_balance)
                            ? cur.current_balance
                            : 0,
                    total_earned:
                        typeof cur.total_earned === 'number' && Number.isFinite(cur.total_earned) ? cur.total_earned : 0,
                    pending_referrals_count:
                        typeof cur.pending_referrals_count === 'number' && Number.isFinite(cur.pending_referrals_count)
                            ? cur.pending_referrals_count
                            : 0,
                    pending_payouts:
                        typeof cur.pending_payouts === 'number' && Number.isFinite(cur.pending_payouts)
                            ? cur.pending_payouts
                            : 0,
                    successful_referrals_count:
                        typeof cur.successful_referrals_count === 'number' &&
                        Number.isFinite(cur.successful_referrals_count)
                            ? cur.successful_referrals_count
                            : 0,
                    referral_count:
                        typeof cur.referral_count === 'number' && Number.isFinite(cur.referral_count)
                            ? cur.referral_count
                            : typeof cur.successful_referrals_count === 'number' &&
                                Number.isFinite(cur.successful_referrals_count)
                              ? cur.successful_referrals_count
                              : 0,
                });
            });

            const verify = await userRef.get();
            const vd = verify.data() || {};
            if (vd.referral_code && String(vd.referral_code).trim()) {
                functions.logger.info('[affiliateReferral] assigned', { uid, code: vd.referral_code });
                return;
            }
        } catch (e) {
            if (e && (e.code === 'collision' || e.message === 'collision')) {
                continue;
            }
            functions.logger.warn('[affiliateReferral] transaction attempt failed', uid, e?.message || e);
            throw e;
        }
    }
    functions.logger.error('[affiliateReferral] exhausted attempts', { uid });
    throw new Error('affiliate-referral-code-exhausted');
}

/**
 * @param {Record<string, unknown>} exportsObj
 * @param {{ db: FirebaseFirestore.Firestore, admin: typeof import('firebase-admin') }} deps
 */
function registerAffiliateReferralOnUserWrite(exportsObj, { db, admin }) {
    exportsObj.ensureAffiliateReferralOnUserWrite = functions.firestore
        .document('users/{uid}')
        .onWrite(async (change, context) => {
            if (!change.after.exists) return null;
            const uid = context.params.uid;
            try {
                await assignReferralFieldsIfNeeded(db, admin, uid);
            } catch (e) {
                functions.logger.error('[ensureAffiliateReferralOnUserWrite]', uid, e?.message || e);
            }
            return null;
        });

    /** Authenticated affiliate: allocate referral_code + referral_link if missing (dashboard bootstrap). */
    exportsObj.ensureMyAffiliateReferralCode = functions.https.onCall(async (_data, context) => {
        if (!context.auth?.uid) {
            throw new functions.https.HttpsError('unauthenticated', 'Sign in required.');
        }
        const uid = context.auth.uid;
        const snap = await db.collection('users').doc(uid).get();
        if (!snap.exists) {
            throw new functions.https.HttpsError('not-found', 'Profile not found.');
        }
        const r = String(snap.data()?.role || '').toLowerCase();
        if (r !== 'affiliate_agent') {
            throw new functions.https.HttpsError('permission-denied', 'Affiliate accounts only.');
        }
        await assignReferralFieldsIfNeeded(db, admin, uid);
        const after = await db.collection('users').doc(uid).get();
        const d = after.data() || {};
        return {
            ok: true,
            referralCode: d.referral_code ? String(d.referral_code).trim() : null,
            referralLink: d.referral_link ? String(d.referral_link).trim() : null,
        };
    });
}

module.exports = {
    registerAffiliateReferralOnUserWrite,
    generateUniqueReferralCode,
    getReferralLink,
    getPublicAppOrigin,
    assignReferralFieldsIfNeeded,
};
