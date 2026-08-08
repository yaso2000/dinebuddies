import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useInvitations } from '../../context/InvitationContext';
import { usePendingInvitesForMe } from '../../hooks/usePendingInvitesForMe';
import { shouldSuppressInvitationInbox } from '../../utils/invitationInboxQueue';
import InvitationInboxOverlay from './InvitationInboxOverlay';

/**
 * While the app is open: show the invite card overlay when a new pending invite arrives
 * (recipient is online / listening). Cold start uses InviteLandingGate → /invite/received.
 */
export default function InviteInboxLiveGate() {
    const location = useLocation();
    const { pending, synced, canLoad, viewerUid } = usePendingInvitesForMe();
    const { respondToPrivateInvitation } = useInvitations() || {};
    const [liveOpen, setLiveOpen] = useState(false);
    const bootstrappedRef = useRef(false);
    const prevIdsRef = useRef(new Set());

    useEffect(() => {
        if (!synced || !canLoad) return;

        const ids = new Set(pending.map((p) => p.id));

        if (!bootstrappedRef.current) {
            bootstrappedRef.current = true;
            prevIdsRef.current = ids;
            return;
        }

        let hasNew = false;
        for (const id of ids) {
            if (!prevIdsRef.current.has(id)) hasNew = true;
        }
        prevIdsRef.current = ids;

        if (hasNew && document.visibilityState === 'visible') {
            setLiveOpen(true);
        }
    }, [pending, synced, canLoad]);

    useEffect(() => {
        if (pending.length === 0) setLiveOpen(false);
    }, [pending.length]);

    useEffect(() => {
        if (shouldSuppressInvitationInbox(location.pathname)) {
            setLiveOpen(false);
        }
    }, [location.pathname]);

    const suppressed =
        !liveOpen ||
        !canLoad ||
        pending.length === 0 ||
        shouldSuppressInvitationInbox(location.pathname);

    if (suppressed) return null;

    return (
        <InvitationInboxOverlay
            invitations={pending}
            viewerUid={viewerUid}
            pathname={location.pathname}
            enabled
            onRespond={respondToPrivateInvitation}
        />
    );
}
