import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaBell, FaBullhorn, FaCrown, FaChevronRight } from 'react-icons/fa';

/**
 * Business dashboard: personal push settings + paid member broadcast entry.
 */
const BusinessMemberNotificationsPanel = ({ tierAccess, memberCount = 0 }) => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const isRtl = i18n.language === 'ar';
    const canBroadcast = tierAccess?.canUseMemberNotifications === true;

    const scrollToCommunityManagement = () => {
        const el = document.getElementById('community-management');
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
        }
        navigate('/business-dashboard#business-notifications');
    };

    const rowBtnStyle = {
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '14px 16px',
        background: 'var(--bg-body)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        cursor: 'pointer',
        textAlign: isRtl ? 'right' : 'left',
        color: 'var(--text-main)',
    };

    return (
        <section
            id="business-notifications"
            style={{
                marginTop: '1.5rem',
                marginBottom: '1rem',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '16px',
                padding: '1.25rem 1.5rem',
            }}
        >
            <h3
                style={{
                    margin: '0 0 1rem',
                    fontSize: '1.15rem',
                    fontWeight: '800',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                }}
            >
                <FaBell style={{ color: 'var(--primary)' }} />
                {t('business_notification_settings', 'Notifications')}
            </h3>

            <button
                type="button"
                className="ios-tap-target"
                onClick={() => navigate('/settings/notifications')}
                style={rowBtnStyle}
            >
                <FaBell style={{ color: 'var(--primary)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: '700', fontSize: '0.95rem' }}>
                        {t('open_notification_settings', 'Your notification preferences')}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {t('open_notification_settings_desc', 'Push, email, sounds, and quiet hours')}
                    </div>
                </div>
                <FaChevronRight
                    style={{
                        flexShrink: 0,
                        opacity: 0.6,
                        transform: isRtl ? 'rotate(180deg)' : 'none',
                    }}
                />
            </button>

            <div
                style={{
                    marginTop: '12px',
                    padding: '14px 16px',
                    borderRadius: '12px',
                    border: canBroadcast
                        ? '1px solid rgba(139, 92, 246, 0.35)'
                        : '1px dashed var(--border-color)',
                    background: canBroadcast
                        ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.08), rgba(236, 72, 153, 0.05))'
                        : 'var(--bg-body)',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                    <FaBullhorn style={{ color: canBroadcast ? 'var(--primary)' : 'var(--text-muted)', marginTop: '2px' }} />
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '800', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            {t('business_member_notifications', 'Member alerts & offers')}
                            {!canBroadcast && (
                                <span
                                    style={{
                                        fontSize: '0.65rem',
                                        fontWeight: '800',
                                        padding: '2px 8px',
                                        borderRadius: '8px',
                                        background: 'rgba(245, 158, 11, 0.2)',
                                        color: '#f59e0b',
                                    }}
                                >
                                    {t('paid_plan', 'Paid')}
                                </span>
                            )}
                        </div>
                        <p style={{ margin: '6px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                            {canBroadcast
                                ? t(
                                    'business_member_notifications_desc',
                                    'Send offers and updates to your community members via direct message (with push).'
                                )
                                : t(
                                    'business_member_notifications_paid_only',
                                    'Upgrade to send promotional alerts and offers to all community members.'
                                )}
                        </p>
                        {canBroadcast && memberCount > 0 && (
                            <p style={{ margin: '8px 0 0', fontSize: '0.75rem', color: 'var(--primary)', fontWeight: '600' }}>
                                {memberCount} {t('members_count', 'members')}
                            </p>
                        )}
                    </div>
                </div>

                {canBroadcast ? (
                    <button
                        type="button"
                        onClick={scrollToCommunityManagement}
                        style={{
                            width: '100%',
                            padding: '10px 16px',
                            border: 'none',
                            borderRadius: '10px',
                            background: 'var(--primary)',
                            color: 'white',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                        }}
                    >
                        <FaBullhorn />
                        {t('send_offers_to_members', 'Message members')}
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={() => navigate('/settings/subscription')}
                        style={{
                            width: '100%',
                            padding: '10px 16px',
                            border: 'none',
                            borderRadius: '10px',
                            background: 'linear-gradient(135deg, #f59e0b, #ea580c)',
                            color: 'white',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                        }}
                    >
                        <FaCrown />
                        {t('upgrade_for_member_notifications', 'Upgrade to unlock member alerts')}
                    </button>
                )}
            </div>
        </section>
    );
};

export default BusinessMemberNotificationsPanel;
