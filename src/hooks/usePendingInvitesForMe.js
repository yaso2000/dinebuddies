import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { isBusinessUser } from '../utils/accountRole';
import {
    clearInviteLandingSession,
    markInviteLandingConsumed,
} from '../utils/inviteLandingSession';
import {
    isPendingInviteForUser,
    sortInvitesOldestFirst,
    uidStr,
} from '../utils/inviteLanding';
import { useInviteInboxDismissals } from './useInviteInboxDismissals';

const HOSTED_INVITE_COLLECTIONS = ['social_invitations', 'private_invitations'];

function isPublishedInviteDoc(inv) {
    if (!inv) return false;
    if (inv.status === 'published') return true;
    return Boolean(inv.publishedAt);
}

/** When the same id exists in both collections, keep the published copy. */
export function mergeHostedInviteRows(rows) {
    const byId = new Map();
    for (const inv of rows) {
        if (!inv?.id) continue;
        const prev = byId.get(inv.id);
        if (!prev) {
            byId.set(inv.id, inv);
            continue;
        }
        const prevPub = isPublishedInviteDoc(prev);
        const nextPub = isPublishedInviteDoc(inv);
        if (nextPub && !prevPub) {
            byId.set(inv.id, inv);
        } else if (nextPub === prevPub && inv._collection === 'social_invitations') {
            byId.set(inv.id, inv);
        }
    }
    return [...byId.values()];
}

function pendingInviteIdsKey(rows) {
    return rows.map((r) => r.id).join(',');
}

/**
 * Live list of published private/dating invites awaiting this user's RSVP.
 */
export function usePendingInvitesForMe() {
    const { currentUser, isGuest, userProfile, loading } = useAuth();

    const viewerUid = uidStr(currentUser?.uid || currentUser?.id);

    const canLoad = Boolean(
        viewerUid &&
        !isGuest &&
        !loading &&
        currentUser &&
        !(userProfile && isBusinessUser(userProfile))
    );

    const [invites, setInvites] = useState([]);
    const [synced, setSynced] = useState(false);
    const lastKeyRef = useRef('');

    const { dismissedIds } = useInviteInboxDismissals(canLoad ? viewerUid : '');

    useEffect(() => {
        if (!canLoad) {
            setInvites([]);
            setSynced(false);
            lastKeyRef.current = '';
            return undefined;
        }

        let cancelled = false;
        const unsubs = [];
        const rowsByCollection = {
            social_invitations: [],
            private_invitations: [],
        };
        const collectionReady = {
            social_invitations: false,
            private_invitations: false,
        };

        const publishMerged = () => {
            if (cancelled) return;
            if (!collectionReady.social_invitations || !collectionReady.private_invitations) {
                return;
            }
            const merged = mergeHostedInviteRows([
                ...rowsByCollection.social_invitations,
                ...rowsByCollection.private_invitations,
            ])
                .filter((inv) => isPendingInviteForUser(inv, viewerUid))
                .sort(sortInvitesOldestFirst);

            const key = pendingInviteIdsKey(merged);
            if (key !== lastKeyRef.current) {
                lastKeyRef.current = key;
                setInvites(merged);
            }
            setSynced(true);
        };

        auth.authStateReady().then(() => {
            if (cancelled) return;

            for (const coll of HOSTED_INVITE_COLLECTIONS) {
                const q = query(
                    collection(db, coll),
                    where('invitedFriends', 'array-contains', viewerUid)
                );
                const unsub = onSnapshot(
                    q,
                    (snap) => {
                        rowsByCollection[coll] = snap.docs.map((d) => ({
                            id: d.id,
                            ...d.data(),
                            _collection: coll,
                        }));
                        collectionReady[coll] = true;
                        publishMerged();
                    },
                    (error) => {
                        console.error(`Pending invites sync (${coll}):`, error);
                        collectionReady[coll] = true;
                        publishMerged();
                    }
                );
                unsubs.push(unsub);
            }
        });

        return () => {
            cancelled = true;
            unsubs.forEach((u) => u());
        };
    }, [canLoad, viewerUid]);

    const pending = useMemo(
        () => invites.filter((inv) => !dismissedIds.has(inv.id)),
        [invites, dismissedIds]
    );

    return { pending, synced, canLoad, viewerUid, dismissedIds };
}

function currentViewerUid() {
    return uidStr(auth.currentUser?.uid || auth.currentUser?.id);
}

/** After viewing or skipping invite cards — never show again this session. */
export function dismissInviteLandingSession() {
    const uid = currentViewerUid();
    if (uid) markInviteLandingConsumed(uid);
}

/** Cleared on logout in AuthContext. */
export function resetInviteLandingSession() {
    const uid = currentViewerUid();
    if (uid) clearInviteLandingSession(uid);
}

export function markInviteLandingAttempted() {
    dismissInviteLandingSession();
}

export { clearInviteLandingSession, markInviteLandingConsumed };
