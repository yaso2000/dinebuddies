import { getApp } from 'firebase/app';
import { getAI, getGenerativeModel, getImagenModel, GoogleAIBackend, VertexAIBackend } from 'firebase/ai';
import {
    coalesceInvitationAiText,
    extractInvitationFieldsFromRaw,
} from '../utils/invitationAiTextExtract.js';
import {
    buildCardStructurePromptBlock,
    enforceCardStructureTextLimits,
    normalizeCardStructure,
} from '../utils/cardStructure.js';
import {
    buildPrivateInvitationContextLines,
    buildPrivateInvitationSystemInstruction,
} from '../utils/privateInvitationAiPrompt.js';
import {
    GEMINI_PROVIDER_BILLING_CODE,
    isGeminiProviderBillingExhausted,
    normalizeGeminiProviderBillingError,
} from '../utils/geminiProviderErrors.js';
import { normalizeAiOutputLanguage, getAiOutputLanguageLabel } from '../utils/aiOutputLanguage.js';
import { AI_USER_PROMPT_MAX_CHARS, getAiUserPromptDefaultEn } from '../constants/aiPromptLimits.js';

export type AiOutputLanguage =
    | 'ar'
    | 'en'
    | 'fr'
    | 'es'
    | 'it'
    | 'de'
    | 'pt'
    | 'tr'
    | 'ur'
    | 'hi';

export type TextPostType = 'regular_post' | 'featured_post' | 'animated_post' | 'invitation' | 'design_studio' | 'text_assistant';
export type PostType = TextPostType | 'magic_cover';
export type InvitationSubType = 'public' | 'private' | 'date';
export type CardStructure = 'arch_luxury' | 'vintage_ticket' | 'modern_minimal';
export type AnimationType = 'slide-up' | 'fade-in' | 'zoom-in';
export type InvitationAccountType = 'user' | 'business';
export type GenerationPackage = 'text' | 'image' | 'invitation_bundle';
export type CoverAspectRatio = '1:1' | '4:5' | '9:16' | '16:9';
export type DesignStudioCategory =
    | 'square'
    | 'story'
    | 'landscape'
    | 'profile_picture'
    | 'profile_cover'
    | 'business_logo';

export interface BusinessOfferContext {
    title: string;
    description?: string;
}

export interface BusinessInvitationContext {
    businessName?: string;
    businessType?: string;
    tagline?: string;
    description?: string;
    city?: string;
    country?: string;
    address?: string;
    offers?: BusinessOfferContext[];
}

export interface DatingCommunityContext {
    id: string;
    name: string;
    type: string;
}

export interface DatingInvitationContext {
    inviteeId?: string;
    inviteeName?: string;
    date?: string;
    time?: string;
    venueDetails?: {
        venueId?: string;
        name?: string;
        address?: string;
        city?: string;
        country?: string;
        lat?: number;
        lng?: number;
    };
    sharedCommunities?: DatingCommunityContext[];
    inviteeGender?: string;
    inviteeAgeGroup?: string;
    inviteeFavoriteFoods?: string[];
    inviteeCommunityNames?: string[];
    inviteePersonalityVibe?: string;
    senderFirstName?: string;
    senderGender?: string;
    senderAgeGroup?: string;
    senderPersonalityVibe?: string;
    senderFavoriteFoods?: string[];
    ageGap?: string;
    sharedInterests?: string[];
    sharedFoodPreferences?: string[];
    venueName?: string;
}

export interface GenerateContentInput {
    userPrompt: string;
    postType: TextPostType;
    subType?: InvitationSubType;
    venueType?: string;
    venueName?: string;
    accountType?: InvitationAccountType;
    businessContext?: BusinessInvitationContext;
    datingContext?: DatingInvitationContext;
    cardStructure?: CardStructure;
    outputLanguage?: AiOutputLanguage | string;
}

export interface InvitationContent {
    title: string;
    description: string;
}

export interface RegularPostContent {
    text: string;
}

export interface FeaturedPostContent {
    title: string;
    description: string;
}

export interface AnimatedPostContent {
    title: string;
    description: string;
    animation_type: AnimationType;
}

export type GeneratedContent =
    | InvitationContent
    | RegularPostContent
    | FeaturedPostContent
    | AnimatedPostContent;

export type GenerateContentSuccess = {
    success: true;
    data: GeneratedContent;
};

export type GenerateContentError = {
    success: false;
    error: string;
    code:
        | 'GEMINI_API_ERROR'
        | 'GEMINI_PROVIDER_BILLING_EXHAUSTED'
        | 'MALFORMED_JSON'
        | 'VALIDATION_ERROR';
};

export type GenerateContentResult = GenerateContentSuccess | GenerateContentError;

export interface ImagePromptContent {
    imagePrompt: string;
    styleHints?: string;
}

export interface ImageModerationResult {
    safe: boolean;
    approvedForInvitationCover: boolean;
    description: string;
    ocrText: string;
    adult?: string;
    violence?: string;
    moderationNotes?: string;
}

