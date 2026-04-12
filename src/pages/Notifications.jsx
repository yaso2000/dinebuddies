import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import {
    FaBell,
    FaCheckCircle,
    FaCommentAlt,
    FaChevronLeft,
    FaTrash,
    FaUserPlus,
    FaCalendarCheck,
    FaTimesCircle,
    FaHeart,
    FaExclamationCircle,
    FaSearch,
    FaCog,
    FaCheckDouble
} from 'react-icons/fa';
import EmptyState from '../components/EmptyState';
import UserAvatar from '../components/UserAvatar';
import PrivateInvitationNotifVisual from '../components/notifications/PrivateInvitationNotifVisual';
import './Notifications.css';
import { goToLogin } from '../utils/goToLogin';

/**
 * Returns a translated title for a notification based on its type.
 * Falls back to the stored title if no translation is found.
 */
const getNotifTitle = (notif, t) => {
    const name = notif.fromUserName || t('someone', 'Someone');
    switch (notif.type) {
        case 'follow':           return t('notif_title_follow', 'New Follower');
        case 'invitation_accepted': return t('notif_title_accepted', 'Invitation Accepted');
        case 'invitation_rejected': return t('notif_title_rejected', 'Invitation Declined');
        case 'message':          return t('notif_title_message', 'New Message');
        case 'reminder':         return t('notif_title_reminder', 'Upcoming Invitation');
        case 'like':             return t('notif_title_like', 'Invitation Liked');
        case 'comment':          return t('notif_title_comment', 'New Comment');
        case 'invitation_full':  return t('notif_title_full', 'Invitation Complete');
        case 'booking_confirmed':return t('notif_title_booking_confirmed', 'Booking Confirmed');
        case 'invitation_cancelled': return t('notif_title_cancelled', 'Invitation Cancelled');
        case 'booking_cancelled':return t('notif_title_booking_cancelled', 'Booking Cancelled');
        case 'invitation_completed': return t('notif_title_completed', 'Invitation Completed! 🎉');
        case 'invitation_updated': return t('notif_title_updated', 'Invitation Time Updated');
        case 'private_invitation': return t('notification_private_invitation_title', '💌 New Private Invitation');
        case 'join_request':     return t('notif_title_join_request', 'New Join Request');
        case 'request_approved':    return t('notif_title_request_approved', 'Request Approved');
        case 'business_message':    return t('notif_title_business_message', 'Message from Business');
        default:                    return notif.title || t('notification', 'Notification');
    }
};

/**
 * Returns a translated message for a notification based on its type and metadata.
 * Falls back to the stored message if no translation is found.
 */
const getNotifMessage = (notif, t) => {
    const name = notif.fromUserName || t('someone', 'Someone');
    const title = notif.metadata?.invitationTitle || notif.invitationTitle || '';
    switch (notif.type) {
        case 'follow':
            return t('notif_msg_follow', '{{name}} started following you', { name });
        case 'invitation_accepted':
            return t('notif_msg_accepted', '{{name}} accepted your invitation', { name });
        case 'invitation_rejected':
            return t('notif_msg_rejected', '{{name}} declined your invitation', { name });
        case 'message':
            return notif.message || t('notif_msg_message', 'You have a new message from {{name}}', { name });
        case 'reminder':
            return notif.message || t('notif_msg_reminder', 'Your invitation is coming up soon');
        case 'like':
            return t('notif_msg_like', '{{name}} liked your invitation', { name });
        case 'comment':
            return notif.message || t('notif_msg_comment', '{{name}} commented on your invitation', { name });
        case 'invitation_full':
            return t('notif_msg_full', 'Great news! Your invitation is now complete with all guests confirmed.');
        case 'booking_confirmed':
            return t('notif_msg_booking_confirmed', 'A booking at your venue is now confirmed.');
        case 'invitation_cancelled':
            return notif.message || t('notif_msg_cancelled', 'An invitation has been cancelled.');
        case 'booking_cancelled':
            return notif.message || t('notif_msg_booking_cancelled', 'A booking at your venue has been cancelled.');
        case 'invitation_completed':
            return t('notif_msg_completed', 'The invitation has been completed. Hope you had a great time!');
        case 'invitation_updated':
            return notif.message || t('notif_msg_updated', 'The invitation time has been updated. Please confirm your attendance.');
        case 'private_invitation':
            return t('notification_private_invitation_message', '{{name}} has invited you to a private occasion: {{title}}', { name, title });
        case 'join_request':
            return t('notif_msg_join_request', '{{name}} requested to join your invitation', { name });
        case 'request_approved':
            return t('notif_msg_request_approved', 'Your request to join was approved', { name });
        case 'business_message':
            return notif.message || t('notif_title_business_message', 'Message from Business');
        default:
            return notif.message || '';
    }
};

