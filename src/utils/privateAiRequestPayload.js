/**
 * Build and validate POST /api/ai/generate payloads for dating (subType: date) invitations.
 */
import {
    AI_USER_PROMPT_MAX_CHARS,
    getAiUserPromptDefaultEn,
} from '../constants/aiPromptLimits.js';
import {
    normalizeCardStructure,
    resolveCardStructureFromBackgroundId,
} from './cardStructure.js';

/**
 * @param {unknown} value
 */
export function pickDatingString(value) {
    if (value == null) return '';
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    return '';
}

/**
 * @param {{
 *   venueDetails?: Record<string, unknown>,
 *   venueName?: string,
 *   venueId?: string,
 *   address?: string,
 *   city?: string,
 *   country?: string,
 *   lat?: number | string,
 *   lng?: number | string,
 * }} input
 * @returns {Record<string, unknown> | null}
 */
export function buildDatingVenueDetails(input = {}) {
    const nested =
        input.venueDetails && typeof input.venueDetails === 'object' && !Array.isArray(input.venueDetails)
            ? input.venueDetails
            : {};

    const venueId =
        pickDatingString(input.venueId) ||
        pickDatingString(nested.venueId) ||
        pickDatingString(nested.restaurantId);
    const name =
        pickDatingString(input.venueName) ||
        pickDatingString(nested.name) ||
        pickDatingString(nested.venueName) ||
        pickDatingString(input.address) ||
        pickDatingString(nested.address) ||
        pickDatingString(nested.location);
    const address =
        pickDatingString(input.address) ||
        pickDatingString(nested.address) ||
        pickDatingString(nested.location);

    if (!name && !venueId) return null;

    /** @type {Record<string, unknown>} */
    const details = {};
    if (venueId) details.venueId = venueId;
    if (name) details.name = name;
    if (address) details.address = address;

    const city = pickDatingString(input.city) || pickDatingString(nested.city);
    const country = pickDatingString(input.country) || pickDatingString(nested.country);
    if (city) details.city = city;
    if (country) details.country = country;

    const latRaw = input.lat ?? nested.lat;
    const lngRaw = input.lng ?? nested.lng;
    const lat = typeof latRaw === 'number' ? latRaw : Number(latRaw);
    const lng = typeof lngRaw === 'number' ? lngRaw : Number(lngRaw);
    if (Number.isFinite(lat)) details.lat = lat;
    if (Number.isFinite(lng)) details.lng = lng;

    return details;
}

/**
 * @typedef {Object} DatingAiContext
 * @property {string} [inviteeId]
 * @property {string} [inviteeName]
 * @property {string} [date]
 * @property {string} [time]
 * @property {string} [venueType]
 * @property {string} [venueName]
 * @property {string} [venueId]
 * @property {string} [address]
 * @property {string} [city]
 * @property {string} [country]
 * @property {number} [lat]
 * @property {number} [lng]
 * @property {Record<string, unknown>} [venueDetails]
 * @property {'arch_luxury' | 'vintage_ticket' | 'modern_minimal'} [cardStructure]
 * @property {string} [cardBackgroundId]
 */

/**
 * Build dating AI context from invitation form state (always reads latest field values).
 * @param {{
 *   invitedFriends?: string[],
 *   date?: string,
 *   time?: string,
 *   venueType?: string,
 *   restaurantName?: string,
 *   restaurantId?: string | null,
 *   location?: string,
 *   city?: string,
 *   country?: string,
 *   lat?: number | string | null,
 *   lng?: number | string | null,
 * }} formData
 * @param {string} [inviteeName]
 * @param {string} [cardBackgroundId]
 */
