import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import { useInvitations } from '../context/InvitationContext';
import { FaPaperPlane, FaArrowLeft, FaSmile, FaImage, FaTimes } from 'react-icons/fa';
import { subscribeToPresence, setTypingStatus, subscribeToTyping, playNotificationSound } from '../utils/chatUtils';
import EmojiPicker from '../components/EmojiPicker';
import { uploadImage, validateImageFile } from '../utils/imageUpload';
import './PrivateChat.css';

const PrivateChat = () => {
    const { userId } = useParams();
    const navigate = useNavigate();
    const { currentUser: firebaseUser } = useAuth();
    const { invitations } = useInvitations();
    const { messages, loadMessages, sendMessage, markAsRead, getConversation } = useChat();

    const [messageText, setMessageText] = useState('');
    const [conversationId, setConversationId] = useState(null);
    const [sending, setSending] = useState(false);
    const [isOnline, setIsOnline] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [uploadingImage, setUploadingImage] = useState(false);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const fileInputRef = useRef(null);

    const [recipient, setRecipient] = useState({
        id: userId,
        name: 'User',
        avatar: 'https://via.placeholder.com/150'
    });

    // Fetch recipient data from Firestore
    useEffect(() => {
        const fetchRecipient = async () => {
            if (!userId) return;

            try {
                const { doc, getDoc } = await import('firebase/firestore');
                const { db } = await import('../firebase/config');

                const userRef = doc(db, 'users', userId);
                const userDoc = await getDoc(userRef);

                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    setRecipient({
                        id: userId,
                        name: userData.name || userData.displayName || 'User',
                        avatar: userData.avatar || userData.photoURL || userData.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`
                    });
                }
            } catch (error) {
                console.error('Error fetching recipient:', error);
            }
        };

        fetchRecipient();
    }, [userId]);

    // Get conversation ID
    useEffect(() => {
        const fetchConversation = async () => {
            const convoId = await getConversation(userId);
            setConversationId(convoId);
        };

        if (userId && firebaseUser?.uid) {
            fetchConversation();
        }
    }, [userId, firebaseUser?.uid]); // Removed getConversation

    // Load messages
    useEffect(() => {
        if (conversationId) {
            const unsubscribe = loadMessages(conversationId);
            markAsRead(conversationId);
            return unsubscribe;
        }
    }, [conversationId]); // Removed loadMessages and markAsRead

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages[conversationId]]);

    // Mark as read when entering
    useEffect(() => {
        if (conversationId) {
            markAsRead(conversationId);
        }
    }, [conversationId]); // Removed markAsRead

    // Subscribe to recipient's online status
    useEffect(() => {
        if (!userId) return;

        const unsubscribe = subscribeToPresence(userId, (presence) => {
            setIsOnline(presence.online);
        });

        return unsubscribe;
    }, [userId]);

    // Subscribe to typing status
    useEffect(() => {
        if (!conversationId) return;

        const unsubscribe = subscribeToTyping(conversationId, (typingData) => {
            // Check if other user is typing (not current user)
            const otherUserTyping = Object.entries(typingData).some(
                ([uid, timestamp]) => uid !== firebaseUser?.uid && timestamp
            );
            setIsTyping(otherUserTyping);
        });

        return unsubscribe;
    }, [conversationId, firebaseUser?.uid]);

    // Handle typing indicator
    const handleTyping = () => {
        if (!conversationId) return;

        // Set user as typing
        setTypingStatus(conversationId, firebaseUser?.uid, true);

        // Clear previous timeout
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        // Stop typing after 2 seconds
        typingTimeoutRef.current = setTimeout(() => {
            setTypingStatus(conversationId, firebaseUser?.uid, false);
        }, 2000);
    };

    // Handle emoji select
    const handleEmojiSelect = (emoji) => {
        setMessageText(prev => prev + emoji);
        inputRef.current?.focus();
    };

    // Handle image select
    const handleImageSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const validation = validateImageFile(file);
        if (!validation.valid) {
            alert(validation.error);
            return;
        }

        setSelectedImage(file);
        const reader = new FileReader();
        reader.onloadend = () => {
            setImagePreview(reader.result);
        };
        reader.readAsDataURL(file);
    };

    // Remove selected image
    const handleRemoveImage = () => {
        setSelectedImage(null);
        setImagePreview(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Handle send message
    const handleSend = async (e) => {
        e.preventDefault();

        if ((!messageText.trim() && !selectedImage) || sending) return;

        setSending(true);
        setUploadingImage(!!selectedImage);

        try {
            let finalMessage = messageText;

            // Upload image if selected
            if (selectedImage) {
                const timestamp = Date.now();
                const imagePath = `chat-images/${firebaseUser.uid}/${timestamp}.jpg`;
                const imageUrl = await uploadImage(selectedImage, imagePath);
                finalMessage = imageUrl; // Send image URL as message
            }

            const convoId = await sendMessage(conversationId, finalMessage, userId, selectedImage ? 'image' : 'text');

            // Set conversation ID if it was just created
            if (!conversationId && convoId) {
                setConversationId(convoId);
            }

            setMessageText('');
            handleRemoveImage();
            setShowEmojiPicker(false);
            inputRef.current?.focus();
        } catch (error) {
            console.error('Error sending message:', error);
            alert('Failed to send message. Please try again.');
        } finally {
            setSending(false);
            setUploadingImage(false);
        }
    };

    // Format time
    const formatMessageTime = (date) => {
        if (!date) return '';

        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m`;
        if (hours < 24) return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const conversationMessages = messages[conversationId] || [];

    return (
        <div className="private-chat-page">
            {/* Header */}
            <div className="chat-header">
                <button className="back-button" onClick={() => navigate('/messages')}>
                    <FaArrowLeft />
                </button>

                <div className="chat-header-info" onClick={() => navigate(`/profile/${userId}`)}>
                    <div style={{ position: 'relative' }}>
                        <img
                            src={recipient.avatar}
                            alt={recipient.name}
                            className="recipient-avatar"
                            onError={(e) => { e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`; }}
                        />
                        {isOnline && (
                            <div style={{
                                position: 'absolute', bottom: '2px', right: '2px',
                                width: '12px', height: '12px',
                                background: '#10b981', border: '2px solid var(--card-bg)',
                                borderRadius: '50%'
                            }}></div>
                        )}
                    </div>
                    <div>
                        <h2>{recipient.name}</h2>
                        {isTyping ? (
                            <p className="online-status" style={{ color: 'var(--primary)' }}>typing...</p>
                        ) : isOnline ? (
                            <p className="online-status">Active now</p>
                        ) : null}
                    </div>
                </div>

                <div className="chat-header-actions">
                    {/* Future: Video call, voice call, etc. */}
                </div>
            </div>

            {/* Messages */}
            <div className="messages-container">
                {conversationMessages.length === 0 ? (
                    <div className="empty-chat">
                        <img
                            src={recipient.avatar}
                            alt={recipient.name}
                            onError={(e) => { e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`; }}
                        />
                        <h3>Start a conversation with {recipient.name}</h3>
                        <p>Say hi and introduce yourself!</p>
                    </div>
                ) : (
                    <div className="messages-list">
                        {conversationMessages.map((msg, index) => {
                            const isOwn = msg.senderId === firebaseUser?.uid;
                            const showAvatar = index === 0 || conversationMessages[index - 1]?.senderId !== msg.senderId;

                            return (
                                <div
                                    key={msg.id}
                                    className={`message-wrapper ${isOwn ? 'own' : 'other'}`}
                                >
                                    {!isOwn && showAvatar && (
                                        <img
                                            src={msg.senderAvatar || recipient.avatar}
                                            alt=""
                                            className="message-avatar"
                                            onError={(e) => { e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.senderId}`; }}
                                        />
                                    )}
                                    {!isOwn && !showAvatar && <div className="message-avatar-spacer" />}

                                    <div className="message-bubble">
                                        {msg.type === 'image' ? (
                                            <div className="message-image-container">
                                                <img
                                                    src={msg.text}
                                                    alt="Shared image"
                                                    className="message-image"
                                                    onClick={() => window.open(msg.text, '_blank')}
                                                />
                                            </div>
                                        ) : (
                                            <p className="message-text">{msg.text}</p>
                                        )}
                                        <span className="message-time">{formatMessageTime(msg.createdAt)}</span>
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            {/* Image Preview */}
            {imagePreview && (
                <div className="image-preview-container">
                    <div className="image-preview-wrapper">
                        <img src={imagePreview} alt="Preview" className="image-preview" />
                        <button
                            type="button"
                            className="remove-image-btn"
                            onClick={handleRemoveImage}
                        >
                            <FaTimes />
                        </button>
                    </div>
                </div>
            )}

            {/* Emoji Picker */}
            {showEmojiPicker && (
                <EmojiPicker
                    onEmojiSelect={handleEmojiSelect}
                    onClose={() => setShowEmojiPicker(false)}
                />
            )}

            {/* Input */}
            <form className="message-input-container" onSubmit={handleSend}>
                <button
                    type="button"
                    className="emoji-button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                >
                    <FaSmile />
                </button>

                <button
                    type="button"
                    className="image-button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sending}
                >
                    <FaImage />
                </button>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    style={{ display: 'none' }}
                />

                <input
                    ref={inputRef}
                    type="text"
                    placeholder={`Message ${recipient.name}...`}
                    value={messageText}
                    onChange={(e) => {
                        setMessageText(e.target.value);
                        handleTyping();
                    }}
                    className="message-input"
                    disabled={sending}
                />

                <button
                    type="submit"
                    className={`send-button ${(messageText.trim() || selectedImage) ? 'active' : ''}`}
                    disabled={(!messageText.trim() && !selectedImage) || sending}
                >
                    {uploadingImage ? '⏳' : <FaPaperPlane />}
                </button>
            </form>
        </div>
    );
};

export default PrivateChat;
