import { formatAgeGroupsSmart } from './invitationDisplayUtils';

const HEADLINE_MAX = 120;

/**
 * Rule-based description builder (no external LLM). Fills the invitation message from form fields.
 * Control what is included via `options`.
 */
export function defaultSmartBioOptions() {
    return {
        includeCity: true,
        includeDateTime: true,
        includeVenueType: true,
        includeGender: true,
        includeAge: true,
        includeGuests: true,
        includePayment: true,
        includeTitle: true,
        /** 'sentence' = separators ·  |  'lines' = one detail per line */
        format: 'sentence'
    };
}

/**
 * Shared field extraction for rule-based text and AI payload.
 * @returns {object}
 */
function computeInvitationNarrativeContext(formData, ctx) {
    const { t, language = 'en', userProfile, currentUser } = ctx;

    const {
        restaurantName,
        location,
        time,
        date,
        paymentType,
        city,
        type,
        genderGroups,
        ageGroups,
        guestsNeeded,
        title
    } = formData || {};

    const hostName = (
        userProfile?.display_name
        || userProfile?.displayName
        || currentUser?.name
        || currentUser?.displayName
        || ''
    ).trim() || t('host', 'Host');

    const genderLabels = (genderGroups || [])
        .map((g) => {
            if (g === 'male') return t('male');
            if (g === 'female') return t('female');
            if (g === 'unspecified') return t('non_binary', { defaultValue: 'Non-binary' });
            return g;
        })
        .filter(Boolean);

    const inviteesGenderSummary = genderLabels.length
        ? genderLabels.join(String(language).startsWith('ar') ? '، ' : ', ')
        : t('not_set', 'not set yet');

    const ageSummary = formatAgeGroupsSmart(ageGroups || [], t);

    const venueDisplay = (restaurantName || '').trim()
        || (location || '').trim().split(',')[0]?.trim()
        || t('venue_tbd', 'the venue');

    const whenLine = date && time ? `${date} ${time}` : (date || time || t('datetime_tbd', 'TBD'));
    const tbd = t('datetime_tbd', 'TBD');

    return {
        hostName,
        inviteesGenderSummary,
        ageSummary,
        venueDisplay,
        whenLine,
        tbd,
        title,
        city,
        location,
        type,
        paymentType,
        guestsNeeded,
        date,
        time
    };
}

/**
 * Plain object for POST /api/generate-image with body.mode headline_suggestions (null = omit in AI prompt).
 * @param {object} formData
 * @param {object} ctx — same as buildSmartInvitationDescription
 */
/** Minimal structured hints for Magic Cover — full invitation context comes from userBrief + userPreferences. */
export function buildMagicCoverHints(formData, ctx) {
    const { language = 'en' } = ctx;
    const c = computeInvitationNarrativeContext(formData, ctx);
    return {
        language: String(language).slice(0, 12),
        hostName: c.hostName,
    };
}

export function buildInvitationAiPayload(formData, ctx) {
    const { t, language = 'en', options = defaultSmartBioOptions() } = ctx;
    const o = options;
    const c = computeInvitationNarrativeContext(formData, ctx);

    const whenForAi =
        o.includeDateTime && c.whenLine && c.whenLine !== c.tbd ? c.whenLine : null;

    let guestsNeeded = null;
    if (o.includeGuests && c.guestsNeeded != null && c.guestsNeeded !== '') {
        const n = Number(c.guestsNeeded);
        guestsNeeded = Number.isFinite(n) ? n : null;
    }

    return {
        language: String(language).slice(0, 12),
        hostName: c.hostName,
        venueName: c.venueDisplay,
        title: o.includeTitle && (c.title || '').trim() ? (c.title || '').trim() : null,
        city: o.includeCity && (c.city || '').trim() ? (c.city || '').trim() : null,
        locationDetail: (c.location || '').trim() ? (c.location || '').trim().slice(0, 220) : null,
        whenLine: whenForAi,
        venueType: o.includeVenueType ? (c.type || 'Restaurant') : null,
        genderSummary: o.includeGender ? c.inviteesGenderSummary : null,
        ageSummary: o.includeAge ? c.ageSummary : null,
        guestsNeeded,
        paymentType: o.includePayment && c.paymentType ? String(c.paymentType) : null
    };
}

/**
 * @param {object} formData — CreateInvitation form slice
 * @param {object} ctx
 * @param {Function} ctx.t — i18n t
 * @param {string} [ctx.language] — i18n language
 * @param {object} [ctx.userProfile]
 * @param {object} [ctx.currentUser]
 * @param {ReturnType<defaultSmartBioOptions>} [ctx.options]
 * @returns {{ text: string, errorKey: string | null }} errorKey if too little content
 */
export function buildSmartInvitationDescription(formData, ctx) {
    const { t, language = 'en', options = defaultSmartBioOptions() } = ctx;
    const c = computeInvitationNarrativeContext(formData, ctx);
    const sep = options.format === 'lines' ? '\n' : ' · ';
    const ar = String(language).startsWith('ar');

    const partsAr = [
        `${c.hostName} يدعوكم إلى ${c.venueDisplay}`,
        options.includeCity && (c.city || '').trim() && `${t('city')}: ${c.city}`,
        options.includeDateTime && c.whenLine && c.whenLine !== c.tbd ? `${c.whenLine}` : '',
        options.includeVenueType && `${c.type || 'Restaurant'}`,
        options.includeGender && c.inviteesGenderSummary,
        options.includeAge && c.ageSummary,
        options.includeGuests && c.guestsNeeded != null ? String(c.guestsNeeded) : '',
        options.includePayment && c.paymentType ? t(c.paymentType.toLowerCase().replace(' ', '_')) : '',
        options.includeTitle && (c.title || '').trim()
    ];

    const partsEn = [
        `${c.hostName} invites you to ${c.venueDisplay}`,
        options.includeCity && (c.city || '').trim() && `City: ${c.city}`,
        options.includeDateTime && c.whenLine && c.whenLine !== c.tbd ? `When: ${c.whenLine}` : '',
        options.includeVenueType && `Type: ${c.type || 'Restaurant'}`,
        options.includeGender && `Looking for: ${c.inviteesGenderSummary}`,
        options.includeAge && c.ageSummary && `Ages: ${c.ageSummary}`,
        options.includeGuests && c.guestsNeeded != null && `Spots: ${c.guestsNeeded}`,
        options.includePayment && c.paymentType && `Payment: ${c.paymentType}`,
        options.includeTitle && (c.title || '').trim() && `Title: ${c.title}`
    ];

    const raw = ar
        ? partsAr.filter(Boolean).join(sep)
        : partsEn.filter(Boolean).join(sep);

    const text = raw.substring(0, HEADLINE_MAX);
    if (text.length < 10) {
        return { text: '', errorKey: 'failed_generate_bio' };
    }
    return { text, errorKey: null };
}

export const invitationMessageMaxLength = HEADLINE_MAX;
