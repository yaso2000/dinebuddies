import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaCrown, FaComments, FaEnvelope, FaHeart, FaRegHeart, FaShare, FaStar, FaUserPlus, FaUsers } from 'react-icons/fa';
import { AppText } from '../base';
import { handleBusinessCoverImageError } from '../../utils/businessCoverImage';
import { resolveBusinessOpenNow } from '../../utils/googlePlacesBusiness';
import { goToLogin } from '../../utils/goToLogin';
import BusinessClaimPanel from '../BusinessClaimPanel';

export default function BusinessProfileHero({ profile }) {
  const { t } = useTranslation();
  const {
    business,
    businessInfo,
    heroCoverSrc,
    profileLogoUrl,
    isOwner,
    isPaid,
    showClaimCta,
    profileId,
    userLikedBusiness,
    likeInProgress,
    handleToggleLike,
    isSharing,
    handleShare,
    rankLoading,
    rankingPosition,
    navigate,
    logoUploading,
    handleLogoUpload,
    coverUploading,
    handleCoverUpload,
    memberCount,
    averageRating,
    reviews,
    activeInvitationsCount,
    setShowReviewModal,
    memberAvatars,
    effectiveIsMember,
    currentUser,
    userProfile,
    isGuest,
    handleJoinCommunity,
    handleCreateInvitation,
  } = profile;

  return (
    <div className="profile-header">

            {/* Cover & Top Nav */}
            <div className="business-hero-cover" style={{ background: 'linear-gradient(135deg, #1e1e2e, #2d2b42)' }}>
                <img
          src={heroCoverSrc}
          alt=""
          aria-hidden
          decoding="async"
          onError={(e) => handleBusinessCoverImageError(e, business)}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center'
          }} />


                {/* Overlay gradient */}
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.72) 100%)', borderRadius: 'inherit' }} />

                <div className="business-hero-top">
                    <div className="business-hero-top-row">
                        <div className="business-hero-status">
                            <div className="business-hero-start-row">
                                <div className="business-hero-social">
                                    <div className="business-hero-action-col">
                                        <button type="button" aria-label={userLikedBusiness ? t('unlike', 'Unlike') : t('like', 'Like')} disabled={likeInProgress} onClick={handleToggleLike} className={`business-hero-icon-btn${userLikedBusiness ? ' business-hero-icon-btn--liked' : ''}`}>
                                            {likeInProgress ? <AppText as="span" style={{ fontSize: '0.9rem' }}>⋯</AppText> : userLikedBusiness ? <FaHeart fontSize="1rem" /> : <FaRegHeart fontSize="1rem" />}
                                        </button>
                                        <AppText as="span" className="business-hero-icon-count">
                                            {Math.max(0, Number(business?.businessInfo?.profileLikes ?? 0))}
                                        </AppText>
                                    </div>
                                    <div className="business-hero-action-col">
                                        <button type="button" onClick={handleShare} disabled={isSharing} className="business-hero-icon-btn">
                                            {isSharing ? '⏳' : <FaShare fontSize="1rem" />}
                                        </button>
                                        <AppText as="span" className="business-hero-icon-count">
                                            {Math.max(0, Number(business?.businessInfo?.profileShares ?? 0))}
                                        </AppText>
                                    </div>
                                </div>
                                <div className="business-hero-badges">
                                    {(() => {
                  const isOpen = resolveBusinessOpenNow({
                    hours: businessInfo.hours,
                    openingHours: businessInfo.openingHours || business.openingHours,
                    workingHours: businessInfo.workingHours,
                    openNow: business.openNow,
                    lat: businessInfo.lat ?? business.coordinates?.lat ?? business.lat,
                    lng: businessInfo.lng ?? business.coordinates?.lng ?? business.lng,
                    countryCode: businessInfo.countryCode || business.countryCode,
                    country: businessInfo.country || business.country,
                    timeZone: businessInfo.timeZone || businessInfo.timezone,
                  });
                  const badgePill = (color, dot, label) =>
                  <AppText as="span"
                  className="business-hero-badge-pill"
                  style={{
                    border: `1px solid rgba(${color}, 0.55)`,
                    color: `rgb(${color})`
                  }}>

                                                <AppText as="span"
                    className="business-hero-badge-pill__dot"
                    style={{
                      background: `rgb(${dot})`,
                      boxShadow: `0 0 6px rgb(${dot})`
                    }} />

                                                {label}
                                            </AppText>;

                  return (
                    <>
                                                {business.isOnline && badgePill('16,185,129', '16,185,129', t('online'))}
                                                {typeof isOpen === 'boolean' &&
                      badgePill(
                        isOpen ? '74,222,128' : '248,113,113',
                        isOpen ? '74,222,128' : '248,113,113',
                        isOpen ? t('open', 'OPEN') : t('closed', 'CLOSED')
                      )}
                                            </>);

                })()}
                                </div>
                            </div>
                            {!rankLoading && rankingPosition != null && rankingPosition >= 1 &&
            <button type="button" onClick={(e) => {e.stopPropagation();navigate('/rankings');}} className="business-hero-rank-btn">
                                    <FaCrown style={{ color: 'var(--luxury-gold)', fontSize: '0.9rem' }} />
                                    <AppText as="span" className="business-hero-rank-btn__label">
                                        #{rankingPosition}
                                    </AppText>
                                </button>
            }
                        </div>

                        <div className="business-hero-actions">
                            {showClaimCta &&
            <BusinessClaimPanel
              variant="hero"
              restaurantId={profileId}
              googlePlaceId={
              business.googlePlaceId ||
              business.businessInfo?.placeId ||
              profileId
              }
              businessName={businessInfo.businessName || business.display_name} />

            }
                        </div>
                    </div>
                </div>

                <div className="business-hero-identity">
                    <div className={`business-hero-logo-wrap${isPaid ? ' business-hero-logo-wrap--paid' : ''}`}>
                        <div
            className="business-hero-logo"
            style={{ background: profileLogoUrl ? 'rgba(0,0,0,0.25)' : undefined }}>

                            {profileLogoUrl ?
            <img
              src={profileLogoUrl}
              alt=""
              aria-hidden
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }} /> :

            <AppText as="span" className="business-hero-logo-emoji">🏪</AppText>
            }
                        </div>
                        {isOwner &&
          <label className={`business-hero-logo-upload${logoUploading ? ' business-hero-logo-upload--busy' : ''}`}>
                                <AppText as="span" style={{ fontSize: '1.3rem', color: 'white' }}>{logoUploading ? '⏳' : '📷'}</AppText>
                                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} disabled={logoUploading} />
                            </label>
          }
                        {isPaid && !isOwner &&
          <div className="business-hero-plan-badge" title={t('biz_plan_paid_name', 'Paid Business')}>👑</div>
          }
                    </div>
                    <AppText as="h1" className="business-hero-name" dir="auto">
                        {business.display_name || business.displayName || t('business')}
                    </AppText>
                </div>

                {isOwner &&
      <label className="business-hero-edit-cover">
                        {coverUploading ? `⏳ ${t('uploading', 'Uploading...')}` : `📷 ${t('edit_cover', 'Edit Cover')}`}
                        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleCoverUpload} disabled={coverUploading} />
                    </label>
      }
            </div>


            {/* Glass Stats Box - uses BrandKit when available */}
            <div className="profile-stats business-profile-stats">
                <div className="profile-stat-item" style={{ color: 'var(--text-secondary)' }}>
                    <div className="business-profile-stat-value">
                        <FaUsers style={{ fontSize: '1.1rem', color: 'inherit' }} /> {memberCount}
                    </div>
                    <div className="profile-stat-label" style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)', marginTop: '6px' }}>{t('members', 'Members')}</div>
                </div>
                <div className="profile-stats-divider" style={{ background: 'var(--border-color)', opacity: 0.5 }} />
                <div
        className="profile-stat-item"
        style={{
          cursor: currentUser && !userProfile?.isBusiness && !isGuest ? 'pointer' : 'default',
          color: 'var(--text-secondary)'
        }}
        onClick={() => {if (currentUser && !userProfile?.isBusiness && !isGuest) setShowReviewModal(true);}}>

                    <div className="business-profile-stat-value">
                        <FaStar style={{ fontSize: '1.1rem', color: 'var(--luxury-gold)' }} /> {averageRating > 0 ? averageRating.toFixed(1) : '0.0'}
                    </div>
                    <div className="profile-stat-label" style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)', marginTop: '6px' }}>{reviews.length} {t('reviews', 'Reviews')}</div>
                </div>
                <div className="profile-stats-divider" style={{ background: 'var(--border-color)', opacity: 0.5 }} />
                <div className="profile-stat-item" style={{ color: 'var(--text-secondary)' }}>
                    <div className="business-profile-stat-value">
                        <FaEnvelope style={{ fontSize: '1.1rem', color: 'inherit' }} /> {activeInvitationsCount}
                    </div>
                    <div className="profile-stat-label" style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)', marginTop: '6px' }}>{t('invites', 'Invites')}</div>
                </div>
            </div>

            {businessInfo.tagline &&
    <AppText as="h2" style={{ fontSize: '1rem', margin: '0 0 var(--profile-stack-gap) 0', padding: 0, color: 'var(--text-secondary)', fontStyle: 'italic', fontWeight: '500', textAlign: 'center', maxWidth: '90%' }}>"{businessInfo.tagline}"</AppText>
    }

            {/* Actions Row */}
            <div className="business-profile-actions-row">
                {currentUser?.uid !== profileId && !userProfile?.isBusiness &&
      <button onClick={() => {if (isGuest) {goToLogin();return;}handleJoinCommunity();}} className={`business-profile-cta ${effectiveIsMember ? 'business-profile-cta--joined' : 'business-profile-cta--primary'}`}>
                        <>
                                {/* Overlapping member avatars — always visible */}
                                {memberCount > 0 && memberAvatars.length > 0 &&
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                            {memberAvatars.slice(0, 5).map((url, i) =>
              <img
                key={i}
                src={url}
                alt=""
                style={{
                  width: 26, height: 26, borderRadius: '50%',
                  objectFit: 'cover',
                  border: '2px solid rgba(255,255,255,0.4)',
                  marginInlineStart: i > 0 ? '-8px' : 0,
                  zIndex: 5 - i,
                  position: 'relative',
                  background: '#333'
                }} />

              )}
                                        </div>
                                        <AppText as="span" style={{ fontSize: '0.85rem', fontWeight: 800, marginInlineStart: '4px', opacity: 0.9 }}>
                                            {memberCount} {t('members')}
                                        </AppText>
                                    </div>
          }
                                {effectiveIsMember ? (
                                  <>
                                    <FaComments style={{ fontSize: '1.1rem' }} aria-hidden />
                                    {isPaid
                                      ? t('business_grid_join_chat', 'Join chat')
                                      : t('joined', 'Joined')}
                                  </>
                                ) : (
                                  `+ ${t('join_community', 'Join Community')}`
                                )}
                            </>
                    </button>
      }
                {currentUser?.uid !== profileId && !userProfile?.isBusiness && !currentUser?.isGuest &&
      <button
        type="button"
        onClick={handleCreateInvitation}
        className="business-profile-cta business-profile-cta--secondary">

                        <FaUserPlus style={{ fontSize: '1.2rem' }} />
                        {t('create_invitation', 'Create Invitation')}
                    </button>
      }
            </div>
        </div>);

}
