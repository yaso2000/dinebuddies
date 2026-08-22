/**
 * Backfill users.gender → public_profiles.gender so the male/female/unspecified
 * avatar ring shows immediately for existing accounts (not just after their next
 * profile write, which is when the live sync trigger would normally add it).
 *
 * Usage: node scripts/backfill-public-profile-gender.mjs
 */
import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FieldValue, getFirestore, FieldPath } from 'firebase-admin/firestore';
import { ensureFirebaseAdmin } from '../api/_firebaseAdmin.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: resolve(root, '.env') });

ensureFirebaseAdmin();
const db = getFirestore();

function normalizePublicGender(userData) {
    const raw = String(userData?.gender || '').toLowerCase().trim();
    if (raw === 'male' || raw === 'm' || raw === 'man') return 'male';
    if (raw === 'female' || raw === 'f' || raw === 'woman') return 'female';
    return null;
}

const BATCH_SIZE = 300;
let lastDocId = null;
let scanned = 0;
let updated = 0;
let skippedNoPublicProfile = 0;
let skippedBusiness = 0;

for (;;) {
    let q = db.collection('users').orderBy(FieldPath.documentId()).limit(BATCH_SIZE);
    if (lastDocId) q = q.startAfter(lastDocId);
    const snap = await q.get();
    if (snap.empty) break;

    const publicRefs = snap.docs.map((d) => db.collection('public_profiles').doc(d.id));
    const publicSnaps = await db.getAll(...publicRefs);

    const batch = db.batch();
    let batchWrites = 0;

    snap.docs.forEach((userDoc, i) => {
        scanned += 1;
        const publicSnap = publicSnaps[i];
        if (!publicSnap.exists) {
            skippedNoPublicProfile += 1;
            return;
        }
        const publicData = publicSnap.data() || {};
        if (publicData.profileType === 'business') {
            skippedBusiness += 1;
            return;
        }
        const gender = normalizePublicGender(userDoc.data());
        if (publicData.gender === gender) return; // already correct, skip write
        batch.update(publicSnap.ref, { gender, updatedAt: FieldValue.serverTimestamp() });
        batchWrites += 1;
        updated += 1;
    });

    if (batchWrites > 0) await batch.commit();

    lastDocId = snap.docs[snap.docs.length - 1].id;
    console.log(`scanned=${scanned} updated=${updated} ...`);
    if (snap.docs.length < BATCH_SIZE) break;
}

console.log(
    `Done. scanned=${scanned} updated=${updated} skippedNoPublicProfile=${skippedNoPublicProfile} skippedBusiness=${skippedBusiness}`
);
