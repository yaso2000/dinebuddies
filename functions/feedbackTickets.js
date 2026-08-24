const functions = require('firebase-functions');
const { normalizeBusinessSubscriptionTier, spendCreditsInTransaction } = require('./creditsCore');
const { generateGeminiJson } = require('./demoUsersGemini');

// On-demand AI (Dine Credits). Real Gemini-2.5-flash cost is a fraction of a
// cent; these are retail prices (100 credits = $1).
const AI_TICKET_CREDITS = 3;
const AI_INSIGHTS_CREDITS = 15;

const FEEDBACK_CATEGORIES = [
    'service', 'food_quality', 'cleanliness', 'pricing', 'wait_time',
    'staff', 'ambiance', 'delivery', 'booking', 'other',
];

/**
 * Business complaints & suggestions — ticket system (server side).
 *
 * Submission is server-only (this callable): registered users only, rate-limited,
 * and the target must be a real business. This closes the old `create: if true`
 * spam hole and the unauthenticated `partner_notifications` write. The AI analysis
 * layer (on-demand, credit-charged) and two-way replies are added in later phases.
 *
 * @param {object} exports  Cloud Functions export bag (from index.js)
 * @param {object} deps
 * @param {FirebaseFirestore.Firestore} deps.db
 * @param {import('firebase-admin')} deps.admin
 * @param {(uid: string, bucket: string, limits?: object) => Promise<void>} deps.enforceCallableRateLimit
 */
