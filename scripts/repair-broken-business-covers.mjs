/**
 * Repair business cover images whose Storage object no longer actually exists,
 * even though Firestore metadata (coverImageStoragePath/photo_url) claims it does.
 * Re-fetches a fresh photo from Google Places and re-uploads.
 *
 * Usage:
 *   node scripts/repair-broken-business-covers.mjs --dry-run
 *   node scripts/repair-broken-business-covers.mjs
 *   node scripts/repair-broken-business-covers.mjs --placeId=ChIJ...
 */
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { getFirestore } from 'firebase-admin/firestore';
import { ensureFirebaseAdmin } from '../api/_firebaseAdmin.js';
import { verifyStorageObjectReadable } from '../api/_aiStorage.js';
import { upsertRestaurantPublicProfile } from '../api/_restaurantPublicProfile.js';
import { fetchGooglePlaceMinimal } from '../api/_googlePlacesMinimal.js';

dotenv.config({ path: resolve(process.cwd(), '.env') });
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const placeArg = args.find((a) => a.startsWith('--placeId='));
const singlePlaceId = placeArg ? placeArg.split('=').slice(1).join('=').trim() : '';

async function repairRestaurant(doc) {
    const placeId = doc.id;
    const data = doc.data() || {};
    const storagePath = String(data.coverImageStoragePath || '').trim();

    const readable = storagePath ? await verifyStorageObjectReadable(storagePath) : false;
    if (readable) {
        console.log(`[ok] ${placeId} (${data.name}) storage object verified readable`);
        return { placeId, status: 'ok' };
    }

    console.log(`[broken] ${placeId} (${data.name}) storagePath=${storagePath || '(none)'} not readable`);
    if (dryRun) {
        return { placeId, status: 'dry-run-would-repair' };
    }

    const details = await fetchGooglePlaceMinimal(placeId, {
        forcePhotoRefresh: true,
        allowPhotoFailureOnRefresh: false,
        referer: 'https://www.dinebuddies.com/',
    });
    if (!details.coverImageFromFirebase || !details.coverImageStoragePath) {
        console.warn(`[fail] ${placeId} could not fetch fresh photo from Google`, details.photoError);
        return { placeId, status: 'no-photo' };
    }

    await doc.ref.set(
        {
            coverImageStoragePath: details.coverImageStoragePath,
            coverImageFromFirebase: true,
            photo_url: details.coverImageUrl,
            googlePhotoReference: details.googlePhotoReference,
            'businessInfo.coverImage': details.coverImageUrl,
            'businessInfo.coverImageStoragePath': details.coverImageStoragePath,
            'businessInfo.coverImageFromFirebase': true,
        },
        { merge: true },
    );
    await upsertRestaurantPublicProfile(getFirestore(), placeId);
    console.log(`[repaired] ${placeId} -> ${details.coverImageStoragePath}`);
    return { placeId, status: 'repaired' };
}

async function main() {
    ensureFirebaseAdmin();
    const db = getFirestore();

    if (singlePlaceId) {
        const snap = await db.collection('restaurants').doc(singlePlaceId).get();
        if (!snap.exists) {
            console.error(`Restaurant not found: ${singlePlaceId}`);
            process.exit(1);
        }
        await repairRestaurant(snap);
        return;
    }

    const snap = await db.collection('restaurants').where('isVirtual', '==', true).limit(500).get();
    console.log(`Scanning ${snap.size} virtual restaurants…`);
    const results = [];
    for (const doc of snap.docs) {
        try {
            results.push(await repairRestaurant(doc));
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
