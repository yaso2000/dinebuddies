/**
 * Read-only verification: Firestore users collection.
 * Reports projectId, total users, count by accountType, 10 sanitized samples.
 * No data modified. Uses Firebase Admin SDK.
 * Run: node scripts/verify_firestore_users.js
 */

import admin from 'firebase-admin';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function initAdmin() {
    if (admin.apps.length > 0) return;
    const cwd = process.cwd();
    const keyPaths = [
        path.join(cwd, 'service-account-key.json'),
        path.join(cwd, 'serviceAccountKey.json'),
        path.join(__dirname, '..', 'service-account-key.json'),
        path.join(__dirname, '..', 'serviceAccountKey.json')
    ];
    for (const keyPath of keyPaths) {
        try {
            const key = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
            admin.initializeApp({ credential: admin.credential.cert(key) });
            return;
        } catch (_) {}
    }
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        admin.initializeApp();
        return;
    }
    throw new Error('Firebase Admin: set GOOGLE_APPLICATION_CREDENTIALS or add service-account-key.json in project root');
}

initAdmin();
const db = admin.firestore();

const projectId = admin.app().options.projectId || process.env.GCLOUD_PROJECT || '(unknown)';

async function run() {
    try {
        console.log('');
        console.log('Firestore verification: users collection (read-only)');
        console.log('');

        console.log('--- 1. Firebase projectId ---');
        console.log('  ' + projectId);
        console.log('');

        const snap = await db.collection('users').get();
        const total = snap.size;
        console.log('--- 2. Total documents in users ---');
        console.log('  ' + total);
        console.log('');

        const byAccountType = {};
        const docs = [];
        snap.docs.forEach((d) => {
            const data = d.data();
            const at = data.accountType != null && data.accountType !== '' ? String(data.accountType) : '(missing)';
            byAccountType[at] = (byAccountType[at] || 0) + 1;
            docs.push({ id: d.id, ...data });
        });
        console.log('--- 3. Count by accountType ---');
        Object.entries(byAccountType)
            .sort((a, b) => String(a[0]).localeCompare(b[0]))
            .forEach(([type, count]) => console.log('  ' + type + ': ' + count));
        console.log('');

        const samples = docs.slice(0, 10).map((d) => ({
            uid: d.id,
            accountType: d.accountType ?? '(missing)',
            role: d.role ?? '(missing)',
            subscriptionTier: d.subscriptionTier ?? '(missing)'
        }));
        console.log('--- 4. Sample user docs (10, sanitized) ---');
        samples.forEach((s, i) => {
            console.log('  Sample ' + (i + 1) + ': ' + JSON.stringify(s));
        });
        console.log('');
        console.log('Verification complete. No data was modified.');
        console.log('');

        process.exit(0);
    } catch (err) {
        console.error('Verification failed: ' + err.message);
        process.exit(1);
    }
}

run();