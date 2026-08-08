import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { findStaleSocialInvitationNotificationIds } from '../utils/staleInvitationNotifications';

/**
 * Removes social invite notifications only when the invite doc is gone or the viewer
 * has no access. Accepted/declined invites are kept so details links still work.
 */
export default function useStaleInvitationNotificationCleanup() {
    const { currentUser, isGuest } = useAuth();
    const { notifications, loading, deleteNotification } = useNotifications();
    const cleanedIdsRef = useRef(new Set());
    const uid = currentUser?.uid || currentUser?.id;

    useEffect(() => {
        if (loading || !uid || isGuest) return;
        if (!notifications?.length) return;

        let cancelled = false;

        (async () => {
            const stale = await findStaleSocialInvitationNotificationIds(notifications, uid);
            const toDelete = stale.filter(({ id }) => id && !cleanedIdsRef.current.has(id));
            if (cancelled || toDelete.length === 0) return;

            await Promise.all(
                toDelete.map(({ id, collection }) => {
                    cleanedIdsRef.current.add(id);
                    return deleteNotification(id, collection).catch(() => {});
                })
            );
        })();

        return () => {
            cancelled = true;
        };
    }, [loading, uid, isGuest, notifications, deleteNotification]);
}
