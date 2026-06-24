import React, { useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { FaChevronLeft, FaChevronRight, FaTimes } from 'react-icons/fa';
import { AppText } from '../base';

export default function ProfileGalleryLightbox({
  open,
  onClose,
  slots,
  filledIndices,
  initialPos = 0,
}) {
  const { t } = useTranslation();
  const [pos, setPos] = React.useState(initialPos);

  useEffect(() => {
    if (open) setPos(initialPos);
  }, [open, initialPos]);

  const count = filledIndices.length;
  const slotIndex = filledIndices[pos] ?? 0;
  const currentUrl = slots[slotIndex];

  const goPrev = useCallback(() => {
    setPos((p) => (p - 1 + count) % count);
  }, [count]);

  const goNext = useCallback(() => {
    setPos((p) => (p + 1) % count);
  }, [count]);

  useEffect(() => {
    if (!open) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, goPrev, goNext]);

  if (!open || !currentUrl) return null;

  return createPortal(
    <div
      className="profile-gallery-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={t('profile_gallery_title', 'Photo gallery')}
      onClick={onClose}>
      <button
        type="button"
        className="profile-gallery-lightbox__close"
        onClick={onClose}
        aria-label={t('close', 'Close')}>
        <FaTimes size={18} />
      </button>

      {count > 1 &&
      <>
          <button
          type="button"
          className="profile-gallery-lightbox__nav profile-gallery-lightbox__nav--prev"
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
          aria-label={t('previous', 'Previous')}>
          
            <FaChevronLeft size={18} />
          </button>
          <button
          type="button"
          className="profile-gallery-lightbox__nav profile-gallery-lightbox__nav--next"
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          aria-label={t('next', 'Next')}>
          
            <FaChevronRight size={18} />
          </button>
        </>
      }

      <div className="profile-gallery-lightbox__content" onClick={(e) => e.stopPropagation()}>
        <img src={currentUrl} alt="" className="profile-gallery-lightbox__img" />

        <div className="profile-gallery-lightbox__footer">
          {count > 1 &&
          <AppText as="span" className="profile-gallery-lightbox__counter">
              {pos + 1} / {count}
            </AppText>
          }
        </div>
      </div>
    </div>,
    document.body
  );
}
