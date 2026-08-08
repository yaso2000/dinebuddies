import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
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
import SocialPingOverlay from '../components/social/SocialPingOverlay';
import { playGiftPingSound, playWavePingSound } from '../utils/socialPingSound';

const SocialPingCelebrationContext = createContext(null);

export function useSocialPingCelebration() {
    return useContext(SocialPingCelebrationContext);
}

const AUTO_DISMISS_MS = 4800;

function extractSenderName(notif) {
    return String(
        notif?.fromUserName ||
        notif?.senderName ||
        notif?.metadata?.senderName ||
        ''
    ).trim();
}

function extractSenderId(notif) {
    return String(
        notif?.fromUserId ||
        notif?.senderId ||
        notif?.metadata?.senderId ||
        ''
    ).trim();
}

export function SocialPingCelebrationProvider({ children }) {
    const { currentUser, isGuest } = useAuth();
    const viewerUid = currentUser?.uid || currentUser?.id;

    const [pageVisible, setPageVisible] = useState(
        () => typeof document === 'undefined' || !document.hidden
    );
    const [queue, setQueue] = useState([]);
    const [activePing, setActivePing] = useState(null);
    const shownKeysRef = useRef(new Set());

    const canReceive = Boolean(viewerUid && !isGuest && pageVisible);

    useEffect(() => {
        const onVisibility = () => setPageVisible(!document.hidden);
        document.addEventListener('visibilitychange', onVisibility);
        return () => document.removeEventListener('visibilitychange', onVisibility);
    }, []);

    const enqueuePing = useCallback(
        (ping) => {
            if (!viewerUid || isGuest || !pageVisible) return;
            if (!ping?.key) return;
            if (shownKeysRef.current.has(ping.key)) return;
            shownKeysRef.current.add(ping.key);
            setQueue((prev) => [...prev, ping]);
        },
        [isGuest, pageVisible, viewerUid]
    );

    useEffect(() => {
        if (activePing || queue.length === 0) return;
        const [next, ...rest] = queue;
        setQueue(rest);
        setActivePing(next);
        if (next.type === 'gift') playGiftPingSound();
        else playWavePingSound();
    }, [activePing, queue]);

    useEffect(() => {
        if (!activePing) return undefined;
        const timer = window.setTimeout(() => setActivePing(null), AUTO_DISMISS_MS);
        return () => window.clearTimeout(timer);
    }, [activePing]);

    const dismissPing = useCallback(() => {
        setActivePing(null);
    }, []);

    useEffect(() => {
        if (!viewerUid || isGuest) return undefined;

        let isInitial = true;
        const giftsQ = query(
            collection(db, 'profile_gifts'),
            where('recipientId', '==', viewerUid),
            where('status', '==', 'completed'),
            orderBy('createdAt', 'desc'),
            limit(20)
        );

        const unsubGifts = onSnapshot(
            giftsQ,
            (snapshot) => {
                if (isInitial) {
                    isInitial = false;
                    return;
                }
                snapshot.docChanges().forEach((change) => {
                    if (change.type !== 'added') return;
                    const data = change.doc.data() || {};
                    enqueuePing({
                        key: `gift:${change.doc.id}`,
                        type: 'gift',
                        giftId: data.giftId || null,
                        senderId: data.senderId || null,
                        senderName: data.senderDisplayName || '',
                    });
                });
            },
            (err) => console.warn('[SocialPingCelebration] gifts listener', err)
        );

        return () => unsubGifts();
    }, [enqueuePing, isGuest, viewerUid]);

    useEffect(() => {
        if (!viewerUid || isGuest) return undefined;

        let isInitial = true;
        const inboxQ = query(
            collection(db, 'notifications'),
            where('userId', '==', viewerUid),
            orderBy('createdAt', 'desc'),
            limit(30)
        );

        const unsubNotifs = onSnapshot(
            inboxQ,
            (snapshot) => {
                if (isInitial) {
                    isInitial = false;
                    return;
                }
                snapshot.docChanges().forEach((change) => {
                    if (change.type !== 'added') return;
                    const data = change.doc.data() || {};
                    if (data.type !== 'greeting') return;
                    const senderId = extractSenderId(data);
                    if (senderId === viewerUid) return;
                    enqueuePing({
                        key: `wave:${change.doc.id}`,
                        type: 'wave',
                        senderId,
                        senderName: extractSenderName(data),
                    });
                });
            },
            (err) => console.warn('[SocialPingCelebration] notifications listener', err)
        );

        return () => unsubNotifs();
    }, [enqueuePing, isGuest, viewerUid]);

    const value = useMemo(() => ({ dismissPing }), [dismissPing]);

    return (
        <SocialPingCelebrationContext.Provider value={value}>
            {children}
            <SocialPingOverlay ping={activePing} onDismiss={dismissPing} />
        </SocialPingCelebrationContext.Provider>
    );
}
