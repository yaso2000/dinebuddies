/**
 * Admin email campaigns via Resend — audience:
 *  - filters: role + optional country + optional geo radius
 *  - explicit_emails: paste list → resolve users by email/authEmail in Firestore
 *  - name_prefix: display_name prefix query (same idea as admin user search)
 *
 * RESEND_API_KEY required on Functions runtime.
 */

const { Resend } = require('resend');
const { getUserDocLatLng } = require('./userDocCoords.cjs');

const MAX_CAMPAIGN_RECIPIENTS = 5000;
const PREVIEW_MAX_SCAN = 80000;
const NAME_PREFIX_MAX = 400;
const BATCH_SIZE = 100;

const DEFAULT_FROM = 'DineBuddies <noreply@dinebuddies.com>';

function chunkArray(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

function parseEmailsFromText(text) {
    if (!text || typeof text !== 'string') return [];
    const parts = text.split(/[\s,;]+/);
    const set = new Set();
    for (const p of parts) {
        const e = p.trim().toLowerCase();
        if (e.includes('@')) set.add(e);
    }
    return [...set];
}

function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function recipientEmail(data) {
    const e = (data.email || data.authEmail || '').trim().toLowerCase();
    return e && e.includes('@') ? e : null;
}

function countryCodeOf(data) {
    const raw = data.countryCode || data.country || data.businessInfo?.country;
    if (raw == null || raw === '') return null;
    const s = String(raw).trim();
    if (s.length === 2) return s.toUpperCase();
    return null;
}

function matchesRole(data, roleFilter) {
    const r = String(data.role || 'user').toLowerCase();
    if (roleFilter === 'all') return true;
    if (roleFilter === 'business') return r === 'business';
    if (roleFilter === 'user') return r === 'user';
    if (roleFilter === 'staff') return ['staff', 'support', 'admin'].includes(r);
    return false;
}

function matchesFilters(doc, filters) {
    const data = doc.data();
    if (data.banned === true) return false;
    if (!recipientEmail(data)) return false;
    if (!matchesRole(data, filters.roleFilter || 'all')) return false;

    if (filters.countryCode) {
        const want = String(filters.countryCode).trim().toUpperCase().slice(0, 2);
        const u = countryCodeOf(data);
        if (!u || u !== want) return false;
    }

    if (filters.geo && filters.geo.radiusKm > 0) {
        const lat = Number(filters.geo.lat);
        const lng = Number(filters.geo.lng);
        const radiusKm = Number(filters.geo.radiusKm);
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(radiusKm)) return false;
        const payload = { id: doc.id, ...data };
        const ll = getUserDocLatLng(payload);
        if (!ll) return false;
        const d = haversineKm(lat, lng, ll.lat, ll.lng);
        if (d > radiusKm) return false;
    }

    return true;
}

function normalizeFilters(data) {
    const roleFilter = typeof data?.roleFilter === 'string' ? data.roleFilter : 'all';
    const countryCode = data?.countryCode ? String(data.countryCode).trim() : '';
    const geo = data?.geo && typeof data.geo === 'object' ? data.geo : null;
    return { roleFilter, countryCode, geo };
}

async function runUserScan(db, admin, filters, maxScan, onEachDoc) {
    let scanned = 0;
    let lastDoc = null;
    const batchSize = 400;
    let truncated = false;

    while (scanned < maxScan) {
        let q = db.collection('users').orderBy(admin.firestore.FieldPath.documentId()).limit(batchSize);
        if (lastDoc) q = q.startAfter(lastDoc);
        const snap = await q.get();
        if (snap.empty) break;

        for (const doc of snap.docs) {
            if (scanned >= maxScan) {
                truncated = true;
                break;
            }
            scanned++;
            onEachDoc(doc);
        }

        lastDoc = snap.docs[snap.docs.length - 1];
        if (snap.size < batchSize) break;
        if (truncated) break;
    }

    return { scanned, truncated };
}

