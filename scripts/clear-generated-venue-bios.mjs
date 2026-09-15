/**
 * One-time cleanup: blank the auto-generated (Arabic) venue descriptions that a
 * previous ingest stored on virtual businesses. Only touches docs whose
 * `businessInfo.bioSource === 'generated'` — Google editorial blurbs
 * (bioSource 'google') and owner-written bios are left untouched. The client now
 * composes the summary in the UI language, so these stored strings are dead
 * data that only leak Arabic into non-Arabic UIs (edit form, search, share).
 *
 *   node --use-system-ca scripts/clear-generated-venue-bios.mjs           # dry run
 *   node --use-system-ca scripts/clear-generated-venue-bios.mjs --apply    # write
 */
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });
const APPLY = process.argv.includes('--apply');

const { ensureFirebaseAdmin } = await import(pathToFileURL(resolve(__dirname, '../api/_firebaseAdmin.js')).href);
const { getFirestore, FieldValue } = await import('firebase-admin/firestore');
ensureFirebaseAdmin();
const db = getFirestore();

const snap = await db.collection('restaurants').get();
let matched = 0, wrote = 0;
let batch = db.batch(), inBatch = 0;

for (const doc of snap.docs) {
  const d = doc.data();
  const bioSource = d.businessInfo?.bioSource;
  const desc = d.businessInfo?.description;
  if (bioSource !== 'generated' || !desc) continue;
  matched++;
  if (!APPLY) {
    if (matched <= 10) console.log(`  would clear ${doc.id} — ${String(desc).slice(0, 60)}`);
    continue;
  }
  batch.set(doc.ref, { businessInfo: { description: '', bioSource: '' } }, { merge: true });
  inBatch++; wrote++;
  if (inBatch >= 400) { await batch.commit(); batch = db.batch(); inBatch = 0; }
}
if (APPLY && inBatch > 0) await batch.commit();

console.log(`\n${APPLY ? 'CLEARED' : 'DRY RUN — would clear'} ${APPLY ? wrote : matched} generated venue bios (of ${snap.size} venues).`);
process.exit(0);
