/**
 * Migrate business menus to the unified item model and drop the business-level
 * menu/services switch.
 *
 * For every business (users with a businessInfo.menu, and restaurants/*):
 *   - each menu item gets `kind` ('dish' | 'service'), derived from the item's
 *     old `listingKind` or, failing that, the business `menuListingType`
 *     ('services' → service, else dish);
 *   - items are normalized to { title, description, imageUrl, price, category,
 *     kind, order, isActive, bookingUrl } (old `name` kept as a fallback);
 *   - any legacy businessInfo.services[] entries become kind:'service' items;
 *   - businessInfo.menuListingType is deleted.
 *
 * Usage (from your machine):
 *   node --use-system-ca scripts/migrate-menu-kind.mjs            # dry run
 *   node --use-system-ca scripts/migrate-menu-kind.mjs --apply    # write changes
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

/** Old item + business mode → unified item. */
function toUnifiedItem(item, businessMode, index) {
  const src = item && typeof item === 'object' ? item : {};
  const kind =
    src.kind === 'service' || src.kind === 'dish'
      ? src.kind
      : src.listingKind === 'services' || businessMode === 'services'
        ? 'service'
        : 'dish';
  const priceNum = Number(src.price);
  return {
    id: String(src.id || `${Date.now()}_${index}`),
    title: String(src.title || src.name || '').trim(),
    name: String(src.title || src.name || '').trim(), // back-compat for current UI
    description: String(src.description || '').trim(),
    imageUrl: String(src.imageUrl || '').trim(),
    price: Number.isFinite(priceNum) ? priceNum : null,
    category: kind === 'service' ? (src.category || 'general') : (src.category || 'mains'),
    kind,
    bookingUrl: String(src.bookingUrl || '').trim() || null,
    order: typeof src.order === 'number' ? src.order : index,
    isActive: src.isActive !== false,
  };
}

async function migrateDoc(colName, docSnap) {
  const data = docSnap.data() || {};
  const bi = data.businessInfo && typeof data.businessInfo === 'object' ? data.businessInfo : null;
  if (!bi) return null;
  const mode = String(bi.menuListingType || 'menu');
  const menu = Array.isArray(bi.menu) ? bi.menu : [];
  const legacyServices = Array.isArray(bi.services) ? bi.services : [];
  if (menu.length === 0 && legacyServices.length === 0 && bi.menuListingType === undefined) return null;

  let order = 0;
  const unified = menu.map((it) => toUnifiedItem(it, mode, order++));
  for (const svc of legacyServices) {
    unified.push(toUnifiedItem({ ...svc, kind: 'service', imageUrl: svc.imageUrl || '' }, 'services', order++));
  }

  const update = {
    'businessInfo.menu': unified,
    'businessInfo.menuListingType': FieldValue.delete(),
    'businessInfo.services': FieldValue.delete(),
  };
  if (APPLY) await docSnap.ref.update(update);
  return { id: docSnap.id, col: colName, items: unified.length, mode };
}

let scanned = 0;
let changed = 0;
for (const colName of ['users', 'restaurants']) {
  const snap = await db.collection(colName).get();
  for (const d of snap.docs) {
    scanned += 1;
    const res = await migrateDoc(colName, d);
    if (res) {
      changed += 1;
      console.log(`  ${APPLY ? '✓' : '•'} ${colName}/${res.id}: ${res.items} items (was mode=${res.mode})`);
    }
  }
}
console.log(`\n${APPLY ? 'Applied' : 'Dry run'}. Scanned ${scanned} docs, ${changed} businesses ${APPLY ? 'migrated' : 'would migrate'}.`);
process.exit(0);
