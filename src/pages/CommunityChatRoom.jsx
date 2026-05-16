import { useTranslation } from 'react-i18next';
import React, { Suspense, lazy, useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, getDoc, doc, updateDoc } from 'firebase/firestore'; // Added updateDoc
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useInvitations } from '../context/InvitationContext';
import {
    FaArrowLeft, FaEllipsisV, FaImage, FaPaperPlane,
    FaCamera, FaMicrophone, FaPlus, FaStop,
    FaPlay, FaPause, FaTrash, FaArrowDown
} from 'react-icons/fa';
import EmojiPickerPortal, { isTouchOrCoarsePointer } from '../components/EmojiPickerPortal';
import { uploadImage, formatFileSize, startRecording, uploadVoiceMessage } from '../utils/mediaUtils';
import { getSafeAvatar } from '../utils/avatarUtils';
import UserAvatar from '../components/UserAvatar';
import { buildFollowPlusProps } from '../utils/followPlusUi';
import { createNotification } from '../utils/notificationHelpers';
import SharedContentBubble from '../components/SharedContentBubble';
import UnifiedCamera from '../components/UnifiedCamera';
import './CommunityChatRoom.css';
import { attachChatShellToVisualViewport } from '../utils/chatVisualViewportLock';

const LazyEmojiPicker = lazy(() => import('emoji-picker-react'));

