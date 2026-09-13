/**
 * Generate pictorial TasteScope title icons with "Nano Banana"
 * (Gemini 2.5 Flash Image, Vertex). One square PNG per title, consistent style,
 * on a rounded badge in the title's accent color.
 *
 * Auth: the Firebase service account in .env (must have Vertex AI access).
 * Usage:
 *   node --use-system-ca scripts/gen-tastescope-icons.mjs                 # all 10 → public/tastescope/icons
 *   node --use-system-ca scripts/gen-tastescope-icons.mjs explorer host   # only these
 *   node --use-system-ca scripts/gen-tastescope-icons.mjs --out <dir>     # custom output dir
 */
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { mkdirSync, writeFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

const { getFirebaseAdminCertConfig } = await import(pathToFileURL(resolve(__dirname, '../api/_firebaseAdmin.js')).href);
const { GoogleAuth } = await import('google-auth-library');

const MODEL = process.env.VERTEX_GEMINI_IMAGE_MODEL?.trim() || 'gemini-2.5-flash-image';

const ACCENT = {
  explorer: 'deep teal', authentic: 'burnt orange', connoisseur: 'charcoal with gold',
  host: 'terracotta', serene: 'sage green', fiery: 'deep red', dreamer: 'dusty rose',
  disciplined: 'slate blue', companion: 'warm mustard', warm: 'honey gold',
};
const SUBJECT = {
  explorer: 'a golden compass crossed with a fork, a hint of a folded map behind',
  authentic: 'a rustic ceramic bowl of a homemade stew with a torn piece of bread',
  connoisseur: 'an elegant silver serving cloche dome with a small sparkle',
  host: 'two open welcoming hands offering a big shared platter of food',
  serene: 'a steaming cup of tea with a single fresh green leaf',
  fiery: 'a bright red chili pepper wrapped in a lively flame',
  dreamer: 'a dreamy frosted cupcake topped with a star and soft sparkles',
  disciplined: 'a neat balanced plate with tidy portions and a small check mark',
  companion: 'two coffee cups gently clinking together',
  warm: 'a cozy warm mug with heart-shaped rising steam and a tiny house',
};
const ALL = Object.keys(SUBJECT);

function prompt(id) {
  return [
    'Ultra-detailed glossy 3D render, premium product illustration, square 1:1 composition, one hero object centered and filling the frame.',
    'Dramatic studio lighting with soft reflections, glossy highlights, gentle rim light and a subtle glow; rich saturated colors, smooth realistic materials, shallow depth of field.',
    `Set on a warm, softly-glowing gradient background dominated by ${ACCENT[id]}, with a soft shadow beneath the object.`,
    'Polished, appetizing, high-end mobile-game-icon look. No text, no letters, no numbers, no labels, no logo, no watermark, no border.',
    `Hero object: ${SUBJECT[id]}, rendered as a shiny 3D object.`,
  ].join('\n');
}

const args = process.argv.slice(2);
let outDir = resolve(__dirname, '../public/tastescope/icons');
const outIdx = args.indexOf('--out');
if (outIdx !== -1) { outDir = resolve(process.cwd(), args[outIdx + 1]); args.splice(outIdx, 2); }
const targets = args.length ? args.filter((a) => ALL.includes(a)) : ALL;
mkdirSync(outDir, { recursive: true });

const cfg = getFirebaseAdminCertConfig();
const auth = new GoogleAuth({
  credentials: { client_email: cfg.clientEmail, private_key: cfg.privateKey },
  projectId: cfg.projectId,
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});
const client = await auth.getClient();

async function genOne(id) {
  const body = { contents: [{ role: 'user', parts: [{ text: prompt(id) }] }], generationConfig: { responseModalities: ['IMAGE'] } };
  const locs = ['us-central1', 'global'];
  let lastErr = 'unknown';
  for (const loc of locs) {
    const host = loc === 'global' ? 'aiplatform.googleapis.com' : `${loc}-aiplatform.googleapis.com`;
    const url = `https://${host}/v1/projects/${cfg.projectId}/locations/${loc}/publishers/google/models/${MODEL}:generateContent`;
    try {
      const res = await client.request({ url, method: 'POST', data: body });
      const parts = res?.data?.candidates?.[0]?.content?.parts || [];
      const img = parts.find((p) => p?.inlineData?.data)?.inlineData;
      if (img?.data) {
        const file = resolve(outDir, `${id}.png`);
        writeFileSync(file, Buffer.from(img.data, 'base64'));
        return file;
      }
      lastErr = `no image @${loc}`;
    } catch (e) {
      lastErr = `${e?.response?.data?.error?.message || e?.message} @${loc}`;
    }
  }
  throw new Error(lastErr);
}

console.log(`Model: ${MODEL} | project: ${cfg.projectId} | out: ${outDir}`);
for (const id of targets) {
  try {
    const file = await genOne(id);
    console.log(`  ✓ ${id} → ${file}`);
  } catch (e) {
    console.log(`  ✗ ${id}: ${e.message}`);
  }
}
console.log('Done.');
