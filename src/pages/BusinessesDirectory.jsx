import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { LuSparkles } from 'react-icons/lu';
import { useInvitations } from '../context/InvitationContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useTranslation } from 'react-i18next';
import { FaSearch, FaMapMarkedAlt, FaBullseye, FaStar, FaStore, FaInfoCircle, FaExpand, FaCompress, FaHeart, FaRegHeart, FaComments, FaTrophy, FaBuilding, FaPlus } from 'react-icons/fa';
import { useTheme } from '../context/ThemeContext';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { subscribeBusinessLiked, toggleBusinessLike, incrementBusinessShareCount } from '../services/businessLikeService';
import { getSafeAvatar, pickSafeDisplayImageUrl } from '../utils/avatarUtils';
import { DEFAULT_BUSINESS_COVER, handleBusinessCoverImageError, resolveBusinessCoverImageUrl } from '../utils/businessCoverImage';
import UserAvatar from '../components/UserAvatar';
import { useUserPresence } from '../hooks/usePresence';
import { resolveBusinessOpenNow } from '../utils/googlePlacesBusiness';
import { getBusinessCardCity } from '../utils/businessCardLocation';
import { getContrastText } from '../utils/colorUtils';
import { getBusinessSubscriptionAccess } from '../utils/businessSubscription';
import {
  buildSwipeOfferAccentVars,
  formatSwipeOfferDateRange,
  getActiveSwipeSpecialOffer,
  resolveBusinessSwipeSpecialOffer,
} from '../utils/businessSwipeSpecialOffer';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../components/MapStyles.css';
import { goToLogin } from '../utils/goToLogin';
import {
  handleBusinessCommunityJoinClick,
  isBusinessCommunityChatEnabled,
  isJoinedToBusinessCommunity,
  resolveBusinessCommunityId,
} from '../utils/businessCommunityJoin';
import {
  detachLeafletMap,
  ensureLeafletMapDetachedIfOrphan } from
'../utils/leafletMapLifecycle';
import { detectUserLocationContext } from '../utils/locationUtils';
import {
  buildViewerGeoContext,
  canApplyBusinessLocationFilter,
  matchesBusinessLocationFilter,
  parseBusinessLatLng,
} from '../utils/businessDirectoryGeoFilter';
import { formatBiDiText, escapeHtmlText } from '../utils/formatBiDiText';
import { AppText, AppTextInput } from "../components/base";
import CreateInvitationSelector from '../components/CreateInvitationSelector';
import PullToRefresh from '../components/PullToRefresh';
import {
  buildHostInvitationNavigationState,
  withBusinessIdInPath,
} from '../utils/hostInvitationFromBusiness';

const popupText = (value) =>
  `<span dir="auto" style="unicode-bidi:isolate;text-align:start">${escapeHtmlText(formatBiDiText(value))}</span>`;

// Haversine distance in km
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

function formatBusinessDistanceLabel(t, distanceKm) {
  if (distanceKm == null || !Number.isFinite(distanceKm)) return null;
  if (distanceKm < 1) {
    return t('stage_distance_m', '{{m}} m away', {
      m: Math.max(1, Math.round(distanceKm * 1000)),
    });
  }
  const km = distanceKm < 10 ? distanceKm.toFixed(1) : String(Math.round(distanceKm));
  return t('stage_distance_km', '{{km}} km away', { km });
}

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
    setLocalFollowing((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);else next.add(memberId);
      return next;
    });
    try {
      await onToggleFollow(memberId);
    } catch {
      // Rollback on error
      setLocalFollowing((prev) => {
        const next = new Set(prev);
        if (next.has(memberId)) next.delete(memberId);else next.add(memberId);
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
      }} onClick={(e) => e.stopPropagation()}>
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
                        <AppText as="h3" style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-main)', fontWeight: '800' }}>
                            {title || 'Community Members'}
                        </AppText>
                        <AppText as="p" style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            {members.length} Members
                        </AppText>
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
                    {members.length === 0 ?
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                            No members yet. Be the first to join!
                        </div> :

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {members.map((member) => {
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
                                            <UserAvatar
                      src={getSafeAvatar({ photo_url: member.avatarUrl, avatar_url: member.avatar_url })}
                      user={member}
                      alt={member.displayName || member.display_name || member.name}
                      style={{ width: '48px', height: '48px', objectFit: 'cover', border: '2px solid var(--bg-card)' }} />
                    
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

                                        {!isMe &&
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
                      }}>
                      
                                                    <FaComments size={14} />
                                                </button>

                                                {!(currentUser?.role === 'business' || currentUser?.isBusiness) &&
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
                      }}>
                      
                                                        {isFollowing ? 'Following' : 'Follow'}
                                                    </button>
                    }
                                            </div>
                  }
                                    </div>);

            })}
                        </div>
          }
                </div>
            </div>
        </div>);

};

