/**
 * Backfill missing business cover images in Firebase Storage.
 *
 * Usage (requires Firebase Admin env vars + GOOGLE_PLACES_API_KEY):
 *   node scripts/backfill-business-cover-images.mjs
 *   node scripts/backfill-business-cover-images.mjs --placeId=ChIJ...
 *   node scripts/backfill-business-cover-images.mjs --dry-run
 */
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { getFirestore } from 'firebase-admin/firestore';
import { ensureFirebaseAdmin } from '../api/_firebaseAdmin.js';
import {
    resolveBusinessCoverObjectPath,
    storagePathFromFirebaseUrl,
} from '../api/_businessCoverResolve.js';
import { uploadGooglePlacePhotoToStorage } from '../api/_googlePlacePhotoStorage.js';
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
    const bi = data.businessInfo && typeof data.businessInfo === 'object' ? data.businessInfo : {};

    const existingPath = await resolveBusinessCoverObjectPath(placeId, { allowRepair: false });
    if (existingPath) {
        console.log(`[skip] ${placeId} already has ${existingPath}`);
        return { placeId, status: 'ok' };
    }

    const photoRef = String(data.googlePhotoReference || '').trim();
    if (photoRef) {
        if (dryRun) {
            console.log(`[dry-run] would upload from googlePhotoReference for ${placeId}`);
            return { placeId, status: 'dry-run' };
        }
        const uploaded = await uploadGooglePlacePhotoToStorage(placeId, photoRef);
        await doc.ref.set(
            {
                coverImageStoragePath: uploaded.path,
                coverImageFromFirebase: true,
                photo_url: uploaded.url,
                'businessInfo.coverImage': uploaded.url,
                'businessInfo.coverImageStoragePath': uploaded.path,
                'businessInfo.coverImageFromFirebase': true,
            },
            { merge: true },
        );
        await upsertRestaurantPublicProfile(getFirestore(), placeId);
        console.log(`[ok] ${placeId} repaired via googlePhotoReference → ${uploaded.path}`);
        return { placeId, status: 'repaired' };
    }

    const urlPath = storagePathFromFirebaseUrl(bi.coverImage || data.photo_url);
    if (urlPath) {
        if (dryRun) {
            console.log(`[dry-run] would persist path from URL for ${placeId}: ${urlPath}`);
            return { placeId, status: 'dry-run' };
        }
        await doc.ref.set(
            {
                coverImageStoragePath: urlPath,
                coverImageFromFirebase: true,
                'businessInfo.coverImageStoragePath': urlPath,
                'businessInfo.coverImageFromFirebase': true,
            },
            { merge: true },
        );
        await upsertRestaurantPublicProfile(getFirestore(), placeId);
        console.log(`[ok] ${placeId} linked existing storage path ${urlPath}`);
        return { placeId, status: 'linked' };
    }

    if (dryRun) {
        console.log(`[dry-run] would fetch Google Place photo for ${placeId}`);
        return { placeId, status: 'dry-run' };
    }

    const details = await fetchGooglePlaceMinimal(placeId, { allowPhotoFailureOnRefresh: false });
    if (!details.coverImageStoragePath) {
        console.warn(`[fail] ${placeId} no photo available from Google`);
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
    console.log(`[ok] ${placeId} imported fresh photo → ${details.coverImageStoragePath}`);
    return { placeId, status: 'imported' };
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
