import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useInvitations } from '../context/InvitationContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useTranslation } from 'react-i18next';
import { FaSearch, FaMapMarkedAlt, FaBullseye, FaStar, FaStore, FaInfoCircle, FaExpand, FaCompress, FaHeart, FaRegHeart, FaComments } from 'react-icons/fa';
import { useTheme } from '../context/ThemeContext';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getSafeAvatar } from '../utils/avatarUtils';
import { getContrastText } from '../utils/colorUtils';
import '../components/MapStyles.css';

const MembersModal = ({ members, onClose, currentUser, onToggleFollow, onChat, title }) => {
    if (!members) return null;

    // Local following Set — prevents stale-closure mismatch where toggling one member
    // affects a different member's display due to shared context re-render
    const [localFollowing, setLocalFollowing] = React.useState(
        () => new Set(currentUser?.following || [])
    );

    // Sync if the user's following list changes externally (e.g. from another part of the app)
    React.useEffect(() => {
        setLocalFollowing(new Set(currentUser?.following || []));
    }, [currentUser?.following]);

    const handleToggle = async (memberId) => {
        // Optimistic UI update — flip immediately
        setLocalFollowing(prev => {
            const next = new Set(prev);
            if (next.has(memberId)) next.delete(memberId); else next.add(memberId);
            return next;
        });
        try {
            await onToggleFollow(memberId);
        } catch {
            // Rollback on error
            setLocalFollowing(prev => {
                const next = new Set(prev);
                if (next.has(memberId)) next.delete(memberId); else next.add(memberId);
                return next;
            });
        }
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.85)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(5px)'
        }} onClick={onClose}>
            <div style={{
                width: '90%',
                maxWidth: '500px',
                height: '80vh',
                background: 'var(--bg-card)',
                borderRadius: '24px',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                animation: 'slideUp 0.3s ease-out'
            }} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={{
                    padding: '20px',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'var(--bg-card)'
                }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-main)', fontWeight: '800' }}>
                            {title || 'Community Members'}
                        </h3>
                        <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            {members.length} Members
                        </p>
                    </div>
                    <button onClick={onClose} style={{
                        background: 'rgba(255,255,255,0.1)',
                        border: 'none',
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        color: 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>✕</button>
                </div>

                {/* List */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                    {members.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                            No members yet. Be the first to join!
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {members.map(member => {
                                const isMe = currentUser?.id === member.id;
                                const isFollowing = localFollowing.has(member.id);

                                return (
                                    <div key={member.id} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        padding: '12px',
                                        background: 'rgba(255,255,255,0.03)',
                                        borderRadius: '16px',
                                        border: '1px solid rgba(255,255,255,0.05)'
                                    }}>
                                        <div style={{ position: 'relative' }}>
                                            <img
                                                src={getSafeAvatar({ photo_url: member.avatarUrl, avatar_url: member.avatar_url })}
                                                alt={member.displayName || member.display_name || member.name}
                                                style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--bg-card)' }}
                                            />
                                            {isMe && <div style={{
                                                position: 'absolute', bottom: -2, right: -2,
                                                background: 'var(--primary)', color: 'white',
                                                fontSize: '0.6rem', padding: '2px 6px', borderRadius: '10px',
                                                fontWeight: 'bold', border: '2px solid var(--bg-card)'
                                            }}>YOU</div>}
                                        </div>

                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '0.95rem' }}>
                                                {member.displayName || member.display_name || member.name}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                {member.city || member.country || 'Dining Enthusiast'}
                                            </div>
                                        </div>

                                        {!isMe && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <button
                                                    onClick={() => onChat(member.id)}
                                                    style={{
                                                        background: 'rgba(16, 185, 129, 0.15)',
                                                        color: '#10b981',
                                                        border: 'none',
                                                        padding: '8px',
                                                        borderRadius: '10px',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}
                                                >
                                                    <FaComments size={14} />
                                                </button>

                                                <button
                                                    onClick={() => handleToggle(member.id)}
                                                    style={{
                                                        background: isFollowing ? 'transparent' : 'var(--primary)',
                                                        color: isFollowing ? 'var(--text-muted)' : 'white',
                                                        border: isFollowing ? '1px solid var(--border-color)' : 'none',
                                                        padding: '6px 12px',
                                                        borderRadius: '10px',
                                                        fontWeight: '700',
                                                        fontSize: '0.75rem',
                                                        cursor: 'pointer',
                                                        minWidth: '80px'
                                                    }}
                                                >
                                                    {isFollowing ? 'Following' : 'Follow'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const RestaurantCard = React.memo(({ res, onViewMembers }) => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { showToast } = useToast();
    const { userProfile, updateUserProfile } = useAuth();
    const context = useInvitations();
    const { isDark } = useTheme();
    const currentUser = context?.currentUser || {};
    const toggleCommunity = context?.toggleCommunity || (() => { });

    if (!res) return null;

    // Brand Kit — only apply when business has saved custom colors
    // Note: InvitationContext spreads `...businessInfo` onto res directly,
    // so brandKit is at res.brandKit (not res.businessInfo?.brandKit)
    const bk = res.brandKit || res.businessInfo?.brandKit || {};
    const _p = bk.primaryColor;   // undefined → no brand kit
    const _s = bk.secondaryColor || _p;
    const _br = bk.buttonStyle || '14px';
    const _ff = bk.fontFamily || undefined;

    // null when no Brand Kit → card uses default styling
    const tc = _p ? {
        accent: _p,
        // Prefer explicit Brand Kit text color; remap pure white to var(--bg-main) to keep buttons readable
        accentText: bk.btnTextColor
            ? (bk.btnTextColor.toLowerCase() === '#ffffff' ? 'var(--bg-main)' : bk.btnTextColor)
            : getContrastText(_p),
        border: `${_p}55`,
        badgeBg: `${_p}22`,
        badgeText: _p,
        headerGlow: `0 0 40px ${_p}40`,
        gradientFrom: 'rgba(0,0,0,0.88)',
        gradientTo: 'rgba(0,0,0,0.60)',
        footerBg: `linear-gradient(135deg, ${_p}cc, ${_s}88)`,
        btnShadow: `0 8px 24px ${_p}44`,
        btnBorderRadius: _br,
        fontFamily: _ff,
    } : null;


    const isJoined = (currentUser.joinedCommunities || []).some(id => id === res.id || id === res.ownerId);
    const isOwner = currentUser?.id === res.ownerId || (currentUser?.ownedRestaurants || []).includes(res.id);
    const isBusinessAccount = userProfile?.isBusiness || false;

    const isFavorite = userProfile?.favoritePlaces?.some(p => p.businessId === res.id);

    const handleToggleFavorite = async (e) => {
        e.stopPropagation();
        // Redirect guest/unauthenticated users to login
        if (!currentUser?.id || currentUser?.isGuest) {
            navigate('/login');
            return;
        }

        try {
            let newFavorites = [...(userProfile.favoritePlaces || [])];

            if (isFavorite) {
                newFavorites = newFavorites.filter(p => p.businessId !== res.id);
            } else {
                const favoritePlace = {
                    businessId: res.id,
                    name: res.name,
                    image: res.image,
                    address: res.location || '',
                    source: 'business',
                    addedAt: new Date().toISOString()
                };
                newFavorites.push(favoritePlace);
            }

            await updateUserProfile({ favoritePlaces: newFavorites });
        } catch (error) {
            console.error('Error toggling favorite:', error);
        }
    };

    const [reviewCount, setReviewCount] = useState(0);
    const [averageRating, setAverageRating] = useState(0);
    const [communityMembers, setCommunityMembers] = useState([]);
    const [memberCount, setMemberCount] = useState(0);

    useEffect(() => {
        // Priority 1: Use direct props if available (from optimized context)
        if (res.averageRating !== undefined) {
            setAverageRating(res.averageRating);
            setReviewCount(res.reviewCount || 0);
            return;
        }

        // Priority 2: Fetch from Firestore (one-time read, no listener — reviews don't need real-time)
        if (!res?.id) return;

        let cancelled = false;
        const reviewsRef = collection(db, 'reviews');
        const q = query(
            reviewsRef,
            where('partnerId', '==', res.id),
            limit(50)
        );

        getDocs(q).then((snapshot) => {
            if (cancelled) return;
            const reviews = snapshot.docs.map(d => d.data());
            const count = snapshot.size;
            const total = reviews.reduce((acc, curr) => acc + (curr.rating || 0), 0);
            const avg = count > 0 ? total / count : 0.0;
            setReviewCount(count);
            setAverageRating(avg);
        }).catch(() => {});

        return () => { cancelled = true; };
    }, [res.id, res.averageRating, res.reviewCount]);

    useEffect(() => {
        let cancelled = false;
        const loadCommunityPreview = async () => {
            if (!context?.getCommunityMembers || !currentUser?.uid) return;
            const communityId = res.ownerId || res.id;
            const result = await context.getCommunityMembers(communityId, { includeMembers: true, limit: 5 });
            if (cancelled) return;
            setCommunityMembers(result?.members || []);
            setMemberCount(Number(result?.memberCount || 0));
        };
        loadCommunityPreview();
        return () => { cancelled = true; };
    }, [context, currentUser?.uid, res.id, res.ownerId]);

    const handleShare = async (e) => {
        e.stopPropagation();
        const shareData = {
            title: res.name,
            text: `Check out ${res.name} on DineBuddies!`,
            url: `${window.location.origin}/business/${res.id}`
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (err) {
                console.log('Error sharing:', err);
            }
        } else {
            navigator.clipboard.writeText(shareData.url);
            showToast(t('link_copied_clipboard', 'Link copied!'), 'success');
        }
    };

    const handleCreateInvite = (e) => {
        e.stopPropagation();
        // Corrected route to /create and state structure to match CreateInvitation.jsx
        navigate('/create', { state: { restaurantData: res } });
    };

    return (
        <div
            className="restaurant-card"
            onClick={() => navigate(`/business/${res.id}`)}
            style={{
                background: tc?.cardBg || '#0f172a',
                borderRadius: '24px',
                overflow: 'hidden',
                marginBottom: '20px',
                boxShadow: tc ? `0 4px 24px rgba(0,0,0,0.5), ${tc.headerGlow}` : '0 4px 20px rgba(0,0,0,0.4)',
                border: tc ? `1px solid ${tc.border}` : '1px solid rgba(255, 255, 255, 0.1)',
                position: 'relative',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            {/* Top Section: Full Image Background with Overlay Content */}
            <div style={{ position: 'relative', minHeight: '320px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>

                {/* Background Image */}
                <img
                    src={res.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(res.name)}&background=random`}
                    alt={res.name}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        zIndex: 0
                    }}
                />

                {/* Gradient Overlay for Text Readability */}
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: tc
                        ? `linear-gradient(to top, ${tc.gradientFrom} 0%, ${tc.gradientTo} 40%, transparent 100%)`
                        : 'linear-gradient(to top, rgba(2, 6, 23, 0.95) 0%, rgba(2, 6, 23, 0.7) 40%, transparent 100%)',
                    zIndex: 1
                }} />

                {/* Top Badges (Absolute) */}
                <div style={{ position: 'absolute', top: '16px', left: '16px', right: '16px', display: 'flex', justifyContent: 'space-between', zIndex: 10 }}>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/restaurants?category=${encodeURIComponent(res.type || 'Venue')}`);
                        }}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minHeight: '26px',
                            background: tc ? (tc.badgeBg || `${tc.accent}33`) : 'rgba(15, 23, 42, 0.85)',
                            backdropFilter: 'blur(8px)',
                            padding: '4px 12px',
                            borderRadius: '50px',
                            color: tc ? (tc.accentText || 'var(--text-main)') : '#e9d5ff',
                            fontSize: '0.75rem',
                            fontWeight: '700',
                            border: tc ? `1px solid ${tc.border || tc.accent}` : '1px solid rgba(148, 163, 184, 0.4)',
                            boxShadow: tc?.btnShadow || '0 4px 12px rgba(0,0,0,0.2)',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            if (tc) {
                                e.currentTarget.style.background = tc.accent;
                                e.currentTarget.style.color = tc.accentText || '#ffffff';
                            }
                            e.currentTarget.style.transform = 'scale(1.03)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = tc ? (tc.badgeBg || `${tc.accent}33`) : 'rgba(15, 23, 42, 0.85)';
                            e.currentTarget.style.color = tc ? (tc.accentText || 'var(--text-main)') : '#e9d5ff';
                            e.currentTarget.style.transform = 'scale(1)';
                        }}
                    >
                        {res.type || 'Venue'}
                    </button>

                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            onClick={handleToggleFavorite}
                            style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                background: tc ? `${tc.accent}33` : 'rgba(15, 23, 42, 0.6)',
                                backdropFilter: 'blur(8px)',
                                border: tc ? `1px solid ${tc.border || tc.accent}` : '1px solid rgba(148, 163, 184, 0.5)',
                                color: isFavorite ? '#ef4444' : 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                fontSize: '1.2rem',
                                transition: 'all 0.2s'
                            }}
                        >
                            {isFavorite ? <FaHeart /> : <FaRegHeart />}
                        </button>

                        <button
                            onClick={handleShare}
                            style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                background: tc ? `${tc.accent}33` : 'rgba(15, 23, 42, 0.6)',
                                backdropFilter: 'blur(8px)',
                                border: tc ? `1px solid ${tc.border || tc.accent}` : '1px solid rgba(148, 163, 184, 0.5)',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                fontSize: '1.1rem',
                                transition: 'all 0.2s'
                            }}
                        >
                            <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
                        </button>
                    </div>
                </div>

                {/* Content Overlay */}
                <div style={{ position: 'relative', zIndex: 10, padding: '20px 20px 10px 20px' }}>

                    {/* Title, Location & Rating */}
                    <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                        <div>
                            <h2 style={{
                                fontSize: '1.8rem',
                                fontWeight: '900',
                                color: 'white',
                                marginBottom: '4px',
                                textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                                lineHeight: '1.1'
                            }}>
                                {res.name}
                            </h2>
                            <p style={{
                                fontSize: '0.95rem',
                                color: 'rgba(255,255,255,0.9)',
                                fontWeight: '500',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                marginTop: '4px'
                            }}>
                                <FaMapMarkedAlt size={14} style={{ color: '#fbbf24' }} /> {res.location}
                            </p>
                        </div>

                        {/* Rating Badge */}
                        <div
                            onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/business/${res.id}`);
                            }}
                            style={{
                                background: 'rgba(255, 255, 255, 0.1)',
                                backdropFilter: 'blur(10px)',
                                borderRadius: '12px',
                                padding: '6px 10px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                cursor: 'pointer',
                                border: '1px solid rgba(255,255,255,0.2)',
                                transition: 'transform 0.2s',
                                minWidth: '60px',
                                justifyContent: 'center'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        >
                            <FaStar style={{ color: '#fbbf24', fontSize: '1rem' }} />
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1 }}>
                                <span style={{ fontSize: '0.9rem', fontWeight: '800', color: 'white' }}>
                                    {averageRating > 0 ? averageRating.toFixed(1) : '0.0'}
                                </span>
                                <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.7)' }}>
                                    {reviewCount} reviews
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Host Invitation Button */}
                    {!isOwner && !isBusinessAccount && !currentUser?.isGuest && (
                        <button
                            onClick={handleCreateInvite}
                            style={{
                                width: '100%',
                                padding: '14px',
                                background: 'rgba(40, 40, 45, 0.85)',
                                backdropFilter: 'blur(10px)',
                                color: '#d8b4fe',
                                border: '1px solid rgba(216, 180, 254, 0.2)',
                                borderRadius: '16px',
                                fontSize: '1rem',
                                fontWeight: 'bold',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '10px',
                                cursor: 'pointer',
                                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(40, 40, 45, 1)';
                                e.currentTarget.style.transform = 'scale(1.02)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(40, 40, 45, 0.85)';
                                e.currentTarget.style.transform = 'scale(1)';
                            }}
                        >
                            <FaStore style={{ fontSize: '1.1rem' }} />
                            {t('host_invitation_here')}
                        </button>
                    )}
                </div>
            </div>

            {/* Bottom Section: Footer (Community) */}
            <div style={{
                padding: '14px 20px',
                background: tc?.footerBg || 'var(--premium-orange)',
                borderTop: 'none',
                position: 'relative',
                zIndex: 20
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    color: 'white'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        {/* Avatars */}
                        {memberCount > 0 ? (
                            <div
                                onClick={(e) => { e.stopPropagation(); onViewMembers && onViewMembers(res.id); }}
                                style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', minWidth: 0, flex: 1 }}
                            >
                                {communityMembers.slice(0, 5).map((member, index) => (
                                    <img
                                        key={member.uid || index}
                                        src={getSafeAvatar(member)}
                                        alt=""
                                        style={{
                                            width: '24px',
                                            height: '24px',
                                            borderRadius: '50%',
                                            border: '2px solid rgba(255,255,255,0.5)',
                                            objectFit: 'cover',
                                            marginLeft: index === 0 ? '0' : '-9px',
                                            zIndex: 10 - index,
                                            flexShrink: 0
                                        }}
                                    />
                                ))}
                                <span style={{ marginLeft: '8px', fontSize: '0.82rem', color: 'white', fontWeight: '700', whiteSpace: 'nowrap' }}>
                                    {memberCount} {t('members')}
                                </span>
                            </div>
                        ) : (
                            <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.9)', fontWeight: '600' }}>
                                {t('restaurant_community')}
                            </span>
                        )}
                    </div>

                    {isOwner ? (
                        <span style={{
                            background: tc ? 'rgba(255,255,255,0.92)' : 'var(--bg-input)',
                            color: tc ? tc.accent : 'var(--luxury-gold)',
                            padding: '4px 12px',
                            borderRadius: '8px',
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            border: tc ? `1px solid ${tc.border || tc.accent}` : '1px solid var(--border-color)'
                        }}>
                            {t('owner')}
                        </span>
                    ) : !isBusinessAccount && (
                        <button
                            className="community-join-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                if (!currentUser?.uid && !currentUser?.id && !currentUser?.isGuest) {
                                    navigate('/login');
                                } else {
                                    toggleCommunity(res.ownerId || res.id);
                                }
                            }}
                            style={{
                                background: isJoined ? 'rgba(255,255,255,0.25)' : '#ffffff',
                                color: isJoined ? '#ffffff' : '#f97316', // Use hardcoded orange for text to ensure visibility
                                border: isJoined ? '1px solid rgba(255,255,255,0.4)' : 'none',
                                padding: '8px 20px',
                                borderRadius: '14px',
                                fontWeight: '900',
                                fontSize: '0.85rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                transition: 'all 0.2s',
                                boxShadow: isJoined ? 'none' : '0 6px 15px rgba(0,0,0,0.15)'
                            }}
                        >
                            {isJoined ? t('member_joined') : t('join_plus')}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
});

// Calculate distance between two points (Haversine formula)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
};

const BusinessesDirectory = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { currentUser, userProfile, isGuest } = useAuth();
    const context = useInvitations();
    const { isDark } = useTheme();

    // Get restaurants from context
    const restaurants = context?.restaurants || [];

    const [searchQuery, setSearchQuery] = useState('');
    const [locationFilter, setLocationFilter] = useState('All');
    const [activeFilter, setActiveFilter] = useState(() => searchParams.get('category') || 'All'); // Category filter
    const [showFilters, setShowFilters] = useState(false); // Controls filter visibility
    const [viewMode, setViewMode] = useState('list');
    const [isFullscreen, setIsFullscreen] = useState(false); // Fullscreen mode for map
    const [userLocation, setUserLocation] = useState(null);
    const [selectedCommunityId, setSelectedCommunityId] = useState(null);
    const [selectedCommunityMembers, setSelectedCommunityMembers] = useState([]);
    const [membersLoading, setMembersLoading] = useState(false);

    const handleViewMembers = async (id) => {
        setMembersLoading(true);
        setSelectedCommunityMembers([]);
        setSelectedCommunityId(id);
        try {
            const result = await context.getCommunityMembers(id, { includeMembers: true, limit: 200 });
            setSelectedCommunityMembers(result?.members || []);
        } catch (error) {
            console.error('Error loading community members modal:', error);
        } finally {
            setMembersLoading(false);
        }
    };

    const handleCloseMembers = () => {
        setSelectedCommunityId(null);
        setSelectedCommunityMembers([]);
        setMembersLoading(false);
    };

    const mapRef = useRef(null);
    const mapInstance = useRef(null);

    // Sync category filter from URL (e.g. when navigating from BusinessCard category click)
    useEffect(() => {
        const category = searchParams.get('category');
        if (category) {
            setActiveFilter(category);
            setShowFilters(true); // Show filter bar when landing with category
        }
    }, [searchParams]);

    // Get user's location
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setUserLocation({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                },
                (error) => {
                    console.log('Location access denied:', error);
                }
            );
        }
    }, []);



    // Helper functions and constants moved outside or used directly
    const locationFilters = [
        { id: 'All', label: t('all'), icon: '🌍' },
        { id: 'nearby', label: t('near_me'), icon: '📍' },
        { id: 'city', label: t('in_my_city'), icon: '🏙️' },
        { id: 'country', label: t('in_my_country'), icon: '🗺️' }
    ];

    const categories = [
        { id: 'All', label: t('filter_all'), icon: null },
        { id: 'Restaurant', label: t('type_restaurant'), icon: '🍴' },
        { id: 'Cafe', label: t('type_cafe'), icon: '☕' },
        { id: 'Bar', label: 'Bar', icon: '🍺' },
        { id: 'Night Club', label: 'Night Club', icon: '🎵' },
        { id: 'Food Truck', label: 'Food Truck', icon: '🚚' },
        { id: 'Fast Food', label: 'Fast Food', icon: '🍟' }
    ];

    const filteredRestaurants = useMemo(() => {
        let filtered = restaurants.filter(res => {
            if (!res) return false;

            // Search filter
            const matchesSearch = !searchQuery ||
                (res.name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (res.type?.toLowerCase().includes(searchQuery.toLowerCase()));

            // Category filter
            const matchesCategory = activeFilter === 'All' || res.type === activeFilter;

            return matchesSearch && matchesCategory;
        });

        // Apply location filter
        const userRole = userProfile?.role;
        const isStaff = ['admin', 'moderator', 'support'].includes(userRole);

        if (locationFilter !== 'All' && userLocation && !isStaff) {
            filtered = filtered.filter(res => {
                if (!res.lat || !res.lng) return false;

                const distance = calculateDistance(
                    userLocation.lat,
                    userLocation.lng,
                    res.lat,
                    res.lng
                );

                switch (locationFilter) {
                    case 'nearby':
                        return distance < 10; // Within 10km
                    case 'city':
                        return distance < 50; // Within 50km (approximate city range)
                    case 'country':
                        return distance < 500; // Within 500km (approximate country range)
                    default:
                        return true;
                }
            });
        }

        return filtered;
    }, [restaurants, searchQuery, locationFilter, activeFilter, userLocation]);

    const restaurantsWithCoords = useMemo(() => {
        return filteredRestaurants.filter(res => res.lat && res.lng);
    }, [filteredRestaurants]);

    // Map control functions
    const zoomIn = () => {
        if (mapInstance.current) {
            mapInstance.current.zoomIn();
        }
    };

    const zoomOut = () => {
        if (mapInstance.current) {
            mapInstance.current.zoomOut();
        }
    };

    const resetMapView = () => {
        if (mapInstance.current && restaurantsWithCoords.length > 0) {
            const bounds = [];
            restaurantsWithCoords.forEach(res => {
                if (res.lat && res.lng) bounds.push([res.lat, res.lng]);
            });
            if (userLocation) bounds.push([userLocation.lat, userLocation.lng]);
            if (bounds.length > 0) {
                mapInstance.current.fitBounds(bounds, { padding: [50, 50] });
            }
        } else if (mapInstance.current && userLocation) {
            mapInstance.current.setView([userLocation.lat, userLocation.lng], 13);
        }
    };

    // Initialize Leaflet map
    useEffect(() => {
        if (viewMode === 'map' && mapRef.current) {
            const L = window.L;
            if (!L) return;

            if (!mapInstance.current) {
                // Smart Initialization: User > Content > World
                let initialLat = 0;
                let initialLng = 0;
                let initialZoom = 2;

                if (userLocation) {
                    initialLat = userLocation.lat;
                    initialLng = userLocation.lng;
                    initialZoom = 13;
                } else if (restaurantsWithCoords.length > 0) {
                    // Center on restaurants
                    const lats = restaurantsWithCoords.map(r => r.lat);
                    const lngs = restaurantsWithCoords.map(r => r.lng);
                    initialLat = (Math.min(...lats) + Math.max(...lats)) / 2;
                    initialLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
                    initialZoom = 10;
                }

                mapInstance.current = L.map(mapRef.current, {
                    zoomControl: false,
                    attributionControl: false,
                    tap: false
                }).setView([initialLat, initialLng], initialZoom);

                // Auto-fit bounds perfectly if content exists and no user location
                if (!userLocation && restaurantsWithCoords.length > 0) {
                    const bounds = restaurantsWithCoords.map(r => [r.lat, r.lng]);
                    try {
                        mapInstance.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
                    } catch (e) { }
                }
            }

            // Always ensure tiles match current theme
            mapInstance.current.eachLayer((layer) => {
                if (layer instanceof L.TileLayer) mapInstance.current.removeLayer(layer);
            });

            const tileUrl = isDark
                ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
                : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

            L.tileLayer(tileUrl).addTo(mapInstance.current);

            // Cleanup previous markers
            mapInstance.current.eachLayer((layer) => {
                if (layer instanceof L.Marker) mapInstance.current.removeLayer(layer);
            });

            // Add user location marker
            if (userLocation) {
                const userIcon = L.divIcon({
                    className: 'user-location-marker',
                    html: `
                        <div class="user-marker-outer">
                            <div class="user-marker-pulse"></div>
                            <div class="user-marker-dot"></div>
                        </div>
                    `,
                    iconSize: [30, 30],
                    iconAnchor: [15, 15]
                });
                L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
                    .addTo(mapInstance.current)
                    .bindPopup(`<strong style="color: #8b5cf6;">📍 ${t('your_location')}</strong>`);
            }

            // Add restaurant / partner markers
            restaurantsWithCoords.forEach(res => {
                if (!res.lat || !res.lng) return;

                // Calculate distance
                let distance = null;
                let travelTime = null;
                if (userLocation) {
                    distance = calculateDistance(userLocation.lat, userLocation.lng, res.lat, res.lng);
                    travelTime = Math.round((distance / 40) * 60);
                }

                // Get profile logo/avatar for marker (prefer real profile over header image)
                const logo = res.photo_url ||
                    res.avatar ||
                    res.logoImage ||
                    res.businessInfo?.logo ||
                    res.businessInfo?.logoImage ||
                    res.businessInfo?.photo_url ||
                    res.image ||
                    res.businessInfo?.image ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(res.name || 'Restaurant')}&background=fbbf24&color=fff&size=200&bold=true&rounded=true&font-size=0.4`;

                // Create custom marker with logo - gold border for all restaurants
                const markerColor = '#fbbf24'; // Gold for all restaurants
                const markerIcon = L.divIcon({
                    className: 'custom-invitation-marker',
                    html: `
                        <div style="
                            width: 50px;
                            height: 50px;
                            border-radius: 50%;
                            border: 3px solid ${markerColor};
                            overflow: hidden;
                            background: white;
                            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                        ">
                            <img src="${logo}" 
                                 style="width: 100%; height: 100%; object-fit: cover;" 
                                 onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(res.name || 'R')}&background=fbbf24&color=fff&size=200'" />
                        </div>
                    `,
                    iconSize: [50, 50],
                    iconAnchor: [25, 50]
                });

                // Create compact popup content
                const popupContent = `
                    <div class="compact-popup">
                        <div style="position: relative;">
                            <img src="${res.image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400'}" class="compact-popup-image" />
                            <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; padding: 4px; background: linear-gradient(to top, rgba(0,0,0,0.6), transparent);">
                                <span style="background: ${markerColor}; color: black; padding: 2px 6px; border-radius: 4px; font-size: 0.6rem; font-weight: 700; position: absolute; bottom: 4px; left: 4px;">${res.type || 'Restaurant'}</span>
                            </div>
                        </div>
                        <div class="compact-popup-body">
                            <h4 class="compact-popup-title">${res.name}</h4>
                            <div class="compact-popup-meta">
                                <span>📍 ${res.location || 'Location'}</span>
                            </div>
                            ${distance ? `
                                <div class="compact-popup-stats">
                                    <span>📏 ${distance.toFixed(1)} km</span>
                                    <span>⏱️ ~${travelTime} min</span>
                                </div>
                            ` : ''}
                            <div>
                                <button onclick="window.location.href='/business/${res.id}'" class="compact-popup-btn" style="background: ${markerColor}; color: black;">
                                    ${t('view_details')}
                                </button>
                            </div>
                        </div>
                    </div>
                `;

                L.marker([res.lat, res.lng], { icon: markerIcon })
                    .addTo(mapInstance.current)
                    .bindPopup(popupContent, {
                        maxWidth: 200,
                        minWidth: 180,
                        className: 'compact-leaflet-popup'
                    });
            });

            // Force map recalculation
            setTimeout(() => {
                if (mapInstance.current) {
                    mapInstance.current.invalidateSize();
                }
            }, 100);

            // Auto-fit bounds with delay
            setTimeout(() => {
                if (!mapInstance.current) return;

                if (restaurantsWithCoords.length > 0 || userLocation) {
                    const bounds = [];
                    restaurantsWithCoords.forEach(res => {
                        if (res.lat && res.lng) bounds.push([res.lat, res.lng]);
                    });

                    if (userLocation) bounds.push([userLocation.lat, userLocation.lng]);

                    if (bounds.length > 0) {
                        try {
                            mapInstance.current.fitBounds(bounds, {
                                padding: [50, 50],
                                maxZoom: 15,
                                animate: true
                            });
                        } catch (e) {
                            console.error("Error fitting bounds:", e);
                            if (userLocation) {
                                mapInstance.current.setView([userLocation.lat, userLocation.lng], 12);
                            }
                        }
                    }
                }
            }, 300);
        }
    }, [viewMode, userLocation, restaurantsWithCoords, t, i18n.language]);

    // Fix for map disappearing when switching between list and map view
    useEffect(() => {
        if (viewMode === 'map' && mapInstance.current) {
            // Small delay to ensure DOM is ready
            setTimeout(() => {
                if (mapInstance.current) {
                    mapInstance.current.invalidateSize();
                    // Re-fit bounds if we have restaurants
                    if (restaurantsWithCoords.length > 0 || userLocation) {
                        const bounds = [];
                        restaurantsWithCoords.forEach(res => {
                            if (res.lat && res.lng) bounds.push([res.lat, res.lng]);
                        });
                        if (userLocation) bounds.push([userLocation.lat, userLocation.lng]);
                        if (bounds.length > 0) {
                            try {
                                mapInstance.current.fitBounds(bounds, {
                                    padding: [50, 50],
                                    maxZoom: 15,
                                    animate: true
                                });
                            } catch (e) {
                                console.error("Error fitting bounds:", e);
                            }
                        }
                    }
                }
            }, 100);
        }
    }, [viewMode, restaurantsWithCoords, userLocation, isDark]);

    // Handle Escape key to exit fullscreen
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape' && isFullscreen) {
                setIsFullscreen(false);
                setTimeout(() => {
                    if (mapInstance.current) {
                        mapInstance.current.invalidateSize();
                    }
                }, 100);
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isFullscreen]);


    return (
        <div className="directory-page" style={{ paddingBottom: '100px', minHeight: '100vh' }}>


            <div style={{ padding: '1rem 1.5rem 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h1 style={{ fontSize: '1.2rem', fontWeight: '800', lineHeight: '1', margin: 0 }}>{t('business_directory', 'Business directory')}</h1>
                    <div style={{ background: 'var(--bg-card)', padding: '4px', borderRadius: '50px', display: 'flex', border: '1px solid var(--border-color)' }}>
                        <button
                            onClick={() => setViewMode('list')}
                            style={{
                                padding: '6px 16px',
                                borderRadius: '50px',
                                background: viewMode === 'list' ? 'var(--luxury-gold)' : 'transparent',
                                color: viewMode === 'list' ? 'rgba(255, 255, 254, 1)' : 'var(--text-main)',
                                border: 'none'
                            }}
                        >
                            {t('list')}
                        </button>
                        <button
                            onClick={() => setViewMode('map')}
                            style={{
                                padding: '6px 16px',
                                borderRadius: '50px',
                                background: viewMode === 'map' ? 'var(--luxury-gold)' : 'transparent',
                                color: viewMode === 'map' ? 'rgba(255, 255, 254, 1)' : 'var(--text-main)',
                                border: 'none'
                            }}
                        >
                            {t('map')}
                        </button>
                    </div>
                </div>

                <style>{`
                    .filter-select {
                        appearance: none !important;
                        -webkit-appearance: none !important;
                        background-color: var(--bg-card, #ffffff) !important;
                        border: 1px solid var(--border-color, #e2e8f0) !important;
                        color: var(--text-main, #333333) !important;
                        padding: 0 24px 0 10px !important;
                        borderRadius: 10px !important;
                        fontSize: 12px !important;
                        fontWeight: 500 !important;
                        height: 38px !important;
                        background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e") !important;
                        background-repeat: no-repeat !important;
                        background-position: right 8px center !important;
                        background-size: 14px !important;
                        max-width: 140px !important;
                        min-width: 80px !important;
                    }
                    .category-icons-scroll::-webkit-scrollbar { display: none !important; }
                    .category-icons-scroll { -ms-overflow-style: none !important; scrollbar-width: none !important; }
                    
                    @keyframes slideDown {
                        from {
                            opacity: 0;
                            max-height: 0;
                            transform: translateY(-10px);
                        }
                        to {
                            opacity: 1;
                            max-height: 100px;
                            transform: translateY(0);
                        }
                    }
                `}</style>

                {/* Filter Bar - New Layout */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    background: 'var(--bg-card)',
                    padding: '8px 12px',
                    borderRadius: '16px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                    marginBottom: '0.75rem'
                }}>
                    {/* Row 1: Search + Location Filter */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {/* Search Input - Narrower */}
                        <div style={{ position: 'relative', flex: '1 1 auto', minWidth: '150px' }}>
                            <FaSearch style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.85rem' }} />
                            <input
                                type="text"
                                placeholder={t('search_venues')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onFocus={() => setShowFilters(true)}
                                style={{
                                    width: '100%',
                                    padding: '10px 10px 10px 36px',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '12px',
                                    fontSize: '0.85rem',
                                    background: 'var(--bg-main)',
                                    color: 'var(--text-main)'
                                }}
                            />
                        </div>

                        {/* Location Filter - Next to Search */}
                        <div style={{ flex: '0 0 auto' }}>
                            <select
                                value={locationFilter}
                                onChange={(e) => setLocationFilter(e.target.value)}
                                className="filter-select"
                                style={{
                                    width: 'auto',
                                    minWidth: '110px',
                                    padding: '10px 28px 10px 10px',
                                    height: '38px',
                                    background: 'var(--bg-card)',
                                    color: 'var(--text-main)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '12px'
                                }}
                            >
                                {locationFilters.map(f => (
                                    <option key={f.id} value={f.id}>{f.icon} {f.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Row 2: Category Icons - Show when search is focused */}
                    {showFilters && (
                        <div style={{
                            display: 'flex',
                            gap: '6px',
                            width: '100%',
                            overflowX: 'auto',
                            paddingBottom: '4px',
                            animation: 'slideDown 0.2s ease-out'
                        }}
                            className="category-icons-scroll"
                        >
                            {categories.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => {
                                        setActiveFilter(cat.id);
                                        const next = new URLSearchParams(searchParams);
                                        if (cat.id === 'All') next.delete('category');
                                        else next.set('category', cat.id);
                                        setSearchParams(next);
                                    }}
                                    style={{
                                        flex: '0 0 auto',
                                        padding: '8px 12px',
                                        borderRadius: '10px',
                                        border: activeFilter === cat.id
                                            ? '2px solid var(--primary)'
                                            : '1px solid var(--border-color)',
                                        background: activeFilter === cat.id
                                            ? 'rgba(139, 92, 246, 0.1)'
                                            : 'var(--bg-card)',
                                        color: activeFilter === cat.id
                                            ? 'var(--primary)'
                                            : 'var(--text-main)',
                                        fontSize: '0.8rem',
                                        fontWeight: activeFilter === cat.id ? '700' : '500',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        whiteSpace: 'nowrap'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (activeFilter !== cat.id) {
                                            e.currentTarget.style.background = 'rgba(139, 92, 246, 0.05)';
                                            e.currentTarget.style.borderColor = 'var(--primary)';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (activeFilter !== cat.id) {
                                            e.currentTarget.style.background = 'var(--bg-card)';
                                            e.currentTarget.style.borderColor = 'var(--border-color)';
                                        }
                                    }}
                                >
                                    {cat.icon && <span>{cat.icon}</span>}
                                    <span>{cat.label}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div style={{ padding: viewMode === 'map' ? '0' : '0 1.5rem' }}>
                {/* Map View Container - Always in DOM but hidden when not active */}
                <div
                    className="map-view-container"
                    style={{
                        padding: '0',
                        margin: '0',
                        width: '100%',
                        position: isFullscreen ? 'fixed' : 'relative',
                        top: isFullscreen ? 0 : 'auto',
                        left: isFullscreen ? 0 : 'auto',
                        right: isFullscreen ? 0 : 'auto',
                        bottom: isFullscreen ? 0 : 'auto',
                        zIndex: isFullscreen ? 9999 : 'auto',
                        direction: 'ltr',
                        display: viewMode === 'map' ? 'block' : 'none',
                        background: 'var(--bg-body)'
                    }}
                >
                    <div className="map-wrapper" style={{ borderRadius: '0', overflow: 'hidden', width: '100%', height: isFullscreen ? '100vh' : 'calc(100vh - 200px)', position: 'relative' }}>
                        <div ref={mapRef} className="responsive-map-container" style={{ width: '100%', height: '100%', minHeight: isFullscreen ? '100vh' : 'calc(100vh - 200px)', outline: 'none' }}></div>

                        {/* Zoom Controls + Fullscreen + Recenter */}
                        <div className="map-zoom-controls">
                            <button onClick={zoomIn} className="btn-map-control" title={t('zoom_in', { defaultValue: 'Zoom In' })}>
                                <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>+</span>
                            </button>
                            <button onClick={zoomOut} className="btn-map-control" title={t('zoom_out', { defaultValue: 'Zoom Out' })}>
                                <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>−</span>
                            </button>
                            {/* Fullscreen Toggle Button */}
                            <button
                                onClick={() => {
                                    setIsFullscreen(!isFullscreen);
                                    setTimeout(() => {
                                        if (mapInstance.current) {
                                            mapInstance.current.invalidateSize();
                                        }
                                    }, 100);
                                }}
                                className="btn-map-control"
                                title={isFullscreen ? t('exit_fullscreen', 'Exit Fullscreen') : t('fullscreen', 'Fullscreen')}
                            >
                                {isFullscreen ? <FaCompress /> : <FaExpand />}
                            </button>
                            {/* Recenter Button */}
                            <button onClick={resetMapView} className="btn-map-control" title={t('recenter_map', { defaultValue: 'Recenter Map' })}>
                                <FaBullseye />
                            </button>
                        </div>

                        <div className="map-discovery-badge" style={{ top: 'auto', bottom: '20px', left: '50%', transform: 'translateX(-50%)' }}>
                            <div className="pulse-dot"></div>
                            <span>{restaurantsWithCoords.length} {t('active_businesses', { defaultValue: 'Active Businesses' })}</span>
                        </div>
                    </div>
                </div>

                {/* List View Container - Always in DOM but hidden when not active */}
                <div
                    className="restaurant-list"
                    style={{
                        display: viewMode === 'list' ? 'flex' : 'none',
                        flexDirection: 'column',
                        gap: '24px'
                    }}
                >
                    {filteredRestaurants.map(res => (
                        <RestaurantCard
                            key={res.id}
                            res={res}
                            onViewMembers={handleViewMembers}
                        />
                    ))}
                    {filteredRestaurants.length === 0 && <p style={{ textAlign: 'center', opacity: 0.5 }}>{t('no_results')}</p>}
                </div>
            </div>
            {/* Members Modal */}
            {selectedCommunityId && (
                <MembersModal
                    members={membersLoading ? [] : selectedCommunityMembers}
                    onClose={handleCloseMembers}
                    currentUser={context.currentUser}
                    onToggleFollow={context.toggleFollow}
                    onChat={(id) => navigate(`/chat/${id}`)}
                    title={t ? t('community_members') : 'Community Members'}
                />
            )}
        </div>
    );
};

export default BusinessesDirectory;
