/**
 * Shared request parsing for /api/ai/generate and /api/ai/multi-generate.
 */

const INVITATION_SUB_TYPES = new Set(['public', 'private', 'date']);
const TEXT_POST_TYPES = new Set(['regular_post', 'featured_post', 'animated_post', 'invitation']);
const GENERATION_PACKAGES = new Set(['text', 'image', 'invitation_bundle']);
const ASPECT_RATIOS = new Set(['1:1', '9:16']);
const CARD_STRUCTURES = new Set(['arch_luxury', 'vintage_ticket', 'modern_minimal']);

/**
 * @param {unknown} body
 */
export function parseAiGenerateBody(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return { ok: false, error: 'Request body must be a JSON object' };
    }

    const record = /** @type {Record<string, unknown>} */ (body);
    const {
        userPrompt,
        postType,
        subType,
        venueType,
        venueName,
        generationPackage,
        aspectRatio,
        inviteeId,
        date,
        time,
        venueDetails,
        cardStructure,
    } = record;

    if (typeof userPrompt !== 'string' || !userPrompt.trim()) {
        return { ok: false, error: 'userPrompt is required' };
    }

    const trimmedPrompt = userPrompt.trim();
    const normalizedPackage = String(generationPackage || '').trim();
    const normalizedPostType = typeof postType === 'string' ? postType.trim() : '';

    /** @type {'text' | 'image' | 'invitation_bundle'} */
    let resolvedPackage = 'text';

    if (normalizedPackage && GENERATION_PACKAGES.has(normalizedPackage)) {
        resolvedPackage = /** @type {'text' | 'image' | 'invitation_bundle'} */ (normalizedPackage);
    } else if (normalizedPostType === 'magic_cover') {
        resolvedPackage = 'image';
    } else if (normalizedPostType === 'invitation') {
        resolvedPackage = 'text';
    }

    if (resolvedPackage === 'image' || normalizedPostType === 'magic_cover') {
        const postTypeForImage =
            normalizedPostType === 'magic_cover' || !normalizedPostType
                ? 'invitation'
                : TEXT_POST_TYPES.has(normalizedPostType)
                  ? normalizedPostType
                  : 'invitation';

        if (subType !== undefined && subType !== null && subType !== '') {
            if (typeof subType !== 'string' || !INVITATION_SUB_TYPES.has(subType)) {
                return { ok: false, error: 'subType must be public, private, or date when provided' };
            }
            if (postTypeForImage !== 'invitation') {
                return { ok: false, error: 'subType is only allowed for invitation requests' };
            }
        }

        const optionalSubType =
            postTypeForImage === 'invitation' &&
            typeof subType === 'string' &&
            INVITATION_SUB_TYPES.has(subType)
                ? subType
                : undefined;

        const ratio =
            typeof aspectRatio === 'string' && ASPECT_RATIOS.has(aspectRatio.trim())
                ? aspectRatio.trim()
                : '1:1';

        return {
            ok: true,
            generationPackage: 'image',
            postType: postTypeForImage,
            userPrompt: trimmedPrompt,
            aspectRatio: ratio,
            ...(postTypeForImage === 'invitation'
                ? {
                      venueType: pickOptionalString(venueType),
                      venueName: pickOptionalString(venueName),
                  }
                : {}),
            ...(optionalSubType ? { subType: optionalSubType } : {}),
        };
    }

    if (resolvedPackage === 'invitation_bundle') {
        const postTypeForBundle =
            normalizedPostType && TEXT_POST_TYPES.has(normalizedPostType)
                ? normalizedPostType
                : 'invitation';

        /** @type {'public' | 'private' | 'date' | undefined} */
        let parsedSubType;
        if (postTypeForBundle === 'invitation') {
            if (typeof subType !== 'string' || !INVITATION_SUB_TYPES.has(subType)) {
                return { ok: false, error: 'subType is required for invitation_bundle' };
            }
            parsedSubType = subType;
        } else if (subType !== undefined && subType !== null && subType !== '') {
            return { ok: false, error: 'subType is only allowed for invitation requests' };
        }

        const ratio =
            typeof aspectRatio === 'string' && ASPECT_RATIOS.has(aspectRatio.trim())
                ? aspectRatio.trim()
                : '1:1';

        return {
            ok: true,
            generationPackage: 'invitation_bundle',
            postType: postTypeForBundle,
            userPrompt: trimmedPrompt,
            aspectRatio: ratio,
            ...(postTypeForBundle === 'invitation'
                ? {
                      venueType: pickOptionalString(venueType),
                      venueName: pickOptionalString(venueName),
                  }
                : {}),
            ...(parsedSubType ? { subType: parsedSubType } : {}),
        };
    }

    if (!normalizedPostType || !TEXT_POST_TYPES.has(normalizedPostType)) {
        return { ok: false, error: 'postType is required and must be a supported value' };
    }

    if (normalizedPostType === 'invitation') {
        if (typeof subType !== 'string' || !INVITATION_SUB_TYPES.has(subType)) {
            return { ok: false, error: 'subType is required for invitation postType' };
        }

        if (subType === 'date') {
            const datingCtx = parseDatingTextContext(record);
            if (datingCtx.ok === false) {
                return datingCtx;
            }
            return {
                ok: true,
                generationPackage: 'text',
                postType: 'invitation',
                userPrompt: trimmedPrompt,
                subType,
                inviteeId: datingCtx.inviteeId,
                date: datingCtx.date,
                time: datingCtx.time,
                venueDetails: datingCtx.venueDetails,
                venueType: pickOptionalString(venueType),
                venueName: datingCtx.venueDetails.name || pickOptionalString(venueName),
                cardStructure: pickCardStructure(cardStructure) || 'modern_minimal',
            };
        }

        return {
            ok: true,
            generationPackage: 'text',
            postType: 'invitation',
            userPrompt: trimmedPrompt,
            subType,
            venueType: pickOptionalString(venueType),
            venueName: pickOptionalString(venueName),
            cardStructure: pickCardStructure(cardStructure) || 'modern_minimal',
        };
    }

    if (subType !== undefined && subType !== null && subType !== '') {
        return { ok: false, error: 'subType is only allowed for invitation requests' };
    }

    return {
        ok: true,
        generationPackage: 'text',
        postType: normalizedPostType,
        userPrompt: trimmedPrompt,
    };
}

