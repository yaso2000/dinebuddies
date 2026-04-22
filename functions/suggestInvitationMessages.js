const functions = require('firebase-functions');

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';

function truncate(s, max) {
    if (s == null || s === '') return '';
    const t = String(s).trim();
    return t.length <= max ? t : t.slice(0, max);
}

/**
 * If the model returns fewer than 10 lines, pad with distinct variants (same language).
 */
function padSuggestionsToTen(suggestions, payload, isAr) {
    const out = [...suggestions].map((s) => truncate(s, 120)).filter(Boolean);
    const seen = new Set(out);
    const host = truncate(payload.hostName, 80) || (isAr ? 'المضيف' : 'Host');
    const place = truncate(payload.venueName, 100) || (isAr ? 'لقاء' : 'meetup');
    let n = 0;
    while (out.length < 10) {
        n += 1;
        const extra = isAr ? `${host} — ${place} (${n})` : `${host} · ${place} (${n})`;
        let line = truncate(extra, 120);
        if (seen.has(line)) line = truncate(`${extra} ${out.length}`, 120);
        if (!seen.has(line)) {
            seen.add(line);
            out.push(line);
        } else {
            out.push(truncate(`${line} ${Date.now() % 10000}`, 120));
        }
    }
    return out.slice(0, 10);
}

/**
 * @param {object} data — client payload (see buildInvitationAiPayload)
 * @param {import('firebase-functions').https.CallableContext} context
 */
async function runSuggestInvitationMessages(data, context) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || !String(apiKey).trim()) {
        throw new functions.https.HttpsError(
            'failed-precondition',
            'OPENAI_API_KEY is not configured for message suggestions.'
        );
    }

    const payload = data && typeof data === 'object' ? data : {};
    const language = typeof payload.language === 'string' ? payload.language.slice(0, 12) : 'en';
    const isAr = language.startsWith('ar');

    const safe = {
        language,
        hostName: truncate(payload.hostName, 80),
        venueName: truncate(payload.venueName, 120),
        title: payload.title == null ? null : truncate(payload.title, 120),
        city: payload.city == null ? null : truncate(payload.city, 80),
        locationDetail: payload.locationDetail == null ? null : truncate(payload.locationDetail, 220),
        whenLine: payload.whenLine == null ? null : truncate(payload.whenLine, 80),
        venueType: payload.venueType == null ? null : truncate(payload.venueType, 80),
        genderSummary: payload.genderSummary == null ? null : truncate(payload.genderSummary, 120),
        ageSummary: payload.ageSummary == null ? null : truncate(payload.ageSummary, 80),
        guestsNeeded: (() => {
            if (payload.guestsNeeded == null || payload.guestsNeeded === '') return null;
            const n = Number(payload.guestsNeeded);
            return Number.isFinite(n) ? n : null;
        })(),
        paymentType: payload.paymentType == null ? null : truncate(payload.paymentType, 60)
    };

    if (!safe.hostName && !safe.venueName) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing host or venue context.');
    }

    const model = process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini';
    const userJson = JSON.stringify(safe);

    const systemPrompt = isAr
        ? 'أنت تكتب عناوين قصيرة لدعوات طعام/قهوة اجتماعية. أعد كائناً JSON فقط بالشكل: {"suggestions":["...","..."]} حيث suggestions مصفوفة طولها بالضبط 10 عناصر. كل عنصر سطر واحد فقط، بحد أقصى 100 حرفاً، لغة عربية واضحة وودّية، بدون إيموجي، بدون أسطر جديدة داخل النص، بدون علامات اقتباس مزدوجة داخل النصوص.'
        : 'You write short one-line headlines for social dining or coffee meetups. Reply with JSON only: {"suggestions":["..."]} where suggestions is an array of exactly 10 strings. Each string is a single line, max 100 characters, friendly tone, no emojis, no newlines inside a string, no double quotes inside strings.';

    const userContent = `Use these invitation fields (null means optional / omit from headline):\n${userJson}\n\nReturn exactly 10 distinct headline options in the requested JSON format.`;

    const res = await fetch(OPENAI_CHAT_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model,
            temperature: 0.88,
            max_tokens: 900,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userContent }
            ]
        })
    });

    if (!res.ok) {
        const errText = await res.text();
        functions.logger.error('suggestInvitationMessages OpenAI HTTP error', {
            status: res.status,
            body: errText.slice(0, 800)
        });
        throw new functions.https.HttpsError('internal', 'Could not generate suggestions.');
    }

    const json = await res.json();
    const content = json.choices?.[0]?.message?.content;
    if (!content || typeof content !== 'string') {
        throw new functions.https.HttpsError('internal', 'Empty AI response.');
    }

    let parsed;
    try {
        parsed = JSON.parse(content);
    } catch (e) {
        functions.logger.error('suggestInvitationMessages JSON parse', { content: content.slice(0, 400) });
        throw new functions.https.HttpsError('internal', 'Invalid AI response format.');
    }

    let suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions : null;
    if (!suggestions) {
        throw new functions.https.HttpsError('internal', 'Invalid suggestions shape.');
    }

    suggestions = suggestions
        .map((s) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : ''))
        .filter(Boolean)
        .map((s) => truncate(s, 120));

    if (suggestions.length < 3) {
        throw new functions.https.HttpsError('internal', 'Too few suggestions from AI.');
    }

    suggestions = padSuggestionsToTen(suggestions, safe, isAr);

    return { suggestions };
}

module.exports = { runSuggestInvitationMessages };