export interface MediaLibraryItem {
    url: string;
    source: 'ai_generated';
    createdAt: string;
}

export interface GeneratedImagePayload {
    url: string;
    mimeType: string;
    mediaLibraryItem: MediaLibraryItem;
    moderation: ImageModerationResult;
    imagePrompt: string;
}

export interface MultimodalPipelineInput {
    generationPackage: GenerationPackage;
    userPrompt: string;
    postType?: TextPostType;
    subType?: InvitationSubType;
    venueType?: string;
    venueName?: string;
    accountType: InvitationAccountType;
    businessContext?: BusinessInvitationContext;
    aspectRatio?: CoverAspectRatio;
    designCategory?: DesignStudioCategory;
    outputLanguage?: AiOutputLanguage | string;
}

export interface MultimodalPipelineData {
    title?: string;
    description?: string;
    text?: string;
    imagePrompt?: string;
    image?: GeneratedImagePayload;
}

export type MultimodalPipelineSuccess = {
    success: true;
    data: MultimodalPipelineData;
    meta: {
        accountType: InvitationAccountType;
        generationPackage: GenerationPackage;
        stages: string[];
    };
};

export type MultimodalPipelineError = {
    success: false;
    error: string;
    code:
        | 'GEMINI_API_ERROR'
        | 'MALFORMED_JSON'
        | 'VALIDATION_ERROR'
        | 'MODERATION_FAILED'
        | 'IMAGE_GENERATION_FAILED';
    stage?: string;
};

export type MultimodalPipelineResult = MultimodalPipelineSuccess | MultimodalPipelineError;

/** Text + vision tasks (1.5 retired ΓÇö use 2.5 Flash). Override via GEMINI_MODEL. */
const TEXT_MODEL_NAME =
    (typeof process !== 'undefined' && process.env?.GEMINI_MODEL?.trim()) || 'gemini-2.5-flash';

/** Imagen for cover generation. Override via IMAGEN_MODEL. */
const IMAGEN_MODEL_FALLBACKS = [
    (typeof process !== 'undefined' && process.env?.IMAGEN_MODEL?.trim()) || '',
    'imagen-4.0-fast-generate-001',
    'imagen-4.0-generate-001',
    'imagen-3.0-generate-002',
].filter(Boolean);

const IMAGEN_MODEL_NAME = IMAGEN_MODEL_FALLBACKS[0] || 'imagen-4.0-fast-generate-001';
const ANIMATION_TYPES: AnimationType[] = ['slide-up', 'fade-in', 'zoom-in'];
const INVITATION_TITLE_MAX_LENGTH = 120;

const JSON_OUTPUT_RULE =
    'Respond with one valid JSON object only. No markdown, no code fences, no ```json wrapper, and no extra text.';

type AiBackendMode = 'google' | 'vertex';

/** google only | vertex only | auto = google then vertex on prepay/billing 429 */
function resolveBackendChain(): AiBackendMode[] {
    const configured = String(
        (typeof process !== 'undefined' && process.env?.GEMINI_BACKEND) || 'auto',
    )
        .trim()
        .toLowerCase();
    if (configured === 'vertex' || configured === 'vertexai') return ['vertex'];
    if (configured === 'google') return ['google'];
    return ['google', 'vertex'];
}

function vertexLocation(): string {
    return (
        (typeof process !== 'undefined' && process.env?.GEMINI_VERTEX_LOCATION?.trim()) ||
        'us-central1'
    );
}

function createAi(mode: AiBackendMode) {
    const backend =
        mode === 'vertex' ? new VertexAIBackend(vertexLocation()) : new GoogleAIBackend();
    return getAI(getApp(), { backend });
}

function isRetryableProviderBillingFailure(error: unknown): boolean {
    return isGeminiProviderBillingExhausted(error instanceof Error ? error.message : error);
}

function isBillingFailureResult(result: {
    success?: boolean;
    error?: string;
    code?: string;
}): boolean {
    if (!result || result.success !== false) return false;
    if (result.code === GEMINI_PROVIDER_BILLING_CODE) return true;
    return isGeminiProviderBillingExhausted(result.error);
}

async function withBackendFallback<T>(fn: (mode: AiBackendMode) => Promise<T>): Promise<T> {
    const chain = resolveBackendChain();
    let lastError: unknown;
    for (let i = 0; i < chain.length; i += 1) {
        try {
            return await fn(chain[i]);
        } catch (error) {
            lastError = error;
            const hasNext = i < chain.length - 1;
            if (!hasNext || !isRetryableProviderBillingFailure(error)) {
                throw error;
            }
            console.warn(
                `[GeminiService] ${chain[i]} billing exhausted, retrying with ${chain[i + 1]}`,
            );
        }
    }
    throw lastError;
}

