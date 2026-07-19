import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app, { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { getSafeAvatar } from '../utils/avatarUtils';
import { getUserPresence } from './usePresence';

async function countOnlineMembers(memberIds = []) {
    const ids = [...new Set((memberIds || []).filter(Boolean))].slice(0, 40);
    if (ids.length === 0) return 0;
    const results = await Promise.all(ids.map((uid) => getUserPresence(uid)));
    return results.filter((p) => p?.online === true).length;
}

function toDate(value) {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate();
    if (value instanceof Date) return value;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

function isStageExpired(stageData, now = new Date()) {
    const status = stageData.status || 'active';
    if (status === 'ended' || status === 'expired') return true;
    const expiresAt = toDate(stageData.expiresAt);
    if (expiresAt && expiresAt.getTime() <= now.getTime()) return true;
    const createdAt = toDate(stageData.createdAt);
    if (!expiresAt && createdAt) {
        const ttlMs = 24 * 60 * 60 * 1000;
        if (createdAt.getTime() + ttlMs <= now.getTime()) return true;
    }
    return false;
}

function joinedStagesKey(joinedStages) {
    if (!Array.isArray(joinedStages) || joinedStages.length === 0) return '';
    return [...joinedStages].map(String).sort().join('|');
}

async function buildStageCard(stageId, stageData, hostData, lastReadTimestamps, viewerIds, viewerUid) {
    const messagesRef = collection(db, 'stages', stageId, 'messages');
    let lastReadTime = new Date(0);
    const rawLastRead = lastReadTimestamps[stageId];
    const parsed = toDate(rawLastRead);
    if (parsed) lastReadTime = parsed;

    let unreadCount = 0;
    let lastMessage = null;
    let lastMessageTime = null;

    try {
        // Recent messages only — full collection scans froze the Stages hub.
        const recentSnap = await getDocs(
            query(messagesRef, orderBy('createdAt', 'desc'), limit(40))
        );
        recentSnap.forEach((msgDoc) => {
            const msgData = msgDoc.data();
            const msgTime = msgData.createdAt?.toDate() || new Date(0);

            if (msgTime > lastReadTime && !viewerIds.has(msgData.senderId)) {
                unreadCount += 1;
            }

            if (!lastMessageTime || msgTime > lastMessageTime) {
                lastMessageTime = msgTime;
                lastMessage = msgData.text || msgData.message || '';
            }
        });
    } catch (msgError) {
        // Fallback without orderBy if index is missing.
        try {
            const messagesSnapshot = await getDocs(query(messagesRef, limit(40)));
            messagesSnapshot.forEach((msgDoc) => {
                const msgData = msgDoc.data();
                const msgTime = msgData.createdAt?.toDate() || new Date(0);
                if (msgTime > lastReadTime && !viewerIds.has(msgData.senderId)) {
                    unreadCount += 1;
                }
                if (!lastMessageTime || msgTime > lastMessageTime) {
                    lastMessageTime = msgTime;
                    lastMessage = msgData.text || msgData.message || '';
                }
            });
        } catch (fallbackErr) {
            console.warn(`Could not fetch stage messages for ${stageId}:`, fallbackErr.message);
        }
    }

    const memberIds = Array.isArray(stageData.memberIds)
        ? stageData.memberIds
        : Array.isArray(stageData.communityMembers)
          ? stageData.communityMembers
          : [];

    const hostId = stageData.hostId || stageData.ownerId || null;
    const name =
        stageData.title ||
        hostData?.display_name ||
        hostData?.displayName ||
        hostData?.name ||
        'Stage';

    let onlineCount = 0;
    try {
        onlineCount = await countOnlineMembers(memberIds);
    } catch (presenceError) {
        console.warn(`Could not read stage presence for ${stageId}:`, presenceError?.message);
    }

    return {
        id: stageId,
        kind: 'stage',
        name,
        logo: getSafeAvatar(hostData || stageData),
        memberCount: memberIds.length,
        onlineCount,
        unreadCount,
        status: stageData.status || 'active',
        hostId,
        isHost: Boolean(viewerUid && hostId && viewerUid === hostId),
        expiresAt: toDate(stageData.expiresAt),
        lastMessage: lastMessage
            ? lastMessage.length > 40
                ? `${lastMessage.substring(0, 40)}...`
                : lastMessage
            : null,
    };
}

/**
 * Joined consumer Stage rooms for the messages hub (active + soft-closed, not expired).
 */
export function useJoinedStages() {
    const { currentUser, userProfile } = useAuth();
    const [stages, setStages] = useState([]);
    const [loading, setLoading] = useState(true);
    const fetchGenRef = useRef(0);

    const viewerUid = currentUser?.uid || userProfile?.id || null;
    const joinedKey = joinedStagesKey(userProfile?.joinedStages);
    const stageLastReadRef = useRef(userProfile?.stageLastRead || {});
    stageLastReadRef.current = userProfile?.stageLastRead || {};

    const viewerIds = useMemo(() => {
        const ids = new Set();
        if (userProfile?.id) ids.add(userProfile.id);
        if (currentUser?.uid) ids.add(currentUser.uid);
        return ids;
    }, [userProfile?.id, currentUser?.uid]);

    const fetchStages = useCallback(async () => {
        const joinedStages = joinedKey ? joinedKey.split('|') : [];
        const lastReadTimestamps = stageLastReadRef.current;

        if (!viewerUid || joinedStages.length === 0) {
            setStages([]);
            setLoading(false);
            return;
        }

        const gen = ++fetchGenRef.current;
        setLoading(true);
        const now = new Date();
        try {
            const rows = await Promise.all(
                joinedStages.map(async (stageId) => {
                    try {
                        const stageSnap = await getDoc(doc(db, 'stages', stageId));
                        if (!stageSnap.exists()) return null;
                        const stageData = stageSnap.data() || {};
                        if (isStageExpired(stageData, now)) return null;

                        const hostId = stageData.hostId || stageData.ownerId;
                        let hostData = null;
                        if (hostId) {
                            const hostSnap = await getDoc(doc(db, 'users', hostId));
                            if (hostSnap.exists()) hostData = hostSnap.data();
                        }

                        return buildStageCard(
                            stageId,
                            stageData,
                            hostData,
                            lastReadTimestamps,
                            viewerIds,
                            viewerUid
                        );
                    } catch (innerError) {
                        console.error(`Error fetching stage ${stageId}:`, innerError);
                        return null;
                    }
                })
            );
            if (gen !== fetchGenRef.current) return;
            setStages(rows.filter(Boolean));
        } catch (error) {
            console.error('Error fetching stages:', error);
            if (gen === fetchGenRef.current) setStages([]);
        } finally {
            if (gen === fetchGenRef.current) setLoading(false);
        }
    }, [joinedKey, viewerIds, viewerUid]);

    useEffect(() => {
        if (!viewerUid) {
            setStages([]);
            setLoading(false);
            return;
        }
        void fetchStages();
    }, [viewerUid, joinedKey, fetchStages]);

    const totalUnread = useMemo(
        () => stages.reduce((sum, s) => sum + (s.unreadCount || 0), 0),
        [stages]
    );

    const activeCount = stages.length;

    const removeStage = useCallback((stageId) => {
        setStages((prev) => prev.filter((s) => s.id !== stageId));
    }, []);

    const leaveStage = useCallback(
        async (stageId) => {
            const functions = getFunctions(app, 'us-central1');
            const setStageMembership = httpsCallable(functions, 'setStageMembership');
            await setStageMembership({ stageId, action: 'leave' });
            removeStage(stageId);
            return true;
        },
        [removeStage]
    );

    return {
        stages,
        loading,
        totalUnread,
        activeCount,
        refetch: fetchStages,
        removeStage,
        leaveStage,
    };
}
