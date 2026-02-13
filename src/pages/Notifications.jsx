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
import './Notifications.css';

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
        if (userProfile?.accountType === 'guest' || userProfile?.role === 'guest') {
            navigate('/login');
        }
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
        console.log('🔔 Notification clicked:', {
            id: notification.id,
            type: notification.type,
            actionUrl: notification.actionUrl,
            read: notification.read
        });

        // Mark as read
        if (!notification.read) {
            markAsRead(notification.id);
        }

        // Navigate to action URL if exists
        if (notification.actionUrl) {
            console.log('🚀 Navigating to:', notification.actionUrl);
            navigate(notification.actionUrl);
        } else {
            console.log('⚠️ No actionUrl found in notification');
        }
    };

    // Filter and search logic
    const filteredNotifications = notifications.filter(notif => {
        // Filter by status (read/unread)
        if (filterStatus === 'unread' && notif.read) return false;
        if (filterStatus === 'read' && !notif.read) return false;

        // Filter by type
        if (filterType !== 'all' && notif.type !== filterType) return false;

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
                                className="settings-btn"
                                title={t('notification_settings', 'Notification Settings')}
                            >
                                <FaCog />
                            </button>

                            {unreadCount > 0 && (
                                <button
                                    onClick={markAllAsRead}
                                    className="mark-all-btn"
                                    title={t('mark_all_read', 'Mark all read')}
                                >
                                    <FaCheckDouble />
                                </button>
                            )}
                            <button onClick={deleteAllNotifications} className="delete-all-btn" title={t('delete_all', 'Delete all')}>
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
                            placeholder={t('search_notifications', 'Search notifications...')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '10px 12px 10px 38px',
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '12px',
                                color: 'var(--text-main)',
                                fontSize: '0.9rem'
                            }}
                        />
                    </div>

                    {/* Status Filters */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '0.5rem' }}>
                        {['all', 'unread', 'read'].map(status => (
                            <button
                                key={status}
                                onClick={() => setFilterStatus(status)}
                                style={{
                                    flex: 1,
                                    padding: '8px 12px',
                                    background: filterStatus === status ? 'var(--primary)' : 'var(--bg-card)',
                                    color: filterStatus === status ? 'white' : 'var(--text-main)',
                                    border: `1px solid ${filterStatus === status ? 'var(--primary)' : 'var(--border-color)'}`,
                                    borderRadius: '10px',
                                    fontSize: '0.85rem',
                                    fontWeight: filterStatus === status ? '700' : '500',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    textTransform: 'capitalize'
                                }}
                            >
                                {t(status, status)}
                            </button>
                        ))}
                    </div>

                    {/* Type Filters */}
                    <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
                        {[
                            { id: 'all', label: t('all_types', 'All') },
                            { id: 'follow', label: t('follows', 'Follows') },
                            { id: 'invitation_accepted', label: t('invitations', 'Invitations') },
                            { id: 'message', label: t('messages', 'Messages') },
                            { id: 'like', label: t('likes', 'Likes') },
                            { id: 'comment', label: t('comments', 'Comments') },
                            { id: 'reminder', label: t('reminders', 'Reminders') }
                        ].map(type => (
                            <button
                                key={type.id}
                                onClick={() => setFilterType(type.id)}
                                style={{
                                    flex: '0 0 auto',
                                    padding: '6px 12px',
                                    background: filterType === type.id ? 'rgba(139, 92, 246, 0.15)' : 'var(--bg-card)',
                                    color: filterType === type.id ? 'var(--primary)' : 'var(--text-muted)',
                                    border: `1px solid ${filterType === type.id ? 'var(--primary)' : 'var(--border-color)'}`,
                                    borderRadius: '8px',
                                    fontSize: '0.8rem',
                                    fontWeight: filterType === type.id ? '600' : '500',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                {type.label}
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
                            className={`notification-item ${!notif.read ? 'unread' : ''}`}
                            onClick={() => handleNotificationClick(notif)}
                        >
                            {/* Unread Indicator */}
                            {!notif.read && <div className="unread-dot"></div>}

                            {/* Avatar/Icon */}
                            <div className="notification-icon">
                                {notif.fromUserAvatar ? (
                                    <img src={notif.fromUserAvatar} alt={notif.fromUserName || 'User'} />
                                ) : (
                                    getIcon(notif.type)
                                )}
                            </div>

                            {/* Content */}
                            <div className="notification-content">
                                <h4 className="notification-title">{notif.title}</h4>
                                <p className="notification-message">{notif.message}</p>
                                <span className="notification-time">{formatTime(notif.createdAt)}</span>
                            </div>

                            {/* Delete Button */}
                            <button
                                className="delete-btn"
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