/** Strip leading envelope emoji from private-invitation titles (large icon carries the visual cue). */
function privateInvitationDisplayTitle(notif, t) {
    const raw = getNotifTitle(notif, t);
    return String(raw).replace(/^💌\s*/u, '').trim() || raw;
}

const Notifications = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { currentUser, userProfile } = useAuth();
    const {
        notifications,
        unreadCount,
        loading,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        deleteAllNotifications,
        formatTime,
        createNotification
    } = useNotifications();

    // Redirect guests to login
    useEffect(() => {
        if (userProfile?.isGuest) goToLogin();
    }, [userProfile, navigate]);

    // Filter and search states
    const [filterStatus, setFilterStatus] = useState('all'); // all, unread, read
    const [filterType, setFilterType] = useState('all'); // all, follow, invitation_accepted, etc.
    const [searchQuery, setSearchQuery] = useState('');

    const getIcon = (type) => {
        const iconStyle = { fontSize: '1.2rem' };
        switch (type) {
            case 'follow':
                return <FaUserPlus style={{ ...iconStyle, color: 'var(--primary)' }} />;
            case 'invitation_accepted':
                return <FaCheckCircle style={{ ...iconStyle, color: '#10b981' }} />;
            case 'invitation_rejected':
                return <FaTimesCircle style={{ ...iconStyle, color: '#ef4444' }} />;
            case 'message':
                return <FaCommentAlt style={{ ...iconStyle, color: 'var(--secondary)' }} />;
            case 'like':
                return <FaHeart style={{ ...iconStyle, color: '#f472b6' }} />;
            case 'comment':
                return <FaCommentAlt style={{ ...iconStyle, color: '#3b82f6' }} />;
            case 'reminder':
                return <FaExclamationCircle style={{ ...iconStyle, color: '#f59e0b' }} />;
            default:
                return <FaBell style={{ ...iconStyle, color: 'var(--text-secondary)' }} />;
        }
    };

    const handleNotificationClick = (notification) => {
        // Mark as read
        if (!notification.read) {
            markAsRead(notification.id);
        }

        // Special routing: business_message should always open the chat,
        // regardless of what actionUrl is stored (Cloud Function may store /profile/... by mistake)
        if (notification.type === 'business_message' || notification.type === 'message') {
            const senderId = notification.fromUserId || notification.metadata?.senderId;
            if (senderId) {
                navigate(`/chat/${senderId}`);
                return;
            }
        }

        // Navigate to action URL if exists
        if (notification.actionUrl) {
            navigate(notification.actionUrl);
        }
    };

    // Filter and search logic
    const filteredNotifications = notifications.filter(notif => {
        // Filter by status (read/unread)
        if (filterStatus === 'unread' && notif.read) return false;
        if (filterStatus === 'read' && !notif.read) return false;

        // Filter by type — some groups match multiple Firestore types
        if (filterType !== 'all') {
            const TYPE_GROUPS = {
                // Community membership notifications
                members: ['follow', 'community_member', 'new_community_member'],
                // All invitation-related types
                invitations: [
                    'invitation_accepted', 'invitation_rejected',
                    'private_invitation', 'private_invitation_response',
                    'join_request', 'request_approved', 'invitation_full'
                ],
                messages: ['message'],
                likes: ['like'],
                comments: ['comment'],
                reminders: ['reminder'],
                system: ['system_announcement'],
            };
            const allowed = TYPE_GROUPS[filterType] || [filterType];
            if (!allowed.includes(notif.type)) return false;
        }

        // Search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            const matchTitle = notif.title?.toLowerCase().includes(query);
            const matchMessage = notif.message?.toLowerCase().includes(query);
            const matchName = notif.fromUserName?.toLowerCase().includes(query);

            if (!matchTitle && !matchMessage && !matchName) return false;
        }

        return true;
    });

    if (loading) {
        return (
            <div className="page-container">
                <div className="loading-spinner">Loading...</div>
            </div>
        );
    }

    return (
        <div className="notifications-page">
            {/* Header */}
            <div className="notifications-header">
                <button onClick={() => navigate(-1)} className="back-btn">
                    <FaChevronLeft style={{ transform: i18n.language === 'ar' ? 'rotate(180deg)' : 'none' }} />
                </button>
                <h1>{t('notifications')}</h1>
                <div className="header-actions">

                    {notifications.length > 0 && (
                        <>
                            <button
                                onClick={() => navigate('/settings/notifications')}
                                className="settings-btn ui-btn ui-btn--secondary"
                                title={t('notification_settings', 'Notification Settings')}
                            >
                                <FaCog />
                            </button>

                            {unreadCount > 0 && (
                            <button
                                onClick={markAllAsRead}
                                className="mark-all-btn ui-btn ui-btn--primary"
                                title={t('mark_all_read', 'Mark all read')}
                            >
                                    <FaCheckDouble />
                                </button>
                            )}
                            <button onClick={deleteAllNotifications} className="delete-all-btn ui-btn ui-btn--ghost" title={t('delete_all', 'Delete all')}>
                                <FaTrash />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Search and Filters */}
            {notifications.length > 0 && (
                <div style={{ padding: '0 1rem 1rem' }}>
                    {/* Search Bar */}
                    <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
                        <FaSearch style={{
                            position: 'absolute',
                            left: '12px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: 'var(--text-muted)',
                            fontSize: '0.9rem'
                        }} />
                        <input
                            type="text"
                            className="ui-form-field"
                            placeholder={t('search_notifications', 'Search notifications...')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                paddingLeft: '38px'
                            }}
                        />
                    </div>

                    {/* Status Filters */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '0.5rem' }}>
                        {['all', 'unread', 'read'].map(status => (
                            <button
                                key={status}
                                onClick={() => setFilterStatus(status)}
                                className={`ui-tab ui-tab--compact ${filterStatus === status ? 'ui-tab--active' : ''}`}
                                style={{ flex: 1, textTransform: 'capitalize' }}
                            >
                                {t(status, status)}
                            </button>
                        ))}
                    </div>

                    {/* Type Filters */}
                    <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
                        {[
                            { id: 'all', label: t('all_types', 'All'), emoji: '🔔' },
                            { id: 'members', label: t('members', 'Members'), emoji: '👥' },
                            { id: 'invitations', label: t('invitations', 'Invites'), emoji: '📨' },
                            { id: 'messages', label: t('messages', 'Messages'), emoji: '💬' },
                            { id: 'likes', label: t('likes', 'Likes'), emoji: '❤️' },
                            { id: 'comments', label: t('comments', 'Comments'), emoji: '💭' },
                            { id: 'reminders', label: t('reminders', 'Reminders'), emoji: '⏰' },
                            { id: 'system', label: t('system', 'System'), emoji: '🎁' },
                        ].map(type => (
                            <button
                                key={type.id}
                                onClick={() => setFilterType(type.id)}
                                className={`ui-tab ui-tab--compact ${filterType === type.id ? 'ui-tab--active' : ''}`}
                                style={{ flex: '0 0 auto', whiteSpace: 'nowrap' }}
                            >
                                <span>{type.emoji}</span>{type.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Notifications List */}
            <div className="notifications-list">
                {filteredNotifications.length === 0 && notifications.length > 0 ? (
                    <EmptyState
                        icon={FaSearch}
                        title={t('no_results', 'No results found')}
                        message={t('try_different_filter', 'Try a different filter or search term')}
                        variant="primary"
                    />
                ) : filteredNotifications.length === 0 ? (
                    <EmptyState
                        icon={FaBell}
                        title={t('no_notifications')}
                        message={t('notifications_appear_here')}
                        variant="primary"
                    />
                ) : (
                    filteredNotifications.map(notif => (
                        <div
                            key={notif.id}
                            className={`notification-item ui-card ${!notif.read ? 'unread' : ''}${notif.type === 'private_invitation' ? ' notification-item--private-invitation' : ''}`}
                            onClick={() => handleNotificationClick(notif)}
                        >
                            {/* Unread Indicator */}
                            {!notif.read && <div className="unread-dot"></div>}

                            {notif.type === 'private_invitation' ? (
                                <PrivateInvitationNotifVisual
                                    occasionType={notif.metadata?.occasionType}
                                    hostAvatarUrl={notif.fromUserAvatar || notif.senderAvatar}
                                    hostName={notif.fromUserName || notif.senderName}
                                />
                            ) : (
                                <div className="notification-icon">
                                    {notif.fromUserAvatar ? (
                                        <UserAvatar
                                            src={notif.fromUserAvatar}
                                            user={{
                                                name: notif.fromUserName,
                                                gender: notif.fromUserGender,
                                                role: notif.fromUserRole
                                            }}
                                            alt={notif.fromUserName || 'User'}
                                        />
                                    ) : (
                                        getIcon(notif.type)
                                    )}
                                </div>
                            )}

                            {/* Content */}
                            <div className="notification-content">
                                <h4 className="notification-title">
                                    {notif.type === 'private_invitation'
                                        ? privateInvitationDisplayTitle(notif, t)
                                        : getNotifTitle(notif, t)}
                                </h4>
                                <p className="notification-message">{getNotifMessage(notif, t)}</p>
                                <span className="notification-time">{formatTime(notif.createdAt)}</span>
                            </div>

                            {/* Delete Button */}
                            <button
                                className="delete-btn ui-btn--danger-outline"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    deleteNotification(notif.id);
                                }}
                                title={t('delete', 'Delete')}
                            >
                                <FaTrash />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default Notifications;
