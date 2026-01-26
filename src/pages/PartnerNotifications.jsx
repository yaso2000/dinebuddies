import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaArrowRight, FaBell, FaCheckCircle, FaUsers, FaCalendarAlt, FaClock } from 'react-icons/fa';

const PartnerNotifications = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);

    useEffect(() => {
        // Load partner notifications from localStorage
        const partnerNotifications = JSON.parse(localStorage.getItem('partner_notifications') || '[]');
        setNotifications(partnerNotifications);
    }, []);

    const markAsRead = (notificationId) => {
        const updated = notifications.map(n =>
            n.id === notificationId ? { ...n, read: true } : n
        );
        setNotifications(updated);
        localStorage.setItem('partner_notifications', JSON.stringify(updated));
    };

    const markAllAsRead = () => {
        const updated = notifications.map(n => ({ ...n, read: true }));
        setNotifications(updated);
        localStorage.setItem('partner_notifications', JSON.stringify(updated));
    };

    const getNotificationIcon = (type) => {
        switch (type) {
            case 'new_booking':
                return '🎉';
            case 'member_joined':
                return '👥';
            case 'group_full':
                return '✅';
            default:
                return '🔔';
        }
    };

    const getNotificationColor = (type) => {
        switch (type) {
            case 'new_booking':
                return 'rgba(139, 92, 246, 0.15)';
            case 'member_joined':
                return 'rgba(59, 130, 246, 0.15)';
            case 'group_full':
                return 'rgba(16, 185, 129, 0.15)';
            default:
                return 'rgba(255, 255, 255, 0.05)';
        }
    };

    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return i18n.language === 'ar' ? 'الآن' : 'Now';
        if (diffMins < 60) return `${diffMins} ${i18n.language === 'ar' ? 'دقيقة' : 'min'}`;
        if (diffHours < 24) return `${diffHours} ${i18n.language === 'ar' ? 'ساعة' : 'hour'}`;
        if (diffDays < 7) return `${diffDays} ${i18n.language === 'ar' ? 'يوم' : 'day'}`;

        return date.toLocaleDateString(i18n.language === 'ar' ? 'ar-SA' : 'en-US', {
            month: 'short',
            day: 'numeric'
        });
    };

    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <div className="page-container" style={{ paddingBottom: '100px', minHeight: '100vh' }}>
            {/* Header */}
            <header className="app-header">
                <button className="back-btn" onClick={() => navigate('/profile')}>
                    <FaArrowRight style={i18n.language === 'ar' ? {} : { transform: 'rotate(180deg)' }} />
                </button>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '800' }}>
                    {i18n.language === 'ar' ? 'إشعارات الشريك' : 'Partner Notifications'}
                </h3>
                <div style={{ width: '40px' }}></div>
            </header>

            <div style={{ padding: '1.5rem' }}>
                {/* Stats Card */}
                <div style={{
                    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(244, 63, 94, 0.1) 100%)',
                    padding: '1.5rem',
                    borderRadius: '20px',
                    marginBottom: '1.5rem',
                    border: '1px solid rgba(139, 92, 246, 0.2)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div>
                        <div style={{ fontSize: '2rem', fontWeight: '900', color: 'var(--primary)' }}>
                            {unreadCount}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                            {i18n.language === 'ar' ? 'إشعار جديد' : 'New Notifications'}
                        </div>
                    </div>
                    {unreadCount > 0 && (
                        <button
                            onClick={markAllAsRead}
                            style={{
                                background: 'var(--primary)',
                                color: 'white',
                                border: 'none',
                                padding: '10px 20px',
                                borderRadius: '12px',
                                fontSize: '0.85rem',
                                fontWeight: '700',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                        >
                            <FaCheckCircle />
                            {i18n.language === 'ar' ? 'تحديد الكل كمقروء' : 'Mark All Read'}
                        </button>
                    )}
                </div>

                {/* Notifications List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {notifications.length === 0 ? (
                        <div style={{
                            textAlign: 'center',
                            padding: '3rem 1rem',
                            color: 'var(--text-muted)'
                        }}>
                            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔔</div>
                            <p style={{ fontSize: '0.9rem', fontWeight: '600' }}>
                                {i18n.language === 'ar' ? 'لا توجد إشعارات حالياً' : 'No notifications yet'}
                            </p>
                        </div>
                    ) : (
                        notifications.map(notification => (
                            <div
                                key={notification.id}
                                onClick={() => {
                                    markAsRead(notification.id);
                                    if (notification.invitationId) {
                                        navigate(`/invitation/${notification.invitationId}`);
                                    }
                                }}
                                style={{
                                    background: notification.read ? 'var(--bg-card)' : getNotificationColor(notification.type),
                                    borderRadius: '20px',
                                    padding: '1.25rem',
                                    border: `1px solid ${notification.read ? 'var(--border-color)' : 'var(--primary)'}`,
                                    cursor: 'pointer',
                                    transition: 'all 0.3s',
                                    position: 'relative'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = '0 8px 20px rgba(139, 92, 246, 0.2)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                            >
                                {/* Unread Indicator */}
                                {!notification.read && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '12px',
                                        right: i18n.language === 'ar' ? '12px' : 'auto',
                                        left: i18n.language === 'ar' ? 'auto' : '12px',
                                        width: '10px',
                                        height: '10px',
                                        background: 'var(--primary)',
                                        borderRadius: '50%',
                                        boxShadow: '0 0 8px var(--primary)'
                                    }}></div>
                                )}

                                {/* Icon and Title */}
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '8px' }}>
                                    <div style={{
                                        fontSize: '2rem',
                                        lineHeight: 1
                                    }}>
                                        {getNotificationIcon(notification.type)}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{
                                            fontSize: '1rem',
                                            fontWeight: '800',
                                            marginBottom: '4px'
                                        }}>
                                            {notification.title}
                                        </div>
                                        <div style={{
                                            fontSize: '0.85rem',
                                            color: 'var(--text-muted)',
                                            lineHeight: '1.5'
                                        }}>
                                            {notification.message}
                                        </div>
                                    </div>
                                </div>

                                {/* Additional Info */}
                                {notification.type === 'new_booking' && (
                                    <div style={{
                                        display: 'flex',
                                        gap: '12px',
                                        marginTop: '12px',
                                        paddingTop: '12px',
                                        borderTop: '1px solid var(--border-color)',
                                        fontSize: '0.75rem',
                                        color: 'var(--text-muted)'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <FaCalendarAlt />
                                            {new Date(notification.date).toLocaleDateString(i18n.language === 'ar' ? 'ar-SA' : 'en-US')}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <FaClock />
                                            {notification.time}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <FaUsers />
                                            {notification.guestsNeeded} {i18n.language === 'ar' ? 'أشخاص' : 'guests'}
                                        </div>
                                    </div>
                                )}

                                {notification.type === 'member_joined' && (
                                    <div style={{
                                        marginTop: '12px',
                                        paddingTop: '12px',
                                        borderTop: '1px solid var(--border-color)'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{
                                                flex: 1,
                                                height: '8px',
                                                background: 'rgba(255, 255, 255, 0.1)',
                                                borderRadius: '4px',
                                                overflow: 'hidden'
                                            }}>
                                                <div style={{
                                                    width: `${(notification.currentCount / notification.totalNeeded) * 100}%`,
                                                    height: '100%',
                                                    background: 'var(--primary)',
                                                    borderRadius: '4px',
                                                    transition: 'width 0.3s'
                                                }}></div>
                                            </div>
                                            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--primary)' }}>
                                                {notification.currentCount}/{notification.totalNeeded}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Timestamp */}
                                <div style={{
                                    fontSize: '0.7rem',
                                    color: 'var(--text-muted)',
                                    marginTop: '8px',
                                    fontWeight: '600'
                                }}>
                                    {formatTime(notification.timestamp)}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default PartnerNotifications;