async function withBackendFallbackResult<T extends { success: boolean; error?: string; code?: string }>(
    fn: (mode: AiBackendMode) => Promise<T>,
): Promise<T> {
    const chain = resolveBackendChain();
    let lastResult: T | undefined;
    for (let i = 0; i < chain.length; i += 1) {
        const result = await fn(chain[i]);
        lastResult = result;
        if (result.success !== false) return result;
        const hasNext = i < chain.length - 1;
        if (!hasNext || !isBillingFailureResult(result)) return result;
        console.warn(
            `[GeminiService] ${chain[i]} billing exhausted for images, retrying with ${chain[i + 1]}`,
        );
    }
    return lastResult as T;
}

function geminiFailureFromError(error: unknown, fallback = 'Unknown Gemini API error'): GenerateContentError {
    const billing = normalizeGeminiProviderBillingError(error);
    if (billing) {
        return {
            success: false,
            error: billing.message,
            code: GEMINI_PROVIDER_BILLING_CODE,
        };
    }
    return {
        success: false,
        error: error instanceof Error ? error.message : fallback,
        code: 'GEMINI_API_ERROR',
    };
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

function buildLanguageRule(outputLanguage: AiOutputLanguage): string {
    const langCode = normalizeAiOutputLanguage(outputLanguage) as AiOutputLanguage;
    const langLabel = getAiOutputLanguageLabel(langCode);
    if (langCode === 'ar') {
        return `Write only in natural, engaging Arabic (warm Modern Standard / spoken-standard fusion). Output must match the JSON shape described in the user message.`;
    }
    return `Write only in natural, engaging ${langLabel}. Output must match the JSON shape described in the user message.`;
}

function buildInvitationSystemInstruction(
    subType: InvitationSubType | undefined,
    accountType: InvitationAccountType,
    cardStructure: CardStructure = 'modern_minimal',
    outputLanguage: AiOutputLanguage = 'en',
): string {
    const baseRule = `Return exactly: {"title":"...","description":"..."}. No other keys. Do not invent a venue address. Use venueType and venueName from context only. Both title and description are REQUIRED — never leave description empty.`;
    const langLabel = getAiOutputLanguageLabel(outputLanguage);

    let toneRule = '';

    if (accountType === 'business') {
        toneRule = `Write a promotional business invitation in ${langLabel}: welcoming, professional, and marketing-oriented. Speak as the venue inviting guests. Weave in businessName, tagline, profileDescription, and activeOffers from context when provided — never invent offers, discounts, or locations not in context.`;

        if (subType === 'public') {
            toneRule +=
                ' Public invitation: catchy title featuring the business; description highlights what makes the venue special and any active offer.';
        } else if (subType === 'social') {
            toneRule += ' Private invitation: exclusive, VIP tone while staying professional.';
        } else if (subType === 'private') {
            toneRule += ' Date invitation: romantic ambiance with a polished hospitality tone.';
        }
    } else {
        toneRule = `Write a personal social invitation in ${langLabel}: warm, casual, and informal — like a friend inviting friends to meet up at a venue.`;

        if (subType === 'public') {
            toneRule +=
                ' Public invitation: catchy title (venue name allowed from context), friendly open invite for the venue type.';
        } else if (subType === 'social') {
            toneRule += ' Private invitation: warm, personal, close-friends tone.';
        } else if (subType === 'private') {
            return buildPrivateInvitationSystemInstruction(cardStructure, outputLanguage);
        }
    }

    const structureBlock = buildCardStructurePromptBlock(normalizeCardStructure(cardStructure));
    return `${baseRule} ${toneRule}${structureBlock}`;
}

function buildSystemInstruction(
    postType: TextPostType,
    subType?: InvitationSubType,
    accountType: InvitationAccountType = 'user',
    cardStructure: CardStructure = 'modern_minimal',
    outputLanguage: AiOutputLanguage = 'en',
): string {
    const languageRule = buildLanguageRule(outputLanguage);

    switch (postType) {
        case 'invitation':
            return `${JSON_OUTPUT_RULE} ${languageRule} ${buildInvitationSystemInstruction(subType, accountType, cardStructure, outputLanguage)}`;

        case 'regular_post':
            return `${JSON_OUTPUT_RULE} ${languageRule} Return exactly: {"title":"...","text":"..."}. "title" is a short catchy headline. "text" is the post body with fitting emoji.`;

        case 'featured_post':
            return `${JSON_OUTPUT_RULE} ${languageRule} Return exactly: {"title":"...","description":"..."}.`;

        case 'animated_post':
            return `${JSON_OUTPUT_RULE} ${languageRule} Return exactly: {"title":"...","description":"...","animation_type":"..."} where animation_type is one of: slide-up, fade-in, zoom-in.`;

        case 'text_assistant':
            return `${JSON_OUTPUT_RULE} ${languageRule} Return exactly: {"answer":"..."}. "answer" is a clear, helpful reply in plain language (2–6 sentences when needed). For DineBuddies questions (invitations, credits, profiles, communities, Connect), explain app features accurately without inventing capabilities. Do not include markdown headings or bullet lists unless the user asked for a list.`;

        default:
            return `${JSON_OUTPUT_RULE} ${languageRule}`;
    }
}

function appendContextLine(lines: string[], label: string, value: unknown) {
    if (isNonEmptyString(value)) {
        lines.push(`${label}: ${value.trim()}`);
    }
}

function buildUserPrompt(input: GenerateContentInput): string {
    const { postType, userPrompt, accountType = 'user' } = input;
    const lines: string[] = [];

    if (postType === 'invitation') {
        if (accountType === 'business') {
            lines.push('accountType: business');
            const ctx = input.businessContext;
            if (ctx) {
                appendContextLine(lines, 'businessName', ctx.businessName);
                appendContextLine(lines, 'businessType', ctx.businessType);
                appendContextLine(lines, 'tagline', ctx.tagline);
                appendContextLine(lines, 'profileDescription', ctx.description);
                appendContextLine(lines, 'city', ctx.city);
                appendContextLine(lines, 'country', ctx.country);
                appendContextLine(lines, 'address', ctx.address);

                if (ctx.offers?.length) {
                    lines.push('activeOffers:');
                    for (const offer of ctx.offers) {
                        const offerLine = offer.description
                            ? `- ${offer.title} ΓÇö ${offer.description}`
                            : `- ${offer.title}`;
                        lines.push(offerLine);
                    }
                }
            }
        } else {
            lines.push('accountType: user');
        }

        appendContextLine(lines, 'venueType', input.venueType);
        appendContextLine(lines, 'venueName', input.venueName);

        const dating = input.datingContext;
        if (dating) {
            if (input.subType === 'private') {
                lines.push(...buildPrivateInvitationContextLines(dating));
            } else {
                appendContextLine(lines, 'inviteeName', dating.inviteeName);
                appendContextLine(lines, 'inviteeId', dating.inviteeId);
                appendContextLine(lines, 'inviteeGender', dating.inviteeGender);
                appendContextLine(lines, 'inviteeAgeGroup', dating.inviteeAgeGroup);
                if (dating.inviteeFavoriteFoods?.length) {
                    lines.push(`inviteeFavoriteFoods: ${dating.inviteeFavoriteFoods.join(', ')}`);
                }
                if (dating.inviteeCommunityNames?.length) {
                    lines.push(`inviteeCommunities: ${dating.inviteeCommunityNames.join(', ')}`);
                }
                appendContextLine(lines, 'date', dating.date);
                appendContextLine(lines, 'time', dating.time);
                const vd = dating.venueDetails;
                if (vd) {
                    appendContextLine(lines, 'venueId', vd.venueId);
                    appendContextLine(lines, 'venueName', vd.name);
                    appendContextLine(lines, 'venueAddress', vd.address);
                    appendContextLine(lines, 'venueCity', vd.city);
                    appendContextLine(lines, 'venueCountry', vd.country);
                }
                if (dating.sharedCommunities?.length) {
                    lines.push('sharedCommunities:');
                    for (const c of dating.sharedCommunities) {
                        lines.push(`- ${c.name} (${c.type})`);
                    }
                }
            }
        }

        appendContextLine(lines, 'cardStructure', input.cardStructure);
    }

    const trimmed = userPrompt.trim();
    if (trimmed) {
        lines.push(trimmed);
    }

    return lines.join('\n').trim();
}

/**
 * Firebase AI Logic: use getGenerativeModel + per-request generationConfig (JSON mode only).
 * The SDK does not expose `ai.generateContent({ model, config })` on the AI instance.
 */
async function invokeGeminiJsonModel(
    prompt: string,
    systemInstruction: string,
    maxOutputTokens = 1024,
): Promise<string> {
    return withBackendFallback(async (mode) => {
        const ai = createAi(mode);
        const model = getGenerativeModel(ai, { model: TEXT_MODEL_NAME });

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            systemInstruction,
            generationConfig: {
                responseMimeType: 'application/json',
                maxOutputTokens,
            },
        });

        return result.response.text();
    });
}

