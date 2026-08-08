#!/usr/bin/env node
/**
 * Zero all credit balances on users/* (paidCredits, savedCredits, legacy freeCredits + totals).
 * Does NOT change subscriptionTier or business plans.
 *
 * Usage:
 *   node scripts/reset-all-credits.mjs              # dry run (counts only)
 *   CONFIRM_RESET_ALL_CREDITS=yes node scripts/reset-all-credits.mjs --execute
 */
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXECUTE = process.argv.includes('--execute');
const DRY_RUN = !EXECUTE;
const CONFIRMED = process.env.CONFIRM_RESET_ALL_CREDITS === 'yes';

const RESET_PATCH = {
    paidCredits: 0,
    savedCredits: 0,
    freeCredits: 0,
    totalCreditsPurchased: 0,
    totalCreditsSpent: 0,
    totalSavedCreditsEarned: 0,
};

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

function userHasAnyCreditBalance(d) {
    const fields = [
        d.paidCredits,
        d.savedCredits,
        d.freeCredits,
        d.totalCreditsPurchased,
        d.totalCreditsSpent,
        d.totalSavedCreditsEarned,
    ];
    return fields.some((v) => Math.max(0, Math.floor(Number(v) || 0)) > 0);
}

function initAdmin() {
    loadEnvLocal();
    const projectId =
        process.env.FIREBASE_PROJECT_ID ||
        process.env.VITE_FIREBASE_PROJECT_ID ||
        process.env.GCLOUD_PROJECT ||
        'dinebuddies';

    const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (credPath && existsSync(credPath)) {
        initializeApp({
            credential: cert(JSON.parse(readFileSync(credPath, 'utf8'))),
            projectId,
        });
        return projectId;
    }

    const email = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = String(process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
    if (email && privateKey.includes('BEGIN PRIVATE KEY')) {
        initializeApp({
            credential: cert({
                projectId,
                clientEmail: email,
                privateKey,
            }),
            projectId,
        });
        return projectId;
    }

    initializeApp({ credential: applicationDefault(), projectId });
    return projectId;
}

async function main() {
    if (!DRY_RUN && !CONFIRMED) {
        console.error('Refusing to execute without CONFIRM_RESET_ALL_CREDITS=yes');
        process.exit(1);
    }

    const projectId = initAdmin();
    const db = getFirestore();
    console.log(`[reset-all-credits] project=${projectId} mode=${DRY_RUN ? 'DRY RUN' : 'EXECUTE'}`);

    const snap = await db.collection('users').get();
    let hadBalance = 0;
    let updated = 0;

    const batchSize = 400;
    let batch = db.batch();
    let batchCount = 0;

    for (const docSnap of snap.docs) {
        const d = docSnap.data() || {};
        if (!userHasAnyCreditBalance(d)) continue;
        hadBalance += 1;

        if (DRY_RUN) continue;

        batch.set(
            docSnap.ref,
            {
                ...RESET_PATCH,
                creditsResetAt: FieldValue.serverTimestamp(),
                creditsResetBy: 'script:reset-all-credits',
            },
            { merge: true }
        );
        batchCount += 1;
        updated += 1;

        if (batchCount >= batchSize) {
            await batch.commit();
            batch = db.batch();
            batchCount = 0;
            console.log(`[reset-all-credits] committed ${updated} users…`);
        }
    }

    if (!DRY_RUN && batchCount > 0) {
        await batch.commit();
    }

    if (!DRY_RUN) {
        await db.collection('admin_audit_log').add({
            action: 'reset_all_credits',
            adminUid: 'script:reset-all-credits',
            scanned: snap.size,
            updated,
            hadBalance,
            createdAt: FieldValue.serverTimestamp(),
        });
    }

    console.log(
        JSON.stringify(
            {
                success: true,
                dryRun: DRY_RUN,
                scanned: snap.size,
                hadBalance,
                updated: DRY_RUN ? 0 : updated,
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
