#!/usr/bin/env node
/**
 * Wipes user-generated data except privileged accounts (admin + owner / superOwner).
 *
 * Preserved Firestore config collections:
 *   app_settings, global_config
 *
 * Preserved Auth users (default):
 *   - UIDs in KEEP_AUTH_UIDS (comma-separated), plus
 *   - Any user with custom claims: superOwner, admin, or role === 'admin'
 *   - Any users/{uid} document with role or accountType === 'admin'
 *
 * Preserved Firestore docs:
 *   - users/{uid} and public_profiles/{uid} for the keeper UIDs only
 *
 * Preserved Storage files:
 *   - Objects whose path belongs to a keeper UID (folder or flat uid_ prefix)
 *
 * Credentials (first match wins):
 *   1) GOOGLE_APPLICATION_CREDENTIALS = path to service account JSON file
 *   2) FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY in .env (same as Vercel / sitemap API)
 *   3) Application Default Credentials: `gcloud auth application-default login` (project must match)
 *
 * Usage:
 *   node scripts/wipe-firebase-user-data.mjs
 *   CONFIRM_DELETE_ALL_USER_DATA=yes node scripts/wipe-firebase-user-data.mjs --execute
 *
 * Optional:
 *   KEEP_AUTH_UIDS=uid1,uid2           # always keep these (in addition to auto-detected)
 *   KEEP_PRIVILEGED_USERS=no           # only KEEP_AUTH_UIDS (no auto admin/superOwner)
 *   ALLOW_EMPTY_KEEPERS=yes          # allow run when no keeper found (deletes EVERYTHING — dangerous)
 *
 * Storage: set VITE_FIREBASE_STORAGE_BUCKET in .env (same as the app). If unset, defaults to
 *   PROJECT_ID.appspot.com — if your bucket is only PROJECT_ID.firebasestorage.app, set the env var.
 */

import { initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getFirestore, FieldPath } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const args = new Set(process.argv.slice(2));
const EXECUTE = args.has('--execute');
const DRY_RUN = !EXECUTE;

const PRESERVE_COLLECTIONS = new Set([
    'app_settings',
    'global_config',
]);

const USERS_LIKE_COLLECTIONS = ['users', 'public_profiles'];

/** Top-level Firestore collections that hold user / UGC data (not preserved). */
const WIPE_COLLECTIONS = [
    'welcome_gifts_claimed',
    'businessLikes',
    'invitations',
    'private_invitations',
    'chats',
    'conversations',
    'reviews',
    'reports',
    'system_messages',
    'partner_notifications',
    'communityPosts',
    'stories',
    'likes',
    'comments',
    'notifications',
    'offers',
    'active_offers',
    'special_offers',
    'communities',
    'featured_posts',
    'business_feedback',
    'restaurants',
    'admin_credit_grants',
    'admin_email_campaigns',
];

const STORAGE_PREFIXES = [
    'avatars/',
    'covers/',
    'logos/',
    'gallery/',
    'menus/',
    'stories/',
    'premium_offers/',
    'offers/',
    'invitations/',
    'invitation_cards/',
    'users/',
    'featured_posts/',
    'community-posts/',
    'feedback_media/',
    'business_photos/',
    'chat_images/',
    'chat-images/',
    'voice_messages/',
    'chat_files/',
];

function loadEnvLocal() {
    const tryPaths = [
        join(__dirname, '..', '.env'),
        join(__dirname, '..', '.env.local'),
    ];
    for (const p of tryPaths) {
        if (!existsSync(p)) continue;
        const raw = readFileSync(p, 'utf8');
        for (const line of raw.split('\n')) {
            const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
            if (!m) continue;
            const k = m[1];
            let v = m[2].trim();
            if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
                v = v.slice(1, -1);
            }
            if (process.env[k] === undefined) process.env[k] = v;
        }
    }
}

function getProjectId() {
    return (
        process.env.GOOGLE_CLOUD_PROJECT ||
        process.env.GCLOUD_PROJECT ||
        process.env.VITE_FIREBASE_PROJECT_ID ||
        process.env.FIREBASE_PROJECT_ID ||
        ''
    ).trim();
}

function getDatabaseUrl(projectId) {
    const explicit = (process.env.FIREBASE_DATABASE_URL || '').trim();
    if (explicit) return explicit;
    if (!projectId) return null;
    return `https://${projectId}-default-rtdb.firebaseio.com`;
}

/**
 * Firebase Storage bucket id (no gs://). Admin SDK requires this; it is not inferred from projectId alone.
 * Match firebase config: VITE_FIREBASE_STORAGE_BUCKET, or legacy *.appspot.com / *.firebasestorage.app.
 */
function getStorageBucketName(projectId) {
    let raw = (
        process.env.VITE_FIREBASE_STORAGE_BUCKET ||
        process.env.FIREBASE_STORAGE_BUCKET ||
        ''
    ).trim();
    if (raw.startsWith('gs://')) {
        raw = raw.slice(5).split('/')[0] || '';
    }
    if (raw) return raw;
    if (!projectId) return '';
    return `${projectId}.appspot.com`;
}

