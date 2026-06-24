#!/usr/bin/env node
/**
 * Removes legacy business-plan Firestore data and normalizes business subscriptionTier to free|paid.
 *
 * Deletes entire collections:
 *   subscriptionPlans, creditPacks
 *
 * For each users/{uid} with role business (or isBusiness):
 *   elite|professional|premium|pro → paid
 *   anything else → free
 *   removes offerCredits, offerSlotCredits fields
 *
 * Usage:
 *   node scripts/cleanup-legacy-business-plans.mjs
 *   CONFIRM_CLEANUP=yes node scripts/cleanup-legacy-business-plans.mjs --execute
 */

import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXECUTE = process.argv.includes('--execute');

const LEGACY_PAID = new Set(['paid', 'elite', 'professional', 'premium', 'pro']);

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

async function normalizeBusinessUsers(db) {
    const snap = await db.collection('users').get();
    let updated = 0;
    let batch = db.batch();
    let inBatch = 0;

    for (const doc of snap.docs) {
        const d = doc.data() || {};
        const role = String(d.role || '').toLowerCase();
        const isBiz = d.isBusiness === true || role === 'business' || role === 'partner';
        if (!isBiz) continue;

        const raw = String(d.subscriptionTier || 'free').toLowerCase();
        const nextTier = LEGACY_PAID.has(raw) ? 'paid' : 'free';
        const needsTier = raw !== nextTier;
        const hasOfferFields = d.offerCredits != null || d.offerSlotCredits != null;

        if (!needsTier && !hasOfferFields) continue;

        updated += 1;
        if (!EXECUTE) continue;

        const patch = { subscriptionTier: nextTier, updatedAt: FieldValue.serverTimestamp() };
        if (hasOfferFields) {
            patch.offerCredits = FieldValue.delete();
            patch.offerSlotCredits = FieldValue.delete();
        }
        batch.update(doc.ref, patch);
        inBatch += 1;
        if (inBatch >= 400) {
            await batch.commit();
            batch = db.batch();
            inBatch = 0;
        }
    }
    if (EXECUTE && inBatch > 0) await batch.commit();
    console.log(`  users (business): ${updated} ${EXECUTE ? 'updated' : 'would update'}`);
    return updated;
}

async function main() {
    if (EXECUTE && process.env.CONFIRM_CLEANUP !== 'yes') {
        console.error('Set CONFIRM_CLEANUP=yes to execute.');
        process.exit(1);
    }

    initAdmin();
    const db = getFirestore();

    console.log(EXECUTE ? 'EXECUTE — cleaning legacy business plans…' : 'DRY RUN — pass --execute with CONFIRM_CLEANUP=yes');

    await deleteCollection(db, 'subscriptionPlans');
    await deleteCollection(db, 'creditPacks');
    await normalizeBusinessUsers(db);

    console.log('Done.');
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
