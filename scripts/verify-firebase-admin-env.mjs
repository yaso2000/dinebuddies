/**
 * Verify FIREBASE_* admin env vars (.env or process env).
 * Usage: node scripts/verify-firebase-admin-env.mjs
 */
import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import {
    ensureFirebaseAdmin,
    getFirebaseAdminCertConfig,
    getFirebaseStorageBucketName,
} from '../api/_firebaseAdmin.js';
import { bucketCandidates, uploadInvitationAiImage } from '../api/_aiStorage.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: resolve(root, '.env') });

function mask(value, visible = 4) {
    const s = String(value || '');
    if (!s) return '(empty)';
    if (s.length <= visible * 2) return '*'.repeat(s.length);
    return `${s.slice(0, visible)}…${s.slice(-visible)}`;
}

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;
const privateKeyId = process.env.FIREBASE_PRIVATE_KEY_ID;

console.log('--- Firebase Admin env check ---');
console.log('FIREBASE_PROJECT_ID      ', projectId ? 'set' : 'MISSING');
console.log('FIREBASE_CLIENT_EMAIL    ', clientEmail ? 'set' : 'MISSING');
console.log('FIREBASE_PRIVATE_KEY     ', privateKey ? 'set' : 'MISSING');
console.log('FIREBASE_PRIVATE_KEY_ID  ', privateKeyId ? 'set' : '(optional, not set)');
console.log('');

if (!projectId || !clientEmail || !privateKey) {
    console.error('FAIL: Firebase Admin credentials are not configured');
    console.error('');
    console.error('Your .env has VITE_FIREBASE_* for the browser, but the API also needs:');
    console.error('  FIREBASE_PROJECT_ID');
    console.error('  FIREBASE_CLIENT_EMAIL');
    console.error('  FIREBASE_PRIVATE_KEY');
    console.error('');
    console.error('Fill them from service account JSON (CMD):');
    console.error(
        '  node scripts/set-firebase-admin-env-from-json.mjs C:\\path\\to\\service-account.json'
    );
    process.exit(1);
}

try {
    const cfg = getFirebaseAdminCertConfig();

    const hasBegin = cfg.privateKey.includes('BEGIN PRIVATE KEY');
    const hasEnd = cfg.privateKey.includes('END PRIVATE KEY');

    console.log('FIREBASE_PRIVATE_KEY_ID ', cfg.privateKeyId || '(not set — optional)');
    console.log(
        'FIREBASE_PRIVATE_KEY format',
        hasBegin && hasEnd ? `OK (${cfg.privateKey.length} chars)` : 'INVALID'
    );

    if (!hasBegin || !hasEnd) {
        throw new Error('FIREBASE_PRIVATE_KEY must include BEGIN/END PRIVATE KEY lines');
    }

    ensureFirebaseAdmin();

    await getAuth().listUsers(1);
    console.log('Auth API              OK (service account can call Firebase Auth)');

    await getFirestore().collection('users').limit(1).get();
    console.log('Firestore API         OK (service account can read Firestore)');

    const bucketName = getFirebaseStorageBucketName();
    console.log('FIREBASE_STORAGE_BUCKET ', bucketName || '(derived from project id)');

    const probeUid = `env_probe_${randomUUID().slice(0, 8)}`;
    const probePayload = Buffer.alloc(600, 0x89);
    const uploaded = await uploadInvitationAiImage(
        probeUid,
        probePayload.toString('base64'),
        'image/png',
        'invitation',
    );
    console.log('Storage upload          OK', uploaded.path, `bucket=${uploaded.bucket}`);

    const urlProbe = await fetch(uploaded.url, { method: 'GET' });
    if (!urlProbe.ok) {
        throw new Error(`uploaded URL not readable: HTTP ${urlProbe.status} — ${uploaded.url}`);
    }
    console.log('Storage download URL    OK', `status=${urlProbe.status}`);

    let cleaned = false;
    const cleanupBucket = uploaded.bucket || bucketCandidates()[0];
    if (cleanupBucket) {
        try {
            await getStorage().bucket(cleanupBucket).file(uploaded.path).delete();
            cleaned = true;
        } catch {
            /* fall through */
        }
    }
    if (!cleaned) {
        for (const name of bucketCandidates()) {
            const bucket = name ? getStorage().bucket(name) : getStorage().bucket();
            try {
                await bucket.file(uploaded.path).delete();
                cleaned = true;
                break;
            } catch {
                /* try next bucket */
            }
        }
    }
    console.log('Storage cleanup         ', cleaned ? 'OK' : 'skipped (delete manually if needed)');

    console.log('');
    console.log('PASS: keys are present and working.');
} catch (err) {
    console.error('');
    console.error('FAIL:', err?.message || err);
    console.error('');
    console.error('Tips:');
    console.error('- Use private_key from service account JSON');
    console.error('- In .env use \\n for line breaks inside FIREBASE_PRIVATE_KEY');
    console.error('- Set FIREBASE_STORAGE_BUCKET=dinebuddies.firebasestorage.app on Vercel');
    console.error('- IAM: firebase-adminsdk-...@dinebuddies.iam.gserviceaccount.com needs Storage Object Admin');
    console.error('- Or set GOOGLE_APPLICATION_CREDENTIALS=path\\to\\key.json and skip pasted keys');
    process.exit(1);
}
