import React from 'react';
import { FaCalendarAlt, FaClock, FaMapMarkerAlt, FaMoneyBillWave } from 'react-icons/fa';
import { getTemplateStyle } from '../../utils/invitationTemplates';

const PrivateInvitationInfoGrid = ({ invitation, t }) => {
    const templateStyles = getTemplateStyle(
        invitation.templateType || 'classic',
        invitation.colorScheme || 'oceanBlue',
        invitation.occasionType
    );

    const themeColor = templateStyles?.badge?.color || 'var(--luxury-gold)';

    // Helper to format date
    const formatDate = (dateString) => {
        if (!dateString) return 'TBD';
        const date = new Date(dateString);
        // Use the current language for formatting
        const lang = (typeof window !== 'undefined' && window.localStorage.getItem('i18nextLng')) || 'ar';
        return date.toLocaleDateString(lang, { weekday: 'short', month: 'short', day: 'numeric' });
    };

    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: '12px',
            marginBottom: '2rem'
        }}>
            {/* Date & Time Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '18px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }}>
                    <FaCalendarAlt style={{ color: themeColor }} size={18} />
                    <div>
                        <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: '800' }}>{t('date')}</div>
                        <div style={{ fontWeight: '800', fontSize: '0.95rem', color: 'white' }}>{formatDate(invitation.date)}</div>
                    </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '18px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }}>
                    <FaClock style={{ color: themeColor }} size={18} />
                    <div>
                        <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: '800' }}>{t('time')}</div>
                        <div style={{ fontWeight: '800', fontSize: '0.95rem', color: 'white' }}>{invitation.time || 'TBD'}</div>
                    </div>
                </div>
            </div>

            {/* Location */}
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '18px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }}>
                <FaMapMarkerAlt style={{ color: themeColor }} size={18} />
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: '800' }}>{t('location')}</div>
                    <div style={{ fontWeight: '800', fontSize: '0.95rem', color: 'white' }}>
                        {invitation.restaurantName || invitation.location || t('location_tbd')}
                    </div>
                </div>
            </div>

            {/* Payment */}
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '18px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }}>
                <FaMoneyBillWave style={{ color: themeColor }} size={18} />
                <div>
                    <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: '800' }}>{t('payment')}</div>
                    <div style={{ fontWeight: '800', fontSize: '0.95rem', color: 'white' }}>
                        {invitation.paymentType ? (t(invitation.paymentType.toLowerCase().replace(' ', '_')) || invitation.paymentType) : t('not_specified')}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PrivateInvitationInfoGrid;
