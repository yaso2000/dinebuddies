import React from 'react';
import { FaCalendarAlt, FaClock, FaMapMarkerAlt, FaMoneyBillWave, FaUtensils } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { getTemplateStyle } from '../../utils/invitationTemplates';

const SocialInvitationInfoGrid = ({ invitation, t }) => {
    const { i18n } = useTranslation();
    const templateStyles = getTemplateStyle(
        invitation.templateType || 'classic',
        invitation.colorScheme || 'oceanBlue',
        invitation.occasionType,
        { cardFontFamily: invitation.cardFontFamily }
    );

    const themeColor = templateStyles?.badge?.color || 'var(--luxury-gold)';

    // Helper to format date — always English regardless of app language
    const formatDate = (dateString) => {
        if (!dateString) return t('tbd', { defaultValue: 'TBD' });
        const date = new Date(dateString);
        return date.toLocaleDateString(i18n.language === 'ar' ? 'ar-u-nu-latn' : 'en-AU', { weekday: 'short', month: 'short', day: 'numeric' });
    };

    // Card background and text that work in both light and dark themes
    const cardBg = 'var(--bg-card, rgba(255,255,255,0.08))';
    const cardBorder = '1px solid var(--border-color, rgba(255,255,255,0.1))';
    const labelColor = 'var(--text-muted)';
    const valueColor = 'var(--text-main)';

    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: '12px',
            marginBottom: '2rem'
        }}>
            {/* Date & Time Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="premium-glass-badge" style={{ padding: '1rem', borderRadius: '18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <FaCalendarAlt style={{ color: themeColor }} size={18} />
                    <div>
                        <div style={{ fontSize: '0.6rem', color: labelColor, textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: '800' }}>{t('date')}</div>
                        <div style={{ fontWeight: '800', fontSize: '0.95rem', color: valueColor }}>{formatDate(invitation.date)}</div>
                    </div>
                </div>

                <div className="premium-glass-badge" style={{ padding: '1rem', borderRadius: '18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <FaClock style={{ color: themeColor }} size={18} />
                    <div>
                        <div style={{ fontSize: '0.6rem', color: labelColor, textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: '800' }}>{t('time')}</div>
                        <div style={{ fontWeight: '800', fontSize: '0.95rem', color: valueColor }}>{invitation.time || t('tbd', { defaultValue: 'TBD' })}</div>
                    </div>
                </div>
            </div>

            {/* Category — hidden for private invites */}
            {invitation.type !== 'Dating' && (
                <div className="premium-glass-badge" style={{ padding: '1rem', borderRadius: '18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <FaUtensils style={{ color: themeColor, opacity: 0.8 }} size={18} />
                    <div>
                        <div style={{ fontSize: '0.6rem', color: labelColor, textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: '800' }}>{t('category', { defaultValue: 'Category' })}</div>
                        <div style={{ fontWeight: '800', fontSize: '0.95rem', color: valueColor }}>{invitation.type ? t(invitation.type) : (invitation.businessType ? t(invitation.businessType) : t('venue', { defaultValue: 'Venue' }))}</div>
                    </div>
                </div>
            )}

            {/* Location */}
            <div className="premium-glass-badge" style={{ padding: '1rem', borderRadius: '18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <FaMapMarkerAlt style={{ color: themeColor }} size={18} />
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.6rem', color: labelColor, textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: '800' }}>{t('location')}</div>
                    <div style={{ fontWeight: '800', fontSize: '0.95rem', color: valueColor }}>
                        {invitation.restaurantName || invitation.location || t('location_tbd')}
                    </div>
                </div>
            </div>

            {/* Payment — not shown for private invites */}
            {invitation.type !== 'Dating' && (
                <div className="premium-glass-badge" style={{ padding: '1rem', borderRadius: '18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <FaMoneyBillWave style={{ color: themeColor }} size={18} />
                    <div>
                        <div style={{ fontSize: '0.6rem', color: labelColor, textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: '800' }}>{t('payment')}</div>
                        <div style={{ fontWeight: '800', fontSize: '0.95rem', color: valueColor }}>
                            {invitation.paymentType ? (t(invitation.paymentType.toLowerCase().replace(' ', '_')) || invitation.paymentType) : t('not_specified')}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SocialInvitationInfoGrid;