async function invokeGeminiJsonWithImage(
    systemInstruction: string,
    imageBase64: string,
    mimeType: string,
    userText: string,
): Promise<string> {
    return withBackendFallback(async (mode) => {
        const ai = createAi(mode);
        const model = getGenerativeModel(ai, { model: TEXT_MODEL_NAME });

        const result = await model.generateContent({
            contents: [
                {
                    role: 'user',
                    parts: [
                        { inlineData: { mimeType, data: imageBase64 } },
                        { text: userText },
                    ],
                },
            ],
            systemInstruction,
            generationConfig: {
                responseMimeType: 'application/json',
                maxOutputTokens: 1024,
            },
        });

        return result.response.text();
    });
}

function extractJsonBody(rawText: string): string {
    let body = rawText.trim();
    if (!body) return body;

    body = body.replace(/```(?:json|javascript|js)?\s*/gi, '').replace(/```/g, '').trim();

    const objectMatch = body.match(/\{[\s\S]*\}/);
    if (objectMatch) {
        body = objectMatch[0];
    }
    return body;
}

function parseModelJson(rawText: string): unknown {
    return JSON.parse(extractJsonBody(rawText));
}

function safeParseModelJson(rawText: string): { ok: true; value: unknown } | { ok: false } {
    if (!rawText?.trim()) {
        return { ok: false };
    }
    try {
        return { ok: true, value: parseModelJson(rawText) };
    } catch {
        const body = extractJsonBody(rawText);
        try {
            return { ok: true, value: JSON.parse(body) };
        } catch {
            const fromRaw = extractInvitationFieldsFromRaw(body);
            if (fromRaw.title || fromRaw.description) {
                return {
                    ok: true,
                    value: {
                        ...(fromRaw.title ? { title: fromRaw.title } : {}),
                        ...(fromRaw.description ? { description: fromRaw.description } : {}),
                    },
                };
            }
            return { ok: false };
        }
    }
}