const RestaurantCard = React.memo(({ res, onViewMembers, onHostInvitation }) => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const { userProfile, updateUserProfile, currentUser: authCurrentUser, isGuest } = useAuth();
  const context = useInvitations();
  const { isDark } = useTheme();
  const currentUser = context?.currentUser || {};
  // Use Auth for like flow so heart works consistently (context.currentUser can be stale or missing .uid)
  const likeUser = authCurrentUser || currentUser;
  const joinCommunity = context?.joinCommunity || (() => Promise.resolve(false));

  if (!res) return null;

  // Brand Kit — only apply when business has saved custom colors
  // Note: InvitationContext spreads `...businessInfo` onto res directly,
  // so brandKit is at res.brandKit (not res.businessInfo?.brandKit)
  const bk = res.brandKit || res.businessInfo?.brandKit || {};
  const _p = bk.primaryColor; // undefined → no brand kit
  const _s = bk.secondaryColor || _p;
  const _br = bk.buttonStyle || '14px';
  const _ff = bk.fontFamily || 'sans-serif';

  // null when no Brand Kit → card uses default styling
  const tc = _p ? {
    accent: _p,
    // Prefer explicit Brand Kit text color; remap pure white to var(--bg-main) to keep buttons readable
    accentText: bk.btnTextColor ?
    bk.btnTextColor.toLowerCase() === '#ffffff' ? 'var(--bg-main)' : bk.btnTextColor :
    getContrastText(_p),
    border: `${_p}55`,
    badgeBg: `${_p}22`,
    badgeText: _p,
    headerGlow: `0 0 40px ${_p}40`,
    gradientFrom: 'rgba(0,0,0,0.88)',
    gradientTo: 'rgba(0,0,0,0.60)',
    footerBg: `linear-gradient(135deg, ${_p}cc, ${_s}88)`,
    btnShadow: `0 8px 24px ${_p}44`,
    btnBorderRadius: _br,
    fontFamily: _ff || 'sans-serif'
  } : null;

  const partnerPaid = getBusinessSubscriptionAccess(res.subscriptionTier).isPaid;
  const specialOffer = partnerPaid
    ? getActiveSwipeSpecialOffer(resolveBusinessSwipeSpecialOffer(res))
    : null;
  const offerAccentVars = specialOffer ? buildSwipeOfferAccentVars(bk) : undefined;

  const joinedCommunities = currentUser.joinedCommunities || [];
  const communityId = resolveBusinessCommunityId(joinedCommunities, {
    ownerId: res.ownerId,
    businessId: res.id,
    isVirtual: res.isVirtual === true,
  });
  const isJoined = isJoinedToBusinessCommunity(joinedCommunities, communityId);
  const isOwner = currentUser?.id === res.ownerId || (currentUser?.ownedRestaurants || []).includes(res.id);
  const isBusinessAccount = userProfile?.isBusiness || false;
  const isOnline = useUserPresence(res.ownerId || res.id, { fallback: Boolean(res.isOnline) });
  const distanceLabel = formatBusinessDistanceLabel(t, res.distanceKm);
  const isOpenNow = useMemo(
    () =>
      resolveBusinessOpenNow({
        hours: res.hours || res.businessInfo?.hours,
        openingHours: res.openingHours || res.businessInfo?.openingHours,
        workingHours: res.workingHours || res.businessInfo?.workingHours,
        openNow: res.openNow ?? res.businessInfo?.openNow,
        lat: res.lat ?? res.businessInfo?.lat,
        lng: res.lng ?? res.businessInfo?.lng,
        countryCode: res.countryCode || res.businessInfo?.countryCode,
        country: res.country || res.businessInfo?.country,
        timeZone: res.timeZone || res.timezone || res.businessInfo?.timeZone,
      }),
    [
      res.hours,
      res.businessInfo?.hours,
      res.openingHours,
      res.businessInfo?.openingHours,
      res.workingHours,
      res.businessInfo?.workingHours,
      res.openNow,
      res.businessInfo?.openNow,
      res.lat,
      res.lng,
      res.businessInfo?.lat,
      res.businessInfo?.lng,
      res.countryCode,
      res.country,
      res.businessInfo?.countryCode,
      res.businessInfo?.country,
      res.timeZone,
      res.timezone,
      res.businessInfo?.timeZone,
    ]
  );

  const [cardLiked, setCardLiked] = useState(false);
  const [optimisticLiked, setOptimisticLiked] = useState(null);
  const [likeInProgress, setLikeInProgress] = useState(false);
  const [joinInProgress, setJoinInProgress] = useState(false);
  useEffect(() => {
    if (!res.id || !likeUser?.uid) {
      setCardLiked(false);
      setOptimisticLiked(null);
      return () => {};
    }
    return subscribeBusinessLiked(res.id, likeUser.uid, setCardLiked);
  }, [res.id, likeUser?.uid]);

  const effectiveLiked = optimisticLiked ?? cardLiked;

  useEffect(() => {
    if (optimisticLiked === null) return;
    if (optimisticLiked === cardLiked) setOptimisticLiked(null);
  }, [cardLiked, optimisticLiked]);

  const handleToggleLike = async (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (likeInProgress) return;
    if (!likeUser?.uid || likeUser?.isGuest) {
      goToLogin();
      return;
    }
    const businessId = res.id;
    const userId = likeUser.uid;
    const nextLiked = !effectiveLiked;
    setOptimisticLiked(nextLiked);
    setLikeInProgress(true);
    try {
      const businessInfoForFavorite = !effectiveLiked ? {
        businessId: res.id,
        name: res.name || '',
        image: res.image,
        address: res.location || '',
        city: ''
      } : undefined;
      void toggleBusinessLike(businessId, userId, effectiveLiked, businessInfoForFavorite).catch((err) => {
        setOptimisticLiked(effectiveLiked);
        console.warn('[like] card toggle failed', { businessId, userId, err });
        showToast(t('like_failed', 'Could not update like. Try again.'), 'error');
      });
    } finally {
      setLikeInProgress(false);
    }
  };

  const effectiveJoined = isJoined;
  const chatEnabled = isBusinessCommunityChatEnabled(res.subscriptionTier);

  const handleJoinOrChat = async (e) => {
    if (joinInProgress) return;
    setJoinInProgress(true);
    try {
      const result = await handleBusinessCommunityJoinClick({
        event: e,
        navigate,
        goToLogin,
        currentUser,
        communityId,
        isJoined: effectiveJoined,
        joinCommunity,
        returnPath: `/business/${res.id}`,
        chatEnabled,
      });
      if (result?.reason === 'missing_community') {
        showToast(t('community_join_failed', 'Could not join the community. Try again.'), 'error');
      } else if (result?.reason === 'chat_disabled') {
        showToast(
          t(
            'community_chat_paid_only_member_hint',
            'Group chat is available when this business has a Paid plan.'
          ),
          'info'
        );
      }
    } finally {
      setJoinInProgress(false);
    }
  };

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
        incrementBusinessShareCount(res.id);
      } catch (err) {
        if (err?.name !== 'AbortError') console.log('Error sharing:', err);
      }
    } else {
      navigator.clipboard.writeText(shareData.url);
      showToast(t('link_copied_clipboard', 'Link copied!'), 'success');
      incrementBusinessShareCount(res.id);
    }
  };

  const handleCreateInvite = (e) => {
    e.stopPropagation();
    e.preventDefault();
    onHostInvitation?.(res);
  };

  return (
    <div
      className="restaurant-card restaurant-list-card"
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
        flexDirection: 'column',
        width: '100%',
        aspectRatio: '1 / 1'
      }}>
      
            {/* Top Section: Full Image Background with Overlay Content */}
            <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>

                {/* Background Image */}
                <img
          src={resolveBusinessCoverImageUrl(res) || pickSafeDisplayImageUrl(res.image, res.businessInfo?.coverImage) || DEFAULT_BUSINESS_COVER}
          alt={res.name}
          onError={(e) => handleBusinessCoverImageError(e, res)}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            zIndex: 0
          }} />
        

                {/* Gradient Overlay for Text Readability */}
                <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: tc ?
          `linear-gradient(to top, ${tc.gradientFrom} 0%, ${tc.gradientTo} 40%, transparent 100%)` :
          'linear-gradient(to top, rgba(2, 6, 23, 0.95) 0%, rgba(2, 6, 23, 0.7) 40%, transparent 100%)',
          zIndex: 1
        }} />

                {/* Top row: category + online | rating + actions */}
                <div className="restaurant-list-card__top">
                    <div className="restaurant-list-card__top-start">
                    <button
            type="button"
            className="restaurant-list-card__category"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/restaurants?category=${encodeURIComponent(res.type || 'Venue')}`);
            }}
            style={{
              background: tc ? tc.badgeBg || `${tc.accent}33` : undefined,
              border: tc ? `1px solid ${tc.border || tc.accent}` : undefined,
              boxShadow: tc?.btnShadow,
            }}
            onMouseEnter={(e) => {
              if (tc) {
                e.currentTarget.style.background = tc.accent;
                e.currentTarget.style.color = '#ffffff';
              }
              e.currentTarget.style.transform = 'scale(1.03)';
            }}
            onMouseLeave={(e) => {
              if (tc) {
                e.currentTarget.style.background = tc.badgeBg || `${tc.accent}33`;
              }
              e.currentTarget.style.color = '#ffffff';
              e.currentTarget.style.transform = 'scale(1)';
            }}>
            
                        {res.type ? t(`type_${res.type.toLowerCase().replace(' ', '')}`, res.type) : t('venue', 'Venue')}
                    </button>
                    <span
            className={`restaurant-list-card__presence-dot${isOnline ? ' restaurant-list-card__presence-dot--online' : ' restaurant-list-card__presence-dot--offline'}`}
            role="status"
            title={isOnline ? t('online', 'Online') : t('offline', 'Offline')}
            aria-label={isOnline ? t('online', 'Online') : t('offline', 'Offline')}
          />
                    </div>
                    <div className="restaurant-list-card__top-end">
                        {/* Rating badge */}
                        <div
              className="restaurant-list-card__rating"
              style={{
                background: tc ? tc.badgeBg || `${tc.accent}33` : undefined,
                border: tc ? `1px solid ${tc.border || tc.accent}` : undefined,
                boxShadow: tc?.btnShadow,
              }}
              onClick={(e) => e.stopPropagation()}>
              
                            <FaStar style={{ fontSize: '0.75rem', color: '#fbbf24' }} aria-hidden />
                            <AppText as="span">
                                {(res.averageRating != null ? Number(res.averageRating) : 0).toFixed(1)}
                            </AppText>
                        </div>
                        <button
              type="button"
              aria-label={cardLiked ? t('unlike', 'Unlike') : t('like', 'Like')}
              disabled={likeInProgress}
              onClick={handleToggleLike}
              style={{
                position: 'relative',
                zIndex: 11,
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: tc ? `${tc.accent}33` : 'rgba(15, 23, 42, 0.6)',
                backdropFilter: 'blur(8px)',
                border: tc ? `1px solid ${tc.border || tc.accent}` : '1px solid rgba(148, 163, 184, 0.5)',
                color: effectiveLiked ? '#ef4444' : 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: likeInProgress ? 'wait' : 'pointer',
                fontSize: '1.2rem',
                transition: 'all 0.2s'
              }}>
              
                            {likeInProgress ? <AppText as="span" style={{ fontSize: '0.9rem' }}>⋯</AppText> : effectiveLiked ? <FaHeart /> : <FaRegHeart />}
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
              }}>
              
                            <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
                        </button>
                    </div>
                </div>

                {/* Content Overlay */}
                <div style={{ position: 'relative', zIndex: 10, padding: '20px 20px 10px 20px' }}>

                    {/* Special offer banner (Paid businesses only) */}
                    {specialOffer &&
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              width: '100%',
              marginBottom: '0.75rem',
              padding: specialOffer.imageUrl ? '0.55rem 0.7rem' : '0.7rem',
              borderRadius: '14px',
              border: `1px solid ${offerAccentVars?.['--offer-accent-border'] || 'rgba(45, 212, 191, 0.42)'}`,
              background: `linear-gradient(115deg, ${offerAccentVars?.['--offer-accent-1'] || 'rgba(13, 148, 136, 0.55)'}, ${offerAccentVars?.['--offer-accent-2'] || 'rgba(6, 28, 24, 0.72)'})`,
              boxShadow: '0 8px 22px rgba(0, 0, 0, 0.28)',
              boxSizing: 'border-box'
            }}>
                            {specialOffer.imageUrl &&
            <img
              src={specialOffer.imageUrl}
              alt=""
              style={{ width: '3.1rem', height: '3.1rem', borderRadius: '10px', objectFit: 'cover', flexShrink: 0 }} />
            }
                            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                                <AppText as="span" style={{
                fontSize: '1.05rem', fontWeight: 900, lineHeight: 1.18, color: '#ecfdf5',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
              }}>
                                    {specialOffer.title}
                                </AppText>
                                <AppText as="span" style={{ fontSize: '0.78rem', fontWeight: 700, color: 'rgba(236, 253, 245, 0.88)' }}>
                                    {formatSwipeOfferDateRange(specialOffer, i18n.language)}
                                </AppText>
                            </div>
                        </div>
          }

                    {/* Title & Location */}
                    <div style={{ marginBottom: '16px' }}>
                        {typeof isOpenNow === 'boolean' ? (
            <span
              className={`restaurant-list-card__hours-status${isOpenNow ? ' restaurant-list-card__hours-status--open' : ' restaurant-list-card__hours-status--closed'}`}
              role="status">
              
                            <AppText as="span">{isOpenNow ? t('open', 'Open') : t('closed', 'Closed')}</AppText>
                        </span>
            ) : null}
                        <AppText as="h2" style={{
              fontSize: '1.8rem',
              fontWeight: '900',
              color: 'white',
              marginBottom: '4px',
              textShadow: '0 2px 4px rgba(0,0,0,0.5)',
              lineHeight: '1.1'
            }}>
                            {res.name}
                        </AppText>
                        <AppText as="p" style={{
              fontSize: '0.95rem',
              color: 'rgba(255,255,255,0.9)',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginTop: '4px'
            }}>
                            <FaMapMarkedAlt size={14} style={{ color: '#fbbf24' }} />{' '}
                            {getBusinessCardCity(res) || t('unknown_city', 'Unknown City')}
                            {distanceLabel ? ` · ${distanceLabel}` : ''}
                        </AppText>
                    </div>

                </div>
            </div>

            {/* Bottom Section: adjacent action buttons */}
            <div className="restaurant-list-card__footer-bar" style={{
        padding: '10px 12px',
        background: tc?.footerBg || 'var(--premium-orange)',
        borderTop: 'none',
        position: 'relative',
        zIndex: 20,
        flexShrink: 0
      }}>
                <div className="restaurant-list-card__footer-actions">
                    {isOwner ?
          <AppText as="span" style={{
            background: tc ? 'rgba(255,255,255,0.92)' : 'var(--bg-input)',
            color: tc ? tc.accent : 'var(--luxury-gold)',
            padding: '6px 12px',
            borderRadius: '8px',
            fontSize: '0.75rem',
            fontWeight: 'bold',
            border: tc ? `1px solid ${tc.border || tc.accent}` : '1px solid var(--border-color)'
          }}>
                            {t('owner')}
                        </AppText> :
          !isBusinessAccount ? (
            <>
              <button
                type="button"
                className={`community-join-btn restaurant-list-card__footer-btn${effectiveJoined ? ' community-join-btn--chat' : ''}`}
                onClick={handleJoinOrChat}
                disabled={joinInProgress}
                title={
                  effectiveJoined
                    ? chatEnabled
                      ? t('business_grid_join_chat', 'Join chat')
                      : t('joined', 'Joined')
                    : t('join_plus', '+ Join')
                }
                aria-label={
                  effectiveJoined
                    ? chatEnabled
                      ? t('business_grid_join_chat', 'Join chat')
                      : t('joined', 'Joined')
                    : t('join_plus', '+ Join')
                }>
                {effectiveJoined ? (
                  <>
                    <FaComments aria-hidden />
                    {chatEnabled
                      ? t('business_grid_join_chat', 'Join chat')
                      : t('joined', 'Joined')}
                  </>
                ) : (
                  joinInProgress ? '…' : t('join_plus', '+ Join')
                )}
              </button>
              {!isGuest ? (
                <button
                  type="button"
                  className="restaurant-list-card__footer-btn restaurant-list-card__footer-btn--host"
                  onClick={handleCreateInvite}
                  title={t('host_invitation_here')}
                  aria-label={t('host_invitation_here')}
                >
                  <FaStore aria-hidden />
                  <AppText as="span">{t('host_invitation_here')}</AppText>
                </button>
              ) : null}
            </>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onViewMembers) onViewMembers(res.id);
              }}
              style={{
                border: 'none',
                background: 'transparent',
                padding: 0,
                margin: 0,
                fontSize: '0.85rem',
                color: 'rgba(255,255,255,0.9)',
                fontWeight: 600,
                cursor: onViewMembers ? 'pointer' : 'default'
              }}>
              {t('restaurant_community')}
            </button>
          )}
                </div>
            </div>
        </div>);

});

const BusinessesDirectory = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser, userProfile, isGuest } = useAuth();
  const { showToast } = useToast();
  const context = useInvitations();
  const { isDark } = useTheme();

  // Get restaurants from context
  const restaurants = context?.restaurants || [];

  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState('All');
  const [countryFilter, setCountryFilter] = useState('All');
  const [activeFilter, setActiveFilter] = useState(() => searchParams.get('category') || 'All'); // Category filter
  const [showFilters, setShowFilters] = useState(false); // Controls filter visibility
  const [viewMode, setViewMode] = useState('list');
  const [isFullscreen, setIsFullscreen] = useState(false); // Fullscreen mode for map
  const [userLocation, setUserLocation] = useState(null);
  const [detectedLocationContext, setDetectedLocationContext] = useState(null);
  const [selectedCommunityId, setSelectedCommunityId] = useState(null);
  const [selectedCommunityMembers, setSelectedCommunityMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [inviteSelectorOpen, setInviteSelectorOpen] = useState(false);
  const [inviteSelectorState, setInviteSelectorState] = useState(null);

  const handleHostInvitation = (business) => {
    if (!currentUser || isGuest) {
      const nextPath = withBusinessIdInPath('/create/manual', business?.id);
      goToLogin({ returnPath: nextPath });
      return;
    }
    const state = buildHostInvitationNavigationState(business);
    if (!state) {
      showToast(t('something_went_wrong', 'Something went wrong.'), 'error');
      return;
    }
    setInviteSelectorState(state);
    setInviteSelectorOpen(true);
  };

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

  // GPS coordinates for map centering and distance-based filters
  useEffect(() => {
    if (!navigator.geolocation) return undefined;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      },
      (error) => {
        console.log('Location access denied:', error);
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 120000 }
    );

    return undefined;
  }, []);

  // City/country context: GPS reverse-geocode, then profile, then IP
  useEffect(() => {
    let cancelled = false;

    detectUserLocationContext(userProfile).then((ctx) => {
      if (!cancelled && ctx?.success) {
        setDetectedLocationContext(ctx);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
  userProfile?.city,
  userProfile?.country,
  userProfile?.countryCode,
  userProfile?.coordinates?.lat,
  userProfile?.coordinates?.lng]
  );

  const viewerGeoContext = useMemo(
    () => buildViewerGeoContext({
      userLocation,
      userProfile,
      detectedContext: detectedLocationContext
    }),
    [userLocation, userProfile, detectedLocationContext]
  );

  // Helper functions and constants moved outside or used directly
  const locationFilters = [
  { id: 'All', label: t('all'), icon: '🌍' },
  { id: 'nearby', label: t('near_me'), icon: '📍' },
  { id: 'city', label: t('my_city', 'My area'), icon: '🏙️' },
  { id: 'country', label: t('my_country', 'My country'), icon: '🗺️' }];


  const categories = [
  { id: 'All', label: t('filter_all'), icon: null },
  { id: 'Restaurant', label: t('type_restaurant'), icon: '🍴' },
  { id: 'Cafe', label: t('type_cafe'), icon: '☕' },
  { id: 'Bar', label: t('type_bar', 'Bar'), icon: '🍺' },
  { id: 'Night Club', label: t('type_nightclub', 'Night Club'), icon: '🎵' },
  { id: 'Food Truck', label: t('type_foodtruck', 'Food Truck'), icon: '🚚' },
  { id: 'Fast Food', label: t('type_fastfood', 'Fast Food'), icon: '🍟' }];


  const availableCountries = useMemo(() => {
    const set = new Set();
    for (const res of restaurants) {
      const country = String(res?.country || res?.businessInfo?.country || '').trim();
      if (country) set.add(country);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [restaurants]);

  const filteredRestaurants = useMemo(() => {
    let filtered = restaurants.filter((res) => {
      if (!res) return false;

      // Search filter
      const matchesSearch = !searchQuery ||
      res.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      res.type?.toLowerCase().includes(searchQuery.toLowerCase());

      // Category filter
      const matchesCategory = activeFilter === 'All' || res.type === activeFilter;

      // Country filter
      const matchesCountry =
      countryFilter === 'All' ||
      String(res.country || res.businessInfo?.country || '').trim() === countryFilter;

      return matchesSearch && matchesCategory && matchesCountry;
    });

    const isStaff = ['admin', 'moderator', 'support'].includes(userProfile?.role);

    if (locationFilter !== 'All' && !isStaff) {
      if (canApplyBusinessLocationFilter(locationFilter, viewerGeoContext, isStaff)) {
        filtered = filtered.filter((res) =>
        matchesBusinessLocationFilter(
          locationFilter,
          res,
          viewerGeoContext,
          calculateDistance
        )
        );
      } else if (
        locationFilter === 'city' &&
        !canApplyBusinessLocationFilter('city', viewerGeoContext, isStaff)
      ) {
        // Keep listing until location resolves; avoid empty flash on first paint.
      } else {
        filtered = [];
      }
    }

    const viewerLat = viewerGeoContext?.lat;
    const viewerLng = viewerGeoContext?.lng;
    const hasViewerCoords = viewerLat != null && viewerLng != null;

    filtered = filtered.map((res) => {
      if (!hasViewerCoords) return { ...res, distanceKm: null };
      const bizLatLng = parseBusinessLatLng(res);
      if (!bizLatLng) return { ...res, distanceKm: null };
      return {
        ...res,
        distanceKm: calculateDistance(viewerLat, viewerLng, bizLatLng.lat, bizLatLng.lng),
      };
    });

    filtered.sort((a, b) => {
      if (a.distanceKm == null && b.distanceKm == null) return 0;
      if (a.distanceKm == null) return 1;
      if (b.distanceKm == null) return -1;
      return a.distanceKm - b.distanceKm;
    });

    return filtered;
  }, [restaurants, searchQuery, locationFilter, countryFilter, activeFilter, viewerGeoContext, userProfile?.role]);

  const restaurantsWithCoords = useMemo(() => {
    return filteredRestaurants.filter((res) => {
      const lat = Number(res.lat);
      const lng = Number(res.lng);
      return Number.isFinite(lat) && Number.isFinite(lng);
    });
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
      restaurantsWithCoords.forEach((res) => {
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

  useEffect(() => () => detachLeafletMap(mapInstance), []);

  // Initialize Leaflet map
  useEffect(() => {
    if (viewMode === 'map' && mapRef.current) {
      ensureLeafletMapDetachedIfOrphan(mapInstance, mapRef.current);

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
          const lats = restaurantsWithCoords.map((r) => r.lat);
          const lngs = restaurantsWithCoords.map((r) => r.lng);
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
          const bounds = restaurantsWithCoords.map((r) => [r.lat, r.lng]);
          try {
            mapInstance.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
          } catch (e) {}
        }
      }

      // Always ensure tiles match current theme
      mapInstance.current.eachLayer((layer) => {
        if (layer instanceof L.TileLayer) mapInstance.current.removeLayer(layer);
      });

      const tileUrl = isDark ?
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' :
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

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
        L.marker([userLocation.lat, userLocation.lng], { icon: userIcon }).
        addTo(mapInstance.current).
        bindPopup(`<strong style="color: #8b5cf6;">📍 ${t('your_location')}</strong>`);
      }

      // Add restaurant / partner markers
      restaurantsWithCoords.forEach((res) => {
        if (!res.lat || !res.lng) return;

        // Calculate distance
        let distance = null;
        let travelTime = null;
        if (userLocation) {
          distance = calculateDistance(userLocation.lat, userLocation.lng, res.lat, res.lng);
          travelTime = Math.round(distance / 40 * 60);
        }

        // Get profile logo/avatar for marker (prefer real profile over header image);
        // fall back to the same cover photo the directory card shows (handles Google-imported
        // businesses with no logo field) before the generated-initials placeholder.
        // Routed through pickSafeDisplayImageUrl so a raw, expired Google Places photo URL in
        // any of these fields can never win over the safe/default fallback below.
        const logo = pickSafeDisplayImageUrl(
          res.photo_url,
          res.avatar,
          res.logoImage,
          res.businessInfo?.logo,
          res.businessInfo?.logoImage,
          res.businessInfo?.photo_url,
          res.image,
          res.businessInfo?.image
        ) ||
        resolveBusinessCoverImageUrl(res) ||
        DEFAULT_BUSINESS_COVER;

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
                    <div class="compact-popup" dir="auto" style="unicode-bidi:isolate;text-align:start">
                        <div style="position: relative;">
                            <img src="${resolveBusinessCoverImageUrl(res) || pickSafeDisplayImageUrl(res.image, res.businessInfo?.coverImage) || DEFAULT_BUSINESS_COVER}" class="compact-popup-image" />
                            <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; padding: 4px; background: linear-gradient(to top, rgba(0,0,0,0.6), transparent);">
                                <span style="background: ${markerColor}; color: black; padding: 2px 6px; border-radius: 4px; font-size: 0.6rem; font-weight: 700; position: absolute; bottom: 4px; left: 4px; unicode-bidi:isolate;" dir="auto">${escapeHtmlText(formatBiDiText(res.type || t('venue', 'Venue')))}</span>
                            </div>
                        </div>
                        <div class="compact-popup-body">
                            <h4 class="compact-popup-title">${popupText(res.name)}</h4>
                            <div class="compact-popup-meta">
                                ${popupText(`📍 ${getBusinessCardCity(res) || t('unknown_city', 'Unknown City')}`)}
                            </div>
                            ${distance ? `
                                <div class="compact-popup-stats">
                                    <span dir="auto" style="unicode-bidi:isolate;">📏 ${distance.toFixed(1)} km</span>
                                    <span dir="auto" style="unicode-bidi:isolate;">⏱️ ~${travelTime} min</span>
                                </div>
                            ` : ''}
                            <div>
                                <button onclick="window.location.href='/business/${res.id}'" class="compact-popup-btn" style="background: ${markerColor}; color: black;">
                                    ${popupText(t('view_details'))}
                                </button>
                            </div>
                        </div>
                    </div>
                `;

        L.marker([res.lat, res.lng], { icon: markerIcon }).
        addTo(mapInstance.current).
        bindPopup(popupContent, {
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
          restaurantsWithCoords.forEach((res) => {
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
            restaurantsWithCoords.forEach((res) => {
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


  const handleRefresh = useCallback(async () => {
    document.querySelector('.app-main')?.scrollTo({ top: 0, behavior: 'smooth' });
    await new Promise((resolve) => window.setTimeout(resolve, 400));
  }, []);

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <div className="directory-page" style={{ paddingBottom: '100px', minHeight: '100%' }}>


            <div style={{ padding: '1rem 1.5rem 0' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', rowGap: 8, justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <AppText as="h1" style={{ fontSize: '1.2rem', fontWeight: '800', lineHeight: '1', margin: 0 }}>{t('business_directory', 'Business')}</AppText>
                        <button
              type="button"
              onClick={() => navigate('/rankings')}
              title={t('rankings_title', 'Rankings')}
              aria-label={t('rankings_title', 'Rankings')}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, color: 'var(--luxury-gold)', background: 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
              
                            <FaTrophy style={{ fontSize: '1.25rem' }} />
                        </button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Link
                      to="/restaurants"
                      className="users-directory-feed-link"
                      title={t('user_directory_feed_view', 'Card view')}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        minHeight: 34,
                        padding: '6px 10px',
                        borderRadius: 999,
                        border: '1px solid var(--border-color)',
                        background: 'rgba(232, 110, 46, 0.12)',
                        color: 'var(--primary)',
                        textDecoration: 'none',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                      }}
                    >
                      <LuSparkles aria-hidden />
                      <AppText as="span">{t('user_directory_feed_view', 'Card view')}</AppText>
                    </Link>
                    <div style={{ background: 'var(--bg-card)', padding: '4px', borderRadius: '50px', display: 'flex', border: '1px solid var(--border-color)' }}>
                        <button
              onClick={() => setViewMode('list')}
              style={{
                padding: '6px 12px',
                borderRadius: '50px',
                background: viewMode === 'list' ? 'var(--luxury-gold)' : 'transparent',
                color: viewMode === 'list' ? 'rgba(255, 255, 254, 1)' : 'var(--text-main)',
                border: 'none',
                fontSize: '0.82rem',
                fontWeight: 600
              }}>
              
                            {t('list')}
                        </button>
                        <button
              onClick={() => setViewMode('map')}
              style={{
                padding: '6px 12px',
                borderRadius: '50px',
                background: viewMode === 'map' ? 'var(--luxury-gold)' : 'transparent',
                color: viewMode === 'map' ? 'rgba(255, 255, 254, 1)' : 'var(--text-main)',
                border: 'none',
                fontSize: '0.82rem',
                fontWeight: 600
              }}>
              
                            {t('map')}
                        </button>
                    </div>
                    </div>
                </div>

                <style>{`
                    .filter-select {
                        appearance: none !important;
                        -webkit-appearance: none !important;
                        background-color: 'var(--bg-card, #ffffff)' !important;
                        border: 1px solid var(--border-color, #e2e8f0) !important;
                        color: 'var(--text-main, #333333)' !important;
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
                    {/* Row 1: Search + Filters — one horizontally-scrollable row so filters
                        never overlap/truncate on narrow screens. */}
                    <div
            className="category-icons-scroll"
            style={{ display: 'flex', gap: '8px', alignItems: 'center', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                        {/* Search Input */}
                        <div style={{ position: 'relative', flex: '0 0 auto', width: '190px' }}>
                            <FaSearch style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.85rem' }} />
                            <AppTextInput
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
                }} />
              
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
                }}>
                
                                {locationFilters.map((f) =>
                <option key={f.id} value={f.id}>{f.icon} {f.label}</option>
                )}
                            </select>
                        </div>

                        {/* Country Filter */}
                        {availableCountries.length > 1 &&
            <div style={{ flex: '0 0 auto' }}>
                                <select
                value={countryFilter}
                onChange={(e) => setCountryFilter(e.target.value)}
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
                }}>

                                    <option value="All">🌐 {t('all_countries', 'All countries')}</option>
                                    {availableCountries.map((c) =>
                <option key={c} value={c}>{c}</option>
                )}
                                </select>
                            </div>
            }
                    </div>

                    {/* Row 2: Category Icons - Show when search is focused */}
                    {showFilters &&
          <div style={{
            display: 'flex',
            gap: '6px',
            width: '100%',
            overflowX: 'auto',
            paddingBottom: '4px',
            animation: 'slideDown 0.2s ease-out'
          }}
          className="category-icons-scroll">
            
                            {categories.map((cat) =>
            <button
              key={cat.id}
              onClick={() => {
                setActiveFilter(cat.id);
                const next = new URLSearchParams(searchParams);
                if (cat.id === 'All') next.delete('category');else
                next.set('category', cat.id);
                setSearchParams(next);
              }}
              style={{
                flex: '0 0 auto',
                padding: '8px 12px',
                borderRadius: '10px',
                border: activeFilter === cat.id ?
                '2px solid var(--primary)' :
                '1px solid var(--border-color)',
                background: activeFilter === cat.id ?
                'rgba(139, 92, 246, 0.1)' :
                'var(--bg-card)',
                color: activeFilter === cat.id ?
                'var(--primary)' :
                'var(--text-main)',
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
              }}>
              
                                    {cat.icon && <AppText as="span">{cat.icon}</AppText>}
                                    <AppText as="span">{cat.label}</AppText>
                                </button>
            )}
                        </div>
          }
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
          }}>
          
                    <div
            className={`map-wrapper directory-map-wrapper${isFullscreen ? ' directory-map-wrapper--fullscreen' : ''}`}
            style={{ borderRadius: '0', overflow: 'hidden', width: '100%', height: isFullscreen ? '100dvh' : undefined, position: 'relative' }}>
            
                        <div
              ref={mapRef}
              className="responsive-map-container leaflet-container-home"
              style={{ width: '100%', height: '100%', minHeight: isFullscreen ? '100dvh' : undefined, outline: 'none' }} />
            

                        {/* Zoom Controls + Fullscreen + Recenter */}
                        <div className="map-zoom-controls">
                            <button onClick={zoomIn} className="btn-map-control" title={t('zoom_in', { defaultValue: 'Zoom In' })}>
                                <AppText as="span" style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>+</AppText>
                            </button>
                            <button onClick={zoomOut} className="btn-map-control" title={t('zoom_out', { defaultValue: 'Zoom Out' })}>
                                <AppText as="span" style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>−</AppText>
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
                title={isFullscreen ? t('exit_fullscreen', 'Exit Fullscreen') : t('fullscreen', 'Fullscreen')}>
                
                                {isFullscreen ? <FaCompress /> : <FaExpand />}
                            </button>
                            {/* Recenter Button */}
                            <button onClick={resetMapView} className="btn-map-control" title={t('recenter_map', { defaultValue: 'Recenter Map' })}>
                                <FaBullseye />
                            </button>
                        </div>

                        <div className="map-discovery-badge" style={{ top: 'auto', bottom: '20px', left: '50%', transform: 'translateX(-50%)' }}>
                            <div className="pulse-dot"></div>
                            <AppText as="span">{restaurantsWithCoords.length} {t('active_businesses', { defaultValue: 'Active Businesses' })}</AppText>
                        </div>
                    </div>
                </div>

                {/* List View (classic cards) */}
                <div
          className="restaurant-list restaurant-list--list"
          style={{
            display: viewMode === 'list' ? 'flex' : 'none',
            flexDirection: 'column',
            gap: '24px'
          }}>
          
                    {filteredRestaurants.map((res) =>
          <RestaurantCard
            key={res.id}
            res={res}
            onViewMembers={handleViewMembers}
            onHostInvitation={handleHostInvitation} />
          )}
                    {filteredRestaurants.length === 0 && viewMode === 'list' && (
          <AppText as="p" style={{ textAlign: 'center', opacity: 0.5 }}>{t('no_results')}</AppText>
          )}
                </div>
            </div>
            {/* Members Modal */}
            {selectedCommunityId &&
      <MembersModal
        members={membersLoading ? [] : selectedCommunityMembers}
        onClose={handleCloseMembers}
        currentUser={context.currentUser}
        onToggleFollow={context.toggleFollow}
        onChat={(id) => navigate(`/chat/${id}`)}
        title={t ? t('community_members') : 'Community Members'} />

      }
            <CreateInvitationSelector
              isOpen={inviteSelectorOpen}
              onClose={() => {
                setInviteSelectorOpen(false);
                setInviteSelectorState(null);
              }}
              navigationState={inviteSelectorState}
            />
        </div>
    </PullToRefresh>);

};

export default BusinessesDirectory;