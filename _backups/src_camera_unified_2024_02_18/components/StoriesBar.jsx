import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import StoryCircle from './StoryCircle';
import { FaPlus, FaCamera } from 'react-icons/fa';

const StoriesBar = ({ onStoryClick }) => {
    const navigate = useNavigate();
    const { currentUser, userProfile } = useAuth();
    const [stories, setStories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [myStoryData, setMyStoryData] = useState(null);

    // Robust user photo retrieval
    const userPhoto = userProfile?.businessInfo?.logoImage ||
        userProfile?.businessInfo?.logo ||
        userProfile?.avatar ||
        userProfile?.photoURL ||
        userProfile?.photo_url ||
        userProfile?.profilePicture ||
        currentUser?.photoURL;

    useEffect(() => {
        if (!currentUser) {
            setLoading(false);
            return;
        }

        const now = new Date();

        // Real-time listener for stories
        const q = query(collection(db, 'stories'));

        const unsubscribe = onSnapshot(q, async (snapshot) => {
            try {
                // Filter and sort client-side
                const activeStories = snapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter(story => {
                        // Check if expired
                        const expiresAt = story.expiresAt;
                        if (expiresAt) {
                            const expiryDate = expiresAt.toDate ? expiresAt.toDate() : new Date(expiresAt);
                            // Compare timestamps for accuracy
                            if (expiryDate.getTime() <= Date.now()) return false;
                        }
                        return true;
                    });

                // Separate My Stories vs Others
                const myStories = [];
                const userStoriesMap = {};

                activeStories.forEach(story => {
                    // ROBUST ID CHECK: Check all possible field names
                    const storyOwnerId = story.userId || story.uid || story.authorId || story.author?.id;

                    // If no ID found, we can't attribute it. Skip it.
                    if (!storyOwnerId) return;

                    // Check if it's my story (String comparison for safety)
                    if (String(storyOwnerId) === String(currentUser.uid)) {
                        myStories.push(story);
                        return; // Don't add to general map
                    }

                    if (!userStoriesMap[storyOwnerId]) {
                        userStoriesMap[storyOwnerId] = {
                            userId: storyOwnerId,
                            partnerName: story.userName || story.author?.name, // Can be undefined/null initially
                            partnerLogo: story.userPhoto || story.author?.avatar || null,
                            stories: [],
                            hasNewActiveStory: false
                        };
                    }

                    userStoriesMap[storyOwnerId].stories.push(story);

                    const views = story.views || [];
                    if (!views.includes(currentUser.uid)) {
                        userStoriesMap[storyOwnerId].hasNewActiveStory = true;
                    }
                });

                // --- DEEP FIX: Fetch missing profiles ---
                const userIdsToFetch = Object.values(userStoriesMap)
                    .filter(u => !u.partnerName || u.partnerName === 'User')
                    .map(u => u.userId);

                const uniqueIdsToFetch = [...new Set(userIdsToFetch)];

                // Helper to finalize and set state
                const setFinalStories = (fetchedProfiles = {}) => {
                    const processedStories = Object.values(userStoriesMap)
                        .map(userGroup => {
                            // If we requested a profile fetch for this user (because data was missing/generic)
                            // AND the profile wasn't found in DB -> It's likely a deleted/dummy user.
                            if (uniqueIdsToFetch.includes(userGroup.userId) && !fetchedProfiles[userGroup.userId]) {
                                return null; // Filter out orphan stories
                            }

                            const profile = fetchedProfiles[userGroup.userId];
                            if (profile) {
                                // STRICT FILTER: No guests, no generic 'User' with dummy avatars
                                if (profile.accountType === 'guest') return null;

                                const pName = profile.displayName || profile.name || profile.businessInfo?.businessName || userGroup.partnerName || 'User';
                                const pLogo = profile.photoURL || profile.avatar || profile.businessInfo?.logo || userGroup.partnerLogo;

                                // Filter out "User" if they have a cartoon/default avatar (likely unconfigured/dummy account)
                                if (pName === 'User' && (String(pLogo).includes('dicebear') || !pLogo)) {
                                    return null;
                                }

                                return {
                                    ...userGroup,
                                    partnerName: pName,
                                    partnerLogo: pLogo
                                };
                            }

                            // If we didn't need to fetch (data was in story), keep it.
                            // BUT check if it looks like a guest/dummy
                            let currentName = userGroup.partnerName || 'User';
                            // Safe check for logo string
                            let currentLogoStr = String(userGroup.partnerLogo || '');

                            if (currentName === 'User' && (currentLogoStr.includes('dicebear') || !userGroup.partnerLogo)) {
                                return null;
                            }

                            if (!userGroup.partnerName) userGroup.partnerName = 'User';
                            return userGroup;
                        })
                        .filter(Boolean); // Remove nulls (orphans)

                    // Convert to array and sort (unviewed first)
                    const sortedStories = processedStories.sort((a, b) => {
                        if (a.hasNewActiveStory && !b.hasNewActiveStory) return -1;
                        if (!a.hasNewActiveStory && b.hasNewActiveStory) return 1;
                        return 0;
                    });

                    setStories(sortedStories);
                    setLoading(false);
                };

                if (uniqueIdsToFetch.length > 0) {
                    try {
                        const fetchPromises = uniqueIdsToFetch.map(id => getDoc(doc(db, 'users', id)));
                        const snapshots = await Promise.all(fetchPromises);
                        const profilesMap = {};
                        snapshots.forEach(snap => {
                            if (snap.exists()) {
                                profilesMap[snap.id] = snap.data();
                            }
                            // If snap doesn't exist, we just don't add it to profilesMap.
                        });
                        setFinalStories(profilesMap);
                    } catch (err) {
                        console.error("Error fetching missing profiles:", err);
                        // In case of error (e.g. network), we might show them as is, or hide.
                        // Let's show them to be safe, or hide to be clean?
                        // Safety: show old behavior if fetch fails completely
                        setStories(Object.values(userStoriesMap));
                        setLoading(false);
                    }
                } else {
                    setFinalStories();
                }

                // Set My Story Data
                if (myStories.length > 0) {
                    setMyStoryData({
                        userId: currentUser.uid,
                        partnerName: 'You',
                        partnerLogo: userPhoto,
                        stories: myStories,
                        hasNewActiveStory: false
                    });
                } else {
                    setMyStoryData(null);
                }

            } catch (error) {
                console.error("Error processing stories:", error);
                setLoading(false);
            }
        }, (error) => {
            console.error("Error fetching stories:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser, userPhoto]);

    if (loading) return null;

    return (
        <div style={{
            background: 'transparent',
            borderBottom: 'none',
            padding: '6px 0',
            marginBottom: '0.5rem',
            // Removed sticky to avoid transparency overlap issues
            position: 'relative',
            zIndex: 10
        }}>
            <div style={{
                display: 'flex',
                gap: '12px',
                overflowX: 'auto',
                padding: '0 16px',
            }}
                className="hide-scrollbar"
            >
                {/* 
                    LOGIC:
                    If I have stories -> Show "Add" Button + "Your Story" (View only)
                    If I DON'T have stories -> Show "Your Story" (Create mode)
                */}

                {myStoryData ? (
                    <>
                        {/* 1. Add Story Button */}
                        <div
                            onClick={() => navigate('/create-story')}
                            style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer', flexShrink: 0
                            }}
                        >
                            <div style={{
                                width: '64px', height: '64px',
                                borderRadius: '50%',
                                background: 'var(--bg-body)',
                                border: '2px solid var(--border-color)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '24px', color: 'var(--text-primary)'
                            }}>
                                <FaCamera />
                            </div>
                            <span style={{ fontSize: '0.75rem', maxWidth: '75px', textAlign: 'center', color: 'var(--text-main)' }}>
                                New
                            </span>
                        </div>

                        {/* 2. My Story (View) */}
                        <div
                            onClick={() => onStoryClick(myStoryData)}
                            style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer', flexShrink: 0
                            }}
                        >
                            <div style={{
                                position: 'relative', width: '64px', height: '64px',
                                padding: '2px', // Gap between ring and image
                                background: 'linear-gradient(135deg, #10b981, #059669)', // Green Ring for "My Story"
                                borderRadius: '50%'
                            }}>
                                <div style={{
                                    width: '100%', height: '100%', borderRadius: '50%',
                                    background: userPhoto ? `url(${userPhoto})` : 'linear-gradient(135deg, #666, #333)',
                                    backgroundSize: 'cover', backgroundPosition: 'center',
                                    border: '2px solid var(--bg-card)' // Border inside ring
                                }} />
                            </div>
                            <span style={{ fontSize: '0.75rem', maxWidth: '75px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center', color: 'var(--text-main)' }}>
                                Your Story
                            </span>
                        </div>
                    </>
                ) : (
                    /* 3. My Story (Create Mode) */
                    <div
                        onClick={() => navigate('/create-story')}
                        style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer', flexShrink: 0, position: 'relative'
                        }}
                    >
                        <div style={{ position: 'relative', width: '64px', height: '64px' }}>
                            <div style={{
                                width: '100%', height: '100%', borderRadius: '50%',
                                background: userPhoto ? `url(${userPhoto})` : 'linear-gradient(135deg, #666, #333)',
                                backgroundSize: 'cover', backgroundPosition: 'center',
                                border: '2px solid var(--border-color)'
                            }} />
                            <div style={{
                                position: 'absolute', bottom: '0', right: '0',
                                background: '#1d9bf0', color: 'white',
                                width: '22px', height: '22px', borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                border: '2px solid var(--bg-card)', fontSize: '10px'
                            }}>
                                <FaPlus />
                            </div>
                        </div>
                        <span style={{ fontSize: '0.75rem', maxWidth: '75px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center', color: 'var(--text-main)' }}>
                            Your Story
                        </span>
                    </div>
                )}

                {/* Other Users' Stories */}
                {stories.map(user => (
                    <StoryCircle
                        key={user.userId}
                        partner={{
                            id: user.userId,
                            name: user.partnerName,
                            logo: user.partnerLogo
                        }}
                        hasNewStory={user.hasNewActiveStory}
                        onClick={() => onStoryClick(user)}
                    />
                ))}
            </div>

            <style>{`
                .hide-scrollbar::-webkit-scrollbar {
                    display: none;
                }
            `}</style>
        </div>
    );
};

export default StoriesBar;
