import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePendingInvitesForMe } from '../../hooks/usePendingInvitesForMe';
import {
    hasInviteLandingBeenConsumed,
    isInviteLandingEligible,
    markInviteLandingConsumed,
    markInviteLandingIneligible,
} from '../../utils/inviteLandingSession';
import {
    isInviteLandingEntryRoute,
    shouldDisqualifyInviteLandingForSession,
} from '../../utils/inviteLanding';

/**
 * Pending invite cards: once per browser session, only while the user is still on
 * the app entry feed (/ or /posts-feed) before opening messages, chat, etc.
 */
export default function InviteLandingGate() {
    const navigate = useNavigate();
    const location = useLocation();
    const { pending, synced, canLoad, viewerUid } = usePendingInvitesForMe();

    useEffect(() => {
        if (!synced || !canLoad || !viewerUid) return;

        const path = location.pathname;

        if (shouldDisqualifyInviteLandingForSession(path)) {
            markInviteLandingIneligible(viewerUid);
            return;
        }

        if (!isInviteLandingEntryRoute(path)) return;
        if (!isInviteLandingEligible(viewerUid)) return;
        if (hasInviteLandingBeenConsumed(viewerUid)) return;
        if (pending.length === 0) return;

        markInviteLandingConsumed(viewerUid);
        navigate('/invite/received', { replace: true });
    }, [synced, canLoad, viewerUid, pending.length, location.pathname, navigate]);

    return null;
}
