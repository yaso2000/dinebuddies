import React, { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaCamera, FaTimes } from 'react-icons/fa';
import { useToast } from '../../context/ToastContext';
import { uploadProfileGalleryPhoto } from '../../utils/imageUpload';
import { notifyImageUploadError } from '../../utils/imageModerationErrors';
import { normalizeProfileGallery } from '../../utils/profileGallery';
import ProfileGalleryLightbox from './ProfileGalleryLightbox';
import './ProfileGalleryEditor.css';
import './ProfileGalleryLightbox.css';
import { AppText } from '../base';

/**
 * Extra profile photos (9:16) shown on the profile page only.
 * Discover swipe uses `photo_url`; member cards use `cover_photo`.
 */
export default function ProfileGalleryEditor({
  userId,
  slots: slotsProp,
  editable = false,
  onChange,
  theme = 'default',
}) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const baseId = useId();
  const slots = normalizeProfileGallery(slotsProp);
  const [uploadingSlot, setUploadingSlot] = useState(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxPos, setLightboxPos] = useState(0);

  const filledIndices = useMemo(
    () => slots.reduce((acc, url, index) => (url ? [...acc, index] : acc), []),
    [slots]
  );

  const emitChange = (nextSlots) => {
    onChange?.({
      profileGallery: nextSlots,
      directoryCoverIndex: nextSlots.findIndex(Boolean) >= 0 ? nextSlots.findIndex(Boolean) : 0,
    });
  };

  const handleUpload = async (slotIndex, file) => {
    if (!editable || !userId || !file) return;

    const type = String(file.type || '').toLowerCase();
    const name = String(file.name || '').toLowerCase();
    const looksImage =
      type.startsWith('image/') ||
      !type ||
      type === 'application/octet-stream' ||
      /\.(jpe?g|png|webp|heic|heif)$/i.test(name);
    if (!looksImage) {
      showToast(t('only_images_allowed', 'Please select an image file.'), 'error');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      showToast(t('file_too_large_5mb', 'File too large. Max 25MB'), 'error');
      return;
    }

    setUploadingSlot(slotIndex);
    try {
      const url = await uploadProfileGalleryPhoto(file, userId);
      const nextSlots = [...slots];
      nextSlots[slotIndex] = url;
      emitChange(nextSlots);
      showToast(t('profile_gallery_photo_added', 'Photo added to gallery'), 'success');
    } catch (error) {
      console.error('Gallery upload failed:', error);
      notifyImageUploadError(showToast, error, t, 'failed_upload_image');
    } finally {
      setUploadingSlot(null);
    }
  };

  const handleRemove = (slotIndex) => {
    if (!editable) return;
    const nextSlots = [...slots];
    nextSlots[slotIndex] = '';
    emitChange(nextSlots);
  };

  const openLightbox = (slotIndex) => {
    const pos = filledIndices.indexOf(slotIndex);
    if (pos < 0) return;
    setLightboxPos(pos);
    setLightboxOpen(true);
  };

  const filledCount = slots.filter(Boolean).length;
  if (!editable && filledCount === 0) {
    return null;
  }

  return (
    <section
      className={`profile-gallery${editable ? '' : ' profile-gallery--view'}${theme === 'dark' ? ' profile-gallery--dark' : ''}`}
    >
      <AppText as="h3" className="profile-gallery__title">
        {t('profile_gallery_title', 'Photo gallery')}
      </AppText>
      {editable ? (
        <AppText as="p" className="profile-gallery__hint">
          {t(
            'profile_gallery_hint',
            'Add up to 3 extra portrait photos on your profile. Swipe Discover uses your profile photo; the member list uses your cover photo.'
          )}
        </AppText>
      ) : null}

      <div className="profile-gallery__grid">
        {slots.map((url, index) => {
          const inputId = `${baseId}-slot-${index}`;
          const isUploading = uploadingSlot === index;

          return (
            <div
              key={index}
              className={`profile-gallery__slot${url ? ' profile-gallery__slot--filled' : ''}`}
            >
              {url ? (
                <>
                  <button
                    type="button"
                    className="profile-gallery__img-btn"
                    onClick={() => openLightbox(index)}
                    aria-label={t('profile_gallery_view_photo', 'View photo')}
                  >
                    <img src={url} alt="" className="profile-gallery__img" loading="lazy" />
                  </button>
                  {editable ? (
                    <div className="profile-gallery__actions">
                      <button
                        type="button"
                        className="profile-gallery__btn"
                        onClick={() => handleRemove(index)}
                        title={t('remove', 'Remove')}
                        aria-label={t('remove', 'Remove')}
                      >
                        <FaTimes size={12} />
                      </button>
                    </div>
                  ) : null}
                </>
              ) : editable ? (
                <label className="profile-gallery__empty" htmlFor={inputId}>
                  <FaCamera size={18} aria-hidden />
                  <AppText as="span">{t('profile_gallery_add_photo', 'Add photo')}</AppText>
                  <input
                    id={inputId}
                    type="file"
                    accept="image/*"
                    hidden
                    disabled={isUploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (file) handleUpload(index, file);
                    }}
                  />
                </label>
              ) : (
                <div className="profile-gallery__empty" aria-hidden />
              )}

              {isUploading ? (
                <div className="profile-gallery__uploading">{t('uploading', 'Uploading...')}</div>
              ) : null}
            </div>
          );
        })}
      </div>

      <ProfileGalleryLightbox
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        slots={slots}
        filledIndices={filledIndices}
        initialPos={lightboxPos}
      />
    </section>
  );
}
