/**
 * POST /api/generate-image
 * Unified DineBuddies invitation AI (Gemini only — no OpenAI).
 *
 * Modes (body.mode):
 * - omitted | "full" | "atomic" — Full invitation pack: strict JSON (basic_info, media, theme, animation_meta.type ∈ elegant-fade|gentle-pulse|glide-up|none)
 *   plus one inline cover image. Credits charged per INVITATION_AI_IMAGE_CREDIT_COST (unless skipped/free UIDs).
 * - "headline_suggestions" — Ten short headline lines for the public invitation composer (JSON only, no image, no credits).
 *
 * Headers: Authorization: Bearer <Firebase ID token>
 *
 * Body (atomic / default):
 *   { userBrief?: string, prompt?: string, style?: string, language?: string, hints?: object,
 *     referenceImage?: { mimeType: string, dataBase64: string } — optional visual reference (no data: prefix),
 *     coverAspectRatio?: "1:1" | "9:16" — hero cover framing (default 1:1; legacy "16:9" maps to 1:1); output is cropped server-side,
 *     userPreferences?: { tonePreference?: string, colorPreference?: string, fontPreference?: string, inviteMood?: string, venueType?: string } }
 *   Same preference fields may be sent top-level (tonePreference, colorPreference, fontPreference).
 *   Legacy: prompt + style still work; userBrief preferred when provided.
 *
 * Body (headline_suggestions):
 *   { mode: "headline_suggestions", ...same fields as buildInvitationAiPayload }
 *
 * Env:
 * - GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY (required)
 * - GEMINI_IMAGE_MODEL (optional; default gemini-3.1-flash-image-preview)
 * - INVITATION_AI_IMAGE_CREDIT_COST, INVITATION_AI_IMAGE_SKIP_CREDITS, INVITATION_AI_IMAGE_FREE_UIDS
 * - FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 * - INVITE_COVER_UPSCALE (optional): off | sharp | replicate | auto (default auto)
 * - REPLICATE_API_TOKEN (optional): enables Real-ESRGAN path when image ≤256KB (Replicate data-URL limit)
 * - INVITE_COVER_REPLICATE_SCALE (optional): 2 or 4 (default 2)
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { takeRateLimit } from './_rateLimit.js';
import { maybeUpscaleInvitationCover } from './_invitationCoverUpscale.js';
import { normalizeInvitationCoverAspect } from './_normalizeInvitationCoverAspect.js';

const DEFAULT_MODEL = 'gemini-3.1-flash-image-preview';
const DEFAULT_COST = 5;

const DINE_FRAME_COLOR_LABELS = [
    'Ocean Blue',
    'Sunset Orange',
    'Nature Green',
    'Royal Purple',
    'Passionate Red',
    'Sweet Pink',
    'Midnight Gold',
    'Royal Red',
    'Leaf Green',
    'Slate Blue',
];

const DINE_FONT_LABELS = [
    'Playfair Display',
    'Cormorant Garamond',
    'Lora',
    'Montserrat',
    'Dancing Script',
    'Great Vibes',
];

/** Whitelist for `animation_meta.type` — must match `INVITATION_COVER_ANIMATION_TYPES` in `src/utils/aiInvitationThemeBinding.js`. */
const INVITATION_COVER_ANIMATION_TYPES = ['elegant-fade', 'gentle-pulse', 'glide-up', 'none'];

const LEGACY_COVER_ANIMATION_TO_CANONICAL = {
    'slow-fade': 'elegant-fade',
    'elegant-pulse': 'gentle-pulse',
    'subtle-zoom': 'glide-up',
    glitter: 'gentle-pulse',
    sparkle: 'gentle-pulse',
};

function normalizeAtomicAnimationType(raw) {
    const slug = clampStr(raw, 60).toLowerCase().replace(/\s+/g, '-');
    if (!slug) return 'gentle-pulse';
    if (INVITATION_COVER_ANIMATION_TYPES.includes(slug)) return slug;
    if (LEGACY_COVER_ANIMATION_TO_CANONICAL[slug]) {
        return LEGACY_COVER_ANIMATION_TO_CANONICAL[slug];
    }
    return 'gentle-pulse';
}

const IMAGE_SYSTEM = `You are the visual director for DineBuddies, a social dining app.
When generating an image: produce exactly one high-quality, artistic cover illustration for a social meetup.
Requirements:
- Cinematic composition, warm inviting mood, tasteful color grading.
- Suitable as an invitation hero / cover image at the aspect ratio requested in the user message (1:1 square or 9:16 vertical).
- Absolutely no readable text, no letters, no logos, no watermarks, no distorted typography, no fake signage with words.
- No identifiable real people or celebrities; generic silhouettes or backs of heads are fine.
- Avoid graphic violence, explicit content, or hate imagery.
- When the user message includes host creative preferences (tone, color mood, typography lean), align basic_info wording, media.image_prompt mood/lighting/palette, animation_meta, and theme choices with those preferences — while theme.frame_text_color and theme.font_name MUST remain EXACT labels from the allowed lists in ATOMIC_JSON_RULES (pick the single closest approved match to the host's color and font preferences).`;

