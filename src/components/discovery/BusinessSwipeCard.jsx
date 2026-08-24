import React, { useCallback, useMemo, useState } from 'react';
import { handleBusinessCoverImageError } from '../../utils/businessCoverImage';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { FaMapMarkerAlt, FaStar, FaComments, FaStore, FaPlus } from 'react-icons/fa';
import { LuX } from 'react-icons/lu';
import { useAuth } from '../../context/AuthContext';
import { useInvitations } from '../../context/InvitationContext';
import { useToast } from '../../context/ToastContext';
import { goToLogin } from '../../utils/goToLogin';
import { getBusinessCardCity } from '../../utils/businessCardLocation';
import {
  handleBusinessCommunityJoinClick,
  isJoinedToBusinessCommunity,
  resolveBusinessCommunityId,
  resolveBusinessLiveStage,
} from '../../utils/businessCommunityJoin';
import {
  buildHostInvitationNavigationState,
  withBusinessIdInPath,
} from '../../utils/hostInvitationFromBusiness';
import { formatInvitationDistanceLabel } from '../../utils/invitationSwipeLabels';
import {
  buildPartnerCardAccentVars,
  buildSwipeOfferAccentVars,
  formatSwipeOfferDateRange,
  getActiveSwipeSpecialOffer,
  resolveBusinessSwipeSpecialOffer,
} from '../../utils/businessSwipeSpecialOffer';
import { getBusinessSubscriptionAccess } from '../../utils/businessSubscription';
import { useMagneticCardDrag } from '../../hooks/useMagneticCardDrag';
import CreateInvitationSelector from '../CreateInvitationSelector';
import './discovery.css';
import { AppText } from '../base';

