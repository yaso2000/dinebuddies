#!/usr/bin/env node
/**
 * Removes orphaned affiliate / agency / referral data left behind after the
 * affiliate system was removed from the codebase.
 *
 * Deletes entire collections:
 *   payout_requests, affiliate_referral_codes, referral_rate_limits
 *
 * Deletes every users/{uid}/commissions_history subcollection (collectionGroup).
 *
 * For each users/{uid}: removes affiliate fields and demotes any leftover
 *   role 'affiliate_agent' account to a normal 'user' (there should be none —
 *   affiliate accounts were never issued in production).
 *
 * SAFE BY DEFAULT: dry run (reports counts, writes nothing). To actually delete:
 *   CONFIRM_CLEANUP=yes node scripts/cleanup-affiliate-data.mjs --execute
 *
 * Credentials (same as the other admin scripts):
 *   GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account-key.json  (preferred)
 *   or FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY + FIREBASE_PROJECT_ID
 *   or application default credentials.
 */

import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'fs';

const EXECUTE = process.argv.includes('--execute');

// Affiliate-only fields to strip from users/{uid}.
const AFFILIATE_USER_FIELDS = [
    'current_balance',
    'total_earned',
    'pending_referrals_count',
    'successful_referrals_count',
    'total_referred_users',
    'pending_payouts',
    'total_clicks',
    'referral_code',
    'referral_link',
    'referred_by',
    'affiliateLastCommissionSessionId',
    'registrationChannel',
    'affiliate_phone',
    'affiliate_paypal_email',
    'affiliate_address',
    'affiliate_country',
    'affiliate_city',
];

function initAdmin() {
    const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (credPath && existsSync(credPath)) {
        const sa = JSON.parse(readFileSync(credPath, 'utf8'));
        return initializeApp({ credential: cert(sa) });
    }
    const email = process.env.FIREBASE_CLIENT_EMAIL;
    const key = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    if (email && key) {
        return initializeApp({
            credential: cert({ clientEmail: email, privateKey: key, projectId: process.env.FIREBASE_PROJECT_ID }),
        });
    }
    return initializeApp({ credential: applicationDefault() });
}

async function deleteCollection(db, name) {
    const snap = await db.collection(name).get();
    if (snap.empty) {
        console.log(`  ${name}: (empty)`);
        return 0;
    }
    let n = 0;
    let batch = db.batch();
    let inBatch = 0;
    for (const doc of snap.docs) {
        if (EXECUTE) batch.delete(doc.ref);
        n += 1;
        inBatch += 1;
        if (inBatch >= 400) {
            if (EXECUTE) await batch.commit();
            batch = db.batch();
            inBatch = 0;
        }
    }
    if (EXECUTE && inBatch > 0) await batch.commit();
    console.log(`  ${name}: ${n} doc(s) ${EXECUTE ? 'deleted' : 'would delete'}`);
    return n;
}

async function deleteCommissionsHistory(db) {
    // Subcollection under users/{uid}; reach every one via a collection group.
    const snap = await db.collectionGroup('commissions_history').get();
    if (snap.empty) {
        console.log('  commissions_history: (empty)');
        return 0;
    }
    let n = 0;
    let batch = db.batch();
    let inBatch = 0;
    for (const doc of snap.docs) {
        if (EXECUTE) batch.delete(doc.ref);
        n += 1;
        inBatch += 1;
        if (inBatch >= 400) {
            if (EXECUTE) await batch.commit();
            batch = db.batch();
            inBatch = 0;
        }
    }
    if (EXECUTE && inBatch > 0) await batch.commit();
    console.log(`  commissions_history: ${n} doc(s) ${EXECUTE ? 'deleted' : 'would delete'}`);
    return n;
}

async function cleanUserDocs(db) {
    const snap = await db.collection('users').get();
    let touched = 0;
    let demoted = 0;
    let batch = db.batch();
    let inBatch = 0;

    for (const doc of snap.docs) {
        const d = doc.data() || {};
        const patch = {};

        for (const f of AFFILIATE_USER_FIELDS) {
            if (d[f] !== undefined) patch[f] = FieldValue.delete();
        }
        // Demote any leftover affiliate_agent account to a normal user.
        if (String(d.role || '').toLowerCase() === 'affiliate_agent') {
            patch.role = 'user';
            demoted += 1;
        }

        if (Object.keys(patch).length === 0) continue;

        touched += 1;
        if (!EXECUTE) continue;

        patch.updatedAt = FieldValue.serverTimestamp();
        batch.update(doc.ref, patch);
        inBatch += 1;
        if (inBatch >= 400) {
            await batch.commit();
            batch = db.batch();
            inBatch = 0;
        }
    }
    if (EXECUTE && inBatch > 0) await batch.commit();
    console.log(`  users: ${touched} ${EXECUTE ? 'cleaned' : 'would clean'} (${demoted} affiliate_agent → user)`);
    return touched;
}

async function main() {
    if (EXECUTE && process.env.CONFIRM_CLEANUP !== 'yes') {
        console.error('Refusing to execute. Set CONFIRM_CLEANUP=yes to actually delete.');
        process.exit(1);
    }

    initAdmin();
    const db = getFirestore();

    console.log(
        EXECUTE
            ? 'EXECUTE — permanently deleting orphaned affiliate data…'
            : 'DRY RUN — nothing will be written. Re-run with --execute and CONFIRM_CLEANUP=yes to apply.'
    );

    await deleteCollection(db, 'payout_requests');
    await deleteCollection(db, 'affiliate_referral_codes');
    await deleteCollection(db, 'referral_rate_limits');
    await deleteCommissionsHistory(db);
    await cleanUserDocs(db);

    console.log('Done.');
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
