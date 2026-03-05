import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import { getSafeAvatar } from '../utils/avatarUtils';
import { FaArrowLeft, FaSearch, FaEllipsisV } from 'react-icons/fa';
import './ChatList.css';

const ChatList = () => {
    const navigate = useNavigate();
    const { conversations, loading, unreadCount } = useChat();
    const { currentUser, userProfile } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');

    // Redirect guests to login
    useEffect(() => {
        if (userProfile?.isGuest || userProfile?.role === 'guest') {
            navigate('/login');
        }
    }, [userProfile, navigate]);

    const filteredConversations = conversations.filter(convo => {
        if (!searchQuery) return true;
        const otherUser = convo.otherUser;
        return otherUser?.displayName?.toLowerCase().includes(searchQuery.toLowerCase());
    });

    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        const date = timestamp.toDate();
        const now = new Date();
        const diff = now - date;

        // Today
        if (date.toDateString() === now.toDateString()) {
            return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        }

        // Yesterday
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday';
        }

        // This week
        if (diff < 604800000) {
            return date.toLocaleDateString('en-US', { weekday: 'short' });
        }

        // Older
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    if (loading) {
        return (
            <div className="chat-list-container">
                <header className="chat-list-header">
                    <button className="back-btn" onClick={() => navigate('/')}>
                        <FaArrowLeft style={{ transform: 'rotate(180deg)' }} />
                    </button>
                    <h1>Messages</h1>
                </header>
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading conversations...
                </div>
            </div>
        );
    }

    return (
        <>
            {/* ── DESKTOP: sidebar already shows the list → show a placeholder in center ── */}
            <div className="chat-list-desktop-placeholder">
                <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '12px' }}>💬</div>
                    <h3 style={{ fontWeight: '700', marginBottom: '6px', color: 'var(--text-main)' }}>Your Messages</h3>
                    <p style={{ fontSize: '0.9rem' }}>Select a conversation from the left sidebar to start chatting</p>
                </div>
            </div>

            {/* ── MOBILE: full conversations list (no sidebar on mobile) ── */}
            <div className="chat-list-container">
                {/* Header */}
                <header className="chat-list-header">
                    <button className="back-btn" onClick={() => navigate('/')}>
                        <FaArrowLeft style={{ transform: 'rotate(180deg)' }} />
                    </button>
                    <h1>Messages</h1>
                    <button className="options-btn">
                        <FaEllipsisV />
                    </button>
                </header>

                {/* Search Bar */}
                <div className="search-bar">
                    <FaSearch className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search conversations..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                {/* Conversations List */}
                <div className="conversations-list">
                    {filteredConversations.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-icon">💬</div>
                            <h3>No conversations yet</h3>
                            <p>Start chatting with your friends!</p>
                        </div>
                    ) : (
                        filteredConversations.map((convo) => {
                            const otherUser = convo.otherUser;
                            if (!otherUser) return null;

                            return (
                                <div
                                    key={convo.id}
                                    className={`conversation-item ${convo.isUnread ? 'unread' : ''}`}
                                    onClick={() => navigate(`/chat/${otherUser.uid}`)}
                                >
                                    {/* Avatar */}
                                    <div className="conversation-avatar">
                                        <img
                                            src={getSafeAvatar(otherUser)}
                                            alt={otherUser.displayName}
                                            onError={(e) => {
                                                e.target.onerror = null;
                                                e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="150" height="150"%3E%3Crect fill="%238b5cf6" width="150" height="150"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="60" fill="white"%3E👤%3C/text%3E%3C/svg%3E';
                                            }}
                                            style={{ objectFit: 'cover' }}
                                        />
                                        {otherUser.isOnline && <div className="online-indicator" />}
                                    </div>

                                    {/* Content */}
                                    <div className="conversation-content">
                                        <div className="conversation-top">
                                            <h3 className="conversation-name">{otherUser.displayName}</h3>
                                            <span className="conversation-time">
                                                {formatTime(convo.lastMessageTime)}
                                            </span>
                                        </div>
                                        <div className="conversation-bottom">
                                            <p className="last-message">
                                                {convo.lastMessage || 'No messages yet'}
                                            </p>
                                            {convo.isUnread && <div className="unread-badge"></div>}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </>
    );
};

export default ChatList;
