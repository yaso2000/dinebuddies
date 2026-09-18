import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { getSafeAvatar } from '../utils/avatarUtils';

async function buildCommunityCard(partnerId, data, businessInfo, lastReadTimestamps, viewerIds) {
    const communityId = partnerId;
    const messagesRef = collection(db, 'communities', communityId, 'messages');
    let lastReadTime = new Date(0);
    const rawLastRead = lastReadTimestamps[communityId] || lastReadTimestamps[partnerId];

    if (rawLastRead) {
        if (typeof rawLastRead.toDate === 'function') {
            lastReadTime = rawLastRead.toDate();
        } else if (rawLastRead instanceof Date) {
            lastReadTime = rawLastRead;
        } else {
            const d = new Date(rawLastRead);
            if (!isNaN(d.getTime())) lastReadTime = d;
        }
    }

    let unreadCount = 0;
    let lastMessage = null;
    let lastMessageTime = null;

    try {
        const messagesSnapshot = await getDocs(messagesRef);
        messagesSnapshot.forEach((msgDoc) => {
            const msgData = msgDoc.data();
            const msgTime = msgData.createdAt?.toDate() || new Date(0);

            if (
                msgTime > lastReadTime &&
                !viewerIds.has(msgData.senderId)
            ) {
                unreadCount += 1;
            }

            if (!lastMessageTime || msgTime > lastMessageTime) {
                lastMessageTime = msgTime;
                lastMessage = msgData.text || msgData.message || '';
            }
        });
    } catch (msgError) {
        console.warn(`Could not fetch messages for ${partnerId}:`, msgError.message);
    }

    return {
        id: communityId,
        name: businessInfo.businessName || data.display_name || data.name || 'Business',
        logo: getSafeAvatar(data),
        cover: businessInfo.coverImage || data.cover_url || data.coverImage,
        type: businessInfo.businessType || data.business_type || 'Restaurant',
        location: businessInfo.city || businessInfo.address || data.city || data.address || '',
        memberCount: businessInfo.communityMemberCount ?? data.communityMembers?.length ?? 0,
        unreadCount,
        lastMessage: lastMessage
            ? lastMessage.length > 40
                ? `${lastMessage.substring(0, 40)}...`
                : lastMessage
            : null,
    };
}

/**
 * Joined business communities with unread counts for the messages hub.
 */
export function useJoinedCommunities() {
    const { currentUser, userProfile } = useAuth();
    const [communities, setCommunities] = useState([]);
    const [loading, setLoading] = useState(true);

    const viewerIds = useMemo(() => {
        const ids = new Set();
        if (userProfile?.id) ids.add(userProfile.id);
        if (currentUser?.uid) ids.add(currentUser.uid);
        return ids;
    }, [userProfile?.id, currentUser?.uid]);

    const fetchCommunities = useCallback(async () => {
        const joinedCommunities = userProfile?.joinedCommunities || [];
        const lastReadTimestamps = userProfile?.communityLastRead || {};

        if (!userProfile || joinedCommunities.length === 0) {
            setCommunities([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const communitiesData = await Promise.all(
                joinedCommunities.map(async (partnerId) => {
                    try {
                        // Public projection only — never the business's users doc.
                        const publicProfileDoc = await getDoc(doc(db, 'public_profiles', partnerId));
                        if (!publicProfileDoc.exists()) return null;

                        const p = publicProfileDoc.data();
                        if (p.profileType !== 'business') return null;

                        const businessPublic = p.businessPublic || {};
                        return buildCommunityCard(
                            partnerId,
                            {
                                display_name: p.displayName || 'Business',
                                name: p.displayName || 'Business',
                                photo_url: p.avatarUrl || '',
                                cover_url: businessPublic.coverImage || '',
                                city: businessPublic.city || '',
                                address: businessPublic.address || '',
                            },
                            {
                                businessName: p.displayName || 'Business',
                                coverImage: businessPublic.coverImage || '',
                                businessType: businessPublic.businessType || 'Restaurant',
                                city: businessPublic.city || '',
                                address: businessPublic.address || '',
                                communityMemberCount: businessPublic.communityMemberCount || 0,
                            },
                            lastReadTimestamps,
                            viewerIds
                        );
                    } catch (innerError) {
                        console.error(`Error fetching community ${partnerId}:`, innerError);
                        return null;
                    }
                })
            );

            setCommunities(communitiesData.filter(Boolean));
        } catch (error) {
            console.error('Error fetching communities:', error);
            setCommunities([]);
        } finally {
            setLoading(false);
        }
    }, [userProfile, viewerIds]);

    useEffect(() => {
        if (userProfile && (userProfile.id || currentUser?.uid)) {
            fetchCommunities();
        } else if (userProfile !== undefined && !userProfile) {
            setCommunities([]);
            setLoading(false);
        }
    }, [
        userProfile?.joinedCommunities,
        userProfile?.communityLastRead,
        userProfile?.id,
        currentUser?.uid,
        fetchCommunities,
    ]);

    const totalUnread = useMemo(
        () => communities.reduce((sum, c) => sum + (c.unreadCount || 0), 0),
        [communities]
    );

    const removeCommunity = useCallback((communityId) => {
        setCommunities((prev) => prev.filter((c) => c.id !== communityId));
    }, []);

    return { communities, loading, totalUnread, refetch: fetchCommunities, removeCommunity };
}
