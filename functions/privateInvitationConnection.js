/**
 * Accepting a private invitation is meant to unlock chat between the two
 * people, the same way mutual-follow does everywhere else in the app. The
 * client can already make the invitee follow the host (their own account),
 * but only an Admin SDK write can make the HOST follow the invitee back —
 * that's the one direction this callable exists for.
 */
const functions = require('firebase-functions');

function normalizeFollowing(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.filter((id) => typeof id === 'string' && id.length > 0);
}

function registerPrivateInvitationConnection(exportsObj, { db, isBusinessUserDoc, enforceCallableRateLimit }) {
    exportsObj.acceptPrivateInvitationFollowBack = functions.https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
        }

        const inviteeUid = context.auth.uid;
        const invitationId = typeof data?.invitationId === 'string' ? data.invitationId.trim() : '';
        if (!invitationId) {
            throw new functions.https.HttpsError('invalid-argument', 'Invalid invitationId.');
        }

        await enforceCallableRateLimit(inviteeUid, 'accept_private_invitation_follow_back', {
            perMinute: 20,
            perHour: 200,
            perDay: 1000,
            cooldownMs: 0,
        });

        const invRef = db.collection('social_invitations').doc(invitationId);
        const invSnap = await invRef.get();
        if (!invSnap.exists) {
            throw new functions.https.HttpsError('not-found', 'Invitation not found.');
        }

        const invData = invSnap.data() || {};
        if (invData.type !== 'Private') {
            throw new functions.https.HttpsError('failed-precondition', 'Not a private invitation.');
        }

        const hostId = invData.authorId || invData.author?.id;
        if (!hostId || hostId === inviteeUid) {
            throw new functions.https.HttpsError('failed-precondition', 'Invalid invitation host.');
        }

        const invitedFriends = Array.isArray(invData.invitedFriends) ? invData.invitedFriends : [];
        const isInvitee =
            invitedFriends.includes(inviteeUid) ||
            Object.prototype.hasOwnProperty.call(invData.rsvps || {}, inviteeUid);
        if (!isInvitee) {
            throw new functions.https.HttpsError('permission-denied', 'Not invited to this invitation.');
        }

        if ((invData.rsvps || {})[inviteeUid] !== 'accepted') {
            throw new functions.https.HttpsError('failed-precondition', 'Invitation not accepted yet.');
        }

        const hostRef = db.collection('users').doc(hostId);
        const inviteeRef = db.collection('users').doc(inviteeUid);

        const result = await db.runTransaction(async (tx) => {
            const [hostSnap, inviteeSnap] = await Promise.all([tx.get(hostRef), tx.get(inviteeRef)]);
            if (!hostSnap.exists || !inviteeSnap.exists) {
                return { ok: true, established: false, reason: 'profile_not_found' };
            }

            const hostData = hostSnap.data() || {};
            const inviteeData = inviteeSnap.data() || {};

            const hostFollowing = normalizeFollowing(hostData.following);
            if (hostFollowing.includes(inviteeUid)) {
                return { ok: true, established: false, reason: 'already_following' };
            }

            if (isBusinessUserDoc(hostData)) {
                return { ok: true, established: false, reason: 'host_business' };
            }
            if (isBusinessUserDoc(inviteeData) || inviteeData.privacySettings?.allowFollowing === false) {
                return { ok: true, established: false, reason: 'invitee_not_followable' };
            }

            tx.update(hostRef, { following: [...hostFollowing, inviteeUid] });

            const currentCount = Number(inviteeData.followersCount);
            const safeCount = Number.isFinite(currentCount) && currentCount >= 0 ? Math.floor(currentCount) : 0;
            tx.update(inviteeRef, { followersCount: safeCount + 1 });

            return { ok: true, established: true };
        });

        return result;
    });
}

module.exports = { registerPrivateInvitationConnection };
