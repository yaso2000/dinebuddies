const functions = require('firebase-functions');

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
            return { ok: true, name: String(name || '') };
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
            businessId,
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
            actionUrl: '/business-dashboard#business-feedback-inbox',
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
}

module.exports = { registerFeedbackTickets };