function validateGeneratedContent(postType: TextPostType, value: unknown): string | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return 'Response is not a JSON object';
    }

    const record = value as Record<string, unknown>;

    switch (postType) {
        case 'invitation': {
            if (!isNonEmptyString(record.title)) return 'Missing or empty "title"';
            if (!isNonEmptyString(record.description)) return 'Missing or empty "description"';
            if (record.title.length > INVITATION_TITLE_MAX_LENGTH) {
                return `"title" must be at most ${INVITATION_TITLE_MAX_LENGTH} characters`;
            }
            if ('location_hint' in record || 'tone' in record) {
                return 'invitation must not include "location_hint" or "tone"';
            }
            return null;
        }

        case 'regular_post': {
            if (!isNonEmptyString(record.title)) return 'Missing or empty "title"';
            if (!isNonEmptyString(record.text)) return 'Missing or empty "text"';
            if (record.title.length > 100) return '"title" must be at most 100 characters';
            if (record.text.length > 300) return '"text" must be at most 300 characters';
            return null;
        }

        case 'featured_post': {
            if (!isNonEmptyString(record.title)) return 'Missing or empty "title"';
            if (!isNonEmptyString(record.description)) return 'Missing or empty "description"';
            return null;
        }

        case 'animated_post': {
            if (!isNonEmptyString(record.title)) return 'Missing or empty "title"';
            if (!isNonEmptyString(record.description)) return 'Missing or empty "description"';
            if (!isNonEmptyString(record.animation_type)) return 'Missing or empty "animation_type"';
            if (!ANIMATION_TYPES.includes(record.animation_type as AnimationType)) {
                return `Invalid "animation_type": must be one of ${ANIMATION_TYPES.join(', ')}`;
            }
            return null;
        }

        case 'text_assistant': {
            if (!isNonEmptyString(record.answer)) return 'Missing or empty "answer"';
            if (record.answer.length > 1200) return '"answer" must be at most 1200 characters';
            return null;
        }

        default:
            return 'Unsupported post type';
    }
}

export async function generateContent(input: GenerateContentInput): Promise<GenerateContentResult> {
    const {
        userPrompt,
        postType,
        subType,
        accountType = 'user',
        cardStructure = 'modern_minimal',
        outputLanguage: outputLanguageRaw,
    } = input;
    const outputLanguage = normalizeAiOutputLanguage(outputLanguageRaw);

    const effectiveUserPrompt = (
        isNonEmptyString(userPrompt)
            ? userPrompt.trim()
            : getAiUserPromptDefaultEn(postType, subType)
    ).slice(0, AI_USER_PROMPT_MAX_CHARS);

    if (!effectiveUserPrompt) {
        return {
            success: false,
            error: 'userPrompt is required',
            code: 'VALIDATION_ERROR',
        };
    }

    const prompt = buildUserPrompt({ ...input, userPrompt: effectiveUserPrompt });
    const systemInstruction = buildSystemInstruction(
        postType,
        subType,
        accountType,
        normalizeCardStructure(cardStructure),
        outputLanguage,
    );

    try {
        const rawText = await invokeGeminiJsonModel(
            prompt,
            systemInstruction,
            postType === 'invitation' || postType === 'text_assistant' ? 2048 : 1024,
        );

        if (!rawText || !rawText.trim()) {
            return {
                success: false,
                error: 'Gemini returned an empty response',
                code: 'GEMINI_API_ERROR',
            };
        }

        const parsedResult = safeParseModelJson(rawText);
        if (parsedResult.ok === false) {
            return {
                success: false,
                error: 'Gemini returned malformed JSON',
                code: 'MALFORMED_JSON',
            };
        }

        let parsed: unknown = parsedResult.value;

        if (postType === 'invitation') {
            parsed = coalesceInvitationAiText(parsed, rawText);
            const record = parsed as Record<string, unknown>;
            const limited = enforceCardStructureTextLimits(
                normalizeCardStructure(cardStructure),
                isNonEmptyString(record.title) ? record.title : '',
                isNonEmptyString(record.description) ? record.description : '',
            );
            parsed = {
                ...record,
                ...(limited.title ? { title: limited.title } : {}),
                ...(limited.description ? { description: limited.description } : {}),
            };
        }

        const validationError = validateGeneratedContent(postType, parsed);
        if (validationError) {
            return {
                success: false,
                error: validationError,
                code: 'VALIDATION_ERROR',
            };
        }

        return {
            success: true,
            data: parsed as GeneratedContent,
        };
    } catch (error) {
        return geminiFailureFromError(error);
    }
}

