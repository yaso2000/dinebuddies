import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { FaComments, FaHeart, FaHandshake, FaTimes, FaUserFriends } from 'react-icons/fa';
import { getSafeAvatar } from '../../utils/avatarUtils';
import { AppText } from '../base';
import './MatchCelebrationOverlay.css';

function normalizeCelebrationType(type) {
  if (type === 'like') return 'dating';
  if (type === 'follow') return 'friendship';
  if (type === 'dating' || type === 'acquaintance' || type === 'friendship') return type;
  return 'acquaintance';
}

/**
 * Full-screen connection celebration — dating, acquaintance, or friendship.
 */
export default function MatchCelebrationOverlay({
  open,
  type = 'dating',
  selfUser,
  otherUser,
  otherName = '',
  onChat,
  onClose,
}) {
  const { t } = useTranslation();
  const celebrationType = normalizeCelebrationType(type);

  const selfAvatar = getSafeAvatar(selfUser);
  const otherAvatar = getSafeAvatar(otherUser);
  const label = otherName.trim() || t('user', 'User');

  const titleByType = {
    dating: t('discovery_match_dating_title', 'Dating match!'),
    acquaintance: t('discovery_match_acquaintance_title', 'New acquaintance!'),
    friendship: t('discovery_match_friendship_title', 'New friendship!'),
  };

  const subtitleByType = {
    dating: t('discovery_match_dating_subtitle', {
      name: label,
      defaultValue: `You and ${label} connected for dating`,
    }),
    acquaintance: t('discovery_match_acquaintance_subtitle', {
      name: label,
      defaultValue: `You and ${label} connected`,
    }),
    friendship: t('discovery_match_friendship_subtitle', {
      name: label,
      defaultValue: `You and ${label} became friends`,
    }),
  };

  const title = titleByType[celebrationType];
  const subtitle = subtitleByType[celebrationType];

  const renderBadgeIcon = () => {
    if (celebrationType === 'dating') {
      return (
        <motion.span
          animate={{ scale: [1, 1.14, 1] }}
          transition={{ duration: 0.9, repeat: Infinity, repeatDelay: 0.6 }}
        >
          <FaHeart className="match-celebration__badge-icon" />
        </motion.span>
      );
    }
    if (celebrationType === 'friendship') {
      return <FaUserFriends className="match-celebration__badge-icon" />;
    }
    return <FaHandshake className="match-celebration__badge-icon" />;
  };

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="match-celebration"
          role="dialog"
          aria-modal="true"
          aria-labelledby="match-celebration-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
        >
          <button
            type="button"
            className="match-celebration__close"
            onClick={onClose}
            aria-label={t('discovery_match_close', 'Close')}
          >
            <FaTimes aria-hidden />
          </button>

          <motion.div
            className={`match-celebration__stage match-celebration__stage--${celebrationType}`}
            initial={{ opacity: 0, scale: 0.88, y: 28 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ type: 'spring', stiffness: 340, damping: 26 }}
          >
            <AppText as="p" className="match-celebration__eyebrow" id="match-celebration-title">
              {title}
            </AppText>

            <div className="match-celebration__duo">
              <motion.div
                className="match-celebration__avatar-wrap match-celebration__avatar-wrap--self"
                initial={{ x: 28, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.08, type: 'spring', stiffness: 280, damping: 22 }}
              >
                <img src={selfAvatar} alt="" className="match-celebration__avatar" draggable={false} />
              </motion.div>

              <motion.div
                className={`match-celebration__badge match-celebration__badge--${celebrationType}`}
                initial={{ scale: 0.2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.14, type: 'spring', stiffness: 420, damping: 18 }}
                aria-hidden
              >
                {renderBadgeIcon()}
              </motion.div>

              <motion.div
                className="match-celebration__avatar-wrap match-celebration__avatar-wrap--other"
                initial={{ x: -28, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.08, type: 'spring', stiffness: 280, damping: 22 }}
              >
                <img src={otherAvatar} alt="" className="match-celebration__avatar" draggable={false} />
              </motion.div>
            </div>

            <AppText as="p" className="match-celebration__subtitle">{subtitle}</AppText>

            <button
              type="button"
              className="match-celebration__chat-btn"
              onClick={() => {
                onChat?.();
                onClose?.();
              }}
            >
              <FaComments aria-hidden />
              {t('discovery_match_chat_btn', 'Send message')}
            </button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