const ATOMIC_JSON_RULES = `You MUST respond with candidate content that includes:
1) A text part containing ONLY one JSON object (no markdown code fences, no commentary before or after). The JSON must have exactly this shape and keys:
{
  "basic_info": {
    "title": "string — short attractive invitation title",
    "message": "string — warm personalized message to guests in the user's language when specified",
    "style_suggestion": "string — one token in English e.g. romantic, formal, cozy, celebratory"
  },
  "media": {
    "image_prompt": "string — very detailed English description of the hero/cover scene to paint (mood, lighting, setting, palette); reflect the host's stated tone and color mood when provided; this drives the image you generate next in the same response"
  },
  "theme": {
    "frame_text_color": "string — EXACTLY one label from this list: ${DINE_FRAME_COLOR_LABELS.join(', ')}",
    "font_name": "string — EXACTLY one label from this list: ${DINE_FONT_LABELS.join(', ')}"
  },
  "animation_meta": {
    "type": "string — MUST be EXACTLY one of these literals (hyphenated, lowercase, no synonyms or alternate spellings): ${INVITATION_COVER_ANIMATION_TYPES.join(', ')}. Choose only from this list based on invitation mood: elegant-fade for calm prestige; gentle-pulse for warm social rhythm; glide-up for light uplifting energy; none for a fully static hero."
  }
}
2) An inline image part that visually matches media.image_prompt.
Output the JSON text part FIRST, then the image.`;

function ensureAdminApp() {
    if (!getApps().length) {
        const projectId =
            process.env.FIREBASE_PROJECT_ID ||
            process.env.VITE_FIREBASE_PROJECT_ID ||
            'dinebuddies';
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
        if (!clientEmail || !privateKey) {
            return false;
        }
        initializeApp({
            credential: cert({
                projectId,
                clientEmail,
                privateKey,
            }),
        });
    }
    return true;
}

function getDb() {
    if (!ensureAdminApp()) {
        const err = new Error('Firebase Admin credentials are not configured.');
        err.code = 'admin_config';
        throw err;
    }
    return getFirestore();
}

function getAdminAuth() {
    if (!ensureAdminApp()) {
        const err = new Error('Firebase Admin credentials are not configured.');
        err.code = 'admin_config';
        throw err;
    }
    return getAuth();
}

function parseBody(req) {
    const raw = req.body;
    if (raw == null) return {};
    if (typeof raw === 'string') {
        try {
            return JSON.parse(raw || '{}');
        } catch {
            return {};
        }
    }
    if (typeof raw === 'object') return raw;
    return {};
}

function clampStr(s, max) {
    const t = String(s ?? '').trim();
    return t.slice(0, max);
}

const REF_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const REF_IMAGE_B64_MAX = 6_000_000;

/** Normalize client / browser MIME quirks for Gemini inlineData. */
function normalizeRefImageMime(raw) {
    const s = String(raw || '').trim().toLowerCase();
    if (!s) return '';
    if (s === 'image/jpg' || s === 'image/pjpeg') return 'image/jpeg';
    if (s === 'image/x-png') return 'image/png';
    return s;
}

/**
 * @param {Record<string, unknown>} body
 * @returns {{ mimeType: string, data: string } | null}
 */
function parseReferenceImage(body) {
    const ref = body?.referenceImage;
    if (!ref || typeof ref !== 'object') return null;
    const mimeType = normalizeRefImageMime(ref.mimeType);
    let data = typeof ref.dataBase64 === 'string' ? ref.dataBase64.trim() : '';
    data = data.replace(/^data:image\/\w+;base64,/i, '').replace(/\s/g, '');
    if (!data || data.length > REF_IMAGE_B64_MAX) return null;
    if (!REF_IMAGE_MIME.has(mimeType)) return null;
    return { mimeType, data };
}

function getGeminiApiKey() {
    return (
        process.env.GEMINI_API_KEY ||
        process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
        ''
    ).trim();
}

function getImageCost() {
    const raw = process.env.INVITATION_AI_IMAGE_CREDIT_COST;
    if (raw === undefined || raw === null || String(raw).trim() === '') {
        return DEFAULT_COST;
    }
    const n = Math.floor(Number(raw));
    if (!Number.isFinite(n) || n < 0) return DEFAULT_COST;
    return n;
}

