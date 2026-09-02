/**
 * Admin access audit + new-device alerts.
 *
 * The client calls `logAdminAccess` whenever the admin panel loads. We record
 * who entered, from which IP and device, and when. When a REGIONAL MANAGER
 * signs in from a device we have not seen before, we raise an alert and push a
 * notification to the owner immediately (reusing the notifications trigger).
 *
 * Device fingerprint = hash(user-agent): stable enough to catch a genuinely new
 * machine without the noise of rotating mobile IPs. IPs are logged (not alerted
 * on) so the owner can still eyeball location changes.
 */
const functions = require('firebase-functions');
const crypto = require('crypto');

function extractClientIp(context) {
    const raw = context.rawRequest;
    if (!raw) return 'unknown';
    const h = raw.headers || {};
    const xf = h['x-forwarded-for'] || h['X-Forwarded-For'];
    if (xf) return String(xf).split(',')[0].trim() || 'unknown';
    if (raw.ip) return String(raw.ip);
    return 'unknown';
}

function deviceFingerprint(userAgent) {
    return crypto.createHash('sha256').update(String(userAgent || 'unknown')).digest('hex').slice(0, 16);
}

const MAX_KNOWN_DEVICES = 25;

function registerAdminAccessAudit(exportsObj, { db, admin, assertAdminContext, superOwnerUids }) {
    /** Called by the admin shell on load. Records access + alerts on a new manager device. */
    exportsObj.logAdminAccess = functions.https.onCall(async (data, context) => {
        const adminCtx = await assertAdminContext(context);
        const { requesterUid, role, region } = adminCtx;

        const ip = extractClientIp(context);
        const userAgent = String(context.rawRequest?.headers?.['user-agent'] || '').slice(0, 300);
        const deviceKey = deviceFingerprint(userAgent);
        const email = (context.auth?.token?.email || '').toLowerCase() || null;

        const sessRef = db.collection('adminSessions').doc(requesterUid);
        const sessSnap = await sessRef.get();
        const known = sessSnap.exists ? (sessSnap.data()?.devices || []) : [];
        const isNewDevice = !known.includes(deviceKey);

        // Trim the known-device list to the most recent set.
        const nextDevices = [deviceKey, ...known.filter((d) => d !== deviceKey)].slice(0, MAX_KNOWN_DEVICES);
        await sessRef.set(
            {
                uid: requesterUid,
                email,
                role: role || null,
                region: region || null,
                devices: nextDevices,
                lastIp: ip,
                lastUserAgent: userAgent,
                lastAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true },
        );

        // Immutable audit trail.
        await db.collection('adminAccessLog').add({
            uid: requesterUid,
            email,
            role: role || null,
            region: region || null,
            ip,
            userAgent,
            deviceKey,
            isNewDevice,
            at: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Alert the owner when a MANAGER appears on a new device.
        if (isNewDevice && role === 'regional_manager') {
            const alertRef = await db.collection('adminAlerts').add({
                type: 'new_manager_device',
                uid: requesterUid,
                email,
                region: region || null,
                ip,
                userAgent,
                deviceKey,
                seen: false,
                at: admin.firestore.FieldValue.serverTimestamp(),
            });

            const title = 'تنبيه أمني — دخول مدير من جهاز جديد';
            const message = `${email || requesterUid} (${region || '—'}) — IP: ${ip}`;
            const owners = Array.isArray(superOwnerUids) ? superOwnerUids : [];
            await Promise.all(
                owners.map((ownerUid) =>
                    db
                        .collection('notifications')
                        .add({
                            userId: ownerUid,
                            title,
                            message,
                            type: 'admin_security_alert',
                            actionUrl: '/admin/managers',
                            alertId: alertRef.id,
                            createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        })
                        .catch((e) => functions.logger.warn('owner alert notif failed', ownerUid, e.message)),
                ),
            );
        }

        return { logged: true, isNewDevice };
    });

    /** Owner-only: recent admin access entries (newest first). */
    exportsObj.adminListAccessLog = functions.https.onCall(async (data, context) => {
        const { isSuperOwner } = await assertAdminContext(context);
        if (!isSuperOwner) {
            throw new functions.https.HttpsError('permission-denied', 'Owner only.');
        }
        const limit = Math.min(Math.max(parseInt(data?.limit, 10) || 50, 1), 200);
        const snap = await db.collection('adminAccessLog').orderBy('at', 'desc').limit(limit).get();
        const entries = snap.docs.map((d) => {
            const e = d.data() || {};
            return {
                id: d.id,
                email: e.email || null,
                role: e.role || null,
                region: e.region || null,
                ip: e.ip || null,
                userAgent: e.userAgent || null,
                isNewDevice: !!e.isNewDevice,
                at: e.at?.toMillis?.() || null,
            };
        });
        return { entries };
    });
}

module.exports = { registerAdminAccessAudit };
