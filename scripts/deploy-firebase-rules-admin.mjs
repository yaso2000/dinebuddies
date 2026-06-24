/**
 * Deploy Firestore + Storage rules using Firebase Admin service account (.env).
 * Bypasses `firebase login` when CLI auth fails (SSL / attest errors).
 *
 * Usage: node scripts/deploy-firebase-rules-admin.mjs
 * Requires: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 */
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getFirebaseAdminCertConfig } from '../api/_firebaseAdmin.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
dotenv.config({ path: resolve(root, '.env') });

const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    'dinebuddies';

const storageBucket =
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.VITE_FIREBASE_STORAGE_BUCKET ||
    'dinebuddies.firebasestorage.app';

function ensureAdminApp() {
    if (getApps().length) return getApp();
    return initializeApp({ credential: cert(getFirebaseAdminCertConfig()) });
}

async function getAccessToken() {
    const app = ensureAdminApp();
    const cred = app.options.credential;
    if (!cred || typeof cred.getAccessToken !== 'function') {
        throw new Error('No credential on Firebase Admin app');
    }
    const { access_token: token } = await cred.getAccessToken();
    if (!token) throw new Error('Failed to obtain access token');
    return token;
}

async function apiFetch(path, { method = 'GET', body } = {}) {
    const token = await getAccessToken();
    const res = await fetch(`https://firebaserules.googleapis.com/v1/${path}`, {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json = null;
    try {
        json = text ? JSON.parse(text) : null;
    } catch {
        json = { raw: text };
    }
    if (!res.ok) {
        throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 500)}`);
    }
    return json;
}

async function publishRulesFile({ label, releaseId, filePath, rulesFileName }) {
    const content = readFileSync(filePath, 'utf8');
    console.log(`[deploy-rules] Creating ruleset for ${label} (${content.length} chars)...`);

    const ruleset = await apiFetch(`projects/${projectId}/rulesets`, {
        method: 'POST',
        body: {
            source: {
                files: [{ name: rulesFileName, content }],
            },
        },
    });

    const rulesetName = ruleset.name;
    if (!rulesetName) throw new Error(`No ruleset name returned for ${label}`);

    console.log(`[deploy-rules] Updating release ${releaseId} → ${rulesetName}`);

    await apiFetch(`projects/${projectId}/releases/${encodeURIComponent(releaseId)}`, {
        method: 'PATCH',
        body: {
            release: {
                name: `projects/${projectId}/releases/${releaseId}`,
                rulesetName,
            },
        },
    });

    console.log(`[deploy-rules] ✓ ${label} published`);
}

async function main() {
    console.log(`[deploy-rules] Project: ${projectId}`);
    console.log(`[deploy-rules] Storage bucket: ${storageBucket}`);

    await publishRulesFile({
        label: 'Firestore',
        releaseId: 'cloud.firestore',
        filePath: resolve(root, 'firestore.rules'),
        rulesFileName: 'firestore.rules',
    });

    await publishRulesFile({
        label: 'Storage',
        releaseId: `firebase.storage/${storageBucket}`,
        filePath: resolve(root, 'storage.rules'),
        rulesFileName: 'storage.rules',
    });

    console.log('[deploy-rules] Done.');
}

main().catch((err) => {
    console.error('[deploy-rules] FAILED:', err.message || err);
    process.exit(1);
});
