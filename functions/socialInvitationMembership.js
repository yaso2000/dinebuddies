/**
 * Moderation for social (group) invitation chat — mirrors setStageMembership's
 * mute/remove/block actions, retargeted at social_invitations/{id} instead of
 * stages/{id}. No join/leave/discovery here: invitations are invite-only,
 * membership is tracked via rsvps[uid] === 'accepted' (the same field the
 * accept/decline flow already writes), not a separate memberIds array.
 */
const functions = require('firebase-functions');

function asTrimmedString(v) {
    return typeof v === 'string' ? v.trim() : '';
}

function resolveMuteUntilTimestamp(admin, duration) {
    const nowMs = Date.now();
    const key = String(duration || '').toLowerCase();
    if (key === '5m' || key === '5min' || key === 'five_minutes') {
        return admin.firestore.Timestamp.fromMillis(nowMs + 5 * 60 * 1000);
    }
    if (key === '1h' || key === '1hour' || key === 'one_hour') {
        return admin.firestore.Timestamp.fromMillis(nowMs + 60 * 60 * 1000);
    }
    // "session" — muted for the rest of this event (24h cap, same ballpark as a Stage).
    if (key === 'session') {
        return admin.firestore.Timestamp.fromMillis(nowMs + 24 * 60 * 60 * 1000);
    }
    return null;
}

function registerSocialInvitationMembership(exportsObj, { db, admin, enforceCallableRateLimit }) {
    exportsObj.setSocialInvitationMembership = functions.https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
        }

        const uid = context.auth.uid;
        const action = asTrimmedString(data?.action).toLowerCase();
        const invitationId = asTrimmedString(data?.invitationId);

        if (!invitationId) {
            throw new functions.https.HttpsError('invalid-argument', 'invitationId is required.');
        }
        if (!['mute_member', 'unmute_member', 'remove_member', 'block_member'].includes(action)) {
            throw new functions.https.HttpsError('invalid-argument', 'Invalid action.');
        }

        await enforceCallableRateLimit(uid, 'set_social_invitation_membership', {
            perMinute: 20,
            perHour: 200,
            cooldownMs: 500,
        });

        const invRef = db.collection('social_invitations').doc(invitationId);
        const invSnap = await invRef.get();
        if (!invSnap.exists) {
            throw new functions.https.HttpsError('not-found', 'Invitation not found.');
        }
        const inv = invSnap.data() || {};
        if (inv.type !== 'Social') {
            throw new functions.https.HttpsError('failed-precondition', 'Not a social invitation.');
        }
        const hostId = String(inv.authorId || inv.author?.id || '');

        if (action === 'unmute_member') {
            const targetUid = asTrimmedString(data?.targetUid);
            if (!targetUid) {
                throw new functions.https.HttpsError('invalid-argument', 'targetUid is required.');
            }
            // Guest may clear their own expired mute; host may unmute anyone.
            if (uid !== hostId && uid !== targetUid) {
                throw new functions.https.HttpsError(
                    'permission-denied',
                    'Only the host can unmute other members.'
                );
            }
            if (uid !== hostId && uid === targetUid) {
                const untilMap =
                    inv.communityMutedUntil && typeof inv.communityMutedUntil === 'object'
                        ? inv.communityMutedUntil
                        : {};
                const untilRaw = untilMap[targetUid];
                const untilMs =
                    untilRaw && typeof untilRaw.toMillis === 'function' ? untilRaw.toMillis() : 0;
                if (untilMs && untilMs > Date.now()) {
                    throw new functions.https.HttpsError('permission-denied', 'Mute is still active.');
                }
            }
            await invRef.update({
                communityMutedUserIds: admin.firestore.FieldValue.arrayRemove(targetUid),
                [`communityMutedUntil.${targetUid}`]: admin.firestore.FieldValue.delete(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            return { success: true, unmuted: true };
        }

        if (uid !== hostId) {
            throw new functions.https.HttpsError(
                'permission-denied',
                'Only the invitation host can perform this action.'
            );
        }

        const targetUid = asTrimmedString(data?.targetUid);
        if (!targetUid || targetUid === hostId) {
            throw new functions.https.HttpsError('invalid-argument', 'targetUid is required.');
        }

        if (action === 'mute_member') {
            const until = resolveMuteUntilTimestamp(admin, data?.duration);
            if (!until) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'duration must be 5m, 1h, or session.'
                );
            }
            await invRef.update({
                communityMutedUserIds: admin.firestore.FieldValue.arrayUnion(targetUid),
                [`communityMutedUntil.${targetUid}`]: until,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            return {
                success: true,
                muted: true,
                duration: String(data?.duration || '').toLowerCase(),
                untilMs: until.toMillis(),
            };
        }

        if (action === 'remove_member') {
            await invRef.update({
                [`rsvps.${targetUid}`]: admin.firestore.FieldValue.delete(),
                communityMutedUserIds: admin.firestore.FieldValue.arrayRemove(targetUid),
                [`communityMutedUntil.${targetUid}`]: admin.firestore.FieldValue.delete(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            return { success: true, removed: true };
        }

        // block_member
        await invRef.update({
            [`rsvps.${targetUid}`]: admin.firestore.FieldValue.delete(),
            communityMutedUserIds: admin.firestore.FieldValue.arrayRemove(targetUid),
            [`communityMutedUntil.${targetUid}`]: admin.firestore.FieldValue.delete(),
            communityBlockedUserIds: admin.firestore.FieldValue.arrayUnion(targetUid),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { success: true, blocked: true };
    });
}

module.exports = { registerSocialInvitationMembership };
