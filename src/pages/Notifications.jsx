import React, { useEffect } from 'react';
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
    FaFlask
} from 'react-icons/fa';
import './Notifications.css';

const Notifications = () => {
    const { i18n } = useTranslation();
    const navigate = useNavigate();
    const { currentUser } = useAuth();
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

    // Create test notification
    const createTestNotification = () => {
        if (!currentUser?.uid) {
            alert('Please login first!');
            return;
        }

        createNotification({
            userId: currentUser.uid,
            type: 'follow',
            title: 'Test Notification',
            message: 'This is a test notification. It works! 🎉',
            fromUserName: 'Test User',
            fromUserAvatar: 'https://i.pravatar.cc/150?img=12'
        });
    };

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

        // Navigate to action URL if exists
        if (notification.actionUrl) {
            navigate(notification.actionUrl);
        }
    };

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
                <h1>{i18n.language === 'ar' ? 'التنبيهات' : 'Notifications'}</h1>
                <div className="header-actions">
                    {/* Test button - for development */}
                    <button onClick={createTestNotification} className="test-btn" title="Create test notification">
                        <FaFlask />
                    </button>
                    {notifications.length > 0 && (
                        <>
                            {unreadCount > 0 && (
                                <button onClick={markAllAsRead} className="mark-all-btn">
                                    Mark all read
                                </button>
                            )}
                            <button onClick={deleteAllNotifications} className="delete-all-btn" title="Delete all">
                                <FaTrash />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Notifications List */}
            <div className="notifications-list">
                {notifications.length === 0 ? (
                    <div className="empty-state">
                        <FaBell className="empty-icon" />
                        <h3>{i18n.language === 'ar' ? 'لا توجد تنبيهات' : 'No notifications yet'}</h3>
                        <p>{i18n.language === 'ar' ? 'سيتم عرض التنبيهات هنا' : 'Your notifications will appear here'}</p>
                    </div>
                ) : (
                    notifications.map(notif => (
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
                                title="Delete"
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