/** @param {unknown} value */
function pickCardStructure(value) {
    const raw = typeof value === 'string' ? value.trim() : '';
    return CARD_STRUCTURES.has(raw) ? raw : undefined;
}

/** @param {unknown} value */
function pickOptionalString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** @param {unknown} value */
function pickVenueDetails(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const v = /** @type {Record<string, unknown>} */ (value);
    const name = pickOptionalString(v.name) || pickOptionalString(v.venueName) || pickOptionalString(v.location);
    const venueId = pickOptionalString(v.venueId) || pickOptionalString(v.restaurantId);
    if (!name && !venueId) return undefined;
    return {
        ...(venueId ? { venueId } : {}),
        ...(name ? { name } : {}),
        ...(pickOptionalString(v.address) ? { address: pickOptionalString(v.address) } : {}),
        ...(pickOptionalString(v.city) ? { city: pickOptionalString(v.city) } : {}),
        ...(pickOptionalString(v.country) ? { country: pickOptionalString(v.country) } : {}),
        ...(typeof v.lat === 'number' ? { lat: v.lat } : {}),
        ...(typeof v.lng === 'number' ? { lng: v.lng } : {}),
    };
}

/**
 * Dating text generation requires invitee, schedule, and venue before Gemini runs.
 * @param {Record<string, unknown>} record
 */
function parseDatingTextContext(record) {
    const inviteeId = pickOptionalString(record.inviteeId);
    const date = pickOptionalString(record.date);
    const time = pickOptionalString(record.time);
    let venueDetails = pickVenueDetails(record.venueDetails);

    if (!venueDetails) {
        const topLevelName = pickOptionalString(record.venueName);
        const topLevelId = pickOptionalString(record.venueId);
        if (topLevelName || topLevelId) {
            venueDetails = {
                ...(topLevelId ? { venueId: topLevelId } : {}),
                ...(topLevelName ? { name: topLevelName } : {}),
            };
        }
    }

    /** @type {string[]} */
    const missing = [];
    if (!inviteeId) missing.push('inviteeId');
    if (!date) missing.push('date');
    if (!time) missing.push('time');
    if (!venueDetails) missing.push('venueDetails');

    if (missing.length > 0) {
        return {
            ok: false,
            error: 'dating_context_incomplete',
            missing,
            message: `Missing required dating fields: ${missing.join(', ')}`,
        };
    }

    return {
        ok: true,
        inviteeId,
        date,
        time,
        venueDetails,
    };
}
