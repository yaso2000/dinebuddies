/**
 * Admin demo user AI images — profile avatar (1:1) and cover (16:9) via Vertex Imagen.
 * Character pair: avatar first, then cover with Imagen 3 subject customization (same person).
 */
const crypto = require('crypto');
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash';
const IMAGEN_CAPABILITY_MODEL =
    process.env.IMAGEN_CAPABILITY_MODEL?.trim() || 'imagen-3.0-capability-001';

const IMAGEN_MODELS = [
    process.env.IMAGEN_MODEL?.trim(),
    'imagen-4.0-fast-generate-001',
    'imagen-4.0-generate-001',
    'imagen-3.0-generate-002',
].filter(Boolean);

const COVER_SCENE_PROMPTS = {
    beach: 'wide panoramic sunset beach with golden sand, gentle waves, and soft pastel sky',
    cafe: 'wide cozy artisan coffee shop interior with warm ambient lighting and blurred background',
    restaurant: 'wide elegant restaurant dining room with soft bokeh lights',
    city: 'wide urban skyline at blue hour with glowing city lights and atmospheric depth',
    nature: 'wide lush green park or mountain landscape with natural golden-hour light',
    rooftop: 'wide stylish rooftop terrace overlooking the city at dusk with string lights',
};

const COVER_SCENE_ACTIONS = {
    beach: 'walking along the shoreline at golden hour, mid-step, wind in hair, relaxed smile',
    cafe: 'walking into a cozy café, mid-step, holding a coffee cup, candid lifestyle moment',
    restaurant: 'entering an elegant restaurant with a natural confident stride, warm smile',
    city: 'walking through city streets at blue hour, urban lifestyle moment, looking ahead',
    nature: 'strolling along a park path outdoors, relaxed natural movement',
    rooftop: 'leaning on a rooftop railing overlooking the city at dusk, casual confident pose',
};

const AGE_BAND_HINTS = {
    '18-24': 'young adult in their early twenties',
    '25-34': 'adult in their late twenties to early thirties',
    '35-44': 'adult in their late thirties to early forties',
    '45-54': 'mature adult in their forties to early fifties',
    '55+': 'confident mature adult aged fifty-five or older',
};

function resolveGeminiApiKey() {
    return (
        process.env.GEMINI_API_KEY?.trim() ||
        process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
        process.env.GOOGLE_API_KEY?.trim() ||
        ''
    );
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

function getStorageBucketName() {
    return (
        process.env.FIREBASE_STORAGE_BUCKET?.trim() ||
        (process.env.GCLOUD_PROJECT ? `${process.env.GCLOUD_PROJECT}.firebasestorage.app` : null) ||
        'dinebuddies.firebasestorage.app'
    );
}

function buildPublicDownloadUrl(bucketName, objectPath, token) {
    const encoded = encodeURIComponent(objectPath);
    if (token) {
        return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encoded}?alt=media&token=${token}`;
    }
    return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encoded}?alt=media`;
}

async function ensureDownloadToken(file) {
    const [meta] = await file.getMetadata();
    const custom = meta.metadata || {};
    let token = custom.firebaseStorageDownloadTokens;
    if (!token) {
        token = crypto.randomUUID();
        await file.setMetadata({
            metadata: {
                ...custom,
                firebaseStorageDownloadTokens: token,
            },
        });
    }
    return token;
}

function sanitizePrompt(text) {
    return String(text || '')
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        .replace(/```(?:json)?/gi, '')
        .replace(/[`<>{}[\]\\|]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 2000);
}

function normalizeKind(kind) {
    const k = String(kind || '').trim().toLowerCase();
    if (k === 'avatar' || k === 'cover') return k;
    return null;
}

function normalizeProfile(raw) {
    const p = raw && typeof raw === 'object' ? raw : {};
    return {
        displayName: String(p.displayName || p.display_name || '').trim(),
        gender: p.gender === 'female' ? 'female' : p.gender === 'male' ? 'male' : '',
        ageCategory: String(p.ageCategory || p.age_category || '').trim(),
        bio: String(p.bio || '').trim(),
        diningPersona: Array.isArray(p.diningPersona)
            ? p.diningPersona.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 3)
            : [],
        firstDatePlaceHint: String(p.firstDatePlaceHint || '').trim(),
    };
}

