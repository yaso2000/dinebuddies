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
// "Nano Banana" — Gemini 2.5 Flash Image (primary cover generator).
const GEMINI_IMAGE_MODEL = process.env.VERTEX_GEMINI_IMAGE_MODEL?.trim() || 'gemini-2.5-flash-image';
const GEN_ENABLED = process.env.TASTESCOPE_GEN_ENABLED !== 'false'; // default: on
const PRICE = { reading: 10, cover: 25 }; // legacy per-kind (old callable)
const DAILY_LIMIT = 5; // tests per user per day (also legacy per-kind cap)
const RETAKE_PRICE = 150; // full retake before the free window reopens
const FREE_WINDOW_MS = 90 * 24 * 60 * 60 * 1000; // one free test every 90 days

const toMillis = (v) => {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  if (typeof v.toMillis === 'function') return v.toMillis();
  const p = Date.parse(v);
  return Number.isFinite(p) ? p : 0;
};

function resolveProjectId() {
  return (
    process.env.GCLOUD_PROJECT?.trim() ||
    process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
    (() => { try { return JSON.parse(process.env.FIREBASE_CONFIG || '{}').projectId; } catch { return ''; } })() ||
    'dinebuddies'
  );
}

/** Gemini plain-text generation with a system instruction (Vertex REST). */
async function generateReadingText(system, user, { temperature = 0.9, maxOutputTokens = 1024 } = {}) {
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const client = await auth.getClient();
  const url = `https://${GEMINI_LOCATION}-aiplatform.googleapis.com/v1/projects/${resolveProjectId()}/locations/${GEMINI_LOCATION}/publishers/google/models/${GEMINI_MODEL}:generateContent`;
  const res = await client.request({
    url,
    method: 'POST',
    data: {
      systemInstruction: { role: 'system', parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      // gemini-2.5-flash "thinks" by default and spends thinking tokens out of
      // maxOutputTokens — with a tight budget the visible text comes back empty.
      // Disable thinking and give the answer room (Arabic tokenizes heavily).
      generationConfig: { temperature, maxOutputTokens, thinkingConfig: { thinkingBudget: 0 } },
    },
  });
  const cand = res?.data?.candidates?.[0];
  const text = (cand?.content?.parts || []).map((p) => p?.text || '').join('').trim();
  if (!text) {
    const why = cand?.finishReason || res?.data?.promptFeedback?.blockReason || 'empty';
    const e = new Error(`no reading text (${why})`);
    e.code = 'reading-empty';
    throw e;
  }
  return text;
}

/** Generate a cover with "Nano Banana" (Gemini 2.5 Flash Image), Vertex REST. */
async function callNanoBanana(prompt) {
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const client = await auth.getClient();
  const body = { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['IMAGE'] } };
  // Gemini image models are region-picky; try the configured location then global.
  const locations = GEMINI_LOCATION === 'global' ? ['global', 'us-central1'] : [GEMINI_LOCATION, 'global'];
  let lastErr = 'nano-banana failed';
  for (const loc of locations) {
    const host = loc === 'global' ? 'aiplatform.googleapis.com' : `${loc}-aiplatform.googleapis.com`;
    const url = `https://${host}/v1/projects/${resolveProjectId()}/locations/${loc}/publishers/google/models/${GEMINI_IMAGE_MODEL}:generateContent`;
    try {
      const res = await client.request({ url, method: 'POST', data: body });
      const parts = res?.data?.candidates?.[0]?.content?.parts || [];
      const img = parts.find((p) => p?.inlineData?.data)?.inlineData;
      if (img?.data) return { buffer: Buffer.from(img.data, 'base64'), mimeType: img.mimeType || 'image/png' };
      lastErr = `no image @${loc}`;
    } catch (err) {
      lastErr = `${err?.response?.data?.error?.message || err?.message || 'error'} @${loc}`;
    }
  }
  const e = new Error(lastErr);
  e.code = 'nano-banana-failed';
  throw e;
}