function initAdmin() {
    loadEnvLocal();
    const projectId = getProjectId();
    if (!projectId) {
        console.error('Missing project id. Set VITE_FIREBASE_PROJECT_ID or FIREBASE_PROJECT_ID in .env');
        process.exit(1);
    }

    const storageBucket = getStorageBucketName(projectId);
    const appOptions = {
        projectId,
        databaseURL: getDatabaseUrl(projectId) || undefined,
        ...(storageBucket ? { storageBucket } : {}),
    };

    const credPath = (process.env.GOOGLE_APPLICATION_CREDENTIALS || '').trim();
    if (credPath && existsSync(credPath)) {
        const serviceAccount = JSON.parse(readFileSync(credPath, 'utf8'));
        initializeApp({
            credential: cert(serviceAccount),
            ...appOptions,
        });
    } else {
        const clientEmail = (process.env.FIREBASE_CLIENT_EMAIL || '').trim();
        const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim();
        if (clientEmail && privateKey) {
            initializeApp({
                credential: cert({
                    projectId,
                    clientEmail,
                    privateKey
                }),
                ...appOptions,
            });
        } else {
            initializeApp({
                credential: applicationDefault(),
                ...appOptions,
            });
        }
    }
    return { projectId, storageBucket };
}

/**
 * @param {import('firebase-admin/auth').UserRecord} u
 */
function hasPrivilegedClaims(u) {
    const c = u.customClaims || {};
    if (c.superOwner === true) return true;
    if (c.admin === true) return true;
    if (c.role === 'admin') return true;
    return false;
}

/**
 * Discover UIDs to keep: explicit env + Auth claims + Firestore users role admin.
 * @param {import('firebase-admin/auth').Auth} auth
 * @param {import('firebase-admin/firestore').Firestore} db
 */
