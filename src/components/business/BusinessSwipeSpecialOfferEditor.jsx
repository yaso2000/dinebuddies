import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaTag, FaTrash } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  clearBusinessSwipeSpecialOffer,
  saveBusinessSwipeSpecialOffer,
} from '../../services/businessSwipeSpecialOfferService';
import {
  formatSwipeOfferDateRange,
  getActiveSwipeSpecialOffer,
  normalizeSwipeSpecialOffer,
  toDateInputValue,
} from '../../utils/businessSwipeSpecialOffer';
import { AppText, AppTextInput } from '../base';
import './BusinessSwipeSpecialOfferEditor.css';

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Paid Business: configure the special offer shown on /restaurants swipe cards.
 */
export default function BusinessSwipeSpecialOfferEditor() {
  const { t, i18n } = useTranslation();
  const { userProfile } = useAuth();
  const { showToast } = useToast();

  const existing = useMemo(
    () => normalizeSwipeSpecialOffer(userProfile?.businessInfo?.swipeSpecialOffer),
    [userProfile?.businessInfo?.swipeSpecialOffer]
  );

  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState(todayInputValue());
  const [endDate, setEndDate] = useState(todayInputValue());
  const [imageUrl, setImageUrl] = useState(null);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [clearImage, setClearImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    setTitle(existing?.title || '');
    setStartDate(existing?.startDate || todayInputValue());
    setEndDate(existing?.endDate || todayInputValue());
    setImageUrl(existing?.imageUrl || null);
    setFile(null);
    setPreviewUrl(null);
    setClearImage(false);
  }, [existing?.title, existing?.startDate, existing?.endDate, existing?.imageUrl]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const displayImage = clearImage ? null : previewUrl || imageUrl;
  const draftOffer = normalizeSwipeSpecialOffer({
    title,
    imageUrl: displayImage,
    startDate,
    endDate,
  });
  const isLive = Boolean(getActiveSwipeSpecialOffer(existing));

  const handleSave = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await saveBusinessSwipeSpecialOffer(
        {
          title,
          startDate: toDateInputValue(startDate),
          endDate: toDateInputValue(endDate),
          imageUrl,
          clearImage,
        },
        file
      );
      showToast(t('swipe_offer_saved', 'Special offer saved for swipe cards.'), 'success');
      setFile(null);
      setClearImage(false);
    } catch (err) {
      console.error('[BusinessSwipeSpecialOfferEditor] save', err);
      showToast(
        err?.message || t('swipe_offer_save_failed', 'Could not save the special offer.'),
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (clearing || !existing) return;
    setClearing(true);
    try {
      await clearBusinessSwipeSpecialOffer();
      showToast(t('swipe_offer_cleared', 'Special offer removed.'), 'success');
    } catch (err) {
      console.error('[BusinessSwipeSpecialOfferEditor] clear', err);
      showToast(
        err?.message || t('swipe_offer_clear_failed', 'Could not remove the special offer.'),
        'error'
      );
    } finally {
      setClearing(false);
    }
  };

  return (
    <section id="business-swipe-special-offer" className="swipe-offer-editor">
      <div className="swipe-offer-editor__head">
        <AppText as="h3" className="swipe-offer-editor__title">
          <FaTag aria-hidden />
          {t('swipe_offer_title', 'Swipe card special offer')}
        </AppText>
        <AppText as="p" className="swipe-offer-editor__hint">
          {t(
            'swipe_offer_hint',
            'Paid feature: bold title and dates on your business swipe card. Image is optional.'
          )}
        </AppText>
        {existing ? (
          <AppText
            as="span"
            className={`swipe-offer-editor__status${isLive ? ' swipe-offer-editor__status--live' : ''}`}
          >
            {isLive
              ? t('swipe_offer_status_live', 'Live on swipe cards')
              : t('swipe_offer_status_scheduled', 'Saved — outside active dates')}
          </AppText>
        ) : null}
      </div>

      <div className="swipe-offer-editor__preview" aria-hidden={!draftOffer}>
        {draftOffer ? (
          <div
            className={`swipe-offer-chip swipe-offer-chip--preview${
              displayImage ? ' swipe-offer-chip--with-image' : ' swipe-offer-chip--text-only'
            }`}
          >
            {displayImage ? (
              <img src={displayImage} alt="" className="swipe-offer-chip__img" />
            ) : null}
            <div className="swipe-offer-chip__copy">
              <AppText as="span" className="swipe-offer-chip__title">
                {draftOffer.title}
              </AppText>
              <AppText as="span" className="swipe-offer-chip__dates">
                {formatSwipeOfferDateRange(draftOffer, i18n.language)}
              </AppText>
            </div>
          </div>
        ) : (
          <AppText as="p" className="swipe-offer-editor__preview-empty">
            {t('swipe_offer_preview_empty', 'Preview appears when title and dates are set.')}
          </AppText>
        )}
      </div>

      <form className="swipe-offer-editor__form" onSubmit={handleSave}>
        <label className="swipe-offer-editor__field">
          <AppText as="span">{t('swipe_offer_title_label', 'Offer title')}</AppText>
          <AppTextInput
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            required
            placeholder={t('swipe_offer_title_ph', 'e.g. Weekend brunch 2-for-1')}
          />
        </label>

        <div className="swipe-offer-editor__dates">
          <label className="swipe-offer-editor__field">
            <AppText as="span">{t('swipe_offer_start', 'Starts')}</AppText>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </label>
          <label className="swipe-offer-editor__field">
            <AppText as="span">{t('swipe_offer_end', 'Ends')}</AppText>
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </label>
        </div>

        <label className="swipe-offer-editor__field">
          <AppText as="span">
            {t('swipe_offer_image_optional', 'Image (optional)')}
          </AppText>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const next = e.target.files?.[0] || null;
              setFile(next);
              if (next) setClearImage(false);
            }}
          />
        </label>

        {(displayImage || imageUrl) && !clearImage ? (
          <button
            type="button"
            className="swipe-offer-editor__link-btn"
            onClick={() => {
              setFile(null);
              setClearImage(true);
              setImageUrl(null);
            }}
          >
            {t('swipe_offer_remove_image', 'Remove image — text-only layout')}
          </button>
        ) : null}

        <div className="swipe-offer-editor__actions">
          <button type="submit" className="ui-btn ui-btn--primary" disabled={saving}>
            {saving
              ? t('saving', 'Saving…')
              : t('swipe_offer_save', 'Save special offer')}
          </button>
          {existing ? (
            <button
              type="button"
              className="ui-btn swipe-offer-editor__clear"
              disabled={clearing || saving}
              onClick={handleClear}
            >
              <FaTrash aria-hidden />
              {clearing ? t('removing', 'Removing…') : t('swipe_offer_clear', 'Remove offer')}
            </button>
          ) : null}
        </div>
      </form>
    </section>
  );
}
