import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaSms } from 'react-icons/fa';
import { useToast } from '../../../context/ToastContext';
import { useInvitations } from '../../../context/InvitationContext';
import {
    buildPrivateInvitationShareMessage,
    buildPrivateInvitationShareUrl,
} from '../../../utils/privateInvitationShare';
import { openInvitationDirectSms } from '../../../utils/sharePrivateInvitationCardImage';
import './PrivateInvitationExternalShare.css';

/**
 * Opens the device SMS/Messages app directly (not the general share sheet).
 * Message body includes the link; card image is prepared for attachment.
 */
export default function PrivateInvitationSmsShareButton({
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
    const [opening, setOpening] = useState(false);

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

    const handleOpenSms = useCallback(async () => {
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

        setOpening(true);
        try {
            const messageBody = buildPrivateInvitationShareMessage(shareInvitation, shareUrl, t);
            const result = await openInvitationDirectSms(el, {
                title: shareTitle,
                text: messageBody,
                url: shareUrl || undefined,
            });

            if (result === 'failed') {
                showToast(
                    t('private_sms_open_failed', { defaultValue: 'Could not open the messaging app.' }),
                    'error'
                );
                return;
            }

            if (result === 'aborted') return;

            onShareSuccess?.();

            if (result === 'shared-with-image') {
                showToast(
                    t('private_sms_shared_with_image', {
                        defaultValue:
                            'Choose Messages or SMS — the invitation image and link are ready to send.',
                    }),
                    'success',
                    null,
                    5000
                );
            } else if (result === 'opened-clipboard') {
                showToast(
                    t('private_sms_opened_clipboard', {
                        defaultValue:
                            'Messages opened with the link. Paste the invitation image if needed, add recipients, then send.',
                    }),
                    'info',
                    null,
                    7000
                );
            } else {
                showToast(
                    t('private_sms_opened_attach', {
                        defaultValue:
                            'Messages opened with the link. Attach the invitation image from your gallery, add recipients, then send.',
                    }),
                    'info',
                    null,
                    7000
                );
            }
        } finally {
            setOpening(false);
        }
    }, [
        cardCaptureRef,
        needsPublishedLink,
        onShareSuccess,
        shareInvitation,
        shareTitle,
        shareUrl,
        showToast,
        t,
        tokenError,
    ]);

    const disabled =
        opening ||
        (needsPublishedLink && loadingToken) ||
        (needsPublishedLink && !shareUrl && tokenError);

    const buttonLabel = opening
        ? t('opening', { defaultValue: 'Opening…' })
        : t('private_sms_open_button', { defaultValue: 'Send via text message (SMS)' });

    const retry = () => {
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
                    className="private-external-share__primary-btn private-external-share__primary-btn--sms"
                    disabled
                >
                    <FaSms aria-hidden />
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
                    className="private-external-share__primary-btn private-external-share__primary-btn--sms"
                    onClick={retry}
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
                className="private-external-share__primary-btn private-external-share__primary-btn--sms"
                onClick={handleOpenSms}
                disabled={disabled}
            >
                <FaSms aria-hidden />
                <span>{buttonLabel}</span>
            </button>
            <p className="private-external-share__btn-hint">
                {t('private_sms_open_hint', {
                    defaultValue:
                        'Shares the invitation image with the link — pick Messages or SMS to send.',
                })}
            </p>
        </div>
    );
}
