import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaWhatsapp } from 'react-icons/fa';
import { useToast } from '../../../context/ToastContext';
import { useInvitations } from '../../../context/InvitationContext';
import {
    buildPrivateInvitationShareMessage,
    buildPrivateInvitationShareUrl,
} from '../../../utils/privateInvitationShare';
import { sharePrivateInvitationCardImage } from '../../../utils/sharePrivateInvitationCardImage';
import './PrivateInvitationExternalShare.css';

/**
 * Single messaging share button — OS share sheet (WhatsApp, SMS, Telegram, etc.) with card image.
 */
export default function PrivateInvitationExternalShare({
    invitationId,
    invitation = {},
    shareToken: initialToken = null,
    cardCaptureRef = null,
    allowImageOnly = false,
    onShareSuccess = null,
    className = '',
}) {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const { ensurePrivateInvitationShareToken } = useInvitations();

    const [shareToken, setShareToken] = useState(initialToken || invitation?.shareToken || null);
    const [loadingToken, setLoadingToken] = useState(false);
    const [tokenError, setTokenError] = useState(false);
    const [sharing, setSharing] = useState(false);

    const ensureRef = useRef(ensurePrivateInvitationShareToken);
    ensureRef.current = ensurePrivateInvitationShareToken;
    const fetchKeyRef = useRef(null);

    useEffect(() => {
        if (initialToken) {
            setShareToken(initialToken);
            setTokenError(false);
        }
    }, [initialToken]);

    const needsPublishedLink = !allowImageOnly;

    useEffect(() => {
        if (!needsPublishedLink || !invitationId || shareToken) {
            setLoadingToken(false);
            return undefined;
        }

        const fetchKey = `${invitationId}`;
        if (fetchKeyRef.current === fetchKey) return undefined;
        fetchKeyRef.current = fetchKey;

        let cancelled = false;
        setLoadingToken(true);
        setTokenError(false);

        ensureRef.current(invitationId)
            .then((token) => {
                if (cancelled) return;
                if (token) setShareToken(token);
                else setTokenError(true);
            })
            .catch(() => {
                if (cancelled) return;
                setTokenError(true);
            })
            .finally(() => {
                if (!cancelled) setLoadingToken(false);
            });

        return () => {
            cancelled = true;
        };
    }, [invitationId, shareToken, needsPublishedLink]);

    const shareUrl = useMemo(
        () => (shareToken ? buildPrivateInvitationShareUrl(shareToken) : ''),
        [shareToken]
    );

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

    const shareTitle = shareInvitation.title || t('private_invitation', 'Private Invitation');

    const handleShare = useCallback(async () => {
        const el = cardCaptureRef?.current;
        if (!el) {
            showToast(t('private_share_image_missing', 'Could not capture the invitation card.'), 'error');
            return;
        }

        if (needsPublishedLink && !shareUrl) {
            if (tokenError) {
                showToast(t('private_share_link_error', 'Could not create the share link.'), 'error');
            }
            return;
        }

        setSharing(true);
        try {
            const messageBody = buildPrivateInvitationShareMessage(shareInvitation, shareUrl, t);
            const result = await sharePrivateInvitationCardImage(el, {
                title: shareTitle,
                text: messageBody,
                url: shareUrl || undefined,
            });

            if (result === 'aborted') return;

            if (result === 'native' || result === 'downloaded' || result === 'native-text-only') {
                onShareSuccess?.();
            }

            if (result === 'downloaded') {
                showToast(
                    t('private_share_image_saved_attach', {
                        defaultValue:
                            'Invitation image saved — open your messaging app and attach the image from your gallery.',
                    }),
                    'info',
                    null,
                    6000
                );
            } else if (result === 'native-text-only') {
                showToast(
                    t('private_share_image_text_only', {
                        defaultValue:
                            'Only the link was shared. Try again and pick an app that accepts images, or attach the saved image manually.',
                    }),
                    'info',
                    null,
                    5000
                );
            }
        } finally {
            setSharing(false);
        }
    }, [
        cardCaptureRef,
        needsPublishedLink,
        shareInvitation,
        shareTitle,
        shareUrl,
        showToast,
        t,
        tokenError,
    ]);

    const disabled =
        sharing ||
        (needsPublishedLink && loadingToken) ||
        (needsPublishedLink && !shareUrl && tokenError);

    const buttonLabel = sharing
        ? t('sharing', 'Sharing…')
        : t('private_share_via_messaging', {
              defaultValue: 'Share via WhatsApp & messaging',
          });

    const retryShare = () => {
        fetchKeyRef.current = null;
        setTokenError(false);
        setLoadingToken(true);
        ensureRef.current(invitationId)
            .then((token) => {
                if (token) setShareToken(token);
                else setTokenError(true);
            })
            .catch(() => setTokenError(true))
            .finally(() => setLoadingToken(false));
    };

    if (needsPublishedLink && loadingToken) {
        return (
            <div className={`private-external-share private-external-share--single ${className}`.trim()}>
                <button
                    type="button"
                    className="private-external-share__primary-btn private-external-share__primary-btn--messaging"
                    disabled
                >
                    <FaWhatsapp aria-hidden />
                    {t('loading')}
                </button>
            </div>
        );
    }

    if (needsPublishedLink && !shareUrl && tokenError) {
        return (
            <div className={`private-external-share private-external-share--single ${className}`.trim()}>
                <button
                    type="button"
                    className="private-external-share__primary-btn private-external-share__primary-btn--messaging"
                    onClick={retryShare}
                >
                    {t('retry', 'Retry')}
                </button>
            </div>
        );
    }

    return (
        <div className={`private-external-share private-external-share--single ${className}`.trim()}>
            <button
                type="button"
                className="private-external-share__primary-btn private-external-share__primary-btn--messaging"
                onClick={handleShare}
                disabled={disabled}
            >
                <FaWhatsapp aria-hidden />
                <span>{buttonLabel}</span>
            </button>
            <p className="private-external-share__btn-hint">
                {t('private_share_via_messaging_hint', {
                    defaultValue:
                        'Shares the invitation image with a link. Choose WhatsApp, SMS, Telegram, or any messaging app.',
                })}
            </p>
        </div>
    );
}
