import { useTranslation } from 'react-i18next';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import { getSafeAvatar } from '../utils/avatarUtils';
import UserAvatar from '../components/UserAvatar';
import { FaArrowLeft, FaSearch, FaEllipsisV } from 'react-icons/fa';
import './ChatList.css';
import { goToLogin } from '../utils/goToLogin';

const ChatList = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { conversations, loading, unreadCount } = useChat();
    const { currentUser, userProfile } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');

    // Redirect guests to login
    useEffect(() => {
        if (userProfile?.isGuest || userProfile?.role === 'guest') {
            goToLogin();
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
                    <h1>{t("messages")}</h1>
                </header>
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    {t("loading_conversations")}
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
                    <p style={{ fontSize: '0.9rem' }}>{t("select_conversation_prompt")}</p>
                </div>
            </div>

            {/* ── MOBILE: full conversations list (no sidebar on mobile) ── */}
            <div className="chat-list-container">
                {/* Header */}
                <header className="chat-list-header">
                    <button className="back-btn" onClick={() => navigate('/')}>
                        <FaArrowLeft style={{ transform: 'rotate(180deg)' }} />
                    </button>
                    <h1>{t("messages")}</h1>
                    <button className="options-btn">
                        <FaEllipsisV />
                    </button>
                </header>

                {/* Search Bar */}
                <div className="search-bar">
                    <FaSearch className="search-icon" />
                    <input
                        type="text"
                        placeholder={t("search_conversations")}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                {/* Conversations List */}
                <div className="conversations-list">
                    {filteredConversations.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-icon">💬</div>
                            <h3>{t("no_conversations")}</h3>
                            <p>{t("start_chatting_friends")}</p>
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
                                        <UserAvatar user={otherUser} alt={otherUser.displayName} style={{ objectFit: 'cover' }} />
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
                                                {convo.lastMessage === 'shared_content'
                                                    ? `🔗 ${t('shared_content_preview', 'Shared content')}`
                                                    : (convo.lastMessage || t("no_messages_yet"))}
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