function truthyEnv(v) {
    const s = String(v ?? '').trim().toLowerCase();
    return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}

function parseFreeUidSet() {
    const raw = process.env.INVITATION_AI_IMAGE_FREE_UIDS;
    if (!raw || typeof raw !== 'string') return new Set();
    const set = new Set();
    for (const part of raw.split(/[\s,;]+/)) {
        const id = String(part).trim();
        if (id) set.add(id);
    }
    return set;
}

/** @param {string} uid */
function getEffectiveImageCost(uid) {
    if (truthyEnv(process.env.INVITATION_AI_IMAGE_SKIP_CREDITS)) {
        return 0;
    }
    const base = getImageCost();
    if (base === 0) return 0;
    if (parseFreeUidSet().has(uid)) return 0;
    return base;
}

function getTotalCredits(data) {
    if (!data || typeof data !== 'object') return 0;
    const hasWallet =
        Object.prototype.hasOwnProperty.call(data, 'freeCredits') ||
        Object.prototype.hasOwnProperty.call(data, 'paidCredits');
    if (hasWallet) {
        const free = Math.max(0, Math.floor(Number(data.freeCredits) || 0));
        const paid = Math.max(0, Math.floor(Number(data.paidCredits) || 0));
        return free + paid;
    }
    return Math.max(0, Math.floor(Number(data.credits) || 0));
}

function accountRoleFromUserDoc(d) {
    if (d?.isBusiness === true) return 'business';
    const role = String(d?.role || '').toLowerCase();
    if (role === 'business' || role === 'partner') return 'business';
    return 'user';
}

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {FirebaseFirestore.Transaction} tx
 * @param {FirebaseFirestore.DocumentReference} userRef
 * @param {Record<string, unknown>} userData
 * @param {string} uid
 * @param {number} amount
 */
function spendCreditsInTransaction(db, tx, userRef, userData, uid, amount) {
    const n = Math.floor(Number(amount));
    if (!Number.isFinite(n) || n <= 0) return;

    const hasWallet =
        Object.prototype.hasOwnProperty.call(userData, 'freeCredits') ||
        Object.prototype.hasOwnProperty.call(userData, 'paidCredits');

    if (!hasWallet) {
        const c = Math.max(0, Math.floor(Number(userData.credits) || 0));
        if (c < n) {
            const err = new Error('INSUFFICIENT_CREDITS');
            err.code = 'INSUFFICIENT_CREDITS';
            throw err;
        }
        tx.update(userRef, {
            credits: c - n,
            updatedAt: FieldValue.serverTimestamp(),
        });
        return;
    }

    let free = Math.max(0, Math.floor(Number(userData.freeCredits) || 0));
    let paid = Math.max(0, Math.floor(Number(userData.paidCredits) || 0));
    const total = free + paid;
    if (total < n) {
        const err = new Error('INSUFFICIENT_CREDITS');
        err.code = 'INSUFFICIENT_CREDITS';
        throw err;
    }
    const fromFree = Math.min(free, n);
    const fromPaid = n - fromFree;
    free -= fromFree;
    paid -= fromPaid;
    const balanceType = fromFree > 0 && fromPaid > 0 ? 'mixed' : fromFree > 0 ? 'free' : 'paid';
    const accountRole = accountRoleFromUserDoc(userData);

    tx.update(userRef, {
        freeCredits: free,
        paidCredits: paid,
        totalCreditsSpent: FieldValue.increment(n),
        updatedAt: FieldValue.serverTimestamp(),
    });

    const ledgerRef = db.collection('credit_transactions').doc();
    tx.set(ledgerRef, {
        userId: uid,
        accountRole,
        type: 'ai_invitation_cover_image',
        amount: -n,
        balanceType,
        reason: 'invitation_magic_cover_image',
        relatedId: null,
        createdAt: FieldValue.serverTimestamp(),
        freeUsed: fromFree,
        paidUsed: fromPaid,
    });
}

function extractInlineImageFromResponse(response) {
    const parts = response?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) return null;
    for (const part of parts) {
        const id = part?.inlineData;
        if (id?.data && id?.mimeType?.startsWith?.('image/')) {
            return { mimeType: id.mimeType, data: id.data };
        }
    }
    return null;
}

/** @param {unknown} response */
function extractTextFromResponse(response) {
    const parts = response?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) return '';
    const chunks = [];
    for (const part of parts) {
        if (typeof part?.text === 'string' && part.text.trim()) {
            chunks.push(part.text);
        }
    }
    return chunks.join('\n').trim();
}

/**
 * Pull first balanced {...} JSON object from freeform model text (handles extra prose / fences).
 * @param {string} raw
 */