async function resolveExplicitRecipients(db, emailList) {
    const normalized = parseEmailsFromText(Array.isArray(emailList) ? emailList.join(' ') : String(emailList || ''));
    if (normalized.length === 0) {
        throw new Error('NO_EMAILS');
    }
    if (normalized.length > MAX_CAMPAIGN_RECIPIENTS) {
        throw new Error(`Too many emails in list (max ${MAX_CAMPAIGN_RECIPIENTS}).`);
    }

    const byUid = new Map();
    const matchedListEmails = new Set();
    for (const chunk of chunkArray(normalized, 10)) {
        const [s1, s2] = await Promise.all([
            db.collection('users').where('email', 'in', chunk).get(),
            db.collection('users').where('authEmail', 'in', chunk).get(),
        ]);
        for (const doc of [...s1.docs, ...s2.docs]) {
            const data = doc.data();
            if (data.banned === true) continue;
            const em = recipientEmail(data);
            if (!em || !normalized.includes(em)) continue;
            matchedListEmails.add(em);
            byUid.set(doc.id, { email: em, uid: doc.id });
        }
    }

    const notFoundCount = normalized.filter((e) => !matchedListEmails.has(e)).length;

    return {
        recipients: [...byUid.values()],
        scanned: normalized.length,
        truncated: false,
        requestedCount: normalized.length,
        notFoundCount,
    };
}

async function resolveNamePrefixRecipients(db, prefixRaw) {
    const prefix = String(prefixRaw || '').trim();
    if (prefix.length < 2) {
        throw new Error('PREFIX_SHORT');
    }

    const snap = await db
        .collection('users')
        .where('display_name', '>=', prefix)
        .where('display_name', '<=', `${prefix}\uf8ff`)
        .limit(NAME_PREFIX_MAX)
        .get();

    const recipients = [];
    const seen = new Set();
    for (const doc of snap.docs) {
        const data = doc.data();
        if (data.banned === true) continue;
        const em = recipientEmail(data);
        if (!em || seen.has(em)) continue;
        seen.add(em);
        recipients.push({ email: em, uid: doc.id });
    }

    return {
        recipients,
        scanned: snap.size,
        truncated: snap.size >= NAME_PREFIX_MAX,
    };
}

