import dotenv from 'dotenv';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { GoogleAuth } from 'google-auth-library';
dotenv.config();

initializeApp({
  credential: cert({
    projectId: 'dinebuddies',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: String(process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  }),
});
const db = getFirestore();
const auth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  credentials: {
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    private_key: String(process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  },
});
const PROJECT = 'dinebuddies';
const LOCATION = 'us-central1';
const MODEL = 'gemini-2.5-flash';

const SIGNS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];

function pickDistractors(correct, n = 2) {
  const pool = SIGNS.filter((s) => s !== correct);
  const out = [];
  while (out.length < n && pool.length) {
    const i = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

async function generate(client) {
  const prompt = [
    'You are creating a fun "guess the zodiac sign" party game based on the personality traits popular astrology sites commonly associate with each sign.',
    'Produce 24 clue items. Each clue lists 3-4 personality traits strongly associated (per mainstream Western astrology) with ONE specific sign — distinctive enough to guess.',
    'Cover ALL 12 signs at least once (aries, taurus, gemini, cancer, leo, virgo, libra, scorpio, sagittarius, capricorn, aquarius, pisces).',
    'Give the traits in BOTH Arabic (ar) and English (en), natural and concise (one sentence).',
    'Return a JSON array only, each item exactly: {"ar":"...","en":"...","sign":"<one sign key>"}',
  ].join('\n');
  const url = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${LOCATION}/publishers/google/models/${MODEL}:generateContent`;
  const res = await client.request({
    url, method: 'POST',
    data: { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.8 } },
  });
  const raw = String(res?.data?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
  try { return JSON.parse(raw); } catch { const a = raw.indexOf('['); const b = raw.lastIndexOf(']'); return JSON.parse(raw.slice(a, b + 1)); }
}

async function run() {
  const client = await auth.getClient();
  const items = await generate(client);
  if (!Array.isArray(items)) { console.error('bad AI output'); process.exit(1); }
  let n = 0;
  for (let i = 0; i < items.length; i += 1) {
    const q = items[i];
    const ar = String(q?.ar || '').trim();
    const en = String(q?.en || '').trim();
    const sign = String(q?.sign || '').trim().toLowerCase();
    if (!en || !SIGNS.includes(sign)) continue;
    const opts = [sign, ...pickDistractors(sign, 2)];
    // shuffle options, track correct index
    for (let k = opts.length - 1; k > 0; k -= 1) { const j = Math.floor(Math.random() * (k + 1)); [opts[k], opts[j]] = [opts[j], opts[k]]; }
    const correctIndex = opts.indexOf(sign);
    const id = `zq_${String(i + 1).padStart(3, '0')}`;
    await db.collection('zodiac_questions').doc(id).set({
      category: 'zodiac', type: 'guess', active: true,
      text: { ar: ar || en, en },
      signs: opts,          // sign keys; client maps to icon + localized name
      correctIndex,
    });
    n += 1;
  }
  console.log('seeded zodiac questions:', n);
  process.exit(0);
}
run().catch((e) => { console.error(e); process.exit(1); });
