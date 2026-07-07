import { useCallback, useEffect, useState } from 'react';
import {
    markInviteInboxDismissed,
    subscribeInviteInboxDismissals,
} from '../utils/inviteInboxDismissals';

/**
 * Firestore-backed set of invitation ids the user dismissed from the invite card UI.
 */
export function useInviteInboxDismissals(viewerUid) {
    const [dismissedIds, setDismissedIds] = useState(() => new Set());

    useEffect(() => {
        if (!viewerUid) {
            setDismissedIds(new Set());
            return undefined;
        }
        return subscribeInviteInboxDismissals(viewerUid, setDismissedIds);
    }, [viewerUid]);

    const markDismissed = useCallback(
        async (invitationId, reason = 'viewed') => {
            if (!viewerUid || !invitationId) return;
            setDismissedIds((prev) => {
                const next = new Set(prev);
                next.add(String(invitationId));
                return next;
            });
            try {
                await markInviteInboxDismissed(viewerUid, invitationId, reason);
            } catch (err) {
                console.error('[useInviteInboxDismissals] mark failed', err);
                setDismissedIds((prev) => {
                    if (!prev.has(String(invitationId))) return prev;
                    const next = new Set(prev);
                    next.delete(String(invitationId));
                    return next;
                });
                throw err;
            }
        },
        [viewerUid]
    );

    return { dismissedIds, markDismissed };
}
