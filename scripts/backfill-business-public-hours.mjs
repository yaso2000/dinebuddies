/**
 * Copy users.businessInfo.hours → public_profiles.businessPublic.hours
 * so directory open/closed matches the hours tab.
 *
 * Usage: node scripts/backfill-business-public-hours.mjs
 */
import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { ensureFirebaseAdmin } from '../api/_firebaseAdmin.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: resolve(root, '.env') });

ensureFirebaseAdmin();
const db = getFirestore();

const snap = await db.collection('users').where('role', '==', 'business').get();
let updated = 0;
let skipped = 0;

for (const docSnap of snap.docs) {
    const uid = docSnap.id;
    const bi = docSnap.data()?.businessInfo || {};
    const hours = bi.hours && typeof bi.hours === 'object' ? bi.hours : null;
    if (!hours) {
        skipped += 1;
        continue;
    }
    const publicRef = db.collection('public_profiles').doc(uid);
    const publicSnap = await publicRef.get();
    if (!publicSnap.exists) {
        skipped += 1;
        continue;
    }
    const patch = {
        'businessPublic.hours': hours,
        updatedAt: FieldValue.serverTimestamp(),
    };
    if (bi.openingHours && typeof bi.openingHours === 'object') {
        patch['businessPublic.openingHours'] = bi.openingHours;
    }
    await publicRef.update(patch);
    updated += 1;
    console.log('updated hours for', uid);
}

console.log(`Done. updated=${updated} skipped=${skipped} scanned=${snap.size}`);
