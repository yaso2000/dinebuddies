import React, { useMemo } from 'react';
import { useInvitations } from '../context/InvitationContext';
import { useTranslation } from 'react-i18next';
import InvitationCard from '../components/InvitationCard';
import { FaUsers, FaUserPlus } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

const FriendsFeed = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { getFollowingInvitations, currentUser } = useInvitations();

    const followingInvitations = useMemo(() => getFollowingInvitations(), [getFollowingInvitations]);

    return (
        <div className="page-container" style={{ paddingBottom: '100px', animation: 'fadeIn 0.5s ease-out' }}>
            <div style={{ padding: '1.5rem 1.25rem' }}>
                <h1 style={{ fontSize: '1.8rem', fontWeight: '900', marginBottom: '0.5rem' }}>
                    {i18n.language === 'ar' ? 'دعوات الأصدقاء' : 'Friends Circle'}
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    {i18n.language === 'ar' ? 'شاهد ما يخطط له الأشخاص الذين تتابعهم' : 'See what your network is planning'}
                </p>
            </div>

            <div style={{ padding: '0 1.25rem' }}>
                {followingInvitations.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        padding: '5rem 2rem',
                        background: 'var(--bg-card)',
                        borderRadius: '24px',
                        border: '1px dashed var(--border-color)',
                        marginTop: '1rem'
                    }}>
                        <FaUsers style={{ fontSize: '3.5rem', color: 'var(--primary)', opacity: 0.3, marginBottom: '1.5rem' }} />
                        <h3 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '0.5rem' }}>
                            {i18n.language === 'ar' ? 'دائرتك هادئة حالياً' : 'Your circle is quiet'}
                        </h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '2rem' }}>
                            {i18n.language === 'ar'
                                ? 'تابع المزيد من الأشخاص لتظهر دعواتهم هنا وتكون أول المنضمين!'
                                : 'Follow more people to see their invitations here and be the first to join!'}
                        </p>
                        <button
                            onClick={() => navigate('/')}
                            className="btn btn-primary"
                            style={{ borderRadius: '15px', padding: '12px 25px' }}
                        >
                            <FaUserPlus style={{ marginInlineEnd: '8px' }} />
                            {i18n.language === 'ar' ? 'استكشاف أشخاص جدد' : 'Explore New People'}
                        </button>
                    </div>
                ) : (
                    <div className="feed-list">
                        {followingInvitations.map(inv => (
                            <InvitationCard key={inv.id} invitation={inv} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default FriendsFeed;
