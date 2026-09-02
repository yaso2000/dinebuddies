/**
 * Secure provisioning for regional managers.
 *
 * A regional manager account can ONLY be created by the super owner through
 * `adminCreateRegionalManager`. Nobody can self-register into the role:
 *   - Firestore rules forbid a client from writing role/region on any user doc.
 *   - These callables run with the Admin SDK (server) and are owner-gated.
 *
 * On creation we set BOTH the Firestore `users/{uid}` doc (the authorization
 * source of truth read by assertAdminContext) AND a custom auth claim
 * (defense-in-depth, unforgeable by the client). The owner never sees a
 * password — the manager sets their own via a one-time setup link.
 */
const functions = require('firebase-functions');

const VALID_REGIONS = require('./_adminRegion').ADMIN_REGION_COUNTRIES;

function isValidRegion(key) {
    return Object.prototype.hasOwnProperty.call(VALID_REGIONS, String(key || '').toLowerCase());
}

function normalizeEmail(raw) {
    const e = String(raw || '').trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

function registerRegionalManagerCallables(exportsObj, { db, admin, assertAdminContext }) {
    /** Owner-only: create (or promote) a regional manager and return a setup link. */
    exportsObj.adminCreateRegionalManager = functions.https.onCall(async (data, context) => {
        const { isSuperOwner, requesterUid } = await assertAdminContext(context);
        if (!isSuperOwner) {
            throw new functions.https.HttpsError(
                'permission-denied',
                'Only the owner can create a regional manager.',
            );
        }

        const email = normalizeEmail(data?.email);
        const region = String(data?.region || '').toLowerCase();
        const displayName = String(data?.displayName || '').trim().slice(0, 80) || 'Regional Manager';

        if (!email) throw new functions.https.HttpsError('invalid-argument', 'A valid email is required.');
        if (!isValidRegion(region)) {
            throw new functions.https.HttpsError('invalid-argument', 'Unknown region.');
        }

        // Find an existing auth user for this email, or create a fresh one (no password).
        let userRecord = null;
        try {
            userRecord = await admin.auth().getUserByEmail(email);
        } catch (e) {
            if (e?.code !== 'auth/user-not-found') {
                throw new functions.https.HttpsError('internal', `Auth lookup failed: ${e.message}`);
            }
        }

        let created = false;
        if (!userRecord) {
            userRecord = await admin.auth().createUser({ email, displayName, emailVerified: false });
            created = true;
        } else {
            // Guard: never convert an existing full admin into a scoped manager by accident.
            const existing = await db.collection('users').doc(userRecord.uid).get();
            const existingRole = String(existing.data()?.role || '').toLowerCase();
            if (existingRole === 'admin') {
                throw new functions.https.HttpsError(
                    'failed-precondition',
                    'This email belongs to a full admin. Choose a different email.',
                );
            }
        }

        const uid = userRecord.uid;

        // Defense-in-depth: unforgeable custom claim mirrors the Firestore role.
        const priorClaims = userRecord.customClaims || {};
        await admin.auth().setCustomUserClaims(uid, {
            ...priorClaims,
            role: 'regional_manager',
            region,
        });

        // Firestore doc — the authorization source of truth read on every admin call.
        await db.collection('users').doc(uid).set(
            {
                email,
                display_name: displayName,
                role: 'regional_manager',
                region,
                isRegionalManager: true,
                provisionedBy: requesterUid,
                provisionedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true },
        );

        // One-time link so the manager sets their OWN password (owner never sees it).
        let setupLink = null;
        try {
            setupLink = await admin.auth().generatePasswordResetLink(email);
        } catch (e) {
            functions.logger.warn('generatePasswordResetLink failed', email, e.message);
        }

        functions.logger.info('regional manager provisioned', { uid, region, by: requesterUid, created });
        return { success: true, uid, email, region, created, setupLink };
    });

    /** Owner-only: list all regional managers. */
    exportsObj.adminListRegionalManagers = functions.https.onCall(async (_data, context) => {
        const { isSuperOwner } = await assertAdminContext(context);
        if (!isSuperOwner) {
            throw new functions.https.HttpsError('permission-denied', 'Owner only.');
        }
        const snap = await db.collection('users').where('role', '==', 'regional_manager').limit(200).get();
        const managers = snap.docs.map((d) => {
            const u = d.data() || {};
            return {
                uid: d.id,
                email: u.email || null,
                displayName: u.display_name || u.displayName || null,
                region: u.region || null,
                provisionedAt: u.provisionedAt?.toMillis?.() || null,
            };
        });
        return { managers };
    });

    /** Owner-only: revoke a manager (demote to user, clear claim, disable login). */
    exportsObj.adminRevokeRegionalManager = functions.https.onCall(async (data, context) => {
        const { isSuperOwner } = await assertAdminContext(context);
        if (!isSuperOwner) {
            throw new functions.https.HttpsError('permission-denied', 'Owner only.');
        }
        const uid = String(data?.uid || '').trim();
        if (!uid) throw new functions.https.HttpsError('invalid-argument', 'uid is required.');

        const snap = await db.collection('users').doc(uid).get();
        if (String(snap.data()?.role || '').toLowerCase() !== 'regional_manager') {
            throw new functions.https.HttpsError('failed-precondition', 'User is not a regional manager.');
        }

        // Clear the elevated claim, demote the doc, and disable the login.
        const user = await admin.auth().getUser(uid);
        const claims = { ...(user.customClaims || {}) };
        delete claims.role;
        delete claims.region;
        await admin.auth().setCustomUserClaims(uid, claims);

        await db.collection('users').doc(uid).set(
            {
                role: 'user',
                isRegionalManager: false,
                revokedBy: context.auth.uid,
                revokedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true },
        );
        await db.collection('users').doc(uid).update({ region: admin.firestore.FieldValue.delete() }).catch(() => {});

        try {
            await admin.auth().updateUser(uid, { disabled: true });
        } catch (e) {
            functions.logger.warn('revoke: disable failed', uid, e.message);
        }

        return { success: true, uid };
    });
}

module.exports = { registerRegionalManagerCallables };