const CommunityChatRoom = () => {
    const { t, i18n } = useTranslation();
    const { partnerId } = useParams();
    const navigate = useNavigate();
    const { currentUser, userProfile } = useAuth();
    const { showToast } = useToast();
    const { currentUser: invCurrentUser, toggleFollow } = useInvitations();

    const communityFollowCtx = useMemo(
        () => ({ currentUser: invCurrentUser, userProfile, toggleFollow, showToast, t }),
        [invCurrentUser, userProfile, toggleFollow, showToast, t]
    );

    // Real Data State
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [activeReactionId, setActiveReactionId] = useState(null);
    const [extendedReactionPicker, setExtendedReactionPicker] = useState(null);
    const [partner, setPartner] = useState(null);
    const [isMember, setIsMember] = useState(false);
    const [loading, setLoading] = useState(true);
    const [showScrollBottom, setShowScrollBottom] = useState(false);
    const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
    const [showCamera, setShowCamera] = useState(false);

    const partnerForHeader = useMemo(
        () => ({ ...(partner || {}), id: partnerId, uid: partnerId }),
        [partner, partnerId]
    );

    const partnerHeaderFollowPlus = useMemo(
        () => buildFollowPlusProps(partnerForHeader, communityFollowCtx),
        [partnerForHeader, communityFollowCtx]
    );

    const emojiBtnRef = useRef(null);
    const isTouchUi = isTouchOrCoarsePointer();

    const handleScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
        setShowScrollBottom(!isNearBottom);
    };

    const handleEmojiClick = (emojiData) => {
        const emoji = emojiData.emoji;
        const input = inputRef.current;
        
        setNewMessage(prevMessage => {
            if (input) {
                const s = input.selectionStart ?? prevMessage.length;
                const e = input.selectionEnd ?? prevMessage.length;
                
                // DO NOT focus the input here, because focusing opens the keyboard and closes the emoji panel
                // Just update the selection range after the state updates
                setTimeout(() => {
                    input.setSelectionRange(s + emoji.length, s + emoji.length);
                }, 10);
                
                return prevMessage.slice(0, s) + emoji + prevMessage.slice(e);
            } else {
                return prevMessage + emoji;
            }
        });
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Recording State removed (business group logic)

    // Audio Playback State
    const [playingAudioId, setPlayingAudioId] = useState(null);
    const audioRef = useRef(new Audio());

    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const inputRef = useRef(null);
    const composerRef = useRef(null);
    const containerRef = useRef(null);

    useEffect(() => {
        const { detach } = attachChatShellToVisualViewport(() => containerRef.current);
        return detach;
    }, []);

    // Close Popups on Click Outside
    useEffect(() => {
        function handleClickOutside(event) {
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
    }, [activeReactionId, extendedReactionPicker]);

    // Cleanup Audio on Unmount
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
            }
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
            if (!partnerId || !currentUser || !userProfile) return;
            try {
                // If partner profile hasn't been fetched yet, get it
                if (!partner) {
                    const partnerDoc = await getDoc(doc(db, 'users', partnerId));
                    if (partnerDoc.exists()) {
                        setPartner(partnerDoc.data());
                    }
                }

                // Check membership locally from context
                if (currentUser.uid === partnerId) {
                    setIsMember(true);
                } else {
                    const joinedCommunities = userProfile.joinedCommunities || [];
                    setIsMember(joinedCommunities.includes(partnerId));
                }
            } catch (error) {
                console.error("Error verifying access:", error);
            } finally {
                setLoading(false);
            }
        };
        checkAccess();
    }, [partnerId, currentUser, userProfile]);

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

    // Mark community as read when user opens the chat room
    useEffect(() => {
        if (!isMember || !partnerId || !currentUser?.uid) return;

        const markAsRead = async () => {
            try {
                await updateDoc(doc(db, 'users', currentUser.uid), {
                    [`communityLastRead.${partnerId}`]: serverTimestamp()
                });
            } catch (err) {
                // Fail silently — not critical
            }
        };

        markAsRead();
    }, [isMember, partnerId, currentUser?.uid]);

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);


    // --- Audio Handlers ---

    // (Recording handlers removed)

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

            const str = newMessage.trim();
            let isAvgEmoji = false;
            try {
                const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
                const graphemes = Array.from(segmenter.segment(str));
                isAvgEmoji = graphemes.length === 1 && /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?|\p{Emoji_Component})+$/u.test(str);
            } catch (e) {
                isAvgEmoji = Array.from(str).length <= 2 && /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?|\p{Emoji_Component})+$/u.test(str);
            }

            await addDoc(messagesRef, {
                text: newMessage.trim(),
                senderId: currentUser.uid,
                senderName: userProfile?.display_name || currentUser.displayName || 'User',
                senderAvatar: getSafeAvatar(userProfile || currentUser),
                createdAt: serverTimestamp(),
                type: isAvgEmoji ? 'emoji-big' : 'text'
            });

            setNewMessage('');
            setTimeout(() => inputRef.current?.focus(), 100);

            // Notify the business owner when a member sends a message (not the owner themselves)
            if (currentUser.uid !== partnerId) {
                createNotification({
                    userId: partnerId,
                    type: 'message',
                    title: userProfile?.display_name || 'New message in your community',
                    message: newMessage.trim().slice(0, 80),
                    actionUrl: `/community/${partnerId}`
                }).catch(() => { });
            }
        } catch (error) {
            console.error("Error sending message:", error);
            showToast(t('failed_send_message'), 'error');
        }
    };



    const handleCameraCapture = async (file) => {
        if (!file) return;

        try {
            setShowCamera(false);
            const imageUrl = await uploadImage(file, currentUser.uid);
            const messagesRef = collection(db, 'communities', partnerId, 'messages');

            await addDoc(messagesRef, {
                text: imageUrl,
                caption: '',
                senderId: currentUser.uid,
                senderName: userProfile?.display_name || currentUser.displayName || 'User',
                senderAvatar: getSafeAvatar(userProfile || currentUser),
                createdAt: serverTimestamp(),
                type: 'image'
            });
        } catch (error) {
            console.error("Error uploading image:", error);
            showToast(t('failed_upload_image'), 'error');
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
            case 'shared_content':
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <SharedContentBubble data={msg.sharedContent} />
                        {msg.text && <span dir="auto">{msg.text}</span>}
                    </div>
                );
            case 'image':
                return (
                    <div className="image-bubble">
                        <img src={msg.text} alt="chat" className="chat-image" />
                        {msg.caption && <div className="image-caption">{msg.caption}</div>}
                    </div>
                );
            case 'emoji-big':
                const isMe = msg.senderId === currentUser.uid;
                return (
                    <div className="big-emoji-bubble" style={{ 
                        position: 'relative', 
                        display: 'flex', 
                        alignItems: 'center', 
                        // The container just holds them naturally.
                    }}>
                        {!isMe && (
                            <UserAvatar 
                                src={msg.senderAvatar} 
                                user={{ avatar: msg.senderAvatar }}
                                alt="Avatar" 
                                style={{ 
                                    width: '110px', 
                                    height: '110px', 
                                    objectFit: 'cover', 
                                    zIndex: 1,
                                    marginInlineEnd: '-50px',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                                    borderRadius: '50%',
                                    overflow: 'hidden',
                                    flexShrink: 0
                                }} 
                            />
                        )}
                        
                        <span className="big-emoji" style={{ position: 'relative', zIndex: 2 }}>{msg.text}</span>

                        {isMe && (
                            <UserAvatar 
                                src={msg.senderAvatar} 
                                user={{ avatar: msg.senderAvatar }}
                                alt="Avatar" 
                                style={{ 
                                    width: '110px', 
                                    height: '110px', 
                                    objectFit: 'cover', 
                                    zIndex: 1,
                                    marginInlineStart: '-50px',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                                    borderRadius: '50%',
                                    overflow: 'hidden',
                                    flexShrink: 0
                                }} 
                            />
                        )}
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
                                <UserAvatar
                                    src={msg.senderAvatar}
                                    user={{ avatar: msg.senderAvatar }}
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

    if (loading) return <div className="chat-screen" style={{ justifyContent: 'center', alignItems: 'center', color: 'var(--text-primary)' }}>Loading...</div>;

    if (!isMember) {
        return (
            <div className="chat-screen" style={{ justifyContent: 'center', alignItems: 'center', color: 'var(--text-primary)' }}>
                <h2>{t("access_denied")}</h2>
                <button onClick={() => navigate('/communities')} style={{ padding: '10px', marginTop: '10px' }}>{t("go_back")}</button>
            </div>
        );
    }

    return (
        <div dir="ltr" ref={containerRef} className="chat-room-container chat-screen community-chat-root" style={{
            display: 'flex', flexDirection: 'column',
            background: 'var(--bg-color)',
            overflow: 'hidden'
        }}>
            {/* 1. Glass Header */}
            <header className="chat-header">
                <button className="header-back-btn" onClick={() => navigate('/communities')} style={{ color: 'var(--text-primary)' }}>
                    <FaArrowLeft size={20} style={{ transform: i18n.language === 'ar' ? 'rotate(180deg)' : 'none' }} />
                </button>
                <div className="header-info" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', marginInlineStart: '8px', flex: 1, minWidth: 0 }}>
                    <UserAvatar
                        user={partnerForHeader}
                        alt=""
                        followPlus={partnerHeaderFollowPlus || undefined}
                        followBadgeSize={14}
                        style={{ width: '40px', height: '40px', minWidth: '40px', minHeight: '40px', maxWidth: '40px', maxHeight: '40px', flexShrink: 0, marginInlineEnd: '10px', objectFit: 'cover' }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                        <h1 className="header-title" style={{ fontSize: '16px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>{partner?.display_name || t('community_chat')}</h1>
                        <span className="header-subtitle" style={{ fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>{partner?.communityMembers?.length || 0} {t("members")}</span>
                    </div>
                </div>
                <button className="header-menu-btn">
                    <FaEllipsisV />
                </button>
            </header>

            <div className="chat-body-column">
            {/* 2. Message List */}
            <div className="message-list" onScroll={handleScroll} style={{ paddingBottom: '16px', flex: 1, overflowY: 'auto' }}>
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
                            className={`message-row ${isMe ? 'outgoing' : 'incoming'} ${isFirstOfGroup ? 'first-of-group' : ''}`}
                            style={{
                                position: 'relative', // Needed for centering popup within row
                                marginTop: isFirstOfGroup ? '6px' : '0px'
                            }}
                            onContextMenu={(e) => {
                                e.preventDefault();
                                setActiveReactionId(msg.id);
                            }}
                        >
                            {/* Avatar column for incoming messages */}
                            {!isMe && !isBigEmoji && (
                                <UserAvatar
                                    src={msg.senderAvatar}
                                    user={{ avatar: msg.senderAvatar }}
                                    alt=""
                                    className="sender-avatar"
                                    style={{ visibility: isFirstOfGroup ? 'visible' : 'hidden', alignSelf: 'flex-start' }}
                                />
                            )}

                            {/* Bubble */}
                            <div className={`bubble ${isBigEmoji ? 'big-emoji-bubble' : ''} ${msg.type === 'audio' ? 'bubble-audio-transparent' : ''}`} style={{ position: 'relative' }}>

                                {/* Sender name inside bubble */}
                                {!isMe && isFirstOfGroup && (
                                    <div style={{
                                        width: '100%',
                                        fontSize: '11px',
                                        fontWeight: '700',
                                        color: 'var(--accent-color)',
                                        marginBottom: '2px'
                                    }}>
                                        {msg.senderName}
                                    </div>
                                )}

                                <div style={{ display: 'flex', alignItems: 'flex-end', flexWrap: 'wrap', gap: '4px 12px' }}>
                                    <div style={{ flex: '1 1 auto', margin: 0, minWidth: 0, wordBreak: 'break-word', paddingTop: '2px' }}>
                                        {renderBubbleContent(msg)}
                                    </div>

                                    {/* Timestamp */}
                                    {!isBigEmoji && msg.type !== 'audio' && (
                                        <span className="timestamp" style={{ margin: '0 0 0 auto', display: 'flex', flexShrink: 0, color: isMe ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)' }}>
                                            {formatTime(msg.createdAt)}
                                        </span>
                                    )}
                                </div>

                                {/* Reaction Badge (Displayed on message) */}
                                {hasReactions && (
                                    <div className="message-reaction-badge">
                                        {distinctReactions.map((r, i) => <span key={i}>{r}</span>)}
                                        {reactions.length > 1 && <span style={{ marginInlineStart: '2px', color: '#9CA3AF' }}>{reactions.length}</span>}
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
                                    {!isTouchUi && (
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
                                    )}
                                </div>
                            )}

                            {/* Extended Emoji Picker for Reactions (desktop) */}
                            {extendedReactionPicker === msg.id && !isTouchUi && (
                                <div className="extended-reaction-picker" style={{ position: 'absolute', bottom: '40px', insetInlineStart: '0', zIndex: 1001 }} onClick={(e) => e.stopPropagation()}>
                                    <Suspense fallback={<div style={{ width: 300, height: 350, background: '#111827' }} />}>
                                        <LazyEmojiPicker
                                            onEmojiClick={(emojiObject) => {
                                                handleReact(msg.id, emojiObject.emoji);
                                                setExtendedReactionPicker(null);
                                            }}
                                            width="300px"
                                            height="350px"
                                            theme="dark"
                                            searchDisabled={true}
                                            previewConfig={{ showPreview: false }}
                                        />
                                    </Suspense>
                                </div>
                            )}
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />

                {showScrollBottom && (
                    <button
                        type="button"
                        className="chat-scroll-fab"
                        onClick={scrollToBottom}
                        style={{
                            background: 'var(--accent)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '50%',
                            width: '40px',
                            height: '40px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                            transition: 'all 0.3s ease'
                        }}
                    >
                        <FaArrowDown />
                    </button>
                )}
            </div>


            <div className="chat-footer-stack">
            <div ref={composerRef} style={{
                flexShrink: 0,
                width: '100%',
                boxSizing: 'border-box',
                background: 'var(--bg-darker)',
                borderTop: '1px solid var(--border-color)',
                padding: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
            }}>
                {/* Input Wrapper */}
                <div className="input-wrapper" style={{
                    flex: 1, display: 'flex', alignItems: 'center',
                    background: 'var(--composer-bg)', borderRadius: '24px', padding: '4px 12px',
                    border: '1px solid var(--border-color)'
                }}>
                    <input
                        ref={inputRef}
                        type="text"
                        className="message-input"
                        placeholder={t("message_placeholder")}
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(e)}
                    />
                    {!isTouchUi && (
                        <button
                            ref={emojiBtnRef}
                            type="button"
                            onClick={() => setEmojiPickerOpen((o) => !o)}
                            style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '0 8px', fontSize: '1.3rem', flexShrink: 0, display: 'flex', alignItems: 'center' }}
                            title="Emoji"
                        >
                            😊
                        </button>
                    )}
                    <button className="composer-icon-btn" onClick={() => setShowCamera(true)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '0 4px' }}>
                        <FaCamera />
                    </button>
                </div>

                {/* Send Button */}
                <button type="button" className="send-btn-circle"
                    onMouseDown={(e) => {
                        e.preventDefault();
                        handleSendMessage(e);
                    }}
                    style={{
                        background: 'var(--primary)',
                        color: 'white', border: 'none', borderRadius: '50%',
                        width: '45px', height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', flexShrink: 0, boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
                        opacity: newMessage.trim() ? 1 : 0.5,
                        pointerEvents: newMessage.trim() ? 'auto' : 'none'
                    }}
                >
                    <FaPaperPlane style={{ marginInlineStart: '-2px' }} />
                </button>
            </div>

            {!isTouchUi && (
                <EmojiPickerPortal
                    open={emojiPickerOpen}
                    onClose={() => setEmojiPickerOpen(false)}
                    anchorRef={emojiBtnRef}
                    onEmojiClick={handleEmojiClick}
                />
            )}
            </div>
            </div>

            {/* Camera Overlay */}
            {showCamera && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100000 }}>
                    <UnifiedCamera
                        stopCamera={() => setShowCamera(false)}
                        onMediaCaptured={(file, previewUrl, type) => {
                            if (type === 'video') { setShowCamera(false); return; }
                            handleCameraCapture(file);
                        }}
                        maxDuration={0}
                        mode="photo"
                    />
                </div>
            )}
        </div>
    );
};

export default CommunityChatRoom;
