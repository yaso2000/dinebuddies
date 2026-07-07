/**
 * Trusted follow / unfollow — Admin SDK writes (bypasses fragile client rules).
 */
const functions = require('firebase-functions');
const { FieldValue } = require('firebase-admin/firestore');

const CONNECTION_REFOLLOW_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const COOLDOWN_COL = 'connection_action_cooldowns';

function cooldownDocId(viewerId, targetId) {
    return `${viewerId}_${targetId}`;
}

function timestampToMs(value) {
    if (!value) return null;
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (typeof value === 'number') return value;
    if (typeof value.seconds === 'number') return value.seconds * 1000;
    return null;
}

function normalizeFollowing(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.filter((id) => typeof id === 'string' && id.length > 0);
}

function canTargetAcceptFollows(targetData) {
    if (!targetData || typeof targetData !== 'object') return false;
    const role = String(targetData.role || 'user').toLowerCase();
    if (role === 'business' || role === 'partner' || targetData.isBusiness === true) return false;
    return targetData.privacySettings?.allowFollowing !== false;
}

function registerSetUserFollow(exportsObj, { db, isBusinessUserDoc, enforceCallableRateLimit }) {
    exportsObj.setUserFollow = functions.https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
        }

        const viewerUid = context.auth.uid;
        const targetUserId = typeof data?.targetUserId === 'string' ? data.targetUserId.trim() : '';
        const action = data?.action === 'unfollow' ? 'unfollow' : 'follow';

        if (!targetUserId || targetUserId === viewerUid) {
            throw new functions.https.HttpsError('invalid-argument', 'Invalid targetUserId.');
        }

        await enforceCallableRateLimit(viewerUid, 'set_user_follow', {
            perMinute: 60,
            perHour: 600,
            perDay: 3000,
            cooldownMs: 0,
        });

        const viewerRef = db.collection('users').doc(viewerUid);
        const targetRef = db.collection('users').doc(targetUserId);
        const cooldownRef = db.collection(COOLDOWN_COL).doc(cooldownDocId(viewerUid, targetUserId));

        try {
            return await db.runTransaction(async (tx) => {
                const [viewerSnap, targetSnap, cooldownSnap] = await Promise.all([
                    tx.get(viewerRef),
                    tx.get(targetRef),
                    tx.get(cooldownRef),
                ]);

                if (!viewerSnap.exists) {
                    throw new functions.https.HttpsError(
                        'failed-precondition',
                        'Viewer profile not found.',
                        { reason: 'viewer_not_found' }
                    );
                }
                if (!targetSnap.exists) {
                    throw new functions.https.HttpsError(
                        'not-found',
                        'Target user not found.',
                        { reason: 'target_not_found' }
                    );
                }

                const viewerData = viewerSnap.data() || {};
                const targetData = targetSnap.data() || {};

                if (isBusinessUserDoc(viewerData)) {
                    throw new functions.https.HttpsError(
                        'failed-precondition',
                        'Business accounts cannot follow.',
                        { reason: 'viewer_business' }
                    );
                }
                if (!canTargetAcceptFollows(targetData)) {
                    const reason = isBusinessUserDoc(targetData) ? 'target_business' : 'privacy';
                    throw new functions.https.HttpsError(
                        'failed-precondition',
                        'Cannot follow this account.',
                        { reason }
                    );
                }

                const following = normalizeFollowing(viewerData.following);
                const alreadyFollowing = following.includes(targetUserId);

                if (action === 'follow') {
                    if (alreadyFollowing) {
                        return { ok: true, already: true, following: true };
                    }

                    const cancelledAtMs = timestampToMs(cooldownSnap.data()?.followCancelledAt);
                    if (cancelledAtMs) {
                        const retryAtMs = cancelledAtMs + CONNECTION_REFOLLOW_COOLDOWN_MS;
                        if (Date.now() < retryAtMs) {
                            throw new functions.https.HttpsError('failed-precondition', 'cooldown', {
                                reason: 'cooldown',
                                cancelledAtMs,
                                retryAtMs,
                            });
                        }
                    }

                    tx.update(viewerRef, { following: [...following, targetUserId] });

                    const currentCount = Number(targetData.followersCount);
                    const safeCount =
                        Number.isFinite(currentCount) && currentCount >= 0 ? Math.floor(currentCount) : 0;
                    tx.update(targetRef, { followersCount: safeCount + 1 });

                    if (cooldownSnap.exists) {
                        tx.set(
                            cooldownRef,
                            {
                                followCancelledAt: FieldValue.delete(),
                                updatedAt: FieldValue.serverTimestamp(),
                            },
                            { merge: true }
                        );
                    }

                    const targetFollowing = normalizeFollowing(targetData.following);
                    return {
                        ok: true,
                        following: true,
                        mutualFollow: targetFollowing.includes(viewerUid),
                    };
                }

                if (!alreadyFollowing) {
                    return { ok: true, already: true, following: false };
                }

                tx.update(viewerRef, {
                    following: following.filter((id) => id !== targetUserId),
                });

                const currentCount = Number(targetData.followersCount);
                const safeCount =
                    Number.isFinite(currentCount) && currentCount >= 0 ? Math.floor(currentCount) : 0;
                tx.update(targetRef, { followersCount: Math.max(0, safeCount - 1) });

                tx.set(
                    cooldownRef,
                    {
                        viewerId: viewerUid,
                        targetId: targetUserId,
                        followCancelledAt: FieldValue.serverTimestamp(),
                        updatedAt: FieldValue.serverTimestamp(),
                    },
                    { merge: true }
                );

                return { ok: true, following: false };
            });
        } catch (err) {
            if (err instanceof functions.https.HttpsError) throw err;
            functions.logger.error('[setUserFollow]', { viewerUid, targetUserId, action, err });
            throw new functions.https.HttpsError('internal', 'Follow action failed.');
        }
    });
}

module.exports = { registerSetUserFollow };
