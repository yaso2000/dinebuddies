/**
 * Restore deleted business cover/avatar photos from Google Places.
 *
 * Public business profiles hold Storage URLs like
 *   …/o/restaurants%2Fcovers%2F{placeId}.jpg?alt=media&token=…
 * Some of those objects were deleted while the URLs stayed behind, so the
 * photos 404 everywhere. Since the profile id IS the Google place id, this
 * re-downloads each photo from the Places API and re-uploads it at the exact
 * path — with the same download token — so every stored URL works again
 * without touching a single Firestore document.
 *
 * Usage:
 *   node scripts/restore-business-cover-photos.mjs           # dry run
 *   node scripts/restore-business-cover-photos.mjs --execute
 */
import dotenv from 'dotenv';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

dotenv.config();

const EXECUTE = process.argv.includes('--execute');
const PLACES_V1 = 'https://places.googleapis.com/v1';
const KEY = process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';
if (!KEY) {
    console.error('No Google Maps API key in env.');
    process.exit(1);
}

initializeApp({
    credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID || 'dinebuddies',
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: String(process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
    storageBucket: 'dinebuddies.firebasestorage.app',
});
const db = getFirestore();
const bucket = getStorage().bucket();

function parseStorageUrl(url) {
    const s = String(url || '');
    const m = s.match(/\/o\/([^?]+)/);
    if (!m) return null;
    const token = (s.match(/[?&]token=([^&]+)/) || [])[1] || '';
    return { objectPath: decodeURIComponent(m[1]), token };
}

async function urlIsAlive(url) {
    try {
        const res = await fetch(url, { headers: { Range: 'bytes=0-64' } });
        return res.ok || res.status === 206;
    } catch {
        return false;
    }
}

async function fetchPlacePhoto(placeId) {
    const detailsRes = await fetch(`${PLACES_V1}/places/${placeId}`, {
        headers: { 'X-Goog-Api-Key': KEY, 'X-Goog-FieldMask': 'id,photos' },
    });
    if (!detailsRes.ok) return { error: `details_${detailsRes.status}` };
    const data = await detailsRes.json();
    const photoName = data?.photos?.[0]?.name;
    if (!photoName) return { error: 'no_photos' };
    const imgRes = await fetch(
        `${PLACES_V1}/${photoName}/media?maxWidthPx=1200&maxHeightPx=1200&key=${encodeURIComponent(KEY)}`,
        { redirect: 'follow', headers: { 'X-Goog-Api-Key': KEY } }
    );
    if (!imgRes.ok) return { error: `media_${imgRes.status}` };
    const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    if (buffer.length < 1000) return { error: 'too_small' };
    return { buffer, contentType };
}

const snap = await db.collection('public_profiles').where('profileType', '==', 'business').get();
console.log(`${snap.size} public business profiles — checking photo URLs…`);

// Collect every distinct dead storage URL, keyed by object path so a shared
// avatar/cover pair is only restored once.
const dead = new Map();
for (const doc of snap.docs) {
    const d = doc.data();
    // Only placeId-shaped ids can be restored from Google.
    if (!/^ChIJ/.test(doc.id)) continue;
    for (const url of new Set([d.avatarUrl, d.businessPublic?.coverImage].filter(Boolean))) {
        const parsed = parseStorageUrl(url);
        if (!parsed) continue;
        if (dead.has(parsed.objectPath)) continue;
        if (await urlIsAlive(url)) continue;
        dead.set(parsed.objectPath, { ...parsed, placeId: doc.id, name: d.displayName });
    }
}
console.log(`${dead.size} dead storage objects to restore${EXECUTE ? '' : ' (dry run — pass --execute to restore)'}`);

let restored = 0;
const failures = [];
for (const [objectPath, item] of dead) {
    if (!EXECUTE) {
        console.log(`  would restore ${objectPath}  (${item.name})`);
        continue;
    }
    const photo = await fetchPlacePhoto(item.placeId);
    if (photo.error) {
        failures.push({ objectPath, name: item.name, error: photo.error });
        console.log(`  ✗ ${item.name}: ${photo.error}`);
        continue;
    }
    const file = bucket.file(objectPath);
    await file.save(photo.buffer, {
        metadata: {
            contentType: photo.contentType,
            cacheControl: 'public, max-age=86400',
            // Keep the token every stored URL already carries.
            metadata: item.token ? { firebaseStorageDownloadTokens: item.token } : undefined,
        },
    });
    restored++;
    console.log(`  ✓ ${item.name} → ${objectPath} (${Math.round(photo.buffer.length / 1024)}KB)`);
}

console.log(`\nrestored: ${restored}, failed: ${failures.length}`);
if (failures.length) console.log(JSON.stringify(failures, null, 1));
process.exit(0);
