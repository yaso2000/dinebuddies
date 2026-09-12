/**
 * Reset (delete) the `tasteScope` field on specific user docs so those accounts
 * can retake the quiz immediately (clears the 90-day gate). Field-only delete —
 * the user doc is untouched otherwise. The users→public_profiles trigger then
 * removes tasteScope from the public projection automatically.
 *
 * Pass accounts by email or uid. With no arguments it targets DEFAULT_TARGETS
 * (the tester account) so a plain run just resets that one.
 * Usage:
 *   node --use-system-ca scripts/reset-tastescope.mjs                            # dry run (default account)
 *   node --use-system-ca scripts/reset-tastescope.mjs --apply                    # apply  (default account)
 *   node --use-system-ca scripts/reset-tastescope.mjs a@x.com <uid> ... --apply  # apply  (given accounts)
 */
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

/** Reset this account when no email/uid is passed on the command line. */
const DEFAULT_TARGETS = ['askyazo.app@gmail.com'];

const APPLY = process.argv.includes('--apply');
const argTargets = process.argv.slice(2).filter((a) => a !== '--apply');
const targets = argTargets.length ? argTargets : DEFAULT_TARGETS;

const { ensureFirebaseAdmin } = await import(pathToFileURL(resolve(__dirname, '../api/_firebaseAdmin.js')).href);
const { getFirestore, FieldValue } = await import('firebase-admin/firestore');
const { getAuth } = await import('firebase-admin/auth');
ensureFirebaseAdmin();
const db = getFirestore();
const auth = getAuth();

/** Resolve a target (email or uid) to a uid. */
async function toUid(target) {
  if (target.includes('@')) {
    try { return (await auth.getUserByEmail(target)).uid; }
    catch { return null; }
  }
  return target;
}

console.log(`Targets: ${targets.length} | mode: ${APPLY ? 'APPLY (deleting field)' : 'DRY RUN'}`);
let done = 0, skipped = 0;
for (const target of targets) {
  const uid = await toUid(target);
  if (!uid) { console.log(`  ✗ ${target}: no auth user found`); skipped += 1; continue; }
  const ref = db.collection('users').doc(uid);
  const snap = await ref.get();
  if (!snap.exists) { console.log(`  ✗ ${target} (${uid}): no users doc`); skipped += 1; continue; }
  const ts = snap.data()?.tasteScope;
  if (!ts) { console.log(`  – ${target} (${uid}): no tasteScope, nothing to do`); skipped += 1; continue; }
  console.log(`  ${APPLY ? '✓' : '•'} ${target} (${uid}): current title=${ts.titleId || '?'} → will delete tasteScope`);
  if (APPLY) { await ref.update({ tasteScope: FieldValue.delete() }); done += 1; }
}
console.log(APPLY ? `Done. Reset ${done}, skipped ${skipped}.` : `Dry run. Would reset ${targets.length - skipped}, skipped ${skipped}. Re-run with --apply.`);
process.exit(0);
