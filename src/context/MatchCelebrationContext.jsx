import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import {
    collection,
    limit,
    onSnapshot,
    orderBy,
    query,
    where,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from './AuthContext';
import { useInvitations } from './InvitationContext';
import MatchCelebrationOverlay from '../components/match/MatchCelebrationOverlay';
import { playMatchCelebrationSound } from '../utils/matchCelebrationSound';

const MatchCelebrationContext = createContext(null);

export function useMatchCelebration() {
    const ctx = useContext(MatchCelebrationContext);
    if (!ctx) {
        throw new Error('useMatchCelebration must be used within MatchCelebrationProvider');
    }
    return ctx;
}

function extractOtherFromNotification(notif) {
    let id =
        notif?.metadata?.otherUserId ||
        notif?.metadata?.likerId ||
        notif?.metadata?.senderId ||
        notif?.fromUserId ||
        notif?.senderId ||
        '';

    if (!id && notif?.actionUrl) {
        const match = String(notif.actionUrl).match(/\/profile\/([^/?#]+)/);
        if (match?.[1]) id = match[1];
    }

    const name = String(notif?.fromUserName || notif?.senderName || '').trim();
    const avatar = String(notif?.fromUserAvatar || notif?.senderAvatar || '').trim();

    return {
        id: String(id || '').trim(),
        display_name: name,
        name,
        avatar,
        photo_url: avatar,
    };
}

function isConnectCelebrationNotification(notif) {
    if (!notif) return false;
    if (notif.metadata?.mutual !== true) return false;
    const kind = notif.metadata?.connectionKind;
    if (kind === 'dating' || kind === 'acquaintance' || kind === 'friendship') return true;
    if (notif.type === 'connect') return true;
    return notif.type === 'like' && notif.metadata?.source === 'connect';
}

export function MatchCelebrationProvider({ children }) {
    const navigate = useNavigate();
    const { currentUser, userProfile, isGuest } = useAuth();
    const { currentUser: invitationUser } = useInvitations();
    const [celebration, setCelebration] = useState(null);
    const [matchedUserIds, setMatchedUserIds] = useState(() => new Set());
    const shownKeysRef = useRef(new Set());

    const viewerUid = currentUser?.uid || currentUser?.id;

    const selfUser = useMemo(
        () => ({ ...userProfile, ...invitationUser, ...currentUser }),
        [currentUser, invitationUser, userProfile]
    );

    const celebrateMatch = useCallback(
        ({ type, otherUser, otherId, otherName, playSound = true }) => {
            const id = otherId || otherUser?.id;
            if (!id || !type) return false;

            const key = `${type}:${id}`;
            if (shownKeysRef.current.has(key)) return false;
            shownKeysRef.current.add(key);

            setMatchedUserIds((prev) => {
                if (prev.has(id)) return prev;
                const next = new Set(prev);
                next.add(id);
                return next;
            });

            setCelebration({
                type,
                otherUser: otherUser || { id, name: otherName, display_name: otherName },
                otherName:
                    otherName ||
                    otherUser?.display_name ||
                    otherUser?.displayName ||
                    otherUser?.name ||
                    '',
                otherId: id,
            });

            if (playSound) playMatchCelebrationSound();
            return true;
        },
        []
    );

    const dismissCelebration = useCallback(() => {
        setCelebration(null);
    }, []);

    const handleIncomingNotification = useCallback(
        (notif) => {
            if (!notif) return;

            const isConnectCelebration = isConnectCelebrationNotification(notif);
            if (!isConnectCelebration && notif.read) return;

            const other = extractOtherFromNotification(notif);
            if (!other.id || other.id === viewerUid) return;

            const connectionKind = notif.metadata?.connectionKind;
            if (
                connectionKind === 'dating' ||
                connectionKind === 'acquaintance' ||
                connectionKind === 'friendship'
            ) {
                celebrateMatch({
                    type: connectionKind,
                    otherUser: other,
                    otherId: other.id,
                    otherName: other.name,
                });
                return;
            }

            if (notif.type === 'connect' && notif.metadata?.mutual === true) {
                celebrateMatch({
                    type: 'acquaintance',
                    otherUser: other,
                    otherId: other.id,
                    otherName: other.name,
                });
                return;
            }

            if (notif.type === 'like' && notif.metadata?.mutual === true) {
                celebrateMatch({
                    type: 'dating',
                    otherUser: other,
                    otherId: other.id,
                    otherName: other.name,
                });
            }
        },
        [celebrateMatch, viewerUid]
    );

    useEffect(() => {
        if (!viewerUid || isGuest) return undefined;

        let isInitial = true;
        const inboxQ = query(
            collection(db, 'notifications'),
            where('userId', '==', viewerUid),
            orderBy('createdAt', 'desc'),
            limit(30)
        );

        const unsub = onSnapshot(
            inboxQ,
            (snapshot) => {
                if (isInitial) {
                    isInitial = false;
                    return;
                }
                snapshot.docChanges().forEach((change) => {
                    if (change.type !== 'added') return;
                    handleIncomingNotification({
                        id: change.doc.id,
                        ...change.doc.data(),
                    });
                });
            },
            (err) => {
                console.warn('[MatchCelebrationProvider] notifications listener', err);
            }
        );

        return unsub;
    }, [viewerUid, isGuest, handleIncomingNotification]);

    const value = useMemo(
        () => ({ celebrateMatch, dismissCelebration, matchedUserIds }),
        [celebrateMatch, dismissCelebration, matchedUserIds]
    );

    return (
        <MatchCelebrationContext.Provider value={value}>
            {children}
            <MatchCelebrationOverlay
                open={Boolean(celebration)}
                type={celebration?.type || 'like'}
                selfUser={selfUser}
                otherUser={celebration?.otherUser}
                otherName={celebration?.otherName || ''}
                onChat={() => {
                    if (celebration?.otherId) navigate(`/chat/${celebration.otherId}`);
                }}
                onClose={dismissCelebration}
            />
        </MatchCelebrationContext.Provider>
    );
}
