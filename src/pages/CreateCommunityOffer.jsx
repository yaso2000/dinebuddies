import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { FaArrowLeft, FaArrowRight, FaBullhorn, FaLock, FaCamera, FaTimes } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getBusinessPlanAccess } from '../config/businessPlanFeatures';
import { sendCommunityOffer } from '../services/communityMemberApi';
import { getCallableErrorReason } from '../utils/callableErrorDetails';
import { uploadImage, validateImageFile } from '../utils/imageUpload';
import { OFFER_BG_PRESETS, DEFAULT_OFFER_BG, offerBannerStyle } from '../utils/offerBanner';
import { AppText, AppTextInput } from '../components/base';
import '../components/CommunityManagement.css';
import './CreateCommunityOffer.css';

/**
 * Unified "Special offer" creation, launched from the business "+" menu (kept out
 * of the community page to reduce clutter). One flow with channel choices; members
 * take/redeem it elsewhere.
 */
export default function CreateCommunityOffer() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { userProfile, currentUser } = useAuth();
  const { showToast } = useToast();
  const fileRef = useRef(null);
  const BackIcon = i18n.dir() === 'rtl' ? FaArrowRight : FaArrowLeft;

  const canSendOffers = getBusinessPlanAccess(userProfile?.subscriptionTier).canUseMemberNotifications === true;

  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [once, setOnce] = useState(true);
  const [expiry, setExpiry] = useState('');
  const [notify, setNotify] = useState(true);
  const [feed, setFeed] = useState(true);
  const [swipe, setSwipe] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [bgColor, setBgColor] = useState(DEFAULT_OFFER_BG);
  const [sending, setSending] = useState(false);

  const businessName =
    userProfile?.businessInfo?.businessName || userProfile?.display_name || t('your_business', 'Your business');

  const handlePickImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const v = validateImageFile(file, 15);
    if (!v.valid) {
      showToast(v.error || t('image_invalid', 'Invalid image.'), 'error');
      return;
    }
    setUploading(true);
    try {
      const url = await uploadImage(file, `community-offers/${currentUser?.uid || 'anon'}/${Date.now()}`);
      setImageUrl(typeof url === 'string' ? url : url?.url || '');
    } catch (e2) {
      showToast(t('image_upload_failed', 'Could not upload the image.'), 'error');
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    const ttl = title.trim();
    if (!ttl) {
      showToast(t('offer_title_required', 'Add an offer title first.'), 'error');
      return;
    }
    if (!notify && !feed && !swipe) {
      showToast(t('offer_pick_channel', 'Pick at least one: notify members, feed, or swipe card.'), 'error');
      return;
    }
    setSending(true);
    try {
      const expiresAt = expiry ? new Date(`${expiry}T23:59:59`).getTime() : undefined;
      const res = await sendCommunityOffer({
        title: ttl,
        description: desc.trim(),
        oncePerMember: once,
        expiresAt,
        notifyMembers: notify,
        onFeed: feed,
        onSwipe: swipe,
        imageUrl: imageUrl || undefined,
        bgColor,
      });
      showToast(
        t('offer_sent_count', 'Offer sent to {{count}} members', { count: res?.sent || 0 }),
        'success'
      );
      navigate('/business-dashboard/inbox');
    } catch (e) {
      const reason = getCallableErrorReason(e);
      showToast(
        reason === 'permission-denied'
          ? t('offer_paid_only', 'Sending member offers is a paid feature.')
          : t('offer_send_failed', 'Could not send the offer. Please try again.'),
        'error'
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="page-container" style={{ padding: '1rem', maxWidth: 640, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1rem' }}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label={t('back', 'Back')}
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-main)', cursor: 'pointer', flexShrink: 0 }}>
          <BackIcon />
        </button>
        <AppText as="h2" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <FaBullhorn aria-hidden />
          {t('business_create_offer_title', 'Special offer')}
        </AppText>
      </div>

      <div className="cm-offer-box">
        {canSendOffers ? (
          <>
            {/* Live banner preview */}
            <div className="offer-banner offer-banner--preview" style={offerBannerStyle({ imageUrl, bgColor })}>
              <div className="offer-banner__content">
                <div className="offer-banner__business">{businessName}</div>
                <div className="offer-banner__title">{title || t('offer_preview_placeholder', 'Your offer title')}</div>
                {desc ? <div className="offer-banner__desc">{desc}</div> : null}
              </div>
              <span className="offer-banner__take">{t('offer_take_it', 'Take it')}</span>
            </div>

            {/* Image + background pickers */}
            <div className="offer-create-look">
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={handlePickImage} />
              <button
                type="button"
                className="offer-create-look__img-btn"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}>
                <FaCamera aria-hidden />
                {uploading ? t('uploading', 'Uploading…') : imageUrl ? t('change_image', 'Change image') : t('add_image', 'Add image')}
              </button>
              {imageUrl ? (
                <button type="button" className="offer-create-look__img-remove" onClick={() => setImageUrl('')}>
                  <FaTimes aria-hidden /> {t('remove_image', 'Remove image')}
                </button>
              ) : null}
              <div className="offer-create-look__colors">
                {OFFER_BG_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    aria-label={p.id}
                    className={`offer-create-look__swatch${bgColor === p.css ? ' is-active' : ''}`}
                    style={{ background: p.css }}
                    onClick={() => setBgColor(p.css)} />
                ))}
              </div>
              <AppText as="p" className="offer-create-look__hint">
                {t('offer_look_hint', 'Add an image for a photo banner, or pick a background colour.')}
              </AppText>
            </div>

            <AppTextInput
              type="text"
              className="ui-form-field cm-offer-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder={t('offer_title_placeholder', 'Offer, e.g. 20% off for members today')} />
            <textarea
              className="ui-form-field cm-offer-textarea"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder={t('offer_desc_placeholder', 'Optional details (validity, conditions)…')} />
            <div className="cm-offer-options">
              <AppText as="div" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                {t('offer_channels_label', 'Where to publish')}
              </AppText>
              <label className="cm-offer-once">
                <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
                {t('offer_channel_notify', 'Notify all members')}
              </label>
              <label className="cm-offer-once">
                <input type="checkbox" checked={feed} onChange={(e) => setFeed(e.target.checked)} />
                {t('offer_channel_feed', 'Publish on the offers feed')}
              </label>
              <label className="cm-offer-once">
                <input type="checkbox" checked={swipe} onChange={(e) => setSwipe(e.target.checked)} />
                {t('offer_channel_swipe', 'Show on swipe card')}
              </label>
              <label className="cm-offer-once">
                <input type="checkbox" checked={once} onChange={(e) => setOnce(e.target.checked)} />
                {t('offer_once_per_member', 'One redemption per member')}
              </label>
              <label className="cm-offer-expiry">
                <span>{t('offer_valid_until', 'Valid until (optional)')}</span>
                <input type="date" className="ui-form-field" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
              </label>
            </div>
            <button
              type="button"
              className="cm-offer-send-btn"
              onClick={submit}
              disabled={sending || !title.trim()}>
              {sending ? t('sending', 'Sending…') : t('send_offer', 'Send offer')}
            </button>
            <AppText as="p" className="cm-offer-hint">
              {t('offer_verify_hint', 'Members redeem by showing their QR — scan it in Community to confirm before applying the discount.')}
            </AppText>
          </>
        ) : (
          <div className="cm-offer-locked">
            <FaLock aria-hidden className="cm-offer-locked-icon" />
            <AppText as="p" className="cm-offer-locked-text">
              {t('offer_paid_upsell', 'Broadcasting offers to your community members is a paid feature.')}
            </AppText>
            <Link to="/settings/subscription" className="cm-offer-upgrade-btn">
              {t('upgrade_to_paid', 'Upgrade plan')}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