function registerFeedbackTickets(exports, { db, admin, enforceCallableRateLimit }) {
    if (typeof enforceCallableRateLimit !== 'function') {
        throw new Error('registerFeedbackTickets: enforceCallableRateLimit is required');
    }

    const MAX_CONTENT = 2000;

    const asTrimmed = (v) => (typeof v === 'string' ? v.trim() : '');

    /** Confirm `businessId` is a real business listing (users / restaurants / projection). */
    async function resolveBusinessTarget(businessId) {
        const [userSnap, restaurantSnap, publicSnap] = await Promise.all([
            db.collection('users').doc(businessId).get(),
            db.collection('restaurants').doc(businessId).get(),
            db.collection('public_profiles').doc(businessId).get(),
        ]);

        const isBiz = (data, source) => {
            if (!data) return false;
            const role = String(data.role || data.accountType || data.accountRole || '').toLowerCase();
            if (role === 'business' || role === 'partner') return true;
            if (data.isBusiness === true) return true;
            if (String(data.profileType || '').toLowerCase() === 'business') return true;
            if (source === 'restaurants') return true;
            return false;
        };

        const u = userSnap.exists ? userSnap.data() || {} : null;
        const r = restaurantSnap.exists ? restaurantSnap.data() || {} : null;
        const p = publicSnap.exists ? publicSnap.data() || {} : null;

        if (isBiz(u, 'users') || isBiz(r, 'restaurants') || isBiz(p, 'public_profiles')) {
            const name =
                (p && (p.displayName || p.display_name)) ||
                (u && (u.displayName || u.display_name)) ||
                (r && (r.name || r.display_name)) ||
                '';
            const avatar =
                (p && (p.avatarUrl || p.photoURL || p.photo_url)) ||
                (u && (u.photoURL || u.photo_url || u.avatarUrl)) ||
                (r && (r.image || r.coverImage || (r.businessInfo && r.businessInfo.coverImage))) ||
                null;
            return { ok: true, name: String(name || ''), avatar: avatar || null };
        }
        return { ok: false };
    }

    exports.submitBusinessFeedback = functions.https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Please sign in to send feedback.');
        }
        const uid = context.auth.uid;

        const businessId = asTrimmed(data?.businessId);
        const type = asTrimmed(data?.type).toLowerCase();
        const content = asTrimmed(data?.content);
        const phoneNumber = asTrimmed(data?.phoneNumber);
        let rating = Number(data?.rating);
        if (!Number.isFinite(rating) || rating < 1 || rating > 5) rating = null;
        else rating = Math.round(rating);

        if (!businessId) {
            throw new functions.https.HttpsError('invalid-argument', 'businessId is required.');
        }
        if (businessId === uid) {
            throw new functions.https.HttpsError('failed-precondition', 'You cannot send feedback to your own business.');
        }
        if (type !== 'complaint' && type !== 'suggestion') {
            throw new functions.https.HttpsError('invalid-argument', 'type must be complaint or suggestion.');
        }
        if (!content) {
            throw new functions.https.HttpsError('invalid-argument', 'Message content is required.');
        }
        if (content.length > MAX_CONTENT) {
            throw new functions.https.HttpsError('invalid-argument', 'Message is too long.');
        }

        // Anti-spam: short cooldown + hourly / daily ceilings per user.
        await enforceCallableRateLimit(uid, 'business_feedback_submit', {
            cooldownMs: 30 * 1000,
            perHour: 10,
            perDay: 30,
        });

        const target = await resolveBusinessTarget(businessId);
        if (!target.ok) {
            throw new functions.https.HttpsError('not-found', 'Business not found.');
        }

        const senderSnap = await db.collection('users').doc(uid).get();
        const sender = senderSnap.exists ? senderSnap.data() || {} : {};
        const userName =
            asTrimmed(sender.displayName) ||
            asTrimmed(sender.display_name) ||
            asTrimmed(sender.firstName) ||
            'Member';
        const userAvatar = sender.photoURL || sender.photo_url || sender.avatarUrl || null;

        const now = admin.firestore.FieldValue.serverTimestamp();
        const ticketRef = db.collection('business_feedback').doc();

        const ticket = {
            kind: 'support',
            businessId,
            businessName: target.name || null,
            businessAvatar: target.avatar || null,
            userId: uid,
            userName,
            userAvatar,
            type,
            rating,
            content, // first message, kept on the ticket for list previews
            phoneNumber: phoneNumber || null,
            status: 'open', // open | in_progress | resolved | archived
            priority: 'normal',
            // AI enrichment (filled on-demand in a later phase)
            category: null,
            sentiment: null,
            sentimentScore: null,
            aiSummary: null,
            aiSuggestedReply: null,
            aiProcessed: false,
            unreadForBusiness: true,
            unreadForUser: false,
            messageCount: 1,
            lastMessageRole: 'user',
            lastMessageAt: now,
            createdAt: now,
            updatedAt: now,
            resolvedAt: null,
            // legacy compatibility with the current inbox until it is replaced
            isResolved: false,
        };

        const batch = db.batch();
        batch.set(ticketRef, ticket);
        const firstMessageRef = ticketRef.collection('messages').doc();
        batch.set(firstMessageRef, {
            senderId: uid,
            senderRole: 'user',
            text: content,
            createdAt: now,
            readAt: null,
        });
        // Fan out an FCM push + inbox mirror via the existing partner_notifications trigger.
        const notifRef = db.collection('partner_notifications').doc();
        batch.set(notifRef, {
            restaurantId: businessId,
            type: 'business_feedback',
            title: type === 'complaint' ? 'New complaint 😠' : 'New suggestion 💡',
            message: content.slice(0, 120),
            actionUrl: '/business-dashboard/inbox',
            read: false,
            createdAt: now,
            senderId: uid,
            fromUserName: userName,
            fromUserAvatar: userAvatar,
            metadata: { feedbackId: ticketRef.id },
        });

        await batch.commit();

        return { ok: true, ticketId: ticketRef.id };
    });

    // ── Two-way reply: business or the submitting user posts to the thread ────
    exports.replyToFeedback = functions.https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Please sign in.');
        }
        const uid = context.auth.uid;
        const ticketId = asTrimmed(data?.ticketId);
        const text = asTrimmed(data?.text);
        if (!ticketId) throw new functions.https.HttpsError('invalid-argument', 'ticketId is required.');
        if (!text) throw new functions.https.HttpsError('invalid-argument', 'Reply text is required.');
        if (text.length > MAX_CONTENT) throw new functions.https.HttpsError('invalid-argument', 'Reply is too long.');

        const ticketRef = db.collection('business_feedback').doc(ticketId);
        const snap = await ticketRef.get();
        if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Feedback not found.');
        const ticket = snap.data() || {};
        const isBusiness = uid === ticket.businessId;
        const isUser = uid === ticket.userId;
        if (!isBusiness && !isUser) {
            throw new functions.https.HttpsError('permission-denied', 'You cannot reply to this feedback.');
        }

        await enforceCallableRateLimit(uid, 'business_feedback_reply', {
            cooldownMs: 3 * 1000,
            perMinute: 20,
            perDay: 300,
        });

        const now = admin.firestore.FieldValue.serverTimestamp();
        const senderRole = isBusiness ? 'business' : 'user';

        // Resolve the business display name up front (needed for the user's notification).
        let businessName = 'Business';
        if (isBusiness) {
            const target = await resolveBusinessTarget(ticket.businessId);
            businessName = target.name || 'Business';
        }

        const batch = db.batch();
        const msgRef = ticketRef.collection('messages').doc();
        batch.set(msgRef, { senderId: uid, senderRole, text, createdAt: now, readAt: null });

        const updates = {
            lastMessageAt: now,
            lastMessageRole: senderRole,
            messageCount: admin.firestore.FieldValue.increment(1),
            updatedAt: now,
        };
        if (isBusiness) {
            updates.unreadForUser = true;
            updates.unreadForBusiness = false;
            if (ticket.status === 'open') updates.status = 'in_progress';
        } else {
            updates.unreadForBusiness = true;
            updates.unreadForUser = false;
        }
        batch.update(ticketRef, updates);

        if (isBusiness) {
            // Notify the user (in-app inbox + FCM via onNotificationCreated).
            const notifRef = db.collection('notifications').doc();
            batch.set(notifRef, {
                userId: ticket.userId,
                type: 'business_feedback_reply',
                title: businessName,
                message: text.slice(0, 120),
                actionUrl: `/business-thread/${ticketId}`,
                fromUserId: ticket.businessId,
                fromUserName: businessName,
                fromUserAvatar: null,
                senderId: ticket.businessId,
                senderName: businessName,
                metadata: { source: 'business_feedback', feedbackId: ticketId },
                createdAt: now,
                read: false,
            });
        } else {
            // Notify the business via the partner_notifications pipeline.
            const notifRef = db.collection('partner_notifications').doc();
            batch.set(notifRef, {
                restaurantId: ticket.businessId,
                type: 'business_feedback',
                title: 'New reply 💬',
                message: text.slice(0, 120),
                actionUrl: '/business-dashboard/inbox',
                read: false,
                createdAt: now,
                senderId: uid,
                fromUserName: ticket.userName || 'Member',
                fromUserAvatar: ticket.userAvatar || null,
                metadata: { feedbackId: ticketId },
            });
        }

        await batch.commit();
        return { ok: true };
    });

    // ── Business changes ticket status (open / in_progress / resolved / archived)
    exports.setFeedbackStatus = functions.https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Please sign in.');
        }
        const uid = context.auth.uid;
        const ticketId = asTrimmed(data?.ticketId);
        const status = asTrimmed(data?.status).toLowerCase();
        const ALLOWED = ['open', 'in_progress', 'resolved', 'archived'];
        if (!ticketId) throw new functions.https.HttpsError('invalid-argument', 'ticketId is required.');
        if (!ALLOWED.includes(status)) throw new functions.https.HttpsError('invalid-argument', 'Invalid status.');

        const ticketRef = db.collection('business_feedback').doc(ticketId);
        const snap = await ticketRef.get();
        if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Feedback not found.');
        const ticket = snap.data() || {};
        if (uid !== ticket.businessId) {
            throw new functions.https.HttpsError('permission-denied', 'Only the business can change status.');
        }

        const now = admin.firestore.FieldValue.serverTimestamp();
        const updates = {
            status,
            updatedAt: now,
            isResolved: status === 'resolved' || status === 'archived',
            resolvedAt: status === 'resolved' ? now : (status === 'archived' ? ticket.resolvedAt || now : null),
        };

        const batch = db.batch();
        batch.update(ticketRef, updates);

        if (status === 'resolved') {
            // Let the user know their ticket was resolved.
            const target = await resolveBusinessTarget(ticket.businessId);
            const businessName = target.name || 'Business';
            const notifRef = db.collection('notifications').doc();
            batch.set(notifRef, {
                userId: ticket.userId,
                type: 'business_feedback_status',
                title: businessName,
                message: 'Your feedback was marked resolved.',
                actionUrl: `/business-thread/${ticketId}`,
                fromUserId: ticket.businessId,
                fromUserName: businessName,
                senderId: ticket.businessId,
                senderName: businessName,
                metadata: { source: 'business_feedback', feedbackId: ticketId, status },
                createdAt: now,
                read: false,
            });
        }

        await batch.commit();
        return { ok: true, status };
    });

    // ── Business broadcast: send an offer / announcement to community members ──
    // Lands in each member's Business Inbox as a thread (kind: offer|announcement),
    // separate from personal chat. Paid business plan only.
    exports.sendBusinessBroadcast = functions.https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Please sign in.');
        }
        const uid = context.auth.uid;
        const kind = asTrimmed(data?.kind).toLowerCase();
        const title = asTrimmed(data?.title);
        const body = asTrimmed(data?.body);
        const image = asTrimmed(data?.image) || null;
        const discountLabel = asTrimmed(data?.discountLabel) || null;
        const expiresAt = asTrimmed(data?.expiresAt) || null;

        if (kind !== 'offer' && kind !== 'announcement' && kind !== 'message') {
            throw new functions.https.HttpsError('invalid-argument', 'kind must be offer, announcement, or message.');
        }
        if (!title && !body) {
            throw new functions.https.HttpsError('invalid-argument', 'A title or message is required.');
        }
        const text = [title, body].filter(Boolean).join('\n');
        if (text.length > MAX_CONTENT) {
            throw new functions.https.HttpsError('invalid-argument', 'Message is too long.');
        }

        const senderSnap = await db.collection('users').doc(uid).get();
        const sender = senderSnap.exists ? senderSnap.data() || {} : {};
        const senderRole = String(sender.role || sender.accountType || sender.accountRole || '').toLowerCase();
        const senderIsBusiness = senderRole === 'business' || senderRole === 'partner' || sender.isBusiness === true;
        if (!senderIsBusiness) {
            throw new functions.https.HttpsError('permission-denied', 'Only a business can broadcast.');
        }
        if (normalizeBusinessSubscriptionTier(sender.subscriptionTier) !== 'paid') {
            throw new functions.https.HttpsError('failed-precondition', 'Broadcasting offers requires a Paid Business plan.');
        }

        await enforceCallableRateLimit(uid, 'business_broadcast', {
            cooldownMs: 10 * 1000,
            perHour: 20,
            perDay: 100,
        });

        const membersSnap = await db
            .collection('users')
            .where('joinedCommunities', 'array-contains', uid)
            .limit(500)
            .get();
        const recipients = membersSnap.docs
            .map((d) => ({ id: d.id, data: d.data() || {} }))
            .filter((r) => r.id !== uid);
        if (!recipients.length) return { ok: true, sent: 0 };

        const businessName =
            asTrimmed(sender.displayName) || asTrimmed(sender.display_name) || 'Business';
        const businessAvatar = sender.photoURL || sender.photo_url || sender.avatarUrl || null;
        const now = admin.firestore.FieldValue.serverTimestamp();

        let sent = 0;
        const CHUNK = 100; // 3 writes per recipient stays well under the 500-op batch cap
        for (let i = 0; i < recipients.length; i += CHUNK) {
            const slice = recipients.slice(i, i + CHUNK);
            const batch = db.batch();
            for (const r of slice) {
                const ticketRef = db.collection('business_feedback').doc();
                batch.set(ticketRef, {
                    kind, // offer | announcement
                    businessId: uid,
                    businessName,
                    businessAvatar,
                    userId: r.id,
                    userName: asTrimmed(r.data.displayName) || asTrimmed(r.data.display_name) || 'Member',
                    userAvatar: r.data.photoURL || r.data.photo_url || r.data.avatarUrl || null,
                    type: kind,
                    rating: null,
                    title: title || null,
                    image,
                    discountLabel,
                    expiresAt,
                    content: text,
                    phoneNumber: null,
                    status: 'open',
                    priority: 'normal',
                    category: null,
                    sentiment: null,
                    sentimentScore: null,
                    aiSummary: null,
                    aiSuggestedReply: null,
                    aiProcessed: false,
                    unreadForBusiness: false,
                    unreadForUser: true,
                    messageCount: 1,
                    lastMessageRole: 'business',
                    lastMessageAt: now,
                    createdAt: now,
                    updatedAt: now,
                    resolvedAt: null,
                    isResolved: false,
                });
                const msgRef = ticketRef.collection('messages').doc();
                batch.set(msgRef, { senderId: uid, senderRole: 'business', text, createdAt: now, readAt: null });
                const notifRef = db.collection('notifications').doc();
                batch.set(notifRef, {
                    userId: r.id,
                    type: `business_${kind}`,
                    title: businessName,
                    message: (title || body).slice(0, 120),
                    actionUrl: `/business-thread/${ticketRef.id}`,
                    fromUserId: uid,
                    fromUserName: businessName,
                    fromUserAvatar: businessAvatar,
                    senderId: uid,
                    senderName: businessName,
                    metadata: { source: 'business_broadcast', feedbackId: ticketRef.id, kind },
                    createdAt: now,
                    read: false,
                });
                sent += 1;
            }
            await batch.commit();
        }

        return { ok: true, sent };
    });

    // ── AI: analyze one ticket on demand (categorize + sentiment + summary +
    // suggested reply). Business-only, charged in Dine Credits. ───────────────
    exports.analyzeFeedbackTicket = functions.https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Please sign in.');
        const uid = context.auth.uid;
        const ticketId = asTrimmed(data?.ticketId);
        if (!ticketId) throw new functions.https.HttpsError('invalid-argument', 'ticketId is required.');

        const ticketRef = db.collection('business_feedback').doc(ticketId);
        const snap = await ticketRef.get();
        if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Feedback not found.');
        const ticket = snap.data() || {};
        if (uid !== ticket.businessId) {
            throw new functions.https.HttpsError('permission-denied', 'Only the business can analyze this feedback.');
        }

        await enforceCallableRateLimit(uid, 'feedback_ai_ticket', { cooldownMs: 2000, perMinute: 20, perDay: 500 });

        // Pre-check credits so we don't pay for a Gemini call the user can't afford.
        const userRef = db.collection('users').doc(uid);
        const userSnap0 = await userRef.get();
        const user0 = userSnap0.exists ? userSnap0.data() || {} : {};
        const available = Number(user0.paidCredits || 0) + Number(user0.savedCredits || 0);
        if (available < AI_TICKET_CREDITS) {
            throw new functions.https.HttpsError('failed-precondition', 'INSUFFICIENT_CREDITS');
        }

        const prompt = [
            'You are analyzing a customer message sent to a business.',
            `Message type: ${ticket.type === 'suggestion' ? 'suggestion' : 'complaint'}.`,
            `Message: """${String(ticket.content || '').slice(0, 1800)}"""`,
            'Respond with JSON only, no prose:',
            `{"category": one of ${JSON.stringify(FEEDBACK_CATEGORIES)},`,
            '"sentiment": "negative"|"neutral"|"positive",',
            '"sentimentScore": number between 0 and 1 (1 = very positive),',
            '"summary": one concise sentence (max 120 chars, SAME language as the message),',
            '"suggestedReply": a short polite reply the business could send (max 300 chars, SAME language as the message)}',
        ].join('\n');

        let ai;
        try {
            ai = await generateGeminiJson(prompt, { temperature: 0.3 });
        } catch (err) {
            console.error('analyzeFeedbackTicket gemini', err?.message || err);
            throw new functions.https.HttpsError('internal', 'AI analysis failed. Please try again.');
        }

        const category = FEEDBACK_CATEGORIES.includes(String(ai?.category)) ? ai.category : 'other';
        const sentiment = ['negative', 'neutral', 'positive'].includes(String(ai?.sentiment)) ? ai.sentiment : 'neutral';
        let sentimentScore = Number(ai?.sentimentScore);
        if (!Number.isFinite(sentimentScore)) sentimentScore = sentiment === 'positive' ? 0.8 : sentiment === 'negative' ? 0.2 : 0.5;
        sentimentScore = Math.max(0, Math.min(1, sentimentScore));
        const aiSummary = asTrimmed(ai?.summary).slice(0, 240) || null;
        const aiSuggestedReply = asTrimmed(ai?.suggestedReply).slice(0, 600) || null;

        const now = admin.firestore.FieldValue.serverTimestamp();
        try {
            await db.runTransaction(async (tx) => {
                const uSnap = await tx.get(userRef);
                const u = uSnap.exists ? uSnap.data() || {} : {};
                spendCreditsInTransaction(tx, userRef, u, {
                    uid,
                    accountRole: 'business',
                    amount: AI_TICKET_CREDITS,
                    type: 'feedback_ai_ticket',
                    reason: 'feedback_ai_ticket',
                    relatedId: ticketId,
                    allowSavedCredits: true,
                });
                tx.update(ticketRef, {
                    category, sentiment, sentimentScore, aiSummary, aiSuggestedReply,
                    aiProcessed: true, aiAnalyzedAt: now, updatedAt: now,
                });
            });
        } catch (spendErr) {
            if (spendErr && spendErr.code === 'INSUFFICIENT_CREDITS') {
                throw new functions.https.HttpsError('failed-precondition', 'INSUFFICIENT_CREDITS');
            }
            throw spendErr;
        }

        return { ok: true, category, sentiment, sentimentScore, aiSummary, aiSuggestedReply, creditsCharged: AI_TICKET_CREDITS };
    });

    // ── AI: aggregate insights across a business's open feedback. ─────────────
    exports.generateFeedbackInsights = functions.https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Please sign in.');
        const uid = context.auth.uid;

        const snap = await db.collection('business_feedback').where('businessId', '==', uid).limit(200).get();
        const items = snap.docs
            .map((d) => d.data() || {})
            .filter((f) => (f.kind || 'support') === 'support')
            .filter((f) => {
                const st = f.status || (f.isResolved ? 'resolved' : 'open');
                return st === 'open' || st === 'in_progress';
            });
        if (!items.length) {
            return { ok: true, count: 0, insights: null };
        }

        await enforceCallableRateLimit(uid, 'feedback_ai_insights', { cooldownMs: 15000, perHour: 20, perDay: 100 });

        const userRef = db.collection('users').doc(uid);
        const userSnap0 = await userRef.get();
        const user0 = userSnap0.exists ? userSnap0.data() || {} : {};
        const available = Number(user0.paidCredits || 0) + Number(user0.savedCredits || 0);
        if (available < AI_INSIGHTS_CREDITS) {
            throw new functions.https.HttpsError('failed-precondition', 'INSUFFICIENT_CREDITS');
        }

        const lines = items.slice(0, 150).map((f, i) =>
            `${i + 1}. [${f.type === 'suggestion' ? 'suggestion' : 'complaint'}] ${String(f.content || '').slice(0, 300)}`
        );
        const prompt = [
            'You are analyzing customer feedback for a business. Recent messages:',
            lines.join('\n'),
            '',
            'Respond with JSON only, no prose. Use the SAME language as the majority of the messages:',
            '{"summary": "1-2 sentence overview",',
            '"topIssues": [{"title":"short issue name","count":number,"severity":"high"|"medium"|"low","suggestion":"one short fix"}],',
            '"positives": ["short things customers liked"]}',
            'Limit topIssues to the 5 most important, most frequent first. Limit positives to 3.',
        ].join('\n');

        let ai;
        try {
            ai = await generateGeminiJson(prompt, { temperature: 0.3 });
        } catch (err) {
            console.error('generateFeedbackInsights gemini', err?.message || err);
            throw new functions.https.HttpsError('internal', 'AI analysis failed. Please try again.');
        }

        const insights = {
            summary: asTrimmed(ai?.summary).slice(0, 600) || '',
            topIssues: Array.isArray(ai?.topIssues) ? ai.topIssues.slice(0, 5).map((it) => ({
                title: asTrimmed(it?.title).slice(0, 120),
                count: Number.isFinite(Number(it?.count)) ? Number(it.count) : null,
                severity: ['high', 'medium', 'low'].includes(String(it?.severity)) ? it.severity : 'medium',
                suggestion: asTrimmed(it?.suggestion).slice(0, 240),
            })).filter((it) => it.title) : [],
            positives: Array.isArray(ai?.positives) ? ai.positives.slice(0, 3).map((p) => asTrimmed(p).slice(0, 120)).filter(Boolean) : [],
            analyzedCount: items.length,
        };

        const now = admin.firestore.FieldValue.serverTimestamp();
        try {
            await db.runTransaction(async (tx) => {
                const uSnap = await tx.get(userRef);
                const u = uSnap.exists ? uSnap.data() || {} : {};
                spendCreditsInTransaction(tx, userRef, u, {
                    uid,
                    accountRole: 'business',
                    amount: AI_INSIGHTS_CREDITS,
                    type: 'feedback_ai_insights',
                    reason: 'feedback_ai_insights',
                    relatedId: uid,
                    allowSavedCredits: true,
                });
                tx.set(
                    db.collection('business_feedback_stats').doc(uid),
                    { businessId: uid, aiInsights: insights, aiInsightsAt: now },
                    { merge: true }
                );
            });
        } catch (spendErr) {
            if (spendErr && spendErr.code === 'INSUFFICIENT_CREDITS') {
                throw new functions.https.HttpsError('failed-precondition', 'INSUFFICIENT_CREDITS');
            }
            throw spendErr;
        }

        return { ok: true, count: items.length, insights, creditsCharged: AI_INSIGHTS_CREDITS };
    });
}

module.exports = { registerFeedbackTickets };
