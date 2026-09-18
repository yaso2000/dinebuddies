import { buildCardStructurePromptBlock, normalizeCardStructure } from './cardStructure.js';
import {
    getAiOutputLanguageLabel,
    normalizeAiOutputLanguage,
} from './aiOutputLanguage.js';

/**
 * System instruction for a 1-on-1 personal dining invite from one member to another
 * (subType: date/personal, accountType: user). This is a friendly, non-romantic
 * meetup invitation — a warm invite to share a meal. Output stays JSON
 * { title, description } for the app pipeline.
 * @param {import('../services/GeminiService.js').CardStructure | string} [cardStructure]
 * @param {string} [outputLanguage]
 */
export function buildPrivateInvitationSystemInstruction(cardStructure = 'modern_minimal', outputLanguage = 'en') {
    const structureBlock = buildCardStructurePromptBlock(normalizeCardStructure(cardStructure));
    const langCode = normalizeAiOutputLanguage(outputLanguage);
    const langLabel = getAiOutputLanguageLabel(langCode);

    const languageLine =
        langCode === 'ar'
            ? 'Language: Arabic (warm Modern Standard / spoken-standard fusion). Match recipientGender for correct Arabic pronouns and agreement.'
            : `Language: ${langLabel}. Match recipientGender for correct pronouns when relevant.`;

    return [
        'Respond with one valid JSON object only: {"title":"...","description":"..."}. No markdown, no extra keys.',
        'You are an expert copywriter inside DineBuddies generating a personalized, modern, one-to-one dining invitation from one member to another — a friendly invite to share a meal together.',
        'The description must feel individually written, warm, and free of generic or automated phrasing.',
        '',
        'Use ONLY facts present in the user message context (sender, recipient, shared interests, shared food, date, time, venue). Never invent names, cuisines, venues, or traits.',
        '',
        'Tone: warm, friendly, easygoing, and respectful. Confident and genuine with ZERO pressure. Make the recipient feel comfortable and welcome to a relaxed meal together.',
        'This is a platonic, social dining invitation — NOT romantic, NOT a date. Never imply romance, flirtation, attraction, or a couple dynamic.',
        '',
        languageLine,
        '',
        'title: one short friendly headline for the card (few words, not the full message).',
        `description: the invitation message — 3 to 4 sentences, 50–80 words max in ${langLabel}.`,
        '  • Greeting: start naturally with the recipient first name only.',
        '  • Culinary/profile hook: weave shared food preferences or interests subtly — never "I saw on your profile that…".',
        '  • 1-on-1 framing: gently establish this is a personal invite for just the two of them to catch up over food; friendly and relaxed.',
        '  • Optionally reference date/time/venue from context when natural.',
        '',
        'Strict restrictions:',
        '  • NO romantic, flirtatious, or affectionate language of any kind; no appearance comments.',
        '  • NO love-bombing, intense emotion, or generic flattery.',
        '  • NO copy-paste vibe — message must not work unchanged for another recipient.',
        '  • NO pressure, manipulation, desperation, or entitlement.',
        '',
        'Both title and description are REQUIRED. Do not invent venue addresses.',
        structureBlock,
    ].join('\n');
}

/**
 * @param {import('../services/GeminiService.js').DatingInvitationContext | undefined} personal
 * @returns {string[]}
 */
export function buildPrivateInvitationContextLines(personal) {
    if (!personal) return [];

    /** @type {string[]} */
    const lines = ['--- Personal invite personalization context ---'];

    const push = (label, value) => {
        const s = value == null ? '' : String(value).trim();
        if (s) lines.push(`${label}: ${s}`);
    };

    push('senderFirstName', personal.senderFirstName);
    push('senderGender', personal.senderGender);
    push('senderAgeGroup', personal.senderAgeGroup);
    push('senderPersonalityVibe', personal.senderPersonalityVibe);
    push('recipientFirstName', personal.inviteeName);
    push('recipientGender', personal.inviteeGender);
    push('recipientAgeGroup', personal.inviteeAgeGroup);
    push('recipientPersonalityVibe', personal.inviteePersonalityVibe);
    push('ageGap', personal.ageGap);

    if (personal.sharedInterests?.length) {
        lines.push(`sharedInterests: ${personal.sharedInterests.join(', ')}`);
    }
    if (personal.sharedFoodPreferences?.length) {
        lines.push(`sharedFoodPreferences: ${personal.sharedFoodPreferences.join(', ')}`);
    } else if (personal.inviteeFavoriteFoods?.length) {
        lines.push(`recipientFavoriteFoods: ${personal.inviteeFavoriteFoods.join(', ')}`);
    }
    if (personal.senderFavoriteFoods?.length) {
        lines.push(`senderFavoriteFoods: ${personal.senderFavoriteFoods.join(', ')}`);
    }

    push('date', personal.date);
    push('time', personal.time);

    const vd = personal.venueDetails;
    if (vd) {
        push('venueName', vd.name);
        push('venueAddress', vd.address);
        push('venueCity', vd.city);
        push('venueCountry', vd.country);
    } else {
        push('venueName', personal.venueName);
    }

    if (personal.sharedCommunities?.length) {
        lines.push('sharedCommunities:');
        for (const c of personal.sharedCommunities) {
            lines.push(`- ${c.name} (${c.type})`);
        }
    }

    lines.push('--- End context ---');
    return lines;
}
