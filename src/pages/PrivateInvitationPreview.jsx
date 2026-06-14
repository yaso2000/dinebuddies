import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaEdit, FaCheckCircle, FaArrowLeft } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import {
    isPrivateInvitationDraft,
    isPrivateInvitationPublished,
    getPrivateInvitationCreatePath,
    getPrivateDraftRecoveryCreatePath,
    rememberPrivateDraftCreateKind,
} from '../utils/privateInvitationDraft';
import { useInvitations } from '../context/InvitationContext';
import { useToast } from '../context/ToastContext';
import './PrivateInvitation.css';
import { getSafeAvatar } from '../utils/avatarUtils';
import PrivateInvitationCardPreview from '../components/Invitations/privateCard/PrivateInvitationCardPreview';
import { DEFAULT_FRAME_COLOR_ID } from '../components/Invitations/privateCard/privateCardFrameColors';
import { DEFAULT_FONT_ID } from '../components/Invitations/privateCard/privateCardFonts';
import {
    DEFAULT_CARD_COPY_OFFSET_Y,
    DEFAULT_CARD_COPY_WIDTH_PCT,
    DEFAULT_CARD_COPY_FONT_SCALE,
} from '../components/Invitations/privateCard/privateCardCopyLayout';
import {
    getDatingInvitationHeroCoverFromInvitation,
    getPrivateInvitationHeroCoverFromInvitation,
} from '../components/Invitations/datingCard/datingCardBackgrounds';
import { getInvitationCardTextBackdropFromInvitation } from '../components/Invitations/privateCard/privateCardTextBackdrop';
import PrivateInvitationExternalShare from '../components/Invitations/privateCard/PrivateInvitationExternalShare';
import PrivateInvitationSmsShareButton from '../components/Invitations/privateCard/PrivateInvitationSmsShareButton';
import PrivateInvitationInviteePanel from '../components/Invitations/privateCard/PrivateInvitationInviteePanel';
import '../components/Invitations/privateCard/PrivateInvitationExternalShare.css';

