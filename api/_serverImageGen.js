// Server-side AI image generation via Vertex AI REST, authenticated with the
// Firebase Admin service account. This deliberately bypasses the Firebase AI
// Logic *client* SDK (`firebase/ai`), which is a browser SDK that needs App
// Check and does not authenticate reliably from a serverless (Node) runtime.
//
// - Text→image: Vertex Imagen (`:predict`) — purpose-built, reliable in-region.
// - img2img edit: Vertex Gemini image model (`:generateContent`, IMAGE modality).
//
// Requires the service account to have the "Vertex AI User" role
// (roles/aiplatform.user) on the project. If it lacks it, the calls return a
// clear 403 that names the missing permission.
import { GoogleAuth } from 'google-auth-library';
import { getFirebaseAdminCertConfig } from './_firebaseAdmin.js';

const VERTEX_LOCATION = (process.env.GEMINI_VERTEX_LOCATION || 'us-central1').trim();
// Try the most broadly-available Imagen model first, then newer/legacy ones.
// A project may lack access to Imagen 4 (404) but have Imagen 3 (GA); the legacy
// `imagegeneration@006` is almost universally available as a last resort.
const IMAGEN_MODELS = (
    process.env.VERTEX_IMAGEN_MODEL ||
    'imagen-3.0-generate-002,imagen-4.0-fast-generate-001,imagen-4.0-generate-001,imagegeneration@006'
)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
const GEMINI_IMAGE_MODEL = (process.env.VERTEX_GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image').trim();

// Errors that mean "this model isn't available here" — worth trying another model.
const MODEL_UNAVAILABLE_RE = /\b404\b|not found|does not have access|was not found|not supported|\b403\b|permission/i;

let _auth = null;
let _projectId = '';

function serviceAccount() {
    const cfg = getFirebaseAdminCertConfig();
    _projectId = cfg.projectId;
    return cfg;
}

async function getAccessToken() {
    if (!_auth) {
        const cfg = serviceAccount();
        _auth = new GoogleAuth({
            credentials: {
                client_email: cfg.clientEmail,
                private_key: cfg.privateKey,
                project_id: cfg.projectId,
            },
            projectId: cfg.projectId,
            scopes: ['https://www.googleapis.com/auth/cloud-platform'],
        });
    }
    const token = await _auth.getAccessToken();
    if (!token) throw new Error('could not mint a Google access token from the service account');
    return token;
}

function vertexUrl(model, method, location) {
    const loc = (location || VERTEX_LOCATION).trim();
    if (!_projectId) serviceAccount();
    const host = loc === 'global' ? 'aiplatform.googleapis.com' : `${loc}-aiplatform.googleapis.com`;
    return `https://${host}/v1/projects/${_projectId}/locations/${loc}/publishers/google/models/${model}:${method}`;
}

async function vertexFetch(url, body) {
    const token = await getAccessToken();
    const resp = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const text = await resp.text();
    let json;
    try {
        json = text ? JSON.parse(text) : {};
    } catch {
        json = { raw: text };
    }
    if (!resp.ok) {
        const msg = json?.error?.message || json?.raw || text || `HTTP ${resp.status}`;
        const err = new Error(`${resp.status} ${String(msg).slice(0, 300)}`);
        err.status = resp.status;
        throw err;
    }
    return json;
}

/**
 * Run the Vertex Gemini image model (`:generateContent`, IMAGE modality) over a
 * set of parts, trying the configured location then a fallback one. Used for
 * both text→image (text part only) and img2img edit (image + text parts). The
 * Gemini image model is NOT access-gated the way Imagen is.
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RATE_LIMIT_RE = /\b429\b|resource exhausted|rate limit|quota|too many requests/i;

async function geminiImageContent(parts, label) {
    const body = { contents: [{ role: 'user', parts }], generationConfig: { responseModalities: ['IMAGE'] } };
    const locations = VERTEX_LOCATION === 'global' ? ['global', 'us-central1'] : [VERTEX_LOCATION, 'global'];
    let lastErr = '';
    for (const loc of locations) {
        // Retry a rate-limit (429) a few times with backoff before giving up on
        // this location — the quota for gemini image models can be bursty.
        for (let attempt = 0; attempt < 4; attempt += 1) {
            try {
                const json = await vertexFetch(vertexUrl(GEMINI_IMAGE_MODEL, 'generateContent', loc), body);
                const outParts = json?.candidates?.[0]?.content?.parts || [];
                const img = outParts.find((p) => p?.inlineData?.data);
                if (img?.inlineData?.data) {
                    return { success: true, bytesBase64: img.inlineData.data, mimeType: img.inlineData.mimeType || 'image/png' };
                }
                const finish = json?.candidates?.[0]?.finishReason || '';
                lastErr = `${label}(${GEMINI_IMAGE_MODEL}@${loc}): no image${finish ? ` — ${finish}` : ''}`;
                break; // model-declined "no image" — retry/region won't help
            } catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                lastErr = `${label}(${GEMINI_IMAGE_MODEL}@${loc}): ${msg}`;
                if (RATE_LIMIT_RE.test(msg)) {
                    if (attempt < 3) {
                        await sleep(1000 * (attempt + 1)); // 1s, 2s, 3s
                        continue;
                    }
                    break; // exhausted retries here → try the next location (separate quota)
                }
                if (MODEL_UNAVAILABLE_RE.test(msg)) break; // try next location
                return { success: false, error: lastErr, code: 'IMAGE_GENERATION_FAILED' }; // other hard error
            }
        }
    }
    return { success: false, error: lastErr || `${label} failed`, code: 'IMAGE_GENERATION_FAILED' };
}

/** Text→image via Vertex Imagen (chain of models; many projects lack access). */
async function imagenGenerate(prompt, aspectRatio) {
    const body = {
        instances: [{ prompt: String(prompt || '').slice(0, 4000) }],
        parameters: {
            sampleCount: 1,
            aspectRatio: aspectRatio || '1:1',
            personGeneration: 'allow_adult',
        },
    };
    let lastErr = '';
    for (const model of IMAGEN_MODELS) {
        try {
            const json = await vertexFetch(vertexUrl(model, 'predict'), body);
            const pred = Array.isArray(json?.predictions) ? json.predictions[0] : null;
            const b64 = pred?.bytesBase64Encoded;
            if (b64) {
                return { success: true, bytesBase64: b64, mimeType: pred?.mimeType || 'image/png' };
            }
            const filtered =
                pred?.raiFilteredReason ||
                json?.raiFilteredReason ||
                (Array.isArray(json?.predictions) && json.predictions.length === 0 ? 'all candidates filtered (safety)' : '');
            lastErr = `imagen(${model}@${VERTEX_LOCATION}): no image${filtered ? ` — ${filtered}` : ''}`;
            if (filtered) break;
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            lastErr = `imagen(${model}@${VERTEX_LOCATION}): ${msg}`;
            if (!MODEL_UNAVAILABLE_RE.test(msg)) break;
        }
    }
    return { success: false, error: lastErr || 'imagen failed', code: 'IMAGE_GENERATION_FAILED' };
}

/**
 * Text→image. Uses the (ungated) Gemini image model first, then falls back to
 * Imagen. Returns the same shape as the browser generateCoverImage.
 * @returns {Promise<{success:true,bytesBase64:string,mimeType:string}|{success:false,error:string,code:string}>}
 */
export async function serverGenerateImage(prompt, aspectRatio = '1:1') {
    const gem = await geminiImageContent(
        [{ text: `Generate a high-quality image: ${String(prompt || '').slice(0, 4000)}` }],
        'gemini-gen',
    );
    if (gem.success) return gem;

    const imagen = await imagenGenerate(prompt, aspectRatio);
    if (imagen.success) return imagen;

    return {
        success: false,
        error: `${gem.error}  ||  ${imagen.error}`.slice(0, 300),
        code: 'IMAGE_GENERATION_FAILED',
    };
}

/**
 * img2img EDIT via the Vertex Gemini image model.
 * @returns {Promise<{success:true,bytesBase64:string,mimeType:string}|{success:false,error:string,code:string}>}
 */
export async function serverEditImage(inputBase64, mimeType, prompt) {
    if (!inputBase64) {
        return { success: false, error: 'no input image provided', code: 'IMAGE_GENERATION_FAILED' };
    }
    return geminiImageContent(
        [
            { inlineData: { mimeType: mimeType || 'image/jpeg', data: inputBase64 } },
            { text: `Edit the provided image based on this instruction, and return the edited image: ${String(prompt || '').slice(0, 2000)}` },
        ],
        'gemini-edit',
    );
}
