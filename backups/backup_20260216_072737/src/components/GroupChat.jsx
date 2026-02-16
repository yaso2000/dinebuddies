import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { FaPaperPlane, FaSmile, FaCamera, FaPaperclip, FaMicrophone, FaStop, FaFile, FaDownload, FaReply, FaTimes, FaTrash, FaPlus, FaStar } from 'react-icons/fa';
import EmojiPicker from 'emoji-picker-react';
import { uploadImage, uploadFile, uploadVoiceMessage, formatFileSize, formatDuration } from '../utils/mediaUtils';
import './GroupChat.css';

// Quick Reactions list
const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '😡', '✨', '👋', '😇'];

const isSingleEmoji = (text) => {
    if (!text) return false;
    // Regex to match a string that contains only 1-3 emojis and whitespace
    const emojiRegex = /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?|\p{Emoji_Component}){1,3}$/u;
    return emojiRegex.test(text.trim());
};

const getEmojiAnimation = (emoji) => {
    switch (emoji.trim()) {
        case '🔥': return 'anim-glow';
        case '❤️': return 'anim-heartbeat';
        case '😂': return 'anim-bounce';
        case '😮': return 'anim-shake';
        case '😢': return 'anim-shake';
        case '😡': return 'anim-shake';
        case '✨': return 'anim-spin';
        case '👋': return 'anim-wobble';
        case '👍': return 'anim-bounce';
        default: return '';
    }
};

