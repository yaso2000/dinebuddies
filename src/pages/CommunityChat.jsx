import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { FaArrowLeft, FaPaperPlane, FaSmile, FaImage, FaUsers } from 'react-icons/fa';

// Simple Emoji Picker Component
const SimpleEmojiPicker = ({ onEmojiClick, onClose }) => {
    const emojis = [
        '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃',
        '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙',
        '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔',
        '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥',
        '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮',
        '🤧', '🥵', '🥶', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐',
        '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉',
        '👆', '👇', '☝️', '✋', '🤚', '🖐️', '🖖', '👋', '🤝', '🙏',
        '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
        '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️',
        '🔥', '⭐', '🌟', '✨', '💫', '💥', '💢', '💦', '💨', '🎉',
        '🎊', '🎈', '🎁', '🏆', '🥇', '🥈', '🥉', '⚽', '🏀', '🏈'
    ];

    return (
        <div style={{
            position: 'absolute',
            bottom: '80px',
            right: '1rem',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '1rem',
            width: '300px',
            maxHeight: '300px',
            overflowY: 'auto',
            zIndex: 1000,
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
        }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.5rem',
                paddingBottom: '0.5rem',
                borderBottom: '1px solid var(--border-color)'
            }}>
                <span style={{ fontSize: '0.9rem', fontWeight: '700' }}>Emojis</span>
                <button
                    onClick={onClose}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        fontSize: '1.2rem'
                    }}
                >
                    ×
                </button>
            </div>
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(8, 1fr)',
                gap: '8px'
            }}>
                {emojis.map((emoji, index) => (
                    <button
                        key={index}
                        onClick={() => onEmojiClick(emoji)}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            fontSize: '1.5rem',
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '8px',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(139, 92, 246, 0.2)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                        {emoji}
                    </button>
                ))}
            </div>
        </div>
    );
};