function buildSubjectDescription(profile) {
    const ageHint = AGE_BAND_HINTS[profile.ageCategory] || 'adult';
    const genderWord =
        profile.gender === 'female' ? 'woman' : profile.gender === 'male' ? 'man' : 'person';
    return `a ${ageHint} ${genderWord}`;
}

function buildAvatarBrief(profile, geo, userPrompt) {
    const place = [geo?.city, geo?.stateName, geo?.countryName || geo?.countryCode]
        .filter(Boolean)
        .join(', ');
    const ageHint = AGE_BAND_HINTS[profile.ageCategory] || 'adult';
    const genderWord =
        profile.gender === 'female' ? 'woman' : profile.gender === 'male' ? 'man' : 'person';
    const personaTags = profile.diningPersona.length ? profile.diningPersona.join(', ') : '';

    const lines = [
        'Create a detailed English Imagen prompt for a social dining app profile avatar photo.',
        'Category: profile_picture (square 1:1 avatar).',
        `Subject: single ${genderWord}, ${ageHint}, authentic and approachable.`,
        profile.displayName ? `Name vibe reference (do not render text): ${profile.displayName}.` : '',
        place ? `Location/cultural context: ${place}.` : '',
        profile.bio ? `Bio personality: ${profile.bio}.` : '',
        personaTags ? `Dining persona tags: ${personaTags}.` : '',
        profile.firstDatePlaceHint ? `Social vibe hint: ${profile.firstDatePlaceHint}.` : '',
        'Visual rules: close-up portrait headshot, centered face, flattering natural lighting, clean soft blurred background, photorealistic, friendly expression, no text, no watermark, no logo.',
        userPrompt ? `Admin creative brief: ${userPrompt}` : '',
        'Return JSON only: {"optimized_prompt":"..."}',
    ];
    return lines.filter(Boolean).join('\n');
}

function buildCoverBrief(profile, geo, userPrompt, coverScene) {
    const place = [geo?.city, geo?.stateName, geo?.countryName || geo?.countryCode]
        .filter(Boolean)
        .join(', ');
    const sceneKey = String(coverScene || '').trim().toLowerCase();
    const sceneHint =
        COVER_SCENE_PROMPTS[sceneKey] || (userPrompt ? '' : COVER_SCENE_PROMPTS.cafe);
    const personaTags = profile.diningPersona.length ? profile.diningPersona.join(', ') : '';

    const lines = [
        'Create a detailed English Imagen prompt for a social app profile header cover image.',
        'Category: profile_cover (wide 16:9 panoramic scene).',
        'IMPORTANT: This is a general atmospheric scene — NOT a portrait. No close-up person, no face as focal point.',
        'Show an inviting lifestyle/environment scene suitable for a profile banner with negative space for text overlay.',
        sceneHint ? `Scene type: ${sceneHint}.` : '',
        place ? `Regional mood inspired by: ${place}.` : '',
        profile.bio ? `Mood matching user bio: ${profile.bio}.` : '',
        personaTags ? `Vibe tags: ${personaTags}.` : '',
        'Visual rules: wide cinematic composition, soft depth, warm authentic colors, photorealistic, no readable text, no watermark, no logo.',
        userPrompt ? `Admin creative brief: ${userPrompt}` : '',
        'Return JSON only: {"optimized_prompt":"..."}',
    ];
    return lines.filter(Boolean).join('\n');
}

