import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import { FaPaperPlane, FaArrowLeft, FaSmile, FaImage, FaTimes, FaUsers, FaClock } from 'react-icons/fa';
import { setTypingStatus, subscribeToTyping } from '../utils/chatUtils';
import EmojiPicker from '../components/EmojiPicker';
import { uploadImage } from '../utils/imageUpload';
import { createNotification } from '../utils/notificationHelpers';
import './GroupChat.css';

const GroupChat = () => {
    const { conversationId } = useParams();
    const navigate = useNavigate();
    const { currentUser: firebaseUser, userProfile } = useAuth();
    const { messages, loadMessages, sendMessage, markAsRead, conversations } = useChat();

    const [messageText, setMessageText] = useState('');
    const [sending, setSending] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [typingUsers, setTypingUsers] = useState([]);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const fileInputRef = useRef(null);

    // Get conversation details
    const conversation = conversations.find(c => c.id === conversationId);
    const isExpired = conversation?.status === 'expired';

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages[conversationId]]);

    // Load messages
    useEffect(() => {
        if (conversationId) {
            const unsubscribe = loadMessages(conversationId);
            markAsRead(conversationId);
            return unsubscribe;
        }
    }, [conversationId]);

    // Subscribe to typing indicators
    useEffect(() => {
        if (!conversationId || !firebaseUser?.uid) return;

        const unsubscribe = subscribeToTyping(conversationId, (users) => {
            // Filter out current user
            const otherUsers = users.filter(u => u.userId !== firebaseUser.uid && u.isTyping);
            setTypingUsers(otherUsers);
        });

        return unsubscribe;
    }, [conversationId, firebaseUser?.uid]);

    // Handle typing
    const handleTyping = () => {
        if (!conversationId || !firebaseUser?.uid) return;

        setTypingStatus(conversationId, firebaseUser.uid, true);

        // Clear previous timeout
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        // Stop typing after 2 seconds
        typingTimeoutRef.current = setTimeout(() => {
            setTypingStatus(conversationId, firebaseUser.uid, false);
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

        if ((!messageText.trim() && !selectedImage) || sending || isExpired) return;

        setSending(true);
        setUploadingImage(!!selectedImage);

        try {
            let finalMessage = messageText;

            // Upload image if selected
            if (selectedImage) {
                const timestamp = Date.now();
                const imagePath = `group-chat-images/${conversationId}/${timestamp}.jpg`;
                const imageUrl = await uploadImage(selectedImage, imagePath);
                finalMessage = imageUrl;
            }

            // For group chat, we send to all participants
            await sendMessage(conversationId, finalMessage, null, selectedImage ? 'image' : 'text');

            // Send notifications to all participants except sender
            if (conversation?.participants) {
                const messagePreview = selectedImage ? '📷 Image' : messageText.substring(0, 50);

                for (const participantId of conversation.participants) {
                    if (participantId !== firebaseUser.uid) {
                        await createNotification({
                            userId: participantId,
                            type: 'group_message',
                            title: conversation.groupName || 'Group Chat',
                            message: `${userProfile?.name || 'Someone'}: ${messagePreview}`,
                            actionUrl: `/group-chat/${conversationId}`,
                            fromUserId: firebaseUser.uid,
                            fromUserName: userProfile?.name || 'Someone',
                            fromUserAvatar: userProfile?.avatar || null,
                            metadata: { conversationId, invitationId: conversation.invitationId }
                        });
                    }
                }
            }

            setMessageText('');
            handleRemoveImage();
            setShowEmojiPicker(false);
            setTypingStatus(conversationId, firebaseUser.uid, false);
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

    // Format expiry time
    const formatExpiryTime = () => {
        if (!conversation?.expiresAt) return '';

        const expiry = conversation.expiresAt.toDate();
        const now = new Date();
        const diff = expiry - now;
        const hours = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);

        if (diff < 0) return 'Expired';
        if (hours > 0) return `Expires in ${hours}h ${minutes}m`;
        return `Expires in ${minutes}m`;
    };

    const conversationMessages = messages[conversationId] || [];

    if (!conversation) {
        return (
            <div className="group-chat-page">
                <div className="loading-container">
                    <p>Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="group-chat-page">
            {/* Header */}
            <div className="chat-header">
                <button className="back-button" onClick={() => navigate('/chats')}>
                    <FaArrowLeft />
                </button>

                <div className="chat-header-info" onClick={() => navigate(`/invitation/${conversation.invitationId}`)}>
                    {conversation.groupImage && (
                        <img src={conversation.groupImage} alt="" className="group-avatar" />
                    )}
                    <div className="header-text">
                        <h3>{conversation.groupName}</h3>
                        <div className="group-subtitle">
                            <FaUsers size={12} />
                            <span>{conversation.participants?.length} members</span>
                            {!isExpired && (
                                <>
                                    <span>•</span>
                                    <FaClock size={12} />
                                    <span>{formatExpiryTime()}</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Expired Banner */}
            {isExpired && (
                <div className="expired-banner">
                    <FaClock />
                    <span>This group chat has expired and is now read-only</span>
                </div>
            )}

            {/* Messages */}
            <div className="messages-container">
                {conversationMessages.length === 0 ? (
                    <div className="empty-state">
                        <FaUsers size={48} style={{ opacity: 0.3 }} />
                        <p>No messages yet. Start the conversation!</p>
                    </div>
                ) : (
                    <div className="messages-list">
                        {conversationMessages.map((msg, index) => {
                            const isOwn = msg.senderId === firebaseUser?.uid;
                            const isSystem = msg.type === 'system';
                            const showAvatar = index === 0 || conversationMessages[index - 1]?.senderId !== msg.senderId;

                            if (isSystem) {
                                return (
                                    <div key={msg.id} className="system-message">
                                        <span>{msg.text}</span>
                                    </div>
                                );
                            }

                            return (
                                <div
                                    key={msg.id}
                                    className={`message-wrapper ${isOwn ? 'own' : 'other'}`}
                                >
                                    {!isOwn && showAvatar && (
                                        <img src={msg.senderAvatar || 'https://via.placeholder.com/150'} alt="" className="message-avatar" />
                                    )}
                                    {!isOwn && !showAvatar && <div className="message-avatar-spacer" />}

                                    <div className="message-bubble">
                                        {!isOwn && showAvatar && (
                                            <div className="sender-name">{msg.senderName}</div>
                                        )}
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

                        {/* Typing Indicator */}
                        {typingUsers.length > 0 && (
                            <div className="typing-indicator">
                                <div className="typing-dots">
                                    <span></span>
                                    <span></span>
                                    <span></span>
                                </div>
                                <span className="typing-text">
                                    {typingUsers.length === 1
                                        ? `${typingUsers[0].userName} is typing...`
                                        : `${typingUsers.length} people are typing...`
                                    }
                                </span>
                            </div>
                        )}

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
            {!isExpired && (
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
                        placeholder="Message group..."
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
            )}
        </div>
    );
};

export default GroupChat;
