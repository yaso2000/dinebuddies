/**
 * Server-side connect/match notifications — ensures BOTH members get inbox + celebration triggers.
 */
const functions = require('firebase-functions');

// Dating and the person-"like" are removed — a mutual Follow is the only connection.
const FRIENDSHIP_COPY = {
    title: 'New friendship!',
    message: (name) => `You and ${name} became friends`,
};

function pickDisplayName(data) {
    if (!data || typeof data !== 'object') return 'Someone';
    return (
        String(data.display_name || data.displayName || data.name || '').trim() || 'Someone'
    );
}

function pickAvatar(data) {
    if (!data || typeof data !== 'object') return null;
    return (
        data.avatar ||
        data.photo_url ||
        data.photoURL ||
        data.profilePicture ||
        data.userPhoto ||
        null
    );
}

function registerConnectMatchNotifications(
    exportsObj,
    { db, admin, hasConnectConnection }
) {
    async function writeConnectNotification(recipientId, otherId) {
        if (!recipientId || !otherId || recipientId === otherId) return;

        const otherSnap = await db.collection('users').doc(otherId).get();
        const other = otherSnap.exists ? otherSnap.data() : {};
        const name = pickDisplayName(other);
        const avatar = pickAvatar(other);
        const notifId = `connect_${recipientId}_${otherId}_friendship`;
        const ref = db.collection('notifications').doc(notifId);
        const existing = await ref.get();
        if (existing.exists) return;

        await ref.set({
            userId: recipientId,
            type: 'connect',
            title: FRIENDSHIP_COPY.title,
            message: FRIENDSHIP_COPY.message(name),
            actionUrl: `/profile/${otherId}`,
            fromUserId: otherId,
            fromUserName: name,
            fromUserAvatar: avatar,
            senderId: otherId,
            senderName: name,
            senderAvatar: avatar,
            metadata: {
                source: 'connect',
                connectionKind: 'friendship',
                mutual: true,
                otherUserId: otherId,
                senderId: otherId,
            },
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            read: false,
        });
    }

    async function notifyBothUsers(userA, userB) {
        await Promise.all([
            writeConnectNotification(userA, userB),
            writeConnectNotification(userB, userA),
        ]);
    }

    // A mutual Follow is the only connection now, so celebrate friendships when a new
    // follow completes a mutual pair. (The legacy discovery_likes trigger is removed.)
    exportsObj.onUserFollowingConnect = functions.firestore
        .document('users/{uid}')
        .onUpdate(async (change) => {
            const beforeFollowing = Array.isArray(change.before.data()?.following)
                ? change.before.data().following
                : [];
            const afterFollowing = Array.isArray(change.after.data()?.following)
                ? change.after.data().following
                : [];
            const newFollows = afterFollowing.filter((id) => !beforeFollowing.includes(id));
            if (newFollows.length === 0) return null;

            const uid = change.after.id;
            const viewerData = change.after.data() || {};

            for (const targetId of newFollows) {
                if (!targetId || targetId === uid) continue;
                const targetSnap = await db.collection('users').doc(targetId).get();
                if (!targetSnap.exists) continue;
                const targetData = targetSnap.data() || {};
                const connected = await hasConnectConnection(uid, targetId, viewerData, targetData);
                if (!connected) continue;
                await notifyBothUsers(uid, targetId);
            }
            return null;
        });
}

module.exports = { registerConnectMatchNotifications };