function buildImagePromptSystemInstruction(
    accountType: InvitationAccountType,
    postType?: TextPostType,
    designCategory?: DesignStudioCategory,
    outputLanguage: AiOutputLanguage = 'en',
): string {
    const briefLang = getAiOutputLanguageLabel(outputLanguage);
    const interpretBrief = `The user's creative brief may be written in ${briefLang}. Interpret it fully and faithfully when crafting the English Imagen prompt.`;

    if (postType === 'design_studio' && designCategory) {
        const categoryRules: Record<DesignStudioCategory, string> = {
            square:
                'General square social graphic. Balanced centered composition, vibrant but clean, studio or lifestyle lighting.',
            story:
                'Vertical mobile story/reel cover. Strong focal point in safe center, mobile-first framing, bold visual hierarchy.',
            landscape:
                'Horizontal widescreen banner. Cinematic panoramic composition, wide depth, editorial photography or illustration.',
            profile_picture:
                'Profile avatar photo. Close-up portrait, centered subject, clean soft background, flattering professional headshot lighting.',
            profile_cover:
                'Profile header cover. Wide panoramic scene with negative space for text overlay, contextual mood, soft gradients allowed.',
            business_logo:
                'Business logo mark. Flat vector-style logo icon, minimalist, isolated on solid color background, no photorealistic photography, no mockup scene, no watermark.',
        };

        const rule = categoryRules[designCategory] || categoryRules.square;

        return `${JSON_OUTPUT_RULE} You are the DineBuddies AI Design Studio prompt engine (Mode 2). ${interpretBrief} Return exactly one JSON object with keys: status ("success"), category (the design category id), aspect_ratio (e.g. 1:1, 9:16, 16:9), optimized_prompt (highly detailed English Imagen prompt), allow_download (true), and imagePrompt (same English text as optimized_prompt). No markdown, no extra text. Category rule: ${rule} Never embed readable text, watermarks, or logos in the image unless the user explicitly requests text for a logo wordmark.`;
    }

    const shape =
        `Return exactly: {"imagePrompt":"...","styleHints":"..."}. ${interpretBrief} imagePrompt must be English, detailed, photorealistic, no text/watermarks/logos in the image. styleHints is optional.`;

    if (accountType === 'business') {
        return `${JSON_OUTPUT_RULE} ${shape} Create a professional promotional cover prompt for Imagen: highlight signature dishes, elegant interior, or brand ambiance using businessName, businessType, tagline, profileDescription, and activeOffers from context. High-end hospitality marketing look.`;
    }

    return `${JSON_OUTPUT_RULE} ${shape} Create a welcoming social dining cover prompt for Imagen: friends enjoying a casual meal that matches venueType and venueName ΓÇö warm, authentic, lifestyle photography.`;
}

function buildImagePromptUserContext(input: MultimodalPipelineInput, invitationText?: InvitationContent): string {
    const lines: string[] = [];
    lines.push(`accountType: ${input.accountType}`);

    if (input.accountType === 'business' && input.businessContext) {
        const ctx = input.businessContext;
        appendContextLine(lines, 'businessName', ctx.businessName);
        appendContextLine(lines, 'businessType', ctx.businessType);
        appendContextLine(lines, 'tagline', ctx.tagline);
        appendContextLine(lines, 'profileDescription', ctx.description);
        if (ctx.offers?.length) {
            lines.push('activeOffers:');
            for (const offer of ctx.offers) {
                lines.push(offer.description ? `- ${offer.title} ΓÇö ${offer.description}` : `- ${offer.title}`);
            }
        }
    }

    appendContextLine(lines, 'venueType', input.venueType);
    appendContextLine(lines, 'venueName', input.venueName);
    appendContextLine(lines, 'subType', input.subType);
    appendContextLine(lines, 'aspectRatio', input.aspectRatio || '1:1');
    appendContextLine(lines, 'designCategory', input.designCategory);
    appendContextLine(lines, 'postType', input.postType || 'invitation');

    if (invitationText) {
        appendContextLine(lines, 'invitationTitle', invitationText.title);
        appendContextLine(lines, 'invitationDescription', invitationText.description);
    }

    const trimmed = input.userPrompt.trim();
    if (trimmed) {
        lines.push(trimmed);
    }

    return lines.join('\n').trim();
}