export function createPrivateAiContextFromForm(formData, inviteeName = '', cardBackgroundId = '') {
    const inviteeId = pickDatingString(formData?.invitedFriends?.[0]);
    const date = pickDatingString(formData?.date);
    const time = pickDatingString(formData?.time);
    const venueName =
        pickDatingString(formData?.restaurantName) || pickDatingString(formData?.location);
    const venueId = pickDatingString(formData?.restaurantId);
    const address = pickDatingString(formData?.location);
    const venueType = pickDatingString(formData?.venueType) || 'Restaurant';

    const venueDetails = buildDatingVenueDetails({
        venueName,
        venueId,
        address,
        city: pickDatingString(formData?.city),
        country: pickDatingString(formData?.country),
        lat: formData?.lat ?? undefined,
        lng: formData?.lng ?? undefined,
    });

    const bgId = pickDatingString(cardBackgroundId) || pickDatingString(formData?.cardBackgroundId);
    const cardStructure =
        pickDatingString(formData?.cardStructure) ||
        resolveCardStructureFromBackgroundId(bgId);

    return {
        inviteeId,
        inviteeName: pickDatingString(inviteeName),
        date,
        time,
        venueType,
        venueName: venueName || pickDatingString(venueDetails?.name),
        venueId: venueId || pickDatingString(venueDetails?.venueId),
        address,
        city: pickDatingString(formData?.city),
        country: pickDatingString(formData?.country),
        lat: typeof venueDetails?.lat === 'number' ? venueDetails.lat : undefined,
        lng: typeof venueDetails?.lng === 'number' ? venueDetails.lng : undefined,
        venueDetails: venueDetails || undefined,
        cardBackgroundId: bgId || undefined,
        cardStructure: normalizeCardStructure(cardStructure),
    };
}

/**
 * @param {DatingAiContext | null | undefined} context
 */
export function validatePrivateAiContext(context) {
    const inviteeId = pickDatingString(context?.inviteeId);
    const date = pickDatingString(context?.date);
    const time = pickDatingString(context?.time);
    const venueDetails = buildDatingVenueDetails(context || {});

    /** @type {string[]} */
    const missing = [];
    if (!date) missing.push('date');
    if (!time) missing.push('time');
    if (!venueDetails) missing.push('venueDetails');
    else {
        if (!pickDatingString(venueDetails.name) && !pickDatingString(venueDetails.venueId)) {
            missing.push('venueName');
        }
    }

    if (missing.length > 0) {
        return { ok: false, missing };
    }

    const venueName =
        pickDatingString(context?.venueName) ||
        pickDatingString(venueDetails?.name) ||
        pickDatingString(context?.address);
    const venueType = pickDatingString(context?.venueType) || 'Restaurant';

    return {
        ok: true,
        inviteeId,
        inviteeName: pickDatingString(context?.inviteeName),
        date,
        time,
        venueType,
        venueName,
        venueId: pickDatingString(venueDetails?.venueId),
        venueDetails,
    };
}

/**
 * Merge partial generate options back into a full dating context object.
 * @param {DatingAiContext | null | undefined} base
 * @param {Record<string, unknown>} [overrides]
 */
export function mergeDatingAiContext(base, overrides = {}) {
    return {
        ...(base && typeof base === 'object' ? base : {}),
        ...overrides,
        venueDetails:
            overrides.venueDetails && typeof overrides.venueDetails === 'object'
                ? overrides.venueDetails
                : base?.venueDetails,
    };
}

/**
 * @param {string} userPrompt
 * @param {DatingAiContext | null | undefined} context
 */
export function buildPrivateAiGenerateBody(userPrompt, context) {
    const trimmedPrompt =
        pickDatingString(userPrompt).slice(0, AI_USER_PROMPT_MAX_CHARS) ||
        getAiUserPromptDefaultEn('invitation', 'date');

    const validated = validatePrivateAiContext(context);
    if (!validated.ok) {
        return {
            ok: false,
            code: 'VALIDATION_ERROR',
            error: 'private_context_incomplete',
            missing: validated.missing,
        };
    }

    return {
        ok: true,
        body: {
            userPrompt: trimmedPrompt,
            postType: 'invitation',
            subType: 'private',
            inviteeId: validated.inviteeId,
            inviteeName: validated.inviteeName || undefined,
            date: validated.date,
            time: validated.time,
            venueType: validated.venueType,
            venueName: validated.venueName,
            venueId: validated.venueId || undefined,
            venueDetails: validated.venueDetails,
            cardStructure: normalizeCardStructure(context?.cardStructure),
        },
    };
}

/**
 * Map dating context → generateAIContent options.
 * @param {DatingAiContext | null | undefined} context
 */
export function datingContextToGenerateOptions(context) {
    const validated = validatePrivateAiContext(context);
    if (!validated.ok) return null;
    return {
        inviteeId: validated.inviteeId,
        date: validated.date,
        time: validated.time,
        venueType: validated.venueType,
        venueName: validated.venueName,
        venueId: validated.venueId,
        address: pickDatingString(context?.address),
        city: pickDatingString(context?.city),
        country: pickDatingString(context?.country),
        lat: context?.lat,
        lng: context?.lng,
        venueDetails: validated.venueDetails,
    };
}
