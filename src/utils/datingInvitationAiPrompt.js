import { buildCardStructurePromptBlock, normalizeCardStructure } from './cardStructure.js';
import { normalizeAppLanguage } from './appLanguages.js';

const DATING_GREETING_HINT = {
    en: 'Greeting: start naturally with recipient first name only (e.g. "Hi [Name]," or "Hello [Name],").',
    ar: 'Greeting: start naturally with recipient first name only (e.g. "مرحباً [الاسم]،" or "أهلاً [الاسم]،"). Match inviteeGender for correct Arabic pronouns and agreement.',
    fr: 'Greeting: start naturally with recipient first name only (e.g. "Bonjour [Name],").',
    es: 'Greeting: start naturally with recipient first name only (e.g. "Hola [Name],").',
    ur: 'Greeting: start naturally with recipient first name only (e.g. "السلام [نام]،"). Match inviteeGender for correct Urdu pronouns when possible.',
    hi: 'Greeting: start naturally with recipient first name only (e.g. "नमस्ते [Name],").',
};

const DATING_LENGTH_HINT = {
    en: 'description: the invitation message — 3 to 4 sentences, 50–80 English words max.',
    ar: 'description: the invitation message — 3 to 4 sentences, 50–80 Arabic words max.',
    fr: 'description: the invitation message — 3 to 4 sentences, 50–80 French words max.',
    es: 'description: the invitation message — 3 to 4 sentences, 50–80 Spanish words max.',
    ur: 'description: the invitation message — 3 to 4 sentences, 50–80 Urdu words max.',
    hi: 'description: the invitation message — 3 to 4 sentences, 50–80 Hindi words max.',
};

const DATING_LANGUAGE_LINE = {
    en: 'Language: English. Warm, confident, emotionally mature.',
    ar: 'Language: Arabic (warm Modern Standard / spoken-standard fusion). Match inviteeGender for correct Arabic pronouns and agreement.',
    fr: 'Language: French. Warm, confident, emotionally mature.',
    es: 'Language: Spanish. Warm, confident, emotionally mature.',
    ur: 'Language: Urdu. Warm, confident, emotionally mature.',
    hi: 'Language: Hindi. Warm, confident, emotionally mature.',
};

/**
 * System instruction for 1-on-1 romantic dating invitation copy (subType: date, accountType: user).
 * Output remains JSON { title, description } for the app pipeline.
 * @param {string} [cardStructure]
 * @param {string} [outputLanguage]
 */
export function buildDatingInvitationSystemInstruction(cardStructure = 'modern_minimal', outputLanguage = 'en') {
    const code = normalizeAppLanguage(outputLanguage);
    const structureBlock = buildCardStructurePromptBlock(normalizeCardStructure(cardStructure));
    const languageLine = DATING_LANGUAGE_LINE[code] || DATING_LANGUAGE_LINE.en;
    const greetingHint = DATING_GREETING_HINT[code] || DATING_GREETING_HINT.en;
    const lengthHint = DATING_LENGTH_HINT[code] || DATING_LENGTH_HINT.en;

    return [
        'Respond with one valid JSON object only: {"title":"...","description":"..."}. No markdown, no extra keys.',
        'You are an expert copywriter inside DineBuddies generating a personalized, modern, one-to-one romantic dining invitation from one user to another.',
        'The description must feel individually written, emotionally intelligent, and free of generic or automated phrasing.',
        '',
        'Use ONLY facts present in the user message context (sender, recipient, shared interests, shared food, date, time, venue). Never invent names, cuisines, venues, or traits.',
        '',
        'Tone: calm, emotionally mature, slightly affectionate, socially attractive. Respectful, warm, naturally romantic.',
        'Confident and genuine with ZERO pressure or entitlement. Create emotional safety and gentle intrigue for a first date.',
        'Smoothly pivot from the platform social/dining vibe into a private, comfortable 1-on-1 date.',
        '',
        languageLine,
        '',
        'title: one short romantic headline for the card (few words, not the full message).',
        lengthHint,
        `  • ${greetingHint}`,
        '  • Culinary/profile hook: weave shared food preferences or profile cues subtly — never "I saw on your profile that…".',
        '  • 1-on-1 pivot: gently establish this is a private invitation for just the two of them; intimate but relaxed.',
        '  • Optionally reference date/time/venue from context when natural.',
        '',
        'Strict restrictions:',
        '  • NO collective language (everyone, people, group, gathering, crowd).',
        '  • NO love-bombing, intense romance, generic flattery, or appearance comments.',
        '  • NO copy-paste vibe — message must not work unchanged for another recipient.',
        '  • NO pressure, manipulation, desperation, or entitlement.',
        '',
        'Both title and description are REQUIRED. Do not invent venue addresses.',
        structureBlock,
    ].join('\n');
}

/**
 * @param {import('../services/GeminiService.js').DatingInvitationContext | undefined} dating
 * @returns {string[]}
 */
export function buildDatingInvitationContextLines(dating) {
    if (!dating) return [];

    /** @type {string[]} */
    const lines = ['--- Dating personalization context ---'];

    const push = (label, value) => {
        const s = value == null ? '' : String(value).trim();
        if (s) lines.push(`${label}: ${s}`);
    };

    push('senderFirstName', dating.senderFirstName);
    push('senderGender', dating.senderGender);
    push('senderAgeGroup', dating.senderAgeGroup);
    push('senderPersonalityVibe', dating.senderPersonalityVibe);
    push('recipientFirstName', dating.inviteeName);
    push('recipientGender', dating.inviteeGender);
    push('recipientAgeGroup', dating.inviteeAgeGroup);
    push('recipientPersonalityVibe', dating.inviteePersonalityVibe);
    push('ageGap', dating.ageGap);

    if (dating.sharedInterests?.length) {
        lines.push(`sharedInterests: ${dating.sharedInterests.join(', ')}`);
    }
    if (dating.sharedFoodPreferences?.length) {
        lines.push(`sharedFoodPreferences: ${dating.sharedFoodPreferences.join(', ')}`);
    } else if (dating.inviteeFavoriteFoods?.length) {
        lines.push(`recipientFavoriteFoods: ${dating.inviteeFavoriteFoods.join(', ')}`);
    }
    if (dating.senderFavoriteFoods?.length) {
        lines.push(`senderFavoriteFoods: ${dating.senderFavoriteFoods.join(', ')}`);
    }

    push('date', dating.date);
    push('time', dating.time);

    const vd = dating.venueDetails;
    if (vd) {
        push('venueName', vd.name);
        push('venueAddress', vd.address);
        push('venueCity', vd.city);
        push('venueCountry', vd.country);
    } else {
        push('venueName', dating.venueName);
    }

    if (dating.sharedCommunities?.length) {
        lines.push('sharedCommunities:');
        for (const c of dating.sharedCommunities) {
            lines.push(`- ${c.name} (${c.type})`);
        }
    }

    lines.push('--- End context ---');
    return lines;
}
