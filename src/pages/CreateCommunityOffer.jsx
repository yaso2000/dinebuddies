import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { FaArrowLeft, FaArrowRight, FaBullhorn, FaLock, FaCamera, FaTimes, FaCoins } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getBusinessPlanAccess } from '../config/businessPlanFeatures';
import { sendCommunityOffer, listCommunityOffers } from '../services/communityMemberApi';
import { getSpendableCredits } from '../utils/walletCredits';
import { getCallableErrorReason } from '../utils/callableErrorDetails';
import { uploadOfferImage, validateImageFile } from '../utils/imageUpload';
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
  // Included offer must explicitly choose 'date' or 'open'; paid extras force 'date'.
  const [expiryMode, setExpiryMode] = useState('');
  const [notify, setNotify] = useState(true);
  const [feed, setFeed] = useState(true);
  const [swipe, setSwipe] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [imgPos, setImgPos] = useState({ x: 50, y: 50 });
  const [imgZoom, setImgZoom] = useState(1);
  const [bgColor, setBgColor] = useState(DEFAULT_OFFER_BG);
  const [sending, setSending] = useState(false);
  // How many active offers the business already has (to price this one).
  const [activeCount, setActiveCount] = useState(null);
  // Whether an active offer already occupies the swipe card (only one allowed).
  const [swipeTaken, setSwipeTaken] = useState(false);
  const dragRef = useRef(null); // { startX, startY, baseX, baseY }

  const EXTRA_OFFER_CREDITS_PER_DAY = 150;

  // The plan includes one active offer; anything beyond that is a prepaid extra.
  const isExtra = activeCount != null && activeCount >= 1;
  const spendable = getSpendableCredits(userProfile);
  const expiryDays = (() => {
    if (!expiry) return 0;
    const end = new Date(`${expiry}T23:59:59`).getTime();
    const diff = end - Date.now();
    return diff > 0 ? Math.max(1, Math.ceil(diff / 86400000)) : 0;
  })();
  const extraCost = isExtra ? EXTRA_OFFER_CREDITS_PER_DAY * expiryDays : 0;
  const canAfford = !isExtra || (expiryDays > 0 && spendable >= extraCost);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await listCommunityOffers({ activeOnly: true });
        if (!cancelled) {
          setActiveCount(Array.isArray(list) ? list.length : 0);
          const taken = Array.isArray(list) && list.some((o) => o.onSwipe);
          setSwipeTaken(taken);
          if (taken) setSwipe(false);
        }
      } catch {
        if (!cancelled) setActiveCount(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Paid extras cannot be open-ended: force the date mode.
  useEffect(() => {
    if (isExtra && expiryMode !== 'date') setExpiryMode('date');
  }, [isExtra, expiryMode]);

  const businessName =
    userProfile?.businessInfo?.businessName || userProfile?.display_name || t('your_business', 'Your business');

  // Upload the full image (moderated); focus is set in-place on the banner below.
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
      const url = await uploadOfferImage(file, currentUser?.uid);
      setImageUrl(typeof url === 'string' ? url : url?.url || '');
      setImgPos({ x: 50, y: 50 });
      setImgZoom(1);
    } catch (e2) {
      showToast(e2?.message || t('image_upload_failed', 'Could not upload the image.'), 'error');
    } finally {
      setUploading(false);
    }
  };

  // Drag directly on the banner to reposition the image focus.
  const onBannerPointerDown = (e) => {
    if (!imageUrl) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, baseX: imgPos.x, baseY: imgPos.y, w: e.currentTarget.clientWidth || 300, h: e.currentTarget.clientHeight || 120 };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };
  const onBannerPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const nx = Math.max(0, Math.min(100, d.baseX - ((e.clientX - d.startX) / d.w) * 100));
    const ny = Math.max(0, Math.min(100, d.baseY - ((e.clientY - d.startY) / d.h) * 100));
    setImgPos({ x: nx, y: ny });
  };
  const onBannerPointerUp = (e) => {
    dragRef.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
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
    // Expiry rules: included offer must explicitly choose date or open; paid extra
    // must set a date (no open-ended) and be affordable.
    if (!isExtra && !expiryMode) {
      showToast(t('offer_expiry_choose', 'Choose an end date or make the offer open-ended.'), 'error');
      return;
    }
    const wantsDate = isExtra || expiryMode === 'date';
    if (wantsDate && !expiry) {
      showToast(t('offer_expiry_pick_date', 'Pick the offer end date.'), 'error');
      return;
    }
    if (isExtra && !canAfford) {
      showToast(
        t('offer_insufficient_credits', 'Not enough credits: {{cost}} needed for {{days}} day(s).', {
          cost: extraCost,
          days: expiryDays,
        }),
        'error'
      );
      return;
    }
    setSending(true);
    try {
      const expiresAt = wantsDate && expiry ? new Date(`${expiry}T23:59:59`).getTime() : undefined;
      const res = await sendCommunityOffer({
        title: ttl,
        description: desc.trim(),
        oncePerMember: once,
        expiresAt,
        notifyMembers: notify,
        onFeed: feed,
        onSwipe: swipe,
        imageUrl: imageUrl || undefined,
        imagePosX: imageUrl ? Math.round(imgPos.x) : undefined,
        imagePosY: imageUrl ? Math.round(imgPos.y) : undefined,
        imageZoom: imageUrl ? imgZoom : undefined,
        bgColor,
      });
      if (res?.success === false) {
        if (res.reason === 'insufficient_credits') {
          showToast(
            t('offer_insufficient_credits', 'Not enough credits: {{cost}} needed for {{days}} day(s).', {
              cost: res.requiredCredits || extraCost,
              days: res.days || expiryDays,
            }),
            'error'
          );
        } else if (res.reason === 'expiry_required') {
          showToast(t('offer_expiry_pick_date', 'Pick the offer end date.'), 'error');
        } else if (res.reason === 'swipe_taken') {
          setSwipeTaken(true);
          setSwipe(false);
          showToast(
            t('offer_swipe_taken_hint', 'The swipe card already shows another offer. Delete it first to feature this one.'),
            'error'
          );
        } else {
          showToast(t('offer_send_failed', 'Could not send the offer. Please try again.'), 'error');
        }
        setSending(false);
        return;
      }
      showToast(
        res?.isPaidOffer
          ? t('offer_published_paid', 'Offer published — {{cost}} credits for {{days}} day(s).', {
              cost: res.paidCredits || extraCost,
              days: res.paidDays || expiryDays,
            })
          : t('offer_published_included', 'Offer published.'),
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
            {/* Live banner preview — drag directly on it to set the image focus */}
            <div
              className={`offer-banner offer-banner--preview${imageUrl ? ' offer-banner--draggable' : ''}`}
              style={offerBannerStyle({ imageUrl, bgColor, imagePosX: imgPos.x, imagePosY: imgPos.y, imageZoom: imgZoom })}
              onPointerDown={onBannerPointerDown}
              onPointerMove={onBannerPointerMove}
              onPointerUp={onBannerPointerUp}
              onPointerCancel={onBannerPointerUp}>
              <div className="offer-banner__content">
                <div className="offer-banner__business">{businessName}</div>
                <div className="offer-banner__title">{title || t('offer_preview_placeholder', 'Your offer title')}</div>
                {desc ? <div className="offer-banner__desc">{desc}</div> : null}
              </div>
              <span className="offer-banner__take">{t('offer_take_it', 'Take it')}</span>
              {imageUrl ? <span className="offer-banner__drag-hint">{t('offer_drag_hint', 'Drag to reposition')}</span> : null}
            </div>

            {imageUrl ? (
              <label className="offer-create-zoom">
                <span>{t('zoom', 'Zoom')}</span>
                <input
                  type="range"
                  min="1"
                  max="2.5"
                  step="0.05"
                  value={imgZoom}
                  onChange={(e) => setImgZoom(Number(e.target.value))} />
              </label>
            ) : null}

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
              <label className="cm-offer-once" style={swipeTaken ? { opacity: 0.55 } : undefined}>
                <input
                  type="checkbox"
                  checked={swipe && !swipeTaken}
                  disabled={swipeTaken}
                  onChange={(e) => setSwipe(e.target.checked)} />
                {t('offer_channel_swipe', 'Show on swipe card')}
              </label>
              {swipeTaken ? (
                <AppText as="p" className="offer-create-look__hint" style={{ marginTop: 0 }}>
                  {t('offer_swipe_taken_hint', 'The swipe card already shows another offer. Delete it first to feature this one.')}
                </AppText>
              ) : null}
              <label className="cm-offer-once">
                <input type="checkbox" checked={once} onChange={(e) => setOnce(e.target.checked)} />
                {t('offer_once_per_member', 'One redemption per member')}
              </label>
              {/* Expiry — included offer chooses date OR open; paid extra forces a date. */}
              <div className="cm-offer-expiry-block">
                <AppText as="div" className="cm-offer-expiry-title">
                  {t('offer_end_date_label', 'Offer end date')}
                </AppText>
                {!isExtra && (
                  <div className="cm-offer-expiry-modes">
                    <label className="cm-offer-once">
                      <input
                        type="radio"
                        name="expiryMode"
                        checked={expiryMode === 'date'}
                        onChange={() => setExpiryMode('date')} />
                      {t('offer_expiry_set_date', 'Set an end date')}
                    </label>
                    <label className="cm-offer-once">
                      <input
                        type="radio"
                        name="expiryMode"
                        checked={expiryMode === 'open'}
                        onChange={() => { setExpiryMode('open'); setExpiry(''); }} />
                      {t('offer_expiry_open', 'Keep it open (no end date)')}
                    </label>
                  </div>
                )}
                {(isExtra || expiryMode === 'date') && (
                  <input
                    type="date"
                    className="ui-form-field"
                    value={expiry}
                    min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
                    onChange={(e) => setExpiry(e.target.value)} />
                )}
              </div>

              {/* Included vs paid-extra summary */}
              {activeCount != null && (
                isExtra ? (
                  <div className="cm-offer-paid-note">
                    <FaCoins aria-hidden />
                    <div>
                      <AppText as="div" className="cm-offer-paid-note__title">
                        {t('offer_extra_title', 'Extra offer — {{rate}} credits/day', { rate: EXTRA_OFFER_CREDITS_PER_DAY })}
                      </AppText>
                      <AppText as="div" className="cm-offer-paid-note__line">
                        {expiryDays > 0
                          ? t('offer_extra_cost', 'Total: {{cost}} credits for {{days}} day(s). Balance: {{bal}}.', {
                              cost: extraCost,
                              days: expiryDays,
                              bal: spendable,
                            })
                          : t('offer_extra_pick_date', 'Pick an end date to see the cost. Balance: {{bal}}.', { bal: spendable })}
                      </AppText>
                      {expiryDays > 0 && !canAfford ? (
                        <AppText as="div" className="cm-offer-paid-note__warn">
                          {t('offer_not_enough_credits', 'Not enough credits.')}
                        </AppText>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <AppText as="p" className="cm-offer-included-note">
                    {t('offer_included_note', 'This is your included offer (free with your plan).')}
                  </AppText>
                )
              )}
            </div>
            <button
              type="button"
              className="cm-offer-send-btn"
              onClick={submit}
              disabled={sending || !title.trim() || (isExtra && !canAfford)}>
              {sending
                ? t('sending', 'Sending…')
                : isExtra && extraCost > 0
                ? t('offer_publish_pay', 'Publish · {{cost}} credits', { cost: extraCost })
                : t('offer_publish', 'Publish offer')}
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
