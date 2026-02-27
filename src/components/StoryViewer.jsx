import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { doc, updateDoc, arrayUnion, arrayRemove, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { useTranslation } from 'react-i18next';
import { FaHeart, FaRegHeart, FaTimes, FaChevronLeft, FaChevronRight, FaVolumeUp, FaVolumeMute, FaPaperPlane, FaShare } from 'react-icons/fa';

const StoryViewer = ({ partnerStories: viewingData, onClose }) => {
    const { currentUser } = useAuth();
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

    const [isMuted, setIsMuted] = useState(true);
    const timerRef = useRef(null);
    const progressIntervalRef = useRef(null);
    const startTimeRef = useRef(null);
    const elapsedRef = useRef(0);

    // Input Text State
    const [replyText, setReplyText] = useState('');

    const STORY_DURATION = 5000;

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

    // Effect 2: Timer Logic
    useEffect(() => {
        if (currentStory && currentUser) {
            markAsViewed(currentStory.id);
        }

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
    }, [currentUserGroupIndex, currentStoryIndex]);

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
                await updateDoc(storyRef, { likes: arrayUnion(currentUser.uid) });
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

        const clickX = e.clientX;
        const screenWidth = window.innerWidth;
        if (clickX < screenWidth / 3) {
            handlePrevious();
        } else {
            handleNext();
        }
    };

    const [sendingFeedback, setSendingFeedback] = useState(null);

    const handleSendReply = async (content = null) => {
        const textToSend = content || replyText;
        if (!textToSend.trim()) return;

        setIsPaused(true);
        if (content) setSendingFeedback({ emoji: content });
        else setSendingFeedback({ emoji: '✅' });

        try {
            const targetId = currentUserStories.userId;
            const convoId = await getOrCreateConversation(targetId);
            if (convoId) {
                await sendMessage(convoId, {
                    text: textToSend,
                    type: 'text'
                });
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

    const toggleMute = (e) => {
        e.stopPropagation();
        setIsMuted(!isMuted);
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

    return ReactDOM.createPortal(
        <div
            className="story-viewer-portal"
            style={{
                position: 'fixed',
                top: 0, left: 0, right: 0, bottom: 0,
                height: '100dvh',
                background: 'black',
                zIndex: 99999,
                overflow: 'hidden',
                touchAction: 'none'
            }}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
        >
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
                        flexDirection: 'column'
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
                                {groupIndex === currentUserGroupIndex && currentStory.type === 'video' && (
                                    <button onClick={toggleMute} style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.2rem', padding: '4px' }}>
                                        {isMuted ? <FaVolumeMute /> : <FaVolumeUp />}
                                    </button>
                                )}
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
                                return storyToRender.url || storyToRender.image ? (
                                    storyToRender.type === 'video' ? (
                                        <video
                                            src={storyToRender.url || storyToRender.image}
                                            autoPlay={groupIndex === currentUserGroupIndex}
                                            loop muted={groupIndex !== currentUserGroupIndex || isMuted}
                                            playsInline
                                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                        />
                                    ) : (
                                        <img
                                            src={storyToRender.url || storyToRender.image}
                                            alt="Story"
                                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                        />
                                    )
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
                        </div>

                        {/* Interaction Bar (Only for active user) */}
                        {groupIndex === currentUserGroupIndex && (
                            <div style={{
                                padding: '16px 16px 20px',
                                background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)',
                                display: 'flex', alignItems: 'center', gap: '12px',
                                zIndex: 30
                            }}>
                                <div style={{
                                    flex: 1, position: 'relative', height: '44px', borderRadius: '22px',
                                    border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(0,0,0,0.4)',
                                    display: 'flex', alignItems: 'center', padding: '0 48px 0 16px', marginRight: '8px'
                                }} onClick={e => e.stopPropagation()}>
                                    <input
                                        className="story-reply-input"
                                        type="text"
                                        placeholder="Send message..."
                                        value={replyText}
                                        onChange={(e) => setReplyText(e.target.value)}
                                        onFocus={() => { setIsInputFocused(true); setIsPaused(true); }}
                                        onBlur={() => { if (!sendingFeedback) { setIsInputFocused(false); setIsPaused(false); } }}
                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); handleSendReply(); } }}
                                        style={{ width: '100%', background: 'transparent', border: 'none', color: 'white', fontSize: '0.95rem', outline: 'none' }}
                                    />
                                    {replyText.trim() && (
                                        <button onClick={(e) => { e.stopPropagation(); handleSendReply(); }}
                                            style={{
                                                position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)',
                                                background: '#3b82f6', border: 'none', borderRadius: '50%', width: '36px', height: '36px',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'
                                            }}
                                        >
                                            <FaPaperPlane size={14} style={{ transform: 'translateX(-1px) translateY(1px)' }} />
                                        </button>
                                    )}
                                </div>
                                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                    {!replyText && (
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            {['😍', '🥰', '😂'].map(emoji => (
                                                <button key={emoji} onClick={(e) => { e.stopPropagation(); handleSendReply(emoji); }}
                                                    style={{ background: 'none', border: 'none', fontSize: '1.8rem', cursor: 'pointer', padding: '0' }}
                                                >
                                                    {emoji}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    <button onClick={(e) => { e.stopPropagation(); handleLike(); }}
                                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'none', border: 'none', color: 'white', gap: '2px', cursor: 'pointer' }}
                                    >
                                        {hasLiked ? <FaHeart color="#ef4444" size={28} /> : <FaRegHeart size={28} />}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Feedback Animation Layer */}
            {sendingFeedback && (
                <div style={{
                    position: 'absolute', inset: 0, zIndex: 100,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    pointerEvents: 'none'
                }}>
                    <div style={{
                        fontSize: '4rem',
                        animation: 'floatUpFade 1.5s ease-out forwards',
                        textShadow: '0 4px 12px rgba(0,0,0,0.5)'
                    }}>
                        {sendingFeedback.emoji}
                    </div>
                </div>
            )}
            <style>{`
                @keyframes floatUpFade {
                    0% { transform: translateY(20px) scale(0.5); opacity: 0; }
                    20% { transform: translateY(0) scale(1.2); opacity: 1; }
                    80% { transform: translateY(-50px) scale(1); opacity: 1; }
                    100% { transform: translateY(-100px) scale(0.8); opacity: 0; }
                }
            `}</style>
        </div>,
        document.body
    );
};

export default StoryViewer;
