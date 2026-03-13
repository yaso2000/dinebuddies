import React, { Suspense, lazy, useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, doc, getDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import {
    FaArrowLeft, FaCamera, FaMicrophone,
    FaPaperPlane, FaEllipsisV, FaPlay, FaPause, FaFile,
    FaDownload, FaStop, FaPlus, FaArrowDown
} from 'react-icons/fa';
import { getSafeAvatar } from '../utils/avatarUtils';
import { uploadImage, uploadVoiceMessage, formatFileSize, formatDuration } from '../utils/mediaUtils';
import NewReportModal from '../components/NewReportModal';
import './Chat.css';

const LazyEmojiPicker = lazy(() => import('emoji-picker-react'));

const Chat = () => {
    const { userId } = useParams();
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const { isDark } = useTheme();
    const { getOrCreateConversation, sendMessage, markAsRead, setTypingStatus, addReaction } = useChat();
    const { showToast } = useToast();

    const [conversationId, setConversationId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [otherUser, setOtherUser] = useState(null);
    const [newMessage, setNewMessage] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [otherUserTyping, setOtherUserTyping] = useState(false);
    const [activeReactionMenu, setActiveReactionMenu] = useState(null);
    const [extendedReactionPicker, setExtendedReactionPicker] = useState(null);
    const [replyTo, setReplyTo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [conversationError, setConversationError] = useState(false);
    const [retryTrigger, setRetryTrigger] = useState(0);
    const [showScrollBottom, setShowScrollBottom] = useState(false);

    const handleScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        // Show button if user is more than 150px away from bottom
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
        setShowScrollBottom(!isNearBottom);
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Media states
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [mediaRecorder, setMediaRecorder] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const imageInputRef = useRef(null);
    const audioChunksRef = useRef([]);
    const recordingIntervalRef = useRef(null);

    const initInFlightRef = useRef(false);
    useEffect(() => {
        const initConversation = async () => {
            if (!currentUser?.uid || !userId) return;
            if (initInFlightRef.current) return; // avoid duplicate calls (Strict Mode / re-renders) → 429
            initInFlightRef.current = true;
            setConversationError(false);
            try {
                const convId = await getOrCreateConversation(userId);
                if (convId === null) {
                    setConversationId(null);
                    setConversationError(true);
                    setLoading(false);
                    return;
                }
                setConversationId(convId);
                const userDoc = await getDoc(doc(db, 'users', userId));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    setOtherUser({
                        uid: userId,
                        displayName: userData.display_name || userData.email || 'User',
                        photoURL: getSafeAvatar(userData),
                        isOnline: userData.isOnline || false,
                        lastSeen: userData.lastSeen || null
                    });
                } else {
                    setOtherUser({
                        uid: userId,
                        displayName: 'User',
                        photoURL: null,
                        isOnline: false,
                        lastSeen: null
                    });
                }
            } catch (error) {
                console.error('Error initializing conversation:', error);
                setConversationId(null);
                setConversationError(true);
                setLoading(false);
            } finally {
                initInFlightRef.current = false;
            }
        };
        initConversation();
    }, [userId, currentUser?.uid, getOrCreateConversation, retryTrigger]);

    useEffect(() => {
        if (!conversationId) return;
        const messagesQuery = query(
            collection(db, 'conversations', conversationId, 'messages'),
            orderBy('createdAt', 'asc')
        );
        const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMessages(msgs);
            setLoading(false);
            markAsRead(conversationId);
        });
        return () => unsubscribe();
    }, [conversationId, markAsRead]);

    useEffect(() => {
        if (!conversationId) return;
        const unsubscribe = onSnapshot(doc(db, 'conversations', conversationId), (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                const typingData = data.typing || {};
                setOtherUserTyping(typingData[userId] || false);
            }
        });
        return () => unsubscribe();
    }, [conversationId, userId]);

    const [initialScrollDone, setInitialScrollDone] = useState(false);

    // Reset scroll when changing conversations
    useEffect(() => {
        setInitialScrollDone(false);
    }, [conversationId]);

    useEffect(() => {
        if (messages.length > 0) {
            if (!initialScrollDone) {
                messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
                setInitialScrollDone(true);
            } else {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }
        }
    }, [messages, initialScrollDone]);

    useEffect(() => {
        function handleClickOutside(event) {
            if (activeReactionMenu && !event.target.closest('.reaction-popup-container')) {
                setActiveReactionMenu(null);
            }
            if (extendedReactionPicker && !event.target.closest('.extended-reaction-picker')) {
                setExtendedReactionPicker(null);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [activeReactionMenu, extendedReactionPicker]);

    const handleSendMessage = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (!newMessage.trim()) return;
        if (!conversationId) return;

        const messageData = {
            type: 'text',
            text: newMessage.trim(),
            replyTo: replyTo || null
        };

        const messageId = await sendMessage(conversationId, messageData);
        if (messageId) {
            setNewMessage('');
            setReplyTo(null);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
        setTypingStatus(conversationId, false);
    };

    const handleTyping = (value) => {
        setNewMessage(value);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        if (!isTyping && value) {
            setIsTyping(true);
            setTypingStatus(conversationId, true);
        }
        typingTimeoutRef.current = setTimeout(() => {
            setIsTyping(false);
            setTypingStatus(conversationId, false);
        }, 2000);
    };

    const handleReaction = async (messageId, emoji) => {
        await addReaction(conversationId, messageId, emoji);
        setActiveReactionMenu(null);
    };

    // Image Upload
    const handleImageSelect = async (e) => {
        const file = e.target.files[0];
        if (!file || !conversationId) return;

        try {
            setUploading(true);
            setUploadProgress(30);
            const imageUrl = await uploadImage(file, currentUser.uid);
            setUploadProgress(80);

            const messageId = await sendMessage(conversationId, {
                type: 'image',
                text: imageUrl
            });
            if (!messageId) {
                setUploading(false);
                setUploadProgress(0);
                return;
            }
            setUploadProgress(100);
            setTimeout(() => {
                setUploading(false);
                setUploadProgress(0);
            }, 500);
        } catch (error) {
            console.error('Error uploading image:', error);
            showToast('Failed to upload image. Try again.', 'error');
            setUploading(false);
            setUploadProgress(0);
        } finally {
            e.target.value = '';
        }
    };



    // Voice Recording
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            audioChunksRef.current = [];

            recorder.ondataavailable = (e) => {
                audioChunksRef.current.push(e.data);
            };

            recorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                stream.getTracks().forEach(track => track.stop());

                try {
                    setUploading(true);
                    const audioUrl = await uploadVoiceMessage(audioBlob, currentUser.uid);
                    const messageId = await sendMessage(conversationId, {
                        type: 'voice',
                        text: audioUrl,
                        duration: recordingDuration
                    });
                    if (!messageId) {
                        setUploading(false);
                        return;
                    }
                    setUploading(false);
                } catch (error) {
                    console.error('Error uploading voice:', error);
                    showToast('Failed to send voice message. Try again.', 'error');
                    setUploading(false);
                }
            };

            recorder.start();
            setMediaRecorder(recorder);
            setIsRecording(true);
            setRecordingDuration(0);

            recordingIntervalRef.current = setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);

        } catch (error) {
            console.error('Error starting recording:', error);
            showToast('Could not access microphone.', 'error');
        }
    };

    const stopRecording = () => {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
            setIsRecording(false);
            clearInterval(recordingIntervalRef.current);
        }
    };

    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        const date = timestamp.toDate();
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    };

    const formatLastSeen = (timestamp) => {
        if (!timestamp) return 'Offline';
        const date = timestamp.toDate();
        const now = new Date();
        const diff = now - date;
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
        return date.toLocaleDateString();
    };

    const handleRetryConversation = () => {
        setConversationError(false);
        setLoading(true);
        setRetryTrigger((t) => t + 1);
    };

    if (loading && !conversationError) {
        return (
            <div className="chat-container">
                <div className="chat-header">
                    <button className="back-btn" onClick={() => navigate('/messages')}>
                        <FaArrowLeft style={{ transform: 'rotate(180deg)' }} />
                    </button>
                    <div className="header-info"><h3>Loading...</h3></div>
                </div>
            </div>
        );
    }

    if (conversationError) {
        return (
            <div className="chat-container">
                <div className="chat-header">
                    <button className="back-btn" onClick={() => navigate('/messages')}>
                        <FaArrowLeft style={{ transform: 'rotate(180deg)' }} />
                    </button>
                    <div className="header-info"><h3>Chat</h3></div>
                </div>
                <div style={{ padding: '2rem', textAlign: 'center' }}>
                    <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>Couldn&apos;t start conversation.</p>
                    <button
                        onClick={handleRetryConversation}
                        style={{
                            background: 'var(--primary)',
                            color: 'white',
                            border: 'none',
                            padding: '0.5rem 1rem',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '0.95rem'
                        }}
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="chat-container">
            <input ref={imageInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageSelect} />

            {/* Header */}
            <div className="chat-header" style={{
                background: 'var(--header-bg)',
                borderBottom: '1px solid var(--border-color)',
                boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(0,0,0,0.06)',
                zIndex: 100
            }}>
                <button className="back-btn" onClick={() => navigate('/messages')} style={{
                    background: isDark ? 'rgba(255,255,255,0.05)' : '#ffffff',
                    borderRadius: '50%',
                    width: '38px',
                    height: '38px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
                    color: 'var(--text-main)',
                    marginRight: '12px',
                    border: '1px solid var(--border-color)'
                }}>
                    <FaArrowLeft size={18} />
                </button>
                {otherUser && (
                    <>
                        <div className="header-avatar">
                            <img
                                src={getSafeAvatar(otherUser)}
                                alt={otherUser.displayName}
                                onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="150" height="150"%3E%3Crect fill="%238b5cf6" width="150" height="150"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="60" fill="white"%3E👤%3C/text%3E%3C/svg%3E';
                                }}
                            />
                            {otherUser.isOnline && <div className="online-dot" />}
                        </div>
                        <div className="header-info" style={{ textAlign: 'left' }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0 }}>{otherUser.displayName}</h3>
                            <p className="status" style={{ fontSize: '0.8rem', opacity: 0.7 }}>{otherUserTyping ? 'typing...' : otherUser.isOnline ? 'Online' : formatLastSeen(otherUser.lastSeen)}</p>
                        </div>
                    </>
                )}
                <button className="options-btn" style={{ color: 'var(--text-main)' }}><FaEllipsisV /></button>
            </div>

            {/* Messages */}
            <div className="messages-area" onScroll={handleScroll}>
                {messages.map((msg, index) => {
                    const isOwn = msg.senderId === currentUser?.uid;
                    const isFirstInGroup = index === 0 || messages[index - 1].senderId !== msg.senderId;

                    return (
                        <div
                            key={msg.id}
                            className={`message-wrapper ${isOwn ? 'own' : 'other'} ${!isFirstInGroup ? 'consecutive' : ''}`}
                            onContextMenu={(e) => {
                                e.preventDefault();
                                if (!isOwn) {
                                    setActiveReactionMenu(msg.id);
                                }
                            }}
                        >

                            <div className="message-content-wrapper">
                                {msg.replyTo && (
                                    <div className="reply-preview">
                                        <div className="reply-line" />
                                        <div className="reply-content"><p className="reply-text">{msg.replyTo.text}</p></div>
                                    </div>
                                )}

                                <div className="message-bubble" style={{ position: 'relative' }}>
                                    {msg.type === 'image' && <img src={msg.text} alt="Shared" className="message-image" />}
                                    {msg.type === 'text' && <p className="message-text">{msg.text}</p>}
                                    {msg.type === 'voice' && (
                                        <div className="voice-message">
                                            <audio controls src={msg.text} style={{ maxWidth: '250px' }} />
                                            <span className="voice-duration">{formatDuration(msg.duration || 0)}</span>
                                        </div>
                                    )}
                                    {msg.type === 'file' && (
                                        <div className="file-message">
                                            <FaFile size={24} />
                                            <div className="file-info">
                                                <p className="file-name">{msg.fileName || 'File'}</p>
                                                <p className="file-size">{formatFileSize(msg.fileSize || 0)}</p>
                                            </div>
                                            <a href={msg.text} download target="_blank" rel="noreferrer"><FaDownload /></a>
                                        </div>
                                    )}
                                    <div className="message-meta">
                                        <span className="message-time">{formatTime(msg.createdAt)}</span>
                                        {isOwn && <span className="message-status">{msg.status === 'read' ? '✓✓' : msg.status === 'delivered' ? '✓✓' : '✓'}</span>}
                                    </div>

                                    {/* Reaction Badge */}
                                    {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                                        <div className="message-reaction-badge">
                                            {Object.entries(msg.reactions)
                                                .filter(([_, users]) => users && users.length > 0)
                                                .slice(0, 3)
                                                .map(([emoji, users]) => (
                                                    <span key={emoji}>{emoji} {users.length > 1 && <span style={{ fontSize: '9px', marginLeft: '1px' }}>{users.length}</span>}</span>
                                                ))
                                            }
                                        </div>
                                    )}
                                </div>

                                {/* Reaction Popup Menu */}
                                {activeReactionMenu === msg.id && (
                                    <div className="reaction-popup-container" onClick={(e) => e.stopPropagation()}>
                                        {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => (
                                            <span
                                                key={emoji}
                                                className="reaction-popup-item"
                                                onClick={() => handleReaction(msg.id, emoji)}
                                            >
                                                {emoji}
                                            </span>
                                        ))}
                                        <div
                                            className="reaction-popup-item"
                                            style={{ background: '#374151', borderRadius: '50%', padding: '2px', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px' }}
                                            onClick={() => {
                                                setExtendedReactionPicker(msg.id);
                                                setActiveReactionMenu(null);
                                            }}
                                        >
                                            <FaPlus style={{ color: '#9CA3AF' }} />
                                        </div>
                                    </div>
                                )}

                                {/* Extended Emoji Picker for Reactions */}
                                {extendedReactionPicker === msg.id && (
                                    <div className="extended-reaction-picker" style={{ position: 'absolute', bottom: '40px', left: '0', zIndex: 1001 }} onClick={(e) => e.stopPropagation()}>
                                        <Suspense fallback={<div style={{ width: 300, height: 350, background: '#111827' }} />}>
                                            <LazyEmojiPicker
                                                onEmojiClick={(emojiObject) => {
                                                    handleReaction(msg.id, emojiObject.emoji);
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
                        </div>
                    );
                })}

                {otherUserTyping && (
                    <div className="typing-indicator">
                        <div className="typing-dots"><span></span><span></span><span></span></div>
                    </div>
                )}

                <div ref={messagesEndRef} />

                {showScrollBottom && (
                    <button
                        onClick={scrollToBottom}
                        style={{
                            position: 'fixed',
                            bottom: '80px', // Above input area
                            right: '20px',
                            background: 'var(--accent-color)',
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
                            zIndex: 1001,
                            transition: 'all 0.3s ease'
                        }}
                    >
                        <FaArrowDown />
                    </button>
                )}
            </div>

            {
                replyTo && (
                    <div className="reply-bar">
                        <div className="reply-bar-content">
                            <div className="reply-line" />
                            <div className="reply-info">
                                <p className="reply-label">Replying to</p>
                                <p className="reply-message">{replyTo.text}</p>
                            </div>
                        </div>
                        <button onClick={() => setReplyTo(null)} className="reply-close">×</button>
                    </div>
                )
            }

            {
                uploading && (
                    <div className="upload-progress-bar">
                        <div className="progress-fill" style={{ width: `${uploadProgress}%` }}></div>
                        <span>Uploading... {uploadProgress}%</span>
                    </div>
                )
            }

            {/* Input Area - WhatsApp Style - Fixed Layout */}
            <div className="chat-input-area">
                <div className="chat-input-inner">
                    {/* Recording UI */}
                    {isRecording ? (
                        <div className="recording-ui">
                            <div className="recording-info">
                                <div className="recording-pulse"></div>
                                <span className="recording-timer">{formatDuration(recordingDuration)}</span>
                            </div>
                            <button className="delete-recording-btn" onClick={stopRecording}>
                                <FaStop /> Stop
                            </button>
                        </div>
                    ) : (
                        /* Normal Input UI */
                        <div className="chat-input-pill">
                            <input
                                ref={inputRef}
                                type="text"
                                name="chat-message-input"
                                autoComplete="off"
                                autoCorrect="off"
                                enterKeyHint="send"
                                placeholder="Message"
                                value={newMessage}
                                onChange={(e) => handleTyping(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(e)}
                                className="chat-input-field"
                            />

                            {/* Attachments */}
                            <div style={{ display: 'flex', alignItems: 'center' }}>

                                <button onClick={() => imageInputRef.current?.click()} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '8px', display: 'flex' }}><FaCamera style={{ fontSize: '1.2rem' }} /></button>
                            </div>
                        </div>
                    )}

                    {/* Send / Mic Button */}
                    <button
                        type="button"
                        onPointerDown={(e) => e.preventDefault()}
                        onClick={newMessage.trim() ? handleSendMessage : startRecording}
                        style={{
                            background: isRecording ? '#ef4444' : 'var(--primary)',
                            color: 'white', border: 'none', borderRadius: '50%',
                            width: '45px', height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', flexShrink: 0, boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
                        }}
                    >
                        {isRecording ? <FaPaperPlane /> : (newMessage.trim() ? <FaPaperPlane style={{ marginLeft: '-2px' }} /> : <FaMicrophone />)}
                    </button>
                </div>

            </div>
        </div>
    );
};

export default Chat;