const CommunityChat = () => {
    const { communityId } = useParams();
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    const [community, setCommunity] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);




    useEffect(() => {
        if (!communityId) return;

        fetchCommunityDetails();
        const unsubscribe = subscribeToMessages();

        return () => {
            if (unsubscribe && typeof unsubscribe === 'function') {
                unsubscribe();
            }
        };
    }, [communityId]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const fetchCommunityDetails = async () => {
        try {
            const partnerDoc = await getDoc(doc(db, 'users', communityId));
            if (partnerDoc.exists()) {
                const data = partnerDoc.data();
                const businessInfo = data.businessInfo || {};
                setCommunity({
                    id: communityId,
                    name: businessInfo.businessName || 'Community',
                    logo: businessInfo.logoImage,
                    memberCount: data.communityMembers?.length || 0
                });
            }
        } catch (error) {
            console.error('Error fetching community:', error);
        } finally {
            setLoading(false);
        }
    };

    const subscribeToMessages = () => {
        try {
            // Subscribe to regular messages
            const messagesQuery = query(
                collection(db, 'communityMessages'),
                where('communityId', '==', communityId),
                orderBy('createdAt', 'asc')
            );

            return onSnapshot(messagesQuery,
                (snapshot) => {
                    const msgs = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                    console.log(`Loaded ${msgs.length} messages for community ${communityId}`);
                    setMessages(msgs);
                },
                (error) => {
                    console.error('Error loading messages:', error);
                    if (error.code === 'failed-precondition') {
                        console.log('Firestore index is building. Please wait a few minutes and refresh.');
                    }
                }
            );
        } catch (error) {
            console.error('Error setting up message subscription:', error);
            return () => { }; // Return empty unsubscribe function
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();

        if (!newMessage.trim() || sending) return;

        setSending(true);
        try {
            console.log('Sending message to community:', communityId);
            const docRef = await addDoc(collection(db, 'communityMessages'), {
                communityId,
                userId: currentUser.uid,
                userName: currentUser.displayName || 'User',
                userPhoto: currentUser.photoURL || null,
                message: newMessage.trim(),
                type: 'text',
                createdAt: serverTimestamp()
            });
            console.log('Message sent successfully:', docRef.id);

            setNewMessage('');
            setShowEmojiPicker(false);
            inputRef.current?.focus();
        } catch (error) {
            console.error('Error sending message:', error);
            alert('Failed to send message. Please try again.');
        } finally {
            setSending(false);
        }
    };

    const handleEmojiClick = (emoji) => {
        setNewMessage(prev => prev + emoji);
        inputRef.current?.focus();
    };

    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        const date = timestamp.toDate();
        const now = new Date();
        const diff = now - date;

        // Less than 1 minute
        if (diff < 60000) return 'Just now';

        // Less than 1 hour
        if (diff < 3600000) {
            const mins = Math.floor(diff / 60000);
            return `${mins}m ago`;
        }

        // Today
        if (date.toDateString() === now.toDateString()) {
            return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        }

        // This week
        if (diff < 604800000) {
            return date.toLocaleDateString('en-US', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
        }

        // Older
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    if (loading) {
        return (
            <div className="page-container" style={{ padding: '2rem', textAlign: 'center' }}>
                <div style={{
                    width: '50px',
                    height: '50px',
                    border: '4px solid var(--border-color)',
                    borderTop: '4px solid var(--primary)',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto 1rem'
                }} />
                <p style={{ color: 'var(--text-muted)' }}>Loading community...</p>
            </div>
        );
    }

    if (!community) {
        return (
            <div className="page-container" style={{ padding: '2rem', textAlign: 'center' }}>
                <h3>Community not found</h3>
                <button onClick={() => navigate('/communities')} className="btn btn-primary">
                    Back to Communities
                </button>
            </div>
        );
    }

    return (
        <div className="page-container" style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            paddingBottom: 0
        }}>
            {/* Header */}
            <header className="app-header sticky-header-glass" style={{ flexShrink: 0 }}>
                <button className="back-btn" onClick={() => navigate('/communities')}>
                    <FaArrowLeft style={{ transform: 'rotate(180deg)' }} />
                </button>
                <div
                    style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
                    onClick={() => navigate(`/partner/${communityId}`)}
                >
                    <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        background: community.logo
                            ? `url(${community.logo})`
                            : 'linear-gradient(135deg, var(--primary), #f97316)',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        {!community.logo && '🏪'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 style={{ fontSize: '0.95rem', fontWeight: '800', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {community.name}
                        </h3>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                            {community.memberCount} members
                        </p>
                    </div>
                </div>
                <button
                    className="back-btn"
                    onClick={() => navigate(`/partner/${communityId}`)}
                    style={{ marginLeft: '8px' }}
                >
                    <FaUsers />
                </button>
            </header>

            {/* Messages Area */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
            }}>
                {messages.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        padding: '3rem 1rem',
                        color: 'var(--text-muted)'
                    }}>
                        <p>No messages yet. Start the conversation!</p>
                    </div>
                ) : (
                    messages.map((msg) => {
                        console.log('Rendering message:', msg.id, 'Type:', msg.type);

                        // Check if this is a post or regular message
                        if (msg.type === 'post') {
                            console.log('Rendering POST:', msg.id);
                            // Render post using PostCard component
                            return <PostCard key={msg.id} post={msg} showInChat={true} />;
                        }

                        // Regular message rendering
                        const isCurrentUser = msg.userId === currentUser.uid;

                        return (
                            <div
                                key={msg.id}
                                style={{
                                    display: 'flex',
                                    flexDirection: isCurrentUser ? 'row-reverse' : 'row',
                                    gap: '8px',
                                    alignItems: 'flex-end'
                                }}
                            >
                                {/* Avatar */}
                                {!isCurrentUser && (
                                    <div style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '50%',
                                        background: msg.userPhoto
                                            ? `url(${msg.userPhoto})`
                                            : 'linear-gradient(135deg, var(--primary), #f97316)',
                                        backgroundSize: 'cover',
                                        backgroundPosition: 'center',
                                        flexShrink: 0
                                    }} />
                                )}

                                {/* Message Bubble */}
                                <div style={{
                                    maxWidth: '70%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '4px'
                                }}>
                                    {!isCurrentUser && (
                                        <span style={{
                                            fontSize: '0.75rem',
                                            color: 'var(--text-muted)',
                                            paddingLeft: '12px'
                                        }}>
                                            {msg.userName}
                                        </span>
                                    )}
                                    <div style={{
                                        padding: '10px 14px',
                                        borderRadius: isCurrentUser
                                            ? '16px 16px 4px 16px'
                                            : '16px 16px 16px 4px',
                                        background: isCurrentUser
                                            ? 'linear-gradient(135deg, var(--primary), #f97316)'
                                            : 'var(--bg-card)',
                                        color: 'white',
                                        wordBreak: 'break-word'
                                    }}>
                                        <p style={{ margin: 0, fontSize: '0.9rem' }}>
                                            {msg.message}
                                        </p>
                                    </div>
                                    <span style={{
                                        fontSize: '0.7rem',
                                        color: 'var(--text-muted)',
                                        paddingLeft: isCurrentUser ? 0 : '12px',
                                        paddingRight: isCurrentUser ? '12px' : 0,
                                        textAlign: isCurrentUser ? 'right' : 'left'
                                    }}>
                                        {formatTime(msg.createdAt)}
                                    </span>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Emoji Picker */}
            {showEmojiPicker && (
                <SimpleEmojiPicker
                    onEmojiClick={handleEmojiClick}
                    onClose={() => setShowEmojiPicker(false)}
                />
            )}

            {/* Input Area */}
            <form
                onSubmit={handleSendMessage}
                style={{
                    flexShrink: 0,
                    padding: '1rem',
                    background: 'var(--bg-body)',
                    borderTop: '1px solid var(--border-color)',
                    display: 'flex',
                    gap: '8px',
                    alignItems: 'center'
                }}
            >
                <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: '1.2rem'
                    }}
                >
                    <FaSmile />
                </button>

                <input
                    ref={inputRef}
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    style={{
                        flex: 1,
                        padding: '10px 16px',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '20px',
                        color: 'white',
                        fontSize: '0.95rem',
                        outline: 'none'
                    }}
                />

                <button
                    type="submit"
                    disabled={!newMessage.trim() || sending}
                    style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: newMessage.trim() && !sending
                            ? 'linear-gradient(135deg, var(--primary), #f97316)'
                            : 'var(--bg-card)',
                        border: 'none',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: newMessage.trim() && !sending ? 'pointer' : 'not-allowed',
                        opacity: newMessage.trim() && !sending ? 1 : 0.5
                    }}
                >
                    <FaPaperPlane />
                </button>
            </form>
        </div >
    );
};

export default CommunityChat;
