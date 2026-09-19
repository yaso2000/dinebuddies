import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { AppText } from './base';
import './SwipeDeck.css';

/**
 * Browse-only swipe deck (view mode "Swipe"): one large card at a time, drag or use the
 * arrows to flip through `items`. No like/pass — it's a card-style way to browse the same
 * filtered list. Each item's own action buttons live inside the rendered card.
 *
 * @param {object} props
 * @param {Array<object>} props.items
 * @param {(item:object)=>React.ReactNode} props.renderCard
 * @param {string} [props.emptyLabel]
 * @param {string} [props.accent] — accent colour for the counter/arrows
 */
export default function SwipeDeck({ items, renderCard, emptyLabel, accent = 'var(--primary)' }) {
  const count = items ? items.length : 0;
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(0);

  // Keep the index valid when the filtered list changes under us.
  useEffect(() => {
    if (index > count - 1) setIndex(Math.max(0, count - 1));
  }, [count, index]);

  if (!items || count === 0) {
    return <div className="swipe-deck__empty">{emptyLabel}</div>;
  }

  const at = Math.min(index, count - 1);
  const go = (delta) => {
    const next = at + delta;
    if (next < 0 || next > count - 1) return;
    setDir(delta);
    setIndex(next);
  };

  return (
    <div className="swipe-deck">
      <div className="swipe-deck__stage">
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.div
            key={at}
            className="swipe-deck__card"
            custom={dir}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.5}
            onDragEnd={(e, info) => {
              if (info.offset.x < -80) go(1);
              else if (info.offset.x > 80) go(-1);
            }}
            initial={{ x: dir > 0 ? 320 : dir < 0 ? -320 : 0, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: dir > 0 ? -320 : 320, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}>
            {renderCard(items[at])}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="swipe-deck__nav">
        <button
          type="button"
          className="swipe-deck__arrow"
          disabled={at === 0}
          onClick={() => go(-1)}
          aria-label="Previous"
          style={{ color: accent }}>
          <FaChevronLeft />
        </button>
        <AppText as="span" className="swipe-deck__counter">{at + 1} / {count}</AppText>
        <button
          type="button"
          className="swipe-deck__arrow"
          disabled={at === count - 1}
          onClick={() => go(1)}
          aria-label="Next"
          style={{ color: accent }}>
          <FaChevronRight />
        </button>
      </div>
    </div>
  );
}
