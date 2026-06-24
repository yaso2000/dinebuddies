/**
 * Gemini-backed demo persona generation for admin seeding.
 * Uses GEMINI_API_KEY when set; otherwise Vertex AI (same GCP project as Cloud Functions).
 */
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { resolvePrimaryLanguage } = require('./demoUserLocale');

const DEFAULT_MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash';

const JOIN_REASON_IDS = [
    'explore_places',
    'activity_partner',
    'new_friends',
    'expand_network',
    'fun_hangouts',
    'open_to_dating',
];

function resolveGeminiApiKey() {
    return (
        process.env.GEMINI_API_KEY?.trim() ||
        process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
        process.env.GOOGLE_API_KEY?.trim() ||
        ''
    );
}

function getGenAiClient() {
    const apiKey = resolveGeminiApiKey();
    if (!apiKey) return null;
    return new GoogleGenerativeAI(apiKey);
}

function resolveProjectId() {
    const fromEnv =
        process.env.GCLOUD_PROJECT?.trim() || process.env.GOOGLE_CLOUD_PROJECT?.trim() || '';
    if (fromEnv) return fromEnv;
    try {
        const cfg = JSON.parse(process.env.FIREBASE_CONFIG || '{}');
        if (cfg.projectId) return cfg.projectId;
    } catch {
        /* ignore */
    }
    return 'dinebuddies';
}

async function callVertexGemini(prompt, model) {
    const projectId = resolveProjectId();
    const location = process.env.GEMINI_VERTEX_LOCATION?.trim() || 'us-central1';
    const { GoogleAuth } = require('google-auth-library');
    const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
    const client = await auth.getClient();
    const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;

    const res = await client.request({
        url,
        method: 'POST',
        data: {
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.9,
            },
        },
    });

    const text = res?.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
        throw new Error('Vertex Gemini returned an empty response');
    }
    return text;
}

/**
 * @param {{ city: string, state?: string, country: string, countryCode?: string, count: number }} opts
 */
function buildDemographicsPrompt({ city, state, country, countryCode, count }) {
    const placeLabel = [city, state, country].filter(Boolean).join(', ');
    const primaryLanguage = resolvePrimaryLanguage(country, countryCode);
    const joinList = JOIN_REASON_IDS.map((id) => `'${id}'`).join(', ');

    return `
You are an expert demographic data generator. Generate exactly ${count} realistic fake user profiles for a social dining app in ${placeLabel}.

CRITICAL RULES — LOCAL CULTURE & LANGUAGE:
1. Ethnicity & Names: The names MUST strongly reflect the native ethnicity and culture of ${country}.
2. Language: The "bio" and "firstDatePlaceHint" MUST be written entirely in ${primaryLanguage} (the primary native language of ${country}). Do NOT write bio or firstDatePlaceHint in English unless ${primaryLanguage} is English.
3. Cultural references: All food spots, social vibes, and meetup hints MUST match the exact city of ${city} in ${country}.

OTHER RULES:
4. "display_name" must be FIRST NAME ONLY (one word), culturally authentic for ${country}.
5. "gender" must be strictly "male" or "female" and MUST match the name culturally.
6. "ageCategory" must be one of: '18-24', '25-34', '35-44', '45-54', '55+'.
7. "bio" max 100 characters, in ${primaryLanguage}, mention local food or social vibes in ${city}.
8. "diningPersona" must be exactly 3 short tags (food/vibe, emoji allowed).
9. "joinReasons" must be 1 to 3 ids chosen ONLY from: ${joinList}. Include "open_to_dating" for most profiles.
10. "firstDatePlaceHint" max 80 chars, in ${primaryLanguage} — a casual, real-sounding meetup spot in ${city}.

Return ONLY a JSON array of objects. No markdown. Each object:
{
  "display_name": "string",
  "gender": "male" | "female",
  "ageCategory": "string",
  "bio": "string",
  "diningPersona": ["string", "string", "string"],
  "joinReasons": ["string"],
  "firstDatePlaceHint": "string"
}
`.trim();
}

function parseGeminiJsonArray(text) {
    const raw = String(text || '').trim();
    if (!raw) throw new Error('Empty Gemini response');

    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch {
        const start = raw.indexOf('[');
        const end = raw.lastIndexOf(']');
        if (start < 0 || end <= start) throw new Error('Gemini response is not a JSON array');
        parsed = JSON.parse(raw.slice(start, end + 1));
    }

    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.users)) return parsed.users;
    if (parsed && Array.isArray(parsed.profiles)) return parsed.profiles;
    throw new Error('Gemini JSON must be an array of user profiles');
}

/**
 * @param {{ city: string, state?: string, country: string, countryCode?: string, count: number }} opts
 * @returns {Promise<object[]>}
 */
async function callGeminiForDemographics(opts) {
    const city = String(opts.city || '').trim();
    const country = String(opts.country || '').trim();
    const countryCode = String(opts.countryCode || '').trim().toUpperCase().slice(0, 2);
    const state = String(opts.state || '').trim();
    const count = Math.min(Math.max(Math.floor(Number(opts.count) || 0), 1), 50);

    if (!city || !country) {
        throw new Error('city and country are required for Gemini demographics.');
    }

    const prompt = buildDemographicsPrompt({ city, state, country, countryCode, count });
    const genAI = getGenAiClient();

    try {
        let responseText;
        if (genAI) {
            const model = genAI.getGenerativeModel({
                model: DEFAULT_MODEL,
                generationConfig: {
                    responseMimeType: 'application/json',
                    temperature: 0.9,
                },
            });
            const result = await model.generateContent(prompt);
            responseText = result.response.text();
        } else {
            responseText = await callVertexGemini(prompt, DEFAULT_MODEL);
        }

        const rows = parseGeminiJsonArray(responseText);
        if (rows.length === 0) {
            throw new Error('Gemini returned an empty profile array');
        }
        return rows.slice(0, count);
    } catch (error) {
        console.error('Gemini demo demographics failed:', error?.message || error);
        const err = new Error(error?.message || 'Failed to generate AI demo profiles');
        err.code = error?.code || 'gemini-generation-failed';
        throw err;
    }
}

module.exports = {
    callGeminiForDemographics,
    buildDemographicsPrompt,
};