function extractJsonObjectString(raw) {
    let s = String(raw || '').trim();
    const fence = /^```(?:json)?\s*([\s\S]*?)```$/im;
    const m = s.match(fence);
    if (m) s = m[1].trim();

    const start = s.indexOf('{');
    if (start === -1) return null;
    let depth = 0;
    for (let i = start; i < s.length; i += 1) {
        const ch = s[i];
        if (ch === '{') depth += 1;
        else if (ch === '}') {
            depth -= 1;
            if (depth === 0) {
                return s.slice(start, i + 1);
            }
        }
    }
    return null;
}

/** @param {string} text */
function parseJsonLoose(text) {
    const slice = extractJsonObjectString(text);
    if (!slice) return null;
    try {
        return JSON.parse(slice);
    } catch {
        return null;
    }
}

function coerceAtomicShape(parsed) {
    if (!parsed || typeof parsed !== 'object') return null;
    const bi = parsed.basic_info && typeof parsed.basic_info === 'object' ? parsed.basic_info : {};
    const md = parsed.media && typeof parsed.media === 'object' ? parsed.media : {};
    const th = parsed.theme && typeof parsed.theme === 'object' ? parsed.theme : {};
    const am = parsed.animation_meta && typeof parsed.animation_meta === 'object' ? parsed.animation_meta : {};

    const title = clampStr(bi.title, 200);
    const message = clampStr(bi.message, 2000);
    const style_suggestion = clampStr(bi.style_suggestion, 80);
    const image_prompt = clampStr(md.image_prompt, 2500);
    let frame_text_color = clampStr(th.frame_text_color, 80);
    let font_name = clampStr(th.font_name, 120);
    const animType = normalizeAtomicAnimationType(am.type);

    if (!DINE_FRAME_COLOR_LABELS.includes(frame_text_color)) {
        const hit = DINE_FRAME_COLOR_LABELS.find(
            (x) => x.toLowerCase() === frame_text_color.toLowerCase()
        );
        frame_text_color = hit || 'Midnight Gold';
    }
    if (!DINE_FONT_LABELS.includes(font_name)) {
        const hit = DINE_FONT_LABELS.find((x) => x.toLowerCase() === font_name.toLowerCase());
        font_name = hit || 'Montserrat';
    }
    if (!title || !image_prompt) {
        return null;
    }

    const messageOut = message || title;

    return {
        basic_info: {
            title,
            message: messageOut,
            style_suggestion: style_suggestion || 'cozy',
        },
        media: { image_prompt },
        theme: {
            frame_text_color,
            font_name,
        },
        animation_meta: { type: animType },
    };
}

function buildUserBrief(body) {
    const explicit = clampStr(body.userBrief, 4000);
    if (explicit) return explicit;
    const legacy = clampStr(body.prompt, 2500);
    if (legacy) return legacy;
    return '';
}

/**
 * Optional host preferences from the client or Firestore (all fields optional).
 * @param {Record<string, unknown>} body
 * @returns {{ tonePreference: string, colorPreference: string, fontPreference: string, inviteMood: string, venueType: string }}
 */
function extractUserPreferences(body) {
    const raw =
        body?.userPreferences && typeof body.userPreferences === 'object' && !Array.isArray(body.userPreferences)
            ? body.userPreferences
            : {};
    const tonePreference = clampStr(raw.tonePreference ?? body.tonePreference, 80);
    const colorPreference = clampStr(raw.colorPreference ?? body.colorPreference, 80);
    const fontPreference = clampStr(raw.fontPreference ?? body.fontPreference, 120);
    const inviteMood = clampStr(raw.inviteMood ?? body.inviteMood, 40);
    const venueType = clampStr(raw.venueType ?? body.venueType, 80);
    return { tonePreference, colorPreference, fontPreference, inviteMood, venueType };
}

/**
 * Injected before the host brief so Gemini can auto-style while keeping whitelist theme fields.
 * Separates venue category (background scene) from vibe/mood (copy + motion + editorial color feel) to avoid conflicting instructions.
 * @param {{ tonePreference: string, colorPreference: string, fontPreference: string, inviteMood: string, venueType: string }} prefs
 */
