import React, { useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { animate, motion, useMotionValue } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { FaMapMarkerAlt, FaChevronRight } from 'react-icons/fa';
import { LuX } from 'react-icons/lu';
import './discovery.css';
import { AppText } from '../base';

const SWIPE_X_SKIP_THRESHOLD = 100;
const DOUBLE_ACTIVATE_MS = 320;
const DOUBLE_ACTIVATE_PX = 22;

/**
 * Magnetic full-bleed card for invitations / partners (same shell as Connect).
 */
export default function MagneticEntityCard({
  item,
  isTop = true,
  onSkip,
  listPath,
  openPath,
  openLabel,
  onOpen,
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const x = useMotionValue(0);
  const exitHandledRef = useRef(false);
  const draggingRef = useRef(false);
  const lastActivateRef = useRef({ at: 0, x: 0, y: 0 });

  const locationLabel = item?.locationLabel || '';
  const title = item?.title || '';
  const subtitle = item?.subtitle || '';

  const resetPosition = useCallback(() => {
    animate(x, 0, { type: 'spring', stiffness: 520, damping: 28 });
  }, [x]);

  const triggerSkip = useCallback(() => {
    if (exitHandledRef.current) return;
    exitHandledRef.current = true;
    animate(x, -560, { duration: 0.22, ease: 'easeIn' }).then(() => {
      onSkip?.(item);
    });
  }, [item, onSkip, x]);

  const handleDragStart = () => {
    draggingRef.current = true;
  };

  const handleDragEnd = (_, info) => {
    window.setTimeout(() => {
      draggingRef.current = false;
    }, 50);

    if (!isTop) return;
    const { offset, velocity } = info;

    if (offset.x < -SWIPE_X_SKIP_THRESHOLD || velocity.x < -450) {
      triggerSkip();
      return;
    }
    resetPosition();
  };

  const isInteractiveTarget = useCallback((target) => {
    if (!target?.closest) return false;
    return Boolean(
      target.closest(
        '.discovery-card__actions, .discovery-card__close, .discovery-card__cta, button, a'
      )
    );
  }, []);

  const handleNavigateActivate = useCallback(
    (clientX, clientY) => {
      if (!isTop || exitHandledRef.current || draggingRef.current) return;

      const now = Date.now();
      const prev = lastActivateRef.current;
      const dt = now - prev.at;
      const dist = Math.hypot(clientX - prev.x, clientY - prev.y);

      if (prev.at && dt <= DOUBLE_ACTIVATE_MS && dist <= DOUBLE_ACTIVATE_PX) {
        lastActivateRef.current = { at: 0, x: 0, y: 0 };
        triggerSkip();
        return;
      }

      lastActivateRef.current = { at: now, x: clientX, y: clientY };
    },
    [isTop, triggerSkip]
  );

  const handleCardPointerUp = useCallback(
    (e) => {
      if (!isTop) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (isInteractiveTarget(e.target)) return;
      handleNavigateActivate(e.clientX, e.clientY);
    },
    [handleNavigateActivate, isInteractiveTarget, isTop]
  );

  const handleClose = (e) => {
    e.stopPropagation();
    if (listPath) navigate(listPath, { replace: true });
  };

  const handleOpen = (e) => {
    e.stopPropagation();
    if (onOpen) {
      onOpen(item);
      return;
    }
    if (openPath) navigate(openPath);
  };

  return (
    <motion.article
      className="discovery-card discovery-card--magnetic"
      style={{ x, zIndex: isTop ? 2 : 1, touchAction: 'pan-y' }}
      drag={isTop ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.85}
      dragMomentum={false}
      initial={isTop ? { scale: 0.92, opacity: 0.65 } : false}
      animate={isTop ? { scale: 1, opacity: 1 } : undefined}
      transition={{ type: 'spring', stiffness: 380, damping: 26 }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onPointerUp={handleCardPointerUp}
      title={isTop ? t('discovery_double_tap_next', 'Double-click or double-tap for next') : undefined}
    >
      <div className="discovery-card__glow" aria-hidden />

      <div className="discovery-card__frame">
        <img
          src={item.coverImage}
          alt=""
          className="discovery-card__photo discovery-card__photo--profile"
          draggable={false}
        />

        <div className="discovery-card__gradient" aria-hidden />

        <div className="discovery-card__top-row">
          {locationLabel ? (
            <div className="discovery-card__location-bar">
              <FaMapMarkerAlt className="discovery-card__location-pin" aria-hidden />
              <AppText as="span" className="discovery-card__location-text">
                {locationLabel}
              </AppText>
            </div>
          ) : (
            <span className="discovery-card__location-spacer" aria-hidden />
          )}

          {listPath ? (
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
          ) : null}
        </div>

        <div className="discovery-card__identity">
          <AppText as="h2" className="discovery-card__name-line">
            {title}
          </AppText>
          {subtitle ? (
            <AppText as="p" className="discovery-card__bio">
              {subtitle}
            </AppText>
          ) : null}
        </div>

        <div className="discovery-card__actions discovery-card__actions--rail discovery-card__actions--entity">
          <button
            type="button"
            className="discovery-card__cta discovery-card__action discovery-card__action--glass discovery-card__action--open"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={handleOpen}
          >
            <AppText as="span">{openLabel || t('view', 'View')}</AppText>
            <FaChevronRight size={16} aria-hidden />
          </button>
        </div>
      </div>
    </motion.article>
  );
}
