import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, getDoc, doc, updateDoc } from 'firebase/firestore'; // Added updateDoc
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { FaArrowLeft, FaEllipsisV, FaRegSmile, FaImage, FaPaperPlane, FaPaperclip, FaCamera, FaMicrophone, FaPlus, FaStop, FaPlay, FaPause, FaTrash } from 'react-icons/fa'; // Added icons
import EmojiPicker from 'emoji-picker-react';
import { uploadImage, formatFileSize, startRecording, uploadVoiceMessage } from '../utils/mediaUtils'; // Added media utils
import './CommunityChatRoom.css';

const CommunityChatRoom = () => {
    const { partnerId } = useParams();
    const navigate = useNavigate();
    const { currentUser, userProfile } = useAuth();

    // Real Data State
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [activeReactionId, setActiveReactionId] = useState(null); // New state for reactions
    const [extendedReactionPicker, setExtendedReactionPicker] = useState(null);
    const [partner, setPartner] = useState(null);
    const [isMember, setIsMember] = useState(false);
    const [loading, setLoading] = useState(true);

    // Recording State
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const recordingRef = useRef(null);
    const timerRef = useRef(null);

    // Audio Playback State
    const [playingAudioId, setPlayingAudioId] = useState(null);
    const audioRef = useRef(new Audio());

    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const inputRef = useRef(null);

    const emojiPickerRef = useRef(null);

    // Close Emoji Picker on Click Outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (showEmojiPicker && emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
                if (!event.target.closest('.emoji-trigger-btn')) {
                    setShowEmojiPicker(false);
                }
            }
            if (activeReactionId && !event.target.closest('.reaction-popup-container')) {
                setActiveReactionId(null);
            }
            if (extendedReactionPicker && !event.target.closest('.extended-reaction-picker')) {
                setExtendedReactionPicker(null);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [showEmojiPicker, activeReactionId, extendedReactionPicker]);

    // Cleanup Audio on Unmount
    useEffect(() => {
        return () => {
            audioRef.current.pause();
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    // Reaction handler
    const handleReact = async (msgId, emoji) => {
        try {
            const msgRef = doc(db, 'communities', partnerId, 'messages', msgId);
            const message = messages.find(m => m.id === msgId);
            const currentReactions = message.reactions || {};

            const newReactions = {
                ...currentReactions,
                [currentUser.uid]: emoji
            };

            await updateDoc(msgRef, {
                reactions: newReactions
            });
            setActiveReactionId(null);
        } catch (error) {
            console.error("Error reacting:", error);
        }
    };

    // Close reaction menu on click outside
    useEffect(() => {
        const handleClickOutside = () => setActiveReactionId(null);
        if (activeReactionId) {
            window.addEventListener('click', handleClickOutside);
        }
        return () => window.removeEventListener('click', handleClickOutside);
    }, [activeReactionId]);

    // 1. Fetch Partner & Check Membership
    useEffect(() => {
        const checkAccess = async () => {
            if (!partnerId || !currentUser) return;
            try {
                const partnerDoc = await getDoc(doc(db, 'users', partnerId));
                if (partnerDoc.exists()) {
                    setPartner(partnerDoc.data());

                    // Check membership
                    if (currentUser.uid === partnerId) {
                        setIsMember(true);
                    } else {
                        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
                        const joinedCommunities = userDoc.data()?.joinedCommunities || [];
                        setIsMember(joinedCommunities.includes(partnerId));
                    }
                }
            } catch (error) {
                console.error("Error fetching partner:", error);
            } finally {
                setLoading(false);
            }
        };
        checkAccess();
    }, [partnerId, currentUser]);

    // 2. Subscribe to Messages
    useEffect(() => {
        if (!isMember || !partnerId) return;

        const messagesRef = collection(db, 'communities', partnerId, 'messages');
        const q = query(messagesRef, orderBy('createdAt', 'asc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setMessages(msgs);
        });

        return () => unsubscribe();
    }, [partnerId, isMember]);

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);


    // --- Audio Handlers ---

    const handleStartRecording = async () => {
        try {
            const { stop } = await startRecording();
            recordingRef.current = stop;
            setIsRecording(true);
            setRecordingDuration(0);

            timerRef.current = setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);
        } catch (error) {
            console.error("Failed to start recording:", error);
            alert("Could not access microphone.");
        }
    };

    const handleStopRecording = async (shouldSend = true) => {
        if (!recordingRef.current) return;

        clearInterval(timerRef.current);
        const audioBlob = await recordingRef.current();
        setIsRecording(false);
        setRecordingDuration(0);
        recordingRef.current = null;

        if (shouldSend && audioBlob) {
            await sendVoiceMessage(audioBlob);
        }
    };

    const sendVoiceMessage = async (audioBlob) => {
        try {
            const url = await uploadVoiceMessage(audioBlob, currentUser.uid);
            await addDoc(collection(db, 'communities', partnerId, 'messages'), {
                text: '',
                audioUrl: url,
                senderId: currentUser.uid,
                senderName: userProfile?.display_name || currentUser.displayName || 'User',
                senderAvatar: userProfile?.photo_url || currentUser.photoURL || '',
                createdAt: serverTimestamp(),
                type: 'audio',
                duration: recordingDuration
            });
        } catch (error) {
            console.error("Error sending voice:", error);
        }
    };

    const handlePlayAudio = (url, msgId) => {
        if (playingAudioId === msgId) {
            audioRef.current.pause();
            setPlayingAudioId(null);
        } else {
            audioRef.current.src = url;
            audioRef.current.play();
            setPlayingAudioId(msgId);
            audioRef.current.onended = () => setPlayingAudioId(null);
        }
    };

    const formatDuration = (sec) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // --- Handlers ---

    const handleSendMessage = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (!newMessage.trim()) return;

        try {
            const messagesRef = collection(db, 'communities', partnerId, 'messages');

            // Check for single emoji (big emoji logic)
            // Reuse the logic or a simple check
            const isAvgEmoji = /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?|\p{Emoji_Component}){1,3}$/u.test(newMessage.trim());

            await addDoc(messagesRef, {
                text: newMessage.trim(),
                senderId: currentUser.uid,
                senderName: userProfile?.display_name || currentUser.displayName || 'User',
                senderAvatar: userProfile?.photo_url || currentUser.photoURL || '',
                createdAt: serverTimestamp(),
                type: isAvgEmoji ? 'emoji-big' : 'text' // Auto-detect big emoji
            });

            setNewMessage('');
            setShowEmojiPicker(false);
            setTimeout(() => inputRef.current?.focus(), 100);
        } catch (error) {
            console.error("Error sending message:", error);
        }
    };

    const handleEmojiClick = (emojiData) => {
        setNewMessage(prev => prev + emojiData.emoji);
        // Don't close picker immediately, let them type
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const imageUrl = await uploadImage(file, currentUser.uid);
            const messagesRef = collection(db, 'communities', partnerId, 'messages');

            await addDoc(messagesRef, {
                text: imageUrl,
                caption: '', // Optional caption
                senderId: currentUser.uid,
                senderName: userProfile?.display_name || currentUser.displayName || 'User',
                senderAvatar: userProfile?.photo_url || currentUser.photoURL || '',
                createdAt: serverTimestamp(),
                type: 'image'
            });
        } catch (error) {
            console.error("Error uploading image:", error);
            alert("Failed to upload image");
        }
    };

    // --- Render Helpers ---

    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const renderBubbleContent = (msg) => {
        // Detect Links
        const urlRegex = /(https?:\/\/[^\s]+)/g;

        switch (msg.type) {
            case 'image':
                return (
                    <div className="image-bubble">
                        <img src={msg.text} alt="chat" className="chat-image" />
                        {msg.caption && <div className="image-caption">{msg.caption}</div>}
                    </div>
                );
            case 'emoji-big':
                return (
                    <div className="big-emoji-bubble">
                        <span className="big-emoji">{msg.text}</span>
                    </div>
                );
            case 'audio':
                const isPlaying = playingAudioId === msg.id;
                // Circle math: r=54 -> C = 2*pi*54 ~= 339.292
                const circumference = 339.292;

                return (
                    <div className="voice-widget">
                        <div className="ring-wrap">
                            <svg className="progress-ring" viewBox="0 0 120 120">
                                <circle cx="60" cy="60" r="54" stroke="rgba(0,0,0,0.06)" strokeWidth="12" fill="none" />
                                <circle
                                    cx="60" cy="60" r="54"
                                    stroke="var(--accent)" strokeWidth="12" fill="none" strokeLinecap="round"
                                    style={{
                                        strokeDasharray: circumference,
                                        strokeDashoffset: isPlaying ? 0 : circumference,
                                        transition: isPlaying ? `stroke-dashoffset ${msg.duration || 10}s linear` : 'stroke-dashoffset 0.3s'
                                    }}
                                />
                            </svg>
                            <div className="voice-avatar">
                                <img
                                    src={msg.senderAvatar || `https://ui-avatars.com/api/?name=${msg.senderName}`}
                                    alt={msg.senderName}
                                />
                            </div>
                        </div>

                        <div className="voice-controls">
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                <div className="voice-time">{formatTime(msg.createdAt)}</div>
                            </div>

                            <button className="voice-play-btn" onClick={() => handlePlayAudio(msg.audioUrl, msg.id)}>
                                {isPlaying ? (
                                    <FaPause color="var(--play-green)" size={18} />
                                ) : (
                                    <span className="play-shape"></span>
                                )}
                            </button>
                        </div>
                    </div>
                );
            default:
                // Text with Link detection
                const parts = msg.text.split(urlRegex);
                return (
                    <span>
                        {parts.map((part, i) =>
                            urlRegex.test(part) ? (
                                <a key={i} href={part} target="_blank" rel="noopener noreferrer">{part}</a>
                            ) : (
                                <span key={i}>{part}</span>
                            )
                        )}
                    </span>
                );
        }
    };

    if (loading) return <div className="chat-screen" style={{ justifyContent: 'center', alignItems: 'center', color: 'white' }}>Loading...</div>;

    if (!isMember) {
        return (
            <div className="chat-screen" style={{ justifyContent: 'center', alignItems: 'center', color: 'white' }}>
                <h2>Access Denied</h2>
                <button onClick={() => navigate('/communities')} style={{ padding: '10px', marginTop: '10px' }}>Go Back</button>
            </div>
        );
    }

    return (
        <div className="chat-screen">
            {/* 1. Glass Header */}
            <header className="chat-header">
                <button className="header-back-btn" onClick={() => navigate(-1)}>
                    <FaArrowLeft />
                </button>
                <div className="header-info" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', marginLeft: '8px' }}>
                    <img
                        src={partner?.businessInfo?.logoImage || partner?.logoImage || partner?.photo_url || `https://ui-avatars.com/api/?name=${partner?.display_name || 'Community'}`}
                        alt=""
                        style={{ width: '40px', height: '40px', borderRadius: '50%', marginRight: '10px', objectFit: 'cover' }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <h1 className="header-title" style={{ fontSize: '16px' }}>{partner?.display_name || 'Community Chat'}</h1>
                        <span className="header-subtitle" style={{ fontSize: '12px' }}>{partner?.communityMembers?.length || 0} members</span>
                    </div>
                </div>
                <button className="header-menu-btn">
                    <FaEllipsisV />
                </button>
            </header>

            {/* 2. Message List */}
            {/* 2. Message List */}
            <div className="message-list">
                {messages.map((msg, index) => {
                    const isMe = msg.senderId === currentUser.uid;
                    const isBigEmoji = msg.type === 'emoji-big';

                    // Check previous message for grouping
                    const prevMsg = messages[index - 1];
                    const isFirstOfGroup = !prevMsg || prevMsg.senderId !== msg.senderId;

                    // Get reactions count/display
                    const reactions = Object.values(msg.reactions || {});
                    const hasReactions = reactions.length > 0;
                    // Most recent/popular reaction to show? Just show distinct ones briefly or counts
                    const distinctReactions = [...new Set(reactions)].slice(0, 3);

                    return (
                        <div
                            key={msg.id}
                            className={`message-row ${isMe ? 'outgoing' : 'incoming'} ${isBigEmoji ? 'emoji-center' : ''} ${isFirstOfGroup ? 'first-of-group' : ''}`}
                            style={{
                                ...(isBigEmoji ? { justifyContent: 'center' } : {}),
                                position: 'relative', // Needed for centering popup within row
                                marginTop: isFirstOfGroup ? '6px' : '0px'
                            }}
                            onContextMenu={(e) => {
                                e.preventDefault();
                                setActiveReactionId(msg.id);
                            }}
                        >
                            {/* Avatar for Incoming */}
                            {!isMe && !isBigEmoji && (
                                <img
                                    src={msg.senderAvatar || `https://ui-avatars.com/api/?name=${msg.senderName}`}
                                    alt=""
                                    className="sender-avatar"
                                />
                            )}

                            {/* Bubble */}
                            <div className={`bubble ${isBigEmoji ? 'big-emoji-bubble' : ''} ${msg.type === 'audio' ? 'bubble-audio-transparent' : ''}`} style={{ position: 'relative' }}>

                                {/* Sender Name (Optional, small on top?) - skipping for clean minimalist look requested */}

                                {renderBubbleContent(msg)}

                                {/* Timestamp */}
                                {!isBigEmoji && msg.type !== 'audio' && (
                                    <span className="timestamp">{formatTime(msg.createdAt)}</span>
                                )}

                                {/* Reaction Badge (Displayed on message) */}
                                {hasReactions && !isBigEmoji && (
                                    <div className="message-reaction-badge">
                                        {distinctReactions.map((r, i) => <span key={i}>{r}</span>)}
                                        {reactions.length > 1 && <span style={{ marginLeft: '2px', color: '#9CA3AF' }}>{reactions.length}</span>}
                                    </div>
                                )}
                            </div>

                            {/* Reaction Popup Menu - MOVED OUTSIDE BUBBLE */}
                            {activeReactionId === msg.id && (
                                <div className="reaction-popup-container" onClick={(e) => e.stopPropagation()}>
                                    {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => (
                                        <span
                                            key={emoji}
                                            className="reaction-popup-item"
                                            onClick={() => handleReact(msg.id, emoji)}
                                        >
                                            {emoji}
                                        </span>
                                    ))}
                                    {/* Mock Plus Button -> Real Button */}
                                    <div
                                        className="reaction-popup-item"
                                        style={{ background: '#374151', borderRadius: '50%', padding: '2px', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px' }}
                                        onClick={() => {
                                            setExtendedReactionPicker(msg.id);
                                            setActiveReactionId(null);
                                        }}
                                    >
                                        <FaPlus style={{ color: '#9CA3AF' }} />
                                    </div>
                                </div>
                            )}

                            {/* Extended Emoji Picker for Reactions */}
                            {extendedReactionPicker === msg.id && (
                                <div className="extended-reaction-picker" style={{ position: 'absolute', bottom: '40px', left: '0', zIndex: 1001 }} onClick={(e) => e.stopPropagation()}>
                                    <EmojiPicker
                                        onEmojiClick={(emojiObject) => {
                                            handleReact(msg.id, emojiObject.emoji);
                                            setExtendedReactionPicker(null);
                                        }}
                                        width="300px"
                                        height="350px"
                                        theme="dark"
                                        searchPlaceholder="Search reaction..."
                                        previewConfig={{ showPreview: false }}
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>


            {/* 3. Composer */}
            <div className="input-area">
                {showEmojiPicker && (
                    <div className="emoji-picker-container" ref={emojiPickerRef}>
                        <EmojiPicker
                            onEmojiClick={handleEmojiClick}
                            theme="dark"
                            width={300}
                            height={350}
                        />
                    </div>
                )}

                <div className="input-wrapper">
                    {isRecording ? (
                        /* RECORDING UI */
                        <div className="recording-ui">
                            <div className="recording-info">
                                <FaMicrophone className="recording-pulse" />
                                <span className="recording-timer">{formatDuration(recordingDuration)}</span>
                            </div>
                            <span className="recording-text" style={{ flex: 1, textAlign: 'center' }}>Slide to cancel</span> {/* Visual hint */}
                            <button
                                className="composer-icon-btn delete-recording-btn"
                                onClick={() => handleStopRecording(false)}
                                title="Cancel"
                            >
                                <FaTrash />
                            </button>
                        </div>
                    ) : (
                        /* NORMAL INPUT UI */
                        <>
                            <button className="composer-icon-btn emoji-trigger-btn" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                                <FaRegSmile />
                            </button>

                            <input
                                ref={inputRef}
                                type="text"
                                className="message-input"
                                placeholder="Message"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(e)}
                            />

                            {/* Right side icons inside bar */}
                            <input
                                type="file"
                                ref={fileInputRef}
                                hidden
                                accept="image/*"
                                onChange={handleImageUpload}
                            />
                            <button className="composer-icon-btn" onClick={() => {/* Handle file attachment mock */ }}>
                                <FaPaperclip style={{ transform: 'rotate(45deg)' }} />
                            </button>
                            <button className="composer-icon-btn" onClick={() => fileInputRef.current?.click()}>
                                <FaCamera />
                            </button>
                        </>
                    )}
                </div>

                {/* Mic or Send Button */}
                <button
                    type="button"
                    className="send-btn-circle"
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={isRecording ? () => handleStopRecording(true) : handleSendMessage}
                    style={isRecording ? { background: '#ef4444' } : {}}
                >
                    {isRecording ? (
                        <FaPaperPlane />
                    ) : (
                        newMessage.trim() ? (
                            <FaPaperPlane style={{ marginLeft: '-2px' }} />
                        ) : (
                            <FaMicrophone onClick={(e) => { e.stopPropagation(); handleStartRecording(); }} />
                        )
                    )}
                </button>
            </div>
        </div>
    );
};

export default CommunityChatRoom;
