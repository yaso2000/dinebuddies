#!/usr/bin/env node
/**
 * Batch-import restaurants from Google Places into DineBuddies using the SAME
 * pipeline as the admin "Import from Google" page (api/_virtualBusinessIngest.js):
 * restaurants/{placeId} + public_profiles/{placeId}, cover photo uploaded to Storage,
 * duplicate check by placeId.
 *
 * Usage (from project root, on your own machine):
 *   node scripts/import-google-places-batch.mjs --city "Mansoura" --region EG \
 *        --lat 31.0409 --lng 31.3785 --radius 8000 --limit 20 --lang ar --dry-run
 *   Add --type cafe (or bar, bakery, ...) to import a different Google place type.
 *
 * Drop --dry-run to actually import. Env comes from .env / .env.local; the Firebase
 * service account falls back to service-account-key.json in the project root.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ---------- args ----------
const args = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) { args[a.slice(2)] = next; i += 1; } else args[a.slice(2)] = 'true';
}
const CITY = args.city || 'Mansoura';
const REGION = (args.region || 'EG').toUpperCase();
const LAT = Number(args.lat ?? 31.0409);
const LNG = Number(args.lng ?? 31.3785);
const RADIUS = Number(args.radius ?? 8000);
const LIMIT = Math.min(Number(args.limit ?? 20), 60);
const LANG = args.lang || 'ar';
const TYPE = (args.type || 'restaurant').trim(); // Places type: restaurant, cafe, bar, bakery, ...
const QUERY = args.query || `${TYPE === 'cafe' ? 'cafes' : `${TYPE}s`} in ${CITY}`;
const DRY = args['dry-run'] === 'true';

// ---------- env ----------
function loadEnvFile(p) {
    if (!fs.existsSync(p)) return;
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
}
// The browser key in .env.local is HTTP-referrer restricted (Google rejects server calls with
// "Requests from referer <empty> are blocked"), so take ONLY the Places key from the Vercel env file.
(function loadVercelPlacesKey() {
    const p = path.join(ROOT, '.env.vercel.production');
    if (!fs.existsSync(p)) return;
    const m = fs.readFileSync(p, 'utf8').match(/^\s*GOOGLE_PLACES_API_KEY\s*=\s*(.+)\s*$/m);
    const v = m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
    if (v && !process.env.GOOGLE_PLACES_API_KEY) process.env.GOOGLE_PLACES_API_KEY = v;
})();
loadEnvFile(path.join(ROOT, '.env.local'));
loadEnvFile(path.join(ROOT, '.env'));
// Firebase Admin: the service-account JSON in the project root is authoritative (the
// FIREBASE_PRIVATE_KEY lines in .env files are formatted for Vercel and often fail locally).
{
    const sa = path.join(ROOT, 'service-account-key.json');
    if (fs.existsSync(sa)) {
        process.env.FIREBASE_SERVICE_ACCOUNT_JSON = fs.readFileSync(sa, 'utf8');
        delete process.env.FIREBASE_PRIVATE_KEY;
        delete process.env.FIREBASE_PRIVATE_KEY_ID;
        delete process.env.FIREBASE_CLIENT_EMAIL;
    }
}
const API_KEY =
    process.env.GOOGLE_PLACES_API_KEY ||
    process.env.GOOGLE_MAPS_SERVER_KEY ||
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY;
if (!API_KEY) {
    console.error('Missing GOOGLE_PLACES_API_KEY (.env.local)');
    process.exit(1);
}

/** Square bounding box of `radiusM` metres around a point, as Places API viewport. */
function boundingBox(lat, lng, radiusM) {
    const dLat = radiusM / 111320;
    const dLng = radiusM / (111320 * Math.cos((lat * Math.PI) / 180));
    return {
        low: { latitude: lat - dLat, longitude: lng - dLng },
        high: { latitude: lat + dLat, longitude: lng + dLng },
    };
}

// ---------- Places Text Search (New) — ids only, cheapest SKU ----------
async function searchText(pageToken) {
    const body = {
        textQuery: QUERY,
        languageCode: LANG,
        regionCode: REGION,
        includedType: TYPE,
        strictTypeFiltering: true,
        pageSize: 20,
        // Text Search only accepts a rectangle for locationRestriction (circle is bias-only).
        locationRestriction: { rectangle: boundingBox(LAT, LNG, RADIUS) },
    };
    if (pageToken) body.pageToken = pageToken;
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': API_KEY,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.businessStatus,nextPageToken',
        },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Places API ${res.status}: ${await res.text()}`);
    return res.json();
}

async function findCandidates() {
    const out = [];
    let token;
    do {
        const data = await searchText(token);
        for (const p of data.places || []) {
            if (p.businessStatus && p.businessStatus !== 'OPERATIONAL') continue;
            out.push(p);
            if (out.length >= LIMIT) return out;
        }
        token = data.nextPageToken;
        if (token) await new Promise((r) => setTimeout(r, 1500));
    } while (token && out.length < LIMIT);
    return out;
}

// ---------- main ----------
async function main() {
    console.log(`Query "${QUERY}" | type=${TYPE} | lang=${LANG} region=${REGION} | circle ${LAT},${LNG} r=${RADIUS}m | limit ${LIMIT}${DRY ? ' | DRY RUN' : ''}`);
    const candidates = await findCandidates();
    console.log(`Google returned ${candidates.length} operational restaurants.\n`);
    candidates.forEach((p, i) => console.log(`${String(i + 1).padStart(2)}. ${p.displayName?.text} — ${p.formattedAddress} [${p.id}]`));
    if (DRY) {
        console.log('\nDry run: nothing written.');
        return;
    }

    // Same modules the admin import endpoint uses.
    const { fetchGooglePlaceMinimal } = await import(pathToFileURL(path.join(ROOT, 'api', '_googlePlacesMinimal.js')).href);
    const { ingestVirtualBusinessFromGoogle } = await import(pathToFileURL(path.join(ROOT, 'api', '_virtualBusinessIngest.js')).href);

    let created = 0;
    let skipped = 0;
    let failed = 0;
    console.log('');
    for (const p of candidates) {
        const label = p.displayName?.text || p.id;
        try {
            const details = await fetchGooglePlaceMinimal(p.id, { languageCode: LANG });
            const result = await ingestVirtualBusinessFromGoogle(details);
            created += 1;
            console.log(`created  restaurants/${result.docId}  ${label}`);
        } catch (e) {
            if (e?.code === 'place-already-exists') {
                skipped += 1;
                console.log(`skip     already imported: ${label}`);
            } else {
                failed += 1;
                console.error(`FAILED   ${label}: ${e?.message || e}`);
            }
        }
    }
    console.log(`\nDone. created=${created} skipped=${skipped} failed=${failed}`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
