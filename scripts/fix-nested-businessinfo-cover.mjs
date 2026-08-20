/**
 * One-off cleanup: repair-broken-business-covers.mjs (and older scripts) wrote
 * 'businessInfo.coverImage' as a literal dotted-string top-level field via
 * .set(data, {merge:true}), instead of properly nesting it inside businessInfo.
 * The real businessInfo.coverImage (which the frontend reads via public_profiles)
 * was left stale. This copies the correct top-level photo_url/coverImageStoragePath
 * into a properly nested businessInfo object, deletes the bogus dotted fields, and
 * re-syncs public_profiles.
 *
 * Usage: node scripts/fix-nested-businessinfo-cover.mjs [--dry-run]
 */
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { ensureFirebaseAdmin } from '../api/_firebaseAdmin.js';
import { upsertRestaurantPublicProfile } from '../api/_restaurantPublicProfile.js';

dotenv.config({ path: resolve(process.cwd(), '.env') });
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const dryRun = process.argv.includes('--dry-run');

async function fixRestaurant(doc) {
    const placeId = doc.id;
    const data = doc.data() || {};
    const bogusKeys = Object.keys(data).filter((k) => k.includes('.'));

    if (!bogusKeys.length && data.businessInfo?.coverImage === data.photo_url) {
        return { placeId, status: 'ok' };
    }

    console.log(`[fixing] ${placeId} (${data.name}) bogus keys: ${bogusKeys.join(', ') || '(none)'}`);
    if (dryRun) return { placeId, status: 'dry-run' };

    const patch = {
        businessInfo: {
            coverImage: data.photo_url || null,
            coverImageStoragePath: data.coverImageStoragePath || null,
            coverImageFromFirebase: true,
        },
    };
    for (const key of bogusKeys) {
        patch[key] = FieldValue.delete();
    }

    await doc.ref.set(patch, { merge: true });
    await upsertRestaurantPublicProfile(getFirestore(), placeId);
    console.log(`[fixed] ${placeId}`);
    return { placeId, status: 'fixed' };
}

async function main() {
    ensureFirebaseAdmin();
    const db = getFirestore();

    const snap = await db.collection('restaurants').where('isVirtual', '==', true).limit(500).get();
    console.log(`Scanning ${snap.size} virtual restaurants…`);
    const results = [];
    for (const doc of snap.docs) {
        try {
            results.push(await fixRestaurant(doc));
        } catch (err) {
            console.error(`[error] ${doc.id}`, err instanceof Error ? err.message : err);
            results.push({ placeId: doc.id, status: 'error' });
        }
    }

    const summary = results.reduce((acc, row) => {
        acc[row.status] = (acc[row.status] || 0) + 1;
        return acc;
    }, {});
    console.log('Done.', summary);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
