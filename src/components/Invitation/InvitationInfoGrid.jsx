import React from 'react';
import { getTemplateStyle } from '../../utils/invitationTemplates';
import { FaCalendarAlt, FaClock, FaMapMarkerAlt, FaUtensils, FaCreditCard, FaUsers, FaChild } from 'react-icons/fa';
import { formatAgeGroupsSmart } from '../../utils/invitationDisplayUtils';

const InvitationInfoGrid = ({ invitation, distance, restaurantName, t }) => {
    const templateStyles = getTemplateStyle(
        invitation.templateType || 'classic',
        invitation.colorScheme || 'oceanBlue',
        invitation.occasionType
    );

    const themeColor = templateStyles?.badge?.color || 'var(--primary)';

    // Helper to format date
    const formatDate = (dateString) => {
        if (!dateString) return 'TBD';
        const date = new Date(dateString);
        return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    };

    // Helper to format time
    const formatTime = (timeString) => {
        if (!timeString) return 'TBD';
        // Handle full ISO string or time string
        return timeString.includes('T') ? timeString.split('T')[1].substring(0, 5) : timeString;
    };

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
            <div style={{ background: 'var(--bg-card)', padding: '1rem', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid var(--border-color)' }}>
                <FaCalendarAlt style={{ color: themeColor }} />
                <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('date')}</div>
                    <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>{formatDate(invitation.date)}</div>
                </div>
            </div>

            <div style={{ background: 'var(--bg-card)', padding: '1rem', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid var(--border-color)' }}>
                <FaClock style={{ color: themeColor }} />
                <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('time')}</div>
                    <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>{formatTime(invitation.time)}</div>
                </div>
            </div>

            <div style={{ background: 'var(--bg-card)', padding: '1rem', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid var(--border-color)', gridColumn: 'span 2' }}>
                <FaMapMarkerAlt style={{ color: themeColor }} />
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('location')}</div>
                    <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>
                        {restaurantName || invitation.locationName || invitation.location || t('location_tbd')}
                    </div>
                    {distance && (
                        <div style={{ fontSize: '0.7rem', color: themeColor }}>
                            {distance.toFixed(1)} km away
                        </div>
                    )}
                </div>
            </div>

            <div style={{ background: 'var(--bg-card)', padding: '1rem', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid var(--border-color)' }}>
                <FaUtensils style={{ color: themeColor }} />
                <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('cuisine')}</div>
                    <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>{invitation.cuisine || 'Any'}</div>
                </div>
            </div>

            <div style={{ background: 'var(--bg-card)', padding: '1rem', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid var(--border-color)' }}>
                <FaCreditCard style={{ color: themeColor }} />
                <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('payment_label', { defaultValue: 'Payment' })}</div>
                    <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>{invitation.paymentType || t('payment_split')}</div>
                </div>
            </div>

            <div style={{ background: 'var(--bg-card)', padding: '1rem', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid var(--border-color)' }}>
                <FaUsers style={{ color: themeColor }} />
                <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('gender')}</div>
                    <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>
                        {invitation.gender === 'female_only' ? t('females_only') : (invitation.gender === 'male_only' ? t('males_only') : t('everyone'))}
                    </div>
                </div>
            </div>

            <div style={{ background: 'var(--bg-card)', padding: '1rem', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid var(--border-color)' }}>
                <FaChild style={{ color: themeColor }} />
                <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('age')}</div>
                    <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>
                        {formatAgeGroupsSmart(invitation.ageGroups || (invitation.ageRange ? [invitation.ageRange] : []), t)}
                    </div>
                </div>
            </div>
        </div>
    );
};


export default InvitationInfoGrid;