function buildCoverSubjectPrompt(subjectDescription, profile, geo, userPrompt, coverScene) {
    const sceneKey = String(coverScene || 'cafe').trim().toLowerCase();
    const scene = COVER_SCENE_PROMPTS[sceneKey] || COVER_SCENE_PROMPTS.cafe;
    const action = COVER_SCENE_ACTIONS[sceneKey] || COVER_SCENE_ACTIONS.cafe;
    const place = [geo?.city, geo?.countryName || geo?.countryCode].filter(Boolean).join(', ');
    const extra = userPrompt ? ` ${userPrompt}` : '';

    return sanitizePrompt(
        `Create a photorealistic wide cinematic 16:9 lifestyle image about ${subjectDescription} [1] to match the description: ${subjectDescription} [1] ${action}, set in ${scene}. Same person as reference [1], three-quarter or full-body framing, candid natural movement, authentic social dining profile cover, soft depth of field, negative space for text overlay, no text, no watermark.${place ? ` Mood inspired by ${place}.` : ''}${profile.bio ? ` Personality vibe: ${profile.bio}.` : ''}${extra}`
    );
}

function buildFallbackCoverPersonPrompt(profile, geo, userPrompt, coverScene) {
    const subjectDescription = buildSubjectDescription(profile);
    const sceneKey = String(coverScene || 'cafe').trim().toLowerCase();
    const scene = COVER_SCENE_PROMPTS[sceneKey] || COVER_SCENE_PROMPTS.cafe;
    const action = COVER_SCENE_ACTIONS[sceneKey] || COVER_SCENE_ACTIONS.cafe;
    const place = [geo?.city, geo?.countryName || geo?.countryCode].filter(Boolean).join(', ');
    const extra = userPrompt ? ` ${userPrompt}` : '';

    return sanitizePrompt(
        `Wide panoramic 16:9 photorealistic lifestyle photo of ${subjectDescription}, ${action}, set in ${scene}, candid movement, soft cinematic lighting, negative space for text overlay, no text, no watermark.${place ? ` Mood inspired by ${place}.` : ''}${profile.bio ? ` Personality: ${profile.bio}.` : ''}${extra}`
    );
}

async function callVertexGeminiJson(prompt, model = DEFAULT_GEMINI_MODEL) {
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
                temperature: 0.85,
            },
        },
    });

    const text = res?.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Gemini returned an empty prompt optimization response');
    return text;
}

async function optimizeImagenPrompt(brief) {
    const apiKey = resolveGeminiApiKey();
    let rawText;
    try {
        if (apiKey) {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({
                model: DEFAULT_GEMINI_MODEL,
                generationConfig: {
                    responseMimeType: 'application/json',
                    temperature: 0.85,
                },
            });
            const result = await model.generateContent(brief);
            rawText = result.response.text();
        } else {
            rawText = await callVertexGeminiJson(brief);
        }
    } catch (err) {
        console.warn('[demoUsersImagen] prompt optimization failed, using fallback', err?.message);
        return null;
    }

    try {
        const parsed = JSON.parse(String(rawText || '').trim());
        const prompt = parsed?.optimized_prompt || parsed?.imagePrompt || parsed?.prompt;
        if (prompt && String(prompt).trim()) return sanitizePrompt(prompt);
    } catch {
        const match = String(rawText || '').match(/"optimized_prompt"\s*:\s*"([^"]+)"/);
        if (match?.[1]) return sanitizePrompt(match[1]);
    }
    return null;
}

function buildFallbackImagenPrompt(kind, profile, geo, userPrompt, coverScene) {
    const place = [geo?.city, geo?.countryName || geo?.countryCode].filter(Boolean).join(', ');
    const ageHint = AGE_BAND_HINTS[profile.ageCategory] || 'adult';
    const genderWord =
        profile.gender === 'female' ? 'woman' : profile.gender === 'male' ? 'man' : 'person';
    const extra = userPrompt ? ` ${userPrompt}` : '';

    if (kind === 'cover') {
        const sceneKey = String(coverScene || 'cafe').trim().toLowerCase();
        const scene = COVER_SCENE_PROMPTS[sceneKey] || COVER_SCENE_PROMPTS.cafe;
        return sanitizePrompt(
            `Wide panoramic 16:9 photorealistic ${scene}, atmospheric lifestyle scene, soft cinematic lighting, negative space for text overlay, no people in foreground, no text, no watermark.${place ? ` Mood inspired by ${place}.` : ''}${extra}`
        );
    }

    return sanitizePrompt(
        `Square 1:1 photorealistic profile avatar headshot of a friendly ${ageHint} ${genderWord}, centered portrait, natural flattering lighting, clean soft blurred background, authentic social dining app profile photo, no text, no watermark.${place ? ` Subtle ${place} cultural authenticity.` : ''}${profile.bio ? ` Personality: ${profile.bio}.` : ''}${extra}`
    );
}

