import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { doc, updateDoc, arrayUnion, arrayRemove, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { FaHeart, FaRegHeart, FaTimes, FaChevronLeft, FaChevronRight, FaVolumeUp, FaVolumeMute, FaPaperPlane, FaShare } from 'react-icons/fa';

const StoryViewer = ({ partnerStories, onClose }) => {
    const { currentUser } = useAuth();
    const { sendMessage } = useChat();
    const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
    const [progress, setProgress] = useState(0);

    // Pausing Logic
    const [isPaused, setIsPaused] = useState(false);
    const [isInputFocused, setIsInputFocused] = useState(false); // New explicit focus state

    const [isMuted, setIsMuted] = useState(true);
    const timerRef = useRef(null);
    const progressIntervalRef = useRef(null);
    const startTimeRef = useRef(null);
    const elapsedRef = useRef(0);

    // Input Text State
    const [replyText, setReplyText] = useState('');

    const STORY_DURATION = 5000;

    const initialStory = partnerStories.stories[currentStoryIndex];
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

    // Effect 2: Timer Logic with Pause/Resume Support
    useEffect(() => {
        // Mark as viewed
        if (currentStory && currentUser) {
            markAsViewed(currentStory.id);
        }

        // Logic to run properly:
        // If paused or input focused -> Stop everything.
        // If not paused -> Run timer.

        const shouldPlay = !isPaused && !isInputFocused;

        if (shouldPlay) {
            startTimer();
        } else {
            pauseTimer();
        }

        return () => {
            clearTimers();
        };
    }, [currentStoryIndex, isPaused, isInputFocused]); // Dependency array is key!

    // Reset elapsed time when story changes
    useEffect(() => {
        elapsedRef.current = 0;
        setProgress(0);
    }, [currentStoryIndex]);


    const startTimer = () => {
        clearTimers(); // Safety clear

        startTimeRef.current = Date.now();
        const remainingTime = STORY_DURATION - elapsedRef.current;

        // If story is already "finished" but somehow here, next it
        if (remainingTime <= 0) {
            handleNext();
            return;
        }

        // Progress Animation
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

        // Auto Advance
        timerRef.current = setTimeout(() => {
            handleNext();
        }, remainingTime);
    };

    const pauseTimer = () => {
        if (startTimeRef.current) {
            // Save how much time passed
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

    const handleNext = () => {
        if (currentStoryIndex < partnerStories.stories.length - 1) {
            elapsedRef.current = 0; // Reset for next story
            setCurrentStoryIndex(prev => prev + 1);
        } else {
            onClose();
        }
    };

    const handlePrevious = () => {
        if (currentStoryIndex > 0) {
            elapsedRef.current = 0;
            setCurrentStoryIndex(prev => prev - 1);
        }
    };

    // Tap Navigation (Only works if NOT typing)
    const handleTap = (e) => {
        if (isInputFocused) return; // Don't skip if typing

        const clickX = e.clientX;
        const screenWidth = window.innerWidth;
        if (clickX < screenWidth / 3) {
            handlePrevious();
        } else if (clickX > screenWidth / 3) {
            handleNext();
        }
    };

    // Feedback State
    const [sendingFeedback, setSendingFeedback] = useState(null); // { emoji: string }

    // Send Message
    const handleSendReply = async (content = null) => {
        const textToSend = content || replyText;
        if (!textToSend.trim()) return;

        // 1. Pause Timer & Show Feedback
        setIsPaused(true);
        if (content) {
            // Only show floating emoji animation if it's an emoji click
            setSendingFeedback({ emoji: content });
        } else {
            // For text, maybe just a small "Sent" toast or just clear input?
            // For now let's just rely on clearing input, or we can add a checkmark.
            setSendingFeedback({ emoji: '✅' });
        }

        try {
            const partnerId = partnerStories.partnerId || partnerStories.userId;
            await sendMessage(null, textToSend, partnerId, 'text');

            setReplyText('');

            // Blur input if it was text
            if (!content) {
                if (document.activeElement instanceof HTMLElement) {
                    document.activeElement.blur();
                }
                setIsInputFocused(false);
            }

            // 2. Keep paused for animation duration (e.g., 1.5s)
            setTimeout(() => {
                setSendingFeedback(null);
                setIsPaused(false); // Resume timer
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
        const hours = Math.floor((new Date() - date) / 3600000);
        if (hours < 1) return 'Just now';
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    };

    if (!currentStory) return null;

    const hasLiked = currentStory.likes?.includes(currentUser?.uid);

    return ReactDOM.createPortal(
        <div
            style={{
                position: 'fixed',
                top: 0, left: 0, right: 0, bottom: 0, // Cover everything
                height: '100dvh', // Use dynamic viewport height
                background: 'black',
                zIndex: 99999, // Super high to cover everything including bottom nav
                display: 'flex', flexDirection: 'column'
            }}
            onClick={handleTap}
        >
            {/* Feedback Animation Layer */}
            {sendingFeedback && (
                <div style={{
                    position: 'absolute', inset: 0, zIndex: 50,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    pointerEvents: 'none'
                }}>
                    <style>{`
                        @keyframes floatUpFade {
                            0% { transform: translateY(20px) scale(0.5); opacity: 0; }
                            20% { transform: translateY(0) scale(1.2); opacity: 1; }
                            80% { transform: translateY(-50px) scale(1); opacity: 1; }
                            100% { transform: translateY(-100px) scale(0.8); opacity: 0; }
                        }
                    `}</style>
                    <div style={{
                        fontSize: '4rem',
                        animation: 'floatUpFade 1.5s ease-out forwards',
                        textShadow: '0 4px 12px rgba(0,0,0,0.5)'
                    }}>
                        {sendingFeedback.emoji}
                    </div>
                </div>
            )}
            {/* --- TOP: Progress Bars --- */}
            <div style={{
                display: 'flex', gap: '4px', padding: '12px 10px',
                position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20
            }}>
                {partnerStories.stories.map((_, index) => (
                    <div key={index} style={{
                        flex: 1, height: '2px',
                        background: 'rgba(255, 255, 255, 0.3)',
                        borderRadius: '2px', overflow: 'hidden'
                    }}>
                        <div style={{
                            width: index < currentStoryIndex ? '100%' :
                                index === currentStoryIndex ? `${progress}%` : '0%',
                            height: '100%',
                            background: 'white',
                            // Smooth transition only when moving forward, instant when resetting
                            transition: (index === currentStoryIndex && !isPaused && !isInputFocused) ? 'width 0.05s linear' : 'none'
                        }} />
                    </div>
                ))}
            </div>

            {/* --- TOP: Header (User Info & Close) --- */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '24px 16px', position: 'absolute', top: 0, left: 0, right: 0,
                background: 'linear-gradient(to bottom, rgba(0,0,0,0.4), transparent)',
                zIndex: 20, paddingTop: '30px'
            }}>

                {/* User Profile */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                        width: '36px', height: '36px', borderRadius: '50%',
                        background: `url(${partnerStories.partnerLogo || 'https://via.placeholder.com/150'}) center/cover`,
                        border: '1px solid rgba(255,255,255,0.8)'
                    }} />
                    <div>
                        <div style={{ color: 'white', fontWeight: '600', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {partnerStories.partnerName}
                            <span style={{ opacity: 0.6, fontSize: '0.75rem', fontWeight: '400' }}>{formatDate(currentStory.createdAt)}</span>
                        </div>
                    </div>
                </div>

                {/* Close & Mute */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {currentStory.type === 'video' && (
                        <button onClick={toggleMute} style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.2rem', padding: '4px' }}>
                            {isMuted ? <FaVolumeMute /> : <FaVolumeUp />}
                        </button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); onClose(); }} style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.5rem', padding: '4px' }}>
                        <FaTimes />
                    </button>
                </div>
            </div>

            {/* --- MIDDLE: Story Content --- */}
            <div style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative', overflow: 'hidden', background: '#1a1a1a',
                borderRadius: '16px', // Rounded corners for the story content
                margin: '10px 0' // Small gap from top and bottom bars if needed
            }}>
                {/* Media Layer */}
                {currentStory.url || currentStory.image ? (
                    currentStory.type === 'video' ? (
                        <video
                            src={currentStory.url || currentStory.image}
                            // Important: Loop logic handled by video tag automatically
                            autoPlay loop muted={isMuted} playsInline
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        // If user pauses (holds finger, we can pause video here too if needed, 
                        // but usually stories keep video playing or pause it.
                        // For simplicity, let's keep video playing unless system requires pause.
                        />
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
                        background: currentStory.backgroundColor || 'linear-gradient(135deg, #8b5cf6, #ec4899)'
                    }} />
                )}

                {/* Text Overlay */}
                {currentStory.text && (
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

            {/* --- BOTTOM: Interaction Bar (TikTok Style) --- */}
            <div style={{
                padding: '16px 16px 20px',
                background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)',
                display: 'flex', alignItems: 'center', gap: '12px',
                zIndex: 30 // Ensure it's above everything
            }}>

                {/* Message Input */}
                <div style={{
                    flex: 1, position: 'relative',
                    height: '44px', borderRadius: '22px',
                    border: '1px solid rgba(255,255,255,0.3)',
                    background: 'rgba(0,0,0,0.4)',
                    display: 'flex', alignItems: 'center', padding: '0 48px 0 16px', // Padding right for button
                    transition: 'border-color 0.2s',
                    marginRight: '8px'
                }}>
                    <input
                        type="text"
                        placeholder="Message..."
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onFocus={() => {
                            setIsInputFocused(true);
                            setIsPaused(true);
                        }}
                        onBlur={() => {
                            // Don't resume immediately on blur if we are sending feedback
                            if (!sendingFeedback) {
                                setIsInputFocused(false);
                                setIsPaused(false);
                            }
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.stopPropagation(); // Stop event bubbling
                                handleSendReply();
                            }
                        }}
                        style={{
                            width: '100%', background: 'transparent', border: 'none',
                            color: 'white', fontSize: '0.95rem', outline: 'none'
                        }}
                    />

                    {/* Send Button (Inside Input) */}
                    {replyText.trim() && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleSendReply();
                            }}
                            style={{
                                position: 'absolute',
                                right: '4px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: '#3b82f6',
                                border: 'none',
                                borderRadius: '50%',
                                width: '36px',
                                height: '36px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            <FaPaperPlane size={14} style={{ transform: 'translateX(-1px) translateY(1px)' }} />
                        </button>
                    )}
                </div>

                {/* Quick Actions & Right Buttons */}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>

                    {/* Quick Emojis (Visible only when not typing heavily, or always visible on larger screens) */}
                    {!replyText && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                            {['😍', '🥰', '😂'].map(emoji => (
                                <button
                                    key={emoji}
                                    onClick={(e) => { e.stopPropagation(); handleSendReply(emoji); }}
                                    style={{
                                        background: 'none', border: 'none', fontSize: '1.8rem',
                                        cursor: 'pointer', padding: '0', lineHeight: 1,
                                        transition: 'transform 0.1s active:scale(0.9)'
                                    }}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Like Button */}
                    <button
                        onClick={(e) => { e.stopPropagation(); handleLike(); }}
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'none', border: 'none', color: 'white', gap: '2px', cursor: 'pointer' }}
                    >
                        {hasLiked ? <FaHeart color="#ef4444" size={28} /> : <FaRegHeart size={28} />}
                    </button>
                </div>


            </div>
        </div>,
        document.body
    );
};

export default StoryViewer;
