const functions = require('firebase-functions');
const aiClaude = require('./aiClaude');
const {
    resolveCallerRegionScope,
    targetUserInRegion,
} = require('./_adminRegion');

/**
 * AI report triage — Claude.
 *
 * Classifies every incoming report (user / post / story / comment / message /
 * image) so admins get a pre-sorted, summarized queue with a recommended action
 * and a suggested reply to the reporter. Runs on the shared Claude engine +
 * constitution (see aiClaude.js) so reports, support, and complaints all judge
 * by the same rules.
 *
 * Human-in-the-loop by design: this only WRITES analysis onto the report; bans /
 * deletes stay manual. Suspected CSAM is flagged `escalate` for the specialized
 * pipeline + authorities, never auto-actioned. Regional managers may triage /
 * respond only within their own region.
 */
const CATEGORIES = [
    'spam', 'harassment_threat', 'hate_racism', 'nudity_sexual',
    'violence', 'misinformation', 'self_harm', 'csam_suspected', 'other',
];
const SEVERITIES = ['low', 'medium', 'high', 'critical'];
const ACTIONS = ['dismiss', 'warn_user', 'hide_content', 'ban_user', 'escalate'];

function registerReportTriage(exports, { db, admin }) {
    const asTrimmed = (v) => (typeof v === 'string' ? v.trim() : '');

    /** Resolve the caller's admin identity + region scope, or throw. */
    async function resolveCaller(context) {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in.');
        const uid = context.auth.uid;
        const meSnap = await db.collection('users').doc(uid).get();
        const role = String(meSnap.data()?.role || '').toLowerCase();
        const isFullAdmin = context.auth.token?.admin === true || context.auth.token?.role === 'admin' || role === 'admin';
        const isRegionalManager = role === 'regional_manager';
        if (!isFullAdmin && !isRegionalManager) {
            throw new functions.https.HttpsError('permission-denied', 'Admins or regional managers only.');
        }
        const region = String(meSnap.data()?.region || '') || null;
        const scope = isRegionalManager ? resolveCallerRegionScope('regional_manager', region) : { scoped: false, countries: [] };
        return { uid, isRegionalManager, scope };
    }

    /** For a scoped manager, verify the report belongs to their region (by reporter). */
    async function assertReportInScope(report, scope) {
        if (!scope?.scoped) return;
        const reporterId = asTrimmed(report.reporterId);
        const ok = await targetUserInRegion(db, reporterId, scope);
        if (!ok) throw new functions.https.HttpsError('permission-denied', 'This report is outside your region.');
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
                out.imageUrl = firstImage(d);
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
        if (!out.text && report.contentText) out.text = String(report.contentText);
        if (!out.imageUrl && report.imageUrl) out.imageUrl = String(report.imageUrl);
        return out;
    }

    /** Fetch a reported image as base64 for Claude vision (capped at 4MB). */
    async function fetchImagePart(imageUrl) {
        try {
            if (!/^https?:\/\//i.test(imageUrl)) return null;
            const resp = await fetch(imageUrl);
            if (!resp.ok) return null;
            const type = resp.headers.get('content-type') || 'image/jpeg';
            if (!/^image\//.test(type)) return null;
            const buf = Buffer.from(await resp.arrayBuffer());
            if (buf.length > 4 * 1024 * 1024) return null; // cap 4MB
            return { mediaType: type.split(';')[0], data: buf.toString('base64') };
        } catch (err) {
            console.warn('[reportTriage] image fetch failed', err?.message || err);
            return null;
        }
    }

    async function triage(reportRef, report) {
        const content = await resolveReportedContent(report);
        const image = content.imageUrl ? await fetchImagePart(content.imageUrl) : null;

        let ai;
        try {
            ai = await aiClaude.analyzeReport({
                reportType: report.type,
                reason: asTrimmed(report.reason),
                details: asTrimmed(report.details),
                contentText: content.text,
                image,
            });
        } catch (err) {
            console.error('[reportTriage] claude failed', err?.message || err);
            await reportRef.update({ aiProcessed: false, aiError: String(err?.message || err).slice(0, 200) }).catch(() => {});
            return;
        }

        const category = CATEGORIES.includes(String(ai?.category)) ? ai.category : 'other';
        const severity = SEVERITIES.includes(String(ai?.severity)) ? ai.severity : 'low';
        const recommendation = ACTIONS.includes(String(ai?.recommendation)) ? ai.recommendation : 'dismiss';
        const summary = asTrimmed(ai?.summary).slice(0, 400) || null;
        const suggestedResponse = asTrimmed(ai?.suggestedResponse).slice(0, 800) || null;
        const reasoning = asTrimmed(ai?.reasoning).slice(0, 500) || null;

        const now = admin.firestore.FieldValue.serverTimestamp();
        const updates = {
            aiProcessed: true,
            aiAt: now,
            aiEngine: 'claude',
            aiModel: ai?._model || aiClaude.MODEL,
            aiCategory: category,
            aiSeverity: severity,
            aiRecommendation: recommendation,
            aiSummary: summary,
            aiReasoning: reasoning,
            aiSuggestedResponse: suggestedResponse,
            aiHasImage: !!image,
            aiContentText: (content.text || '').slice(0, 800) || null,
            aiContentImage: content.imageUrl || null,
        };

        // Suspected CSAM: never auto-act; flag for the specialized pipeline + authorities.
        if (category === 'csam_suspected') {
            updates.aiRecommendation = 'escalate';
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
            if (!aiClaude.hasApiKey()) {
                console.warn('[reportTriage] skipped: ANTHROPIC_API_KEY not set');
                return null;
            }
            try {
                await triage(snap.ref, report);
            } catch (err) {
                console.error('[reportTriage] onCreate', err?.message || err);
            }
            return null;
        });

    // Manual re-run (admin panel button). Managers scoped to their region.
    exports.triageReport = functions.https.onCall(async (data, context) => {
        const { scope } = await resolveCaller(context);
        const reportId = asTrimmed(data?.reportId);
        if (!reportId) throw new functions.https.HttpsError('invalid-argument', 'reportId is required.');
        const ref = db.collection('reports').doc(reportId);
        const s = await ref.get();
        if (!s.exists) throw new functions.https.HttpsError('not-found', 'Report not found.');
        await assertReportInScope(s.data() || {}, scope);
        await triage(ref, s.data() || {});
        const fresh = await ref.get();
        return { ok: true, report: { id: ref.id, ...(fresh.data() || {}) } };
    });

    // Reply to the reporter (admin / manager) — notifies them and marks responded.
    exports.respondToReport = functions.https.onCall(async (data, context) => {
        const { uid, scope } = await resolveCaller(context);
        const reportId = asTrimmed(data?.reportId);
        const message = asTrimmed(data?.message);
        if (!reportId) throw new functions.https.HttpsError('invalid-argument', 'reportId is required.');
        if (!message) throw new functions.https.HttpsError('invalid-argument', 'message is required.');

        const ref = db.collection('reports').doc(reportId);
        const s = await ref.get();
        if (!s.exists) throw new functions.https.HttpsError('not-found', 'Report not found.');
        const report = s.data() || {};
        await assertReportInScope(report, scope);
        const reporterId = asTrimmed(report.reporterId);

        const now = admin.firestore.FieldValue.serverTimestamp();
        if (reporterId) {
            await db.collection('notifications').add({
                userId: reporterId,
                type: 'report_update',
                title: 'Update on your report',
                message: message.slice(0, 500),
                actionUrl: '/notifications',
                fromUserId: uid,
                senderId: uid,
                senderName: 'DineBuddies Safety',
                metadata: { source: 'report_response', reportId },
                createdAt: now,
                read: false,
            });
        }
        await ref.update({ adminResponse: message.slice(0, 2000), respondedAt: now, respondedBy: uid });
        return { ok: true };
    });
}

module.exports = { registerReportTriage };
