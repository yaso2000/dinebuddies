
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, getDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import {
    FaArrowLeft, FaPaperPlane, FaMicrophone, FaTrash,
    FaPlay, FaPause, FaArrowDown, FaImage, FaPlus
} from 'react-icons/fa';
import { startRecording, uploadVoiceMessage, uploadImage, formatDuration } from '../utils/mediaUtils';
import EmojiPicker from 'emoji-picker-react';
import './CommunityChatRoom.css';

const InvitationChatRoom = () => {
    const { id: invitationId } = useParams();
    const navigate = useNavigate();
    const { currentUser, userProfile } = useAuth();

    // Data State
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [invitation, setInvitation] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showScrollBottom, setShowScrollBottom] = useState(false);

    // Reaction State
    const [activeReactionId, setActiveReactionId] = useState(null);
    const [extendedReactionPicker, setExtendedReactionPicker] = useState(null);

    // Refs
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const fileInputRef = useRef(null);

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
            try {
                const invRef = doc(db, 'invitations', invitationId);
                const invSnap = await getDoc(invRef);

                if (invSnap.exists()) {
                    const data = invSnap.data();
                    setInvitation(data);

                    // Robust Access Check
                    // Handle different data structures (author object vs authorId field)
                    const hostId = data.authorId || data.author?.id;
                    const isHost = hostId === currentUser.uid;

                    // Handle different array names (joined vs joinedMembers)
                    const members = data.joinedMembers || data.joined || [];
                    const isParticipant = members.includes(currentUser.uid);

                    if (!isHost && !isParticipant) {
                        alert("You are not a member of this invitation group chat.");
                        navigate(`/invitation/${invitationId}`);
                    }
                } else {
                    alert("Invitation not found");
                    navigate('/invitations');
                }
            } catch (error) {
                console.error("Error fetching invitation:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchInvitation();
    }, [invitationId, currentUser.uid, navigate]);

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
        if (!invitationId) return;

        const q = query(
            collection(db, 'invitations', invitationId, 'messages'),
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
    }, [invitationId]);

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
            await addDoc(collection(db, 'invitations', invitationId, 'messages'), {
                text: '',
                imageUrl: imageUrl,
                senderId: currentUser.uid,
                senderName: userProfile?.display_name || currentUser.displayName || 'User',
                senderAvatar: userProfile?.photo_url || currentUser.photoURL || '',
                createdAt: serverTimestamp(),
                type: 'image'
            });
            scrollToBottom();
        } catch (error) {
            console.error("Error uploading image:", error);
            alert("Failed to upload image.");
        }
    };

    // Reaction Handlers
    const handleReact = async (msgId, emoji) => {
        try {
            setActiveReactionId(null); // Close popup
            const msgRef = doc(db, 'invitations', invitationId, 'messages', msgId);
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
            await addDoc(collection(db, 'invitations', invitationId, 'messages'), {
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

    // Text Handler
    const handleSendMessage = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (!newMessage.trim()) return;

        const text = newMessage.trim();
        setNewMessage('');

        // Use timeout to maintain focus
        setTimeout(() => inputRef.current?.focus(), 10);

        try {
            await addDoc(collection(db, 'invitations', invitationId, 'messages'), {
                text: text,
                senderId: currentUser.uid,
                senderName: userProfile?.display_name || currentUser.displayName || 'User',
                senderAvatar: userProfile?.photo_url || currentUser.photoURL || '',
                createdAt: serverTimestamp(),
                type: 'text'
            });
            scrollToBottom();
        } catch (error) {
            console.error("Error sending:", error);
            setNewMessage(text);
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

    if (loading) return <div className="chat-screen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', background: '#0b1220' }}>Loading Chat...</div>;

    return (
        <div className="chat-screen" style={{ background: '#0b1220' }}>
            {/* Header */}
            <header className="chat-header" style={{
                height: '65px',
                padding: '0 15px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                background: '#0f172a', /* Dark slate background */
                borderBottom: '1px solid #1e293b',
                position: 'sticky',
                top: 0,
                zIndex: 50
            }}>
                <button
                    className="header-back-btn"
                    onClick={() => navigate(`/invitation/${invitationId}`)}
                    style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: 'none',
                        color: 'white',
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer'
                    }}
                >
                    <FaArrowLeft size={16} />
                </button>

                {/* Host Image */}
                <div style={{ position: 'relative' }}>
                    <img
                        src={invitation?.author?.avatar || invitation?.author?.photo_url || 'https://via.placeholder.com/40'}
                        alt="Host"
                        style={{
                            width: '42px',
                            height: '42px',
                            borderRadius: '50%',
                            objectFit: 'cover',
                            border: '2px solid #3b82f6' /* Blue border for host */
                        }}
                    />
                </div>

                <div className="header-info" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                    <h2 className="header-title" style={{
                        margin: 0,
                        fontSize: '1rem', /* Much smaller than before */
                        fontWeight: '700',
                        color: 'white',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        lineHeight: '1.2'
                    }}>
                        {invitation?.title || 'Group Chat'}
                    </h2>
                    <p className="header-subtitle" style={{
                        margin: 0,
                        fontSize: '0.75rem',
                        color: '#94a3b8',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                    }}>
                        <span style={{ color: '#3b82f6', fontWeight: 'bold' }}>Host: {invitation?.author?.name?.split(' ')[0] || 'Admin'}</span>
                        <span>•</span>
                        <span>{(invitation?.joinedMembers || invitation?.joined || []).length + 1} Members</span>
                    </p>
                </div>
            </header>

            {/* Messages List */}
            <div className="message-list" onScroll={handleScroll}>
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
                                    src={msg.senderAvatar || 'https://via.placeholder.com/40'}
                                    alt="avatar"
                                    className="sender-avatar"
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

            {showScrollBottom && (
                <button
                    onClick={scrollToBottom}
                    style={{ position: 'fixed', bottom: '90px', right: '20px', zIndex: 200, borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--accent-color)', border: 'none', color: 'white', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}
                >
                    <FaArrowDown />
                </button>
            )}

            {/* Input Composer */}
            <div className="input-area">
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
