import dotenv from 'dotenv';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { GoogleAuth } from 'google-auth-library';
dotenv.config();

const PROJECT = 'dinebuddies';
const LOCATION = 'us-central1';
const MODEL = 'gemini-2.5-flash';
const TARGET_LANGS = ['fr', 'es', 'it', 'de', 'pt', 'tr', 'ur', 'hi'];

initializeApp({
  credential: cert({
    projectId: PROJECT,
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

async function translateOne(client, enText, enOptions) {
  const prompt = [
    'Translate this short "this or that" compatibility-quiz item into these languages:',
    TARGET_LANGS.join(', ') + '.',
    `text (English): ${JSON.stringify(enText)}`,
    `options (English): ${JSON.stringify(enOptions)}`,
    'Keep options as short as the English (one or two words). Natural, casual tone.',
    'Return JSON only, no prose, exactly this shape:',
    '{' + TARGET_LANGS.map((l) => `"${l}":{"text":"...","options":["...","..."]}`).join(',') + '}',
  ].join('\n');

  const url = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${LOCATION}/publishers/google/models/${MODEL}:generateContent`;
  const res = await client.request({
    url,
    method: 'POST',
    data: {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
    },
  });
  const raw = res?.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const s = String(raw).trim();
  try { return JSON.parse(s); } catch {
    const a = s.indexOf('{'); const b = s.lastIndexOf('}');
    return JSON.parse(s.slice(a, b + 1));
  }
}

async function run() {
  const client = await auth.getClient();
  const snap = await db.collection('compat_questions').get();
  let done = 0, skipped = 0, failed = 0;
  for (const docSnap of snap.docs) {
    const q = docSnap.data() || {};
    const text = q.text || {};
    const options = q.options || {};
    const missing = TARGET_LANGS.filter((l) => !text[l] || !Array.isArray(options[l]));
    if (!missing.length) { skipped += 1; continue; }
    const enText = text.en || text.ar || '';
    const enOptions = options.en || options.ar || [];
    try {
      const tr = await translateOne(client, enText, enOptions);
      const nextText = { ...text };
      const nextOptions = { ...options };
      for (const l of TARGET_LANGS) {
        if (tr[l]?.text) nextText[l] = String(tr[l].text);
        if (Array.isArray(tr[l]?.options) && tr[l].options.length === enOptions.length) {
          nextOptions[l] = tr[l].options.map(String);
        }
      }
      await docSnap.ref.update({ text: nextText, options: nextOptions });
      done += 1;
      console.log('translated', docSnap.id);
    } catch (e) {
      failed += 1;
      console.error('FAILED', docSnap.id, e?.response?.status || '', String(e?.message || e).slice(0, 120));
    }
  }
  console.log(`done=${done} skipped=${skipped} failed=${failed}`);
  process.exit(failed && !done ? 1 : 0);
}
run().catch((e) => { console.error(e); process.exit(1); });
