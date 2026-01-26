import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useInvitations } from '../context/InvitationContext';
import { FaArrowRight, FaComments, FaUserPlus, FaUserCheck, FaUsers, FaHeart } from 'react-icons/fa';

const FollowersList = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { currentUser, toggleFollow } = useInvitations();
    const [activeTab, setActiveTab] = useState('mutual'); // 'followers', 'following', 'mutual'

    // Mock users data - في التطبيق الحقيقي، سيتم جلبها من API
    const allUsers = [
        {
            id: 'user_1',
            name: 'أحمد محمد',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ahmed',
            bio: 'محب للطعام الإيطالي',
            mutualFollowers: 12,
            isFollowingMe: true,
            isFollowedByMe: true
        },
        {
            id: 'user_2',
            name: 'سارة علي',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sara',
            bio: 'عاشقة القهوة المختصة',
            mutualFollowers: 8,
            isFollowingMe: true,
            isFollowedByMe: true
        },
        {
            id: 'user_3',
            name: 'خالد عبدالله',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Khaled',
            bio: 'مستكشف مطاعم جديدة',
            mutualFollowers: 5,
            isFollowingMe: true,
            isFollowedByMe: false
        },
        {
            id: 'user_4',
            name: 'نورة سعيد',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Noura',
            bio: 'محبة للتجارب الجديدة',
            mutualFollowers: 15,
            isFollowingMe: false,
            isFollowedByMe: true
        },
        {
            id: 'user_5',
            name: 'محمد الأحمد',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mohammed',
            bio: 'من عشاق السوشي',
            mutualFollowers: 20,
            isFollowingMe: true,
            isFollowedByMe: true
        }
    ];

    // Filter users based on active tab
    const getFilteredUsers = () => {
        switch (activeTab) {
            case 'followers':
                return allUsers.filter(u => u.isFollowingMe);
            case 'following':
                return allUsers.filter(u => u.isFollowedByMe);
            case 'mutual':
                return allUsers.filter(u => u.isFollowingMe && u.isFollowedByMe);
            default:
                return allUsers;
        }
    };

    const filteredUsers = getFilteredUsers();

    const handleChatClick = (userId) => {
        // Navigate to chat page
        navigate(`/chat/${userId}`);
    };

    const handleProfileClick = (userId) => {
        navigate(`/profile/${userId}`);
    };

    const isMutualFollow = (user) => {
        return user.isFollowingMe && user.isFollowedByMe;
    };

    return (
        <div className="page-container" style={{ paddingBottom: '100px', minHeight: '100vh' }}>
            {/* Header */}
            <header className="app-header">
                <button className="back-btn" onClick={() => navigate('/profile')}>
                    <FaArrowRight style={i18n.language === 'ar' ? {} : { transform: 'rotate(180deg)' }} />
                </button>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '800' }}>
                    {i18n.language === 'ar' ? 'المتابعون' : 'Followers'}
                </h3>
                <div style={{ width: '40px' }}></div>
            </header>

            <div style={{ padding: '1.5rem' }}>
                {/* Tabs */}
                <div style={{
                    display: 'flex',
                    gap: '8px',
                    marginBottom: '1.5rem',
                    background: 'var(--bg-card)',
                    padding: '6px',
                    borderRadius: '16px',
                    border: '1px solid var(--border-color)'
                }}>
                    <button
                        onClick={() => setActiveTab('mutual')}
                        style={{
                            flex: 1,
                            padding: '10px',
                            borderRadius: '12px',
                            border: 'none',
                            background: activeTab === 'mutual' ? 'var(--primary)' : 'transparent',
                            color: activeTab === 'mutual' ? 'white' : 'var(--text-muted)',
                            fontSize: '0.85rem',
                            fontWeight: '800',
                            cursor: 'pointer',
                            transition: 'all 0.3s',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                        }}
                    >
                        <FaHeart />
                        {i18n.language === 'ar' ? 'متبادلة' : 'Mutual'}
                    </button>
                    <button
                        onClick={() => setActiveTab('followers')}
                        style={{
                            flex: 1,
                            padding: '10px',
                            borderRadius: '12px',
                            border: 'none',
                            background: activeTab === 'followers' ? 'var(--primary)' : 'transparent',
                            color: activeTab === 'followers' ? 'white' : 'var(--text-muted)',
                            fontSize: '0.85rem',
                            fontWeight: '800',
                            cursor: 'pointer',
                            transition: 'all 0.3s',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                        }}
                    >
                        <FaUsers />
                        {i18n.language === 'ar' ? 'متابعون' : 'Followers'}
                    </button>
                    <button
                        onClick={() => setActiveTab('following')}
                        style={{
                            flex: 1,
                            padding: '10px',
                            borderRadius: '12px',
                            border: 'none',
                            background: activeTab === 'following' ? 'var(--primary)' : 'transparent',
                            color: activeTab === 'following' ? 'white' : 'var(--text-muted)',
                            fontSize: '0.85rem',
                            fontWeight: '800',
                            cursor: 'pointer',
                            transition: 'all 0.3s',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                        }}
                    >
                        <FaUserCheck />
                        {i18n.language === 'ar' ? 'أتابع' : 'Following'}
                    </button>
                </div>

                {/* Stats */}
                <div style={{
                    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(244, 63, 94, 0.1) 100%)',
                    padding: '1rem',
                    borderRadius: '16px',
                    marginBottom: '1.5rem',
                    border: '1px solid rgba(139, 92, 246, 0.2)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
                        <div>
                            <div style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--primary)' }}>
                                {allUsers.filter(u => u.isFollowingMe && u.isFollowedByMe).length}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '700' }}>
                                {i18n.language === 'ar' ? 'متابعة متبادلة' : 'Mutual'}
                            </div>
                        </div>
                        <div style={{ borderLeft: '1px solid var(--border-color)' }}></div>
                        <div>
                            <div style={{ fontSize: '1.5rem', fontWeight: '900', color: 'white' }}>
                                {allUsers.filter(u => u.isFollowingMe).length}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '700' }}>
                                {i18n.language === 'ar' ? 'متابعون' : 'Followers'}
                            </div>
                        </div>
                        <div style={{ borderLeft: '1px solid var(--border-color)' }}></div>
                        <div>
                            <div style={{ fontSize: '1.5rem', fontWeight: '900', color: 'white' }}>
                                {allUsers.filter(u => u.isFollowedByMe).length}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '700' }}>
                                {i18n.language === 'ar' ? 'أتابع' : 'Following'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Users List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {filteredUsers.length === 0 ? (
                        <div style={{
                            textAlign: 'center',
                            padding: '3rem 1rem',
                            color: 'var(--text-muted)'
                        }}>
                            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👥</div>
                            <p style={{ fontSize: '0.9rem', fontWeight: '600' }}>
                                {i18n.language === 'ar' ? 'لا يوجد مستخدمون في هذه القائمة' : 'No users in this list'}
                            </p>
                        </div>
                    ) : (
                        filteredUsers.map(user => (
                            <div
                                key={user.id}
                                style={{
                                    background: 'var(--bg-card)',
                                    borderRadius: '20px',
                                    padding: '1rem',
                                    border: '1px solid var(--border-color)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    transition: 'all 0.3s',
                                    cursor: 'pointer'
                                }}
                                onClick={() => handleProfileClick(user.id)}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = '0 8px 20px rgba(139, 92, 246, 0.2)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                            >
                                {/* Avatar */}
                                <div style={{ position: 'relative' }}>
                                    <div style={{
                                        width: '60px',
                                        height: '60px',
                                        borderRadius: '50%',
                                        border: `3px solid ${isMutualFollow(user) ? 'var(--primary)' : 'var(--border-color)'}`,
                                        overflow: 'hidden'
                                    }}>
                                        <img
                                            src={user.avatar}
                                            alt={user.name}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                    </div>
                                    {/* Online indicator */}
                                    <div style={{
                                        position: 'absolute',
                                        bottom: '2px',
                                        right: '2px',
                                        width: '14px',
                                        height: '14px',
                                        background: '#10b981',
                                        border: '2px solid var(--bg-card)',
                                        borderRadius: '50%'
                                    }}></div>
                                </div>

                                {/* User Info */}
                                <div style={{ flex: 1 }}>
                                    <div style={{
                                        fontSize: '1rem',
                                        fontWeight: '800',
                                        marginBottom: '4px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}>
                                        {user.name}
                                        {isMutualFollow(user) && (
                                            <span style={{
                                                background: 'rgba(139, 92, 246, 0.2)',
                                                color: 'var(--primary)',
                                                padding: '2px 8px',
                                                borderRadius: '8px',
                                                fontSize: '0.65rem',
                                                fontWeight: '800',
                                                border: '1px solid rgba(139, 92, 246, 0.3)'
                                            }}>
                                                <FaHeart style={{ fontSize: '0.6rem' }} /> {i18n.language === 'ar' ? 'متبادلة' : 'Mutual'}
                                            </span>
                                        )}
                                    </div>
                                    <div style={{
                                        fontSize: '0.8rem',
                                        color: 'var(--text-muted)',
                                        marginBottom: '4px'
                                    }}>
                                        {user.bio}
                                    </div>
                                    <div style={{
                                        fontSize: '0.7rem',
                                        color: 'var(--text-muted)',
                                        fontWeight: '600'
                                    }}>
                                        {user.mutualFollowers} {i18n.language === 'ar' ? 'متابع مشترك' : 'mutual followers'}
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {/* Chat Button - Only for mutual followers */}
                                    {isMutualFollow(user) && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleChatClick(user.id);
                                            }}
                                            style={{
                                                background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '12px',
                                                padding: '10px 16px',
                                                fontSize: '0.85rem',
                                                fontWeight: '800',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)',
                                                transition: 'all 0.3s'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.transform = 'scale(1.05)';
                                                e.currentTarget.style.boxShadow = '0 6px 16px rgba(139, 92, 246, 0.4)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.transform = 'scale(1)';
                                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.3)';
                                            }}
                                        >
                                            <FaComments />
                                            {i18n.language === 'ar' ? 'دردشة' : 'Chat'}
                                        </button>
                                    )}

                                    {/* Follow/Unfollow Button */}
                                    {!user.isFollowedByMe ? (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleFollow(user.id);
                                            }}
                                            style={{
                                                background: 'rgba(139, 92, 246, 0.15)',
                                                color: 'var(--primary)',
                                                border: '1px solid var(--primary)',
                                                borderRadius: '12px',
                                                padding: '8px 12px',
                                                fontSize: '0.75rem',
                                                fontWeight: '800',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                transition: 'all 0.3s'
                                            }}
                                        >
                                            <FaUserPlus style={{ fontSize: '0.7rem' }} />
                                            {i18n.language === 'ar' ? 'متابعة' : 'Follow'}
                                        </button>
                                    ) : (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (window.confirm(i18n.language === 'ar' ? 'إلغاء المتابعة؟' : 'Unfollow?')) {
                                                    toggleFollow(user.id);
                                                }
                                            }}
                                            style={{
                                                background: 'transparent',
                                                color: 'var(--text-muted)',
                                                border: '1px solid var(--border-color)',
                                                borderRadius: '12px',
                                                padding: '8px 12px',
                                                fontSize: '0.75rem',
                                                fontWeight: '800',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                transition: 'all 0.3s'
                                            }}
                                        >
                                            <FaUserCheck style={{ fontSize: '0.7rem' }} />
                                            {i18n.language === 'ar' ? 'نتابع' : 'Following'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default FollowersList;
