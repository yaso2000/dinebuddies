const functions = require('firebase-functions');
const { GoogleAuth } = require('google-auth-library');

/**
 * AI report triage — classifies every incoming report (user / post / story /
 * comment / message / image) so admins get a pre-sorted, summarized queue with a
 * recommended action and a suggested reply to the reporter.
 *
 * Human-in-the-loop by design: this only WRITES analysis onto the report; bans /
 * deletes stay manual in the admin panel. Suspected CSAM is never "handled" by
 * the general model — it is flagged `escalated_csam` for the specialized pipeline
 * and authorities, with no automated action.
 */
const MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash';
const LOCATION = process.env.GEMINI_VERTEX_LOCATION?.trim() || 'us-central1';

const CATEGORIES = [
    'spam', 'harassment_threat', 'hate_racism', 'nudity_sexual',
    'violence', 'misinformation', 'self_harm', 'csam_suspected', 'other',
];
const SEVERITIES = ['low', 'medium', 'high', 'critical'];
const ACTIONS = ['dismiss', 'warn_user', 'hide_content', 'ban_user', 'escalate'];

function registerReportTriage(exports, { db, admin }) {
    const asTrimmed = (v) => (typeof v === 'string' ? v.trim() : '');

    function resolveProjectId() {
        return (
            process.env.GCLOUD_PROJECT?.trim() ||
            process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
            (() => { try { return JSON.parse(process.env.FIREBASE_CONFIG || '{}').projectId; } catch { return ''; } })() ||
            'dinebuddies'
        );
    }

    async function callGeminiJson(parts) {
        const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
        const client = await auth.getClient();
        const url = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${resolveProjectId()}/locations/${LOCATION}/publishers/google/models/${MODEL}:generateContent`;
        const res = await client.request({
            url, method: 'POST',
            data: { contents: [{ role: 'user', parts }], generationConfig: { responseMimeType: 'application/json', temperature: 0.2 } },
        });
        const raw = res?.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const s = String(raw).trim();
        try { return JSON.parse(s); } catch {
            const a = s.indexOf('{'); const b = s.lastIndexOf('}');
            if (a < 0 || b <= a) throw new Error('Gemini triage response not JSON');
            return JSON.parse(s.slice(a, b + 1));
        }
    }

    /** Resolve the reported content into { text, imageUrl } (best effort by type). */
    async function resolveReportedContent(report) {
        const type = String(report.type || '').toLowerCase();
        const targetId = asTrimmed(report.targetId);
        const out = { text: '', imageUrl: null };
        const firstImage = (d) => d?.imageUrl || d?.image || d?.mediaUrl || d?.photoURL || d?.photo_url || d?.avatarUrl || (Array.isArray(d?.images) ? d.images[0] : null) || (d?.media && (d.media.url || d.media.imageUrl)) || null;
        try {
            if (type === 'user' && targetId) {
                const s = await db.collection('users').doc(targetId).get();
                const d = s.data() || {};
                out.text = [d.displayName || d.display_name, d.bio, d.about].filter(Boolean).join(' — ');
                out.imageUrl = firstImage(d);
            } else if (type === 'post' && targetId) {
                let s = await db.collection('communityPosts').doc(targetId).get();
                if (!s.exists) s = await db.collection('featured_posts').doc(targetId).get();
                const d = s.data() || {};
                out.text = d.content || d.text || d.caption || (d.title && (d.title.text || d.title)) || '';
                out.imageUrl = d.mediaType === 'image' ? firstImage(d) : firstImage(d);
            } else if (type === 'story' && targetId) {
                const s = await db.collection('stories').doc(targetId).get();
                const d = s.data() || {};
                out.text = d.caption || d.text || '';
                out.imageUrl = firstImage(d);
            } else if (type === 'comment' && targetId) {
                const s = await db.collection('comments').doc(targetId).get();
                out.text = (s.data() || {}).text || '';
            } else if (type === 'message' && targetId) {
                const convId = asTrimmed(report.conversationId) || asTrimmed(report.chatId);
                if (convId) {
                    const s = await db.collection('conversations').doc(convId).collection('messages').doc(targetId).get();
                    const d = s.data() || {};
                    out.text = d.text || '';
                    out.imageUrl = d.imageUrl || null;
                }
            } else if (type === 'image') {
                out.imageUrl = asTrimmed(report.imageUrl) || targetId || null;
            }
        } catch (err) {
            console.warn('[reportTriage] resolve failed', err?.message || err);
        }
        // Report may also carry a snapshot of the content.
        if (!out.text && report.contentText) out.text = String(report.contentText);
        if (!out.imageUrl && report.imageUrl) out.imageUrl = String(report.imageUrl);
        return out;
    }

    async function fetchImageInlinePart(imageUrl) {
        try {
            if (!/^https?:\/\//i.test(imageUrl)) return null;
            const resp = await fetch(imageUrl);
            if (!resp.ok) return null;
            const type = resp.headers.get('content-type') || 'image/jpeg';
            if (!/^image\//.test(type)) return null;
            const buf = Buffer.from(await resp.arrayBuffer());
            if (buf.length > 4 * 1024 * 1024) return null; // cap 4MB
            return { inlineData: { mimeType: type.split(';')[0], data: buf.toString('base64') } };
        } catch (err) {
            console.warn('[reportTriage] image fetch failed', err?.message || err);
            return null;
        }
    }

    async function triage(reportRef, report) {
        const content = await resolveReportedContent(report);
        const imagePart = content.imageUrl ? await fetchImageInlinePart(content.imageUrl) : null;

        const prompt = [
            'You are a trust & safety moderator for a social + dating app. Analyze this user report of content and decide.',
            `Report type: ${report.type || 'unknown'}. Reporter reason: ${asTrimmed(report.reason) || '(none)'}. Details: ${asTrimmed(report.details).slice(0, 500) || '(none)'}.`,
            `Reported content text: """${String(content.text || '(no text)').slice(0, 1500)}"""`,
            imagePart ? 'An image of the reported content is attached — assess it too.' : 'No image available.',
            '',
            'Respond with JSON only, no prose:',
            `{"category": one of ${JSON.stringify(CATEGORIES)},`,
            `"severity": one of ${JSON.stringify(SEVERITIES)},`,
            `"recommendation": one of ${JSON.stringify(ACTIONS)},`,
            '"summary": one concise sentence for the moderator (same language as the content when possible),',
            '"suggestedResponse": a short polite reply to the reporter (same language as the reason/details)}',
            'If the content may involve a minor in a sexual/abusive context, set category "csam_suspected", severity "critical", recommendation "escalate".',
        ].join('\n');

        const parts = [{ text: prompt }];
        if (imagePart) parts.push(imagePart);

        let ai;
        try {
            ai = await callGeminiJson(parts);
        } catch (err) {
            console.error('[reportTriage] gemini failed', err?.message || err);
            await reportRef.update({ aiProcessed: false, aiError: String(err?.message || err).slice(0, 200) }).catch(() => {});
            return;
        }

        const category = CATEGORIES.includes(String(ai?.category)) ? ai.category : 'other';
        const severity = SEVERITIES.includes(String(ai?.severity)) ? ai.severity : 'low';
        let recommendation = ACTIONS.includes(String(ai?.recommendation)) ? ai.recommendation : 'dismiss';
        const summary = asTrimmed(ai?.summary).slice(0, 400) || null;
        const suggestedResponse = asTrimmed(ai?.suggestedResponse).slice(0, 800) || null;

        const now = admin.firestore.FieldValue.serverTimestamp();
        const updates = {
            aiProcessed: true,
            aiAt: now,
            aiCategory: category,
            aiSeverity: severity,
            aiRecommendation: recommendation,
            aiSummary: summary,
            aiSuggestedResponse: suggestedResponse,
            aiHasImage: !!imagePart,
        };

        // Suspected CSAM: never auto-act; flag for the specialized pipeline + authorities.
        if (category === 'csam_suspected') {
            updates.aiRecommendation = 'escalate';
            updates.status = 'escalated_csam';
            updates.escalated = true;
        }

        await reportRef.update(updates);
    }

    // Auto-triage every new report.
    exports.onReportCreated = functions.firestore
        .document('reports/{reportId}')
        .onCreate(async (snap) => {
            const report = snap.data() || {};
            if (report.aiProcessed === true) return null;
            try {
                await triage(snap.ref, report);
            } catch (err) {
                console.error('[reportTriage] onCreate', err?.message || err);
            }
            return null;
        });

    // Manual re-run (admin panel button).
    exports.triageReport = functions.https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in.');
        const uid = context.auth.uid;
        const meSnap = await db.collection('users').doc(uid).get();
        const role = String(meSnap.data()?.role || '').toLowerCase();
        const isAdmin = context.auth.token?.admin === true || context.auth.token?.role === 'admin' || role === 'admin';
        if (!isAdmin) throw new functions.https.HttpsError('permission-denied', 'Admins only.');

        const reportId = asTrimmed(data?.reportId);
        if (!reportId) throw new functions.https.HttpsError('invalid-argument', 'reportId is required.');
        const ref = db.collection('reports').doc(reportId);
        const s = await ref.get();
        if (!s.exists) throw new functions.https.HttpsError('not-found', 'Report not found.');
        await triage(ref, s.data() || {});
        return { ok: true };
    });
}

module.exports = { registerReportTriage };
