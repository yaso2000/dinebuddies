import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { doc, updateDoc, arrayUnion, arrayRemove, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { useTranslation } from 'react-i18next';
import { FaHeart, FaRegHeart, FaTimes, FaPaperPlane, FaRegCommentDots } from 'react-icons/fa';
import StoryCommentStream from './StoryCommentStream';
import './StoryViewer.css';

const QUICK_EMOJIS = ['🔥', '❤️', '😂', '😮', '👏'];

const StoryViewer = ({ partnerStories: viewingData, onClose }) => {
    const { currentUser, userProfile } = useAuth();
    const { sendMessage, getOrCreateConversation } = useChat();
    const { t } = useTranslation();

    const { allUserStories, initialUserIndex } = viewingData;

    const [currentUserGroupIndex, setCurrentUserGroupIndex] = useState(initialUserIndex);
    const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
    const [progress, setProgress] = useState(0);

    // Interactive Swipe States
    const [dragOffset, setDragOffset] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [touchStartX, setTouchStartX] = useState(0);
    const [isTransitioning, setIsTransitioning] = useState(false);

    // Pausing Logic
    const [isPaused, setIsPaused] = useState(false);
    const [isInputFocused, setIsInputFocused] = useState(false);

    const timerRef = useRef(null);
    const progressIntervalRef = useRef(null);
    const startTimeRef = useRef(null);
    const elapsedRef = useRef(0);
    const lastTapRef = useRef(0); // for double-tap detection
    const singleTapTimerRef = useRef(null); // to cancel single-tap nav on double-tap

    // Double-tap heart animation position
    const [heartPos, setHeartPos] = useState(null);

    // Live comment stream (owner-only)
    const [streamItems, setStreamItems] = useState([]);
    const seenReactionIdsRef = useRef(new Set());
    const [keyboardLift, setKeyboardLift] = useState(0);

    // Input Text State
    const [replyText, setReplyText] = useState('');

    const STORY_DURATION = 10000;

    const currentUserStories = allUserStories[currentUserGroupIndex];
    const initialStory = currentUserStories?.stories[currentStoryIndex];
    const [realTimeStory, setRealTimeStory] = useState(initialStory);

    // Effect 1: Real-time listener
    useEffect(() => {
        if (!initialStory?.id) return;
        const unsubscribe = onSnapshot(doc(db, 'stories', initialStory.id), (docSnapshot) => {
            if (docSnapshot.exists()) {
                setRealTimeStory({ id: docSnapshot.id, ...docSnapshot.data() });
            }
        });
        return () => unsubscribe();
    }, [initialStory?.id]);

    const currentStory = realTimeStory || initialStory;
    const activeStoryOwnerId = String(currentUserStories?.userId || '');
    const isOwnStory = Boolean(currentUser?.uid) && activeStoryOwnerId === String(currentUser.uid);

    // Effect 2a: Mark story as viewed — only fires once per story change
    useEffect(() => {
        if (currentStory?.id && currentUser) {
            markAsViewed(currentStory.id);
        }
    }, [currentStory?.id]);

    // Effect 2b: Timer Logic
    useEffect(() => {
        // Pause timer during dragging or transitioning
        const shouldPlay = !isPaused && !isInputFocused && !isDragging && !isTransitioning;

        if (shouldPlay) {
            startTimer();
        } else {
            pauseTimer();
        }

        return () => {
            clearTimers();
        };
    }, [currentUserGroupIndex, currentStoryIndex, isPaused, isInputFocused, isDragging, isTransitioning]);



    // Reset states when user group or story changes
    useEffect(() => {
        elapsedRef.current = 0;
        setProgress(0);
        setRealTimeStory(null);
        setStreamItems([]);
        setShowCommentsPanel(false);
        seenReactionIdsRef.current = new Set();
    }, [currentUserGroupIndex, currentStoryIndex]);

    // Seed seen reaction ids when story loads (only stream *incoming* after open)
    useEffect(() => {
        seenReactionIdsRef.current = new Set(
            (currentStory?.reactions || [])
                .map((r) => r.id || `${r.userId}_${r.createdAt}`)
                .filter(Boolean)
        );
        setStreamItems([]);
    }, [currentStory?.id]);

    // Live comment stream — owner sees new reactions as they arrive
    useEffect(() => {
        if (!isOwnStory || !currentStory?.reactions?.length) return;

        const newcomers = [];
        for (const reaction of currentStory.reactions) {
            const id = reaction.id || `${reaction.userId}_${reaction.createdAt}`;
            if (!id || seenReactionIdsRef.current.has(id)) continue;
            seenReactionIdsRef.current.add(id);
            newcomers.push({ key: id, reaction });
        }
        if (newcomers.length) {
            setStreamItems((prev) => [...prev, ...newcomers]);
        }
    }, [currentStory?.reactions, isOwnStory]);

    const expireStreamItem = useCallback((key) => {
        setStreamItems((prev) => prev.filter((item) => item.key !== key));
    }, []);

    // Lift footer above virtual keyboard while typing
    useEffect(() => {
        if (!isInputFocused || typeof window === 'undefined' || !window.visualViewport) {
            setKeyboardLift(0);
            return undefined;
        }
        const vv = window.visualViewport;
        const update = () => {
            setKeyboardLift(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
        };
        update();
        vv.addEventListener('resize', update);
        vv.addEventListener('scroll', update);
        return () => {
            vv.removeEventListener('resize', update);
            vv.removeEventListener('scroll', update);
        };
    }, [isInputFocused]);


    const startTimer = () => {
        clearTimers();
        startTimeRef.current = Date.now();
        const remainingTime = STORY_DURATION - elapsedRef.current;

        if (remainingTime <= 0) {
            handleNext();
            return;
        }

        progressIntervalRef.current = setInterval(() => {
            const currentElapsed = elapsedRef.current + (Date.now() - startTimeRef.current);
            const newProgress = (currentElapsed / STORY_DURATION) * 100;

            if (newProgress >= 100) {
                setProgress(100);
                clearInterval(progressIntervalRef.current);
            } else {
                setProgress(newProgress);
            }
        }, 50);

        timerRef.current = setTimeout(() => {
            handleNext();
        }, remainingTime);
    };

    const pauseTimer = () => {
        if (startTimeRef.current) {
            elapsedRef.current += Date.now() - startTimeRef.current;
        }
        clearTimers();
    };

    const clearTimers = () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        startTimeRef.current = null;
    };

    const markAsViewed = async (storyId) => {
        if (!currentUser) return;
        try {
            const storyRef = doc(db, 'stories', storyId);
            await updateDoc(storyRef, {
                views: arrayUnion(currentUser.uid)
            });
        } catch (error) {
            console.error('Error marking story as viewed:', error);
        }
    };

    const handleLike = async () => {
        if (!currentUser || !currentStory) return;
        try {
            const storyRef = doc(db, 'stories', currentStory.id);
            const hasLiked = currentStory.likes?.includes(currentUser.uid);
            if (hasLiked) {
                await updateDoc(storyRef, { likes: arrayRemove(currentUser.uid) });
            } else {
                // Record reaction only if the liker is NOT the story owner
                if (!isOwnStory) {
                    const reaction = {
                        id: `${currentUser.uid}_like_${Date.now()}`,
                        userId: currentUser.uid,
                        userName: userProfile?.name || userProfile?.displayName || currentUser.displayName || 'User',
                        userPhoto: userProfile?.photo || currentUser.photoURL || '',
                        content: '❤️',
                        type: 'like',
                        createdAt: Date.now()
                    };
                    await updateDoc(storyRef, {
                        likes: arrayUnion(currentUser.uid),
                        reactions: arrayUnion(reaction)
                    });
                } else {
                    await updateDoc(storyRef, { likes: arrayUnion(currentUser.uid) });
                }
            }
        } catch (error) {
            console.error('Error toggling like:', error);
        }
    };

    const handleNextUser = () => {
        if (currentUserGroupIndex < allUserStories.length - 1) {
            setIsTransitioning(true);
            setCurrentUserGroupIndex(prev => prev + 1);
            setCurrentStoryIndex(0);
            setTimeout(() => setIsTransitioning(false), 300); // Back to normal after animation
        } else {
            onClose();
        }
    };

    const handlePreviousUser = () => {
        if (currentUserGroupIndex > 0) {
            setIsTransitioning(true);
            setCurrentUserGroupIndex(prev => prev - 1);
            setCurrentStoryIndex(0);
            setTimeout(() => setIsTransitioning(false), 300);
        }
    };

    const handleNext = () => {
        if (currentStoryIndex < currentUserStories.stories.length - 1) {
            setCurrentStoryIndex(prev => prev + 1);
        } else {
            handleNextUser();
        }
    };

    const handlePrevious = () => {
        if (currentStoryIndex > 0) {
            setCurrentStoryIndex(prev => prev - 1);
        } else {
            handlePreviousUser();
        }
    };

    // --- Interactive Swipe Tracking ---
    const onTouchStart = (e) => {
        if (isInputFocused) return;
        setTouchStartX(e.targetTouches[0].clientX);
        setIsDragging(true);
        setDragOffset(0);
    };

    const onTouchMove = (e) => {
        if (!isDragging) return;
        const currentX = e.targetTouches[0].clientX;
        const diff = currentX - touchStartX;

        // Prevent swiping before first or after last user group with resistance
        if (currentUserGroupIndex === 0 && diff > 0) {
            setDragOffset(diff * 0.3);
        } else if (currentUserGroupIndex === allUserStories.length - 1 && diff < 0) {
            setDragOffset(diff * 0.3);
        } else {
            setDragOffset(diff);
        }
    };

    const onTouchEnd = () => {
        if (!isDragging) return;
        setIsDragging(false);

        const threshold = window.innerWidth * 0.2; // 20% of screen

        if (dragOffset < -threshold && currentUserGroupIndex < allUserStories.length - 1) {
            handleNextUser();
        } else if (dragOffset > threshold && currentUserGroupIndex > 0) {
            handlePreviousUser();
        }

        // Animated snap back
        setIsTransitioning(true);
        setDragOffset(0);
        setTimeout(() => setIsTransitioning(false), 300);
    };

    const handleTap = (e) => {
        if (isInputFocused || isDragging || Math.abs(dragOffset) > 5) return;

        const now = Date.now();
        const timeSinceLastTap = now - lastTapRef.current;

        if (timeSinceLastTap < 300 && timeSinceLastTap > 0) {
            clearTimeout(singleTapTimerRef.current);
            const alreadyLiked = currentStory.likes?.includes(currentUser?.uid);
            if (!alreadyLiked) {
                handleLike();
            }
            setHeartPos({ x: e.clientX, y: e.clientY });
            setTimeout(() => setHeartPos(null), 600);
            lastTapRef.current = 0;
            return;
        }

        lastTapRef.current = now;

        // Delay single-tap navigation so double-tap can cancel it
        singleTapTimerRef.current = setTimeout(() => {
            const clickX = e.clientX;
            const screenWidth = window.innerWidth;
            if (clickX < screenWidth / 3) {
                handlePrevious();
            } else {
                handleNext();
            }
        }, 310);
    };

    const [sendingFeedback, setSendingFeedback] = useState(null);
    const [showCommentsPanel, setShowCommentsPanel] = useState(false);

    const handleQuickEmoji = (emoji, e) => {
        e?.stopPropagation?.();
        e?.preventDefault?.();
        if (isOwnStory) return;
        if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }
        setIsInputFocused(false);
        handleSendReply(emoji);
    };

    const handleSendReply = async (content = null) => {
        const textToSend = content || replyText;
        if (!textToSend.trim()) return;

        setIsPaused(true);
        if (content) setSendingFeedback({ emoji: content });
        else setSendingFeedback({ emoji: '✅' });

        try {
            const targetId = currentUserStories.userId;
            // 1. Send DM as before
            const convoId = await getOrCreateConversation(targetId);
            if (convoId) {
                await sendMessage(convoId, { text: textToSend, type: 'text' });
            }

            // 2. Save as a reaction on the story — only when VIEWER (not owner)
            if (!isOwnStory) {
                const reaction = {
                    id: `${currentUser.uid}_${Date.now()}`,
                    userId: currentUser.uid,
                    userName: userProfile?.name || userProfile?.displayName || currentUser.displayName || 'User',
                    userPhoto: userProfile?.photo || currentUser.photoURL || '',
                    content: textToSend,
                    type: content ? 'emoji' : 'text',
                    createdAt: Date.now()
                };
                const storyRef = doc(db, 'stories', currentStory.id);
                await updateDoc(storyRef, { reactions: arrayUnion(reaction) });
            }

            setReplyText('');
            if (!content) {
                if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
                setIsInputFocused(false);
            }
            setTimeout(() => {
                setSendingFeedback(null);
                setIsPaused(false);
            }, 1500);
        } catch (err) {
            console.error("Error sending reply:", err);
            setSendingFeedback(null);
            setIsPaused(false);
        }
    };


    const formatDate = (timestamp) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const diff = new Date() - date;
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(hours / 24);
        if (hours < 1) return t('just_now');
        if (hours < 24) return t('hours_ago', { count: hours });
        return t('days_ago_story', { count: days });
    };

    if (!currentStory) return null;

    const hasLiked = currentStory.likes?.includes(currentUser?.uid);
    const likesCount = currentStory.likes?.length || 0;
    const textReactions = (currentStory.reactions || []).filter((r) => r.type === 'text' && String(r.content || '').trim());
    const privateThread = isOwnStory
        ? textReactions
        : textReactions.filter((r) => r.userId === currentUser?.uid);
    const commentsCount = privateThread.length;

    // --- Prepare interactions overview for Owner ---
    let uniqueInteractors = [];
    if (isOwnStory && currentStory?.reactions) {
        const uniqueUsersMap = new Map();
        // Iterate in reverse to ensure the most recent reaction from a user is kept
        for (let i = currentStory.reactions.length - 1; i >= 0; i--) {
            const r = currentStory.reactions[i];
            if (!uniqueUsersMap.has(r.userId)) {
                uniqueUsersMap.set(r.userId, r);
            }
        }
        uniqueInteractors = Array.from(uniqueUsersMap.values()).reverse(); // Display in chronological order of first interaction
    }

    return ReactDOM.createPortal(
        <div
            className="story-viewer-portal"
            style={{
                position: 'fixed',
                top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0,0,0,0.85)',
                zIndex: 99999,
                overflow: 'hidden',
                touchAction: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
        >
            {/* Inner story card — full-screen on mobile, 9:16 centered on desktop */}
            <div style={{
                width: '100%',
                height: '100%',
                maxWidth: 'min(100vw, calc(100vh * 9 / 16))',
                maxHeight: '100dvh',
                position: 'relative',
                overflow: 'hidden',
            }}>
                {/* Sliding Container that holds ALL users */}
                <div style={{
                    display: 'flex',
                    height: '100%',
                    width: `${allUserStories.length * 100}%`,
                    transform: `translateX(calc(-${currentUserGroupIndex * (100 / allUserStories.length)}% + ${dragOffset / allUserStories.length}px))`,
                    transition: isTransitioning ? 'transform 0.3s cubic-bezier(0.23, 1, 0.32, 1)' : 'none',
                    willChange: 'transform'
                }}>
                    {allUserStories.map((userGroup, groupIndex) => (
                        <div key={userGroup.userId} style={{
                            width: `${100 / allUserStories.length}%`,
                            height: '100%',
                            position: 'relative',
                            display: 'flex',
                            flexDirection: 'column',
                            background: 'black',
                        }} onClick={handleTap}>

                            {/* Progress Bars (Only visible for active group) */}
                            <div style={{
                                display: 'flex', gap: '4px', padding: '12px 10px',
                                position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
                                opacity: groupIndex === currentUserGroupIndex ? 1 : 0
                            }}>
                                {userGroup.stories.map((_, idx) => (
                                    <div key={idx} style={{
                                        flex: 1, height: '2px',
                                        background: 'rgba(255, 255, 255, 0.3)',
                                        borderRadius: '2px', overflow: 'hidden'
                                    }}>
                                        <div style={{
                                            width: (groupIndex < currentUserGroupIndex) ? '100%' :
                                                (groupIndex > currentUserGroupIndex) ? '0%' :
                                                    (idx < currentStoryIndex ? '100%' : (idx === currentStoryIndex ? `${progress}%` : '0%')),
                                            height: '100%',
                                            background: 'white'
                                        }} />
                                    </div>
                                ))}
                            </div>

                            {/* Header */}
                            <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '24px 16px', position: 'absolute', top: 0, left: 0, right: 0,
                                background: 'linear-gradient(to bottom, rgba(0,0,0,0.4), transparent)',
                                zIndex: 20, paddingTop: '30px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{
                                        width: '36px', height: '36px', borderRadius: '50%',
                                        background: `url("${userGroup.partnerLogo || 'https://via.placeholder.com/150'}") center/cover`,
                                        border: '1px solid rgba(255,255,255,0.8)'
                                    }} />
                                    <div>
                                        <div style={{ color: 'white', fontWeight: '600', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            {userGroup.partnerName}
                                            {groupIndex === currentUserGroupIndex && (
                                                <span style={{ opacity: 0.6, fontSize: '0.75rem', fontWeight: '400' }}>{formatDate(currentStory.createdAt)}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <button onClick={(e) => { e.stopPropagation(); onClose(); }} style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.5rem', padding: '4px' }}>
                                        <FaTimes />
                                    </button>
                                </div>
                            </div>

                            {/* Story Content */}
                            <div style={{
                                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                position: 'relative', overflow: 'hidden', background: '#1a1a1a',
                                borderRadius: '16px', margin: '10px 0'
                            }}>
                                {/* Render only stories for current and adjacent users for performance */}
                                {Math.abs(groupIndex - currentUserGroupIndex) <= 1 && (() => {
                                    const storyToRender = groupIndex === currentUserGroupIndex ? currentStory : userGroup.stories[0];
                                    if (!storyToRender) return null;
                                    return storyToRender.url || storyToRender.image ? (
                                        <img
                                            src={storyToRender.url || storyToRender.image}
                                            alt="Story"
                                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                        />
                                    ) : (
                                        <div style={{
                                            width: '100%', height: '100%',
                                            background: storyToRender.backgroundColor || 'linear-gradient(135deg, #8b5cf6, #ec4899)'
                                        }} />
                                    );
                                })()}

                                {groupIndex === currentUserGroupIndex && currentStory.text && (
                                    <div style={{
                                        position: 'absolute', inset: 0,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
                                        pointerEvents: 'none'
                                    }}>
                                        <p style={{
                                            color: currentStory.textColor || 'white',
                                            fontSize: 'clamp(1.5rem, 5vw, 2.5rem)',
                                            textAlign: 'center', fontWeight: 'bold',
                                            textShadow: '0 2px 4px rgba(0,0,0,0.6)'
                                        }}>{currentStory.text}</p>
                                    </div>
                                )}

                                {groupIndex === currentUserGroupIndex && isOwnStory && (
                                    <StoryCommentStream items={streamItems} onExpire={expireStreamItem} />
                                )}


                                {/* 3. Stacked Interactors Overview — only for active group owner */}
                                {groupIndex === currentUserGroupIndex && uniqueInteractors.length > 0 && (
                                    <div style={{
                                        position: 'absolute',
                                        bottom: '16px',
                                        left: '16px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '6px 14px 6px 8px',
                                        background: 'rgba(0,0,0,0.6)',
                                        backdropFilter: 'blur(10px)',
                                        borderRadius: '28px',
                                        pointerEvents: 'auto',
                                        zIndex: 10,
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                            {uniqueInteractors.slice(0, 5).map((u, i) => (
                                                <div key={u.userId} style={{
                                                    width: '32px',
                                                    height: '32px',
                                                    borderRadius: '50%',
                                                    border: '2px solid rgba(0,0,0,0.8)',
                                                    marginLeft: i === 0 ? '0' : '-10px',
                                                    zIndex: 5 - i,
                                                    background: '#444',
                                                    overflow: 'hidden'
                                                }}>
                                                    {u.userPhoto ? (
                                                        <img src={u.userPhoto} alt={u.userName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    ) : null}
                                                </div>
                                            ))}
                                        </div>
                                        <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.9rem', fontWeight: 'bold', marginLeft: '10px', whiteSpace: 'nowrap' }}>
                                            {uniqueInteractors.length} {uniqueInteractors.length === 1 ? t('person', 'Person') : t('people', 'People')}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Interaction Layer */}
                            {groupIndex === currentUserGroupIndex && (
                                <>
                                    <div style={{
                                        position: 'absolute',
                                        right: '12px',
                                        bottom: '130px',
                                        zIndex: 32,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '14px'
                                    }}>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleLike(); }}
                                            style={{
                                                width: '42px',
                                                height: '42px',
                                                borderRadius: '50%',
                                                border: 'none',
                                                background: 'rgba(0,0,0,0.45)',
                                                color: 'white',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {hasLiked ? <FaHeart color="#ef4444" size={22} /> : <FaRegHeart size={22} />}
                                        </button>
                                        <span style={{ color: 'white', fontSize: '0.75rem', fontWeight: 700, textShadow: '0 2px 6px rgba(0,0,0,0.45)' }}>
                                            {likesCount}
                                        </span>
                                        <span style={{ color: 'rgba(255,255,255,0.82)', fontSize: '0.67rem', fontWeight: 600 }}>
                                            {t('like_label', 'Like')}
                                        </span>

                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setShowCommentsPanel((prev) => !prev);
                                            }}
                                            style={{
                                                width: '42px',
                                                height: '42px',
                                                borderRadius: '50%',
                                                border: 'none',
                                                background: 'rgba(0,0,0,0.45)',
                                                color: 'white',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <FaRegCommentDots size={20} />
                                        </button>
                                        <span style={{ color: 'white', fontSize: '0.75rem', fontWeight: 700, textShadow: '0 2px 6px rgba(0,0,0,0.45)' }}>
                                            {commentsCount}
                                        </span>
                                        <span style={{ color: 'rgba(255,255,255,0.82)', fontSize: '0.67rem', fontWeight: 600 }}>
                                            {t('comments_label', 'Comments')}
                                        </span>

                                    </div>

                                    {showCommentsPanel && (
                                        <div
                                            onClick={(e) => e.stopPropagation()}
                                            style={{
                                                position: 'absolute',
                                                left: '12px',
                                                right: '12px',
                                                bottom: '84px',
                                                maxHeight: '38%',
                                                zIndex: 34,
                                                background: 'rgba(0,0,0,0.74)',
                                                border: '1px solid rgba(255,255,255,0.18)',
                                                borderRadius: '16px',
                                                backdropFilter: 'blur(10px)',
                                                overflow: 'hidden',
                                                display: 'flex',
                                                flexDirection: 'column'
                                            }}
                                        >
                                            <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.12)', color: 'white', fontSize: '0.82rem', fontWeight: 700 }}>
                                                {isOwnStory ? t('story_comments', 'Comments') : t('private_replies', 'Private replies')} ({commentsCount})
                                            </div>
                                            <div style={{ padding: '8px 12px 0', color: 'rgba(255,255,255,0.65)', fontSize: '0.72rem' }}>
                                                {isOwnStory
                                                    ? t('story_owner_privacy_note', 'Only you can see these replies')
                                                    : t('story_viewer_privacy_note', 'Visible only to you and the story owner')}
                                            </div>
                                            <div style={{ overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '9px' }}>
                                                {commentsCount === 0 ? (
                                                    <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: '0.82rem' }}>
                                                        {t('no_comments_yet', 'No comments yet')}
                                                    </div>
                                                ) : privateThread.slice(-14).reverse().map((comment) => (
                                                    <div key={comment.id} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                                        <div style={{
                                                            width: '26px', height: '26px', borderRadius: '50%', overflow: 'hidden',
                                                            background: '#333', flexShrink: 0
                                                        }}>
                                                            {comment.userPhoto ? (
                                                                <img src={comment.userPhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            ) : null}
                                                        </div>
                                                        <div style={{ minWidth: 0 }}>
                                                            <div style={{ color: 'rgba(255,255,255,0.75)', fontWeight: 700, fontSize: '0.72rem' }}>
                                                                {comment.userName}
                                                            </div>
                                                            <div style={{ color: 'white', fontSize: '0.86rem', wordBreak: 'break-word' }}>
                                                                {comment.content}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {!isOwnStory ? (
                                        <div
                                            className={`story-footer${isInputFocused ? ' story-footer--keyboard' : ''}`}
                                            style={keyboardLift > 0 ? { transform: `translateY(-${keyboardLift}px)` } : undefined}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <span className="story-footer__hint">
                                                {t('story_interaction_hint_private', 'Your reply is private between you and the story owner')}
                                            </span>
                                            <div className="story-footer__quick-emojis" role="toolbar" aria-label={t('quick_emojis', 'Quick reactions')}>
                                                {QUICK_EMOJIS.map((emoji) => (
                                                    <button
                                                        key={emoji}
                                                        type="button"
                                                        className="story-footer__quick-emoji"
                                                        onMouseDown={(e) => e.preventDefault()}
                                                        onClick={(e) => handleQuickEmoji(emoji, e)}
                                                        aria-label={emoji}
                                                    >
                                                        {emoji}
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="story-footer__input-wrap">
                                                <input
                                                    className="story-footer__input"
                                                    type="text"
                                                    inputMode="text"
                                                    placeholder={t('private_reply_placeholder', 'Send a private reply...')}
                                                    value={replyText}
                                                    onChange={(e) => setReplyText(e.target.value)}
                                                    onFocus={() => { setIsInputFocused(true); setIsPaused(true); }}
                                                    onBlur={() => { if (!sendingFeedback) { setIsInputFocused(false); setIsPaused(false); } }}
                                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); handleSendReply(); } }}
                                                />
                                                {replyText.trim() ? (
                                                    <button
                                                        type="button"
                                                        className="story-footer__send"
                                                        onClick={(e) => { e.stopPropagation(); handleSendReply(); }}
                                                        aria-label={t('send', 'Send')}
                                                    >
                                                        <FaPaperPlane size={13} style={{ transform: 'translateX(-1px) translateY(1px)' }} />
                                                    </button>
                                                ) : null}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="story-owner-footer-note">
                                            {t('story_owner_hint', 'This is your story. Open comments to see audience reactions.')}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Feedback Animation Layer */}
            {sendingFeedback && (
                <div className="story-feedback-burst">
                    <div className="story-feedback-burst__emoji">{sendingFeedback.emoji}</div>
                </div>
            )}

            {heartPos && (
                <div
                    className="story-double-tap-heart"
                    style={{ left: heartPos.x, top: heartPos.y }}
                >
                    ❤️
                </div>
            )}
        </div>,
        document.body
    );
};

export default StoryViewer;
