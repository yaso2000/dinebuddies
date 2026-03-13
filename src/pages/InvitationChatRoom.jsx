
import React, { Suspense, lazy, useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, getDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
    FaArrowLeft, FaPaperPlane, FaMicrophone, FaTrash,
    FaPlay, FaPause, FaArrowDown, FaImage, FaPlus, FaUsers
} from 'react-icons/fa';
import { startRecording, uploadVoiceMessage, uploadImage, formatDuration } from '../utils/mediaUtils';
import { getSafeAvatar } from '../utils/avatarUtils';
import EmojiPickerPortal, { isMobile } from '../components/EmojiPickerPortal';
import './CommunityChatRoom.css';

const LazyEmojiPicker = lazy(() => import('emoji-picker-react'));

const InvitationChatRoom = () => {
    const { id: invitationId } = useParams();
    const navigate = useNavigate();
    const { currentUser, userProfile, isGuest } = useAuth();
    const { showToast } = useToast();

    const [loading, setLoading] = useState(true);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [invitation, setInvitation] = useState(null);
    // Tracks which Firestore collection this invitation lives in
    const [collectionName, setCollectionName] = useState('invitations');

    useEffect(() => {
        if (!loading && (!currentUser || isGuest)) {
            navigate('/login');
        }
    }, [currentUser, isGuest, loading, navigate]);
    const [showScrollBottom, setShowScrollBottom] = useState(false);

    // Reaction State
    const [activeReactionId, setActiveReactionId] = useState(null);
    const [extendedReactionPicker, setExtendedReactionPicker] = useState(null);

    // Refs
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const fileInputRef = useRef(null);
    const emojiBtnRef = useRef(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    // Audio State
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const recordingRef = useRef(null);
    const timerRef = useRef(null);
    const [playingAudioId, setPlayingAudioId] = useState(null);
    const audioRef = useRef(new Audio());

    // --- 1. Fetch Invitation & Verify Access ---
    useEffect(() => {
        const fetchInvitation = async () => {
            if (!invitationId) return;
            // Wait for auth to be ready before trying to verify membership
            if (!currentUser || !currentUser.uid) return;
            try {
                // Try public invitations first, fall back to private
                let invSnap = await getDoc(doc(db, 'invitations', invitationId));
                let resolvedCollection = 'invitations';

                if (!invSnap.exists()) {
                    invSnap = await getDoc(doc(db, 'private_invitations', invitationId));
                    resolvedCollection = 'private_invitations';
                }

                if (invSnap.exists()) {
                    const data = invSnap.data();
                    setInvitation(data);
                    setCollectionName(resolvedCollection);

                    // Robust Access Check
                    const hostId = data.authorId || data.author?.id;
                    const isHost = hostId === currentUser.uid;

                    const members = data.joinedMembers || data.joined || [];
                    const isPrivateAccepted = resolvedCollection === 'private_invitations' &&
                        data.rsvps?.[currentUser.uid] === 'accepted';
                    const isParticipant = members.includes(currentUser.uid) || isPrivateAccepted;

                    if (!isHost && !isParticipant) {
                        showToast("You are not a member of this invitation group chat.", 'error');
                        navigate(resolvedCollection === 'private_invitations' ? `/invitation/private/${invitationId}` : `/invitation/${invitationId}`);
                    }
                } else {
                    navigate('/', { replace: true, state: { message: 'This invitation has ended.' } });
                }
            } catch (error) {
                console.error("Error fetching invitation:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchInvitation();
    }, [invitationId, currentUser?.uid, navigate]);

    // Resilience: if invitation is deleted while in chat (e.g. by Cloud Function), redirect to home
    useEffect(() => {
        if (!invitationId || !collectionName || !invitation) return;
        const invRef = doc(db, collectionName, invitationId);
        const unsubscribe = onSnapshot(invRef, (snapshot) => {
            if (!snapshot.exists()) {
                navigate('/', { replace: true, state: { message: 'This invitation has ended.' } });
            }
        }, (err) => {
            console.error('Invitation snapshot error:', err);
        });
        return () => unsubscribe();
    }, [invitationId, collectionName, invitation, navigate]);

    // Click Outside Handling
    useEffect(() => {
        function handleClickOutside(event) {
            if (activeReactionId && !event.target.closest('.reaction-popup-container') && !event.target.closest('.bubble')) {
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

    // --- 2. Real-time Messages ---
    useEffect(() => {
        if (!invitationId || !collectionName) return;

        const q = query(
            collection(db, collectionName, invitationId, 'messages'),
            orderBy('createdAt', 'asc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setMessages(msgs);
            setTimeout(scrollToBottom, 100);
        });

        return () => unsubscribe();
    }, [invitationId, collectionName]);

    // Cleanup Audio
    useEffect(() => {
        return () => {
            audioRef.current.pause();
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    // --- Handlers ---

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
        setShowScrollBottom(!isNearBottom);
    };

    // Image Handlers
    const handleImageClick = () => {
        fileInputRef.current?.click();
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const imageUrl = await uploadImage(file, currentUser.uid);
            await addDoc(collection(db, collectionName, invitationId, 'messages'), {
                text: '',
                imageUrl: imageUrl,
                senderId: currentUser.uid,
                senderName: userProfile?.display_name || currentUser.displayName || 'User',
                senderAvatar: getSafeAvatar(userProfile || currentUser),
                createdAt: serverTimestamp(),
                type: 'image'
            });
            scrollToBottom();
        } catch (error) {
            console.error("Error uploading image:", error);
            showToast('Failed to send image. Try again.', 'error');
        } finally {
            e.target.value = '';
        }
    };

    // Reaction Handlers
    const handleReact = async (msgId, emoji) => {
        try {
            setActiveReactionId(null); // Close popup
            const msgRef = doc(db, collectionName, invitationId, 'messages', msgId);
            const message = messages.find(m => m.id === msgId);
            const currentReactions = message.reactions || {};

            // Toggle reaction: if same emoji exists for user, remove it
            let newReactions = { ...currentReactions };

            if (newReactions[currentUser.uid] === emoji) {
                delete newReactions[currentUser.uid];
            } else {
                newReactions[currentUser.uid] = emoji;
            }

            await updateDoc(msgRef, {
                reactions: newReactions
            });
        } catch (error) {
            console.error("Error reacting:", error);
        }
    };

    // Voice Handlers
    const handleStartRecording = async () => {
        try {
            const start = await startRecording();
            recordingRef.current = start.stop;
            setIsRecording(true);
            setRecordingDuration(0);

            timerRef.current = setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);
        } catch (error) {
            console.error("Mic Error:", error);
            showToast('Could not access microphone.', 'error');
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
            await addDoc(collection(db, collectionName, invitationId, 'messages'), {
                text: '',
                audioUrl: url,
                senderId: currentUser.uid,
                senderName: userProfile?.display_name || currentUser.displayName || 'User',
                senderAvatar: getSafeAvatar(userProfile || currentUser),
                createdAt: serverTimestamp(),
                type: 'audio',
                duration: recordingDuration
            });
            scrollToBottom();
        } catch (error) {
            console.error("Error sending voice:", error);
            showToast('Failed to send voice message. Try again.', 'error');
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

    // Text Handler
    const handleSendMessage = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (!newMessage.trim()) return;

        const text = newMessage.trim();

        try {
            await addDoc(collection(db, collectionName, invitationId, 'messages'), {
                text: text,
                senderId: currentUser.uid,
                senderName: userProfile?.display_name || currentUser.displayName || 'User',
                senderAvatar: getSafeAvatar(userProfile || currentUser),
                createdAt: serverTimestamp(),
                type: 'text'
            });
            setNewMessage('');
            scrollToBottom();
            setTimeout(() => inputRef.current?.focus(), 10);
        } catch (error) {
            console.error("Error sending:", error);
            showToast('Failed to send message. Try again.', 'error');
        }
    };

    // Group Consecutive Messages
    const isConsecutive = (current, prev) => {
        if (!prev) return false;
        return current.senderId === prev.senderId;
    };

    // Format Time Helper
    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    if (loading) return (
        <div className="chat-screen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading Chat...</div>
        </div>
    );

    // Invitation image helper
    const invImage = invitation?.customImage || invitation?.restaurantImage || invitation?.image;

    return (
        <div className="chat-screen" style={{
            height: '100dvh', overflow: 'hidden', position: 'relative'
        }}>

            {/* Subtle dot-grid overlay for depth */}
            <div style={{
                position: 'absolute', inset: 0,
                backgroundImage: 'radial-gradient(circle, var(--accent-color, rgba(99,102,241,0.06)) 1px, transparent 1px)',
                backgroundSize: '26px 26px', opacity: 0.08,
                pointerEvents: 'none', zIndex: 0
            }} />

            {/* ══════════  HEADER  ══════════ */}
            <header style={{
                flexShrink: 0,
                position: 'sticky', top: 0, zIndex: 50,
                overflow: 'hidden',
                background: 'var(--header-bg)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                borderBottom: '1px solid var(--border-color, rgba(99,102,241,0.15))',
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            }}>
                {/* Invitation image ghost behind header */}
                {invImage && (
                    <div style={{
                        position: 'absolute', inset: 0,
                        backgroundImage: `url(${invImage})`,
                        backgroundSize: 'cover', backgroundPosition: 'center',
                        opacity: 0.07, filter: 'blur(10px)', transform: 'scale(1.15)',
                        pointerEvents: 'none',
                    }} />
                )}

                {/* Top row: back + avatar + info + members */}
                <div style={{
                    position: 'relative', zIndex: 1,
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 14px',
                    minHeight: '64px',
                }}>
                    {/* Back btn */}
                    <button
                        onClick={() => navigate(
                            collectionName === 'private_invitations'
                                ? `/invitation/private/${invitationId}`
                                : `/invitation/${invitationId}`,
                            { replace: true }
                        )}
                        style={{
                            background: 'rgba(108,92,231,0.15)',
                            border: '1px solid rgba(108,92,231,0.3)',
                            color: 'var(--text-primary)', width: '36px', height: '36px',
                            borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', flexShrink: 0, transition: 'all 0.2s',
                        }}
                    >
                        <FaArrowLeft size={14} />
                    </button>

                    {/* Host avatar with gold ring + HOST badge */}
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                        <img
                            src={getSafeAvatar(invitation?.author)}
                            alt="Host"
                            style={{
                                width: '44px', height: '44px', borderRadius: '50%',
                                objectFit: 'cover',
                                border: '2px solid #fbbf24',
                                boxShadow: '0 0 14px rgba(251,191,36,0.35)',
                            }}
                            onError={(e) => { e.target.onerror = null; e.target.src = getSafeAvatar(null); }}
                        />
                        <div style={{
                            position: 'absolute', bottom: '-4px', left: '50%', transform: 'translateX(-50%)',
                            background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                            color: '#000', fontSize: '6.5px', fontWeight: '900',
                            padding: '1.5px 4px', borderRadius: '4px', letterSpacing: '0.5px',
                            whiteSpace: 'nowrap', boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                        }}>HOST</div>
                    </div>

                    {/* Invitation title + location + date */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <h2 style={{
                            margin: '0 0 3px', fontSize: '0.92rem', fontWeight: '800',
                            color: 'var(--text-primary)', whiteSpace: 'nowrap',
                            overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2,
                        }}>
                            {invitation?.title || 'Group Chat'}
                        </h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                            {invitation?.location && (
                                <span style={{
                                    fontSize: '0.68rem', color: 'var(--text-muted)',
                                    display: 'flex', alignItems: 'center', gap: '2px',
                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '130px',
                                }}>
                                    📍 {invitation.location}
                                </span>
                            )}
                            {invitation?.date && (
                                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                                    📅 {new Date(invitation.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                                    {invitation.time && ` · ${invitation.time}`}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Members pill */}
                    <div style={{
                        background: 'rgba(108,92,231,0.15)',
                        border: '1px solid rgba(108,92,231,0.3)',
                        borderRadius: '20px', padding: '5px 10px',
                        display: 'flex', alignItems: 'center', gap: '5px',
                        flexShrink: 0,
                    }}>
                        <FaUsers size={11} style={{ color: 'var(--accent-color)' }} />
                        <span style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--accent-color)' }}>
                            {(invitation?.joinedMembers || invitation?.joined || []).length + 1}
                        </span>
                    </div>
                </div>
            </header>

            {/* Messages List */}
            <div className="message-list" onScroll={handleScroll} style={{ position: 'relative', zIndex: 1 }}>

                {/* Empty state */}
                {messages.length === 0 && (
                    <div style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        justifyContent: 'center', minHeight: '250px', gap: '16px', padding: '32px 24px',
                    }}>
                        {invImage && (
                            <div style={{
                                width: '90px', height: '90px', borderRadius: '18px', overflow: 'hidden',
                                border: '2px solid rgba(108,92,231,0.4)',
                                boxShadow: '0 8px 20px rgba(0,0,0,0.2)',
                            }}>
                                <img src={invImage} alt="Venue" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                        )}
                        <div style={{ textAlign: 'center' }}>
                            <p style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 6px' }}>Say Hello! 👋</p>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>Be the first to start the conversation</p>
                        </div>
                    </div>
                )}

                {messages.map((msg, index) => {
                    const isMe = msg.senderId === currentUser.uid;
                    const isSequence = isConsecutive(msg, messages[index - 1]);

                    // Reactions Logic
                    const reactions = msg.reactions ? Object.values(msg.reactions) : [];
                    const distinctReactions = [...new Set(reactions)].slice(0, 3);
                    const hasReactions = reactions.length > 0;

                    return (
                        <div key={msg.id} className={`message-row ${isMe ? 'outgoing' : 'incoming'} ${isSequence ? 'sequence' : 'first-of-group'}`}>
                            {!isMe && !isSequence && (
                                <img
                                    src={msg.senderAvatar || getSafeAvatar(null)}
                                    alt="avatar"
                                    className="sender-avatar"
                                    onError={(e) => {
                                        e.target.onerror = null;
                                        e.target.src = getSafeAvatar(null);
                                    }}
                                />
                            )}
                            {/* Empty placeholder for alignment if sequence */}
                            {!isMe && isSequence && <div style={{ width: '44px' }}></div>}

                            <div
                                className={`bubble ${msg.type === 'audio' ? 'bubble-audio-transparent' : ''}`}
                                onClick={() => setActiveReactionId(activeReactionId === msg.id ? null : msg.id)}
                                style={{ position: 'relative', cursor: 'pointer' }}
                            >
                                {!isMe && !isSequence && (
                                    <div className="sender-name-small" style={{ fontSize: '0.75rem', marginBottom: '2px', color: 'var(--accent-color)', fontWeight: 'bold' }}>
                                        {msg.senderName}
                                    </div>
                                )}

                                {msg.type === 'image' && (
                                    <img src={msg.imageUrl} alt="attachment" className="chat-image" />
                                )}

                                {msg.type === 'audio' ? (
                                    <div className="voice-widget">
                                        <div className="voice-controls" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <button className="voice-play-btn" onClick={(e) => { e.stopPropagation(); handlePlayAudio(msg.audioUrl, msg.id); }}>
                                                {playingAudioId === msg.id ? (
                                                    <FaPause color="#10b981" size={14} />
                                                ) : (
                                                    <FaPlay color="white" size={14} />
                                                )}
                                            </button>
                                            <div className="voice-time">{formatDuration(msg.duration || 0)}</div>
                                        </div>
                                    </div>
                                ) : (
                                    <span>{msg.text}</span>
                                )}

                                <span className="timestamp">{formatTime(msg.createdAt)}</span>

                                {/* Reaction Badge */}
                                {hasReactions && (
                                    <div className="message-reaction-badge" style={{ position: 'absolute', bottom: '-10px', right: isMe ? 'auto' : '-5px', left: isMe ? '-5px' : 'auto', background: '#1f2937', borderRadius: '12px', padding: '2px 6px', fontSize: '0.75rem', border: '2px solid #0b1220', display: 'flex', alignItems: 'center', gap: '2px', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}>
                                        {distinctReactions.map((r, i) => <span key={i}>{r}</span>)}
                                        {reactions.length > 1 && <span style={{ marginLeft: '2px', color: '#9CA3AF', fontSize: '0.7rem' }}>{reactions.length}</span>}
                                    </div>
                                )}
                            </div>

                            {/* Reaction Popup Menu */}
                            {activeReactionId === msg.id && (
                                <div className="reaction-popup-container" style={{ position: 'absolute', top: '-45px', left: isMe ? 'auto' : '50px', right: isMe ? '50px' : 'auto', background: '#1f2937', padding: '5px 10px', borderRadius: '25px', display: 'flex', gap: '8px', boxShadow: '0 5px 15px rgba(0,0,0,0.3)', zIndex: 100 }} onClick={(e) => e.stopPropagation()}>
                                    {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => (
                                        <span
                                            key={emoji}
                                            className="reaction-popup-item"
                                            style={{ cursor: 'pointer', fontSize: '1.2rem', transition: 'transform 0.2s' }}
                                            onClick={() => handleReact(msg.id, emoji)}
                                        >
                                            {emoji}
                                        </span>
                                    ))}
                                    <div
                                        className="reaction-popup-item"
                                        style={{ background: '#374151', borderRadius: '50%', padding: '2px', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', cursor: 'pointer' }}
                                        onClick={() => {
                                            setExtendedReactionPicker(msg.id);
                                            setActiveReactionId(null);
                                        }}
                                    >
                                        <FaPlus style={{ color: '#9CA3AF' }} />
                                    </div>
                                </div>
                            )}

                            {/* Extended Emoji Picker */}
                            {extendedReactionPicker === msg.id && (
                                <div className="extended-reaction-picker" style={{ position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)', zIndex: 1001 }} onClick={(e) => e.stopPropagation()}>
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
                })
                }
                <div ref={messagesEndRef} />
            </div>


            {showScrollBottom && (

                <button
                    onClick={scrollToBottom}
                    style={{
                        position: 'absolute',
                        bottom: '80px',
                        right: '20px',
                        background: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '50%',
                        width: '40px',
                        height: '40px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        boxShadow: '0 4px 10px rgba(0,0,0,0.4)',
                        zIndex: 200,
                    }}
                >
                    <FaArrowDown />
                </button>
            )}

            {/* Input Composer */}

            <div className="input-area" style={{ position: 'relative' }}>
                {/* Emoji Picker Portal */}
                <EmojiPickerPortal
                    open={showEmojiPicker}
                    onClose={() => setShowEmojiPicker(false)}
                    anchorRef={emojiBtnRef}
                    onEmojiClick={(emojiData) => {
                        const input = inputRef.current;
                        if (input) {
                            const start = input.selectionStart ?? newMessage.length;
                            const end = input.selectionEnd ?? newMessage.length;
                            const updated = newMessage.slice(0, start) + emojiData.emoji + newMessage.slice(end);
                            setNewMessage(updated);
                            setTimeout(() => {
                                input.focus();
                                input.setSelectionRange(start + emojiData.emoji.length, start + emojiData.emoji.length);
                            }, 0);
                        } else {
                            setNewMessage(prev => prev + emojiData.emoji);
                        }
                    }}
                />

                <div className="input-wrapper">
                    {/* Image Input (Hidden) */}
                    <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        accept="image/*"
                        onChange={handleImageUpload}
                    />

                    {/* Image Button */}
                    {!isRecording && (
                        <button
                            className="composer-icon-btn"
                            onClick={handleImageClick}
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', marginRight: '8px', cursor: 'pointer' }}
                        >
                            <FaImage size={18} />
                        </button>
                    )}

                    {isRecording ? (
                        <div className="recording-ui" style={{ flex: 1, color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FaMicrophone className="recording-pulse" />
                                <span>{formatDuration(recordingDuration)}</span>
                            </div>
                            <button onClick={() => handleStopRecording(false)} style={{ background: 'none', border: 'none', color: '#94a3b8' }}>
                                <FaTrash />
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Emoji Button — desktop only */}
                            {!isMobile && (
                                <button
                                    ref={emojiBtnRef}
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setShowEmojiPicker(p => !p); }}
                                    style={{
                                        background: 'none', border: 'none', fontSize: '1.2rem',
                                        cursor: 'pointer', padding: '0 4px', opacity: 0.7, flexShrink: 0,
                                    }}
                                    title="Emoji"
                                >😊</button>
                            )}

                            <input
                                ref={inputRef}
                                type="text"
                                className="message-input"
                                placeholder="Type a message..."
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(e)}
                                autoComplete="off"
                            />
                        </>
                    )}
                </div>

                <button
                    className="send-btn-circle"
                    onMouseDown={(e) => {
                        e.preventDefault();
                        if (isRecording) handleStopRecording(true);
                        else handleSendMessage(e);
                    }}
                >
                    {isRecording ? <FaPaperPlane /> : (newMessage.trim() ? <FaPaperPlane /> : <FaMicrophone onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleStartRecording(); }} />)}
                </button>
            </div>
        </div>

    );
};

export default InvitationChatRoom;