async function fetchImageBuffer(imageUrl) {
    const res = await fetch(imageUrl);
    if (!res.ok) {
        throw new Error(`Could not fetch reference image (${res.status})`);
    }
    const arrayBuffer = await res.arrayBuffer();
    return {
        buffer: Buffer.from(arrayBuffer),
        mimeType: res.headers.get('content-type') || 'image/jpeg',
    };
}

async function getVertexAuthClient() {
    const { GoogleAuth } = require('google-auth-library');
    const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
    return auth.getClient();
}

async function callVertexImagen(prompt, aspectRatio, kind) {
    const projectId = resolveProjectId();
    const location = process.env.GEMINI_VERTEX_LOCATION?.trim() || 'us-central1';
    const client = await getVertexAuthClient();

    let lastError = 'Imagen generation failed';
    const allowPerson = kind === 'avatar' || kind === 'cover_person';

    for (const modelName of [...new Set(IMAGEN_MODELS)]) {
        const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelName}:predict`;
        try {
            const res = await client.request({
                url,
                method: 'POST',
                data: {
                    instances: [{ prompt }],
                    parameters: {
                        sampleCount: 1,
                        aspectRatio,
                        personGeneration: allowPerson ? 'allow_adult' : 'dont_allow',
                        outputOptions: { mimeType: 'image/jpeg', compressionQuality: 85 },
                    },
                },
            });

            const prediction = res?.data?.predictions?.[0];
            const bytesBase64 =
                prediction?.bytesBase64Encoded ||
                prediction?.bytesBase64 ||
                prediction?.image?.bytesBase64Encoded;
            if (bytesBase64) {
                return {
                    buffer: Buffer.from(bytesBase64, 'base64'),
                    mimeType: prediction?.mimeType || 'image/jpeg',
                    model: modelName,
                };
            }
            lastError =
                res?.data?.filteredReason ||
                prediction?.raiFilteredReason ||
                `Imagen (${modelName}) returned no image`;
        } catch (err) {
            lastError = err?.response?.data?.error?.message || err?.message || lastError;
            console.warn('[demoUsersImagen] model failed', modelName, lastError);
        }
    }

    const err = new Error(lastError);
    err.code = 'imagen-generation-failed';
    throw err;
}

async function callVertexImagenSubjectCustomization({
    prompt,
    referenceBuffer,
    subjectDescription,
    aspectRatio = '16:9',
}) {
    const projectId = resolveProjectId();
    const location = process.env.GEMINI_VERTEX_LOCATION?.trim() || 'us-central1';
    const client = await getVertexAuthClient();
    const refB64 = referenceBuffer.toString('base64');

    const referenceImages = [
        {
            referenceType: 'REFERENCE_TYPE_SUBJECT',
            referenceId: 1,
            referenceImage: { bytesBase64Encoded: refB64 },
            subjectImageConfig: {
                subjectDescription: sanitizePrompt(subjectDescription).slice(0, 200),
                subjectType: 'SUBJECT_TYPE_PERSON',
            },
        },
    ];

    const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${IMAGEN_CAPABILITY_MODEL}:predict`;

    const parameterSets = [
        { sampleCount: 1, aspectRatio, personGeneration: 'allow_adult' },
        { sampleCount: 1, aspectRatio },
        { sampleCount: 1 },
    ];

    let lastError = 'Subject customization failed';

    for (const parameters of parameterSets) {
        try {
            const res = await client.request({
                url,
                method: 'POST',
                data: {
                    instances: [{ prompt, referenceImages }],
                    parameters,
                },
            });

            const prediction = res?.data?.predictions?.[0];
            const bytesBase64 =
                prediction?.bytesBase64Encoded ||
                prediction?.bytesBase64 ||
                prediction?.image?.bytesBase64Encoded;
            if (bytesBase64) {
                return {
                    buffer: Buffer.from(bytesBase64, 'base64'),
                    mimeType: prediction?.mimeType || 'image/jpeg',
                    model: IMAGEN_CAPABILITY_MODEL,
                    optimizedPrompt: prompt,
                };
            }
            lastError =
                res?.data?.filteredReason ||
                prediction?.raiFilteredReason ||
                'Subject customization returned no image';
        } catch (err) {
            lastError = err?.response?.data?.error?.message || err?.message || lastError;
            console.warn('[demoUsersImagen] subject customization attempt failed', lastError);
        }
    }

    const err = new Error(lastError);
    err.code = 'imagen-subject-customization-failed';
    throw err;
}

