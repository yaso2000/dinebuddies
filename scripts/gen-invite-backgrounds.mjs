/**
 * Generate SOCIAL-invitation card backgrounds with "Nano Banana" (Gemini 2.5
 * Flash Image, Vertex) — 5 art styles per occasion category, SQUARE 1:1, webp.
 *
 * Auth: the Firebase service account in .env (Vertex AI access).
 * Output: public/invitation-card-backgrounds/<category>/<category>-<style>.webp
 *         (1024×1024, ≤~140 KB). Skips existing unless --force.
 * Usage:
 *   node --use-system-ca scripts/gen-invite-backgrounds.mjs                 # all missing
 *   node --use-system-ca scripts/gen-invite-backgrounds.mjs --category social
 *   node --use-system-ca scripts/gen-invite-backgrounds.mjs --style cinema
 *   node --use-system-ca scripts/gen-invite-backgrounds.mjs --limit 3
 *   node --use-system-ca scripts/gen-invite-backgrounds.mjs --force
 */
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { mkdirSync, existsSync } from 'fs';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

const { getFirebaseAdminCertConfig } = await import(pathToFileURL(resolve(__dirname, '../api/_firebaseAdmin.js')).href);
const { GoogleAuth } = await import('google-auth-library');

const MODEL = process.env.VERTEX_GEMINI_IMAGE_MODEL?.trim() || 'gemini-2.5-flash-image';
const BASE_OUT = resolve(__dirname, '../public/invitation-card-backgrounds');

// Occasion categories (match CARD_BACKGROUNDS_BY_CATEGORY) + a warm scene each.
// Scenes are ambient (no identifiable real people needed — illustrative styles).
const CATEGORIES = {
  social: 'a warm, lively social get-together of friends sharing food and laughter around a cozy restaurant table, welcoming celebratory evening ambiance',
  // friendship is handled specially below (10 images, varied group compositions).
  family: 'a loving family gathering around a generous dinner table at home, cozy warm candlelight, togetherness and comfort',
  work: 'polished professional colleagues (men and women) meeting over coffee in an elegant modern restaurant, confident collaborative business-dinner ambiance',
  acquaintance: 'two new acquaintances (a man and a woman) meeting for the first time over coffee at a calm friendly café, light, open, welcoming first-meeting mood',
};

// Friendship: 10 images, each a small group (~3 friends) with a DIFFERENT gender
// mix so the set is diverse (not all women), rotating through the 5 art styles.
const FRIENDSHIP_BASE = 'a warm, joyful group of young-adult friends hanging out together at a cozy café/restaurant, sharing food and laughter, heartfelt camaraderie';
const FRIENDSHIP_GROUPS = [
  'three friends: two young women and one young man',
  'three friends: three young men (all male buddies)',
  'three friends: three young women',
  'three friends: two young men and one young woman',
  'a mixed group of four friends: two men and two women',
  'three friends: one young man and two young women, casually chatting',
  'a lively group of four young men, close male friends',
  'a mixed group of three friends: a man and two women toasting',
  'three cheerful young women friends together',
  'a diverse group of five friends, men and women mixed evenly',
];

// Art styles → filename/id suffix + style clause.
const STYLES = {
  cinema: 'Cinematic movie-poster style: dramatic volumetric lighting, rich teal-and-orange color grade, filmic depth, 35mm grain, epic atmospheric mood.',
  cartoon: 'Modern flat cartoon illustration style: bold clean vector shapes, cheerful saturated colors, playful friendly design, smooth gradients.',
  anime: 'Anime / manga art style: expressive cel-shading, luminous warm lighting, vibrant Ghibli-like painterly backgrounds, soft glow.',
  '3d': '3D rendered Pixar-style: soft global illumination, glossy rounded forms, cute charming characters, cinematic depth of field.',
  classic: 'Classic Victorian oil-painting style: ornate antique elegance, warm sepia and gold tones, refined brushwork, vintage decorative framing feel.',
};

function prompt(scene, styleClause) {
  return [
    `An elegant invitation card BACKGROUND illustration depicting ${scene}.`,
    styleClause,
    'Square 1:1 composition designed as a card backdrop: reserve a clean, calm, softly neutral area in the CENTER of the frame (gentle uncluttered negative space / subtle vignette) so overlaid title text sits there and stays perfectly readable; push the detailed scene toward the edges/corners; tasteful, premium, inviting.',
    'Absolutely NO text, NO letters, NO numbers, NO words, NO watermark, NO logo, NO UI, NO borders or frames drawn on the image.',
  ].join('\n');
}

// ---- args ----
const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const takeVal = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };
const onlyCategory = takeVal('--category');
const onlyStyle = takeVal('--style');
const limit = Number(takeVal('--limit')) || 0;

const STYLE_KEYS = Object.keys(STYLES);
let jobs = [];

// Standard categories: 5 styles each.
for (const [category, scene] of Object.entries(CATEGORIES)) {
  if (onlyCategory && category !== onlyCategory) continue;
  for (const [style, styleClause] of Object.entries(STYLES)) {
    if (onlyStyle && style !== onlyStyle) continue;
    jobs.push({ category, style, scene, styleClause, id: `${category}-${style}` });
  }
}

// Friendship: 10 varied-composition images, styles rotated across the set.
if (!onlyCategory || onlyCategory === 'friendship') {
  FRIENDSHIP_GROUPS.forEach((group, i) => {
    const style = STYLE_KEYS[i % STYLE_KEYS.length];
    if (onlyStyle && style !== onlyStyle) return;
    jobs.push({
      category: 'friendship',
      style,
      scene: `${FRIENDSHIP_BASE} — ${group}`,
      styleClause: STYLES[style],
      id: `friendship-${i + 1}`,
    });
  });
}
let todo = jobs.filter((j) => FORCE || !existsSync(resolve(BASE_OUT, j.category, `${j.id}.webp`)));
if (limit) todo = todo.slice(0, limit);

const cfg = getFirebaseAdminCertConfig();
const auth = new GoogleAuth({
  credentials: { client_email: cfg.clientEmail, private_key: cfg.privateKey },
  projectId: cfg.projectId,
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});
const client = await auth.getClient();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function genOne(text) {
  const body = { contents: [{ role: 'user', parts: [{ text }] }], generationConfig: { responseModalities: ['IMAGE'] } };
  const locs = ['us-central1', 'global'];
  let lastErr = 'unknown';
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
        if (exhausted) { await sleep(15000 * (attempt + 1)); break; }
      }
    }
  }
  throw new Error(lastErr);
}

console.log(`Model: ${MODEL} | project: ${cfg.projectId}`);
console.log(`To generate: ${todo.length} of ${jobs.length}\n`);
let ok = 0, fail = 0;
for (const j of todo) {
  try {
    const png = await genOne(prompt(j.scene, j.styleClause));
    const dir = resolve(BASE_OUT, j.category);
    mkdirSync(dir, { recursive: true });
    const out = resolve(dir, `${j.id}.webp`);
    await sharp(png).resize(1024, 1024, { fit: 'cover', position: 'centre' }).webp({ quality: 82 }).toFile(out);
    ok++;
    console.log(`  ✓ ${j.id}`);
  } catch (err) {
    fail++;
    console.log(`  ✗ ${j.id}: ${err.message}`);
  }
  await sleep(2000);
}
console.log(`\nDone. ${ok} ok, ${fail} failed.`);
process.exit(0);