export default function BusinessSwipeCard({ item, isTop = true, onSkip, listPath = '/restaurants/list' }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { currentUser, isGuest, isBusiness, userProfile } = useAuth();
  const { joinCommunity, currentUser: invitationUser } = useInvitations();
  const [joinInProgress, setJoinInProgress] = useState(false);
  const [inviteSelectorOpen, setInviteSelectorOpen] = useState(false);
  const [inviteSelectorState, setInviteSelectorState] = useState(null);

  const res = item?.raw || {};
  const partnerPaid = getBusinessSubscriptionAccess(res.subscriptionTier).isPaid;
  const specialOffer = partnerPaid
    ? getActiveSwipeSpecialOffer(resolveBusinessSwipeSpecialOffer(res))
    : null;
  const offerAccentVars = specialOffer ? buildSwipeOfferAccentVars(res.brandKit) : undefined;
  const cardAccentVars = buildPartnerCardAccentVars(res.brandKit);
  const openProfile = useCallback(() => {
    navigate(item.href || `/business/${res.id}`);
  }, [item.href, navigate, res.id]);

  const {
    styleMotion,
    drag,
    dragConstraints,
    touchAction,
    handleDragStart,
    handleDragEnd,
    handleCardPointerUp,
  } = useMagneticCardDrag({
    isTop,
    onSkip,
    item,
    axis: 'y',
    onPhotoActivate: openProfile,
  });

  const joinedCommunities = invitationUser?.joinedCommunities || currentUser?.joinedCommunities || [];
  const communityId = resolveBusinessCommunityId(joinedCommunities, {
    ownerId: res.ownerId,
    businessId: res.id,
    isVirtual: res.isVirtual === true || res.source === 'google_places',
  });
  const isJoined = isJoinedToBusinessCommunity(joinedCommunities, communityId);
  const { liveStageId, stageOpen } = resolveBusinessLiveStage(res);
  const isBusinessAccount = isBusiness;
  const city = getBusinessCardCity(res) || item.locationLabel || '';
  const address =
    res.address ||
    res.location ||
    res.businessInfo?.address ||
    city ||
    '';
  const description = String(
    res.description || res.businessInfo?.description || res.bio || ''
  ).trim();
  const distanceLabel = formatInvitationDistanceLabel(t, item.distanceKm ?? res.distanceKm);
  const categoryLabel = res.type
    ? t(`type_${String(res.type).toLowerCase().replace(/\s+/g, '')}`, res.type)
    : t('venue', 'Venue');
  const ratingValue =
    res.averageRating != null && Number.isFinite(Number(res.averageRating))
      ? Number(res.averageRating).toFixed(1)
      : null;

  const chips = useMemo(
    () =>
      [
        distanceLabel ? { key: 'distance', icon: FaMapMarkerAlt, label: distanceLabel } : null,
        categoryLabel ? { key: 'type', icon: FaStore, label: categoryLabel } : null,
        ratingValue ? { key: 'rating', icon: FaStar, label: ratingValue } : null,
        city && city !== address ? { key: 'city', icon: FaMapMarkerAlt, label: city } : null,
      ].filter(Boolean),
    [address, categoryLabel, city, distanceLabel, ratingValue]
  );

  const handleClose = (e) => {
    e.stopPropagation();
    navigate(listPath, { replace: true });
  };

  const handleJoin = async (e) => {
    if (joinInProgress) return;
    setJoinInProgress(true);
    try {
      const result = await handleBusinessCommunityJoinClick({
        event: e,
        navigate,
        goToLogin,
        currentUser,
        communityId,
        isJoined,
        joinCommunity,
        returnPath: `/business/${res.id}`,
        liveStageId,
        stageOpen,
      });
      if (result?.reason === 'missing_community') {
        showToast(t('community_join_failed', 'Could not join the community. Try again.'), 'error');
      } else if (result?.reason === 'no_open_stage') {
        showToast(t('business_member_no_stage', 'You are a member. The Stage will open here when the business starts one.'), 'info');
      }
    } finally {
      setJoinInProgress(false);
    }
  };

  const handleCreateInvite = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (!currentUser || isGuest) {
      goToLogin({ returnPath: withBusinessIdInPath('/create/manual', res.id) });
      return;
    }
    if (isBusinessAccount) {
      showToast(
        t('business_cannot_create_public_invite', 'Business accounts host from their dashboard.'),
        'info'
      );
      return;
    }
    const state = buildHostInvitationNavigationState(res);
    if (!state) {
      showToast(t('something_went_wrong', 'Something went wrong.'), 'error');
      return;
    }
    setInviteSelectorState(state);
    setInviteSelectorOpen(true);
  };

  const joinLabel = !isJoined
    ? t('join_community', 'Join community')
    : stageOpen
      ? t('business_enter_stage', 'Enter Stage')
      : t('joined', 'Joined');

  return (
    <>
      <motion.article
        className="discovery-card discovery-card--magnetic discovery-card--entity discovery-card--partner"
        style={{ ...cardAccentVars, ...styleMotion, zIndex: isTop ? 2 : 1, touchAction }}
        drag={drag}
        dragConstraints={dragConstraints}
        dragElastic={0.85}
        dragMomentum={false}
        initial={isTop ? { scale: 0.92, opacity: 0.65 } : false}
        animate={isTop ? { scale: 1, opacity: 1 } : undefined}
        transition={{ type: 'spring', stiffness: 380, damping: 26 }}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onPointerUp={handleCardPointerUp}
        title={
          isTop
            ? t('partners_swipe_hint', 'Swipe up or down for next · tap photo for profile')
            : undefined
        }
      >
        <div className="discovery-card__glow" aria-hidden />
        <div className="discovery-card__frame">
          <img
            src={item.coverImage}
            alt=""
            className="discovery-card__photo discovery-card__photo--profile"
            draggable={false}
            onError={(e) => handleBusinessCoverImageError(e, { placeId: item.id })}
          />
          <div className="discovery-card__gradient discovery-card__gradient--entity" aria-hidden />

          <div className="discovery-card__top-row">
            <span className="discovery-card__location-spacer" aria-hidden />
            <button
              type="button"
              className="discovery-card__close discovery-card__action--glass"
              aria-label={t('close', 'Close')}
              title={t('magnetic_close_to_list', 'Back to list')}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={handleClose}
            >
              <LuX size={22} aria-hidden />
            </button>
          </div>

          <div className="discovery-card__body">
            {specialOffer ? (
              <div
                className={`discovery-card__special-offer${
                  specialOffer.imageUrl
                    ? ' discovery-card__special-offer--with-image'
                    : ' discovery-card__special-offer--text-only'
                }`}
                style={offerAccentVars}
              >
                {specialOffer.imageUrl ? (
                  <img
                    src={specialOffer.imageUrl}
                    alt=""
                    className="discovery-card__special-offer-img"
                    draggable={false}
                  />
                ) : null}
                <div className="discovery-card__special-offer-copy">
                  <AppText as="span" className="discovery-card__special-offer-title">
                    {specialOffer.title}
                  </AppText>
                  <AppText as="span" className="discovery-card__special-offer-dates">
                    {formatSwipeOfferDateRange(specialOffer, i18n.language)}
                  </AppText>
                </div>
              </div>
            ) : null}

            <div className="discovery-card__identity discovery-card__identity--stack">
              <AppText as="h2" className="discovery-card__name-line">
                {item.title || res.name}
              </AppText>
              {address ? (
                <AppText as="p" className="discovery-card__address">
                  <FaMapMarkerAlt aria-hidden /> {address}
                </AppText>
              ) : null}
              {description ? (
                <AppText as="p" className="discovery-card__bio discovery-card__bio--entity">
                  {description}
                </AppText>
              ) : null}
            </div>

            <div className="discovery-card__meta-chips">
              {chips.map((chip) => {
                const Icon = chip.icon;
                return (
                  <span key={chip.key} className="discovery-card__chip">
                    <Icon aria-hidden />
                    <AppText as="span">{chip.label}</AppText>
                  </span>
                );
              })}
            </div>

            {!isBusinessAccount ? (
              <div className="discovery-card__actions discovery-card__actions--entity">
                <button
                  type="button"
                  className="discovery-card__cta discovery-card__action discovery-card__action--glass discovery-card__action--join"
                  disabled={joinInProgress}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={handleJoin}
                >
                  <FaComments size={14} aria-hidden />
                  <AppText as="span">{joinLabel}</AppText>
                </button>
                <button
                  type="button"
                  className="discovery-card__cta discovery-card__action discovery-card__action--glass discovery-card__action--invite"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={handleCreateInvite}
                >
                  <FaPlus size={14} aria-hidden />
                  <AppText as="span">{t('host_invitation_here', 'Create invitation')}</AppText>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </motion.article>

      <CreateInvitationSelector
        isOpen={inviteSelectorOpen}
        onClose={() => {
          setInviteSelectorOpen(false);
          setInviteSelectorState(null);
        }}
        navigationState={inviteSelectorState}
      />
    </>
  );
}
