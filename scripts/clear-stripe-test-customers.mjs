#!/usr/bin/env node
/**
 * Clear stale Stripe customer ids saved during test mode.
 *
 * Usage:
 *   node scripts/clear-stripe-test-customers.mjs
 *   CONFIRM_CLEAR_STRIPE_CUSTOMERS=yes node scripts/clear-stripe-test-customers.mjs --execute
 */
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXECUTE = process.argv.includes('--execute');
const CONFIRMED = process.env.CONFIRM_CLEAR_STRIPE_CUSTOMERS === 'yes';

function loadEnvLocal() {
    for (const p of [join(__dirname, '..', '.env'), join(__dirname, '..', 'functions', '.env')]) {
        if (!existsSync(p)) continue;
        for (const line of readFileSync(p, 'utf8').split('\n')) {
            const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
            if (!m) continue;
            const k = m[1];
            if (process.env[k] !== undefined) continue;
            let v = m[2].trim();
            if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
                v = v.slice(1, -1);
            }
            process.env[k] = v.replace(/\\n/g, '\n');
        }
    }
}

function initAdmin() {
    loadEnvLocal();
    const projectId =
        process.env.FIREBASE_PROJECT_ID ||
        process.env.VITE_FIREBASE_PROJECT_ID ||
        process.env.GCLOUD_PROJECT ||
        'dinebuddies';

    const email = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = String(process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
    if (email && privateKey.includes('BEGIN PRIVATE KEY')) {
        initializeApp({
            credential: cert({ projectId, clientEmail: email, privateKey }),
            projectId,
        });
        return projectId;
    }

    initializeApp({ credential: applicationDefault(), projectId });
    return projectId;
}

async function main() {
    if (!EXECUTE) {
        console.log('DRY RUN — pass --execute with CONFIRM_CLEAR_STRIPE_CUSTOMERS=yes to apply');
    } else if (!CONFIRMED) {
        console.error('Refusing without CONFIRM_CLEAR_STRIPE_CUSTOMERS=yes');
        process.exit(1);
    }

    const projectId = initAdmin();
    const db = getFirestore();
    console.log(`[clear-stripe-customers] project=${projectId}`);

    const snap = await db.collection('users').get();
    let withCustomer = 0;
    let cleared = 0;

    const batchSize = 400;
    let batch = db.batch();
    let batchCount = 0;

    for (const docSnap of snap.docs) {
        const d = docSnap.data() || {};
        if (!d.stripeCustomerId && !d.stripeCustomerMode) continue;
        withCustomer += 1;
        if (!EXECUTE) continue;

        batch.set(
            docSnap.ref,
            {
                stripeCustomerId: FieldValue.delete(),
                stripeCustomerMode: FieldValue.delete(),
            },
            { merge: true }
        );
        batchCount += 1;
        cleared += 1;

        if (batchCount >= batchSize) {
            await batch.commit();
            batch = db.batch();
            batchCount = 0;
        }
    }

    if (EXECUTE && batchCount > 0) {
        await batch.commit();
    }

    console.log(
        JSON.stringify(
            {
                success: true,
                dryRun: !EXECUTE,
                scanned: snap.size,
                withCustomer,
                cleared: EXECUTE ? cleared : 0,
            },
            null,
            2
        )
    );
}

main().catch((err) => {
    console.error(err?.message || err);
    process.exit(1);
});
