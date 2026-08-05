import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion, useDragControls, useMotionValue, animate } from 'framer-motion';
import {
  FaGift,
  FaCoins,
  FaPlus,
  FaTimes,
} from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { PROFILE_GIFTS } from '../../constants/profileGifts';
import { getPurchaseCredits, computeGiftSavedAmount } from '../../utils/walletCredits';
import { sendProfileGift, createGiftIdempotencyKey } from '../../utils/sendProfileGift';
import { goToLogin } from '../../utils/goToLogin';
import { AppText } from '../base';
import ProfileGiftVisual from './ProfileGiftVisual';
import './ProfileGiftPickerModal.css';

export default function ProfileGiftPickerModal({ recipient, onClose }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { currentUser, userProfile, isGuest } = useAuth();

  const [confirmGiftId, setConfirmGiftId] = useState(null);
  const [sending, setSending] = useState(false);
  const idempotencyKeyRef = useRef(null);
  const dragMovedRef = useRef(false);
  const dragControls = useDragControls();
  const dragY = useMotionValue(0);
  const [dragConstraints, setDragConstraints] = useState({ top: 0, bottom: 0 });

  const balance = getPurchaseCredits(userProfile);

  const confirmGift = useMemo(
    () => (confirmGiftId ? PROFILE_GIFTS.find((g) => g.id === confirmGiftId) : null),
    [confirmGiftId]
  );

  useEffect(() => {
    idempotencyKeyRef.current = null;
  }, [recipient?.id, confirmGiftId]);

  useEffect(() => {
    dragY.set(0);
  }, [recipient?.id, dragY]);

  useEffect(() => {
    const updateConstraints = () => {
      const vh = window.innerHeight;
      setDragConstraints({
        top: Math.round(-vh * 0.36),
        bottom: Math.round(vh * 0.44),
      });
    };
    updateConstraints();
    window.addEventListener('resize', updateConstraints, { passive: true });
    return () => window.removeEventListener('resize', updateConstraints);
  }, []);

  const recipientLabel =
    recipient?.displayName?.trim() ||
    t('gift_recipient_fallback', 'this member');

  const closeConfirm = () => {
    if (sending) return;
    setConfirmGiftId(null);
    idempotencyKeyRef.current = null;
  };

  const handleSend = async () => {
    if (!currentUser || isGuest) {
      goToLogin({ returnPath: window.location.pathname });
      return;
    }
    if (!recipient?.id || !confirmGift || sending) return;

    const canAfford = balance >= confirmGift.credits;
    if (!canAfford) {
      showToast(
        t('gift_insufficient_balance', 'Not enough credits in your purchase wallet.'),
        'error'
      );
      return;
    }

    const savedForRecipient = computeGiftSavedAmount(confirmGift.credits);

    setSending(true);
    try {
      if (!idempotencyKeyRef.current) {
        idempotencyKeyRef.current = createGiftIdempotencyKey();
      }
      const result = await sendProfileGift({
        recipientId: recipient.id,
        amount: confirmGift.credits,
        giftId: confirmGift.id,
        idempotencyKey: idempotencyKeyRef.current,
      });
      idempotencyKeyRef.current = null;
      const saved =
        typeof result?.savedAmount === 'number'
          ? result.savedAmount
          : savedForRecipient;
      showToast(
        t('gift_sent_success', {
          name: recipientLabel,
          gift: t(confirmGift.nameKey, confirmGift.defaultName),
          saved,
          defaultValue: `Gift sent to ${recipientLabel}! They receive ${saved} in savings.`,
        }),
        'success'
      );
      setConfirmGiftId(null);
      window.setTimeout(() => onClose?.(), 420);
    } catch (err) {
      console.error('[ProfileGift]', err);
      const code = String(err?.code || err?.details?.code || err?.message || '');
      if (code.includes('INSUFFICIENT') || String(err?.message).includes('INSUFFICIENT')) {
        showToast(
          t('gift_insufficient_balance', 'Not enough credits in your purchase wallet.'),
          'error'
        );
      } else if (String(code).includes('unauthenticated')) {
        goToLogin({ returnPath: window.location.pathname });
      } else {
        showToast(
          t('gift_send_failed', 'Could not send gift. Try again.'),
          'error'
        );
      }
    } finally {
      setSending(false);
    }
  };

  const confirmCanAfford = confirmGift ? balance >= confirmGift.credits : false;
  const dragEnabled = !confirmGiftId && !sending;

  const handleDragStart = useCallback(() => {
    dragMovedRef.current = false;
  }, []);

  const handleDrag = useCallback((_event, info) => {
    if (Math.abs(info.offset.y) > 6) {
      dragMovedRef.current = true;
    }
  }, []);

  const handleDragEnd = useCallback(
    (_event, info) => {
      const shouldClose =
        dragEnabled && (info.offset.y > 96 || info.velocity.y > 420);

      if (shouldClose) {
        animate(dragY, Math.max(info.offset.y + 140, 180), {
          duration: 0.24,
          ease: [0.32, 0, 0.67, 0],
        }).then(() => onClose?.());
      } else {
        animate(dragY, 0, {
          type: 'spring',
          stiffness: 420,
          damping: 40,
          mass: 0.82,
          velocity: info.velocity.y,
        });
      }

      window.setTimeout(() => {
        dragMovedRef.current = false;
      }, 0);
    },
    [dragEnabled, dragY, onClose]
  );

  const handleBackdropClick = useCallback(() => {
    if (dragMovedRef.current || confirmGiftId || sending) return;
    onClose?.();
  }, [confirmGiftId, onClose, sending]);

  const startDrag = useCallback(
    (event) => {
      if (!dragEnabled) return;
      dragControls.start(event);
    },
    [dragControls, dragEnabled]
  );

  return createPortal(
    <div
      className="profile-gift-modal__backdrop"
      role="presentation"
      onClick={handleBackdropClick}>
      <motion.div
        className="profile-gift-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-gift-modal-title"
        style={{ y: dragY }}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        drag={dragEnabled ? 'y' : false}
        dragControls={dragControls}
        dragListener={false}
        dragMomentum={false}
        dragElastic={{ top: 0.22, bottom: 0.38 }}
        dragConstraints={dragConstraints}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        onClick={(e) => e.stopPropagation()}>
        <div
          className={`profile-gift-modal__drag-zone${dragEnabled ? '' : ' profile-gift-modal__drag-zone--disabled'}`}
          onPointerDown={startDrag}
          aria-hidden={!dragEnabled}>
          <span className="profile-gift-modal__drag-pill" />
          <AppText as="span" className="profile-gift-modal__drag-hint">
            {t('gift_picker_drag_hint', 'Drag up or down · swipe down to close')}
          </AppText>
        </div>
        <header className="profile-gift-modal__header">
          <div className="profile-gift-modal__header-main">
            <div className="profile-gift-modal__title-row">
              <span className="profile-gift-modal__title-icon" aria-hidden>
                <FaGift />
              </span>
              <AppText as="h2" id="profile-gift-modal-title" className="profile-gift-modal__title">
                {t('gift_picker_title', 'Gifts')}
              </AppText>
            </div>
            <AppText as="p" className="profile-gift-modal__subtitle">
              {t('gift_picker_subtitle', {
                name: recipientLabel,
                defaultValue: `Send a gift to ${recipientLabel} and make their day special 💖`,
              })}
            </AppText>
          </div>

          <div className="profile-gift-modal__header-actions">
            <div className="profile-gift-modal__balance">
              <FaCoins className="profile-gift-modal__balance-coin" aria-hidden />
              <div>
                <AppText as="span" className="profile-gift-modal__balance-label">
                  {t('gift_your_balance', 'Your balance')}
                </AppText>
                <AppText as="span" className="profile-gift-modal__balance-value">
                  {balance.toLocaleString()} {t('credits_unit', 'credits')}
                </AppText>
              </div>
            </div>
            <button
              type="button"
              className="profile-gift-modal__topup"
              aria-label={t('buy_credits', 'Buy credits')}
              onClick={() => {
                onClose?.();
                navigate('/settings/credits');
              }}>
              <FaPlus aria-hidden />
            </button>
            <button
              type="button"
              className="profile-gift-modal__close"
              onClick={onClose}
              aria-label={t('close', 'Close')}>
              <FaTimes aria-hidden />
            </button>
          </div>
        </header>

        <div className="profile-gift-modal__body">
          <div className="profile-gift-modal__grid">
            {PROFILE_GIFTS.map((gift, index) => {
              const affordable = balance >= gift.credits;
              return (
                <button
                  key={gift.id}
                  type="button"
                  className={`profile-gift-modal__card${!affordable ? ' profile-gift-modal__card--low-balance' : ''}`}
                  onClick={() => setConfirmGiftId(gift.id)}
                  aria-label={t(gift.nameKey, gift.defaultName)}>
                  <span className="profile-gift-modal__card-index">{index + 1}</span>
                  <span
                    className="profile-gift-modal__card-icon-wrap"
                    style={{ '--gift-accent': gift.accent }}>
                    <ProfileGiftVisual
                      gift={gift}
                      size="card"
                      imgClassName="profile-gift-modal__card-icon"
                      iconClassName="profile-gift-modal__card-icon"
                    />
                  </span>
                  <AppText as="span" className="profile-gift-modal__card-name">
                    {t(gift.nameKey, gift.defaultName)}
                  </AppText>
                  <span className="profile-gift-modal__card-price">
                    <FaCoins aria-hidden />
                    {gift.credits}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        {confirmGiftId && confirmGift ? (
          <motion.div
            key={confirmGiftId}
            className="profile-gift-confirm__backdrop"
            role="presentation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={closeConfirm}>
            <motion.div
              className="profile-gift-confirm"
              role="dialog"
              aria-modal="true"
              aria-labelledby="profile-gift-confirm-desc"
              initial={{ opacity: 0, scale: 0.9, y: 28 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="profile-gift-confirm__close"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  closeConfirm();
                }}
                disabled={sending}
                aria-label={t('close', 'Close')}>
                <FaTimes aria-hidden />
              </button>

              <button
                type="button"
                className={`profile-gift-confirm__image-btn${sending ? ' profile-gift-confirm__image-btn--sending' : ''}${!confirmCanAfford ? ' profile-gift-confirm__image-btn--disabled' : ''}`}
                disabled={sending || !confirmCanAfford}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSend();
                }}
                aria-label={t('gift_send_btn', 'Send Gift')}>
                <div
                  className="profile-gift-confirm__glow"
                  style={{ '--gift-accent': confirmGift.accent }}
                  aria-hidden
                />
                <div className="profile-gift-confirm__ring-wrap" aria-hidden>
                  <motion.div
                    className="profile-gift-confirm__ring"
                    style={{ '--gift-accent': confirmGift.accent }}
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 1.08, opacity: 0 }}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                  />
                </div>
                <motion.div
                  className="profile-gift-confirm__icon-wrap"
                  style={{ '--gift-accent': confirmGift.accent }}
                  initial={{ scale: 0.15, opacity: 0, rotate: -18, y: 48 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0, y: 0 }}
                  exit={{ scale: 0.35, opacity: 0, rotate: 12, y: -56 }}
                  transition={{
                    type: 'spring',
                    stiffness: 340,
                    damping: 20,
                    mass: 0.85,
                  }}>
                  <ProfileGiftVisual
                    gift={confirmGift}
                    size="confirm-full"
                    imgClassName="profile-gift-confirm__icon"
                    iconClassName="profile-gift-confirm__icon"
                  />
                </motion.div>
              </button>

              <motion.div
                className="profile-gift-confirm__caption"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ delay: 0.08, duration: 0.22 }}>
                <AppText as="p" id="profile-gift-confirm-desc" className="profile-gift-confirm__desc">
                  {t(confirmGift.previewDescKey, confirmGift.defaultPreview)}
                </AppText>
                <span className="profile-gift-confirm__price">
                  <FaCoins aria-hidden />
                  {confirmGift.credits} {t('credits_unit', 'credits')}
                </span>

                {sending ? (
                  <AppText as="span" className="profile-gift-confirm__status">
                    {t('loading', 'Loading…')}
                  </AppText>
                ) : !confirmCanAfford ? (
                  <AppText as="span" className="profile-gift-confirm__warn">
                    {t('gift_insufficient_balance', 'Not enough credits in your purchase wallet.')}
                  </AppText>
                ) : null}
              </motion.div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>,
    document.body
  );
}
