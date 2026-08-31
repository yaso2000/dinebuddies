const functions = require('firebase-functions');
const { normalizeBusinessSubscriptionTier } = require('./creditsCore');

/**
 * Business job postings & applications.
 *
 * A Business Pro account posts a job (`business_jobs`); registered members apply
 * with a lightweight application (name, phone, contact, photo, short bio) which
 * lands in `job_applications` (server-only write, owner-read). The business owner
 * downloads each application as a PDF client-side (jspdf). Mirrors the design of
 * feedbackTickets.js — server-only creation, rate-limited, notification fan-out
 * through the existing `partner_notifications` pipeline.
 *
 * @param {object} exports  Cloud Functions export bag (from index.js)
 * @param {object} deps
 * @param {FirebaseFirestore.Firestore} deps.db
 * @param {import('firebase-admin')} deps.admin
 * @param {(uid: string, bucket: string, limits?: object) => Promise<void>} deps.enforceCallableRateLimit
 */
function registerJobPostings(exports, { db, admin, enforceCallableRateLimit }) {
    if (typeof enforceCallableRateLimit !== 'function') {
        throw new Error('registerJobPostings: enforceCallableRateLimit is required');
    }

    const MAX_TITLE = 120;
    const MAX_DESC = 4000;
    const MAX_NAME = 80;
    const MAX_PHONE = 40;
    const MAX_CONTACT = 140;
    const MAX_BIO = 900;
    const MAX_LOCATION = 120;
    const MAX_ACTIVE_JOBS = 25; // ceiling on open postings per business
    const JOB_TYPES = ['full_time', 'part_time', 'temporary', 'internship', 'seasonal', 'contract'];

    const asTrimmed = (v) => (typeof v === 'string' ? v.trim() : '');

    /** Parse a job expiry (YYYY-MM-DD string or ms) into a Timestamp; end-of-day. */
    function parseExpiry(raw) {
        if (!raw) return null;
        const d = typeof raw === 'number' ? new Date(raw) : new Date(String(raw));
        if (Number.isNaN(d.getTime())) return null;
        if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) {
            d.setHours(23, 59, 59, 999);
        }
        return admin.firestore.Timestamp.fromDate(d);
    }

    /** Remove the mirrored feed post + swipe feature tied to a job (best-effort). */
    async function cleanupJobDistribution(job, jobId, ownerId) {
        const tasks = [];
        if (job && job.feedPostId) {
            tasks.push(db.collection('communityPosts').doc(job.feedPostId).delete().catch(() => {}));
        }
        // Clear the featured swipe job if it points at this job.
        tasks.push(
            (async () => {
                try {
                    const uSnap = await db.collection('users').doc(ownerId).get();
                    const fj = uSnap.exists ? (uSnap.data() || {}).businessInfo?.featuredJob : null;
                    if (fj && fj.jobId === jobId) {
                        await db.collection('users').doc(ownerId).set(
                            { businessInfo: { featuredJob: admin.firestore.FieldValue.delete() } },
                            { merge: true }
                        );
                        await db.collection('public_profiles').doc(ownerId).set(
                            { featuredJob: admin.firestore.FieldValue.delete() },
                            { merge: true }
                        ).catch(() => {});
                    }
                } catch {
                    /* ignore */
                }
            })()
        );
        await Promise.all(tasks);
    }

    /** Read the caller's user doc and confirm they are a Business Pro account. */
    async function assertBusinessPro(uid) {
        const snap = await db.collection('users').doc(uid).get();
        const u = snap.exists ? snap.data() || {} : {};
        const role = String(u.role || u.accountType || u.accountRole || '').toLowerCase();
        const isBusiness =
            role === 'business' ||
            role === 'partner' ||
            u.isBusiness === true ||
            String(u.profileType || '').toLowerCase() === 'business';
        if (!isBusiness) {
            throw new functions.https.HttpsError(
                'permission-denied',
                'Only business accounts can post jobs.'
            );
        }
        if (normalizeBusinessSubscriptionTier(u.subscriptionTier) !== 'paid') {
            throw new functions.https.HttpsError(
                'permission-denied',
                'Job posting is a Business Pro feature.'
            );
        }
        const name =
            asTrimmed(u.displayName) ||
            asTrimmed(u.display_name) ||
            asTrimmed(u.businessName) ||
            'Business';
        const avatar = u.photoURL || u.photo_url || u.avatarUrl || null;
        return { name, avatar };
    }

    // ── Business creates a job posting ────────────────────────────────────────
    exports.createJobPosting = functions.https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Please sign in.');
        }
        const uid = context.auth.uid;

        const title = asTrimmed(data?.title);
        const description = asTrimmed(data?.description);
        let jobType = asTrimmed(data?.jobType).toLowerCase();
        const location = asTrimmed(data?.location).slice(0, MAX_LOCATION);
        // Distribution options (like the special offer): feed post, swipe banner.
        const publishToFeed = data?.publishToFeed !== false; // default on
        const showOnSwipe = data?.showOnSwipe === true;
        const expiresAt = parseExpiry(data?.expiresAt); // Timestamp | null

        if (!title) throw new functions.https.HttpsError('invalid-argument', 'Job title is required.');
        if (title.length > MAX_TITLE) throw new functions.https.HttpsError('invalid-argument', 'Job title is too long.');
        if (!description) throw new functions.https.HttpsError('invalid-argument', 'Job description is required.');
        if (description.length > MAX_DESC) throw new functions.https.HttpsError('invalid-argument', 'Job description is too long.');
        if (!JOB_TYPES.includes(jobType)) jobType = 'full_time';

        await enforceCallableRateLimit(uid, 'job_posting_create', {
            cooldownMs: 10 * 1000,
            perHour: 20,
            perDay: 50,
        });

        const business = await assertBusinessPro(uid);

        // Enforce a ceiling on active (open) postings.
        const openSnap = await db
            .collection('business_jobs')
            .where('businessId', '==', uid)
            .where('status', '==', 'open')
            .get();
        if (openSnap.size >= MAX_ACTIVE_JOBS) {
            throw new functions.https.HttpsError(
                'resource-exhausted',
                'You have reached the maximum number of open job postings.'
            );
        }

        const now = admin.firestore.FieldValue.serverTimestamp();
        const jobRef = db.collection('business_jobs').doc();
        await jobRef.set({
            businessId: uid,
            businessName: business.name || null,
            businessAvatar: business.avatar || null,
            title,
            description,
            jobType,
            location: location || null,
            status: 'open', // open | closed
            applicationCount: 0,
            expiresAt: expiresAt || null,
            inFeed: publishToFeed,
            onSwipeCard: showOnSwipe,
            createdAt: now,
            updatedAt: now,
            closedAt: null,
        });

        // (1) Mirror as a feed post in communityPosts (like motion posts).
        let feedPostId = null;
        if (publishToFeed) {
            try {
                const feedRef = db.collection('communityPosts').doc();
                await feedRef.set({
                    type: 'job_post',
                    jobId: jobRef.id,
                    authorId: uid,
                    businessId: uid,
                    author: { id: uid, name: business.name || '', avatar: business.avatar || null },
                    content: title,
                    jobSnapshot: {
                        title,
                        jobType,
                        location: location || null,
                        description: description.slice(0, 500),
                        expiresAt: expiresAt || null,
                    },
                    status: 'published',
                    likes: [],
                    comments: [],
                    reposts: [],
                    authorInterests: [],
                    publishedAt: now,
                    createdAt: now,
                    updatedAt: now,
                });
                feedPostId = feedRef.id;
                await jobRef.update({ feedPostId });
            } catch (e) {
                console.warn('[createJobPosting] feed mirror failed:', e && e.message);
            }
        }

        // (6) Feature the newest job on the business swipe card (mirror onto the
        // user doc + public profile, like businessInfo.swipeSpecialOffer).
        if (showOnSwipe) {
            const featured = {
                jobId: jobRef.id,
                title,
                jobType,
                location: location || null,
                expiresAt: expiresAt || null,
                updatedAt: admin.firestore.Timestamp.now(),
            };
            try {
                await db.collection('users').doc(uid).set({ businessInfo: { featuredJob: featured } }, { merge: true });
                await db.collection('public_profiles').doc(uid).set({ featuredJob: featured }, { merge: true });
            } catch (e) {
                console.warn('[createJobPosting] swipe feature failed:', e && e.message);
            }
        }

        return { ok: true, jobId: jobRef.id, feedPostId };
    });

    // ── Business edits / opens / closes a posting ─────────────────────────────
    exports.updateJobPosting = functions.https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Please sign in.');
        }
        const uid = context.auth.uid;
        const jobId = asTrimmed(data?.jobId);
        if (!jobId) throw new functions.https.HttpsError('invalid-argument', 'jobId is required.');

        const jobRef = db.collection('business_jobs').doc(jobId);
        const snap = await jobRef.get();
        if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Job not found.');
        const job = snap.data() || {};
        if (uid !== job.businessId) {
            throw new functions.https.HttpsError('permission-denied', 'Only the owner can edit this job.');
        }

        const now = admin.firestore.FieldValue.serverTimestamp();
        const updates = { updatedAt: now };

        if (typeof data?.title === 'string') {
            const title = asTrimmed(data.title);
            if (!title) throw new functions.https.HttpsError('invalid-argument', 'Job title is required.');
            if (title.length > MAX_TITLE) throw new functions.https.HttpsError('invalid-argument', 'Job title is too long.');
            updates.title = title;
        }
        if (typeof data?.description === 'string') {
            const description = asTrimmed(data.description);
            if (!description) throw new functions.https.HttpsError('invalid-argument', 'Job description is required.');
            if (description.length > MAX_DESC) throw new functions.https.HttpsError('invalid-argument', 'Job description is too long.');
            updates.description = description;
        }
        if (typeof data?.jobType === 'string') {
            const jt = asTrimmed(data.jobType).toLowerCase();
            updates.jobType = JOB_TYPES.includes(jt) ? jt : 'full_time';
        }
        if (typeof data?.location === 'string') {
            updates.location = asTrimmed(data.location).slice(0, MAX_LOCATION) || null;
        }
        if ('expiresAt' in (data || {})) {
            updates.expiresAt = parseExpiry(data.expiresAt) || null;
        }
        let closing = false;
        if (typeof data?.status === 'string') {
            const status = asTrimmed(data.status).toLowerCase();
            if (status !== 'open' && status !== 'closed') {
                throw new functions.https.HttpsError('invalid-argument', 'Invalid status.');
            }
            updates.status = status;
            updates.closedAt = status === 'closed' ? now : null;
            closing = status === 'closed';
        }

        await jobRef.update(updates);
        // Closing a job pulls its feed post + swipe banner.
        if (closing) {
            await cleanupJobDistribution(job, jobId, uid);
        }
        return { ok: true };
    });

    // ── Business deletes a posting (and its applications) ─────────────────────
    exports.deleteJobPosting = functions.https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Please sign in.');
        }
        const uid = context.auth.uid;
        const jobId = asTrimmed(data?.jobId);
        if (!jobId) throw new functions.https.HttpsError('invalid-argument', 'jobId is required.');

        const jobRef = db.collection('business_jobs').doc(jobId);
        const snap = await jobRef.get();
        if (!snap.exists) return { ok: true };
        const job = snap.data() || {};
        if (uid !== job.businessId) {
            throw new functions.https.HttpsError('permission-denied', 'Only the owner can delete this job.');
        }

        // Pull the mirrored feed post + swipe banner first.
        await cleanupJobDistribution(job, jobId, uid);

        // Remove applications tied to this job, then the job itself.
        const appsSnap = await db
            .collection('job_applications')
            .where('jobId', '==', jobId)
            .get();
        const batch = db.batch();
        appsSnap.forEach((d) => batch.delete(d.ref));
        batch.delete(jobRef);
        await batch.commit();

        return { ok: true };
    });

    // ── Member applies to a job ───────────────────────────────────────────────
    exports.submitJobApplication = functions.https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Please sign in to apply.');
        }
        const uid = context.auth.uid;

        const jobId = asTrimmed(data?.jobId);
        const name = asTrimmed(data?.name).slice(0, MAX_NAME);
        const phone = asTrimmed(data?.phone).slice(0, MAX_PHONE);
        const contact = asTrimmed(data?.contact).slice(0, MAX_CONTACT);
        const bio = asTrimmed(data?.bio).slice(0, MAX_BIO);
        const photoUrl = asTrimmed(data?.photoUrl).slice(0, 2048);

        if (!jobId) throw new functions.https.HttpsError('invalid-argument', 'jobId is required.');
        if (!name) throw new functions.https.HttpsError('invalid-argument', 'Your name is required.');
        if (!phone) throw new functions.https.HttpsError('invalid-argument', 'A phone number is required.');
        // photoUrl, when provided, must be a Firebase Storage URL (client uploaded it).
        if (photoUrl && !/^https:\/\//i.test(photoUrl)) {
            throw new functions.https.HttpsError('invalid-argument', 'Invalid photo.');
        }

        await enforceCallableRateLimit(uid, 'job_application_submit', {
            cooldownMs: 20 * 1000,
            perHour: 10,
            perDay: 30,
        });

        const jobRef = db.collection('business_jobs').doc(jobId);
        const jobSnap = await jobRef.get();
        if (!jobSnap.exists) throw new functions.https.HttpsError('not-found', 'Job not found.');
        const job = jobSnap.data() || {};
        if (job.status !== 'open') {
            throw new functions.https.HttpsError('failed-precondition', 'This job is no longer accepting applications.');
        }
        if (uid === job.businessId) {
            throw new functions.https.HttpsError('failed-precondition', 'You cannot apply to your own job.');
        }

        // One application per member per job (deterministic id ⇒ re-apply overwrites).
        const appId = `${jobId}_${uid}`;
        const appRef = db.collection('job_applications').doc(appId);
        const existing = await appRef.get();
        const isNew = !existing.exists;

        const senderSnap = await db.collection('users').doc(uid).get();
        const sender = senderSnap.exists ? senderSnap.data() || {} : {};
        const userAvatar = sender.photoURL || sender.photo_url || sender.avatarUrl || null;

        const now = admin.firestore.FieldValue.serverTimestamp();
        const batch = db.batch();

        batch.set(appRef, {
            jobId,
            businessId: job.businessId,
            businessName: job.businessName || null,
            jobTitle: job.title || null,
            applicantId: uid,
            applicantName: name,
            applicantPhone: phone,
            applicantContact: contact || null,
            applicantBio: bio || null,
            applicantPhotoUrl: photoUrl || null,
            applicantAvatar: userAvatar,
            status: 'new', // new | reviewed
            unreadForBusiness: true,
            createdAt: existing.exists ? (existing.data() || {}).createdAt || now : now,
            updatedAt: now,
        }, { merge: true });

        if (isNew) {
            batch.update(jobRef, {
                applicationCount: admin.firestore.FieldValue.increment(1),
                updatedAt: now,
            });
        }

        // Notify the business (in-app inbox mirror + FCM via partner_notifications).
        const notifRef = db.collection('partner_notifications').doc();
        batch.set(notifRef, {
            restaurantId: job.businessId,
            type: 'job_application',
            title: 'New job application 📄',
            message: `${name} — ${job.title || 'Job'}`.slice(0, 120),
            actionUrl: '/business-dashboard/jobs',
            read: false,
            createdAt: now,
            senderId: uid,
            fromUserName: name,
            fromUserAvatar: userAvatar,
            metadata: { jobId, applicationId: appId },
        });

        await batch.commit();
        return { ok: true, applicationId: appId, reapplied: !isNew };
    });

    // ── Business marks an application reviewed / clears its unread flag ────────
    exports.setJobApplicationStatus = functions.https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Please sign in.');
        }
        const uid = context.auth.uid;
        const applicationId = asTrimmed(data?.applicationId);
        const status = asTrimmed(data?.status).toLowerCase();
        if (!applicationId) throw new functions.https.HttpsError('invalid-argument', 'applicationId is required.');
        if (status && status !== 'new' && status !== 'reviewed') {
            throw new functions.https.HttpsError('invalid-argument', 'Invalid status.');
        }

        const appRef = db.collection('job_applications').doc(applicationId);
        const snap = await appRef.get();
        if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Application not found.');
        const app = snap.data() || {};
        if (uid !== app.businessId) {
            throw new functions.https.HttpsError('permission-denied', 'Only the business can update this.');
        }

        const updates = { unreadForBusiness: false, updatedAt: admin.firestore.FieldValue.serverTimestamp() };
        if (status) updates.status = status;
        await appRef.update(updates);
        return { ok: true };
    });

    // ── Scheduled: auto-close expired jobs + pull their feed post / swipe banner ─
    exports.purgeExpiredJobs = functions.pubsub.schedule('every 6 hours').onRun(async () => {
        const nowTs = admin.firestore.Timestamp.now();
        // Equality+inequality on different fields needs a composite index; query by
        // the expiresAt inequality only (single-field) and filter status in code.
        const snap = await db
            .collection('business_jobs')
            .where('expiresAt', '<=', nowTs)
            .limit(300)
            .get();
        if (snap.empty) return null;
        let closed = 0;
        for (const docSnap of snap.docs) {
            const job = docSnap.data() || {};
            if (job.status !== 'open') continue;
            try {
                await docSnap.ref.update({ status: 'closed', closedAt: nowTs, updatedAt: nowTs });
                await cleanupJobDistribution(job, docSnap.id, job.businessId);
                closed += 1;
            } catch (e) {
                console.warn('[purgeExpiredJobs]', docSnap.id, e && e.message);
            }
        }
        console.log(`[purgeExpiredJobs] closed ${closed} expired job(s)`);
        return null;
    });
}

module.exports = { registerJobPostings };
