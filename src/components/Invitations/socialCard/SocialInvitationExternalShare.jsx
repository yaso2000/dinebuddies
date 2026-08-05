import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaShareAlt } from 'react-icons/fa';
import { useToast } from '../../../context/ToastContext';
import {
  buildPrivateInvitationShareMessage,
  resolveSocialInvitationExternalShareUrl } from
'../../../utils/privateInvitationShare';
import {
  buildInvitationCardShareText,
  copyInvitationShareText,
  prepareInvitationShareFile,
  shareSocialInvitationCardImage } from
'../../../utils/shareSocialInvitationCardImage';
import { isAndroid, isIOS } from '../../../services/notificationService';
import './SocialInvitationExternalShare.css';

/**
 * Share invitation card image + message + DineBuddies app/profile link.
 * Registered guests are invited in-app via SocialInvitationInviteePanel — not via this link.
 */import { AppText } from "../../base";
export default function SocialInvitationExternalShare({
  invitation = {},
  cardCaptureRef = null,
  onShareSuccess = null,
  className = '',
  prominent = false,
  minimal = false
}) {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();

  const [sharing, setSharing] = useState(false);
  const [captureReady, setCaptureReady] = useState(!isAndroid());

  const shareFileCacheRef = useRef(null);
  const shareFileCacheKeyRef = useRef('');
  const shareTapInFlightRef = useRef(false);
  const warmCaptureInFlightRef = useRef(false);

  const inviterName =
  invitation?.inviterName ||
  invitation?.author?.displayName ||
  invitation?.author?.display_name ||
  invitation?.author?.name ||
  '';

  const shareInvitation = useMemo(
    () => ({ ...invitation, inviterName }),
    [invitation, inviterName]
  );

  const shareUrl = useMemo(
    () => resolveSocialInvitationExternalShareUrl(shareInvitation),
    [shareInvitation]
  );

  const shareTitle = shareInvitation.title || t('social_invitation', 'Private Invitation');

  const messageBody = useMemo(
    () => buildPrivateInvitationShareMessage(shareInvitation, shareUrl, t, { language: i18n.language }),
    [shareInvitation, shareUrl, t, i18n.language]
  );

  const shareFileCacheKey = useMemo(() => {
    const stamp =
    invitation?.updatedAt?.seconds ||
    invitation?.updatedAt?.toMillis?.() ||
    invitation?.updatedAt ||
    '';
    return [
    invitation?.id,
    invitation?.title,
    invitation?.description,
    invitation?.cardBackgroundId,
    invitation?.cardGradientId,
    stamp].
    join('|');
  }, [invitation]);

  useEffect(() => {
    const el = cardCaptureRef?.current;
    if (!el) {
      setCaptureReady(!isAndroid());
      return undefined;
    }

    if (shareFileCacheKeyRef.current === shareFileCacheKey && shareFileCacheRef.current) {
      setCaptureReady(true);
      return undefined;
    }

    if (warmCaptureInFlightRef.current) return undefined;

    setCaptureReady(!isAndroid());

    let cancelled = false;
    warmCaptureInFlightRef.current = true;

    const warmDelayMs = isAndroid() ? 0 : 800;
    const timer = window.setTimeout(async () => {
      try {
        const file = await prepareInvitationShareFile(el);
        if (cancelled || !file) return;
        shareFileCacheRef.current = file;
        shareFileCacheKeyRef.current = shareFileCacheKey;
        setCaptureReady(true);
      } finally {
        warmCaptureInFlightRef.current = false;
      }
    }, warmDelayMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      warmCaptureInFlightRef.current = false;
    };
  }, [cardCaptureRef, shareFileCacheKey]);

  const androidShareReady = !isAndroid() || captureReady;

  const handleCopyMessage = useCallback(async () => {
    const copied = await copyInvitationShareText(messageBody);
    showToast(
      copied ?
      t('social_share_message_copied', { defaultValue: 'Invitation message copied' }) :
      t('copy_failed', { defaultValue: 'Could not copy link' }),
      copied ? 'success' : 'error'
    );
  }, [messageBody, showToast, t]);

  const handleShare = useCallback(async () => {
    if (shareTapInFlightRef.current) return;

    const el = cardCaptureRef?.current;
    if (!el) {
      showToast(t('social_share_image_missing', 'Could not capture the invitation card.'), 'error');
      return;
    }

    shareTapInFlightRef.current = true;
    setSharing(true);
    try {
      let shareFile = shareFileCacheRef.current;
      const hadCachedFile =
      Boolean(shareFile) && shareFileCacheKeyRef.current === shareFileCacheKey;
      if (!shareFile || shareFileCacheKeyRef.current !== shareFileCacheKey) {
        if (isAndroid()) {
          showToast(
            t('social_share_android_preparing', {
              defaultValue: 'Preparing invitation image…'
            }),
            'info',
            null,
            2500
          );
        }
        shareFile = await prepareInvitationShareFile(el);
        if (shareFile) {
          shareFileCacheRef.current = shareFile;
          shareFileCacheKeyRef.current = shareFileCacheKey;
          setCaptureReady(true);
        }
      }

      if (!shareFile && !messageBody) {
        showToast(t('social_share_image_missing', 'Could not capture the invitation card.'), 'error');
        return;
      }

      const combinedShareText = buildInvitationCardShareText({
        text: messageBody,
        url: shareUrl
      });

      let skipClipboardCopy = false;
      let showedIosClipboardHint = false;
      if (isIOS() && combinedShareText) {
        const copied = await copyInvitationShareText(combinedShareText);
        if (copied) {
          showedIosClipboardHint = true;
          skipClipboardCopy = true;
          showToast(
            t('social_share_ios_paste_hint', {
              defaultValue:
              'تم نسخ نص الدعوة والرابط! يمكنك لصقهما مباشرة في حال لم يظهرا أثناء مشاركة الصورة.'
            }),
            'info',
            null,
            5500
          );
          await new Promise((resolve) => window.setTimeout(resolve, 450));
        }
      }

      const result = await shareSocialInvitationCardImage({
        file: shareFile,
        title: shareTitle,
        text: messageBody,
        url: shareUrl,
        skipClipboardCopy
      });

      if (result === 'aborted') return;

      if (result === 'native' || result === 'native-text-only') {
        onShareSuccess?.();
      }

      if (result === 'failed') {
        if (isAndroid() && !hadCachedFile) {
          showToast(
            t('social_share_android_retry_hint', {
              defaultValue:
              'Invitation is ready — tap Share once more to open the share menu.'
            }),
            'info',
            null,
            5000
          );
        } else {
          showToast(
            t('social_share_sheet_failed', {
              defaultValue:
              'Could not open the share menu. Copy the message below or try again.'
            }),
            'error',
            null,
            6000
          );
        }
        return;
      }

      if (!minimal && result !== 'downloaded' && !showedIosClipboardHint) {
        showToast(
          t('social_share_app_link_hint', {
            defaultValue:
            'Shared the invitation card. Recipients can join you on DineBuddies via the link.'
          }),
          'info',
          null,
          5000
        );
      }
    } finally {
      shareTapInFlightRef.current = false;
      setSharing(false);
    }
  }, [
  cardCaptureRef,
  messageBody,
  minimal,
  onShareSuccess,
  shareFileCacheKey,
  shareTitle,
  shareUrl,
  showToast,
  t]
  );

  const disabled = sharing || isAndroid() && !androidShareReady;

  const buttonLabel = sharing ?
  t('social_share_preparing', { defaultValue: 'Preparing…' }) :
  isAndroid() && !androidShareReady ?
  t('social_share_preparing', { defaultValue: 'Preparing…' }) :
  t('social_share_send_sms_social', {
    defaultValue: 'Send via SMS & social'
  });

  return (
    <div
      className={`private-external-share private-external-share--single${prominent ? ' private-external-share--prominent' : ''}${minimal ? ' private-external-share--minimal' : ''} ${className}`.trim()}>
      
            {!minimal && prominent ?
      <AppText as="p" className="private-external-share__title">
                    {t('social_share_outside_app_title', {
          defaultValue: 'Share outside the app (WhatsApp & SMS)'
        })}
                </AppText> :
      null}
            {!minimal ?
      <AppText as="p" className="private-external-share__hint private-external-share__hint--above">
                    {t('social_share_outside_app_hint', {
          defaultValue:
          'Sends the invitation image and a link to DineBuddies. App members should be invited with «Send to app members» above.'
        })}
                </AppText> :
      null}
            {!minimal && shareUrl ?
      <div className="private-external-share__link-row">
                    <a
          href={shareUrl}
          className="private-external-share__link"
          title={shareUrl}
          target="_blank"
          rel="noopener noreferrer">
          
                        {shareUrl}
                    </a>
                    <button type="button" className="private-external-share__copy" onClick={handleCopyMessage}>
                        {t('social_share_copy_message', { defaultValue: 'Copy message' })}
                    </button>
                </div> :
      null}
            <button
        type="button"
        className={`private-external-share__primary-btn private-external-share__primary-btn--share${minimal ? ' private-external-share__primary-btn--secondary' : ''}`}
        onClick={handleShare}
        disabled={disabled}>
        
                <FaShareAlt aria-hidden />
                <AppText as="span">{buttonLabel}</AppText>
            </button>
            {!minimal ?
      <AppText as="p" className="private-external-share__btn-hint">
                    {t('social_share_card_and_app_hint', {
          defaultValue:
          'Shares the invitation card image with event details and your DineBuddies profile link.'
        })}
                </AppText> :
      null}
        </div>);

}