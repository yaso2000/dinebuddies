import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  FaMapMarkerAlt,
  FaUsers,
  FaMoneyBillWave,
  FaVenusMars,
  FaBirthdayCake,
  FaCalendarAlt,
  FaCheck,
  FaPaperPlane,
} from 'react-icons/fa';
import { LuX } from 'react-icons/lu';
import { useAuth } from '../../context/AuthContext';
import { useInvitations } from '../../context/InvitationContext';
import { useToast } from '../../context/ToastContext';
import { goToLogin } from '../../utils/goToLogin';
import {
  formatInvitationAgeLabel,
  formatInvitationDistanceLabel,
  formatInvitationGenderLabel,
  formatInvitationPaymentLabel,
  formatInviteDateTime,
} from '../../utils/invitationSwipeLabels';
import { useMagneticCardDrag } from '../../hooks/useMagneticCardDrag';
import './discovery.css';
import { AppText } from '../base';

export default function InvitationSwipeCard({ item, isTop = true, onSkip, listPath = '/invitations/list' }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { userProfile } = useAuth();
  const { currentUser, requestToJoin } = useInvitations();
  const [joining, setJoining] = useState(false);

  const inv = item?.raw || {};
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
  });

  const joined = inv.joined || [];
  const requests = inv.requests || [];
  const viewerId = currentUser?.uid || currentUser?.id;
  const isHost = inv.author?.id && inv.author.id === viewerId;
  const isAccepted = viewerId ? joined.includes(viewerId) : false;
  const isPending = viewerId ? requests.includes(viewerId) : false;
  const guestsNeeded = Number(inv.guestsNeeded) || 0;
  const spotsLeft = Math.max(0, guestsNeeded - joined.length);

  const genderLabel = formatInvitationGenderLabel(t, inv);
  const ageLabel = formatInvitationAgeLabel(t, inv.ageRange);
  const paymentLabel = formatInvitationPaymentLabel(t, inv.paymentType);
  const distanceLabel = formatInvitationDistanceLabel(t, item.distanceKm ?? inv.distance);
  const whenLabel = formatInviteDateTime(t, i18n, inv.date, inv.time);
  const guestsLabel =
    guestsNeeded > 0
      ? `${guestsNeeded} ${t('guests', 'Guests')}${spotsLeft >= 0 ? ` · ${spotsLeft} ${t('spots_left', 'left')}` : ''}`
      : null;
  const address = inv.location || item.locationLabel || '';
  const description = String(inv.description || '').trim();
  const hostName = inv.author?.name || inv.author?.displayName || '';

  const chips = useMemo(
    () =>
      [
        distanceLabel ? { key: 'distance', icon: FaMapMarkerAlt, label: distanceLabel } : null,
        { key: 'gender', icon: FaVenusMars, label: genderLabel },
        { key: 'age', icon: FaBirthdayCake, label: ageLabel },
        { key: 'payment', icon: FaMoneyBillWave, label: paymentLabel },
        guestsLabel ? { key: 'guests', icon: FaUsers, label: guestsLabel } : null,
        whenLabel ? { key: 'when', icon: FaCalendarAlt, label: whenLabel } : null,
      ].filter(Boolean),
    [ageLabel, distanceLabel, genderLabel, guestsLabel, paymentLabel, whenLabel]
  );

  const checkEligibility = () => {
    if (userProfile?.role === 'business') {
      return {
        eligible: false,
        reason: t('business_cannot_join', 'Business accounts cannot join invitations'),
      };
    }
    // Visible to everyone, but only the host's followers may join.
    if (
      inv?.joinRestriction === 'followers_only' &&
      inv.author?.id &&
      !isHost &&
      !currentUser?.following?.includes(inv.author.id)
    ) {
      return {
        eligible: false,
        reason: t('followers_only_join', 'Only the host’s followers can join this invitation.'),
      };
    }
    if (inv.genderGroups?.length > 0 && !inv.genderGroups.includes('any')) {
      if (currentUser?.gender && !inv.genderGroups.includes(currentUser.gender)) {
        return { eligible: false, reason: t('gender_mismatch') };
      }
    } else if (
      inv.genderPreference &&
      inv.genderPreference !== 'any' &&
      inv.genderPreference !== 'custom' &&
      currentUser?.gender !== inv.genderPreference
    ) {
      return { eligible: false, reason: t('gender_mismatch') };
    }
    if (inv.ageRange && currentUser?.age) {
      const [minAge, maxAge] = String(inv.ageRange).split('-').map(Number);
      const userAge = Number(currentUser.age);
      if (Number.isFinite(minAge) && Number.isFinite(maxAge) && (userAge < minAge || userAge > maxAge)) {
        return { eligible: false, reason: `${t('age_range_preference')}: ${inv.ageRange}` };
      }
    }
    return { eligible: true };
  };

  const handleClose = (e) => {
    e.stopPropagation();
    navigate(listPath, { replace: true });
  };

  const handleOpen = (e) => {
    e.stopPropagation();
    navigate(item.href || `/invitation/${inv.id}`);
  };

  const handleJoin = async (e) => {
    e.stopPropagation();
    e.preventDefault();

    if (inv.meetingStatus === 'completed' || isHost) {
      navigate(`/invitation/${inv.id}`);
      return;
    }
    if (isAccepted) {
      navigate(`/invitation/${inv.id}/chat`);
      return;
    }
    if (isPending) {
      showToast(t('request_sent_waiting', 'Request already sent — waiting for approval.'), 'info');
      return;
    }
    if (userProfile?.isGuest || !viewerId || viewerId === 'guest') {
      goToLogin({ returnPath: `/invitation/${inv.id}` });
      return;
    }
    const eligibility = checkEligibility();
    if (!eligibility.eligible) {
      showToast(eligibility.reason || t('invite_unavailable', 'Invitation unavailable'), 'error');
      return;
    }
    if (spotsLeft <= 0) {
      showToast(t('invitation_full', 'This invitation is full.'), 'error');
      return;
    }
    if (joining) return;
    setJoining(true);
    try {
      const ok = await requestToJoin(inv.id);
      if (ok) showToast(t('join_request_sent', 'Join request sent'), 'success');
    } finally {
      setJoining(false);
    }
  };

  const joinLabel = isHost
    ? t('manage', 'Manage')
    : isAccepted
      ? t('open_chat', 'Open chat')
      : isPending
        ? t('requested', 'Requested')
        : t('join', 'Join');

  return (
    <motion.article
      className="discovery-card discovery-card--magnetic discovery-card--entity discovery-card--invite"
      style={{ ...styleMotion, zIndex: isTop ? 2 : 1, touchAction }}
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
          ? t('invitations_swipe_hint', 'Swipe up or down for next · double-tap to skip')
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
          <div className="discovery-card__identity discovery-card__identity--stack">
            <AppText as="h2" className="discovery-card__name-line">
              {item.title || inv.title}
            </AppText>
            {hostName ? (
              <AppText as="p" className="discovery-card__host">
                {hostName}
                {inv.type ? ` · ${inv.type}` : ''}
              </AppText>
            ) : null}
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

          <div className="discovery-card__actions discovery-card__actions--entity">
            <button
              type="button"
              className="discovery-card__cta discovery-card__action discovery-card__action--glass discovery-card__action--join"
              disabled={joining || isPending}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={handleJoin}
            >
              {isPending || isAccepted ? <FaCheck size={14} aria-hidden /> : <FaPaperPlane size={14} aria-hidden />}
              <AppText as="span">{joinLabel}</AppText>
            </button>
            <button
              type="button"
              className="discovery-card__cta discovery-card__action discovery-card__action--glass discovery-card__action--open"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={handleOpen}
            >
              <AppText as="span">{t('view_invitation', 'View invitation')}</AppText>
            </button>
          </div>
        </div>
      </div>
    </motion.article>
  );
}
