/**
 * Delete ghost/orphan accounts: users/public_profiles docs whose Firebase Auth
 * user no longer exists AND that have no name + no avatar. These are remnants of
 * deleted accounts (re-created by a stray write-back) that show up in listings
 * as a blank avatar with no initials.
 *
 * Usage:
 *   node scripts/cleanup-ghost-accounts.mjs            # dry run (lists, deletes nothing)
 *   node scripts/cleanup-ghost-accounts.mjs --apply    # actually delete
 */
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

const APPLY = process.argv.includes('--apply');
const blank = (v) => !v || String(v).trim() === '';

const { ensureFirebaseAdmin } = await import(pathToFileURL(resolve(__dirname, '../api/_firebaseAdmin.js')).href);
const { getFirestore } = await import('firebase-admin/firestore');
const { getAuth } = await import('firebase-admin/auth');
ensureFirebaseAdmin();
const db = getFirestore();
const auth = getAuth();

const ids = new Set();
const us = await db.collection('users').limit(5000).get();
us.forEach((d) => {
  const u = d.data() || {};
  const name = u.name || u.displayName || u.display_name || '';
  const av = u.avatarUrl || u.photoURL || u.avatar || u.photo_url || '';
  if (blank(name) && blank(av)) ids.add(d.id);
});
const pp = await db.collection('public_profiles').limit(5000).get();
pp.forEach((d) => {
  const p = d.data() || {};
  const nm = p.displayName || p.name || p.businessPublic?.displayName || '';
  if (blank(nm) && p.profileType !== 'business') ids.add(d.id);
});

console.log(`Blank candidates: ${ids.size} | mode: ${APPLY ? 'APPLY (deleting)' : 'DRY RUN'}`);
let deleted = 0, kept = 0;
for (const uid of ids) {
  let hasAuth = true;
  try { await auth.getUser(uid); } catch (e) { if (e.code === 'auth/user-not-found') hasAuth = false; }
  if (hasAuth) { console.log('  KEEP (auth exists):', uid); kept++; continue; }
  if (!APPLY) { console.log('  would delete orphan:', uid); deleted++; continue; }
  await db.collection('public_profiles').doc(uid).delete().catch(() => {});
  try { await db.recursiveDelete(db.collection('users').doc(uid)); }
  catch { await db.collection('users').doc(uid).delete().catch(() => {}); }
  console.log('  🗑️ deleted orphan:', uid);
  deleted++;
}
console.log(`\nDone. ${APPLY ? 'deleted' : 'would delete'}=${deleted} | kept(auth-exists)=${kept}`);
process.exit(0);