function registerAdminEmailCampaign({ exports, functions, db, assertAdminContext, admin }) {
    const opts = { timeoutSeconds: 540, memory: '1GB' };

    async function buildAudience(data, forSend) {
        const mode = typeof data?.audienceMode === 'string' ? data.audienceMode : 'filters';

        if (mode === 'explicit_emails') {
            const raw = data?.emailsText ?? data?.emailsRaw ?? '';
            const result = await resolveExplicitRecipients(db, raw);
            return {
                mode,
                filters: { audienceMode: mode },
                ...result,
            };
        }

        if (mode === 'name_prefix') {
            const prefix = (data?.namePrefix || '').trim();
            if (prefix.length < 2) {
                throw new functions.https.HttpsError('invalid-argument', 'namePrefix must be at least 2 characters.');
            }
            const result = await resolveNamePrefixRecipients(db, prefix);
            return {
                mode,
                filters: { audienceMode: mode, namePrefix: prefix },
                ...result,
            };
        }

        const filters = normalizeFilters(data);
        const validRoles = ['all', 'business', 'user', 'staff'];
        if (!validRoles.includes(filters.roleFilter)) {
            throw new functions.https.HttpsError('invalid-argument', 'Invalid roleFilter.');
        }

        const recipients = [];
        const seen = new Set();
        const maxScan = forSend ? PREVIEW_MAX_SCAN : PREVIEW_MAX_SCAN;

        const { scanned, truncated } = await runUserScan(db, admin, filters, maxScan, (doc) => {
            if (!matchesFilters(doc, filters)) return;
            const data_ = doc.data();
            const email = recipientEmail(data_);
            if (!email || seen.has(email)) return;
            seen.add(email);
            recipients.push({ email, uid: doc.id });
        });

        return {
            mode: 'filters',
            filters: { audienceMode: 'filters', ...filters },
            recipients,
            scanned,
            truncated,
        };
    }

    exports.adminPreviewEmailCampaign = functions.runWith(opts).https.onCall(async (data, context) => {
        await assertAdminContext(context);

        let audience;
        try {
            audience = await buildAudience(data, false);
        } catch (e) {
            if (e.message === 'NO_EMAILS') {
                throw new functions.https.HttpsError('invalid-argument', 'Add at least one email address.');
            }
            if (e.message === 'PREFIX_SHORT') {
                throw new functions.https.HttpsError('invalid-argument', 'namePrefix must be at least 2 characters.');
            }
            if (e.message && e.message.includes('Too many emails')) {
                throw new functions.https.HttpsError('invalid-argument', e.message);
            }
            throw e;
        }

        const { recipients, scanned, truncated, mode, notFoundCount } = audience;
        const sampleEmails = recipients.slice(0, 10).map((r) => r.email);

        const out = {
            matchCount: recipients.length,
            scanned,
            scanTruncated: truncated,
            sampleEmails,
            audienceMode: mode,
        };
        if (typeof notFoundCount === 'number') out.emailsNotFoundInDatabase = notFoundCount;
        return out;
    });

    exports.adminSendEmailCampaign = functions.runWith(opts).https.onCall(async (data, context) => {
        const { requesterUid } = await assertAdminContext(context);

        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey || typeof apiKey !== 'string') {
            throw new functions.https.HttpsError(
                'failed-precondition',
                'RESEND_API_KEY is not configured on the Functions runtime.'
            );
        }

        const subject = typeof data?.subject === 'string' ? data.subject.trim() : '';
        const html = typeof data?.html === 'string' ? data.html : '';
        if (!subject || subject.length > 200) {
            throw new functions.https.HttpsError('invalid-argument', 'subject is required (max 200 chars).');
        }
        if (!html || html.length > 500000) {
            throw new functions.https.HttpsError('invalid-argument', 'html body is required (max 500kb).');
        }

        const from = typeof data?.from === 'string' && data.from.trim() ? data.from.trim() : DEFAULT_FROM;

        let audience;
        try {
            audience = await buildAudience(data, true);
        } catch (e) {
            if (e.message === 'NO_EMAILS') {
                throw new functions.https.HttpsError('invalid-argument', 'Add at least one email address.');
            }
            if (e.message === 'PREFIX_SHORT') {
                throw new functions.https.HttpsError('invalid-argument', 'namePrefix must be at least 2 characters.');
            }
            if (e.message && e.message.includes('Too many emails')) {
                throw new functions.https.HttpsError('invalid-argument', e.message);
            }
            throw e;
        }

        const { recipients, scanned, truncated, filters: audienceFilters } = audience;

        if (recipients.length > MAX_CAMPAIGN_RECIPIENTS) {
            throw new functions.https.HttpsError(
                'failed-precondition',
                `Too many recipients (${recipients.length}). Narrow audience (max ${MAX_CAMPAIGN_RECIPIENTS}).`
            );
        }

        if (recipients.length === 0) {
            return { sent: 0, scanned, truncated, message: 'No matching recipients.' };
        }

        if (data?.dryRun === true) {
            return { dryRun: true, wouldSend: recipients.length, scanned, truncated };
        }

        const resend = new Resend(apiKey);
        const footer =
            '<p style="color:#64748b;font-size:12px;margin-top:24px;">You receive this as a DineBuddies member. Notification settings: https://dinebuddies.com/settings/notifications</p>';
        const fullHtml = html.includes('</body>') ? html : `${html}${footer}`;

        let sent = 0;
        const errors = [];

        for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
            const chunk = recipients.slice(i, i + BATCH_SIZE);
            const payloads = chunk.map((r) => ({
                from,
                to: [r.email],
                subject,
                html: fullHtml,
            }));

            try {
                const { error } = await resend.batch.send(payloads);
                if (error) {
                    errors.push(String(error.message || error));
                } else {
                    sent += chunk.length;
                }
            } catch (e) {
                errors.push(e.message || String(e));
            }
        }

        await db.collection('admin_email_campaigns').add({
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            requesterUid,
            subject,
            from,
            filters: audienceFilters || {},
            recipientCount: recipients.length,
            scanned,
            truncated,
            sent,
            errors: errors.length ? errors.slice(0, 20) : [],
        });

        return {
            sent,
            scanned,
            truncated,
            errors: errors.length ? errors : undefined,
        };
    });
}

module.exports = { registerAdminEmailCampaign };