async function uploadDemoAdminImage(adminUid, kind, buffer, mimeType) {
    const bucketName = getStorageBucketName();
    const bucket = admin.storage().bucket(bucketName);
    const ext = mimeType?.includes('png') ? 'png' : 'jpg';
    const storageKind = kind === 'cover' ? 'cover' : 'avatar';
    const path = `demo-users/uploads/${adminUid}/ai_${storageKind}_${Date.now()}.${ext}`;
    const file = bucket.file(path);

    await file.save(buffer, {
        contentType: mimeType || 'image/jpeg',
        metadata: {
            metadata: {
                source: 'admin-ai-demo-user',
                kind: storageKind,
                uploadedBy: adminUid,
            },
        },
    });

    const token = await ensureDownloadToken(file);
    const imageUrl = buildPublicDownloadUrl(bucketName, path, token);
    return { imageUrl, storagePath: path };
}

function assertProfileForGeneration(profile) {
    if (!profile.gender) throw new Error('Gender is required before generating images.');
    if (!profile.ageCategory) throw new Error('Age group is required before generating images.');
}

async function generateAvatarImageCore(profile, geo, userPrompt) {
    const brief = buildAvatarBrief(profile, geo, userPrompt);
    const optimizedPrompt =
        (await optimizeImagenPrompt(brief)) ||
        buildFallbackImagenPrompt('avatar', profile, geo, userPrompt, '');

    const { buffer, mimeType, model } = await callVertexImagen(optimizedPrompt, '1:1', 'avatar');
    return { buffer, mimeType, model, optimizedPrompt, aspectRatio: '1:1' };
}

async function generateCoverFromAvatarReference({
    profile,
    geo,
    userPrompt,
    coverScene,
    referenceBuffer,
}) {
    const subjectDescription = buildSubjectDescription(profile);
    const coverPrompt = buildCoverSubjectPrompt(
        subjectDescription,
        profile,
        geo,
        userPrompt,
        coverScene
    );

    try {
        return await callVertexImagenSubjectCustomization({
            prompt: coverPrompt,
            referenceBuffer,
            subjectDescription,
            aspectRatio: '16:9',
        });
    } catch (err) {
        console.warn(
            '[demoUsersImagen] subject cover failed, using text-only person fallback',
            err?.message
        );
        const fallbackPrompt = buildFallbackCoverPersonPrompt(
            profile,
            geo,
            userPrompt,
            coverScene
        );
        const fallback = await callVertexImagen(fallbackPrompt, '16:9', 'cover_person');
        return { ...fallback, optimizedPrompt: fallbackPrompt, usedSubjectFallback: true };
    }
}

/**
 * @param {{
 *   adminUid: string,
 *   kind: 'avatar' | 'cover',
 *   profile: object,
 *   geo?: object,
 *   userPrompt?: string,
 *   coverScene?: string,
 *   referenceAvatarUrl?: string,
 * }} opts
 */
