/**
 * ONE-TIME backfill for the 2.1 privacy work:
 *   1) Rebuild users/{uid}.followers[] (reverse follow index) from every user's
 *      following[]  — the field the mutual-follow messaging gate will read.
 *   2) Writing followers[] to each user doc fires the deployed
 *      syncPublicProfileOnUserWrite trigger, which RE-PROJECTS public_profiles
 *      with the new userPublic/businessPublic fields (bio, geo, profileLikes,
 *      communityMemberCount, ...). So this single pass backfills BOTH.
 *
 * Admin SDK bypasses Firestore rules, so the followersUnchanged() guard does not
 * block it. This never CREATES a user doc (merge onto existing docs only).
 *
 * Auth (pick one, safest first):
 *   - Application Default Credentials:  set GOOGLE_APPLICATION_CREDENTIALS to the
 *     path of a Firebase Admin private-key JSON, then run this script.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=/abs/path/key.json node scripts/backfill-followers-and-reproject.mjs --dry-run
 *   GOOGLE_APPLICATION_CREDENTIALS=/abs/path/key.json node scripts/backfill-followers-and-reproject.mjs
 *
 * After a successful run, REVOKE/DELETE that service-account key in the Firebase
 * console — it is only needed for this one-time task.
 */
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore, FieldPath } from 'firebase-admin/firestore';

const DRY_RUN = process.argv.includes('--dry-run');
const PAGE = 300;

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('ERROR: set GOOGLE_APPLICATION_CREDENTIALS to your Admin key JSON path first.');
    process.exit(1);
}

if (!getApps().length) {
    initializeApp({ credential: applicationDefault() });
}
const db = getFirestore();

// ── Pass 1: read every user's following[] and invert into target -> Set(follower)
const followersByUid = new Map();
const allUserIds = [];
let last = null;
for (;;) {
    let q = db.collection('users').orderBy(FieldPath.documentId()).limit(PAGE);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;
    snap.docs.forEach((d) => {
        allUserIds.push(d.id);
        const following = Array.isArray(d.data().following) ? d.data().following : [];
        following.forEach((t) => {
            if (typeof t !== 'string' || !t || t === d.id) return;
            if (!followersByUid.has(t)) followersByUid.set(t, new Set());
            followersByUid.get(t).add(d.id);
        });
    });
    last = snap.docs[snap.docs.length - 1].id;
    if (snap.size < PAGE) break;
}

console.log(`Scanned ${allUserIds.length} users; ${followersByUid.size} have >=1 follower.`);
if (DRY_RUN) {
    console.log('DRY RUN — no writes. Re-run without --dry-run to apply.');
    process.exit(0);
}

// ── Pass 2: write authoritative followers[] to each existing user (merge).
let updated = 0;
for (let i = 0; i < allUserIds.length; i += 400) {
    const chunk = allUserIds.slice(i, i + 400);
    const batch = db.batch();
    chunk.forEach((uid) => {
        const followers = [...(followersByUid.get(uid) || [])];
        batch.set(db.collection('users').doc(uid), { followers }, { merge: true });
    });
    await batch.commit();
    updated += chunk.length;
    console.log(`  ...wrote ${updated}/${allUserIds.length}`);
}

console.log(`Done. Wrote followers[] to ${updated} users (each fires public_profiles re-projection).`);
console.log('Now REVOKE/DELETE the service-account key you used, in the Firebase console.');
process.exit(0);
