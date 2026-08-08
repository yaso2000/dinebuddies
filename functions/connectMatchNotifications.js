/**
 * Server-side connect/match notifications — ensures BOTH members get inbox + celebration triggers.
 */
const functions = require('firebase-functions');

const CONNECT_COPY = {
    dating: {
        title: 'Dating match!',
        message: (name) => `You and ${name} connected for dating`,
    },
    acquaintance: {
        title: 'New acquaintance!',
        message: (name) => `You and ${name} connected`,
    },
    friendship: {
        title: 'New friendship!',
        message: (name) => `You and ${name} became friends`,
    },
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
    { db, admin, resolveConnectionKindFromData, hasConnectConnection }
) {
    async function writeConnectNotification(recipientId, otherId, connectionKind) {
        if (!recipientId || !otherId || recipientId === otherId) return;

        const otherSnap = await db.collection('users').doc(otherId).get();
        const other = otherSnap.exists ? otherSnap.data() : {};
        const name = pickDisplayName(other);
        const avatar = pickAvatar(other);
        const kind = CONNECT_COPY[connectionKind] ? connectionKind : 'acquaintance';
        const copy = CONNECT_COPY[kind];
        const notifType = kind === 'dating' ? 'like' : 'connect';
        const notifId = `connect_${recipientId}_${otherId}_${kind}`;
        const ref = db.collection('notifications').doc(notifId);
        const existing = await ref.get();
        if (existing.exists) return;

        await ref.set({
            userId: recipientId,
            type: notifType,
            title: copy.title,
            message: copy.message(name),
            actionUrl: `/profile/${otherId}`,
            fromUserId: otherId,
            fromUserName: name,
            fromUserAvatar: avatar,
            senderId: otherId,
            senderName: name,
            senderAvatar: avatar,
            metadata: {
                source: 'connect',
                connectionKind: kind,
                mutual: true,
                otherUserId: otherId,
                senderId: otherId,
            },
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            read: false,
        });
    }

    async function notifyBothUsers(userA, userB, connectionKind) {
        await Promise.all([
            writeConnectNotification(userA, userB, connectionKind),
            writeConnectNotification(userB, userA, connectionKind),
        ]);
    }

    exportsObj.onDiscoveryLikeMutual = functions.firestore
        .document('discovery_likes/{likeId}')
        .onWrite(async (change) => {
            const after = change.after.exists ? change.after.data() : null;
            if (!after?.mutual) return null;
            const before = change.before.exists ? change.before.data() : null;
            if (before?.mutual === true) return null;

            const likerId = after.likerId;
            const targetUserId = after.targetUserId;
            if (!likerId || !targetUserId || likerId === targetUserId) return null;

            const [likerSnap, targetSnap] = await Promise.all([
                db.collection('users').doc(likerId).get(),
                db.collection('users').doc(targetUserId).get(),
            ]);
            if (!likerSnap.exists || !targetSnap.exists) return null;

            const kind = resolveConnectionKindFromData(likerSnap.data(), targetSnap.data());
            await notifyBothUsers(likerId, targetUserId, kind);
            return null;
        });

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
                const kind = resolveConnectionKindFromData(viewerData, targetData);
                await notifyBothUsers(uid, targetId, kind);
            }
            return null;
        });
}

module.exports = { registerConnectMatchNotifications };