function buildUserPreferencesContext(prefs) {
    const tone = prefs.tonePreference;
    const color = prefs.colorPreference;
    const font = prefs.fontPreference;
    const moodKey = prefs.inviteMood;
    const venue = prefs.venueType;
    if (!tone && !color && !font && !moodKey && !venue) return '';

    const lines = [
        'HOST CONTEXT (read carefully — avoid overlapping or contradictory instructions):',
        '',
    ];
    // Emotional / tone first, then venue-as-setting for the hero image (strict A→B order).
    if (moodKey || tone) {
        lines.push(
            `INVITE VIBE / MOOD (tone priority): ${moodKey ? `canonical mood key "${moodKey}"` : 'unspecified mood'}. Editorial direction: ${tone || 'match the mood key with warm, cohesive guest-facing copy'}.`
        );
        lines.push(
            'Apply this mood first to basic_info.title and basic_info.message voice, basic_info.style_suggestion, animation_meta.type (pick the single best whitelist animation for this mood), and the emotional rhythm of media.image_prompt (palette, atmosphere, lens mood).'
        );
        lines.push('');
    }
    if (venue) {
        lines.push(
            `VENUE / PLACE TYPE (visual backdrop only): "${venue}". The hero cover image should clearly evoke this kind of place (environment, architecture, typical setting, lighting that fits the venue category). Do not add readable text in the image.`
        );
        lines.push(
            'Use the venue category mainly to shape the scene/setting; keep copy and motion aligned with the INVITE VIBE / MOOD above. If venue and mood could clash, prioritize the MOOD for typography/motion/copy tone, and blend the venue as a softer backdrop.'
        );
        lines.push('');
    }
    if (color || font) {
        const bits = [];
        if (color) bits.push(`frame / hero color harmony toward: "${color}"`);
        if (font) bits.push(`typography lean (choose closest label from approved font list only): "${font}"`);
        lines.push(`THEME HINTS: ${bits.join('; ')}.`);
        lines.push(
            `- theme.frame_text_color MUST be exactly one of: ${DINE_FRAME_COLOR_LABELS.join(', ')}.`,
            `- theme.font_name MUST be exactly one of: ${DINE_FONT_LABELS.join(', ')}.`,
            ''
        );
    }

    lines.push(
        'Generate the JSON (title, message, style_suggestion, image_prompt, frame_text_color, font_name, animation type) so all fields feel like one art-directed invitation.'
    );
    lines.push('');
    return lines.join('\n');
}

function buildAtomicUserMessage(body, language) {
    const brief = buildUserBrief(body);
    const style = clampStr(body.style, 400);
    const hints =
        body.hints && typeof body.hints === 'object'
            ? JSON.stringify(body.hints).slice(0, 3000)
            : null;
    const prefBlock = buildUserPreferencesContext(extractUserPreferences(body));

    const lines = [
        `Preferred language for guest-facing text: ${language}.`,
        style ? `Style / palette hint: ${style}` : null,
        prefBlock || null,
        '',
        'Occasion / invitation brief from the host:',
        brief || '(minimal context — infer a tasteful generic social dining meetup)',
        hints ? `\nStructured hints (JSON):\n${hints}` : '',
        '',
        'Follow ATOMIC_JSON_RULES: emit the JSON text first, then the matching cover image.',
    ];
    const base = lines.filter((x) => x !== null).join('\n');
    return base;
}

/**
 * Extra instructions when a reference image is supplied (multimodal user turn).
 * @param {boolean} hasRef
 */
function buildReferenceImageInstruction(hasRef) {
    if (!hasRef) return '';
    return `

REFERENCE IMAGE (in this same user message: instruction text first, then the inline image part per Gemini image-editing format):
The host uploaded a reference picture. Use it as inspiration for mood, color harmony, lighting, composition, and type of setting — then produce a NEW original cover that fits the invitation brief and HOST CONTEXT. Do not copy readable text, logos, brand marks, or watermarks from the reference. The generated cover must still have absolutely no readable text (per IMAGE_SYSTEM). If the reference conflicts with venue type or vibe, blend sensibly and prioritize the written brief + HOST CONTEXT.`;
}

/** @param {unknown} body */
function parseCoverAspectRatio(body) {
    const s = String(body?.coverAspectRatio ?? body?.imageAspectRatio ?? '').trim();
    if (s === '16:9') return '1:1';
    if (s === '1:1' || s === '9:16') return s;
    return '1:1';
}

/**
 * @param {'1:1'|'9:16'} aspect
 */
function buildCoverAspectInstruction(aspect) {
    const lines = {
        '1:1':
            'Square framing (1:1). Center-weighted composition; balanced vertical and horizontal interest; suitable for a square invitation hero.',
        '9:16':
            'Vertical portrait framing (9:16). Story/reel-style composition; clear vertical flow; keep the main subject in the central vertical band.',
    };
    return `

COVER IMAGE ASPECT RATIO (mandatory): ${aspect}.
${lines[aspect] || lines['1:1']}
media.image_prompt must explicitly describe a scene composed for ${aspect} (not a different aspect).`;
}

