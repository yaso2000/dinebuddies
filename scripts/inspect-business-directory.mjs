/**
 * Inspect why a business may be missing from /restaurants (public_profiles directory).
 * Usage: node scripts/inspect-business-directory.mjs <businessUid>
 */
import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getFirestore } from 'firebase-admin/firestore';
import { ensureFirebaseAdmin } from '../api/_firebaseAdmin.js';
import { syncUserPublicProfile } from '../api/_publicProfileSync.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: resolve(root, '.env') });

const uid = process.argv[2]?.trim();
const shouldSync = process.argv.includes('--sync');
if (!uid) {
    console.error('Usage: node scripts/inspect-business-directory.mjs <businessUid> [--sync]');
    process.exit(1);
}

function asTrimmedString(v) {
    return typeof v === 'string' ? v.trim() : '';
}

function detectPublicProfileType(userData) {
    const role = asTrimmedString(userData?.role);
    const accountType = asTrimmedString(userData?.accountType);
    if (role === 'business' || role === 'partner' || accountType === 'business') return 'business';
    return 'user';
}

ensureFirebaseAdmin();
const db = getFirestore();

const userSnap = await db.collection('users').doc(uid).get();
const publicSnap = await db.collection('public_profiles').doc(uid).get();

console.log('--- users/' + uid + ' ---');
if (!userSnap.exists) {
    console.log('MISSING: no users document');
} else {
    const u = userSnap.data();
    const bi = u.businessInfo || {};
    console.log('role:', u.role);
    console.log('accountType:', u.accountType);
    console.log('emailVerified (Firestore):', u.emailVerified);
    console.log('businessInfo.isPublished:', bi.isPublished);
    console.log('businessName:', bi.businessName || u.display_name);
    console.log('businessType:', bi.businessType);
    console.log('city:', bi.city, '| country:', bi.country);
    console.log('lat/lng:', bi.lat, bi.lng);
    console.log('banned:', u.banned);
    console.log('profileType (derived):', detectPublicProfileType(u));
    const wouldPublish =
        detectPublicProfileType(u) === 'business' &&
        u.emailVerified === true &&
        bi.isPublished === true;
    console.log('would show in directory (if public_profiles synced):', wouldPublish);
}

console.log('\n--- public_profiles/' + uid + ' ---');
if (!publicSnap.exists) {
    console.log('MISSING: no public_profiles document (syncPublicProfileOnUserWrite did not write or deleted it)');
} else {
    const p = publicSnap.data();
    console.log('profileType:', p.profileType);
    console.log('displayName:', p.displayName);
    console.log('searchable:', p.searchable);
    console.log('businessPublic.isPublished:', p.businessPublic?.isPublished);
    console.log('businessPublic.businessType:', p.businessPublic?.businessType);
    console.log('businessPublic.city:', p.businessPublic?.city);
    console.log('updatedAt:', p.updatedAt?.toDate?.() || p.updatedAt);
}

const listed = await db
    .collection('public_profiles')
    .where('profileType', '==', 'business')
    .where('businessPublic.isPublished', '==', true)
    .limit(5)
    .get();
console.log('\n--- directory query sample (published businesses, max 5) ---');
console.log('count in sample:', listed.size);
listed.docs.forEach((d) => {
    const p = d.data();
    console.log(' -', d.id, '|', p.displayName, '|', p.businessPublic?.city);
});
const inList = listed.docs.some((d) => d.id === uid);
console.log('target uid in sample:', inList);

if (shouldSync) {
    console.log('\n--- syncing public_profiles ---');
    const result = await syncUserPublicProfile(uid);
    console.log(JSON.stringify(result, null, 2));
}
