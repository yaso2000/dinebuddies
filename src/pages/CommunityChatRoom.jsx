import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, getDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { FaArrowLeft, FaPaperPlane, FaTrash, FaSmile, FaCamera, FaPaperclip, FaMicrophone, FaStop, FaImage, FaFile, FaDownload, FaReply, FaTimes } from 'react-icons/fa';
import EmojiPicker from 'emoji-picker-react';
import { uploadImage, uploadFile, uploadVoiceMessage, formatFileSize, formatDuration } from '../utils/mediaUtils';
import './CommunityChatRoom.css';

const CommunityChatRoom = () => {
    const { partnerId } = useParams();
    const navigate = useNavigate();
    const { currentUser, userProfile } = useAuth();

    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [partner, setPartner] = useState(null);
    const [isMember, setIsMember] = useState(false);
    const [isPartnerOwner, setIsPartnerOwner] = useState(false);

    // Media states
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
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

    // Redirect guests to login
    useEffect(() => {
        if (userProfile?.accountType === 'guest' || userProfile?.role === 'guest') {
            navigate('/login');
        }
    }, [userProfile, navigate]);

    // Check membership and permissions
    useEffect(() => {
        const checkAccess = async () => {
            try {
                const partnerDoc = await getDoc(doc(db, 'users', partnerId));
                if (partnerDoc.exists()) {
                    setPartner(partnerDoc.data());

                    if (currentUser.uid === partnerId) {
                        setIsPartnerOwner(true);
                        setIsMember(true);
                    } else {
                        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
                        const joinedCommunities = userDoc.data()?.joinedCommunities || [];
                        setIsMember(joinedCommunities.includes(partnerId));
                    }
                }
            } catch (error) {
                console.error('Error checking access:', error);
            } finally {
                setLoading(false);
            }
        };

        if (currentUser) {
            checkAccess();
        }
    }, [currentUser, partnerId]);

    // Subscribe to messages
    useEffect(() => {
        if (!isMember) return;

        const messagesRef = collection(db, 'communities', partnerId, 'messages');
        const q = query(messagesRef, orderBy('createdAt', 'asc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setMessages(msgs);
            updateLastRead();
        }, (error) => {
            console.error('Error fetching messages:', error);
        });

        return () => unsubscribe();
    }, [partnerId, isMember]);

    const [initialScrollDone, setInitialScrollDone] = useState(false);

    // Reset scroll when changing communities
    useEffect(() => {
        setInitialScrollDone(false);
    }, [partnerId]);

    // Auto-scroll
    useEffect(() => {
        if (messages.length > 0) {
            if (!initialScrollDone) {
                // Instant jump on first load
                messagesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
                setInitialScrollDone(true);
            } else {
                // Smooth scroll for new messages
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
            }
        }
    }, [messages, initialScrollDone]);

    // Click outside to close emoji picker
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (!e.target.closest('.emoji-container')) {
                setShowEmojiPicker(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const updateLastRead = async () => {
        try {
            const userRef = doc(db, 'users', currentUser.uid);
            await updateDoc(userRef, {
                [`communityLastRead.${partnerId}`]: serverTimestamp()
            });
        } catch (error) {
            console.error('Error updating last read:', error);
        }
    };

    const handleSendMessage = async () => {
        if (!newMessage.trim()) return;

        try {
            const messagesRef = collection(db, 'communities', partnerId, 'messages');
            const messageData = {
                type: 'text',
                text: newMessage.trim(),
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
            setNewMessage('');
            setReplyTo(null);
            inputRef.current?.focus();
        } catch (error) {
            console.error('Error sending message:', error);
            alert('Failed to send message');
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

            const messagesRef = collection(db, 'communities', partnerId, 'messages');
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
            setReplyTo(null);
            setUploadProgress(100);
            setTimeout(() => {
                setUploading(false);
                setUploadProgress(0);
            }, 500);
        } catch (error) {
            console.error('Error uploading image:', error);
            alert('Failed to upload image');
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

            const messagesRef = collection(db, 'communities', partnerId, 'messages');
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
            alert('Failed to upload file');
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

                    const messagesRef = collection(db, 'communities', partnerId, 'messages');
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
                    alert('Failed to send voice message');
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
            alert('Failed to start recording. Please allow microphone access.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorder) {
            mediaRecorder.stop();
            setIsRecording(false);
            clearInterval(recordingIntervalRef.current);
        }
    };

    const handleDeleteMessage = async (messageId) => {
        if (!isPartnerOwner) return;
        if (!window.confirm('Delete this message?')) return;

        try {
            await deleteDoc(doc(db, 'communities', partnerId, 'messages', messageId));
        } catch (error) {
            console.error('Error deleting message:', error);
            alert('Failed to delete message');
        }
    };

    const handleEmojiClick = (emojiObject) => {
        setNewMessage(prev => prev + emojiObject.emoji);
        setShowEmojiPicker(false);
        inputRef.current?.focus();
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
        const isOwn = msg.senderId === currentUser.uid;
        const isPartner = msg.senderId === partnerId;

        return (
            <div
                key={msg.id}
                className={`message ${isOwn ? 'own' : 'other'}`}
            >
                {!isOwn && (
                    <img
                        src={msg.senderAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(msg.senderName || 'U')}&background=8b5cf6&color=fff&size=128`}
                        alt=""
                        className="message-avatar"
                        style={{
                            border: isPartner ? '2px solid #f59e0b' : '2px solid var(--border-color)'
                        }}
                    />
                )}

                <div className="message-content">
                    {!isOwn && (
                        <div className="message-sender">
                            {msg.senderName}
                            {isPartner && <span style={{ marginLeft: '4px' }}>👑</span>}
                        </div>
                    )}

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

                    <div className={`message-bubble ${isOwn ? 'own' : ''}`}>
                        {msg.type === 'text' && <p>{msg.text}</p>}

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

                        {msg.type !== 'image' && (
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

                                {isPartnerOwner && !isOwn && (
                                    <button
                                        onClick={() => handleDeleteMessage(msg.id)}
                                        className="delete-btn"
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

    if (loading) {
        return (
            <div className="page-container loading-container">
                <div className="spinner" />
                <p>Loading chat...</p>
            </div>
        );
    }

    if (!isMember) {
        return (
            <div className="page-container access-denied">
                <div className="access-denied-content">
                    <div className="icon">🔒</div>
                    <h2>Access Denied</h2>
                    <p>You need to join this community to access the chat</p>
                    <button onClick={() => navigate('/communities')}>
                        Go to My Communities
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="community-chat-room">
            {/* Header */}
            <header className="chat-header">
                <button className="back-btn" onClick={() => {
                    if (userProfile?.accountType === 'business') {
                        navigate('/my-community');
                    } else {
                        navigate('/communities');
                    }
                }}>
                    <FaArrowLeft />
                </button>
                <div className="header-info" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        overflow: 'hidden',
                        border: '2px solid var(--primary)',
                        background: 'var(--bg-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        {(partner?.businessInfo?.logoImage || partner?.logoImage || partner?.photo_url || partner?.photoURL || partner?.image) ? (
                            <img
                                src={partner?.businessInfo?.logoImage || partner?.logoImage || partner?.photo_url || partner?.photoURL || partner?.image}
                                onError={(e) => { e.target.style.display = 'none'; }}
                                alt={partner?.display_name}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                        ) : (
                            <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                                {(partner?.display_name || 'C').charAt(0).toUpperCase()}
                            </span>
                        )}
                    </div>
                    <div style={{ textAlign: 'left' }}>
                        <h3>{partner?.display_name || 'Community Chat'}</h3>
                        <p>{partner?.communityMembers?.length || 0} members</p>
                    </div>
                </div>
                <div style={{ width: '40px' }}></div>
            </header>

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
                >
                    <FaCamera />
                </button>

                <button
                    className="media-btn"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading || isRecording}
                >
                    <FaPaperclip />
                </button>

                <button
                    className="media-btn emoji-btn"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    disabled={isRecording}
                >
                    <FaSmile />
                </button>

                {showEmojiPicker && (
                    <div className="emoji-container">
                        <EmojiPicker onEmojiClick={handleEmojiClick} theme="dark" />
                    </div>
                )}

                {isRecording ? (
                    <div className="recording-indicator">
                        <span className="recording-dot"></span>
                        <span>{formatDuration(recordingDuration)}</span>
                    </div>
                ) : (
                    <textarea
                        ref={inputRef}
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
                    >
                        {isRecording ? <FaStop /> : <FaMicrophone />}
                    </button>
                )}
            </div>
        </div>
    );
};

export default CommunityChatRoom;