function buildHeadlineSystemPrompt(isAr) {
    return isAr
        ? `أنت تكتب عناوين قصيرة لدعوات طعام/قهوة اجتماعية في تطبيق DineBuddies. أعد JSON فقط بالشكل {"suggestions":["..."]} حيث suggestions مصفوفة طولها بالضبط 10 عناصر. كل عنصر سطر واحد فقط، بحد أقصى 100 حرفاً، لغة عربية واضحة وودّية، بدون إيموجي، بدون أسطر جديدة داخل النص، بدون علامات اقتباس مزدوجة داخل النصوص.`
        : `You write short one-line headlines for social dining or coffee meetups in DineBuddies. Reply with JSON only: {"suggestions":["..."]} where suggestions is an array of exactly 10 strings. Each string is a single line, max 100 characters, friendly tone, no emojis, no newlines inside a string, no double quotes inside strings.`;
}

function buildHeadlineUserContent(payload) {
    const safe = {
        language: payload.language,
        hostName: clampStr(payload.hostName, 80),
        venueName: clampStr(payload.venueName, 120),
        title: payload.title == null ? null : clampStr(payload.title, 120),
        city: payload.city == null ? null : clampStr(payload.city, 80),
        locationDetail: payload.locationDetail == null ? null : clampStr(payload.locationDetail, 220),
        whenLine: payload.whenLine == null ? null : clampStr(payload.whenLine, 80),
        venueType: payload.venueType == null ? null : clampStr(payload.venueType, 80),
        genderSummary: payload.genderSummary == null ? null : clampStr(payload.genderSummary, 120),
        ageSummary: payload.ageSummary == null ? null : clampStr(payload.ageSummary, 80),
        guestsNeeded: (() => {
            if (payload.guestsNeeded == null || payload.guestsNeeded === '') return null;
            const n = Number(payload.guestsNeeded);
            return Number.isFinite(n) ? n : null;
        })(),
        paymentType: payload.paymentType == null ? null : clampStr(payload.paymentType, 60),
    };
    return `Use these invitation fields (null means optional / omit from headline):\n${JSON.stringify(safe)}\n\nReturn exactly 10 distinct headline options in the requested JSON format.`;
}