const GroupChat = ({ collectionPath, height = '500px' }) => {
    const { currentUser, userProfile } = useAuth();
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);

    // Media states
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showFullPicker, setShowFullPicker] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [mediaRecorder, setMediaRecorder] = useState(null);
    const [replyTo, setReplyTo] = useState(null);

    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const imageInputRef = useRef(null);
    const fileInputRef = useRef(null);
    const audioChunksRef = useRef([]);
    const recordingIntervalRef = useRef(null);

    // Initial scroll state
    const [initialScrollDone, setInitialScrollDone] = useState(false);

    // Subscribe to messages
    useEffect(() => {
        if (!collectionPath) return;

        setLoading(true);
        const q = query(collection(db, collectionPath), orderBy('createdAt', 'asc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setMessages(msgs);
            setLoading(false);
        }, (error) => {
            console.error('Error fetching messages:', error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [collectionPath]);

    // Auto-scroll
    useEffect(() => {
        if (messages.length > 0) {
            if (!initialScrollDone) {
                messagesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
                setInitialScrollDone(true);
            } else {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
            }
        }
    }, [messages, initialScrollDone]);

    // Click outside to close emoji picker
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (showEmojiPicker && !e.target.closest('.emoji-popup') && !e.target.closest('.emoji-btn')) {
                setShowEmojiPicker(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showEmojiPicker]);

    const handleEmojiClick = (emojiObject) => {
        handleSendMessage(emojiObject.emoji);
        setShowEmojiPicker(false);
    };

    const handleQuickReaction = (emoji) => {
        handleSendMessage(emoji);
        setShowEmojiPicker(false);
    };

    const handleSendMessage = async (content = null) => {
        // Check if content is a string (direct emoji) or event/null (from input)
        const isDirectContent = typeof content === 'string';
        const textToSend = isDirectContent ? content : newMessage;

        if (typeof textToSend !== 'string' || !textToSend.trim()) return;

        try {
            const messagesRef = collection(db, collectionPath);
            const messageData = {
                type: 'text',
                text: textToSend.trim(),
                senderId: currentUser.uid,
                senderName: userProfile?.display_name || currentUser.displayName || 'User',
                senderAvatar: userProfile?.photo_url || currentUser.photoURL || '',
                createdAt: serverTimestamp()
            };

            if (replyTo) {
                messageData.replyTo = {
                    id: replyTo.id,
                    text: replyTo.text || '', // Ensure text is not undefined
                    senderName: replyTo.senderName || 'User',
                    type: replyTo.type
                };
            }

            await addDoc(messagesRef, messageData);

            // Clear input only if we sent via input box (not direct emoji)
            if (!isDirectContent) {
                setNewMessage('');
            }

            setReplyTo(null);
            inputRef.current?.focus();
        } catch (error) {
            console.error('Error sending message:', error);
        }
    };

    const handleDeleteMessage = async (messageId) => {
        if (!window.confirm('Delete this message?')) return;
        try {
            await deleteDoc(doc(db, collectionPath, messageId));
        } catch (error) {
            console.error('Error deleting message:', error);
        }
    };

    const handleImageSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            setUploading(true);
            setUploadProgress(30);
            const imageUrl = await uploadImage(file, currentUser.uid);
            setUploadProgress(80);

            const messagesRef = collection(db, collectionPath);
            const messageData = {
                type: 'image',
                text: imageUrl,
                senderId: currentUser.uid,
                senderName: userProfile?.display_name || currentUser.displayName || 'User',
                senderAvatar: userProfile?.photo_url || currentUser.photoURL || '',
                createdAt: serverTimestamp()
            };

            if (replyTo) {
                messageData.replyTo = {
                    id: replyTo.id,
                    text: replyTo.text,
                    senderName: replyTo.senderName,
                    type: replyTo.type
                };
            }

            await addDoc(messagesRef, messageData);
            setUploadProgress(100);
            setTimeout(() => {
                setUploading(false);
                setUploadProgress(0);
            }, 500);
        } catch (error) {
            console.error('Error uploading image:', error);
            setUploading(false);
            setUploadProgress(0);
        }
    };

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            setUploading(true);
            setUploadProgress(30);
            const fileData = await uploadFile(file, currentUser.uid);
            setUploadProgress(80);

            const messagesRef = collection(db, collectionPath);
            await addDoc(messagesRef, {
                type: 'file',
                text: fileData.url,
                fileName: fileData.name,
                fileSize: fileData.size,
                senderId: currentUser.uid,
                senderName: userProfile?.display_name || currentUser.displayName || 'User',
                senderAvatar: userProfile?.photo_url || currentUser.photoURL || '',
                createdAt: serverTimestamp()
            });

            setUploadProgress(100);
            setTimeout(() => {
                setUploading(false);
                setUploadProgress(0);
            }, 500);
        } catch (error) {
            console.error('Error uploading file:', error);
            setUploading(false);
            setUploadProgress(0);
        }
    };

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

                    const messagesRef = collection(db, collectionPath);
                    await addDoc(messagesRef, {
                        type: 'voice',
                        text: audioUrl,
                        duration: recordingDuration,
                        senderId: currentUser.uid,
                        senderName: userProfile?.display_name || currentUser.displayName || 'User',
                        senderAvatar: userProfile?.photo_url || currentUser.photoURL || '',
                        createdAt: serverTimestamp()
                    });

                    setUploading(false);
                } catch (error) {
                    console.error('Error sending voice message:', error);
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
            alert('Please allow microphone access to record voice messages.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorder) {
            mediaRecorder.stop();
            setIsRecording(false);
            if (recordingIntervalRef.current) {
                clearInterval(recordingIntervalRef.current);
            }
        }
    };

    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        try {
            const date = timestamp.toDate();
            return date.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
        } catch {
            return '';
        }
    };

    const renderMessage = (msg) => {
        const isOwn = msg.senderId === currentUser?.uid;
        const isSticker = msg.type === 'text' && isSingleEmoji(msg.text);

        return (
            <div key={msg.id} className={`message ${isOwn ? 'own' : 'other'}`}>
                {!isOwn && (
                    <img
                        src={msg.senderAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(msg.senderName || 'U')}&background=8b5cf6&color=fff&size=128`}
                        alt=""
                        className="message-avatar"
                        onError={(e) => { e.target.onerror = null; e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(msg.senderName || 'U')}&background=random`; }}
                    />
                )}

                <div className="message-content">
                    {!isOwn && <div className="message-sender">{msg.senderName}</div>}

                    {msg.replyTo && (
                        <div className="reply-preview">
                            <div className="reply-line"></div>
                            <div>
                                <div className="reply-sender">{msg.replyTo.senderName}</div>
                                <div className="reply-text">
                                    {msg.replyTo.type === 'image' ? '📷 Image' :
                                        msg.replyTo.type === 'file' ? '📎 File' :
                                            msg.replyTo.type === 'voice' ? '🎤 Voice' :
                                                msg.replyTo.text}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className={`message-bubble ${isOwn ? 'own' : ''} ${isSticker ? 'sticker-bubble' : ''}`}>
                        {isSticker ? (
                            <div style={{ position: 'relative' }}>
                                <div className={`sticker-message ${getEmojiAnimation(msg.text)}`}>
                                    {msg.text}
                                </div>
                                <span style={{
                                    float: 'right',
                                    marginLeft: '8px',
                                    marginTop: '2px',
                                    opacity: 0.6,
                                    fontSize: '12px',
                                    verticalAlign: 'text-bottom'
                                }}>
                                    {!isOwn && (
                                        <button
                                            title="Reply"
                                            onClick={() => setReplyTo(msg)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', color: 'inherit' }}
                                        >
                                            <FaReply size={12} />
                                        </button>
                                    )}
                                </span>
                            </div>
                        ) : (
                            msg.type === 'text' && <p>{msg.text}</p>
                        )}

                        {msg.type === 'image' && (
                            <div className="message-image-wrapper">
                                <img src={msg.text} alt="Shared" className="message-image" />
                                <div className="image-time-overlay">
                                    {formatTime(msg.createdAt)}
                                </div>
                            </div>
                        )}

                        {msg.type === 'file' && (
                            <div className="message-file">
                                <FaFile />
                                <div>
                                    <div className="file-name">{msg.fileName}</div>
                                    <div className="file-size">{formatFileSize(msg.fileSize)}</div>
                                </div>
                                <a href={msg.text} download target="_blank" rel="noopener noreferrer">
                                    <FaDownload />
                                </a>
                            </div>
                        )}

                        {msg.type === 'voice' && (
                            <div className="message-voice">
                                <audio controls src={msg.text} />
                                <span>{formatDuration(msg.duration)}</span>
                            </div>
                        )}

                        {/* Footer for non-sticker text messages */}
                        {!isSticker && msg.type !== 'image' && (
                            <div className="message-footer">
                                <span className="message-time">{formatTime(msg.createdAt)}</span>

                                {!isOwn && (
                                    <button
                                        className="reply-btn"
                                        onClick={() => setReplyTo(msg)}
                                        title="Reply"
                                    >
                                        <FaReply />
                                    </button>
                                )}

                                {isOwn && (
                                    <button
                                        className="delete-btn"
                                        onClick={() => handleDeleteMessage(msg.id)}
                                        title="Delete"
                                    >
                                        <FaTrash />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    if (!currentUser) {
        return (
            <div className="group-chat-container" style={{ height }}>
                <div className="empty-state">
                    <p>Please login to view messages</p>
                </div>
            </div>
        );
    }

    return (
        <div className="group-chat-container" style={{ height }}>
            {/* Messages Area */}
            <div className="messages-area">
                {messages.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">💬</div>
                        <h3>No messages yet</h3>
                        <p>Be the first to start the conversation!</p>
                    </div>
                ) : (
                    messages.map(renderMessage)
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Upload Progress */}
            {uploading && (
                <div className="upload-progress">
                    <div className="progress-bar" style={{ width: `${uploadProgress}%` }}></div>
                </div>
            )}

            {/* Reply Preview */}
            {replyTo && (
                <div className="reply-bar">
                    <div>
                        <div className="replying-to">Replying to {replyTo.senderName}</div>
                        <div className="reply-content">
                            {replyTo.type === 'image' ? '📷 Image' :
                                replyTo.type === 'file' ? '📎 File' :
                                    replyTo.type === 'voice' ? '🎤 Voice' :
                                        replyTo.text}
                        </div>
                    </div>
                    <button onClick={() => setReplyTo(null)}>
                        <FaTimes />
                    </button>
                </div>
            )}

            {/* Input Area */}
            <div className="input-area">
                <input
                    type="file"
                    ref={imageInputRef}
                    onChange={handleImageSelect}
                    accept="image/*"
                    style={{ display: 'none' }}
                />
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                />

                <button
                    className="media-btn"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={uploading || isRecording}
                    title="Send Image"
                >
                    <FaCamera />
                </button>

                <button
                    className="media-btn"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading || isRecording}
                    title="Send File"
                >
                    <FaPaperclip />
                </button>

                <div style={{ position: 'relative' }}>
                    <button
                        className="media-btn emoji-btn"
                        onClick={() => {
                            setShowEmojiPicker(!showEmojiPicker);
                            setShowFullPicker(false); // Reset to quick view first
                        }}
                        disabled={isRecording}
                        title="Emoji"
                    >
                        <FaStar />
                    </button>

                    {showEmojiPicker && (
                        <div className="emoji-popup">
                            {!showFullPicker ? (
                                <div className="quick-reactions">
                                    {QUICK_REACTIONS.map(emoji => (
                                        <button
                                            key={emoji}
                                            onClick={() => handleQuickReaction(emoji)}
                                            className="quick-emoji-btn"
                                            title="Send Sticker"
                                        >
                                            {emoji}
                                        </button>
                                    ))}
                                    <button
                                        onClick={() => setShowFullPicker(true)}
                                        className="quick-emoji-btn more-btn"
                                        title="More Emojis"
                                    >
                                        <FaPlus />
                                    </button>
                                </div>
                            ) : (
                                <div className="full-picker-container">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Emojis</span>
                                        <button
                                            onClick={() => setShowFullPicker(false)}
                                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
                                        >
                                            <FaTimes />
                                        </button>
                                    </div>
                                    <EmojiPicker
                                        onEmojiClick={handleEmojiClick}
                                        theme="dark"
                                        emojiStyle="native" // USES SYSTEM EMOJIS (Standard)
                                        height={300}
                                        width="100%"
                                        searchDisabled={false}
                                        skinTonesDisabled
                                        previewConfig={{ showPreview: false }}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {isRecording ? (
                    <div className="recording-indicator">
                        <span className="recording-dot"></span>
                        <span style={{ marginLeft: 'auto', marginRight: 'auto' }}>{formatDuration(recordingDuration)}</span>
                    </div>
                ) : (
                    <textarea
                        ref={inputRef}
                        className="message-input"
                        placeholder="Type a message..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage();
                            }
                        }}
                        rows={1}
                        disabled={isRecording}
                    />
                )}

                {newMessage.trim() ? (
                    <button className="send-btn" onClick={handleSendMessage}>
                        <FaPaperPlane />
                    </button>
                ) : (
                    <button
                        className={`voice-btn ${isRecording ? 'recording' : ''}`}
                        onClick={isRecording ? stopRecording : startRecording}
                        title={isRecording ? "Stop Recording" : "Record Voice"}
                    >
                        {isRecording ? <FaStop /> : <FaMicrophone />}
                    </button>
                )}
            </div>
        </div>
    );
};

export default GroupChat;