const IMAGE_MODERATION_INSTRUCTION = `${JSON_OUTPUT_RULE} Analyze the invitation cover image. Return exactly: {"safe":boolean,"approvedForInvitationCover":boolean,"description":"...","ocrText":"...","adult":"unlikely|possible|likely","violence":"unlikely|possible|likely","moderationNotes":"..."}. Set approvedForInvitationCover false for nudity, hate symbols, violence, illegal content, or prominent readable personal data. ocrText lists any visible text (empty string if none).`;

export async function generateImagePrompt(
    input: MultimodalPipelineInput,
    invitationText?: InvitationContent,
): Promise<{ success: true; data: ImagePromptContent } | GenerateContentError> {
    const outputLanguage = normalizeAiOutputLanguage(input.outputLanguage) as AiOutputLanguage;
    try {
        const rawText = await invokeGeminiJsonModel(
            buildImagePromptUserContext(input, invitationText),
            buildImagePromptSystemInstruction(
                input.accountType,
                input.postType,
                input.designCategory,
                outputLanguage,
            ),
            2048,
        );

        const parsedResult = safeParseModelJson(rawText);
        if (!parsedResult.ok) {
            return {
                success: false,
                error: 'Gemini returned malformed JSON for image prompt',
                code: 'MALFORMED_JSON',
            };
        }

        const parsed = parsedResult.value as Record<string, unknown>;
        const imagePromptRaw =
            (isNonEmptyString(parsed.optimized_prompt) && parsed.optimized_prompt.trim()) ||
            (isNonEmptyString(parsed.imagePrompt) && parsed.imagePrompt.trim()) ||
            '';

        if (!imagePromptRaw) {
            return {
                success: false,
                error: 'Missing or empty "imagePrompt" / "optimized_prompt"',
                code: 'VALIDATION_ERROR',
            };
        }

        return {
            success: true,
            data: {
                imagePrompt: imagePromptRaw,
                styleHints: isNonEmptyString(parsed.styleHints) ? parsed.styleHints.trim() : undefined,
            },
        };
    } catch (error) {
        return geminiFailureFromError(error, 'Image prompt generation failed');
    }
}

function sanitizeImagenPrompt(prompt: string): string {
    return String(prompt || '')
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        .replace(/```(?:json)?/gi, '')
        .replace(/[`<>{}[\]\\|]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 2000);
}

export async function generateCoverImage(
    imagePrompt: string,
    aspectRatio: CoverAspectRatio = '1:1',
): Promise<
    | { success: true; bytesBase64: string; mimeType: string; filteredReason?: string }
    | {
          success: false;
          error: string;
          code: 'IMAGE_GENERATION_FAILED' | 'GEMINI_API_ERROR' | typeof GEMINI_PROVIDER_BILLING_CODE;
      }
> {
    const safePrompt = sanitizeImagenPrompt(imagePrompt);
    if (!safePrompt) {
        return {
            success: false,
            error: 'Image prompt is empty after sanitization',
            code: 'IMAGE_GENERATION_FAILED',
        };
    }

    return withBackendFallbackResult(async (mode) => {
        const ai = createAi(mode);
        const modelsToTry = [...new Set(IMAGEN_MODEL_FALLBACKS)];
        let lastError: string | undefined;

        for (const modelName of modelsToTry) {
            try {
                const model = getImagenModel(ai, {
                    model: modelName,
                    generationConfig: {
                        numberOfImages: 1,
                        aspectRatio,
                    },
                });

                const response = await model.generateImages(safePrompt);
                const first = response.images?.[0];

                if (!first?.bytesBase64Encoded) {
                    lastError =
                        response.filteredReason ||
                        `Imagen (${modelName}) returned no image (prompt may have been filtered)`;
                    continue;
                }

                return {
                    success: true,
                    bytesBase64: first.bytesBase64Encoded,
                    mimeType: first.mimeType || 'image/jpeg',
                    filteredReason: response.filteredReason,
                };
            } catch (error) {
                lastError = error instanceof Error ? error.message : String(error);
                console.warn('[generateCoverImage] model failed', mode, modelName, lastError);
            }
        }

        const errText = lastError || 'Imagen generation failed';
        const billing = normalizeGeminiProviderBillingError(errText);
        if (billing) {
            return { success: false, error: billing.message, code: GEMINI_PROVIDER_BILLING_CODE };
        }
        const isFiltered =
            /filtered|no image|safety|blocked/i.test(errText) &&
            !/unavailable|503|404|not found|permission/i.test(errText);

        return {
            success: false,
            error: errText,
            code: isFiltered ? 'IMAGE_GENERATION_FAILED' : 'GEMINI_API_ERROR',
        };
    });
}