async function generateDemoUserImage(opts) {
    const adminUid = String(opts.adminUid || '').trim();
    const kind = normalizeKind(opts.kind);
    const profile = normalizeProfile(opts.profile);
    const geo = opts.geo && typeof opts.geo === 'object' ? opts.geo : {};
    const userPrompt = sanitizePrompt(opts.userPrompt || '');
    const coverScene = String(opts.coverScene || 'cafe').trim().toLowerCase();
    const referenceAvatarUrl = String(opts.referenceAvatarUrl || '').trim();

    if (!adminUid) throw new Error('Admin UID is required.');
    if (!kind) throw new Error('kind must be "avatar" or "cover".');
    assertProfileForGeneration(profile);

    let imageResult;
    let optimizedPrompt;

    if (kind === 'cover' && referenceAvatarUrl) {
        const { buffer: referenceBuffer } = await fetchImageBuffer(referenceAvatarUrl);
        imageResult = await generateCoverFromAvatarReference({
            profile,
            geo,
            userPrompt,
            coverScene,
            referenceBuffer,
        });
        optimizedPrompt = imageResult.optimizedPrompt;
    } else {
        const aspectRatio = kind === 'cover' ? '16:9' : '1:1';
        const brief =
            kind === 'cover'
                ? buildCoverBrief(profile, geo, userPrompt, coverScene)
                : buildAvatarBrief(profile, geo, userPrompt);

        optimizedPrompt =
            (await optimizeImagenPrompt(brief)) ||
            buildFallbackImagenPrompt(kind, profile, geo, userPrompt, coverScene);

        imageResult = await callVertexImagen(optimizedPrompt, aspectRatio, kind);
    }

    const { imageUrl, storagePath } = await uploadDemoAdminImage(
        adminUid,
        kind,
        imageResult.buffer,
        imageResult.mimeType
    );

    return {
        kind,
        imageUrl,
        storagePath,
        optimizedPrompt,
        aspectRatio: kind === 'cover' ? '16:9' : '1:1',
        imagenModel: imageResult.model,
        usedSubjectReference: Boolean(kind === 'cover' && referenceAvatarUrl),
        usedSubjectFallback: Boolean(imageResult.usedSubjectFallback),
    };
}

/**
 * Generate avatar + cover as the same person (avatar → subject-customized cover).
 */
async function generateDemoUserCharacterPair(opts) {
    const adminUid = String(opts.adminUid || '').trim();
    const profile = normalizeProfile(opts.profile);
    const geo = opts.geo && typeof opts.geo === 'object' ? opts.geo : {};
    const userPrompt = sanitizePrompt(opts.userPrompt || '');
    const coverScene = String(opts.coverScene || 'cafe').trim().toLowerCase();

    if (!adminUid) throw new Error('Admin UID is required.');
    assertProfileForGeneration(profile);

    const avatarCore = await generateAvatarImageCore(profile, geo, userPrompt);
    const coverCore = await generateCoverFromAvatarReference({
        profile,
        geo,
        userPrompt,
        coverScene,
        referenceBuffer: avatarCore.buffer,
    });

    const avatarUpload = await uploadDemoAdminImage(
        adminUid,
        'avatar',
        avatarCore.buffer,
        avatarCore.mimeType
    );
    const coverUpload = await uploadDemoAdminImage(
        adminUid,
        'cover',
        coverCore.buffer,
        coverCore.mimeType
    );

    return {
        avatar: {
            kind: 'avatar',
            imageUrl: avatarUpload.imageUrl,
            storagePath: avatarUpload.storagePath,
            optimizedPrompt: avatarCore.optimizedPrompt,
            aspectRatio: '1:1',
            imagenModel: avatarCore.model,
        },
        cover: {
            kind: 'cover',
            imageUrl: coverUpload.imageUrl,
            storagePath: coverUpload.storagePath,
            optimizedPrompt: coverCore.optimizedPrompt,
            aspectRatio: '16:9',
            imagenModel: coverCore.model,
            usedSubjectFallback: Boolean(coverCore.usedSubjectFallback),
        },
        subjectDescription: buildSubjectDescription(profile),
        coverScene,
    };
}

module.exports = {
    generateDemoUserImage,
    generateDemoUserCharacterPair,
    COVER_SCENE_PROMPTS,
};
