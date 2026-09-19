import { motion } from 'framer-motion';
import { LuX } from 'react-icons/lu';
import { AppText } from '../base';
import { useMagneticCardDrag } from '../../hooks/useMagneticCardDrag';
import './discovery.css';

/**
 * Generic magnetic swipe card for the offers / jobs directories — same mechanics and
 * `discovery-card` look as BusinessSwipeCard (venues), differing only by `accent` colour.
 * The close (X) hands control back to the list/map via `onClose`.
 *
 * @param {object} props
 * @param {{id:string, coverImage?:string}} props.item  — deck item (id + coverImage for the next-card preview)
 * @param {boolean} props.isTop
 * @param {(item:object)=>void} props.onSkip
 * @param {(item:object)=>void} [props.onBack]
 * @param {string} props.accent
 * @param {string} [props.badge]
 * @param {string} props.title
 * @param {string} [props.subtitle]
 * @param {string} [props.description]
 * @param {Array<{key:string, icon:React.ComponentType, label:string}>} [props.chips]
 * @param {string} [props.ctaLabel]
 * @param {()=>void} [props.onCta]
 * @param {boolean} [props.ctaDisabled]
 * @param {()=>void} [props.onOpen]   — tap the photo to open the business
 * @param {()=>void} props.onClose    — X → back to list
 */
export default function DirectorySwipeCard({
  item,
  isTop = true,
  onSkip,
  onBack = null,
  accent = 'var(--primary)',
  badge = '',
  title,
  subtitle = '',
  description = '',
  chips = [],
  ctaLabel = '',
  onCta,
  ctaDisabled = false,
  onOpen,
  onClose,
}) {
  const { styleMotion, drag, dragConstraints, touchAction, handleDragStart, handleDragEnd, handleCardPointerUp } =
    useMagneticCardDrag({ isTop, onSkip, onBack, item, axis: 'y', onPhotoActivate: onOpen ? () => onOpen() : null });

  const cover = item?.coverImage || '';

  return (
    <motion.article
      className="discovery-card discovery-card--magnetic discovery-card--entity discovery-card--partner"
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
      onPointerUp={handleCardPointerUp}>
      <div className="discovery-card__glow" aria-hidden />
      <div className="discovery-card__frame" style={{ background: `linear-gradient(160deg, ${accent}55, #111 70%)` }}>
        {cover ? (
          <img
            src={cover}
            alt=""
            className="discovery-card__photo discovery-card__photo--profile"
            draggable={false}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        ) : null}
        <div className="discovery-card__gradient discovery-card__gradient--entity" aria-hidden />

        <div className="discovery-card__top-row">
          {badge ? (
            <AppText as="span" className="discovery-card__chip" style={{ background: accent, color: '#111', fontWeight: 800 }}>{badge}</AppText>
          ) : (
            <span className="discovery-card__location-spacer" aria-hidden />
          )}
          <button
            type="button"
            className="discovery-card__close discovery-card__action--glass"
            aria-label="Close"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onClose && onClose(); }}>
            <LuX size={22} aria-hidden />
          </button>
        </div>

        <div className="discovery-card__body">
          <div className="discovery-card__identity discovery-card__identity--stack">
            <AppText as="h2" className="discovery-card__name-line">{title}</AppText>
            {subtitle ? <AppText as="p" className="discovery-card__address">{subtitle}</AppText> : null}
            {description ? <AppText as="p" className="discovery-card__bio discovery-card__bio--entity">{description}</AppText> : null}
          </div>

          {chips.length > 0 && (
            <div className="discovery-card__meta-chips">
              {chips.map((chip) => {
                const Icon = chip.icon;
                return (
                  <AppText as="span" key={chip.key} className="discovery-card__chip">
                    {Icon ? <Icon aria-hidden /> : null} {chip.label}
                  </AppText>
                );
              })}
            </div>
          )}

          {ctaLabel && onCta ? (
            <button
              type="button"
              disabled={ctaDisabled}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onCta(); }}
              style={{
                marginTop: 12,
                padding: '13px',
                borderRadius: 14,
                border: 'none',
                background: accent,
                color: '#fff',
                fontWeight: 800,
                fontSize: '1rem',
                cursor: 'pointer',
                opacity: ctaDisabled ? 0.6 : 1,
              }}>
              {ctaLabel}
            </button>
          ) : null}
        </div>
      </div>
    </motion.article>
  );
}