export async function analyzeImageModeration(
    bytesBase64: string,
    mimeType: string,
): Promise<{ success: true; data: ImageModerationResult } | MultimodalPipelineError> {
    try {
        const rawText = await invokeGeminiJsonWithImage(
            IMAGE_MODERATION_INSTRUCTION,
            bytesBase64,
            mimeType,
            'Moderate this generated invitation cover image.',
        );

        const parsedResult = safeParseModelJson(rawText);
        if (!parsedResult.ok) {
            return {
                success: false,
                error: 'Gemini returned malformed JSON for image moderation',
                code: 'MALFORMED_JSON',
                stage: 'image_moderation',
            };
        }

        const parsed = parsedResult.value as Record<string, unknown>;

        const moderation: ImageModerationResult = {
            safe: parsed.safe === true,
            approvedForInvitationCover: parsed.approvedForInvitationCover === true,
            description: isNonEmptyString(parsed.description) ? parsed.description.trim() : '',
            ocrText: isNonEmptyString(parsed.ocrText) ? parsed.ocrText.trim() : '',
            adult: isNonEmptyString(parsed.adult) ? parsed.adult.trim() : undefined,
            violence: isNonEmptyString(parsed.violence) ? parsed.violence.trim() : undefined,
            moderationNotes: isNonEmptyString(parsed.moderationNotes)
                ? parsed.moderationNotes.trim()
                : undefined,
        };

        return { success: true, data: moderation };
    } catch (error) {
        return { ...geminiFailureFromError(error, 'Image moderation failed'), stage: 'image_moderation' };
    }
}

/**
 * Stage 0ΓÇô3 multimodal pipeline: role context ΓåÆ text (+ image prompt) ΓåÆ Imagen ΓåÆ moderation.
 * Upload to storage is handled by the API layer after moderation passes.
 */
export async function runMultimodalPipeline(
    input: MultimodalPipelineInput,
): Promise<
    | (MultimodalPipelineSuccess & {
          pendingImage?: {
              bytesBase64: string;
              mimeType: string;
              imagePrompt: string;
              moderation: ImageModerationResult;
          };
      })
    | MultimodalPipelineError
> {
    const stages: string[] = ['stage0_role_context'];
    const postType = input.postType || 'invitation';
    const includeText =
        input.generationPackage === 'text' || input.generationPackage === 'invitation_bundle';
    const includeImage =
        input.generationPackage === 'image' || input.generationPackage === 'invitation_bundle';

    const outputLanguage = normalizeAiOutputLanguage(input.outputLanguage) as AiOutputLanguage;
    const output: MultimodalPipelineData = {};

    let invitationText: InvitationContent | undefined;

    if (includeText) {
        stages.push('stage1_text_generation');
        const textResult = await generateContent({
            userPrompt: input.userPrompt,
            postType,
            subType: input.subType,
            venueType: input.venueType,
            venueName: input.venueName,
            accountType: input.accountType,
            businessContext: input.businessContext,
            outputLanguage,
        });

        if (!textResult.success) {
            return {
                success: false,
                error: textResult.error,
                code: textResult.code,
                stage: 'text_generation',
            };
        }

        if (postType === 'invitation') {
            invitationText = textResult.data as InvitationContent;
            output.title = invitationText.title;
            output.description = invitationText.description;
        } else if ('text' in textResult.data) {
            output.text = textResult.data.text;
        } else if ('title' in textResult.data && 'description' in textResult.data) {
            output.title = textResult.data.title;
            output.description = textResult.data.description;
        }
    }

    if (!includeImage) {
        return {
            success: true,
            data: output,
            meta: {
                accountType: input.accountType,
                generationPackage: input.generationPackage,
                stages,
            },
        };
    }

    stages.push('stage1_image_prompt');
    const promptResult = await generateImagePrompt(input, invitationText);
    if (!promptResult.success) {
        return {
            success: false,
            error: promptResult.error,
            code: promptResult.code,
            stage: 'image_prompt',
        };
    }

    output.imagePrompt = promptResult.data.imagePrompt;

    stages.push('stage2_image_generation');
    const imageResult = await generateCoverImage(
        promptResult.data.imagePrompt,
        input.aspectRatio || '1:1',
    );
    if (!imageResult.success) {
        return {
            success: false,
            error: imageResult.error,
            code: imageResult.code,
            stage: 'image_generation',
        };
    }

    stages.push('stage3_image_moderation');
    const moderationResult = await analyzeImageModeration(
        imageResult.bytesBase64,
        imageResult.mimeType,
    );
    if (!moderationResult.success) {
        return moderationResult;
    }

    if (!moderationResult.data.approvedForInvitationCover) {
        return {
            success: false,
            error:
                moderationResult.data.moderationNotes ||
                'Generated image did not pass moderation checks',
            code: 'MODERATION_FAILED',
            stage: 'image_moderation',
        };
    }

    return {
        success: true,
        data: output,
        meta: {
            accountType: input.accountType,
            generationPackage: input.generationPackage,
            stages,
        },
        pendingImage: {
            bytesBase64: imageResult.bytesBase64,
            mimeType: imageResult.mimeType,
            imagePrompt: promptResult.data.imagePrompt,
            moderation: moderationResult.data,
        },
    };
}
