/**
 * Fetch venues from Google Places (New) and ingest them into DineBuddies as
 * admin-owned virtual businesses — same pipeline the cron/admin-import use.
 *
 * Pick a city; it pulls a full mix (defaults: 20 restaurants, 15 cafes,
 * 10 bars, 5 night clubs, 5 hotels). Counts are overridable per category.
 *
 *   node --use-system-ca scripts/ingest-venues.mjs --city "Sydney NSW, Australia"            # dry run
 *   node --use-system-ca scripts/ingest-venues.mjs --city "Sydney NSW, Australia" --apply     # ingest
 *   node --use-system-ca scripts/ingest-venues.mjs --city "Melbourne, Australia" --apply \
 *        --restaurants 20 --cafes 15 --bars 10 --clubs 5 --hotels 5
 */
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

const arg = (flag, def) => {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
};
const APPLY = process.argv.includes('--apply');
const CITY = arg('--city', 'Sydney NSW, Australia');

// The five app categories, with search queries + how many of each.
const CATS = [
  { key: 'restaurants', label: 'RESTAURANTS', category: 'Restaurant', type: 'restaurant', want: Number(arg('--restaurants', '20')) },
  { key: 'cafes', label: 'CAFES', category: 'Cafe', type: 'cafe', want: Number(arg('--cafes', '15')) },
  { key: 'bars', label: 'BARS', category: 'Bar', type: 'bar', want: Number(arg('--bars', '10')) },
  { key: 'clubs', label: 'NIGHT CLUBS', category: 'Night Club', type: 'night_club', want: Number(arg('--clubs', '5')) },
  { key: 'hotels', label: 'HOTELS', category: 'Hotel', type: null, want: Number(arg('--hotels', '5')) },
];
// Varied queries per category — Google's New searchText caps at 20 per query,
// so several angles (cuisines / synonyms) surface far more unique venues.
const QUERY_VARIANTS = {
  Restaurant: (c) => [`restaurants in ${c}`, `best restaurants in ${c}`, `italian restaurant ${c}`, `chinese restaurant ${c}`, `thai restaurant ${c}`, `indian restaurant ${c}`, `japanese restaurant ${c}`, `seafood restaurant ${c}`, `pub food ${c}`, `pizza ${c}`, `burger ${c}`, `steakhouse ${c}`, `mexican ${c}`, `vietnamese ${c}`, `family restaurant ${c}`],
  Cafe: (c) => [`cafes in ${c}`, `coffee shops in ${c}`, `breakfast ${c}`, `brunch ${c}`, `bakery cafe ${c}`, `espresso ${c}`, `best cafe ${c}`],
  Bar: (c) => [`bars in ${c}`, `pubs in ${c}`, `cocktail bar ${c}`, `wine bar ${c}`, `sports bar ${c}`, `brewery ${c}`, `tavern ${c}`],
  'Night Club': (c) => [`nightclubs in ${c}`, `night clubs in ${c}`, `dance club ${c}`, `live music venue ${c}`],
  Hotel: (c) => [`hotels in ${c}`, `best hotels in ${c}`, `motels in ${c}`, `resorts in ${c}`, `accommodation ${c}`],
};
const queriesFor = (category, city) => (QUERY_VARIANTS[category] || ((c) => [`${category} in ${c}`]))(city);

const KEY =
  process.env.GOOGLE_PLACES_API_KEY ||
  process.env.GOOGLE_MAPS_SERVER_KEY ||
  process.env.VITE_GOOGLE_MAPS_API_KEY ||
  process.env.GOOGLE_MAPS_API_KEY;
if (!KEY) { console.error('No Google Maps/Places API key in .env'); process.exit(1); }

const imp = (p) => import(pathToFileURL(resolve(__dirname, p)).href);
const { ensureFirebaseAdmin } = await imp('../api/_firebaseAdmin.js');
const { fetchGooglePlaceMinimal } = await imp('../api/_googlePlacesMinimal.js');
const { resolveAllowedVenueCategory } = await imp('../api/_googlePlacesHours.js');
const { ingestVirtualBusinessFromGoogle, findExistingByGooglePlaceId } = await imp('../api/_virtualBusinessIngest.js');
const { getFirestore } = await import('firebase-admin/firestore');
ensureFirebaseAdmin();

/** One Google Places (New) text search → [{id,name,types}]. */
async function searchOnce(textQuery, includedType) {
  const body = { textQuery, maxResultCount: 20, languageCode: 'en' };
  if (includedType) body.includedType = includedType;
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': KEY, 'X-Goog-FieldMask': 'places.id,places.displayName' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`searchText ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
  return (data.places || []).map((p) => ({ id: p.id, name: p.displayName?.text || p.id }));
}

/** Merge unique candidate ids across the category's query variants. No
 *  includedType — rely on resolveAllowedVenueCategory to filter, so synonyms
 *  (bakery, tavern, pub…) aren't dropped by a strict type gate. */
async function searchCandidates(category, city) {
  const seen = new Map();
  for (const q of queriesFor(category, city)) {
    try {
      for (const c of await searchOnce(q, null)) if (!seen.has(c.id)) seen.set(c.id, c);
    } catch (e) { console.log(`  (search "${q}" failed: ${e.message})`); }
  }
  return [...seen.values()];
}

/** Resolve + dedup + ingest up to `want` of `wantCategory`. */
async function ingestBatch(cat, candidates) {
  const out = [];
  for (const c of candidates) {
    if (out.filter((x) => x.status !== 'failed' && x.status !== 'skip').length >= cat.want) break;
    try {
      const details = await fetchGooglePlaceMinimal(c.id, {});
      const category = resolveAllowedVenueCategory(details.categories);
      if (category !== cat.category) { continue; }
      const existing = await findExistingByGooglePlaceId(c.id);
      if (existing) { out.push({ name: details.name || c.name, status: 'exists', id: existing.doc.id }); continue; }
      if (!APPLY) { out.push({ name: details.name || c.name, status: 'would-ingest', city: details.city }); continue; }
      const publishDetails = { ...details, googlePlaceId: c.id, businessType: category };
      let restaurantId;
      try { restaurantId = (await ingestVirtualBusinessFromGoogle(publishDetails)).docId; }
      catch (err) { if (err && err.code === 'place-already-exists' && err.docId) restaurantId = err.docId; else throw err; }
      await getFirestore().collection('restaurants').doc(restaurantId).set({ source: 'script_ingested' }, { merge: true });
      out.push({ name: details.name || c.name, status: 'ingested', id: restaurantId, city: details.city });
    } catch (err) {
      out.push({ name: c.name, status: 'failed', error: err?.message || String(err) });
    }
  }
  const got = out.filter((x) => ['ingested', 'exists', 'would-ingest'].includes(x.status)).length;
  console.log(`\n=== ${cat.label} (target ${cat.want}, got ${got}) ===`);
  out.forEach((x, i) => console.log(`  ${i + 1}. [${x.status}] ${x.name}${x.city ? ` — ${x.city}` : ''}${x.error ? ` :: ${x.error}` : ''}`));
  return got;
}

console.log(`Mode: ${APPLY ? 'APPLY (ingesting)' : 'DRY RUN'} | city: ${CITY}`);
console.log(`Targets: ${CATS.map((c) => `${c.want} ${c.key}`).join(', ')}\n`);
for (const cat of CATS) {
  if (cat.want <= 0) continue;
  const cands = await searchCandidates(cat.category, CITY);
  await ingestBatch(cat, cands);
}
console.log('\nDone.');
process.exit(0);
