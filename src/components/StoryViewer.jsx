import React, { useState, useEffect, useRef } from 'react';
import { doc, updateDoc, arrayUnion, arrayRemove, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { FaHeart, FaRegHeart, FaTimes, FaChevronLeft, FaChevronRight, FaVolumeUp, FaVolumeMute, FaPaperPlane } from 'react-icons/fa';

const StoryViewer = ({ partnerStories, onClose }) => {
    const { currentUser } = useAuth();
    const { sendMessage } = useChat();
    const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
    const [progress, setProgress] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const timerRef = useRef(null);
    const progressIntervalRef = useRef(null);

    // Reply Sheet State
    const [showReplySheet, setShowReplySheet] = useState(false);
    const [replyText, setReplyText] = useState('');

    // Swipe State
    const [touchStart, setTouchStart] = useState(null);
    const [touchEnd, setTouchEnd] = useState(null);
    const minSwipeDistance = 50;

    const STORY_DURATION = 5000;

    // Touch Handlers
    const onTouchStart = (e) => {
        setTouchEnd(null);
        setTouchStart({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY });
    };

    const onTouchMove = (e) => {
        setTouchEnd({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY });
    };

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        const xDistance = touchStart.x - touchEnd.x;
        const yDistance = touchStart.y - touchEnd.y;
        const isHorizontal = Math.abs(xDistance) > Math.abs(yDistance);

        if (isHorizontal) {
            if (xDistance > minSwipeDistance) handleNext(); // Swipe Left -> Next
            else if (xDistance < -minSwipeDistance) handlePrevious(); // Swipe Right -> Prev
        } else {
            // Vertical Swipe - Only for logged in users
            if (yDistance > minSwipeDistance) {
                if (currentUser && currentUser.accountType !== 'guest') {
                    // Swipe UP -> Open Sheet
                    setShowReplySheet(true);
                    setIsPaused(true);
                }
            }
            else if (yDistance < -minSwipeDistance) {
                // Swipe Down -> Close Sheet if open
                setShowReplySheet(false);
                setIsPaused(false);
            }
        }
    };

    // Send Reaction
    const handleSendReply = async (textToSend) => {
        if (!textToSend && !textToSend.trim()) return;
        try {
            const partnerId = partnerStories.partnerId || partnerStories.userId;
            // Send as text message to partner
            await sendMessage(null, textToSend, partnerId, 'text');

            // UI Feedback
            setReplyText('');
            setShowReplySheet(false);
            setIsPaused(false);
        } catch (err) {
            console.error("Error sending reply:", err);
        }
    };
    const initialStory = partnerStories.stories[currentStoryIndex];
    const [realTimeStory, setRealTimeStory] = useState(initialStory);

    // Effect 1: Real-time listener for Likes/Views
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

    // Effect 2: Timer and Mark as Viewed
    useEffect(() => {
        // Mark as viewed
        if (currentStory && currentUser) {
            markAsViewed(currentStory.id);
        }

        // Start auto-advance timer
        startTimer();

        return () => {
            stopTimer();
        };
    }, [currentStoryIndex]);

    const startTimer = () => {
        setProgress(0);

        // Progress animation
        progressIntervalRef.current = setInterval(() => {
            setProgress(prev => {
                if (prev >= 100) {
                    clearInterval(progressIntervalRef.current);
                    return 100;
                }
                return prev + (100 / (STORY_DURATION / 100));
            });
        }, 100);

        // Auto advance timer
        timerRef.current = setTimeout(() => {
            handleNext();
        }, STORY_DURATION);
    };

    const stopTimer = () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
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
                await updateDoc(storyRef, {
                    likes: arrayRemove(currentUser.uid)
                });
            } else {
                await updateDoc(storyRef, {
                    likes: arrayUnion(currentUser.uid)
                });
            }
        } catch (error) {
            console.error('Error toggling like:', error);
        }
    };

    const handleNext = () => {
        if (currentStoryIndex < partnerStories.stories.length - 1) {
            stopTimer();
            setCurrentStoryIndex(prev => prev + 1);
        } else {
            onClose();
        }
    };

    const handlePrevious = () => {
        if (currentStoryIndex > 0) {
            stopTimer();
            setCurrentStoryIndex(prev => prev - 1);
        }
    };

    const handleTap = (e) => {
        const clickX = e.clientX;
        const screenWidth = window.innerWidth;

        // If clicking controls, don't navigate (handled by stopPropagation)

        if (clickX < screenWidth / 3) {
            handlePrevious();
        } else if (clickX > screenWidth / 3) {
            handleNext();
        }
    };

    const toggleMute = (e) => {
        e.stopPropagation();
        setIsMuted(!isMuted);
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        const hours = Math.floor(diff / 3600000);

        if (hours < 1) return 'Just now';
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    };

    if (!currentStory) return null;

    const hasLiked = currentStory.likes?.includes(currentUser?.uid);

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.95)',
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column'
            }}
            onClick={handleTap}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
        >
            {/* Progress Bars */}
            <div style={{
                display: 'flex',
                gap: '4px',
                padding: '12px 16px',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 10
            }}>
                {partnerStories.stories.map((_, index) => (
                    <div
                        key={index}
                        style={{
                            flex: 1,
                            height: '3px',
                            background: 'rgba(255, 255, 255, 0.3)',
                            borderRadius: '2px',
                            overflow: 'hidden'
                        }}
                    >
                        <div style={{
                            width: index < currentStoryIndex ? '100%' :
                                index === currentStoryIndex ? `${progress}%` : '0%',
                            height: '100%',
                            background: 'white',
                            transition: index === currentStoryIndex ? 'none' : 'width 0.3s'
                        }} />
                    </div>
                ))}
            </div>

            {/* Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '50px 16px 16px', // Moved up
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                background: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)',
                zIndex: 10
            }}>
                <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: `url(${partnerStories.partnerLogo || `https://ui-avatars.com/api/?name=${encodeURIComponent(partnerStories.partnerName || 'User')}&background=random`})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    border: '2px solid white'
                }} />

                <div style={{ flex: 1 }}>
                    <h3 style={{
                        margin: 0,
                        fontSize: '0.95rem',
                        fontWeight: '700',
                        color: 'white'
                    }}>
                        {partnerStories.partnerName}
                    </h3>
                    <p style={{
                        margin: 0,
                        fontSize: '0.75rem',
                        color: 'rgba(255, 255, 255, 0.7)'
                    }}>
                        {formatDate(currentStory.createdAt)}
                    </p>
                </div>

                {/* Mute Toggle (Only for Videos) */}
                {currentStory.type === 'video' && (
                    <button
                        onClick={toggleMute}
                        style={{
                            background: 'rgba(255, 255, 255, 0.2)',
                            border: 'none',
                            borderRadius: '50%',
                            width: '36px',
                            height: '36px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            cursor: 'pointer',
                            marginRight: '8px'
                        }}
                    >
                        {isMuted ? <FaVolumeMute /> : <FaVolumeUp />}
                    </button>
                )}

                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                    }}
                    style={{
                        background: 'rgba(255, 255, 255, 0.2)',
                        border: 'none',
                        borderRadius: '50%',
                        width: '36px',
                        height: '36px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        cursor: 'pointer'
                    }}
                >
                    <FaTimes />
                </button>
            </div>

            {/* Story Content */}
            <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '120px 20px 100px' // Adjusted gap
            }}>
                {/* Unified Content Rendering */}
                <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

                    {/* Background Layer (Image/Video/Color) */}
                    {currentStory.url || currentStory.image ? (
                        currentStory.type === 'video' ? (
                            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                                <video
                                    src={currentStory.url || currentStory.image}
                                    autoPlay loop muted={isMuted} playsInline
                                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                />
                            </div>
                        ) : (
                            <img
                                src={currentStory.url || currentStory.image}
                                alt="Story"
                                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                            />
                        )
                    ) : (
                        <div style={{
                            width: '100%', height: '100%',
                            background: currentStory.backgroundColor || currentStory.background || 'linear-gradient(135deg, #8b5cf6, #ec4899)'
                        }} />
                    )}

                    {/* Text Overlay */}
                    {(currentStory.text || currentStory.textContent) && (
                        <div style={{
                            position: 'absolute', inset: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            padding: '2rem',
                            pointerEvents: 'none' // Click-through to background taps
                        }}>
                            <p style={{
                                fontSize: 'clamp(1.5rem, 5vw, 3rem)',
                                fontFamily: currentStory.fontFamily ? `${currentStory.fontFamily}, sans-serif` : 'sans-serif',
                                color: currentStory.textColor || 'white',
                                textAlign: 'center',
                                margin: 0,
                                lineHeight: '1.4',
                                whiteSpace: 'pre-wrap',
                                textShadow: '0 2px 8px rgba(0,0,0,0.5)',
                                fontWeight: '700'
                            }}>
                                {currentStory.text || currentStory.textContent}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Floating Right Actions (TikTok Style) */}
            <div style={{
                position: 'absolute',
                bottom: '120px', // Lifted up to clear any bottom nav
                right: '16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '24px',
                zIndex: 20
            }}>
                {/* LIKE BUTTON */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (currentUser && currentUser.accountType !== 'guest') {
                                handleLike();
                            }
                        }}
                        style={{
                            background: 'rgba(0, 0, 0, 0.3)',
                            border: hasLiked ? 'none' : '2px solid rgba(255, 255, 255, 0.8)',
                            borderRadius: '50%',
                            width: '50px',
                            height: '50px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: hasLiked ? '#ef4444' : 'white',
                            cursor: 'pointer',
                            fontSize: '1.5rem',
                            marginBottom: '4px',
                            backdropFilter: 'blur(4px)',
                            transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                        }}
                    >
                        {hasLiked ? <FaHeart /> : <FaRegHeart />}
                    </button>
                    <span style={{
                        color: 'white',
                        fontSize: '0.8rem',
                        fontWeight: '700',
                        textShadow: '0 1px 3px rgba(0,0,0,0.8)'
                    }}>
                        {currentStory.likes?.length || 0}
                    </span>
                </div>

                {/* VIEW COUNT */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{
                        fontSize: '1.2rem',
                        marginBottom: '2px',
                        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))'
                    }}>
                        👁️
                    </div>
                    <span style={{
                        color: 'white',
                        fontSize: '0.8rem',
                        fontWeight: '700',
                        textShadow: '0 1px 3px rgba(0,0,0,0.8)'
                    }}>
                        {currentStory.views?.length || 0}
                    </span>
                </div>
            </div>

            {/* Navigation Arrows (Desktop) */}
            {currentStoryIndex > 0 && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        handlePrevious();
                    }}
                    style={{
                        position: 'absolute',
                        left: '16px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'rgba(255, 255, 255, 0.2)',
                        border: 'none',
                        borderRadius: '50%',
                        width: '48px',
                        height: '48px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '1.2rem'
                    }}
                >
                    <FaChevronLeft />
                </button>
            )}

            {currentStoryIndex < partnerStories.stories.length - 1 && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        handleNext();
                    }}
                    style={{
                        position: 'absolute',
                        right: '16px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'rgba(255, 255, 255, 0.2)',
                        border: 'none',
                        borderRadius: '50%',
                        width: '48px',
                        height: '48px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '1.2rem'
                    }}
                >
                    <FaChevronRight />
                </button>
            )}
            {/* Reply Sheet (Swipe Up) */}
            {showReplySheet && (
                <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '85%',
                        maxWidth: '340px',
                        borderRadius: '24px',
                        background: 'rgba(20, 20, 20, 0.95)',
                        backdropFilter: 'blur(10px)',
                        padding: '30px 20px',
                        zIndex: 100,
                        animation: 'centerPopIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '20px',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.7)',
                        border: '1px solid rgba(255,255,255,0.1)'
                    }}
                >
                    <style>{`
                        @keyframes centerPopIn {
                            from { transform: translate(-50%, -50%) scale(0.8); opacity: 0; }
                            to { transform: translate(-50%, -50%) scale(1); opacity: 1; }
                        }
                        @keyframes popIn {
                            from { transform: scale(0); opacity: 0; }
                            to { transform: scale(1); opacity: 1; }
                        }
                    `}</style>

                    {/* Handle Bar */}
                    <div style={{
                        width: '40px',
                        height: '4px',
                        background: 'rgba(255,255,255,0.2)',
                        borderRadius: '2px',
                        margin: '-10px auto 0'
                    }} />

                    {/* Quick Reactions */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 10px' }}>
                        {['🔥', '😂', '😢', '😍', '👏'].map((emoji, i) => (
                            <button
                                key={emoji}
                                onClick={() => handleSendReply(emoji)}
                                style={{
                                    fontSize: '2.5rem',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    transition: 'transform 0.2s',
                                    animation: `popIn 0.3s ${i * 0.05}s backwards`
                                }}
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>

                    {/* Message Input */}
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <input
                            type="text"
                            placeholder="Message..."
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSendReply(replyText)}
                            autoFocus
                            style={{
                                flex: 1,
                                width: '0',
                                padding: '12px 16px',
                                borderRadius: '24px',
                                border: '1px solid rgba(255,255,255,0.1)',
                                background: 'rgba(255,255,255,0.1)',
                                color: 'white',
                                outline: 'none',
                                fontSize: '0.95rem'
                            }}
                        />
                        <button
                            onClick={() => handleSendReply(replyText)}
                            disabled={!replyText.trim()}
                            style={{
                                width: '46px',
                                height: '46px',
                                borderRadius: '50%',
                                border: 'none',
                                background: replyText.trim() ? '#3b82f6' : 'rgba(255,255,255,0.1)',
                                color: replyText.trim() ? 'white' : 'rgba(255,255,255,0.3)',
                                cursor: replyText.trim() ? 'pointer' : 'default',
                                transition: 'all 0.2s',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '1.2rem',
                                flexShrink: 0
                            }}
                        >
                            <FaPaperPlane style={{ transform: 'translateX(-2px)' }} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StoryViewer;
