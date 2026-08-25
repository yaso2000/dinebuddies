const functions = require('firebase-functions');
const { GoogleAuth } = require('google-auth-library');

/**
 * AI customer-service agent for DineBuddies consumers.
 *
 * `askSupportAgent`  — answers a user's question in their own language, grounded
 *                      in the app knowledge base below. Free for the consumer
 *                      (rate-limited only). Never invents pricing or policy.
 * `escalateSupport`  — opens a human support ticket (transcript attached) and
 *                      notifies the user it was received.
 * Admin side lives in adminDashboard.js (list / reply / resolve tickets).
 */
const MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash';
const LOCATION = process.env.GEMINI_VERTEX_LOCATION?.trim() || 'us-central1';

// Curated, authoritative knowledge. The model must answer ONLY from this plus
// obvious general app-usage help; if it doesn't know, it says so and offers a
// human. Keep this the single source of truth for support answers.
const KNOWLEDGE = `
DineBuddies — what it is:
A social app for food lovers that blends three things: (1) discovering restaurants,
(2) meeting new people through food invitations (dining together / dating-style
connections), and (3) real communities built around the table.

Invitations & bill splitting:
- Tap the (+) button, pick a restaurant, set date & time.
- Bill options: "On the host", "Split equally", or "Everyone pays for themselves".
- Invitations can be public (open to the community) or private (specific people).

Feed, posts, stories, comments:
- Users share posts (text/photos) and stories to the community feed.
- Anyone can like and comment on posts; comment on comments (threaded replies).
- A shared post opens on its own page and the back arrow returns to the feed.

Connect (meeting people):
- Users send/accept connection requests. When two people connect, a private chat opens.
- Personal chat is strictly user-to-user. Businesses never appear in personal chat.

Compatibility Journey (in-chat game):
- A two-player game inside a 1:1 chat: staged levels of increasing depth with
  this-or-that questions answered privately, then revealed side by side with a
  per-level compatibility %. Reach the top level for a "Deep Match" and an
  invite-to-meet. Either player can start it; the other gets a notification.

Business communities:
- Joining a business community is ALWAYS FREE for the user — it's like following.
- Favoriting a business and joining its community are the same thing (linked).
- Businesses may open a "Stage" (live room); joining/entering is free for users.
- Business↔user messages go through the Business Inbox (offers, announcements,
  support), never through personal chat.

Dine Credits:
- Credits power certain premium/business actions. Core social use (posting,
  connecting, joining communities, playing the game, commenting) is free for users.
- Users never pay to join a community or to be contacted by support.

Account & safety:
- Profile, email verification, language, and account deletion are in Settings.
- Users can report content (users, posts, stories, comments, messages, images)
  and block people. Reports are reviewed by the safety team.
- The app supports 10 languages and is right-to-left for Arabic.

Support boundaries:
- Do NOT promise refunds, specific prices, credit amounts, or policy exceptions.
- For anything account-specific (a charge, a locked account, lost credits, a bug
  you can't resolve, or a safety emergency) recommend contacting a human agent.
`;

function registerSupportAgent(exports, { db, admin, enforceCallableRateLimit }) {
    const asTrimmed = (v) => (typeof v === 'string' ? v.trim() : '');

    function resolveProjectId() {
        return (
            process.env.GCLOUD_PROJECT?.trim() ||
            process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
            (() => { try { return JSON.parse(process.env.FIREBASE_CONFIG || '{}').projectId; } catch { return ''; } })() ||
            'dinebuddies'
        );
    }

    async function callGeminiText(contents, systemInstruction) {
        const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
        const client = await auth.getClient();
        const url = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${resolveProjectId()}/locations/${LOCATION}/publishers/google/models/${MODEL}:generateContent`;
        const res = await client.request({
            url, method: 'POST',
            data: {
                systemInstruction: { role: 'system', parts: [{ text: systemInstruction }] },
                contents,
                generationConfig: { temperature: 0.4, maxOutputTokens: 700 },
            },
        });
        return String(res?.data?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
    }

    // ---- Consumer: ask the AI agent ------------------------------------------
    exports.askSupportAgent = functions.https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in to use support.');
        const uid = context.auth.uid;
        await enforceCallableRateLimit(uid, 'support_ask', {
            cooldownMs: 1200, perMinute: 12, perHour: 120, perDay: 400,
        });

        const message = asTrimmed(data?.message).slice(0, 2000);
        if (!message) throw new functions.https.HttpsError('invalid-argument', 'message is required.');
        const locale = asTrimmed(data?.locale).slice(0, 10) || 'en';

        // Rebuild the short conversation for context (last 10 turns, trimmed).
        const history = Array.isArray(data?.history) ? data.history.slice(-10) : [];
        const contents = [];
        for (const turn of history) {
            const role = turn?.role === 'assistant' ? 'model' : 'user';
            const text = asTrimmed(turn?.text).slice(0, 1500);
            if (text) contents.push({ role, parts: [{ text }] });
        }
        contents.push({ role: 'user', parts: [{ text: message }] });

        const systemInstruction = [
            'You are DineBuddies Support, a warm, concise customer-service agent.',
            `Always reply in the user's language (locale: ${locale}); if unsure, mirror the language of their message.`,
            'Answer ONLY from the knowledge base and general app-usage common sense.',
            'If the answer is not covered, say briefly that you are not sure and suggest tapping "Talk to a human".',
            'Never invent prices, credit amounts, refund promises, or policies.',
            'Keep answers short (2-5 sentences), friendly, and practical. Use simple steps when helpful.',
            '',
            'KNOWLEDGE BASE:',
            KNOWLEDGE,
        ].join('\n');

        let reply;
        try {
            reply = await callGeminiText(contents, systemInstruction);
        } catch (err) {
            console.error('[supportAgent] gemini failed', err?.message || err);
            throw new functions.https.HttpsError('internal', 'The assistant is unavailable right now. Please try again or talk to a human.');
        }
        if (!reply) throw new functions.https.HttpsError('internal', 'Empty response. Please try again.');
        return { reply };
    });

    // ---- Consumer: escalate to a human ---------------------------------------
    exports.escalateSupport = functions.https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
        const uid = context.auth.uid;
        await enforceCallableRateLimit(uid, 'support_escalate', {
            cooldownMs: 5000, perHour: 10, perDay: 20,
        });

        const message = asTrimmed(data?.message).slice(0, 2000);
        if (!message) throw new functions.https.HttpsError('invalid-argument', 'Describe your issue first.');
        const locale = asTrimmed(data?.locale).slice(0, 10) || 'en';

        const rawTranscript = Array.isArray(data?.transcript) ? data.transcript.slice(-20) : [];
        const transcript = rawTranscript.map((t) => ({
            role: t?.role === 'assistant' ? 'assistant' : 'user',
            text: asTrimmed(t?.text).slice(0, 1500),
        })).filter((t) => t.text);

        const meSnap = await db.collection('users').doc(uid).get();
        const me = meSnap.data() || {};
        const now = admin.firestore.FieldValue.serverTimestamp();

        const ref = await db.collection('support_tickets').add({
            userId: uid,
            userName: me.displayName || me.display_name || '',
            userEmail: (context.auth.token?.email || me.email || '').toLowerCase(),
            userAvatar: me.photoURL || me.avatarUrl || '',
            locale,
            message,
            transcript,
            status: 'open',        // open -> answered -> resolved
            source: 'support_agent',
            createdAt: now,
            updatedAt: now,
            unreadForAdmin: true,
        });

        return { ok: true, ticketId: ref.id };
    });
}

module.exports = { registerSupportAgent };
