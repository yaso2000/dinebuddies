import { useMemo } from 'react';
import { useNotifications } from '../context/NotificationContext';
import { usePendingInvitesForMe } from './usePendingInvitesForMe';
import { isInboxActivityNotification } from '../utils/inboxFormat';

/** Unread counts for discovery inbox (/search/inbox). */
export function useInboxHubBadges() {
    const { notifications } = useNotifications();
    const { pending, synced } = usePendingInvitesForMe();

    return useMemo(() => {
        const activityUnread = notifications.filter(
            (n) => !n.read && isInboxActivityNotification(n)
        ).length;
        const inviteCount = synced ? pending.length : 0;
        return {
            activityUnread,
            inviteCount,
            hubBadge: activityUnread + inviteCount,
        };
    }, [notifications, pending.length, synced]);
}
