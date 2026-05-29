import { getApp } from 'firebase/app';
import { getAI, getGenerativeModel, getImagenModel, GoogleAIBackend } from 'firebase/ai';

export type TextPostType = 'regular_post' | 'featured_post' | 'animated_post' | 'invitation';
export type PostType = TextPostType | 'magic_cover';
export type InvitationSubType = 'public' | 'private' | 'date';
export type AnimationType = 'slide-up' | 'fade-in' | 'zoom-in';
export type InvitationAccountType = 'user' | 'business';
export type GenerationPackage = 'text' | 'image' | 'invitation_bundle';
export type CoverAspectRatio = '1:1' | '9:16';

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
    code: 'GEMINI_API_ERROR' | 'MALFORMED_JSON' | 'VALIDATION_ERROR';
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

/** Text + vision tasks (1.5 retired — use 2.5 Flash). Override via GEMINI_MODEL. */
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

function getAi() {
    return getAI(getApp(), { backend: new GoogleAIBackend() });
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

function buildInvitationSystemInstruction(
    subType: InvitationSubType | undefined,
    accountType: InvitationAccountType,
): string {
    const baseRule = `Return exactly: {"title":"...","description":"..."}. No other keys. Do not invent a venue address. Use venueType and venueName from context only. title max ${INVITATION_TITLE_MAX_LENGTH} chars.`;

    if (accountType === 'business') {
        let businessRule =
            'Write a promotional business invitation in Arabic: welcoming, professional, and marketing-oriented. Speak as the venue inviting guests. Weave in businessName, tagline, profileDescription, and activeOffers from context when provided — never invent offers, discounts, or locations not in context.';

        if (subType === 'public') {
            businessRule +=
                ' Public invitation: catchy title featuring the business; description highlights what makes the venue special and any active offer.';
        } else if (subType === 'private') {
            businessRule += ' Private invitation: exclusive, VIP tone while staying professional.';
        } else if (subType === 'date') {
            businessRule += ' Date invitation: romantic ambiance with a polished hospitality tone.';
        }

        return baseRule + ' ' + businessRule;
    }

    let personalRule =
        'Write a personal social invitation in Arabic: warm, casual, and informal — like a friend inviting friends to meet up at a venue.';

    if (subType === 'public') {
        personalRule +=
            ' Public invitation: catchy title (venue name allowed from context), friendly open invite for the venue type.';
    } else if (subType === 'private') {
        personalRule += ' Private invitation: warm, personal, close-friends tone.';
    } else if (subType === 'date') {
        personalRule +=
            ' Date invitation: romantic, light, and practical tone. Factor in the specific date and time so the Arabic sounds natural (e.g., Friday evening → «مساء الجمعة»; two days away → «بعد يومين»). When inviteeName or sharedCommunities appear in context, personalize elegantly. If a shared community matches the venue cuisine/type, weave one subtle reference (e.g., «وبما إننا في مجتمع السوشي…»). Never invent communities, venues, or facts not in context.';
    }

    return baseRule + ' ' + personalRule;
}

function buildSystemInstruction(
    postType: TextPostType,
    subType?: InvitationSubType,
    accountType: InvitationAccountType = 'user',
): string {
    const languageRule =
        'Write only in natural, engaging Arabic. Output must match the JSON shape described in the user message.';

    switch (postType) {
        case 'invitation':
            return `${JSON_OUTPUT_RULE} ${languageRule} ${buildInvitationSystemInstruction(subType, accountType)}`;

        case 'regular_post':
            return `${JSON_OUTPUT_RULE} ${languageRule} Return exactly: {"text":"..."}. Facebook-style post with fitting emoji. No title field.`;

        case 'featured_post':
            return `${JSON_OUTPUT_RULE} ${languageRule} Return exactly: {"title":"...","description":"..."}.`;

        case 'animated_post':
            return `${JSON_OUTPUT_RULE} ${languageRule} Return exactly: {"title":"...","description":"...","animation_type":"..."} where animation_type is one of: slide-up, fade-in, zoom-in.`;

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
                            ? `- ${offer.title} — ${offer.description}`
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
            appendContextLine(lines, 'inviteeName', dating.inviteeName);
            appendContextLine(lines, 'inviteeId', dating.inviteeId);
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
    const ai = getAi();
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
}

async function invokeGeminiJsonWithImage(
    systemInstruction: string,
    imageBase64: string,
    mimeType: string,
    userText: string,
): Promise<string> {
    const ai = getAi();
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
}

function extractJsonBody(rawText: string): string {
    let body = rawText.trim();
    const fenced = body.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    if (fenced) {
        body = fenced[1].trim();
    }
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
        return { ok: false };
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
            if (!isNonEmptyString(record.text)) return 'Missing or empty "text"';
            if ('title' in record) return 'regular_post must not include "title"';
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

        default:
            return 'Unsupported post type';
    }
}

export async function generateContent(input: GenerateContentInput): Promise<GenerateContentResult> {
    const { userPrompt, postType, subType, accountType = 'user' } = input;

    if (!isNonEmptyString(userPrompt)) {
        return {
            success: false,
            error: 'userPrompt is required',
            code: 'VALIDATION_ERROR',
        };
    }

    const prompt = buildUserPrompt(input);
    const systemInstruction = buildSystemInstruction(postType, subType, accountType);

    try {
        const rawText = await invokeGeminiJsonModel(prompt, systemInstruction);

        if (!rawText || !rawText.trim()) {
            return {
                success: false,
                error: 'Gemini returned an empty response',
                code: 'GEMINI_API_ERROR',
            };
        }

        let parsed: unknown;
        try {
            parsed = parseModelJson(rawText);
        } catch {
            return {
                success: false,
                error: 'Gemini returned malformed JSON',
                code: 'MALFORMED_JSON',
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
        const message = error instanceof Error ? error.message : 'Unknown Gemini API error';
        return {
            success: false,
            error: message,
            code: 'GEMINI_API_ERROR',
        };
    }
}

function buildImagePromptSystemInstruction(accountType: InvitationAccountType): string {
    const shape =
        'Return exactly: {"imagePrompt":"...","styleHints":"..."}. imagePrompt must be English, detailed, photorealistic, no text/watermarks/logos in the image. styleHints is optional.';

    if (accountType === 'business') {
        return `${JSON_OUTPUT_RULE} ${shape} Create a professional promotional cover prompt for Imagen: highlight signature dishes, elegant interior, or brand ambiance using businessName, businessType, tagline, profileDescription, and activeOffers from context. High-end hospitality marketing look.`;
    }

    return `${JSON_OUTPUT_RULE} ${shape} Create a welcoming social dining cover prompt for Imagen: friends enjoying a casual meal that matches venueType and venueName — warm, authentic, lifestyle photography.`;
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
                lines.push(offer.description ? `- ${offer.title} — ${offer.description}` : `- ${offer.title}`);
            }
        }
    }

    appendContextLine(lines, 'venueType', input.venueType);
    appendContextLine(lines, 'venueName', input.venueName);
    appendContextLine(lines, 'aspectRatio', input.aspectRatio || '1:1');

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
    try {
        const rawText = await invokeGeminiJsonModel(
            buildImagePromptUserContext(input, invitationText),
            buildImagePromptSystemInstruction(input.accountType),
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
        if (!isNonEmptyString(parsed.imagePrompt)) {
            return {
                success: false,
                error: 'Missing or empty "imagePrompt"',
                code: 'VALIDATION_ERROR',
            };
        }

        return {
            success: true,
            data: {
                imagePrompt: parsed.imagePrompt.trim(),
                styleHints: isNonEmptyString(parsed.styleHints) ? parsed.styleHints.trim() : undefined,
            },
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Image prompt generation failed',
            code: 'GEMINI_API_ERROR',
        };
    }
}

export async function generateCoverImage(
    imagePrompt: string,
    aspectRatio: CoverAspectRatio = '1:1',
): Promise<
    | { success: true; bytesBase64: string; mimeType: string; filteredReason?: string }
    | { success: false; error: string; code: 'IMAGE_GENERATION_FAILED' | 'GEMINI_API_ERROR' }
> {
    const ai = getAi();
    /** @type {string[]} */
    const modelsToTry = [...new Set(IMAGEN_MODEL_FALLBACKS)];
    /** @type {string | undefined} */
    let lastError;

    for (const modelName of modelsToTry) {
        try {
            const model = getImagenModel(ai, {
                model: modelName,
                generationConfig: {
                    numberOfImages: 1,
                    aspectRatio,
                },
            });

            const response = await model.generateImages(imagePrompt);
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
            console.warn('[generateCoverImage] model failed', modelName, lastError);
        }
    }

    const errText = lastError || 'Imagen generation failed';
    const isFiltered =
        /filtered|no image|safety|blocked/i.test(errText) && !/unavailable|503|404|not found|permission/i.test(errText);

    return {
        success: false,
        error: errText,
        code: isFiltered ? 'IMAGE_GENERATION_FAILED' : 'GEMINI_API_ERROR',
    };
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
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Image moderation failed',
            code: 'GEMINI_API_ERROR',
            stage: 'image_moderation',
        };
    }
}

/**
 * Stage 0–3 multimodal pipeline: role context → text (+ image prompt) → Imagen → moderation.
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