/** Cover generation: Nano Banana first, Vertex Imagen as fallback. */
async function generateCoverImage(prompt) {
  try {
    return await callNanoBanana(prompt);
  } catch (err) {
    console.warn('[tastescopeGenerate] Nano Banana failed, Imagen fallback:', err && err.message);
    return callVertexImagen(prompt, '16:9', 'cover');
  }
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
  const mt = String(mimeType || 'image/jpeg');
  const ext = mt.includes('png') ? 'png' : mt.includes('webp') ? 'webp' : 'jpg';
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
    // Cover options (client-chosen): art style + whether to letter the name in.
    const coverStyle = G.isValidCoverStyle(data?.style) ? data.style : G.DEFAULT_COVER_STYLE;
    const coverWithText = data?.withText === true;
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
        const displayName = user.display_name || user.displayName || user.name || '';
        const prompt = G.buildCoverPrompt({
          titleId: ts.titleId,
          answers: ts.answers,
          countryCode,
          style: coverStyle,
          withText: coverWithText,
          gender: user.gender, // raw ('male'/'female') → depicted person
          ageCategory: user.ageCategory,
          age: user.age,
          name: displayName,
        });
        let img = await generateCoverImage(prompt);
        if (!(await moderateImageBytes(img.buffer))) {
          img = await generateCoverImage(prompt); // retry once
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

  // ── Full test: title (client-derived) + reading + cover, generated together.
  // Free once per FREE_WINDOW_MS (90d); otherwise RETAKE_PRICE (150). Max
  // DAILY_LIMIT tests/day. Never charges on a failed generation.
  exports.tastescopeRunTest = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
    const uid = context.auth.uid;
    if (!GEN_ENABLED) throw new functions.https.HttpsError('failed-precondition', 'TasteScope is disabled.');
    const locale = data?.locale === 'en' ? 'en' : 'ar';
    const answers = data?.answers;
    const titleId = data?.titleId;
    const runnerUpId = G.TITLE_IDS.includes(data?.runnerUpId) ? data.runnerUpId : null;
    const style = G.isValidCoverStyle(data?.style) ? data.style : 'cinematic';
    if (!G.isValidAnswers(answers)) throw new functions.https.HttpsError('invalid-argument', 'answers');
    if (!G.TITLE_IDS.includes(titleId)) throw new functions.https.HttpsError('invalid-argument', 'title');

    await enforceCallableRateLimit(uid, 'tastescope_test', { cooldownMs: 4000, perHour: 20 });

    const userRef = db.collection('users').doc(uid);
    const snap = await userRef.get();
    if (!snap.exists) throw new functions.https.HttpsError('not-found', 'No profile.');
    const user = snap.data() || {};
    const ts = user.tasteScope || {};

    const now = Date.now();
    const isFirst = !ts.titleId;
    const freeAt = toMillis(ts.freeRetakeAt);
    const free = isFirst || !freeAt || now >= freeAt;
    const price = free ? 0 : RETAKE_PRICE;

    const today = todayKey();
    const dayCount = ts.testDay === today ? (Number(ts.testDayCount) || 0) : 0;
    if (dayCount >= DAILY_LIMIT) return { ok: false, reason: 'daily_limit' };

    if (price > 0) {
      const balance = (Number(user.paidCredits) || 0) + (Number(user.savedCredits) || 0);
      if (balance < price) return { ok: false, reason: 'insufficient_credits', price };
    }

    const gender = G.genderWord(user.gender);
    const country = user.country || (user.businessInfo && user.businessInfo.country) || '';
    const countryCode = user.countryCode || (user.businessInfo && user.businessInfo.countryCode) || '';
    const displayName = user.display_name || user.displayName || user.name || '';

    let text; let coverUrl;
    try {
      const userMsg = G.buildReadingUserMessage({
        locale, gender,
        titleName: G.titleDisplayName(titleId, gender, locale),
        titleEn: G.titleDisplayName(titleId, 'masculine', 'en'),
        runnerUpName: G.titleDisplayName(runnerUpId, gender, locale),
        country, answers,
      });
      text = G.postProcessReading(await generateReadingText(G.READING_SYSTEM, userMsg));
      if (!G.validateReading(text).ok) text = G.postProcessReading(await generateReadingText(G.READING_SYSTEM, userMsg));
      if (!G.validateReading(text).ok) return { ok: false, reason: 'generation_failed' };

      const prompt = G.buildCoverPrompt({
        titleId, answers, countryCode, style, withText: false,
        gender: user.gender, ageCategory: user.ageCategory, age: user.age, name: displayName,
      });
      let img = await generateCoverImage(prompt);
      if (!(await moderateImageBytes(img.buffer))) {
        img = await generateCoverImage(prompt);
        if (!(await moderateImageBytes(img.buffer))) return { ok: false, reason: 'generation_failed' };
      }
      const up = await uploadCover(admin, uid, img.buffer, img.mimeType || 'image/png');
      coverUrl = up.url;
    } catch (err) {
      console.error('[tastescopeRunTest] failure', err && err.message);
      return { ok: false, reason: 'generation_failed' };
    }

    try {
      await db.runTransaction(async (tx) => {
        const s = await tx.get(userRef);
        const u = s.data() || {};
        const t2 = u.tasteScope || {};
        const day2 = t2.testDay === today ? (Number(t2.testDayCount) || 0) : 0;
        if (day2 >= DAILY_LIMIT) { const e = new Error('rate'); e.code = 'RATE'; throw e; }
        if (price > 0) {
          spendCreditsInTransaction(tx, userRef, u, {
            uid, accountRole: 'user', amount: price,
            type: 'tastescope_retake', reason: 'tastescope_retake', relatedId: titleId, allowSavedCredits: true,
          });
        }
        const sv = admin.firestore.FieldValue.serverTimestamp();
        const prevHistory = Array.isArray(t2.history) ? t2.history : [];
        const history = [...prevHistory, { titleId, takenAt: now }].slice(-5);
        const nextFreeAt = free
          ? admin.firestore.Timestamp.fromMillis(now + FREE_WINDOW_MS)
          : (t2.freeRetakeAt || admin.firestore.Timestamp.fromMillis(now + FREE_WINDOW_MS));
        tx.update(userRef, {
          tasteScope: {
            version: t2.version || 1,
            titleId, runnerUpId, answers,
            takenAt: sv,
            freeRetakeAt: nextFreeAt,
            visibility: t2.visibility || 'public',
            history,
            coverUrl,
            coverRestyleUsed: false,
            generated: {
              reading: { text, locale, createdAt: sv },
              cover: { url: coverUrl, style, createdAt: sv },
            },
            testDay: today,
            testDayCount: day2 + 1,
          },
        });
      });
    } catch (err) {
      if (err && err.code === 'INSUFFICIENT_CREDITS') return { ok: false, reason: 'insufficient_credits', price };
      if (err && err.code === 'RATE') return { ok: false, reason: 'daily_limit' };
      throw err;
    }

    return { ok: true, titleId, runnerUpId, url: coverUrl, text, charged: price, free };
  });

  // ── One free cover restyle per test: regenerate only the cover in a chosen
  // style, allowed once (coverRestyleUsed), then locked until the next test.
  exports.tastescopeRestyleCover = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
    const uid = context.auth.uid;
    if (!GEN_ENABLED) throw new functions.https.HttpsError('failed-precondition', 'TasteScope is disabled.');
    const style = G.isValidCoverStyle(data?.style) ? data.style : G.DEFAULT_COVER_STYLE;

    await enforceCallableRateLimit(uid, 'tastescope_restyle', { cooldownMs: 4000, perHour: 20 });

    const userRef = db.collection('users').doc(uid);
    const snap = await userRef.get();
    if (!snap.exists) throw new functions.https.HttpsError('not-found', 'No profile.');
    const user = snap.data() || {};
    const ts = user.tasteScope || {};
    if (!ts.titleId || !G.isValidAnswers(ts.answers)) {
      throw new functions.https.HttpsError('failed-precondition', 'Take the quiz first.');
    }
    if (ts.coverRestyleUsed) return { ok: false, reason: 'restyle_used' };

    const countryCode = user.countryCode || (user.businessInfo && user.businessInfo.countryCode) || '';
    const displayName = user.display_name || user.displayName || user.name || '';

    let coverUrl;
    try {
      const prompt = G.buildCoverPrompt({
        titleId: ts.titleId, answers: ts.answers, countryCode, style, withText: false,
        gender: user.gender, ageCategory: user.ageCategory, age: user.age, name: displayName,
      });
      let img = await generateCoverImage(prompt);
      if (!(await moderateImageBytes(img.buffer))) {
        img = await generateCoverImage(prompt);
        if (!(await moderateImageBytes(img.buffer))) return { ok: false, reason: 'generation_failed' };
      }
      const up = await uploadCover(admin, uid, img.buffer, img.mimeType || 'image/png');
      coverUrl = up.url;
    } catch (err) {
      console.error('[tastescopeRestyleCover] failure', err && err.message);
      return { ok: false, reason: 'generation_failed' };
    }

    try {
      await db.runTransaction(async (tx) => {
        const s = await tx.get(userRef);
        const u = s.data() || {};
        if (u.tasteScope && u.tasteScope.coverRestyleUsed) { const e = new Error('used'); e.code = 'USED'; throw e; }
        const sv = admin.firestore.FieldValue.serverTimestamp();
        tx.update(userRef, {
          'tasteScope.coverUrl': coverUrl,
          'tasteScope.coverRestyleUsed': true,
          'tasteScope.generated.cover': { url: coverUrl, style, createdAt: sv },
        });
      });
    } catch (err) {
      if (err && err.code === 'USED') return { ok: false, reason: 'restyle_used' };
      throw err;
    }

    return { ok: true, url: coverUrl, style };
  });
}

module.exports = { registerTastescopeGenerate };
