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

async function generate(client) {
  const prompt = [
    'Create 28 lighthearted "Most Likely To" party-game prompts for a friendly social + dating app.',
    'Each prompt completes "Who is most likely to ..." — fun, kind, inclusive; NOTHING mean, sexual, political, or offensive.',
    'Mix everyday, funny, adventurous and sweet scenarios (e.g. be late to everything, travel the world, become famous, cry at movies, eat the last slice, forget their keys).',
    'Give each in BOTH Arabic (ar) and English (en), phrased as a complete question starting with the local equivalent of "Who is most likely to".',
    'Return a JSON array only, each item exactly: {"ar":"...","en":"..."}',
  ].join('\n');
  const url = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${LOCATION}/publishers/google/models/${MODEL}:generateContent`;
  const res = await client.request({
    url, method: 'POST',
    data: { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.9 } },
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
    const ar = String(items[i]?.ar || '').trim();
    const en = String(items[i]?.en || '').trim();
    if (!en) continue;
    const id = `ml_${String(i + 1).padStart(3, '0')}`;
    await db.collection('most_likely_questions').doc(id).set({
      category: 'social', type: 'prompt', active: true,
      text: { ar: ar || en, en },
    });
    n += 1;
  }
  console.log('seeded most-likely prompts:', n);
  process.exit(0);
}
run().catch((e) => { console.error(e); process.exit(1); });