async function discoverKeeperUids(auth, db) {
    const keep = new Set(
        (process.env.KEEP_AUTH_UIDS || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
    );

    const auto = process.env.KEEP_PRIVILEGED_USERS !== 'no';

    if (auto) {
        let nextPageToken;
        do {
            const list = await auth.listUsers(1000, nextPageToken);
            for (const u of list.users) {
                if (hasPrivilegedClaims(u)) keep.add(u.uid);
            }
            nextPageToken = list.pageToken;
        } while (nextPageToken);

        const snap = await db.collection('users').get();
        for (const d of snap.docs) {
            const data = d.data() || {};
            const role = data.role;
            const accountType = data.accountType;
            if (role === 'admin' || accountType === 'admin') keep.add(d.id);
        }
    }

    return keep;
}

/** True if this object path should be kept (belongs to a keeper UID). */
function isStorageFileKept(objectName, keeperUids) {
    for (const uid of keeperUids) {
        if (!uid || uid.length < 8) continue;
        if (objectName.includes(`/${uid}/`)) return true;
        if (objectName.includes(`/${uid}_`)) return true;
        if (objectName.includes(`/${uid}.`)) return true;
        const base = objectName.split('/').pop() || '';
        if (base.startsWith(`${uid}_`)) return true;
    }
    return false;
}

/**
 * Delete every document in a collection (recursively removes subcollections).
 */
async function wipeCollection(db, name) {
    let deleted = 0;
    let lastId = null;

    while (true) {
        let q = db.collection(name).orderBy(FieldPath.documentId()).limit(50);
        if (lastId) q = q.startAfter(lastId);
        const snap = await q.get();
        if (snap.empty) break;

        for (const doc of snap.docs) {
            if (DRY_RUN) {
                deleted += 1;
                continue;
            }
            await db.recursiveDelete(doc.ref);
            deleted += 1;
        }

        lastId = snap.docs[snap.docs.length - 1];
        if (snap.size < 50) break;
    }
    return deleted;
}

/**
 * Delete documents whose id is NOT in exceptIds.
 */
async function wipeCollectionExcept(db, name, exceptIds) {
    let deleted = 0;
    let lastId = null;

    while (true) {
        let q = db.collection(name).orderBy(FieldPath.documentId()).limit(50);
        if (lastId) q = q.startAfter(lastId);
        const snap = await q.get();
        if (snap.empty) break;

        for (const doc of snap.docs) {
            if (exceptIds.has(doc.id)) continue;
            if (DRY_RUN) {
                deleted += 1;
                continue;
            }
            await db.recursiveDelete(doc.ref);
            deleted += 1;
        }

        lastId = snap.docs[snap.docs.length - 1];
        if (snap.size < 50) break;
    }
    return deleted;
}

async function wipeStorageBucket(bucket, keeperUids) {
    if (!bucket) return 0;
    let total = 0;
    for (const prefix of STORAGE_PREFIXES) {
        const [files] = await bucket.getFiles({ prefix });
        for (const f of files) {
            if (isStorageFileKept(f.name, keeperUids)) continue;
            if (DRY_RUN) {
                total += 1;
                continue;
            }
            await f.delete().catch((e) => console.warn('[storage]', f.name, e.message));
            total += 1;
        }
    }
    return total;
}

async function wipeRtdbPresence(projectId) {
    const url = getDatabaseUrl(projectId);
    if (!url) return { skipped: true, reason: 'no database URL' };
    try {
        const rtdb = getDatabase();
        if (DRY_RUN) {
            const snap = await rtdb.ref('presence').get();
            const n = snap.exists() ? Object.keys(snap.val() || {}).length : 0;
            return { count: n };
        }
        await rtdb.ref('presence').remove();
        return { removed: true };
    } catch (e) {
        return { error: e.message };
    }
}

/**
 * Delete Auth users not in keeperUids.
 */
async function wipeAuthUsers(auth, keeperUids) {
    let deleted = 0;
    let nextPageToken;

    do {
        const list = await auth.listUsers(1000, nextPageToken);
        for (const u of list.users) {
            if (keeperUids.has(u.uid)) continue;
            if (DRY_RUN) {
                deleted += 1;
                continue;
            }
            await auth.deleteUser(u.uid);
            deleted += 1;
        }
        nextPageToken = list.pageToken;
    } while (nextPageToken);

    return { deleted, kept: keeperUids.size };
}

async function main() {
    console.log(DRY_RUN ? '--- DRY RUN (no data deleted) ---\n' : '--- EXECUTE: deleting data ---\n');

    if (!DRY_RUN && process.env.CONFIRM_DELETE_ALL_USER_DATA !== 'yes') {
        console.error(
            'Refusing to delete: set environment variable CONFIRM_DELETE_ALL_USER_DATA=yes\n' +
                'Example: CONFIRM_DELETE_ALL_USER_DATA=yes node scripts/wipe-firebase-user-data.mjs --execute'
        );
        process.exit(1);
    }

    const { projectId, storageBucket } = initAdmin();
    const db = getFirestore();
    const auth = getAuth();

    let bucket = null;
    if (storageBucket) {
        bucket = getStorage().bucket(storageBucket);
    } else {
        console.warn(
            'Storage: no bucket name resolved. Set VITE_FIREBASE_STORAGE_BUCKET in .env (Firebase Console → Project settings → Your apps).'
        );
    }

    const keeperUids = await discoverKeeperUids(auth, db);

    if (keeperUids.size === 0 && process.env.ALLOW_EMPTY_KEEPERS !== 'yes') {
        console.error(
            'No keeper accounts found.\n' +
                '  - Set KEEP_AUTH_UIDS=uid1,uid2 with your admin/owner UIDs, or\n' +
                '  - Ensure Firebase Auth custom claims (superOwner / admin) or Firestore users/{uid}.role === "admin"\n' +
                '  - Or set ALLOW_EMPTY_KEEPERS=yes to wipe everything including all Auth users (dangerous).'
        );
        process.exit(1);
    }

    console.log('Project:', projectId);
    console.log('Storage bucket:', storageBucket || '(skipped — not configured)');
    console.log('Preserved Firestore config:', [...PRESERVE_COLLECTIONS].join(', '));
    console.log('Keeper UIDs (' + keeperUids.size + '):', [...keeperUids].join(', ') || '(none — full wipe)');
    for (const uid of keeperUids) {
        try {
            const u = await auth.getUser(uid);
            console.log('  -', uid, u.email || '(no email)', JSON.stringify(u.customClaims || {}));
        } catch {
            console.log('  -', uid, '(could not load Auth record)');
        }
    }
    console.log('');

    for (const col of USERS_LIKE_COLLECTIONS) {
        process.stdout.write(`Firestore ${col} (except keepers)... `);
        const n = await wipeCollectionExcept(db, col, keeperUids);
        console.log(DRY_RUN ? `would delete ${n} doc(s)` : `deleted ${n} doc(s)`);
    }

    for (const col of WIPE_COLLECTIONS) {
        if (PRESERVE_COLLECTIONS.has(col)) continue;
        process.stdout.write(`Firestore ${col}... `);
        const n = await wipeCollection(db, col);
        console.log(DRY_RUN ? `would delete ${n} root doc(s)` : `deleted ${n} root doc(s)`);
    }

    console.log('\nStorage (prefixes, except keeper paths)...');
    const storageN = await wipeStorageBucket(bucket, keeperUids);
    console.log(DRY_RUN ? `Would delete ~${storageN} object(s)` : `Deleted ${storageN} object(s)`);

    console.log('\nRealtime Database (presence)...');
    const rtdbResult = await wipeRtdbPresence(projectId);
    console.log(rtdbResult);

    console.log('\nFirebase Auth (except keepers)...');
    const authResult = await wipeAuthUsers(auth, keeperUids);
    console.log(
        DRY_RUN
            ? `Would delete ${authResult.deleted} user(s); keep ${authResult.kept}`
            : `Deleted ${authResult.deleted} user(s); kept ${authResult.kept}`
    );

    console.log('\nDone.');
    if (DRY_RUN) {
        console.log(
            '\nExecute for real:\n  CONFIRM_DELETE_ALL_USER_DATA=yes node scripts/wipe-firebase-user-data.mjs --execute'
        );
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
