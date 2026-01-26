import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInvitations } from '../context/InvitationContext';
import { useTranslation } from 'react-i18next';
import { FaBell, FaCheckCircle, FaCommentAlt, FaChevronLeft, FaTrash } from 'react-icons/fa';

const Notifications = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { notifications, markAllAsRead } = useInvitations();

    useEffect(() => {
        // Mark as read when viewing the page
        return () => markAllAsRead();
    }, []);

    const getIcon = (type) => {
        switch (type) {
            case 'approval': return <FaCheckCircle style={{ color: 'var(--accent)' }} />;
            case 'message': return <FaCommentAlt style={{ color: 'var(--primary)' }} />;
            default: return <FaBell style={{ color: 'var(--secondary)' }} />;
        }
    };

    return (
        <div className="page-container" style={{ animation: 'fadeIn 0.5s ease-out', padding: '1rem 1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '2rem' }}>
                <button onClick={() => navigate(-1)} className="back-btn" style={{ background: 'var(--bg-card)' }}>
                    <FaChevronLeft style={{ transform: i18n.language === 'ar' ? 'rotate(180deg)' : 'none' }} />
                </button>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '900' }}>{i18n.language === 'ar' ? 'التنبيهات' : 'Notifications'}</h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {notifications.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '5rem 1rem', opacity: 0.5 }}>
                        <FaBell style={{ fontSize: '3rem', marginBottom: '1rem' }} />
                        <p>{i18n.language === 'ar' ? 'لا توجد تنبيهات حالياً' : 'No notifications yet'}</p>
                    </div>
                ) : (
                    notifications.map(notif => (
                        <div key={notif.id} style={{
                            background: notif.read ? 'var(--bg-card)' : 'linear-gradient(135deg, var(--bg-card) 0%, rgba(139, 92, 246, 0.05) 100%)',
                            padding: '1.25rem',
                            borderRadius: 'var(--radius-lg)',
                            border: `1px solid ${notif.read ? 'var(--border-color)' : 'var(--primary)'}`,
                            display: 'flex',
                            gap: '1rem',
                            position: 'relative',
                            transition: 'all 0.3s'
                        }}>
                            {!notif.read && (
                                <div style={{
                                    position: 'absolute',
                                    top: '1.25rem',
                                    [i18n.language === 'ar' ? 'left' : 'right']: '1.25rem',
                                    width: '8px',
                                    height: '8px',
                                    background: 'var(--secondary)',
                                    borderRadius: '50%'
                                }}></div>
                            )}
                            <div style={{
                                width: '45px',
                                height: '45px',
                                borderRadius: 'var(--radius-md)',
                                background: 'var(--bg-body)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1.2rem',
                                flexShrink: 0
                            }}>
                                {getIcon(notif.type)}
                            </div>
                            <div style={{ flex: 1 }}>
                                <h4 style={{ fontSize: '1rem', fontWeight: '800', marginBottom: '0.25rem', color: notif.read ? 'var(--text-white)' : 'var(--primary)' }}>{notif.title}</h4>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4', marginBottom: '0.5rem' }}>{notif.message}</p>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', opacity: 0.6 }}>{notif.time}</span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default Notifications;