const PrivateInvitationPreview = () => {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const navigate = useNavigate();
    const { id: draftId } = useParams();
    const { publishPrivateInvitationDraft } = useInvitations();

    const cardCaptureRef = useRef(null);

    const [invitation, setInvitation] = useState(null);
    const [loadError, setLoadError] = useState(null);
    const [isPublishing, setIsPublishing] = useState(false);
    const [externalShareUsed, setExternalShareUsed] = useState(false);
    const [loading, setLoading] = useState(true);
    const [showLeaveDialog, setShowLeaveDialog] = useState(false);
    const [isLeaving, setIsLeaving] = useState(false);

    useEffect(() => {
        let cancelled = false;

        const fetchDraft = async () => {
            if (!draftId) {
                navigate(getPrivateDraftRecoveryCreatePath(), { replace: true });
                return;
            }

            setLoadError(null);
            setLoading(true);

            try {
                await auth.authStateReady();
                if (cancelled) return;

                const invitationRef = doc(db, 'private_invitations', draftId);
                let invitationDoc = await getDoc(invitationRef);
                if (!invitationDoc.exists()) {
                    await new Promise((r) => setTimeout(r, 400));
                    if (cancelled) return;
                    invitationDoc = await getDoc(invitationRef);
                }

                if (!invitationDoc.exists()) {
                    setLoadError('not_found');
                    showToast(t('invitation_not_found') || 'Draft not found', 'error');
                    return;
                }

                const data = invitationDoc.data();

                if (isPrivateInvitationPublished(data)) {
                    navigate(`/invitation/private/${draftId}`, { replace: true });
                    return;
                }

                if (!isPrivateInvitationDraft(data)) {
                    setLoadError('invalid_status');
                    showToast(
                        t('error_loading_draft') || 'Could not open this invitation draft.',
                        'error'
                    );
                    return;
                }

                setInvitation({
                    id: draftId,
                    ...data,
                });
                setExternalShareUsed(Boolean(data.externalShareUsed));
                rememberPrivateDraftCreateKind(data);
            } catch (error) {
                console.error('Error fetching private draft:', error);
                const code = error?.code || '';
                setLoadError(code === 'permission-denied' ? 'permission' : 'unknown');
                showToast(
                    code === 'permission-denied'
                        ? t('private_draft_permission_denied', {
                              defaultValue: 'Could not open the draft. Sign in again and retry.',
                          })
                        : t('error_loading_draft') || 'Error loading draft',
                    'error'
                );
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchDraft();
        return () => {
            cancelled = true;
        };
    }, [draftId, navigate, showToast, t]);

    const cardHeroCover = useMemo(() => {
        if (!invitation) return null;
        if (invitation.type === 'Dating') return getDatingInvitationHeroCoverFromInvitation(invitation);
        return getPrivateInvitationHeroCoverFromInvitation(invitation);
    }, [invitation]);

    const textBackdrop = useMemo(
        () => (invitation ? getInvitationCardTextBackdropFromInvitation(invitation) : null),
        [invitation]
    );

    const inviteMode = invitation?.type === 'Dating' ? 'dating' : 'private';

    const handleInvitedFriendsChange = (nextIds) => {
        setInvitation((prev) =>
            prev
                ? {
                      ...prev,
                      invitedFriends: nextIds,
                      rsvps: Object.fromEntries(nextIds.map((id) => [id, 'pending'])),
                  }
                : prev
        );
    };

    const markExternalShareUsed = async () => {
        setExternalShareUsed(true);
        setInvitation((prev) => (prev ? { ...prev, externalShareUsed: true } : prev));
        try {
            await updateDoc(doc(db, 'private_invitations', draftId), {
                externalShareUsed: true,
                updatedAt: serverTimestamp(),
            });
        } catch (e) {
            console.warn('Could not persist external share flag:', e);
        }
    };

    const persistPreviewDraft = async () => {
        if (!draftId || !invitation) return;
        await updateDoc(doc(db, 'private_invitations', draftId), {
            invitedFriends: invitation.invitedFriends || [],
            rsvps: invitation.rsvps || {},
            externalShareUsed: Boolean(externalShareUsed || invitation.externalShareUsed),
            updatedAt: serverTimestamp(),
        });
    };

    const handleBackClick = () => {
        setShowLeaveDialog(true);
    };

    const handleLeaveSave = async () => {
        setIsLeaving(true);
        try {
            await persistPreviewDraft();
            setShowLeaveDialog(false);
            showToast(
                t('private_preview_draft_saved', {
                    defaultValue: 'Invitation draft saved.',
                }),
                'success'
            );
            navigate('/', { replace: true });
        } catch (error) {
            console.error('Error saving preview draft:', error);
            showToast(t('failed_save_draft', { defaultValue: 'Could not save draft.' }), 'error');
        } finally {
            setIsLeaving(false);
        }
    };

    const handleLeaveDiscard = () => {
        setShowLeaveDialog(false);
        navigate('/', { replace: true });
    };

    const handlePublish = async () => {
        const inviteeCount = (invitation?.invitedFriends || []).filter(Boolean).length;
        const sharedExternally = externalShareUsed || invitation?.externalShareUsed;
        if (inviteeCount < 1 && !sharedExternally) {
            showToast(
                t('private_send_requires_invitee_or_share', {
                    defaultValue:
                        'Select at least one person in the app, or share the invitation once via messaging.',
                }),
                'error'
            );
            return;
        }

        setIsPublishing(true);
        try {
            const publishResult = await publishPrivateInvitationDraft(draftId);
            if (!publishResult?.success) return;

            showToast(
                t('private_invite_published_share', {
                    defaultValue: 'Invitation sent! Share the link with anyone not on the app.',
                }),
                'success'
            );
            navigate(`/invitation/private/${draftId}`, { replace: true });
        } catch (error) {
            console.error('Error publishing private invitation:', error);
            showToast(t('failed_publish_invitation'), 'error');
        } finally {
            setIsPublishing(false);
        }
    };

    if (loading) {
        return <div className="loading-container">{t('loading')}</div>;
    }

    if (!invitation) {
        return (
            <div className="page-container" style={{ padding: 24, textAlign: 'center' }}>
                <p style={{ marginBottom: 16, color: 'var(--text-muted)' }}>
                    {loadError === 'permission'
                        ? t('private_draft_permission_denied', {
                              defaultValue: 'Could not open the draft. Sign in again and retry.',
                          })
                        : t('error_loading_draft', { defaultValue: 'Could not load the invitation draft.' })}
                </p>
                <button
                    type="button"
                    className="vip-btn vip-btn-primary"
                    onClick={() => navigate(getPrivateDraftRecoveryCreatePath(), { replace: true })}
                >
                    {t('back_to_create', { defaultValue: 'Back to create invitation' })}
                </button>
            </div>
        );
    }

    return (
        <div
            className={`private-preview-container page-container theme-${(invitation.occasionType || 'social').toLowerCase()}`}
            style={{ paddingBottom: '40px' }}
        >
            <div className="preview-sticky-header invitation-preview-chrome__header">
                <button
                    type="button"
                    className="invitation-preview-chrome__back-btn"
                    onClick={handleBackClick}
                    disabled={isLeaving}
                >
                    <FaArrowLeft /> {t('back')}
                </button>
                <div className="invitation-preview-chrome__mode-label">
                    ✨ {t('preview_mode')}
                </div>
                <button
                    type="button"
                    className="invitation-preview-chrome__edit-btn"
                    onClick={() =>
                        navigate(getPrivateInvitationCreatePath(invitation), {
                            state: { editInvitation: invitation },
                        })
                    }
                    disabled={isPublishing}
                    aria-label={t('edit')}
                >
                    <FaEdit />
                </button>
            </div>

            <div className="private-preview-stack">
                <div className="private-preview-stack__card-wrap" ref={cardCaptureRef}>
                    <PrivateInvitationCardPreview
                        className="private-invitation-card-preview--showcase"
                        freezeMotion
                        cardTemplateSet={invitation.type === 'Dating' ? 'dating' : 'private'}
                        frameColorId={invitation.cardFrameColorId ?? DEFAULT_FRAME_COLOR_ID}
                        cardThemeColor={
                            invitation.type === 'Private'
                                ? invitation.privateCardThemeColor ?? null
                                : invitation.datingCardThemeColor ?? invitation.datingCardTextColor ?? null
                        }
                        cardFontId={invitation.cardFontId ?? DEFAULT_FONT_ID}
                        copyOffsetY={invitation.cardCopyOffsetY ?? DEFAULT_CARD_COPY_OFFSET_Y}
                        copyWidthPct={invitation.cardCopyWidthPct ?? DEFAULT_CARD_COPY_WIDTH_PCT}
                        copyFontScale={invitation.cardCopyFontScale ?? DEFAULT_CARD_COPY_FONT_SCALE}
                        occasionType={invitation.occasionType}
                        cardBackgroundId={invitation.cardBackgroundId || null}
                        cardGradientId={invitation.cardGradientId || null}
                        heroCoverSrc={cardHeroCover?.src ?? null}
                        heroCoverMediaType={cardHeroCover?.mediaType ?? null}
                        heroCoverPoster={cardHeroCover?.poster ?? null}
                        title={invitation.title}
                        description={invitation.description}
                        date={invitation.date}
                        time={invitation.time}
                        location={invitation.location}
                        inviterName={invitation.author?.name || ''}
                        inviterAvatarUrl={getSafeAvatar(invitation.author || {})}
                        showHostAndMessage={
                            invitation.type === 'Dating'
                                ? invitation.datingCardShowHostAndMessage !== false
                                : invitation.type === 'Private'
                                  ? invitation.privateCardShowHostAndMessage !== false
                                  : true
                        }
                        textBackdropTone={
                            invitation.type === 'Private' || invitation.type === 'Dating'
                                ? textBackdrop?.tone
                                : undefined
                        }
                    />
                </div>

                <PrivateInvitationInviteePanel
                    invitationId={draftId}
                    mode={inviteMode}
                    step="preview"
                    invitedFriendIds={invitation.invitedFriends || []}
                    onInvitedFriendsChange={handleInvitedFriendsChange}
                />

                <p className="private-preview-stack__send-hint">
                    {inviteMode === 'dating'
                        ? (invitation.invitedFriends?.length
                              ? t('dating_send_with_selected_or_share', {
                                    defaultValue:
                                        'Your date is selected below. Send in the app, or share via messaging.',
                                })
                              : t('dating_send_requires_one_or_share', {
                                    defaultValue:
                                        'Pick one person on the app (max 1), or share once via messaging before sending.',
                                }))
                        : t('private_send_requires_invitee_or_share', {
                              defaultValue:
                                  'Select at least one person in the app, or share the invitation once via messaging.',
                          })}
                </p>
                <div className="private-preview-stack__action-row">
                    <button
                        type="button"
                        className="private-preview-stack__send-btn vip-btn vip-btn-primary ui-btn ui-btn--primary"
                        onClick={handlePublish}
                        disabled={isPublishing}
                    >
                        {isPublishing ? (
                            t('publishing')
                        ) : (
                            <>
                                <FaCheckCircle aria-hidden />
                                {t('send_to_app_members', { defaultValue: 'Send to app members' })}
                            </>
                        )}
                    </button>
                    <PrivateInvitationExternalShare
                        invitationId={draftId}
                        invitation={invitation}
                        cardCaptureRef={cardCaptureRef}
                        allowImageOnly
                        onShareSuccess={markExternalShareUsed}
                    />
                    <PrivateInvitationSmsShareButton
                        invitationId={draftId}
                        invitation={invitation}
                        cardCaptureRef={cardCaptureRef}
                        allowImageOnly
                        onShareSuccess={markExternalShareUsed}
                    />
                </div>
            </div>

            {showLeaveDialog ? (
                <div
                    className="invitation-preview-leave-dialog"
                    role="alertdialog"
                    aria-modal="true"
                    aria-label={t('studio_close_title', 'Save your work?')}
                >
                    <div
                        className="invitation-preview-leave-dialog__backdrop"
                        onClick={() => !isLeaving && setShowLeaveDialog(false)}
                    />
                    <div className="invitation-preview-leave-dialog__card">
                        <h3 className="invitation-preview-leave-dialog__title">
                            {t('studio_close_title', 'Save your work?')}
                        </h3>
                        <p className="invitation-preview-leave-dialog__text">
                            {t(
                                'private_preview_leave_question',
                                'Save your invitation draft before leaving preview?'
                            )}
                        </p>
                        <div className="invitation-preview-leave-dialog__actions">
                            <button
                                type="button"
                                className="invitation-preview-leave-dialog__btn invitation-preview-leave-dialog__btn--save"
                                onClick={handleLeaveSave}
                                disabled={isLeaving}
                            >
                                {isLeaving
                                    ? t('saving', 'Saving…')
                                    : t('studio_save_draft', 'Save draft')}
                            </button>
                            <button
                                type="button"
                                className="invitation-preview-leave-dialog__btn invitation-preview-leave-dialog__btn--discard"
                                onClick={handleLeaveDiscard}
                                disabled={isLeaving}
                            >
                                {t('studio_close_discard', 'Discard')}
                            </button>
                            <button
                                type="button"
                                className="invitation-preview-leave-dialog__btn invitation-preview-leave-dialog__btn--cancel"
                                onClick={() => setShowLeaveDialog(false)}
                                disabled={isLeaving}
                            >
                                {t('studio_close_keep_editing', 'Keep editing')}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
};

export default PrivateInvitationPreview;