function padHeadlineSuggestions(suggestions, payload, isAr) {
    const out = [...suggestions].map((s) => clampStr(s, 120)).filter(Boolean);
    const seen = new Set(out);
    const host = clampStr(payload.hostName, 80) || (isAr ? 'المضيف' : 'Host');
    const place = clampStr(payload.venueName, 100) || (isAr ? 'لقاء' : 'meetup');
    let n = 0;
    while (out.length < 10) {
        n += 1;
        let line = clampStr(isAr ? `${host} — ${place} (${n})` : `${host} · ${place} (${n})`, 120);
        if (seen.has(line)) line = clampStr(`${line} ${out.length}`, 120);
        if (!seen.has(line)) {
            seen.add(line);
            out.push(line);
        } else {
            out.push(clampStr(`${line} ${Date.now() % 10000}`, 120));
        }
    }
    return out.slice(0, 10);
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST, OPTIONS');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const body = parseBody(req);
    const modeRaw = String(body.mode || '').toLowerCase().trim();
    const isHeadlineMode = modeRaw === 'headline_suggestions' || modeRaw === 'headlines';

    const rlKey = isHeadlineMode ? 'headline-suggestions' : 'generate-image';
    const rlLimit = isHeadlineMode ? 30 : 20;
    const rl = takeRateLimit(req, { key: rlKey, limit: rlLimit, windowMs: 60_000 });
    if (!rl.ok) {
        res.setHeader('Retry-After', String(rl.retryAfterSec));
        return res.status(429).json({
            code: 'rate_limited',
            message: 'Too many requests. Try again shortly.',
        });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !String(authHeader).startsWith('Bearer ')) {
        return res.status(401).json({
            code: 'unauthenticated',
            message: 'Authentication required.',
        });
    }

    const idToken = String(authHeader).slice(7).trim();
    if (!idToken) {
        return res.status(401).json({ code: 'unauthenticated', message: 'Authentication required.' });
    }

    const apiKey = getGeminiApiKey();
    if (!apiKey) {
        return res.status(503).json({
            code: 'server_misconfigured',
            message: 'AI generation is not configured (GEMINI_API_KEY).',
        });
    }

    let uid;
    try {
        const decoded = await getAdminAuth().verifyIdToken(idToken);
        uid = decoded.uid;
    } catch (e) {
        if (e?.code === 'admin_config') {
            return res.status(503).json({
                code: 'server_misconfigured',
                message: 'Server authentication is not configured.',
            });
        }
        return res.status(401).json({ code: 'unauthenticated', message: 'Invalid or expired session.' });
    }

    const modelName = (process.env.GEMINI_IMAGE_MODEL || DEFAULT_MODEL).trim();
    const genAI = new GoogleGenerativeAI(apiKey);

    let model;
    try {
        if (isHeadlineMode) {
            const language = typeof body.language === 'string' ? body.language.slice(0, 12) : 'en';
            const isAr = language.startsWith('ar');
            model = genAI.getGenerativeModel({
                model: modelName,
                systemInstruction: {
                    role: 'system',
                    parts: [{ text: buildHeadlineSystemPrompt(isAr) }],
                },
                generationConfig: {
                    temperature: 0.88,
                    maxOutputTokens: 1024,
                },
            });
        } else {
            model = genAI.getGenerativeModel({
                model: modelName,
                systemInstruction: {
                    role: 'system',
                    parts: [{ text: `${IMAGE_SYSTEM}\n\n${ATOMIC_JSON_RULES}` }],
                },
                generationConfig: {
                    // Official examples use TEXT then IMAGE for native image models.
                    responseModalities: ['TEXT', 'IMAGE'],
                },
            });
        }
    } catch (e) {
        console.error('generate-image model init', e);
        return res.status(500).json({ code: 'internal', message: 'Model initialization failed.' });
    }

    // ─── Headline suggestions (Gemini text JSON, no credits) ───
    if (isHeadlineMode) {
        const payload = body && typeof body === 'object' ? body : {};
        if (!clampStr(payload.hostName, 1) && !clampStr(payload.venueName, 1)) {
            return res.status(400).json({
                code: 'invalid_argument',
                message: 'Missing host or venue context.',
            });
        }

        const language = typeof payload.language === 'string' ? payload.language.slice(0, 12) : 'en';
        const isAr = language.startsWith('ar');
        const userLine = buildHeadlineUserContent(payload);

        let textOut = '';
        try {
            const result = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: userLine }] }],
            });
            textOut = extractTextFromResponse(result?.response) || '';
        } catch (e) {
            console.error('generate-image headlines gemini', e?.message || e);
            return res.status(502).json({
                code: 'generation_failed',
                message: 'Could not generate suggestions. Please try again.',
            });
        }

        const parsed = parseJsonLoose(textOut);
        let suggestions = Array.isArray(parsed?.suggestions) ? parsed.suggestions : null;
        if (!suggestions) {
            return res.status(502).json({
                code: 'invalid_ai_response',
                message: 'Suggestions service returned an unexpected format.',
            });
        }

        suggestions = suggestions
            .map((s) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : ''))
            .filter(Boolean)
            .map((s) => clampStr(s, 120));

        if (suggestions.length < 3) {
            return res.status(502).json({
                code: 'invalid_ai_response',
                message: 'Too few suggestions from AI.',
            });
        }

        suggestions = padHeadlineSuggestions(suggestions, payload, isAr);

        return res.status(200).json({
            suggestions,
            creditsCharged: 0,
        });
    }

    // ─── Atomic invitation JSON + cover image (credits) ───
    const language = clampStr(body.language, 12) || 'en';
    const refImage = parseReferenceImage(body);
    const coverAspect = parseCoverAspectRatio(body);
    const userLine =
        buildAtomicUserMessage(body, language) +
        buildCoverAspectInstruction(coverAspect) +
        buildReferenceImageInstruction(Boolean(refImage));
    const hasBrief = Boolean(buildUserBrief(body));
    const hasStyle = Boolean(clampStr(body.style, 1));
    const hasHints = body.hints && typeof body.hints === 'object' && Object.keys(body.hints).length > 0;
    const hasRefImage = Boolean(refImage);
    if (!hasBrief && !hasStyle && !hasHints && !hasRefImage) {
        return res.status(400).json({
            code: 'invalid_argument',
            message:
                'Provide userBrief or prompt (invitation context), optional style, hints, or a reference image to generate.',
        });
    }

    let db;
    try {
        db = getDb();
    } catch (e) {
        if (e?.code === 'admin_config') {
            return res.status(503).json({
                code: 'server_misconfigured',
                message: 'Server billing check is not configured.',
            });
        }
        console.error('generate-image admin init', e);
        return res.status(500).json({ code: 'internal', message: 'Server error.' });
    }

    const userRef = db.collection('users').doc(uid);
    let userSnap;
    try {
        userSnap = await userRef.get();
    } catch (e) {
        console.error('generate-image firestore read', e);
        return res.status(500).json({ code: 'internal', message: 'Could not verify account balance.' });
    }

    if (!userSnap.exists) {
        return res.status(404).json({ code: 'user_not_found', message: 'User profile not found.' });
    }

    const userData = userSnap.data() || {};
    const cost = getEffectiveImageCost(uid);
    if (cost > 0 && getTotalCredits(userData) < cost) {
        return res.status(402).json({
            code: 'insufficient_credits',
            message: `You need at least ${cost} credits to generate a cover image.`,
            requiredCredits: cost,
        });
    }

    let response;
    try {
        /** @type {{ text?: string, inlineData?: { mimeType: string, data: string } }[]} */
        // Gemini 3.x image editing docs: text prompt first, then inline image (same user turn).
        const parts = [{ text: userLine }];
        if (refImage) {
            parts.push({ inlineData: { mimeType: refImage.mimeType, data: refImage.data } });
        }
        const result = await model.generateContent({
            contents: [{ role: 'user', parts }],
        });
        response = result?.response;
    } catch (e) {
        console.error('generate-image gemini', e?.message || e);
        // Retry once without reference image if multimodal call failed (model/API quirks).
        if (refImage) {
            try {
                const fallbackLine =
                    buildAtomicUserMessage(body, language) +
                    buildCoverAspectInstruction(coverAspect) +
                    '\n\n(Reference image could not be applied; generate from text and hints only.)';
                const result2 = await model.generateContent({
                    contents: [{ role: 'user', parts: [{ text: fallbackLine }] }],
                });
                response = result2?.response;
            } catch (e2) {
                console.error('generate-image gemini fallback', e2?.message || e2);
                return res.status(502).json({
                    code: 'generation_failed',
                    message: e2?.message?.includes?.('API key')
                        ? 'AI service configuration error.'
                        : 'Generation failed. Please try again.',
                });
            }
        } else {
            return res.status(502).json({
                code: 'generation_failed',
                message: e?.message?.includes?.('API key')
                    ? 'AI service configuration error.'
                    : 'Generation failed. Please try again.',
            });
        }
    }

    const rawText = extractTextFromResponse(response);
    const parsedJson = parseJsonLoose(rawText);
    const invitation = coerceAtomicShape(parsedJson);

    if (!invitation) {
        const fr = response?.candidates?.[0]?.finishReason;
        console.warn('generate-image: invalid or incomplete JSON', { finishReason: fr, textSample: rawText?.slice(0, 400) });
        return res.status(502).json({
            code: 'invalid_ai_response',
            message: 'The model did not return usable invitation JSON. Try again or shorten your brief.',
        });
    }

    const imagePart = extractInlineImageFromResponse(response);
    if (!imagePart) {
        const fr = response?.candidates?.[0]?.finishReason;
        console.warn('generate-image: no inline image', { finishReason: fr });
        return res.status(502).json({
            code: 'image_unavailable',
            message: 'The model did not return an image. Try again or adjust your brief.',
        });
    }

    let coverNormalized = imagePart;
    try {
        const norm = await normalizeInvitationCoverAspect(
            { dataBase64: imagePart.data, mimeType: imagePart.mimeType },
            coverAspect
        );
        if (norm?.dataBase64) {
            coverNormalized = { mimeType: norm.mimeType, data: norm.dataBase64 };
        }
    } catch (e) {
        console.warn('generate-image: aspect normalize skipped', e?.message || e);
    }

    if (cost > 0) {
        try {
            await db.runTransaction(async (tx) => {
                const fresh = await tx.get(userRef);
                const d = fresh.data() || {};
                if (getTotalCredits(d) < cost) {
                    const err = new Error('INSUFFICIENT_CREDITS');
                    err.code = 'INSUFFICIENT_CREDITS';
                    throw err;
                }
                spendCreditsInTransaction(db, tx, userRef, d, uid, cost);
            });
        } catch (e) {
            if (e?.code === 'INSUFFICIENT_CREDITS' || e?.message === 'INSUFFICIENT_CREDITS') {
                return res.status(402).json({
                    code: 'insufficient_credits',
                    message: 'Not enough credits to complete this action.',
                    requiredCredits: cost,
                });
            }
            console.error('generate-image spend transaction', e);
            return res.status(500).json({
                code: 'billing_failed',
                message: 'Content was generated but credits could not be updated. Contact support if this persists.',
            });
        }
    }

    let coverOut = { mimeType: coverNormalized.mimeType, data: coverNormalized.data };
    try {
        const upscaled = await maybeUpscaleInvitationCover({
            dataBase64: coverNormalized.data,
            mimeType: coverNormalized.mimeType || 'image/jpeg',
        });
        if (upscaled?.dataBase64 && upscaled.via !== 'original') {
            coverOut = { mimeType: upscaled.mimeType || coverNormalized.mimeType, data: upscaled.dataBase64 };
        }
    } catch (e) {
        console.warn('generate-image: cover upscale failed, using normalized output', e?.message || e);
    }

    return res.status(200).json({
        basic_info: invitation.basic_info,
        media: invitation.media,
        theme: invitation.theme,
        animation_meta: invitation.animation_meta,
        mimeType: coverOut.mimeType,
        dataBase64: coverOut.data,
        creditsCharged: cost,
    });
}
