import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import { useInvitations } from '../context/InvitationContext';
import { FaSearch, FaComments } from 'react-icons/fa';
import './ChatList.css';

const ChatList = () => {
    const navigate = useNavigate();
    const { conversations, loading } = useChat();
    const { currentUser: firebaseUser } = useAuth();
    const { invitations } = useInvitations();
    const [searchQuery, setSearchQuery] = useState('');

    // Get participant details from invitations
    const getParticipantDetails = (participantId) => {
        const userInvitation = invitations?.find(inv => inv.author?.id === participantId);
        return userInvitation?.author || {
            id: participantId,
            name: 'User',
            avatar: 'https://via.placeholder.com/150'
        };
    };

    // Filter conversations
    const filteredConversations = conversations.filter(convo => {
        const participant = getParticipantDetails(convo.otherParticipantId);
        return participant.name.toLowerCase().includes(searchQuery.toLowerCase());
    });

    // Format time
    const formatTime = (date) => {
        if (!date) return '';

        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;

        return date.toLocaleDateString();
    };

    if (loading) {
        return (
            <div className="chat-list-page">
                <div className="chat-list-header">
                    <h1>💬 Messages</h1>
                </div>
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                    Loading...
                </div>
            </div>
        );
    }

    return (
        <div className="chat-list-page">
            <div className="chat-list-header">
                <h1>💬 Messages</h1>
            </div>

            <div className="chat-search">
                <FaSearch className="search-icon" />
                <input
                    type="text"
                    placeholder="Search conversations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="search-input"
                />
            </div>

            <div className="conversations-list">
                {filteredConversations.length === 0 ? (
                    <div className="empty-state">
                        <FaComments style={{ fontSize: '4rem', color: 'var(--text-secondary)', opacity: 0.3 }} />
                        <h3>No conversations yet</h3>
                        <p>Start chatting with other users from their profiles or invitations!</p>
                    </div>
                ) : (
                    filteredConversations.map(convo => {
                        const isGroup = convo.type === 'group';
                        const isExpired = convo.status === 'expired';

                        // For group chats
                        if (isGroup) {
                            const unreadCount = convo.unreadCount?.[firebaseUser?.uid] || 0;
                            const isUnread = unreadCount > 0;

                            return (
                                <div
                                    key={convo.id}
                                    className={`conversation-item ${isUnread ? 'unread' : ''} ${isExpired ? 'expired' : ''}`}
                                    onClick={() => navigate(`/group/${convo.id}`)}
                                >
                                    <div className="participant-avatar group-avatar">
                                        {convo.groupImage ? (
                                            <img src={convo.groupImage} alt={convo.groupName} />
                                        ) : (
                                            <div className="group-icon">👥</div>
                                        )}
                                    </div>

                                    <div className="conversation-content">
                                        <div className="conversation-header">
                                            <h4>{convo.groupName}</h4>
                                            <span className="conversation-time">{formatTime(convo.lastMessageAt)}</span>
                                        </div>
                                        <div className="conversation-preview">
                                            <p>{convo.lastMessage || 'No messages yet'}</p>
                                            {isUnread && <span className="unread-badge">{unreadCount}</span>}
                                            {isExpired && <span className="expired-tag">Expired</span>}
                                        </div>
                                        <div className="group-participants">
                                            {convo.participants?.length} members
                                        </div>
                                    </div>
                                </div>
                            );
                        }

                        // For private chats
                        const participant = getParticipantDetails(convo.otherParticipantId);
                        const unreadCount = convo.unreadCount?.[firebaseUser?.uid] || 0;
                        const isUnread = unreadCount > 0;

                        return (
                            <div
                                key={convo.id}
                                className={`conversation-item ${isUnread ? 'unread' : ''}`}
                                onClick={() => navigate(`/chat/${convo.otherParticipantId}`)}
                            >
                                <div className="participant-avatar">
                                    <img src={participant.avatar} alt={participant.name} />
                                </div>

                                <div className="conversation-content">
                                    <div className="conversation-header">
                                        <h4>{participant.name}</h4>
                                        <span className="conversation-time">{formatTime(convo.lastMessageAt)}</span>
                                    </div>
                                    <div className="conversation-preview">
                                        <p>{convo.lastMessage || 'No messages yet'}</p>
                                        {isUnread && <span className="unread-badge">{unreadCount}</span>}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default ChatList;
