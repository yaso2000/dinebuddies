import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import ProfileGiftVisual from '../gifts/ProfileGiftVisual';
import { getProfileGiftById } from '../../constants/profileGifts';
import { AppText } from '../base';
import './SocialPingOverlay.css';

export default function SocialPingOverlay({ ping, onDismiss }) {
  const { t } = useTranslation();
  const open = Boolean(ping);
  const senderName = String(ping?.senderName || '').trim() || t('someone', 'Someone');
  const isGift = ping?.type === 'gift';
  const gift = isGift
    ? getProfileGiftById(ping?.giftId) || getProfileGiftById('gift_box')
    : null;
  const giftLabel = gift
    ? t(gift.nameKey, gift.defaultName)
    : t('gift_box_name', 'Gift');

  const title = isGift
    ? t('social_ping_gift_title', 'You received a gift!')
    : t('social_ping_wave_title', 'Someone waved at you!');

  const subtitle = isGift
    ? t('social_ping_gift_subtitle', {
        name: senderName,
        gift: giftLabel,
        defaultValue: '{{name}} sent you {{gift}}',
      })
    : t('social_ping_wave_subtitle', {
        name: senderName,
        defaultValue: '{{name}} waved hello to you',
      });

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="social-ping"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onDismiss}
          role="dialog"
          aria-live="assertive"
          aria-label={title}>
          <motion.div
            className="social-ping__stage"
            initial={{ opacity: 0, scale: 0.88, y: 28 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ type: 'spring', stiffness: 360, damping: 26 }}>
            <div
              className={`social-ping__visual-wrap${
                isGift ? ' social-ping__visual-wrap--gift' : ' social-ping__visual-wrap--wave'
              }`}
              style={
                isGift && gift?.accent
                  ? { '--social-ping-glow': gift.accent }
                  : undefined
              }>
              {isGift ? (
                <motion.div
                  className="social-ping__gift-visual"
                  animate={{ y: [0, -10, 0], scale: [1, 1.06, 1] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}>
                  <ProfileGiftVisual gift={gift} size="ping" />
                </motion.div>
              ) : (
                <motion.span
                  className="social-ping__wave"
                  aria-hidden
                  animate={{ rotate: [0, 18, -12, 18, 0] }}
                  transition={{ duration: 0.9, repeat: Infinity, repeatDelay: 0.35 }}>
                  👋
                </motion.span>
              )}
            </div>

            <AppText as="h2" className="social-ping__title" format={false}>
              {title}
            </AppText>
            <AppText as="p" className="social-ping__subtitle" format={false}>
              {subtitle}
            </AppText>
            <AppText as="p" className="social-ping__hint" format={false}>
              {t('social_ping_tap_dismiss', 'Tap anywhere to dismiss')}
            </AppText>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
