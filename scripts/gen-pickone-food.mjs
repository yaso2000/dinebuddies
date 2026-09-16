/**
 * Generate Pick One FOOD images with "Nano Banana" (Gemini 2.5 Flash Image,
 * Vertex) — appetizing 3:4 food photos, one per entry, compressed to webp.
 *
 * Auth: the Firebase service account in .env (Vertex AI access).
 * Output: public/pickone/foods/<id>.webp (768×1024, ≤~120 KB). Skips existing.
 * Usage:
 *   node --use-system-ca scripts/gen-pickone-food.mjs                 # all missing
 *   node --use-system-ca scripts/gen-pickone-food.mjs kabsa pizza     # only these ids
 *   node --use-system-ca scripts/gen-pickone-food.mjs --list foods-arab
 *   node --use-system-ca scripts/gen-pickone-food.mjs --limit 3       # first N missing
 *   node --use-system-ca scripts/gen-pickone-food.mjs --force         # regenerate existing
 */
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { mkdirSync, existsSync } from 'fs';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

const { getFirebaseAdminCertConfig } = await import(pathToFileURL(resolve(__dirname, '../api/_firebaseAdmin.js')).href);
const { LISTS } = await import(pathToFileURL(resolve(__dirname, '../src/features/pickone/pickoneData.js')).href);
const { GoogleAuth } = await import('google-auth-library');

const MODEL = process.env.VERTEX_GEMINI_IMAGE_MODEL?.trim() || 'gemini-2.5-flash-image';
const OUT_DIR = resolve(__dirname, '../public/pickone/foods');

function prompt(name) {
  return [
    `Professional appetizing food photography of ${name}, a single hero serving beautifully plated.`,
    'Fresh vibrant ingredients, mouth-watering, rich natural colors, soft studio lighting, gentle steam where natural, shallow depth of field, high detail, glossy appetizing look.',
    'Vertical 3:4 portrait composition, the dish centered and filling the frame, clean softly-blurred neutral background.',
    'No text, no letters, no numbers, no watermark, no logo, no hands, no cutlery brand, no border.',
  ].join('\n');
}

// ---- args ----
const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const takeVal = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };
const onlyList = takeVal('--list');
const limit = Number(takeVal('--limit')) || 0;
const idFilter = args.filter((a) => !a.startsWith('--') && a !== onlyList && a !== String(limit || ''));

let entries = [];
for (const l of LISTS) {
  if (onlyList && l.id !== onlyList) continue;
  for (const e of l.entries) entries.push({ id: e.id, name: e.name.en, list: l.id });
}
if (idFilter.length) entries = entries.filter((e) => idFilter.includes(e.id));
mkdirSync(OUT_DIR, { recursive: true });
let todo = entries.filter((e) => FORCE || !existsSync(resolve(OUT_DIR, `${e.id}.webp`)));
if (limit) todo = todo.slice(0, limit);

const cfg = getFirebaseAdminCertConfig();
const auth = new GoogleAuth({
  credentials: { client_email: cfg.clientEmail, private_key: cfg.privateKey },
  projectId: cfg.projectId,
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});
const client = await auth.getClient();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function genOne(name) {
  const body = { contents: [{ role: 'user', parts: [{ text: prompt(name) }] }], generationConfig: { responseModalities: ['IMAGE'] } };
  const locs = ['us-central1', 'global'];
  let lastErr = 'unknown';
  // Retry with backoff on quota/rate-limit exhaustion.
  for (let attempt = 0; attempt < 5; attempt++) {
    for (const loc of locs) {
      const host = loc === 'global' ? 'aiplatform.googleapis.com' : `${loc}-aiplatform.googleapis.com`;
      const url = `https://${host}/v1/projects/${cfg.projectId}/locations/${loc}/publishers/google/models/${MODEL}:generateContent`;
      try {
        const res = await client.request({ url, method: 'POST', data: body });
        const parts = res?.data?.candidates?.[0]?.content?.parts || [];
        const img = parts.find((p) => p?.inlineData?.data)?.inlineData;
        if (img?.data) return Buffer.from(img.data, 'base64');
        lastErr = `no image @${loc}`;
      } catch (e) {
        lastErr = `${e?.response?.data?.error?.message || e?.message} @${loc}`;
        const exhausted = /exhaust|quota|429|RESOURCE_EXHAUSTED|rate/i.test(lastErr);
        if (exhausted) { await sleep(15000 * (attempt + 1)); break; } // wait, then retry outer
      }
    }
  }
  throw new Error(lastErr);
}

console.log(`Model: ${MODEL} | project: ${cfg.projectId}`);
console.log(`To generate: ${todo.length} of ${entries.length} (out: ${OUT_DIR})\n`);
let ok = 0, fail = 0;
for (const e of todo) {
  try {
    const png = await genOne(e.name);
    const out = resolve(OUT_DIR, `${e.id}.webp`);
    await sharp(png).resize(768, 1024, { fit: 'cover', position: 'centre' }).webp({ quality: 80 }).toFile(out);
    ok++;
    console.log(`  ✓ [${e.list}] ${e.id} (${e.name})`);
  } catch (err) {
    fail++;
    console.log(`  ✗ ${e.id}: ${err.message}`);
  }
  await sleep(2000); // gentle pacing to stay under the per-minute image quota
}
console.log(`\nDone. ${ok} ok, ${fail} failed.`);
process.exit(0);
