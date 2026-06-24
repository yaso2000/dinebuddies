import React, { useMemo, useRef, useState } from 'react';
import { captureElementAsPngBlob } from '../../../utils/privateInvitationCardCapture';
import { useTranslation } from 'react-i18next';
import { FaDownload, FaShareAlt } from 'react-icons/fa';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { getSafeAvatar } from '../../../utils/avatarUtils';
import SocialInvitationShareCapture from './SocialInvitationShareCapture';
import SocialInvitationCardPreview from './SocialInvitationCardPreview';
import { buildSocialInvitationCardPreviewProps } from './buildSocialInvitationCardPreviewProps';
import { getInvitationCardTextBackdropFromInvitation } from './socialCardTextBackdrop';
import { getSocialInvitationHeroCoverFromInvitation } from './socialCardBackgrounds';

/**
 * Host-only: full invitation card preview + PNG download + native share (when supported).
 */import { AppText } from "../../base";
export default function HostSocialInvitationCardExport({ invitation }) {
  const { t } = useTranslation();
  const { userProfile } = useAuth();
  const { showToast } = useToast();
  const captureRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const { inviterName, inviterAvatarUrl } = useMemo(() => {
    const authorLike = {
      ...(userProfile || {}),
      ...(invitation.author || {}),
      id: invitation.authorId || invitation.author?.id
    };
    return {
      inviterName:
      invitation.author?.displayName ||
      invitation.author?.name ||
      userProfile?.displayName ||
      userProfile?.name ||
      '',
      inviterAvatarUrl: getSafeAvatar(authorLike)
    };
  }, [invitation.author, invitation.authorId, userProfile]);

  const cardHeroCover = useMemo(() => {
    if (!invitation) return null;
    return getSocialInvitationHeroCoverFromInvitation(invitation);
  }, [invitation]);

  const textBackdrop = useMemo(
    () => getInvitationCardTextBackdropFromInvitation(invitation),
    [invitation]
  );

  const cardPreviewProps = useMemo(
    () =>
    buildSocialInvitationCardPreviewProps(invitation, {
      heroCover: cardHeroCover,
      inviterName,
      inviterAvatarUrl,
      textBackdrop
    }),
    [invitation, cardHeroCover, inviterName, inviterAvatarUrl, textBackdrop]
  );

  const capturePngBlob = async () =>
  captureElementAsPngBlob(captureRef.current, { forShare: true });

  const handleDownload = async () => {
    setBusy(true);
    try {
      const blob = await capturePngBlob();
      if (!blob) {
        showToast(t('social_card_export_error', 'Could not create the image.'), 'error');
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dinebuddies-invitation-${invitation.id}.jpg`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      showToast(t('social_card_export_error', 'Could not create the image.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleShare = async () => {
    setBusy(true);
    try {
      const blob = await capturePngBlob();
      if (!blob) {
        showToast(t('social_card_export_error', 'Could not create the image.'), 'error');
        return;
      }
      const file = new File([blob], `dinebuddies-invitation-${invitation.id}.jpg`, {
        type: blob.type || 'image/jpeg'
      });
      const shareData = {
        files: [file],
        title: invitation.title || t('social_invitation', 'Private invitation'),
        text: invitation.title || ''
      };
      if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
        return;
      }
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: invitation.title || t('social_invitation', 'Private invitation'),
          text: `${invitation.title || ''}\n${typeof window !== 'undefined' ? window.location.href : ''}`.trim()
        });
        return;
      }
      showToast(t('social_card_share_unavailable', 'Sharing is not available on this device. Use download instead.'), 'info');
    } catch (e) {
      if (e?.name === 'AbortError') return;
      console.error(e);
      showToast(t('social_card_export_error', 'Could not create the image.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const showShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <div
      className="host-social-invitation-card-export reveal-text reveal-delay-2"
      style={{
        marginBottom: '1.75rem',
        padding: '1rem',
        borderRadius: '24px',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        textAlign: 'center'
      }}>
      
            <AppText as="h3"
      style={{
        fontSize: '0.75rem',
        color: 'var(--luxury-gold)',
        textTransform: 'uppercase',
        letterSpacing: '2px',
        marginBottom: '14px',
        fontWeight: 800
      }}>
        
                {t('social_card_host_section_title', 'Your invitation card')}
            </AppText>

            <div style={{ display: 'flex', justifyContent: 'center' }}>
                {cardPreviewProps ? <SocialInvitationCardPreview {...cardPreviewProps} /> : null}
            </div>

            <SocialInvitationShareCapture ref={captureRef} cardPreviewProps={cardPreviewProps} />

            <div className="host-private-card-export__actions">
                <button
          type="button"
          onClick={handleDownload}
          disabled={busy}
          className="host-private-card-export__btn host-private-card-export__btn--primary vip-btn">
          
                    <FaDownload size={14} aria-hidden />
                    {t('social_card_download_png', 'Download image')}
                </button>
                {showShare &&
        <button
          type="button"
          onClick={handleShare}
          disabled={busy}
          className="host-private-card-export__btn host-private-card-export__btn--secondary vip-btn">
          
                        <FaShareAlt size={14} aria-hidden />
                        {t('social_card_share', 'Share')}
                    </button>
        }
            </div>
        </div>);

}