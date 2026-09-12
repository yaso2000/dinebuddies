/**
 * TasteScope: callable `tastescopeGenerate` — generate a personal reading (text)
 * or a personal cover (image) with Gemini/Imagen. First of each kind is free;
 * regenerating costs 10 (reading) / 25 (cover) Dine Credits. Never charges on
 * failure. See TASTESCOPE_SPEC Appendix A. CommonJS (functions/ runtime).
 */
const crypto = require('crypto');
const functions = require('firebase-functions');
const { GoogleAuth } = require('google-auth-library');
const vision = require('@google-cloud/vision');
const { isSafeSearchAllowed } = require('./imageModeration');
const { callVertexImagen } = require('./demoUsersImagen');
const { spendCreditsInTransaction } = require('./creditsCore');
const G = require('./tastescopeGen');

const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash';
const GEMINI_LOCATION = process.env.GEMINI_VERTEX_LOCATION?.trim() || 'us-central1';
const GEN_ENABLED = process.env.TASTESCOPE_GEN_ENABLED !== 'false'; // default: on
const PRICE = { reading: 10, cover: 25 };
const DAILY_LIMIT = 5; // successful generations per kind per user per day

function resolveProjectId() {
  return (
    process.env.GCLOUD_PROJECT?.trim() ||
    process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
    (() => { try { return JSON.parse(process.env.FIREBASE_CONFIG || '{}').projectId; } catch { return ''; } })() ||
    'dinebuddies'
  );
}

/** Gemini plain-text generation with a system instruction (Vertex REST). */
async function generateReadingText(system, user, { temperature = 0.9, maxOutputTokens = 700 } = {}) {
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const client = await auth.getClient();
  const url = `https://${GEMINI_LOCATION}-aiplatform.googleapis.com/v1/projects/${resolveProjectId()}/locations/${GEMINI_LOCATION}/publishers/google/models/${GEMINI_MODEL}:generateContent`;
  const res = await client.request({
    url,
    method: 'POST',
    data: {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { temperature, maxOutputTokens },
    },
  });
  return String(res?.data?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
}

let visionClient = null;
function getVisionClient() {
  if (!visionClient) visionClient = new vision.ImageAnnotatorClient();
  return visionClient;
}
/** Run Vision SafeSearch on raw bytes (no upload needed). */
async function moderateImageBytes(buffer) {
  const [result] = await getVisionClient().annotateImage({
    image: { content: buffer.toString('base64') },
    features: [{ type: 'SAFE_SEARCH_DETECTION' }],
  });
  return isSafeSearchAllowed(result?.safeSearchAnnotation || null);
}

/** Upload the cover to the (unguarded) tastescope/ prefix; return a token URL. */
async function uploadCover(admin, uid, buffer, mimeType) {
  const bucket = admin.storage().bucket();
  const ext = mimeType === 'image/webp' ? 'webp' : 'jpg';
  const path = `tastescope/covers/${uid}/${Date.now()}.${ext}`;
  const token = crypto.randomUUID();
  await bucket.file(path).save(buffer, {
    contentType: mimeType,
    resumable: false,
    metadata: {
      cacheControl: 'public, max-age=31536000',
      metadata: {
        firebaseStorageDownloadTokens: token,
        moderatedBy: 'vision-safe-search',
        moderationStatus: 'approved',
      },
    },
  });
  const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
  return { url, path };
}

const todayKey = () => new Date().toISOString().slice(0, 10);

function registerTastescopeGenerate(exports, { db, admin, enforceCallableRateLimit }) {
  exports.tastescopeGenerate = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
    const uid = context.auth.uid;
    const kind = data?.kind === 'cover' ? 'cover' : data?.kind === 'reading' ? 'reading' : null;
    const locale = data?.locale === 'en' ? 'en' : 'ar';
    if (!kind) throw new functions.https.HttpsError('invalid-argument', 'kind must be reading or cover.');
    if (!GEN_ENABLED) throw new functions.https.HttpsError('failed-precondition', 'TasteScope generation is disabled.');

    // Cheap abuse guard (separate from the daily success limit below).
    await enforceCallableRateLimit(uid, `tastescope_gen_${kind}`, { cooldownMs: 4000, perHour: 20 });

    const userRef = db.collection('users').doc(uid);
    const snap = await userRef.get();
    if (!snap.exists) throw new functions.https.HttpsError('not-found', 'No profile.');
    const user = snap.data() || {};
    const ts = user.tasteScope || {};
    if (!ts.titleId || !G.isValidAnswers(ts.answers)) {
      throw new functions.https.HttpsError('failed-precondition', 'Take the quiz first.');
    }

    const prev = (ts.generated && ts.generated[kind]) || {};
    const count = Number(prev.count) || 0;
    const price = count === 0 ? 0 : PRICE[kind];

    const today = todayKey();
    const dayCount = prev.day === today ? (Number(prev.dayCount) || 0) : 0;
    if (dayCount >= DAILY_LIMIT) return { ok: false, reason: 'rate_limited' };

    // Balance pre-check — never call the model if the user can't pay.
    if (price > 0) {
      const balance = (Number(user.paidCredits) || 0) + (Number(user.savedCredits) || 0);
      if (balance < price) return { ok: false, reason: 'insufficient_credits', price };
    }

    const gender = G.genderWord(user.gender);
    const country = user.country || (user.businessInfo && user.businessInfo.country) || '';
    const countryCode = user.countryCode || (user.businessInfo && user.businessInfo.countryCode) || '';

    const startedAt = Date.now();
    let payload;
    try {
      if (kind === 'reading') {
        const userMsg = G.buildReadingUserMessage({
          locale,
          gender,
          titleName: G.titleDisplayName(ts.titleId, gender, locale),
          titleEn: G.titleDisplayName(ts.titleId, 'masculine', 'en'),
          runnerUpName: G.titleDisplayName(ts.runnerUpId, gender, locale),
          country,
          answers: ts.answers,
        });
        let text = G.postProcessReading(await generateReadingText(G.READING_SYSTEM, userMsg));
        if (!G.validateReading(text).ok) {
          text = G.postProcessReading(await generateReadingText(G.READING_SYSTEM, userMsg)); // retry once
        }
        if (!G.validateReading(text).ok) return { ok: false, reason: 'generation_failed' };
        payload = { text };
      } else {
        const prompt = G.buildCoverPrompt({ titleId: ts.titleId, answers: ts.answers, countryCode });
        let img = await callVertexImagen(prompt, '16:9', 'cover');
        if (!(await moderateImageBytes(img.buffer))) {
          img = await callVertexImagen(prompt, '16:9', 'cover'); // retry once
          if (!(await moderateImageBytes(img.buffer))) return { ok: false, reason: 'generation_failed' };
        }
        const up = await uploadCover(admin, uid, img.buffer, img.mimeType || 'image/jpeg');
        payload = { url: up.url };
      }
    } catch (err) {
      console.error('[tastescopeGenerate] model failure', kind, err && err.message);
      return { ok: false, reason: 'generation_failed' };
    }
    console.info('[tastescopeGenerate] ok', kind, 'ms=', Date.now() - startedAt, 'price=', price);

    // Debit (if not free) + persist, atomically. Past this point generation
    // already succeeded, so we only ever charge for a delivered result.
    try {
      await db.runTransaction(async (tx) => {
        const s = await tx.get(userRef);
        const u = s.data() || {};
        const p2 = (u.tasteScope && u.tasteScope.generated && u.tasteScope.generated[kind]) || {};
        const day2 = p2.day === today ? (Number(p2.dayCount) || 0) : 0;
        if (day2 >= DAILY_LIMIT) { const e = new Error('rate'); e.code = 'RATE'; throw e; }
        if (price > 0) {
          spendCreditsInTransaction(tx, userRef, u, {
            uid,
            accountRole: 'user',
            amount: price,
            type: `tastescope_${kind}`,
            reason: `tastescope_${kind}_generate`,
            relatedId: ts.titleId,
            allowSavedCredits: true,
          });
        }
        const now = admin.firestore.FieldValue.serverTimestamp();
        const node = kind === 'reading'
          ? { text: payload.text, locale, createdAt: now, count: (Number(p2.count) || 0) + 1, day: today, dayCount: day2 + 1 }
          : { url: payload.url, createdAt: now, count: (Number(p2.count) || 0) + 1, day: today, dayCount: day2 + 1 };
        const update = { [`tasteScope.generated.${kind}`]: node };
        if (kind === 'cover') update['tasteScope.coverUrl'] = payload.url;
        tx.update(userRef, update);
      });
    } catch (err) {
      if (err && err.code === 'INSUFFICIENT_CREDITS') return { ok: false, reason: 'insufficient_credits', price };
      if (err && err.code === 'RATE') return { ok: false, reason: 'rate_limited' };
      throw err;
    }

    return { ok: true, ...(kind === 'reading' ? { text: payload.text } : { url: payload.url }), charged: price };
  });
}

module.exports = { registerTastescopeGenerate };
